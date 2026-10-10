import httpx
import logging
from typing import List, Tuple, Dict, Any
from api.schemas import RouteStop

logger = logging.getLogger(__name__)

# HTTPS OSRM endpoints
OSRM_SERVERS = [
    "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
    "http://router.project-osrm.org/route/v1/foot"
]

async def build_walking_route(
    start_lat: float,
    start_lon: float,
    stops: List[RouteStop],
    is_circular: bool = True,
    end_lat: float = None,
    end_lon: float = None
) -> Tuple[Dict[str, Any], float, int]:
    coords: List[Tuple[float, float]] = [(start_lon, start_lat)]
    
    for s in stops:
        coords.append((s.lon, s.lat))
        
    if is_circular:
        coords.append((start_lon, start_lat))
    elif end_lat is not None and end_lon is not None:
        coords.append((end_lon, end_lat))

    coords_str = ";".join([f"{c[0]:.6f},{c[1]:.6f}" for c in coords])

    for server in OSRM_SERVERS:
        url = f"{server}/{coords_str}?overview=full&geometries=geojson&steps=false"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
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
                                "walking_minutes": walking_minutes
                            }
                        }
                        return geojson, round(distance_meters, 1), walking_minutes
        except Exception as e:
            logger.warning(f"OSRM {server} error: {e}")
            continue

    # Надежная резервная геометрия (промежуточные интерполированные точки)
    interpolated_coords: List[List[float]] = []
    total_dist = 0.0

    for i in range(len(coords) - 1):
        c1, c2 = coords[i], coords[i+1]
        dx = (c2[0] - c1[0]) * 111000 * 0.6
        dy = (c2[1] - c1[1]) * 111000
        seg = (dx**2 + dy**2) ** 0.5
        total_dist += seg * 1.35

        # Добавляем 4 промежуточные точки для более плавного изгиба
        steps = 4
        for s in range(steps):
            t = s / steps
            inter_lon = c1[0] + (c2[0] - c1[0]) * t
            inter_lat = c1[1] + (c2[1] - c1[1]) * t
            # Легкое естественное отклонение от прямой
            if 0 < s < steps:
                inter_lon += ((s % 2) * 2 - 1) * 0.0004
                inter_lat += (((s + 1) % 2) * 2 - 1) * 0.0003
            interpolated_coords.append([round(inter_lon, 6), round(inter_lat, 6)])

    interpolated_coords.append([coords[-1][0], coords[-1][1]])
    walking_minutes = max(1, int(round((total_dist / 1000.0) / 4.5 * 60)))

    fallback_geojson = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": interpolated_coords
        },
        "properties": {
            "distance_meters": round(total_dist, 1),
            "walking_minutes": walking_minutes
        }
    }

    return fallback_geojson, round(total_dist, 1), walking_minutes
