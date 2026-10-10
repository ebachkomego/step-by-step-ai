import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import RouteRequest, RouteResponse
from app.services.poi_service import fetch_pois
from app.services.llm_service import plan_route_with_llm, SCENARIO_CONFIGS
from app.services.router_service import build_walking_route

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("step-by-step-backend")

app = FastAPI(
    title="StepByStep AI Backend",
    description="Умная генерация пеших прогулочных маршрутов на основе времени, настроения и геолокации.",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "StepByStep AI",
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "has_openai_key": bool(settings.OPENAI_API_KEY)
    }

@app.get("/api/scenarios")
async def get_scenarios():
    """Возвращает доступные сценарии прогулок для интерфейса."""
    return [
        {
            "id": sc_id,
            "title": data["title"],
            "description": data["description"]
        }
        for sc_id, data in SCENARIO_CONFIGS.items()
    ]

@app.post("/api/generate-route", response_model=RouteResponse)
async def generate_route(request: RouteRequest):
    """
    Основной пайплайн:
    1. Поиск реальных POI через Overpass API в радиусе времени ходьбы
    2. Отбор 2-4 точек нейросетью под сценарий + тайминг
    3. Построение точного пешеходного GeoJSON трека через OSRM
    """
    logger.info(
        f"Получен запрос на построение маршрута: "
        f"lat={request.start_lat}, lon={request.start_lon}, "
        f"время={request.duration_minutes}м, сценарий='{request.scenario}', закольцован={request.is_circular}"
    )

    try:
        # 1. Поиск POI
        pois = await fetch_pois(
            lat=request.start_lat,
            lon=request.start_lon,
            duration_minutes=request.duration_minutes
        )
        logger.info(f"Найдено {len(pois)} POI в радиусе прогулки")

        # 2. Выбор точек нейросетью или эвристикой
        stops, used_ai, ai_model = await plan_route_with_llm(
            pois=pois,
            start_lat=request.start_lat,
            start_lon=request.start_lon,
            duration_minutes=request.duration_minutes,
            scenario=request.scenario,
            user_api_key=request.api_key
        )

        if not stops:
            raise HTTPException(status_code=404, detail="Не удалось подобрать подходящие точки для маршрута")

        # 3. Построение пешеходного маршрута через OSRM
        geojson, total_distance, walking_minutes = await build_walking_route(
            start_lat=request.start_lat,
            start_lon=request.start_lon,
            stops=stops,
            is_circular=request.is_circular,
            end_lat=request.end_lat,
            end_lon=request.end_lon
        )

        # Подсчет суммарного времени
        total_spent = sum(s.spent_minutes for s in stops)
        total_route_minutes = walking_minutes + total_spent

        sc_title = SCENARIO_CONFIGS.get(request.scenario, {}).get("title", "Прогулка")

        return RouteResponse(
            total_walking_minutes=walking_minutes,
            total_distance_meters=total_distance,
            total_route_minutes=total_route_minutes,
            stops=stops,
            geojson=geojson,
            scenario=request.scenario,
            scenario_title=sc_title,
            used_ai=used_ai,
            ai_model=ai_model,
            notes=f"Маршрут объединяет {len(stops)} остановок: {walking_minutes} мин. ходьбы и {total_spent} мин. отдыха."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Непредвиденная ошибка генерации маршрута: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка генерации маршрута: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
