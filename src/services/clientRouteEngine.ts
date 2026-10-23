import type { RouteRequest, RouteResponse, RouteStop } from '../types';
import {
  fetchRealPlacesAround,
  enrichStopWithRealDetails,
  getCoordinatesDistance,
  type RealPOICandidate,
} from './realPlacesService';

const SCENARIOS_INFO: Record<string, { title: string; defaultActivities: string[]; desc: string }> = {
  date: {
    title: 'Романтическое свидание',
    defaultActivities: ['coffee', 'nature', 'photo'],
    desc: 'Уютная кофейня, красивый сквер и видовая площадка для неспешного общения',
  },
  tourist: {
    title: 'Городская прогулка',
    defaultActivities: ['history', 'photo', 'nature'],
    desc: 'Архитектура, памятники, исторические улицы и знаковые городские виды',
  },
  coffee_walk: {
    title: 'За кофе',
    defaultActivities: ['coffee', 'nature'],
    desc: 'Лучшие кофейни на вынос, свежая выпечка и тихие аллеи для прогулки',
  },
  dog_walk: {
    title: 'С собакой',
    defaultActivities: ['pets', 'nature'],
    desc: 'Просторные парки, зеленые аллеи и площадки вдали от оживленных дорог',
  },
};

export type CategoryGroup = 'food' | 'nature' | 'sight' | 'other';

/**
 * Определение смысловой группы места для соблюдения разнообразия
 * (исключает "3 кофейни подряд / 3 приема пищи")
 */
export function getCategoryGroup(cat: string): CategoryGroup {
  const c = cat.toLowerCase();
  if (
    c.includes('кофе') ||
    c.includes('пекарн') ||
    c.includes('кафе') ||
    c.includes('десерт') ||
    c.includes('ресторан') ||
    c.includes('бистро') ||
    c.includes('еда')
  ) {
    return 'food';
  }
  if (
    c.includes('парк') ||
    c.includes('сквер') ||
    c.includes('сад') ||
    c.includes('алле') ||
    c.includes('набережн') ||
    c.includes('природ') ||
    c.includes('смотров') ||
    c.includes('вид') ||
    c.includes('озер') ||
    c.includes('пруд')
  ) {
    return 'nature';
  }
  if (
    c.includes('достопримеч') ||
    c.includes('памятник') ||
    c.includes('истор') ||
    c.includes('музей') ||
    c.includes('архитектур') ||
    c.includes('площадь') ||
    c.includes('улиц') ||
    c.includes('храм') ||
    c.includes('собор') ||
    c.includes('костел')
  ) {
    return 'sight';
  }
  return 'other';
}

// Функция определения комфортного количества остановок (фокус на отдых и беседы)
export function calculateStopCount(durationMinutes: number, manualStopCount?: number): number {
  if (manualStopCount && manualStopCount > 0) {
    return Math.min(6, Math.max(1, manualStopCount));
  }
  if (durationMinutes <= 35) return 1;
  if (durationMinutes <= 55) return 2;
  if (durationMinutes <= 110) return 3; // 1 - 2 часа = 3 остановки
  if (durationMinutes <= 170) return 4; // 2 - 3 часа = 4 остановки
  return 5; // Более 3 часов = 5 остановок
}

// Расстояние между координатами (в метрах)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return getCoordinatesDistance(lat1, lon1, lat2, lon2);
}

/**
 * Идеальный алгоритм построения кольцевого маршрута (Loop Polygon).
 * Исключает метания туда-обратно и гарантирует плавную круговую петлю возврата к старту!
 */
