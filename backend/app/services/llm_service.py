import json
import math
import logging
import httpx
from typing import List, Dict, Any, Optional, Tuple
from app.schemas import POIPoint, RouteStop
from app.config import settings

logger = logging.getLogger(__name__)

SCENARIO_CONFIGS = {
    "date": {
        "title": "Романтическое свидание",
        "description": "Маршрут для двоих: атмосферные локации, уютная кофейня и красивые виды для неспешного общения.",
        "preferred_categories": ["Кофейня", "Пекарня / Десерты", "Парк / Сквер", "Смотровая площадка", "Достопримечательность"],
        "default_descriptions": [
            "Идеальное место для начала прогулки, чашки согревающего напитка и душевного разговора.",
            "Живописная локация для красивых совместных фотографий и неспешного созерцания.",
            "Уютный уголок, чтобы отдохнуть, насладиться десертом и обсудить впечатления от дня."
        ]
    },
    "tourist": {
        "title": "Городская экскурсия",
        "description": "Погружение в атмосферу города: архитектура, исторические памятники и знаковые виды.",
        "preferred_categories": ["Достопримечательность", "Историческое место", "Смотровая площадка", "Парк / Сквер", "Кофейня"],
        "default_descriptions": [
            "Знаковая точка маршрута с богатой историей и запоминающейся архитектурой.",
            "Красивая городская панорама, позволяющая оценить масштаб и очарование города.",
            "Отличная остановка, чтобы перезагрузиться и попробовать местный кофе."
        ]
    },
    "coffee_walk": {
        "title": "Кофе и мысли",
        "description": "Спокойный маршрут для перезагрузки, прогулки в тишине или дружеской беседы со стаканчиком кофе.",
        "preferred_categories": ["Кофейня", "Пекарня / Десерты", "Парк / Сквер"],
        "default_descriptions": [
            "Первая остановка за любимым кофе и свежей выпечкой на вынос.",
            "Тихая аллея или сквер, где приятно гулять без спешки и наедине со своими мыслями.",
            "Укромное место с отличным видом для завершения прогулки."
        ]
    },
    "dog_walk": {
        "title": "Прогулка с собакой",
        "description": "Зеленый маршрут вдали от оживленных трасс: просторные парки и площадки для четвероногого друга.",
        "preferred_categories": ["Парк / Сквер", "Смотровая площадка", "Кофейня"],
        "default_descriptions": [
            "Зеленый сквер с мягкими дорожками и простором для активной прогулки питомца.",
            "Открытая площадка с хорошим обзором и удобными лавочками для отдыха.",
            "Кафе с dog-friendly атмосферой, где можно взять напиток навынос."
        ]
    }
}

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Расстояние между двумя точками в метрах."""
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
    """
    Эвристический детерминированный алгоритм на случай отсутствия или сбоя LLM.
    Отбирает 2-4 точки разной категории, оптимизируя тайминг и расстояние.
    """
    sc_info = SCENARIO_CONFIGS.get(scenario, SCENARIO_CONFIGS["date"])
    pref_cats = sc_info["preferred_categories"]

    # Рассчитаем расстояние от старта для каждой POI
    sorted_pois = sorted(
        pois,
        key=lambda p: calculate_haversine_distance(start_lat, start_lon, p.lat, p.lon)
    )

    selected_pois: List[POIPoint] = []
    used_categories = set()

    # 1. Сначала отбираем по приоритетным категориям
    for p in sorted_pois:
        if p.category in pref_cats and p.category not in used_categories:
            selected_pois.append(p)
            used_categories.add(p.category)
            if len(selected_pois) >= 3:
                break

    # 2. Если не набрали 3, берем оставшиеся любые
    if len(selected_pois) < 3:
        for p in sorted_pois:
            if p not in selected_pois:
                selected_pois.append(p)
                if len(selected_pois) >= 3:
                    break

    # Ограничиваемся максимум 4 точками
    selected_pois = selected_pois[:4]

    # Сортируем точки для плавного кольцевого маршрута по азимуту/расстоянию
    selected_pois.sort(
        key=lambda p: math.atan2(p.lon - start_lon, p.lat - start_lat)
    )

    # Распределение времени на остановках
    # Примерно половина времени - ходьба, половина - остановки
    total_spent_budget = max(20, int(duration_minutes * 0.45))
    spent_per_stop = max(10, total_spent_budget // max(1, len(selected_pois)))

    stops: List[RouteStop] = []
    descriptions = sc_info["default_descriptions"]

    for idx, p in enumerate(selected_pois):
        desc = descriptions[idx % len(descriptions)]
        # Специализация для кафе
        spent = spent_per_stop
        if "Кофейня" in p.category or "Пекарня" in p.category or "Ресторан" in p.category:
            spent = max(20, spent + 5)
            desc = f"{p.name} — приятное место, где можно согреться напитком и отдохнуть в приятной обстановке."
        elif "Парк" in p.category:
            spent = max(15, spent)
            desc = f"{p.name} — живописная зеленая зона для неспешной прогулки на свежем воздухе."
        elif "Смотровая" in p.category or "Достопримечательность" in p.category:
            spent = max(10, spent - 5)
            desc = f"{p.name} — интересная точка маршрута с запоминающейся атмосферой и видами."

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
    """
    Планирует маршрут с помощью LLM (Gemini или OpenAI) или интеллектуального fallback.
    Возвращает: (список_остановок, used_ai: bool, model_name: str)
    """
    active_key = user_api_key or settings.GEMINI_API_KEY
    openai_key = user_api_key if (user_api_key and user_api_key.startswith("sk-")) else settings.OPENAI_API_KEY

    # Подготовка компактного списка POI для промпта
    simplified_pois = [
        {"id": p.id, "name": p.name, "category": p.category, "lat": p.lat, "lon": p.lon}
        for p in pois[:35]
    ]

    sc_info = SCENARIO_CONFIGS.get(scenario, SCENARIO_CONFIGS["date"])

    prompt = f"""
