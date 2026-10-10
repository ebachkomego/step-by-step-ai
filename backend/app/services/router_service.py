import httpx
import logging
from typing import List, Tuple, Dict, Any
from app.schemas import RouteStop

logger = logging.getLogger(__name__)

OSRM_FOOT_URL = "http://router.project-osrm.org/route/v1/foot"

async def build_walking_route(
    start_lat: float,
    start_lon: float,
    stops: List[RouteStop],
    is_circular: bool = True,
    end_lat: float = None,
    end_lon: float = None
) -> Tuple[Dict[str, Any], float, int]:
    """
    Строит реальный пешеходный маршрут через OSRM API.
    Возвращает: (geojson_feature, total_distance_meters, walking_minutes)
    """
    # Собираем все координаты в правильном порядке
    # OSRM принимает {lon},{lat}
    coords: List[Tuple[float, float]] = [(start_lon, start_lat)]
    
    for s in stops:
        coords.append((s.lon, s.lat))
        
    if is_circular:
        coords.append((start_lon, start_lat))
    elif end_lat is not None and end_lon is not None:
        coords.append((end_lon, end_lat))

    # Формируем строку координат для OSRM
    coords_str = ";".join([f"{c[0]:.6f},{c[1]:.6f}" for c in coords])
    url = f"{OSRM_FOOT_URL}/{coords_str}?overview=full&geometries=geojson&steps=false"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"User-Agent": "StepByStepAI/1.0"})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and "routes" in data and len(data["routes"]) > 0:
                    primary_route = data["routes"][0]
                    distance_meters = float(primary_route.get("distance", 0.0))
                    duration_seconds = float(primary_route.get("duration", 0.0))
                    walking_minutes = max(1, int(round(duration_seconds / 60.0)))
                    geometry = primary_route.get("geometry", {})

                    geojson = {
                        "type": "Feature",
                        "geometry": geometry,
                        "properties": {
                            "distance_meters": distance_meters,
                            "walking_minutes": walking_minutes,
                            "type": "walking_route"
                        }
                    }
                    return geojson, round(distance_meters, 1), walking_minutes
                else:
                    logger.warning(f"OSRM вернул не Ok код: {data.get('code')}")
            else:
                logger.warning(f"OSRM запрос завершился со статусом {resp.status_code}")
    except Exception as e:
        logger.warning(f"Ошибка обращения к OSRM: {e}")

    # Fallback геометрия (линейный трек), если публичный OSRM перегружен
    logger.info("Генерация резервной геометрии пешеходного маршрута")
    line_coordinates = [[c[0], c[1]] for c in coords]
    
    # Оценка расстояния по прямой * коэффициент пешеходного извилистости 1.35
    total_dist = 0.0
    for i in range(len(coords) - 1):
        c1, c2 = coords[i], coords[i+1]
        # приблизительно: 1 градус ~ 111 км
        dx = (c2[0] - c1[0]) * 111000 * 0.6
        dy = (c2[1] - c1[1]) * 111000
        seg = (dx**2 + dy**2) ** 0.5
        total_dist += seg * 1.35

    walking_minutes = max(1, int(round((total_dist / 1000.0) / 4.5 * 60)))  # 4.5 км/ч средний шаг

    fallback_geojson = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": line_coordinates
        },
        "properties": {
            "distance_meters": round(total_dist, 1),
            "walking_minutes": walking_minutes,
            "type": "fallback_route"
        }
    }

    return fallback_geojson, round(total_dist, 1), walking_minutes