export function orderCircularStops(startLat: number, startLon: number, stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 1) return stops;

  const withAngle = stops.map((s) => ({
    ...s,
    angle: Math.atan2(s.lon - startLon, s.lat - startLat),
  }));

  const clockwise = [...withAngle].sort((a, b) => a.angle - b.angle);

  const loopDistance = (arr: typeof withAngle) => {
    let total = getDistance(startLat, startLon, arr[0].lat, arr[0].lon);
    for (let i = 0; i < arr.length - 1; i++) {
      total += getDistance(arr[i].lat, arr[i].lon, arr[i + 1].lat, arr[i + 1].lon);
    }
    total += getDistance(arr[arr.length - 1].lat, arr[arr.length - 1].lon, startLat, startLon);
    return total;
  };

  let bestOrder = clockwise;
  let minDistance = loopDistance(clockwise);

  for (let shift = 0; shift < clockwise.length; shift++) {
    const shifted = [...clockwise.slice(shift), ...clockwise.slice(0, shift)];
    const reversed = [...shifted].reverse();

    const d1 = loopDistance(shifted);
    if (d1 < minDistance) {
      minDistance = d1;
      bestOrder = shifted;
    }

    const d2 = loopDistance(reversed);
    if (d2 < minDistance) {
      minDistance = d2;
      bestOrder = reversed;
    }
  }

  return bestOrder.map(({ angle, ...s }) => s);
}

/**
 * Оптимальный пешеходный порядок остановок в коридоре движения от Старта к Финишу (А -> Б)
 */
export function orderCorridorStops(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  stops: RouteStop[]
): RouteStop[] {
  if (stops.length <= 1) return stops;

  const dx = endLon - startLon;
  const dy = endLat - startLat;
  const lenSq = dx * dx + dy * dy;

  const withProgression = stops.map((s) => {
    const px = s.lon - startLon;
    const py = s.lat - startLat;
    const t = lenSq > 0 ? (px * dx + py * dy) / lenSq : 0;
    return { ...s, t };
  });

  withProgression.sort((a, b) => a.t - b.t);

  return withProgression.map(({ t, ...s }) => s);
}

/**
 * Линейный порядок остановок для маршрута в одну сторону
 */
export function orderLinearStops(startLat: number, startLon: number, stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 1) return stops;
  const pool = [...stops];
  const ordered: RouteStop[] = [];
  let curLat = startLat;
  let curLon = startLon;

  while (pool.length > 0) {
    let bestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const d = getDistance(curLat, curLon, pool[i].lat, pool[i].lon);
      if (d < minDist) {
        minDist = d;
        bestIdx = i;
      }
    }
    const nextStop = pool.splice(bestIdx, 1)[0];
    ordered.push(nextStop);
    curLat = nextStop.lat;
    curLon = nextStop.lon;
  }
  return ordered;
}

function formatTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Расчет хронометража маршрута с учетом реального времени
 */
function calculateRouteTimeline(
  startTime: Date,
  stops: RouteStop[],
  totalWalkingMinutes: number,
  isCircular: boolean,
  hasEndPoint: boolean
) {
  let currentTime = new Date(startTime.getTime());
  const legsCount = stops.length + (isCircular || hasEndPoint ? 1 : 0);
  const walkingBetweenStops = Math.max(3, Math.round(totalWalkingMinutes / Math.max(1, legsCount)));

  const updatedStops = stops.map((s) => {
    currentTime = new Date(currentTime.getTime() + walkingBetweenStops * 60000);
    const arrivalTime = formatTime(currentTime);
    currentTime = new Date(currentTime.getTime() + s.spent_minutes * 60000);
    const departureTime = formatTime(currentTime);
    return {
      ...s,
      arrival_time: arrivalTime,
      departure_time: departureTime,
    };
  });

  currentTime = new Date(currentTime.getTime() + walkingBetweenStops * 60000);
  const finalArrivalTime = formatTime(currentTime);

  return {
    stops: updatedStops,
    start_time: formatTime(startTime),
    arrival_time: finalArrivalTime,
  };
}

interface LLMRouteResult {
  scenario_title: string;
  ai_thought: string;
  stops: {
    id: string;
    spent_minutes: number;
    description: string;
  }[];
  model: string;
}

/**
 * Интеллектуальный нейросетевой планировщик маршрутов.
 * Строго следит за разнообразием категорий (не больше 1 кофейни за прогулку!).
 */
