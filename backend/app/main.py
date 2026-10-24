import logging
import math
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import (
    RouteRequest,
    RouteResponse,
    RouteStop,
    PlaceReview,
    PlacesSearchRequest,
    PlacesSearchResponse
)
from app.services.yandex_maps_service import fetch_yandex_places
from app.services.router_service import build_walking_route
from app.services.llm_service import SCENARIO_CONFIGS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("step-by-step-backend")

app = FastAPI(
    title="StepByStep AI Backend",
    description="Умная генерация пеших прогулочных маршрутов на основе 100% реальных данных Яндекс Карт.",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCENARIO_KEYWORDS = {
    "walk": ["красивый бульвар", "набережная", "пешеходная улица", "сквер"],
    "sights": ["достопримечательность", "памятник", "музей", "историческое здание"],
    "coffee": ["кофейня", "кофе с собой"],
    "fastfood": ["шаурма", "бургерная", "фастфуд", "пиццерия"],
    "views": ["смотровая площадка", "набережная", "панорамный вид", "бульвар"],
    "nature": ["парк", "сквер", "сад", "аллея"],
    "bakery": ["пекарня", "булочная", "свежая выпечка"],
    "date": ["уютная кофейня", "романтическое кафе", "бульвар"],
    "dog_walk": ["парк", "сквер", "дог-френдли кафе"],
    "shopping": ["торговый центр", "пассаж", "галерея магазинов"],
    "quiet": ["тихий сквер", "уединенный парк", "малолюдная аллея"],
    "sweets": ["кондитерская", "мороженое", "десерты"],
}

SCENARIO_TITLES = {
    "walk": "Прогулка по городу",
    "sights": "Памятники и достопримечательности",
    "coffee": "Кофейная прогулка",
    "fastfood": "Стритфуд и перекус",
    "views": "Красивые городские виды",
    "nature": "Прогулка на природе",
    "bakery": "Свежая выпечка и уют",
    "date": "Романтическая прогулка",
    "dog_walk": "Прогулка с собакой",
    "shopping": "Шопинг и витрины",
    "quiet": "Тихий спокойный отдых",
    "sweets": "Сладкое настроение",
}

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "StepByStep AI (100% Yandex Maps Live Data Engine)",
        "version": "2.0.0",
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "has_openai_key": bool(settings.OPENAI_API_KEY)
    }

@app.get("/api/scenarios")
async def get_scenarios():
    """Возвращает доступные сценарии прогулок для интерфейса."""
    return [
        {
            "id": sc_id,
            "title": SCENARIO_TITLES.get(sc_id, sc_id.capitalize()),
            "description": data.get("description", "Маршрут под ваше настроение")
        }
        for sc_id, data in SCENARIO_CONFIGS.items()
    ]

@app.post("/api/places/search", response_model=PlacesSearchResponse)
async def search_places(request: PlacesSearchRequest):
    """
    Поиск 100% реальных мест вокруг координат пользователя через поисковый шлюз Яндекс Карт.
    Возвращает заведения с официальными названиями, адресами, фото с CDN Яндекса, оценками и отзывами.
    """
    logger.info(f"Поиск мест: query='{request.query}', lat={request.lat}, lon={request.lon}")
    try:
        actual_query = request.query
        if actual_query in SCENARIO_KEYWORDS and SCENARIO_KEYWORDS[actual_query]:
            actual_query = SCENARIO_KEYWORDS[actual_query][0]

        yandex_places = await fetch_yandex_places(
            lat=request.lat,
            lon=request.lon,
            query=actual_query,
            radius_meters=request.radius_meters or 2000.0,
            limit=request.limit or 15
        )

        stops: List[RouteStop] = []
        for idx, yp in enumerate(yandex_places):
            reviews: List[PlaceReview] = [
                PlaceReview(
                    author=r.author,
                    avatar=r.avatar,
                    rating=r.rating,
                    text=r.text,
                    date=r.date
                )
                for r in yp.reviews
            ]

            stops.append(
                RouteStop(
                    id=yp.id,
                    name=yp.name,
                    category=yp.category,
                    lat=yp.lat,
                    lon=yp.lon,
                    spent_minutes=yp.spent_minutes,
                    description=yp.description,
                    order=idx + 1,
                    address=yp.address,
                    rating=yp.rating,
                    reviews_count=yp.reviews_count,
                    photo_url=yp.photo_url,
                    photos=yp.photos,
                    yandex_url=yp.yandex_url,
                    opening_hours=yp.opening_hours,
                    tags=yp.tags,
                    reviews=reviews
                )
            )

        return PlacesSearchResponse(query=request.query, places=stops)

    except Exception as e:
        logger.error(f"Ошибка поиска мест в Яндекс Картах: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-route", response_model=RouteResponse)
