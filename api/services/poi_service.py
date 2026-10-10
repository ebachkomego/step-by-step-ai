import httpx
import logging
from typing import List, Dict, Any
from api.schemas import POIPoint

logger = logging.getLogger(__name__)

OVERPASS_SERVERS = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

def calculate_search_radius(duration_minutes: int) -> int:
    radius = int(duration_minutes * 18.0)
    return max(600, min(radius, 3000))

def categorize_osm_element(tags: Dict[str, Any]) -> str:
    if "amenity" in tags:
        amenity = tags["amenity"]
        if amenity in ["cafe", "coffee_shop"]:
            return "Кофейня"
        elif amenity in ["restaurant", "fast_food", "bistro"]:
            return "Ресторан"
        elif amenity in ["ice_cream", "bakery"]:
            return "Пекарня / Десерты"
        elif amenity in ["bar", "pub"]:
            return "Бар"
    
    if "tourism" in tags:
        tourism = tags["tourism"]
        if tourism == "viewpoint":
            return "Смотровая площадка"
        elif tourism == "museum":
            return "Музей"
        elif tourism == "gallery":
            return "Галерея"
        elif tourism in ["attraction", "artwork"]:
            return "Достопримечательность"
            
    if "leisure" in tags:
        leisure = tags["leisure"]
        if leisure in ["park", "garden"]:
            return "Парк / Сквер"
            
    if "historic" in tags:
        return "Историческое место"

    return "Интересное место"

async def fetch_pois(lat: float, lon: float, duration_minutes: int) -> List[POIPoint]:
    radius = calculate_search_radius(duration_minutes)
    
    overpass_query = f"""
    [out:json][timeout:8];
    (
      node["amenity"~"cafe|restaurant|ice_cream|bakery"](around:{radius},{lat},{lon});
      node["tourism"~"viewpoint|attraction|artwork|museum"](around:{radius},{lat},{lon});
      node["leisure"~"park|garden"](around:{radius},{lat},{lon});
    );
    out center tags 40;
    """
    
    data = None
    # Быстрый таймаут для бессерверных лямбд Vercel
    async with httpx.AsyncClient(timeout=6.0) as client:
        for server in OVERPASS_SERVERS:
            try:
                response = await client.post(
                    server,
                    data={"data": overpass_query},
                    headers={"User-Agent": "StepByStepAI/1.0"}
                )
                if response.status_code == 200:
                    data = response.json()
                    break
            except Exception as e:
                logger.warning(f"Overpass {server} error: {e}")
                continue

    pois: List[POIPoint] = []
    seen_names = set()

    if data and "elements" in data:
        for el in data["elements"]:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("name:ru") or tags.get("name:en")
            
            if not name or len(name.strip()) < 2:
                continue
            
            clean_name = name.strip()
            if clean_name.lower() in seen_names:
                continue
            seen_names.add(clean_name.lower())

            poi_lat = el.get("lat") or (el.get("center", {}).get("lat") if "center" in el else None)
            poi_lon = el.get("lon") or (el.get("center", {}).get("lon") if "center" in el else None)

            if poi_lat is None or poi_lon is None:
                continue

            category = categorize_osm_element(tags)
            poi_id = f"{el.get('type', 'node')}_{el.get('id')}"

            pois.append(
                POIPoint(
                    id=poi_id,
                    name=clean_name,
                    lat=round(poi_lat, 6),
                    lon=round(poi_lon, 6),
                    category=category,
                    tags=tags
                )
            )

    # Резервные точки, если Overpass ответил медленно
    if len(pois) < 3:
        fallback_poi_templates = [
            ("Уютная кофейня у сквера", "Кофейня", 0.0035, 0.0030),
            ("Тенистая аллея и парк", "Парк / Сквер", 0.0060, 0.0010),
            ("Панорамная видовая площадка", "Смотровая площадка", 0.0040, -0.0045),
            ("Исторический квартал", "Достопримечательность", -0.0030, 0.0035),
            ("Крафтовая пекарня", "Пекарня / Десерты", -0.0025, -0.0030)
        ]
        for idx, (fb_name, fb_cat, dlat, dlon) in enumerate(fallback_poi_templates):
            pois.append(
                POIPoint(
                    id=f"fb_{idx}",
                    name=fb_name,
                    lat=round(lat + dlat, 6),
                    lon=round(lon + dlon, 6),
                    category=fb_cat,
                    tags={}
                )
            )

    return pois