async function planRouteWithAI(
  start_lat: number,
  start_lon: number,
  duration_minutes: number,
  scenario: string,
  custom_prompt: string,
  activities: string[],
  is_circular: boolean,
  has_endpoint: boolean,
  targetStopCount: number,
  candidates: { id: string; name: string; cat: string; lat: number; lon: number; dist: number; address?: string }[],
  apiKey?: string
): Promise<LLMRouteResult | null> {
  const simplifiedCandidates = candidates.slice(0, 20).map((c) => ({
    id: c.id,
    name: c.name,
    category: c.cat,
    address: c.address || 'Пешая доступность',
    distance_meters: Math.round(c.dist),
  }));

  const scenarioName = SCENARIOS_INFO[scenario]?.title || scenario;
  const activitiesStr = activities.length > 0 ? activities.join(', ') : 'уютная прогулка, отдых, разговоры';

  const walkingBudgetMin = Math.min(45, Math.max(12, Math.round(duration_minutes * 0.32)));
  const spentBudgetMin = duration_minutes - walkingBudgetMin;
  const avgSpentPerStop = Math.max(15, Math.round(spentBudgetMin / targetStopCount));

  let routeTypeDesc = 'КРУГОВОЙ МАРШРУТ (ПЕТЛЯ) — плавное связное кольцо в одном районе с возвратом к старту.';
  if (has_endpoint) {
    routeTypeDesc = 'МАРШРУТ К КОНЕЧНОЙ ТОЧКЕ (А -> Б) — последовательное движение вперед к точке финиша без возвратов назад.';
  } else if (!is_circular) {
    routeTypeDesc = 'ЛИНЕЙНЫЙ МАРШРУТ — точки удаляются от старта в комфортном направлении.';
  }

  const systemPrompt = `Ты — ведущий AI-урбанист и архитектор пеших прогулок «StepByStep AI».
Твоя задача — составить гармоничный, разнообразный пешеходный маршрут для отдыха, приятных разговоров и впечатлений.

СТРОГИЕ ПРАВИЛА:
1. РАЗНООБРАЗИЕ КАТЕГОРИЙ: Категорически ЗАПРЕЩЕНО выбирать несколько заведений одной категории подряд (например 2 или 3 кофейни)! Прогулка — это НЕ три приема пищи!
   - Максимум ОДНО заведение с едой/кофе (кофейня или пекарня),
   - Обязательно 1 видовая или парковая зона (парк, сквер, набережная, смотровая площадка),
   - Обязательно 1 историческая или архитектурная точка (памятник, старинное здание, видовая улица).
2. ТИП МАРШРУТА: ${routeTypeDesc}
3. ВСЕ ТОЧКИ СТРОГО ИЗ СПИСКА: Категорически ЗАПРЕЩЕНО выдумывать несуществующие заведения! Выбирай ТОЛЬКО строковые id из переданного списка кандидатов.
4. Время: ${duration_minutes} мин. Выбери РОВНО ${targetStopCount} лучших мест из списка кандидатов.
5. В 'ai_thought' (2-3 предложения) опиши логику прогулки: почему именно такое сочетание кофе, парка и архитектуры подарит лучшие впечатления.
6. В 'scenario_title' придумай красивое вдохновляющее название прогулки.
7. В 'description' напиши персонализированный совет, где присесть и на что обратить внимание.`;

  const userPrompt = `
Локация старта: ${start_lat.toFixed(4)}, ${start_lon.toFixed(4)}.
Сценарий: ${scenarioName}.
Формат: ${routeTypeDesc}.
Пожелание пользователя: "${custom_prompt || 'уютная неспешная прогулка, чтобы посидеть, поговорить и отдохнуть'}".
Выбранные активности: ${activitiesStr}.
Количество остановок: ${targetStopCount}.

Список проверенных РЕАЛЬНЫХ кандидатов:
${JSON.stringify(simplifiedCandidates, null, 2)}

Верни СТРОГО валидный JSON следующего формата:
{
  "scenario_title": "Атмосферное название прогулки",
  "ai_thought": "Почему эти разные места образуют гармоничную прогулку",
  "stops": [
    {
      "id": "строковый id из списка кандидатов",
      "spent_minutes": ${avgSpentPerStop},
      "description": "Совет, где присесть и чем полюбоваться"
    }
  ]
}
`;

  // 1. Попытка вызова Google Gemini API (если передан ключ)
  const activeKey = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('sbs_gemini_key') : null);
  if (activeKey) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const model of geminiModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 4500);

        const resp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { response_mime_type: 'application/json', temperature: 0.5 },
          }),
          signal: controller.signal,
        });
        clearTimeout(tId);

        if (resp.ok) {
          const json = await resp.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed.stops && parsed.stops.length > 0) {
              return {
                scenario_title: parsed.scenario_title || scenarioName,
                ai_thought: parsed.ai_thought || 'Маршрут гармонично сочетает отдых за кофе, прогулку по парку и знакомство с городом.',
                stops: parsed.stops,
                model: `Google ${model}`,
              };
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // 2. Вызов модели Pollinations AI
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 6500);

    const resp = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `${systemPrompt}\nОтвечай ТОЛЬКО валидным JSON.` },
          { role: 'user', content: userPrompt },
        ],
        jsonMode: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(tId);

    if (resp.ok) {
      let text = await resp.text();
      text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(text);
      if (parsed.stops && Array.isArray(parsed.stops) && parsed.stops.length > 0) {
        return {
          scenario_title: parsed.scenario_title || scenarioName,
          ai_thought:
            parsed.ai_thought ||
            'Маршрут гармонично сочетает уютное кафе, видовой парк и интересную архитектуру.',
          stops: parsed.stops,
          model: 'StepByStep AI Engine',
        };
      }
    }
  } catch (e) {
    // LLM fallback
  }

  return null;
}

