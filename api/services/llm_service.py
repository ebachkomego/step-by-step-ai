import json
import math
import logging
import httpx
from typing import List, Dict, Any, Optional, Tuple
from api.schemas import POIPoint, RouteStop
from api.config import settings

logger = logging.getLogger(__name__)

SCENARIO_CONFIGS = {
    "date": {
        "title": "Романтическое свидание",
        "description": "Маршрут для двоих: атмосферные локации, уютная кофейня и красивые виды для неспешного общения.",
        "preferred_categories": ["Кофейня", "Пекарня / Десерты", "Парк / Сквер", "Смотровая площадка", "Достопримечательность"],
        "default_descriptions": [
            "Идеальное место для начала прогулки, чашки кофе и душевного разговора.",
            "Живописная локация для красивых совместных фотографий и отдыха.",
            "Уютный уголок, чтобы насладиться десертом и обсудить впечатления."
        ]
    },
    "tourist": {
        "title": "Городская экскурсия",
        "description": "Погружение в атмосферу города: архитектура, исторические памятники и знаковые виды.",
        "preferred_categories": ["Достопримечательность", "Историческое место", "Смотровая площадка", "Парк / Сквер", "Кофейня"],
        "default_descriptions": [
            "Знаковая точка маршрута с запоминающейся архитектурой.",
            "Красивая городская панорама, позволяющая оценить масштаб города.",
            "Отличная остановка, чтобы перезагрузиться и попробовать кофе."
        ]
    },
    "coffee_walk": {
        "title": "Кофе и мысли",
        "description": "Спокойный маршрут для перезагрузки, прогулки в тишине или дружеской беседы со стаканчиком кофе.",
        "preferred_categories": ["Кофейня", "Пекарня / Десерты", "Парк / Сквер"],
        "default_descriptions": [
            "Первая остановка за любимым кофе и выпечкой навынос.",
            "Тихая аллея или сквер для неспешной прогулки.",
            "Укромное место с отличным видом для завершения прогулки."
        ]
    },
    "dog_walk": {
        "title": "Прогулка с собакой",
        "description": "Зеленый маршрут вдали от оживленных трасс: просторные парки и площадки для четвероногого друга.",
        "preferred_categories": ["Парк / Сквер", "Смотровая площадка", "Кофейня"],
        "default_descriptions": [
            "Зеленый сквер с удобными дорожками для активной прогулки питомца.",
            "Открытая площадка с хорошим обзором и лавочками для отдыха.",
            "Кафе с dog-friendly атмосферой для напитка навынос."
        ]
    }
}

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2) ** 2))
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def fallback_select_stops(
    pois: List[POIPoint],
    start_lat: float,
    start_lon: float,
    duration_minutes: int,
    scenario: str
) -> List[RouteStop]:
    sc_info = SCENARIO_CONFIGS.get(scenario, SCENARIO_CONFIGS["date"])
    pref_cats = sc_info["preferred_categories"]

    sorted_pois = sorted(
        pois,
        key=lambda p: calculate_haversine_distance(start_lat, start_lon, p.lat, p.lon)
    )

    selected_pois: List[POIPoint] = []
    used_categories = set()

    for p in sorted_pois:
        if p.category in pref_cats and p.category not in used_categories:
            selected_pois.append(p)
            used_categories.add(p.category)
            if len(selected_pois) >= 3:
                break

    if len(selected_pois) < 3:
        for p in sorted_pois:
            if p not in selected_pois:
                selected_pois.append(p)
                if len(selected_pois) >= 3:
                    break

    selected_pois = selected_pois[:4]
    selected_pois.sort(
        key=lambda p: math.atan2(p.lon - start_lon, p.lat - start_lat)
    )

    total_spent_budget = max(20, int(duration_minutes * 0.45))
    spent_per_stop = max(10, total_spent_budget // max(1, len(selected_pois)))

    stops: List[RouteStop] = []
    descriptions = sc_info["default_descriptions"]

    for idx, p in enumerate(selected_pois):
        desc = descriptions[idx % len(descriptions)]
        spent = spent_per_stop
        if "Кофейня" in p.category or "Пекарня" in p.category or "Ресторан" in p.category:
            spent = max(20, spent + 5)
            desc = f"{p.name} — приятное место для напитка и отдыха."
        elif "Парк" in p.category:
            spent = max(15, spent)
            desc = f"{p.name} — живописная зеленая зона для неспешной прогулки."
        elif "Смотровая" in p.category or "Достопримечательность" in p.category:
            spent = max(10, spent - 5)
            desc = f"{p.name} — красивая точка маршрута с запоминающейся атмосферой."

        stops.append(
            RouteStop(
                name=p.name,
                category=p.category,
                lat=p.lat,
                lon=p.lon,
                spent_minutes=spent,
                description=desc,
                order=idx + 1
            )
        )

    return stops

async def plan_route_with_llm(
    pois: List[POIPoint],
    start_lat: float,
    start_lon: float,
    duration_minutes: int,
    scenario: str,
    user_api_key: Optional[str] = None
) -> Tuple[List[RouteStop], bool, str]:
    active_key = user_api_key or settings.GEMINI_API_KEY
    openai_key = user_api_key if (user_api_key and user_api_key.startswith("sk-")) else settings.OPENAI_API_KEY

    sc_info = SCENARIO_CONFIGS.get(scenario, SCENARIO_CONFIGS["date"])

    if active_key and not active_key.startswith("sk-"):
        try:
            prompt = f"Выбери от 2 до 4 лучших точек из списка для сценария '{sc_info['title']}', бюджет {duration_minutes} мин. Верни JSON: {{\"selected_stops\": [{{\"id\": \"...\", \"spent_minutes\": 20, \"description\": \"...\"}}]}}"
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={active_key}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    gemini_url,
                    json={
                        "contents": [{"parts": [{"text": f"{prompt}\nМеста: {[p.name for p in pois[:20]]}"}]}],
                        "generationConfig": {"response_mime_type": "application/json"}
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    txt = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(txt)
                    stops = _validate_and_build_stops(parsed, pois)
                    if stops:
                        return stops, True, "Google Gemini"
        except Exception:
            pass

    fallback_stops = fallback_select_stops(pois, start_lat, start_lon, duration_minutes, scenario)
    return fallback_stops, False, "Heuristic Geospatial Engine"

def _validate_and_build_stops(parsed_json: Dict[str, Any], pois: List[POIPoint]) -> List[RouteStop]:
    poi_by_id = {p.id: p for p in pois}
    stops_data = parsed_json.get("selected_stops", [])
    
    stops: List[RouteStop] = []
    order = 1
    for item in stops_data:
        poi_id = item.get("id")
        poi = poi_by_id.get(poi_id)
        if not poi:
            for cand in pois:
                if cand.name.lower() == item.get("name", "").strip().lower():
                    poi = cand
                    break

        if poi:
            spent = max(5, min(int(item.get("spent_minutes", 20)), 60))
            stops.append(
                RouteStop(
                    name=poi.name,
                    category=poi.category,
                    lat=poi.lat,
                    lon=poi.lon,
                    spent_minutes=spent,
                    description=item.get("description", f"Остановка в {poi.name}."),
                    order=order
                )
            )
            order += 1

    return stops
