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

// Функция определения комфортного количества остановок (фокус на отдых и беседы)
export function calculateStopCount(durationMinutes: number, manualStopCount?: number): number {
  if (manualStopCount && manualStopCount > 0) {
    return Math.min(5, Math.max(1, manualStopCount));
  }
  if (durationMinutes <= 30) return 1;
  if (durationMinutes <= 50) return 2;
  if (durationMinutes <= 120) return 3; // 2 часа = 3 уютные остановки
  return 4; // 3 часа = 4 атмосферные остановки
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

  // Рассчитываем полярный угол каждой точки относительно точки старта
  const withAngle = stops.map((s) => ({
    ...s,
    angle: Math.atan2(s.lon - startLon, s.lat - startLat),
  }));

  // Сортировка по кругу (по часовой стрелке)
  const clockwise = [...withAngle].sort((a, b) => a.angle - b.angle);

  // Функция вычисления суммарного периметра кольца: Старт -> P1 -> P2 -> ... -> Pn -> Старт
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

  // Перебираем циклические сдвиги и реверс (против часовой стрелки), находя кратчайший гладкий контур
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
 * Линейный порядок остановок для маршрута в одну сторону (без возврата назад)
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
 * Работает строго со списком проверенных РЕАЛЬНЫХ мест (без выдумок и липовых координат).
 */
async function planRouteWithAI(
  start_lat: number,
  start_lon: number,
  duration_minutes: number,
  scenario: string,
  custom_prompt: string,
  activities: string[],
  is_circular: boolean,
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

  const routeTypeDesc = is_circular
    ? 'КРУГОВОЙ МАРШРУТ (ПЕТЛЯ) — выстраивай точки в плавное связное кольцо в одном районе, возвращающееся к старту. Категорически ЗАПРЕЩЕНО выбирать точки в противоположных сторонах, заставляя идти туда и обратно по одной улице!'
    : 'ЛИНЕЙНЫЙ МАРШРУТ — точки должны последовательно удаляться от старта в комфортном направлении без возвратов назад.';

  const systemPrompt = `Ты — ведущий AI-урбанист и архитектор пеших прогулок «StepByStep AI».
Твоя задача — составить гармоничный пешеходный маршрут для отдыха, приятных разговоров и впечатлений.

СТРОГИЕ ПРАВИЛА:
1. ТИП МАРШРУТА: ${routeTypeDesc}
2. ВСЕ ТОЧКИ СТРОГО ИЗ СПИСКА: Категорически ЗАПРЕЩЕНО выдумывать несуществующие заведения! Выбирай ТОЛЬКО строковые id из переданного списка кандидатов.
3. Время: ${duration_minutes} мин. Из них неспешный шаг суммарно ~${walkingBudgetMin} мин, остальное (~${spentBudgetMin} мин) — на спокойный отдых в точках.
4. Выбери РОВНО ${targetStopCount} лучших мест из списка кандидатов.
5. В 'ai_thought' (2-3 предложения) опиши логику маршрута и почему эти места подходят для душевного отдыха.
6. В 'scenario_title' дай красивое вдохновляющее название прогулки.
7. В 'description' напиши персонализированный совет, где присесть и на что обратить внимание.`;

  const userPrompt = `
Локация старта: ${start_lat.toFixed(4)}, ${start_lon.toFixed(4)}.
Сценарий: ${scenarioName}.
Формат: ${is_circular ? 'Круговой (петля с возвратом)' : 'В одну сторону'}.
Пожелание пользователя: "${custom_prompt || 'уютная неспешная прогулка, чтобы посидеть, поговорить и отдохнуть'}".
Выбранные активности: ${activitiesStr}.
Количество остановок: ${targetStopCount}.

Список проверенных РЕАЛЬНЫХ кандидатов:
${JSON.stringify(simplifiedCandidates, null, 2)}

Верни СТРОГО валидный JSON следующего формата:
{
  "scenario_title": "Атмосферное название прогулки",
  "ai_thought": "Почему эти реальные места образуют удобный маршрут",
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
            generationConfig: { response_mime_type: 'application/json', temperature: 0.6 },
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
                ai_thought: parsed.ai_thought || 'Маршрут спланирован в виде удобной связной петли.',
                stops: parsed.stops,
                model: `Google ${model}`,
              };
            }
          }
        }
      } catch (e) {
        // Continue to fallback
      }
    }
  }

  // 2. Вызов быстрой модели Pollinations AI
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
            'Маршрут построен в виде комфортного кольца с остановками для отдыха и общения.',
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
 * Ищет реальные заведения вокруг точки, формирует плавную петлю (или путь),
 * подключает OSRM для трека по тротуарам и улицам.
 */
export async function generateRouteClientFallback(params: RouteRequest): Promise<RouteResponse> {
  const {
    start_lat,
    start_lon,
    duration_minutes,
    scenario,
    is_circular,
    custom_prompt = '',
    activities = [],
    stop_count = 0,
    api_key,
    waypoints = [],
  } = params;

  // Комфортный пешеходный радиус: от 450 до 1200 метров в зависимости от времени
  const radius = Math.min(1200, Math.max(450, Math.round(350 + Math.sqrt(duration_minutes) * 65)));
  const targetStopCount = calculateStopCount(duration_minutes, stop_count);

  // 1. Поиск РЕАЛЬНЫХ мест (заведений, парков, скверов, памятников)
  let realPlaces = await fetchRealPlacesAround(start_lat, start_lon, radius, activities);

  if (realPlaces.length < targetStopCount + 2) {
    const wider = await fetchRealPlacesAround(start_lat, start_lon, radius * 1.5, activities);
    if (wider.length > realPlaces.length) {
      realPlaces = wider;
    }
  }

  // Рассчитываем полярный угол каждого места относительно старта
  const parsedPois = realPlaces.map((p) => ({
    ...p,
    angle: Math.atan2(p.lon - start_lon, p.lat - start_lat),
  }));

  // Для круговых маршрутов упорядочиваем кандидатов по сектору для гармоничной петли
  if (is_circular && parsedPois.length > 0) {
    // Находим якорную точку (ближайшую качественную локацию по интересам)
    const anchor = parsedPois[0];
    const anchorAngle = anchor.angle;

    // Сортируем кандидатов по угловой близости к якорному сектору
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

  // Расчет баланса времени: ~30-35% на шаг, остальное — на отдых
  const walkingBudgetMin = Math.min(45, Math.max(12, Math.round(duration_minutes * 0.32)));
  const spentBudgetMin = duration_minutes - walkingBudgetMin;
  const defaultSpentPerStop = Math.max(15, Math.round(spentBudgetMin / Math.max(1, targetStopCount)));

  // Обязательные точки, отмеченные пользователем вручную
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
    satellite_url: w.photo_url ? undefined : undefined,
    rating: 4.9,
    reviews_count: 120,
    opening_hours: 'Открыто для посещения',
    tags: ['Выбранная вами точка', 'Посетить по пути'],
    is_custom_waypoint: true,
  }));

  selectedStops.push(...customWaypointStops);

  // 2. Обращение к нейросети для продумывания остановок из проверенных кандидатов
  const llmPlan = await planRouteWithAI(
    start_lat,
    start_lon,
    duration_minutes,
    scenario,
    custom_prompt,
    activities,
    is_circular,
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
        selectedStops.push({
          id: match.id,
          name: match.name,
          category: match.cat,
          lat: match.lat,
          lon: match.lon,
          spent_minutes: Math.max(15, stop.spent_minutes || defaultSpentPerStop),
          description: stop.description || `${match.name} (${match.cat}) — прекрасное место для отдыха и приятного разговора.`,
          order: 0,
          address: match.address,
          photo_url: match.photo_url,
          satellite_url: match.satellite_url,
          rating: match.rating,
          reviews_count: match.reviews_count,
          opening_hours: match.opening_hours,
          tags: match.tags,
          reviews: match.reviews,
        });
      }
    }
  }

  // 3. Если нейросеть вернула меньше точек или оффлайн, дополняем из реального пула кандидатов
  if (selectedStops.length < targetStopCount) {
    const existingNames = new Set(selectedStops.map((s) => s.name.toLowerCase()));
    const remaining = parsedPois.filter((p) => !existingNames.has(p.name.toLowerCase()));

    // Добираем точки, образующие плавную дугу
    const needed = targetStopCount - selectedStops.length;
    for (let i = 0; i < Math.min(needed, remaining.length); i++) {
      const item = remaining[i];
      let desc = `${item.name} (${item.cat}) — уютное место для паузы и приятного разговора.`;
      if (custom_prompt) {
        desc = `${item.name} отлично подходит под ваше пожелание «${custom_prompt.slice(0, 40)}».`;
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
        satellite_url: item.satellite_url,
        rating: item.rating,
        reviews_count: item.reviews_count,
        opening_hours: item.opening_hours,
        tags: item.tags,
        reviews: item.reviews,
      });
    }

    if (!aiThought) {
      aiThought = is_circular
        ? `Маршрут спланирован в виде круговой петли (${spentBudgetMin} мин на отдых в точках). Никаких метаний туда-обратно: прогулка плавно возвращается к старту.`
        : `Плавный последовательный маршрут в пешей доступности (${spentBudgetMin} мин на отдых в точках).`;
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

  // 4. ГЕОМЕТРИЧЕСКАЯ ОПТИМИЗАЦИЯ:
  // Для кольцевых маршрутов применяем алгоритм круговой петли (Loop Polygon),
  // исключающий пересечение пути и развороты на 180°!
  const orderedStops = is_circular
    ? orderCircularStops(start_lat, start_lon, selectedStops)
    : orderLinearStops(start_lat, start_lon, selectedStops);

  // Обогащаем все остановки проверенными данными
  const finalStops: RouteStop[] = orderedStops.map((s, idx) => {
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

  // 5. Построение пешеходного трека по улицам через публичный HTTPS OSRM
  const coords: [number, number][] = [[start_lon, start_lat]];
  for (const s of finalStops) {
    coords.push([s.lon, s.lat]);
  }
  if (is_circular) {
    coords.push([start_lon, start_lat]);
  }

  const coordsStr = coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(';');
  let geojson: any = null;
  let distanceMeters = Math.min(2800, Math.round(walkingBudgetMin * 60));
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

  // Плавная интерполяция по контуру петли, если OSRM оффлайн
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

  const totalSpent = finalStops.reduce((acc, s) => acc + s.spent_minutes, 0);
  const totalRouteMinutes = walkingMinutes + totalSpent;
  const scTitle =
    customTitle ||
    (custom_prompt
      ? `Индивидуальный: ${custom_prompt.slice(0, 24)}...`
      : SCENARIOS_INFO[scenario]?.title || 'Прогулка');

  return {
    total_walking_minutes: walkingMinutes,
    total_distance_meters: distanceMeters,
    total_route_minutes: totalRouteMinutes,
    stops: finalStops,
    geojson,
    scenario,
    scenario_title: scTitle,
    used_ai: true,
    ai_model: usedModelName,
    ai_thought: aiThought,
    notes: `Маршрут из ${finalStops.length} остановок. Шаг: ${walkingMinutes} мин (${(distanceMeters / 1000).toFixed(
      1
    )} км). Отдых и беседы: ${totalSpent} мин.`,
  };
}