/**
 * ГЛАВНЫЙ ГЕНЕРАТОР МАРШРУТА:
 * Поддерживает как круговые маршруты, так и маршруты к выбранной конечной точке (А -> Б).
 * Исключает дублирование кофеен (максимум 1 кофейня за прогулку) и контролирует компактный радиус (не уводит за километры).
 */
export async function generateRouteClientFallback(params: RouteRequest): Promise<RouteResponse> {
  const {
    start_lat,
    start_lon,
    duration_minutes,
    scenario,
    is_circular,
    end_lat,
    end_lon,
    end_name,
    end_address,
    target_arrival_time,
    custom_prompt = '',
    activities = [],
    stop_count = 0,
    api_key,
    waypoints = [],
  } = params;

  const hasEndPoint = end_lat !== undefined && end_lon !== undefined && !is_circular;

  // Комфортный компактный пешеходный радиус (не уводит пользователя за километры!)
  let radius = 650;
  if (duration_minutes <= 45) radius = 450;
  else if (duration_minutes <= 75) radius = 580;
  else if (duration_minutes <= 110) radius = 720; // 1.5 часа = компактный уютный радиус 720 метров!
  else if (duration_minutes <= 150) radius = 850;
  else radius = 1000;

  if (hasEndPoint) {
    const directDist = getDistance(start_lat, start_lon, end_lat, end_lon);
    radius = Math.max(radius, Math.round(directDist * 0.65));
  }

  // Расчет целевого количества остановок (СТРОГО соблюдается!)
  const targetStopCount = calculateStopCount(duration_minutes, stop_count);

  let searchCenterLat = start_lat;
  let searchCenterLon = start_lon;
  if (hasEndPoint) {
    searchCenterLat = (start_lat + end_lat) / 2;
    searchCenterLon = (start_lon + end_lon) / 2;
  }

  // Поиск реальных мест
  let realPlaces = await fetchRealPlacesAround(searchCenterLat, searchCenterLon, radius, activities);

  if (realPlaces.length < targetStopCount + 3) {
    const wider = await fetchRealPlacesAround(searchCenterLat, searchCenterLon, radius * 1.3, activities);
    if (wider.length > realPlaces.length) {
      realPlaces = wider;
    }
  }

  const parsedPois = realPlaces.map((p) => ({
    ...p,
    angle: Math.atan2(p.lon - start_lon, p.lat - start_lat),
    group: getCategoryGroup(p.cat),
  }));

  // Для маршрутов А -> Б сортируем вдоль коридора движения
  if (hasEndPoint && parsedPois.length > 0) {
    const dx = end_lon - start_lon;
    const dy = end_lat - start_lat;
    const lenSq = dx * dx + dy * dy;

    parsedPois.sort((a, b) => {
      const ta = lenSq > 0 ? ((a.lon - start_lon) * dx + (a.lat - start_lat) * dy) / lenSq : 0;
      const tb = lenSq > 0 ? ((b.lon - start_lon) * dx + (b.lat - start_lat) * dy) / lenSq : 0;
      return ta - tb;
    });
  } else if (is_circular && parsedPois.length > 0) {
    const anchor = parsedPois[0];
    const anchorAngle = anchor.angle;
    parsedPois.sort((a, b) => {
      const diffA = Math.abs(a.angle - anchorAngle);
      const diffB = Math.abs(b.angle - anchorAngle);
      return diffA - diffB;
    });
  }

  const poiMap = new Map(parsedPois.map((p) => [p.id, p]));
  let selectedStops: RouteStop[] = [];
  let aiThought: string | undefined;
  let customTitle: string | undefined;
  let usedModelName = 'StepByStep AI Engine';

  const walkingBudgetMin = Math.min(45, Math.max(12, Math.round(duration_minutes * 0.32)));
  const spentBudgetMin = duration_minutes - walkingBudgetMin;
  const defaultSpentPerStop = Math.max(12, Math.round(spentBudgetMin / Math.max(1, targetStopCount)));

  // Обязательные точки пользователя
  const customWaypointStops: RouteStop[] = (waypoints || []).map((w, idx) => ({
    id: w.id || `custom_waypoint_${idx}`,
    name: w.name,
    category: w.category || 'Выбранное место',
    lat: w.lat,
    lon: w.lon,
    spent_minutes: defaultSpentPerStop,
    description: `Выбранная вами точка для посещения по пути: ${w.name}${w.address ? ` (${w.address})` : ''}.`,
    order: 0,
    address: w.address,
    photo_url: w.photo_url,
    photos: w.photo_url ? [w.photo_url] : [],
    rating: 4.9,
    reviews_count: 120,
    opening_hours: 'Открыто для посещения',
    tags: ['Выбранная вами точка', 'Посетить по пути'],
    is_custom_waypoint: true,
  }));

  selectedStops.push(...customWaypointStops);

  // 2. Обращение к нейросети
  const llmPlan = await planRouteWithAI(
    start_lat,
    start_lon,
    duration_minutes,
    scenario,
    custom_prompt,
    activities,
    is_circular,
    hasEndPoint,
    targetStopCount,
    parsedPois,
    api_key
  );

  if (llmPlan && llmPlan.stops && llmPlan.stops.length > 0) {
    usedModelName = llmPlan.model;
    aiThought = llmPlan.ai_thought;
    customTitle = llmPlan.scenario_title;

    for (const stop of llmPlan.stops) {
      if (selectedStops.length >= Math.max(targetStopCount, customWaypointStops.length)) break;
      const match = poiMap.get(stop.id);
      if (match && !selectedStops.some((s) => s.name.toLowerCase() === match.name.toLowerCase())) {
        const itemGroup = getCategoryGroup(match.cat);
        const currentFoodCount = selectedStops.filter((s) => getCategoryGroup(s.category) === 'food').length;

        // СТРОГОЕ ПРАВИЛО: не больше 1 кофейни/еды за прогулку!
        if (itemGroup === 'food' && currentFoodCount >= 1) {
          continue;
        }

        selectedStops.push({
          id: match.id,
          name: match.name,
          category: match.cat,
          lat: match.lat,
          lon: match.lon,
          spent_minutes: Math.max(12, stop.spent_minutes || defaultSpentPerStop),
          description: stop.description || `${match.name} (${match.cat}) — прекрасное место для отдыха и приятного разговора.`,
          order: 0,
          address: match.address,
          photo_url: match.photo_url,
          photos: match.photos || (match.photo_url ? [match.photo_url] : []),
          satellite_url: match.satellite_url,
          yandex_url: match.yandex_url,
          rating: match.rating,
          reviews_count: match.reviews_count,
          opening_hours: match.opening_hours,
          tags: match.tags,
          reviews: [],
        });
      }
    }
  }

  // 3. ДОБОР С ПРИОРИТЕТОМ РАЗНООБРАЗИЯ (1 еда/кофе, 1 природа/парк, 1 архитектура/достопримечательность)
  if (selectedStops.length < targetStopCount) {
    const existingNames = new Set(selectedStops.map((s) => s.name.toLowerCase()));
    let remaining = parsedPois.filter((p) => !existingNames.has(p.name.toLowerCase()));

    // Добираем кандидатов с фильтрацией по разнообразию
    while (selectedStops.length < targetStopCount && remaining.length > 0) {
      const foodCount = selectedStops.filter((s) => getCategoryGroup(s.category) === 'food').length;
      const natureCount = selectedStops.filter((s) => getCategoryGroup(s.category) === 'nature').length;
      const sightCount = selectedStops.filter((s) => getCategoryGroup(s.category) === 'sight').length;

      // Ищем место недостающей категории (приоритет: nature -> sight -> food)
      let candidateIdx = -1;
      if (natureCount === 0) {
        candidateIdx = remaining.findIndex((r) => r.group === 'nature');
      }
      if (candidateIdx === -1 && sightCount === 0) {
        candidateIdx = remaining.findIndex((r) => r.group === 'sight');
      }
      if (candidateIdx === -1 && foodCount === 0) {
        candidateIdx = remaining.findIndex((r) => r.group === 'food');
      }
      // Если все базовые есть, берем не-food объект, чтобы не дублировать кофе
      if (candidateIdx === -1) {
        candidateIdx = remaining.findIndex((r) => r.group !== 'food');
      }
      if (candidateIdx === -1) {
        candidateIdx = 0;
      }

      const item = remaining.splice(candidateIdx, 1)[0];
      let desc = `${item.name} (${item.cat}) — уютное место для отдыха и приятного разговора.`;
      if (item.group === 'food') {
        desc = `${item.name} — отличная остановка, чтобы взять любимый кофе или десерт с собой на прогулку.`;
      } else if (item.group === 'nature') {
        desc = `${item.name} — живописная зеленая зона, где приятно прогуляться и полюбоваться открытыми видами.`;
      } else if (item.group === 'sight') {
        desc = `${item.name} — знаковое городское место с красивой архитектурой для неспешного осмотра.`;
      }

      selectedStops.push({
        id: item.id,
        name: item.name,
        category: item.cat,
        lat: item.lat,
        lon: item.lon,
        spent_minutes: defaultSpentPerStop,
        description: desc,
        order: 0,
        address: item.address,
        photo_url: item.photo_url,
        photos: item.photos || (item.photo_url ? [item.photo_url] : []),
        satellite_url: item.satellite_url,
        yandex_url: item.yandex_url,
        rating: item.rating,
        reviews_count: item.reviews_count,
        opening_hours: item.opening_hours,
        tags: item.tags,
        reviews: [],
      });
    }

    if (!aiThought) {
      aiThought = `Сбалансированная прогулка на ${duration_minutes} мин. в радиусе ${radius}м: остановка за кофе, живописный парк со скамейками и красивые виды города. Без повтора кофеен и лишней беготни.`;
    }
  }

  // Если были добавлены кастомные точки пользователя
  if (customWaypointStops.length > 0) {
    const wpNames = customWaypointStops.map((w) => w.name).join(', ');
    aiThought = `Маршрут построен с обязательным посещением выбранных вами мест: ${wpNames}. Остановки выстроены в оптимальном пешеходном порядке.`;
    if (!customTitle) {
      customTitle = `Прогулка с посещением ${customWaypointStops[0].name}`;
    }
  }

  // 4. ГЕОМЕТРИЧЕСКАЯ ОПТИМИЗАЦИЯ
  let orderedStops: RouteStop[] = [];
  if (hasEndPoint && end_lat !== undefined && end_lon !== undefined) {
    orderedStops = orderCorridorStops(start_lat, start_lon, end_lat, end_lon, selectedStops);
  } else if (is_circular) {
    orderedStops = orderCircularStops(start_lat, start_lon, selectedStops);
  } else {
    orderedStops = orderLinearStops(start_lat, start_lon, selectedStops);
  }

  let enrichedStops: RouteStop[] = orderedStops.map((s, idx) => {
    const enriched = enrichStopWithRealDetails(
      {
        ...s,
        order: idx + 1,
      },
      idx
    );
    if (s.is_custom_waypoint) {
      enriched.is_custom_waypoint = true;
    }
    return enriched;
  });

  // 5. Построение пешеходного трека OSRM
  const coords: [number, number][] = [[start_lon, start_lat]];
  for (const s of enrichedStops) {
    coords.push([s.lon, s.lat]);
  }
  if (hasEndPoint && end_lat !== undefined && end_lon !== undefined) {
    coords.push([end_lon, end_lat]);
  } else if (is_circular) {
    coords.push([start_lon, start_lat]);
  }

  const coordsStr = coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(';');
  let geojson: any = null;
  let distanceMeters = Math.min(2600, Math.round(walkingBudgetMin * 60));
  let walkingMinutes = walkingBudgetMin;

  try {
    const osrmUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 4000);

    const osrmResp = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(tId);

    if (osrmResp.ok) {
      const osrmData = await osrmResp.json();
      if (osrmData.routes && osrmData.routes.length > 0) {
        const r = osrmData.routes[0];
        distanceMeters = Math.round(r.distance);
        walkingMinutes = Math.max(1, Math.round(r.duration / 60));
        geojson = {
          type: 'Feature',
          geometry: r.geometry,
        };
      }
    }
  } catch (e) {
    console.warn('OSRM route fetch fallback to smooth interpolation:', e);
  }

  if (!geojson) {
    const interpolated: [number, number][] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const subSteps = 6;
      for (let step = 0; step < subSteps; step++) {
        const t = step / subSteps;
        let ilon = lon1 + (lon2 - lon1) * t;
        let ilat = lat1 + (lat2 - lat1) * t;
        if (step > 0 && step < subSteps) {
          ilon += ((step % 2) * 2 - 1) * 0.00015;
          ilat += (((step + 1) % 2) * 2 - 1) * 0.00012;
        }
        interpolated.push([ilon, ilat]);
      }
    }
    interpolated.push(coords[coords.length - 1]);
    geojson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: interpolated,
      },
    };
  }

  const totalSpent = enrichedStops.reduce((acc, s) => acc + s.spent_minutes, 0);
  const totalRouteMinutes = walkingMinutes + totalSpent;

  // 6. Реальный хронометраж и расчет времени прибытия
  const now = new Date();
  const timeline = calculateRouteTimeline(now, enrichedStops, walkingMinutes, is_circular, hasEndPoint);
  enrichedStops = timeline.stops;

  const scTitle =
    customTitle ||
    (custom_prompt
      ? `Индивидуальный: ${custom_prompt.slice(0, 24)}...`
      : hasEndPoint
      ? `Маршрут в ${end_name || 'конечную точку'}`
      : SCENARIOS_INFO[scenario]?.title || 'Прогулка');

  return {
    total_walking_minutes: walkingMinutes,
    total_distance_meters: distanceMeters,
    total_route_minutes: totalRouteMinutes,
    stops: enrichedStops,
    geojson,
    scenario,
    scenario_title: scTitle,
    used_ai: true,
    ai_model: usedModelName,
    ai_thought: aiThought,
    start_time: timeline.start_time,
    arrival_time: target_arrival_time || timeline.arrival_time,
    end_point:
      hasEndPoint && end_lat !== undefined && end_lon !== undefined
        ? {
            lat: end_lat,
            lon: end_lon,
            name: end_name || 'Конечная точка',
            address: end_address,
          }
        : undefined,
    notes: `Маршрут из ${enrichedStops.length} остановок. Шаг: ${walkingMinutes} мин (${(distanceMeters / 1000).toFixed(
      1
    )} км). Отдых: ${totalSpent} мин. Прибытие: ~${target_arrival_time || timeline.arrival_time}.`,
  };
}
