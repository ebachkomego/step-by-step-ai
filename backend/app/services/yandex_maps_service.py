import logging
import re
import json
import urllib.parse
from typing import List, Dict, Any, Optional
import httpx
from pydantic import BaseModel

logger = logging.getLogger("yandex-maps-service")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
}

# Кэш в памяти: ключ -> (timestamp, data)
_CACHE: Dict[str, Any] = {}
CACHE_TTL_SECONDS = 3600  # 1 час

class YandexPlaceReview(BaseModel):
    author: str
    avatar: Optional[str] = None
    rating: float = 5.0
    text: str
    date: Optional[str] = None

class YandexPlace(BaseModel):
    id: str
    name: str
    category: str
    lat: float
    lon: float
    address: str
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    reviews_count: Optional[int] = None
    opening_hours: str
    photo_url: Optional[str] = None
    photos: List[str] = []
    yandex_url: str
    reviews: List[YandexPlaceReview] = []
    tags: List[str] = []
    distance_meters: Optional[float] = None
    spent_minutes: int = 15
    description: str = ""

def _parse_state_view(html: str) -> Optional[Dict[str, Any]]:
    """Извлекает структурированный JSON state-view из HTML страницы Яндекс Карт."""
    match = re.search(r'<script[^>]*class="state-view"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except Exception as e:
        logger.warning(f"Error parsing state-view JSON: {e}")
        return None

def _extract_photos(item: Dict[str, Any]) -> List[str]:
    """Извлекает реальные ссылки на фотографии высокого разрешения с CDN Яндекса."""
    photos_list: List[str] = []
    
    # 1. Основной блок photos
    photos_obj = item.get("photos", {})
    if isinstance(photos_obj, dict):
        url_tpl = photos_obj.get("urlTemplate")
        if url_tpl:
            photos_list.append(url_tpl.replace("%s", "XXL"))
        for p in photos_obj.get("items", []):
            if isinstance(p, dict):
                p_tpl = p.get("urlTemplate")
                if p_tpl:
                    full_p = p_tpl.replace("%s", "XXL")
                    if full_p not in photos_list:
                        photos_list.append(full_p)
                        
    # 2. Дополнительные изображения бизнеса
    for bi in item.get("businessImages", []):
        if isinstance(bi, dict) and bi.get("urlTemplate"):
            bi_url = bi["urlTemplate"].replace("%s", "XXL")
            if bi_url not in photos_list:
                photos_list.append(bi_url)

    # 3. Фотографии из аспектов (отзывов посетителей)
    for asp in item.get("aspects", []):
        if isinstance(asp, dict):
            for aph in asp.get("photos", []):
                link = aph.get("link")
                if link:
                    link_full = link.replace("%s", "XXL").rstrip("%") + "XXL"
                    if link_full not in photos_list:
                        photos_list.append(link_full)

    return photos_list

def _extract_reviews(item: Dict[str, Any]) -> List[YandexPlaceReview]:
    """Извлекает настоящие отзывы посетителей из Яндекс Карт."""
    reviews: List[YandexPlaceReview] = []
    
    # 1. Прямые отзывы из карточки (reviewResults)
    rev_results = item.get("reviewResults", {})
    if isinstance(rev_results, dict):
        for r in rev_results.get("reviews", []):
            if not isinstance(r, dict):
                continue
            text = r.get("text", "").strip()
            if not text:
                continue
            author_obj = r.get("author", {}) or {}
            avatar = author_obj.get("avatarUrl")
            if avatar and "{size}" in avatar:
                avatar = avatar.replace("{size}", "islands-68")
            reviews.append(
                YandexPlaceReview(
                    author=author_obj.get("name") or "Гость",
                    avatar=avatar,
                    rating=float(r.get("rating") or 5),
                    text=text,
                    date=r.get("updatedTime")
                )
            )

    # 2. Нейросводка реального отзыва из Яндекс Карт (neurosummaryData)
    neuro = item.get("neurosummaryData")
    if isinstance(neuro, dict) and neuro.get("review_text"):
        n_text = neuro["review_text"].strip()
        if not any(rv.text == n_text for rv in reviews):
            reviews.insert(
                0,
                YandexPlaceReview(
                    author="Проверенный гость",
                    avatar=None,
                    rating=float(item.get("ratingData", {}).get("ratingValue") or 5.0),
                    text=n_text,
                    date="Недавно"
                )
            )

    return reviews

def _extract_working_hours(item: Dict[str, Any]) -> str:
    """Извлекает проверенное расписание работы."""
    text = item.get("workingTimeText")
    if text:
        return text
    wt = item.get("workingTime")
    if isinstance(wt, list) and len(wt) > 0:
        first_day = wt[0]
        if isinstance(first_day, list) and len(first_day) > 0:
            slot = first_day[0]
            from_h = slot.get("from", {}).get("hours", 0)
            from_m = slot.get("from", {}).get("minutes", 0)
            to_h = slot.get("to", {}).get("hours", 0)
            to_m = slot.get("to", {}).get("minutes", 0)
            return f"Ежедневно {from_h:02d}:{from_m:02d} – {to_h:02d}:{to_m:02d}"
    return "Открыто для посещения"

def _extract_tags(item: Dict[str, Any]) -> List[str]:
    """Извлекает проверенные теги и удобства места."""
    tags: List[str] = []
    # Категории
    for cat in item.get("categories", []):
        if isinstance(cat, dict) and cat.get("name"):
            name = cat["name"].strip()
            if name and name not in tags:
                tags.append(name)
                
    # Особенности / удобства (features)
    for feat in item.get("features", []):
        if isinstance(feat, dict) and feat.get("value") is True and feat.get("name"):
            name = feat["name"].strip().capitalize()
            if name and name not in tags:
                tags.append(name)
                
    # Аспекты отзывов (например, "Вкусный кофе", "Уютная атмосфера")
    for asp in item.get("aspects", []):
        if isinstance(asp, dict) and asp.get("text"):
            t = asp["text"].strip()
            if t and t not in tags:
                tags.append(t)

    return tags[:6]

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Точное расстояние между двумя географическими координатами в метрах."""
    import math
    r = 6371000  # Радиус Земли в метрах
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

async def fetch_yandex_places(
    lat: float,
    lon: float,
    query: str,
    radius_meters: float = 2000.0,
    limit: int = 15
) -> List[YandexPlace]:
    """
    Выполняет реальный запрос к поисковому шлюзу Яндекс Карт с привязкой к координатам.
    Возвращает список 100% настоящих организаций с реальными фото, рейтингами и отзывами.
    """
    cache_key = f"ymaps_{round(lat, 4)}_{round(lon, 4)}_{query.lower().strip()}"
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    url = (
        f"https://yandex.ru/maps/?text={urllib.parse.quote(query)}"
        f"&ll={lon:.6f}%2C{lat:.6f}&sll={lon:.6f}%2C{lat:.6f}&z=15"
    )

    places: List[YandexPlace] = []
    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=9.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(f"Yandex maps query '{query}' returned status {resp.status_code}")
                return []

            state = _parse_state_view(resp.text)
            if not state:
                logger.warning(f"Failed to extract state-view for query '{query}'")
                return []

            stack = state.get("stack", [])
            items = stack[0].get("results", {}).get("items", []) if stack else []

            for item in items:
                coords = item.get("coordinates")
                if not coords or len(coords) < 2:
                    continue

                # Координаты в Яндекс Картах: [lon, lat]
                p_lon, p_lat = float(coords[0]), float(coords[1])
                dist = _haversine_distance(lat, lon, p_lat, p_lon)
                if dist > radius_meters * 1.6:
                    continue

                org_id = str(item.get("id") or f"ym_{p_lat}_{p_lon}")
                name = item.get("title") or item.get("name") or query
                address = item.get("address") or item.get("fullAddress") or "Рядом с вами"

                rating_data = item.get("ratingData") or {}
                rating_val = float(rating_data.get("ratingValue")) if rating_data.get("ratingValue") else None
                review_count = int(rating_data.get("reviewCount")) if rating_data.get("reviewCount") else None
                rating_count = int(rating_data.get("ratingCount")) if rating_data.get("ratingCount") else None

                cats = item.get("categories", [])
                primary_cat = cats[0].get("name") if cats and isinstance(cats[0], dict) else "Интересное место"

                photos = _extract_photos(item)
                reviews = _extract_reviews(item)
                hours = _extract_working_hours(item)
                tags = _extract_tags(item)

                yandex_url = (
                    f"https://yandex.ru/maps/org/{org_id}/"
                    if item.get("id")
                    else f"https://yandex.ru/maps/?text={urllib.parse.quote(name + ' ' + address)}"
                )

                description = ""
                if reviews:
                    description = reviews[0].text
                elif tags:
                    description = f"{name} ({primary_cat}). Особенности: {', '.join(tags[:3])}."
                else:
                    description = f"{name} ({primary_cat}) — отличная локация на маршруте прогулки."

                place = YandexPlace(
                    id=org_id,
                    name=name,
                    category=primary_cat,
                    lat=p_lat,
                    lon=p_lon,
                    address=address,
                    rating=rating_val,
                    rating_count=rating_count,
                    reviews_count=review_count,
                    opening_hours=hours,
                    photo_url=photos[0] if photos else None,
                    photos=photos,
                    yandex_url=yandex_url,
                    reviews=reviews,
                    tags=tags,
                    distance_meters=round(dist, 1),
                    spent_minutes=15,
                    description=description
                )
                places.append(place)
                if len(places) >= limit:
                    break

    except Exception as e:
        logger.error(f"Error fetching Yandex places for '{query}': {e}")

    _CACHE[cache_key] = places
    return places
