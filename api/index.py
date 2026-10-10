import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.schemas import RouteRequest, RouteResponse
from api.services.poi_service import fetch_pois
from api.services.llm_service import plan_route_with_llm, SCENARIO_CONFIGS, fallback_select_stops
from api.services.router_service import build_walking_route

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("step-by-step-api")

app = FastAPI(
    title="StepByStep AI API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "StepByStep AI on Vercel"
    }

@app.get("/scenarios")
@app.get("/api/scenarios")
async def get_scenarios():
    return [
        {"id": sc_id, "title": data["title"], "description": data["description"]}
        for sc_id, data in SCENARIO_CONFIGS.items()
    ]

@app.post("/generate-route", response_model=RouteResponse)
@app.post("/api/generate-route", response_model=RouteResponse)
async def generate_route_endpoint(request: RouteRequest):
    try:
        # 1. Поиск POI (с быстрым таймаутом и авто-fallback)
        pois = await fetch_pois(
            lat=request.start_lat,
            lon=request.start_lon,
            duration_minutes=request.duration_minutes
        )

        # 2. Выбор точек
        stops, used_ai, ai_model = await plan_route_with_llm(
            pois=pois,
            start_lat=request.start_lat,
            start_lon=request.start_lon,
            duration_minutes=request.duration_minutes,
            scenario=request.scenario,
            user_api_key=request.api_key
        )

        if not stops:
            stops = fallback_select_stops(pois, request.start_lat, request.start_lon, request.duration_minutes, request.scenario)

        # 3. Пешеходный трек OSRM
        geojson, total_distance, walking_minutes = await build_walking_route(
            start_lat=request.start_lat,
            start_lon=request.start_lon,
            stops=stops,
            is_circular=request.is_circular,
            end_lat=request.end_lat,
            end_lon=request.end_lon
        )

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
            ai_model=ai_model
        )
    except Exception as e:
        logger.error(f"Fallback due to: {e}", exc_info=True)
        # Отказоустойчивый ответ даже в случае неожиданного сбоя
        pois = await fetch_pois(request.start_lat, request.start_lon, request.duration_minutes)
        stops = fallback_select_stops(pois, request.start_lat, request.start_lon, request.duration_minutes, request.scenario)
        geojson, total_distance, walking_minutes = await build_walking_route(
            request.start_lat, request.start_lon, stops, request.is_circular
        )
        total_spent = sum(s.spent_minutes for s in stops)
        return RouteResponse(
            total_walking_minutes=walking_minutes,
            total_distance_meters=total_distance,
            total_route_minutes=walking_minutes + total_spent,
            stops=stops,
            geojson=geojson,
            scenario=request.scenario,
            scenario_title="Прогулка",
            used_ai=False,
            ai_model="Geospatial Walk Engine"
        )