async def generate_route(request: RouteRequest):
    """
    Генерация пешего прогулочного маршрута исключительно на 100% реальных данных Яндекс Карт.
    1. Поиск проверенных заведений через Яндекс Карты.
    2. Отбор точек под желаемое время и сценарии.
    3. Построение точного пешеходного трека по городским улицам.
    """
    logger.info(
        f"Генерация маршрута: lat={request.start_lat}, lon={request.start_lon}, "
        f"время={request.duration_minutes}м, сценарий='{request.scenario}', "
        f"пожелание='{request.custom_prompt or ''}'"
    )

    try:
        # 1. Формирование поисковых запросов для Яндекс Карт
        search_queries: List[str] = []

        # Пользовательское пожелание имеет наивысший приоритет
        if request.custom_prompt and request.custom_prompt.strip():
            clean_prompt = request.custom_prompt.strip()
            search_queries.append(clean_prompt)

        # Выбранные сценарии и форматы
        active_acts = request.activities if request.activities else [request.scenario]
        for act in active_acts:
            kws = SCENARIO_KEYWORDS.get(act, [act])
            for kw in kws:
                if kw not in search_queries:
                    search_queries.append(kw)

        if not search_queries:
            search_queries = ["бульвар", "кофейня", "парк"]

        # Вычисление радиуса поиска от времени прогулки
        radius = min(3500.0, max(800.0, request.duration_minutes * 45.0))

        # Вычисление центра поиска (середина отрезка, если есть точка финиша)
        search_lat = request.start_lat
        search_lon = request.start_lon
        has_end = (
            request.end_lat is not None and
            request.end_lon is not None and
            not request.is_circular
        )
        if has_end:
            search_lat = (request.start_lat + request.end_lat) / 2.0
            search_lon = (request.start_lon + request.end_lon) / 2.0
            direct_dist = math.sqrt(
                (request.start_lat - request.end_lat)**2 +
                (request.start_lon - request.end_lon)**2
            ) * 111000
            radius = max(radius, direct_dist * 0.7)

        # 2. Поиск реальных заведений через Яндекс Карты
        all_candidates = []
        seen_names = set()

        for q in search_queries[:4]:
            found = await fetch_yandex_places(
                lat=search_lat,
                lon=search_lon,
                query=q,
                radius_meters=radius,
                limit=10
            )
            for p in found:
                norm_name = p.name.lower().strip()
                if norm_name not in seen_names:
                    seen_names.add(norm_name)
                    all_candidates.append(p)

        # Если найдено мало, расширяем поиск
        if len(all_candidates) < 4:
            fallback_found = await fetch_yandex_places(
                lat=search_lat,
                lon=search_lon,
                query="бульвар сквер кафе",
                radius_meters=radius * 1.5,
                limit=10
            )
            for p in fallback_found:
                norm_name = p.name.lower().strip()
                if norm_name not in seen_names:
                    seen_names.add(norm_name)
                    all_candidates.append(p)

        # Определение целевого числа остановок
        target_stops_count = request.stop_count if request.stop_count and request.stop_count > 0 else (
            1 if request.duration_minutes <= 25 else
            2 if request.duration_minutes <= 45 else
            3 if request.duration_minutes <= 85 else
            4 if request.duration_minutes <= 130 else 5
        )

        # 3. Отбор остановок
        selected_stops: List[RouteStop] = []

        # Добавляем обязательные пользовательские точки (waypoints)
        if request.waypoints:
            for wp in request.waypoints:
                selected_stops.append(
                    RouteStop(
                        id=wp.id,
                        name=wp.name,
                        category=wp.category or "Выбранное место",
                        lat=wp.lat,
                        lon=wp.lon,
                        spent_minutes=15,
                        description=f"Выбранная вами точка по пути: {wp.name}",
                        order=len(selected_stops) + 1,
                        address=wp.address,
                        photo_url=wp.photo_url,
                        photos=[wp.photo_url] if wp.photo_url else [],
                        is_custom_waypoint=True
                    )
                )

        # Добираем из реальных кандидатов Яндекс Карт
        for cand in all_candidates:
            if len(selected_stops) >= target_stops_count:
                break
            if any(s.name.lower() == cand.name.lower() for s in selected_stops):
                continue

            revs = [
                PlaceReview(
                    author=r.author,
                    avatar=r.avatar,
                    rating=r.rating,
                    text=r.text,
                    date=r.date
                )
                for r in cand.reviews
            ]

            selected_stops.append(
                RouteStop(
                    id=cand.id,
                    name=cand.name,
                    category=cand.category,
                    lat=cand.lat,
                    lon=cand.lon,
                    spent_minutes=cand.spent_minutes,
                    description=cand.description,
                    order=len(selected_stops) + 1,
                    address=cand.address,
                    rating=cand.rating,
                    reviews_count=cand.reviews_count,
                    photo_url=cand.photo_url,
                    photos=cand.photos,
                    yandex_url=cand.yandex_url,
                    opening_hours=cand.opening_hours,
                    tags=cand.tags,
                    reviews=revs
                )
            )

        if not selected_stops:
            raise HTTPException(
                status_code=404,
                detail="В указанном районе не найдено подходящих заведений в Яндекс Картах."
            )

        # 4. Построение пешеходного маршрута
        is_circ = request.is_circular and not has_end
        geojson, total_distance, walking_minutes = await build_walking_route(
            start_lat=request.start_lat,
            start_lon=request.start_lon,
            stops=selected_stops,
            is_circular=is_circ,
            end_lat=request.end_lat if has_end else None,
            end_lon=request.end_lon if has_end else None
        )

        total_spent = sum(s.spent_minutes for s in selected_stops)
        total_route_minutes = walking_minutes + total_spent

        # Расчет хронометража
        now = datetime.now()
        if request.start_time:
            try:
                sh, sm = map(int, request.start_time.split(":"))
                now = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
            except Exception:
                pass
        elif request.target_arrival_time:
            try:
                ah, am = map(int, request.target_arrival_time.split(":"))
                target_dt = now.replace(hour=ah, minute=am, second=0, microsecond=0)
                now = target_dt - timedelta(minutes=total_route_minutes)
            except Exception:
                pass

        current_dt = now
        time_per_segment = max(2, round(walking_minutes / max(1, len(selected_stops) + (0 if is_circ else 1))))
        for s in selected_stops:
            current_dt += timedelta(minutes=time_per_segment)
            s.arrival_time = current_dt.strftime("%H:%M")
            current_dt += timedelta(minutes=s.spent_minutes)
            s.departure_time = current_dt.strftime("%H:%M")

        arrival_str = (now + timedelta(minutes=total_route_minutes)).strftime("%H:%M")
        start_str = now.strftime("%H:%M")

        sc_title = SCENARIO_TITLES.get(request.scenario, "Пешеходная прогулка")
        if request.custom_prompt and len(request.custom_prompt.strip()) > 3:
            sc_title = f"Прогулка: {request.custom_prompt.strip().capitalize()}"

        ai_thought = (
            f"Маршрут построен исключительно по проверенным местам Яндекс Карт: "
            f"{len(selected_stops)} остановок с реальными фотографиями, отзывами и рейтингами. "
            f"Шаг по тротуарам занимает {walking_minutes} мин. ({(total_distance / 1000.0):.1f} км), "
            f"отдых в заведениях — {total_spent} мин."
        )

        end_point_dict = None
        if has_end:
            end_point_dict = {
                "lat": request.end_lat,
                "lon": request.end_lon,
                "name": request.end_name or "Точка финиша",
                "address": request.end_address
            }

        return RouteResponse(
            total_walking_minutes=walking_minutes,
            total_distance_meters=total_distance,
            total_route_minutes=total_route_minutes,
            stops=selected_stops,
            geojson=geojson,
            scenario=request.scenario,
            scenario_title=sc_title,
            used_ai=True,
            ai_model="Yandex Maps Live Data Engine",
            ai_thought=ai_thought,
            is_circular=is_circ,
            start_time=start_str,
            arrival_time=arrival_str,
            end_point=end_point_dict,
            notes=f"Маршрут объединяет {len(selected_stops)} проверенных остановок. Прибытие: ~{arrival_str}."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Непредвиденная ошибка генерации маршрута: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка генерации маршрута: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