Ты — персональный гид и планировщик прогулок «StepByStep AI».
Твоя цель: составить гармоничный пеший маршрут под сценарий: "{sc_info['title']}" ({sc_info['description']}).
Общий бюджет времени всей прогулки: {duration_minutes} минут (включает и ходьбу между точками, и время нахождения в них).

Входные данные:
Начальные координаты пользователя: lat={start_lat}, lon={start_lon}.
Доступные РЕАЛЬНЫЕ места из OpenStreetMap:
{json.dumps(simplified_pois, ensure_ascii=False, indent=2)}

СТРОГИЕ ПРАВИЛА:
1. Выбери от 2 до 4 САМЫХ подходящих точек ИСКЛЮЧИТЕЛЬНО из переданного списка. НЕ ВЫДУМЫВАЙ новые координаты или названия!
2. Для каждой выбранной точки укажи:
   - "id": строковый id из переданного списка;
   - "spent_minutes": число минут нахождения в точке (обычно 10-35 минут);
   - "description": 1-2 вдохновляющих предложения на русском языке, почему именно это место выбрано и что там сделать в рамках сценария "{sc_info['title']}".
3. Упорядочи точки в логичной последовательности обхода от старта.
4. Ответь ИСКЛЮЧИТЕЛЬНО валидным JSON-объектом следующего формата:
{{
  "selected_stops": [
    {{
      "id": "node_12345",
      "spent_minutes": 25,
      "description": "Пояснение..."
    }}
  ]
}}
"""

    # 1. Попытка вызвать Google Gemini (если есть ключ)
    if active_key and not active_key.startswith("sk-"):
        for model_name in ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"]:
            try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={active_key}"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "response_mime_type": "application/json",
                            "temperature": 0.4
                        }
                    }
                    resp = await client.post(gemini_url, json=payload)
                    if resp.status_code == 200:
                        res_json = resp.json()
                        text_part = res_json["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = json.loads(text_part)
                        stops = _validate_and_build_stops(parsed, pois)
                        if stops:
                            return stops, True, f"Google Gemini ({model_name})"
                    else:
                        logger.warning(f"Gemini {model_name} ответил ошибкой {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"Ошибка вызова Gemini {model_name}: {e}")

    # 2. Попытка вызвать OpenAI (если настроен OpenAI ключ)
    if openai_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openai_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": "You are a specialized geospatial route planner outputting strict JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.4
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    stops = _validate_and_build_stops(parsed, pois)
                    if stops:
                        return stops, True, "OpenAI GPT-4o-mini"
        except Exception as e:
            logger.warning(f"Ошибка вызова OpenAI: {e}")

    # 3. Fallback: умный эвристический алгоритм
    logger.info("Используется эвристический планировщик fallback")
    fallback_stops = fallback_select_stops(pois, start_lat, start_lon, duration_minutes, scenario)
    return fallback_stops, False, "Heuristic Geospatial Engine (Fallback)"

def _validate_and_build_stops(parsed_json: Dict[str, Any], pois: List[POIPoint]) -> List[RouteStop]:
    """Проверяет и сопоставляет ответ LLM со списком реальных POI."""
    poi_by_id = {p.id: p for p in pois}
    stops_data = parsed_json.get("selected_stops", [])
    
    stops: List[RouteStop] = []
    order = 1
    for item in stops_data:
        poi_id = item.get("id")
        poi = poi_by_id.get(poi_id)
        if not poi:
            # Попробуем найти по совпадению имени если id не совпал
            target_name = item.get("name", "").strip().lower()
            for cand in pois:
                if cand.name.lower() == target_name:
                    poi = cand
                    break

        if poi:
            spent = max(5, min(int(item.get("spent_minutes", 20)), 90))
            desc = item.get("description", f"Остановка в {poi.name} ({poi.category}).")
            stops.append(
                RouteStop(
                    name=poi.name,
                    category=poi.category,
                    lat=poi.lat,
                    lon=poi.lon,
                    spent_minutes=spent,
                    description=desc,
                    order=order
                )
            )
            order += 1

    return stops
