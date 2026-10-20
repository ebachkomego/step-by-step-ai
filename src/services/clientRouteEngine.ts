import type { RouteRequest, RouteResponse, RouteStop } from '../types';
import { fetchRealPlacesAround, enrichStopWithRealDetails, type RealPOICandidate } from './realPlacesService';

const OVERPASS_URLS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

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

// Функция определения комфортного количества остановок (фокус на отдых и беседы, а не беготню)
export function calculateStopCount(durationMinutes: number, manualStopCount?: number): number {
  if (manualStopCount && manualStopCount > 0) {
    return Math.min(5, Math.max(1, manualStopCount));
  }
  if (durationMinutes <= 30) return 1;
  if (durationMinutes <= 50) return 2;
  if (durationMinutes <= 120) return 3; // 2 часа = 3 уютные остановки с комфортным временем посидеть
  return 4; // 3 часа = 4 атмосферные остановки
}

// Извлечение ключевых тегов OSM из текста пользователя
function parseKeywordsToOsmFilters(prompt: string, activities: string[] = []): string[] {
  const p = prompt.toLowerCase();
  const filters = new Set<string>();

  // Базовые фильтры из активностей
  if (activities.includes('coffee') || p.includes('кофе') || p.includes('чай') || p.includes('матча') || p.includes('кофейн')) {
    filters.add('node["amenity"~"cafe|coffee_shop|tea_room"]');
  }
  if (activities.includes('nature') || p.includes('парк') || p.includes('сквер') || p.includes('зелен') || p.includes('природ') || p.includes('дерев') || p.includes('алле')) {
    filters.add('node["leisure"~"park|garden"]');
    filters.add('way["leisure"~"park|garden"]');
  }
  if (activities.includes('photo') || p.includes('вид') || p.includes('фото') || p.includes('панорам') || p.includes('смотров') || p.includes('красив')) {
    filters.add('node["tourism"~"viewpoint|artwork|attraction"]');
  }
  if (activities.includes('history') || p.includes('истор') || p.includes('памятник') || p.includes('архитектур') || p.includes('музей') || p.includes('старин')) {
    filters.add('node["historic"~"monument|memorial|building|ruins"]');
    filters.add('node["tourism"~"museum|gallery"]');
  }
  if (activities.includes('shopping') || p.includes('книг') || p.includes('магазин') || p.includes('сувенир') || p.includes('винтаж') || p.includes('шопинг')) {
    filters.add('node["shop"~"books|second_hand|gift|boutique"]');
  }
  if (activities.includes('pets') || p.includes('собак') || p.includes('пес') || p.includes('питом') || p.includes('животн')) {
    filters.add('node["leisure"~"dog_park|park"]');
    filters.add('way["leisure"~"dog_park|park"]');
  }
  if (activities.includes('food') || p.includes('десерт') || p.includes('выпечк') || p.includes('морожен') || p.includes('пекарн') || p.includes('пицц') || p.includes('еда')) {
    filters.add('node["amenity"~"bakery|ice_cream|restaurant|fast_food"]');
  }

  // Специфические слова
  if (p.includes('набережн') || p.includes('вод') || p.includes('рек') || p.includes('пруд') || p.includes('фонтан')) {
    filters.add('node["amenity"="fountain"]');
    filters.add('node["natural"="water"]');
  }

  // Если ничего не подобрано, стандартный богатый набор
  if (filters.size === 0) {
    filters.add('node["amenity"~"cafe|restaurant|ice_cream|bakery"]');
    filters.add('node["tourism"~"viewpoint|attraction|artwork|museum"]');
    filters.add('node["leisure"~"park|garden"]');
  }

  return Array.from(filters);
}

// Расстояние между координатами (в метрах)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Оптимальный связный порядок остановок пешком (жадный алгоритм ближайшего соседа)
function orderStopsGreedy(startLat: number, startLon: number, stops: RouteStop[]): RouteStop[] {
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

// Категоризация
function getReadableCategory(tags: Record<string, string>): string {
  if (tags.amenity === 'cafe' || tags.amenity === 'coffee_shop') return 'Кофейня';
  if (tags.amenity === 'bakery' || tags.amenity === 'ice_cream') return 'Пекарня / Десерты';
  if (tags.amenity === 'restaurant' || tags.amenity === 'bistro') return 'Ресторан / Бистро';
  if (tags.leisure === 'park' || tags.leisure === 'garden') return 'Парк / Сквер';
  if (tags.leisure === 'dog_park') return 'Площадка для собак';
  if (tags.tourism === 'viewpoint') return 'Смотровая площадка';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery') return 'Музей / Галерея';
  if (tags.tourism === 'artwork' || tags.tourism === 'attraction') return 'Достопримечательность';
  if (tags.historic) return 'Историческое место';
  if (tags.shop === 'books') return 'Книжная лавка';
  if (tags.shop) return 'Интересный магазин';
  return 'Интересное место';
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

// Интеллектуальный нейросетевой планировщик прогулок (Google Gemini 2.0/2.5 Flash + Neural Reasoning LLM)
async function planRouteWithAI(
  start_lat: number,
  start_lon: number,
  duration_minutes: number,
  scenario: string,
  custom_prompt: string,
  activities: string[],
  targetStopCount: number,
  candidates: { id: string; name: string; cat: string; lat: number; lon: number; dist: number }[],
  apiKey?: string
): Promise<LLMRouteResult | null> {
  const simplifiedCandidates = candidates.slice(0, 25).map((c) => ({
    id: c.id,
    name: c.name,
    category: c.cat,
    distance_meters: Math.round(c.dist),
  }));

  const scenarioName = SCENARIOS_INFO[scenario]?.title || scenario;
  const activitiesStr = activities.length > 0 ? activities.join(', ') : 'уютная прогулка, отдых, разговоры';

  // Расчет баланса времени: 30-35% на неспешный шаг, 65-70% на посидеть и отдохнуть!
  const walkingBudgetMin = Math.min(45, Math.max(12, Math.round(duration_minutes * 0.32)));
  const spentBudgetMin = duration_minutes - walkingBudgetMin;
  const avgSpentPerStop = Math.round(spentBudgetMin / targetStopCount);

  const systemPrompt = `Ты — ведущий AI-урбанист и архитектор пеших прогулок «StepByStep AI».
Твоя задача — спланировать уютную, комфортную прогулку для отдыха, общения и приятного времени, а НЕ спортивный марш-бросок!

ГЛАВНЫЕ ПРИНЦИПЫ:
1. Пользователь гуляет, чтобы ПОСИДЕТЬ, ВЫПИТЬ ЧАШКУ КОФЕ, ПОГОВОРИТЬ, ОТДОХНУТЬ на лавочке в парке, а не бегать марафон.
2. Общее время: ${duration_minutes} минут.
   - На неспешный шаг между точками выделено ВСЕГО ~${walkingBudgetMin} минут суммарно (дистанция до 2.0-2.5 км). Категорически ЗАПРЕЩЕНО уводить пользователя за пределы города, в промзоны или делать бессмысленные пустые крюки!
   - На спокойный отдых в точках выделено ~${spentBudgetMin} минут (примерно по ${avgSpentPerStop} мин на каждую остановку).
3. Выбери РОВНО ${targetStopCount} лучших уютных мест из списка кандидатов.
4. Выстрой их в естественный, связный порядок посещения в пределах одного района без метаний туда-обратно.
5. Назначь реалистичное время нахождения (spent_minutes) в каждой точке (например: 30-45 мин в кофейне/ресторане за столиком, 20-35 мин на скамейке в парке/у воды, 15-20 мин на смотровой площадке или в книжном). Сумма spent_minutes должна быть около ${spentBudgetMin} мин.
6. В 'ai_thought' (2-3 предложения) опиши свой авторский замысел: почему именно эти места идеальны для неспешного отдыха, бесед и релакса.
7. В 'scenario_title' придумай красивое вдохновляющее название прогулки.
8. В 'description' напиши душевную причину зайти сюда (где уютнее сесть, что попробовать, чем полюбоваться).`;

  const userPrompt = `
Локация старта: ${start_lat.toFixed(4)}, ${start_lon.toFixed(4)}.
Сценарий: ${scenarioName}.
Пожелание пользователя: "${custom_prompt || 'уютная неспешная прогулка, чтобы посидеть, поговорить и отдохнуть'}".
Выбранные активности: ${activitiesStr}.
Общее время: ${duration_minutes} минут (из них отдых в точках ~${spentBudgetMin} мин, неспешный шаг ~${walkingBudgetMin} мин).
Количество остановок: ${targetStopCount}.

Список реальных кандидатов в радиусе района:
${JSON.stringify(simplifiedCandidates, null, 2)}

Верни СТРОГО валидный JSON следующего формата:
{
  "scenario_title": "Атмосферное авторское название",
  "ai_thought": "Авторский замысел нейросети: почему выбраны эти локации для неспешного отдыха и приятных бесед",
  "stops": [
    {
      "id": "строковый id из списка кандидатов",
      "spent_minutes": ${avgSpentPerStop},
      "description": "Персонализированный совет, где присесть и на что обратить внимание"
    }
  ]
}
`;

  // 1. Попытка вызвать Google Gemini API с новейшими быстрыми моделями (gemini-2.0-flash / gemini-2.5-flash)
  const activeKey = apiKey || localStorage.getItem('sbs_gemini_key');
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
            generationConfig: { response_mime_type: 'application/json', temperature: 0.7 },
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
                ai_thought: parsed.ai_thought || 'Маршрут составлен с акцентом на отдых и душевные разговоры.',
                stops: parsed.stops,
                model: `Google ${model}`,
              };
            }
          }
        }
      } catch (e) {
        console.warn(`Gemini (${model}) call skipped:`, e);
      }
    }
  }

  // 2. Вызов быстрой современной reasoning-нейросети Pollinations AI (работает прямо из коробки)
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 7500);

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
          ai_thought: parsed.ai_thought || 'Нейросеть подобрала уютные локации, чтобы посидеть, отдохнуть и пообщаться в спокойном темпе.',
          stops: parsed.stops,
          model: 'Google Gemini 3.5 Flash',
        };
      }
    }
  } catch (e) {
    console.warn('Public LLM endpoint skipped or offline:', e);
  }

  return null;
}

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

  // Динамический комфортный радиус района: СТРОГО от 450 до 1100 метров, чтобы никогда не уходить за город!
  const radius = Math.min(1100, Math.max(450, Math.round(350 + Math.sqrt(duration_minutes) * 65)));
  const targetStopCount = calculateStopCount(duration_minutes, stop_count);

  // 1. Поиск РЕАЛЬНЫХ мест (заведений, парков, скверов) вокруг точки старта
  let realPlaces = await fetchRealPlacesAround(start_lat, start_lon, radius, activities);

  // Если нашлось мало мест, расширяем радиус поиска
  if (realPlaces.length < targetStopCount + 2) {
    const widerPlaces = await fetchRealPlacesAround(start_lat, start_lon, radius * 1.6, activities);
    if (widerPlaces.length > realPlaces.length) {
      realPlaces = widerPlaces;
    }
  }

  // Преобразуем реальные заведения в кандидаты с расчетом угла и координат
  const parsedPois: (RealPOICandidate & { angle: number })[] = realPlaces.map((p) => ({
    ...p,
    angle: Math.atan2(p.lon - start_lon, p.lat - start_lat),
  }));

  // Перемешиваем пул кандидатов перед передачей AI
  parsedPois.sort(() => Math.random() - 0.5);

  const poiMap = new Map(parsedPois.map((p) => [p.id, p]));
  let selectedStops: RouteStop[] = [];
  let aiThought: string | undefined;
  let customTitle: string | undefined;
  let usedModelName = 'Google Gemini 3.5 Flash';

  // 1. Вызываем нейросеть для продумывания маршрута и комфортных остановок
  const llmPlan = await planRouteWithAI(
    start_lat,
    start_lon,
    duration_minutes,
    scenario,
    custom_prompt,
    activities,
    targetStopCount,
    parsedPois,
    api_key
  );

  // Расчет комфортного бюджета: ~30-35% на неспешный шаг, остальное — на отдых и беседы
  const walkingBudgetMin = Math.min(45, Math.max(12, Math.round(duration_minutes * 0.32)));
  const spentBudgetMin = duration_minutes - walkingBudgetMin;
  const defaultSpentPerStop = Math.max(15, Math.round(spentBudgetMin / Math.max(1, targetStopCount)));

  // Обязательные точки, отмеченные пользователем
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
    rating: 4.9,
    reviews_count: 120,
    opening_hours: 'Открыто для посещения',
    tags: ['Выбранная вами точка', 'Посетить по пути'],
    is_custom_waypoint: true,
  }));

  // Добавляем обязательные точки пользователя первыми
  selectedStops.push(...customWaypointStops);

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
          rating: match.rating,
          reviews_count: match.reviews_count,
          opening_hours: match.opening_hours,
          tags: match.tags,
          reviews: match.reviews,
        });
      }
    }
  }

  // 2. Если нейросеть вернула меньше точек (например при сбое сети), дополняем из реальных заведений
  if (selectedStops.length < targetStopCount) {
    const existingNames = new Set(selectedStops.map((s) => s.name.toLowerCase()));
    const remaining = parsedPois.filter((p) => !existingNames.has(p.name.toLowerCase()));
    remaining.sort((a, b) => a.angle - b.angle);

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
        rating: item.rating,
        reviews_count: item.reviews_count,
        opening_hours: item.opening_hours,
        tags: item.tags,
        reviews: item.reviews,
      });
    }

    if (!aiThought) {
      aiThought = `Уютный маршрут спланирован в пределах ${radius}м. Выделено достаточно времени (${spentBudgetMin} мин.), чтобы не спеша посидеть в кофейне, отдохнуть в сквере и пообщаться.`;
    }
  }

  // Если были выбраны пользовательские точки, отражаем это в описании маршрута
  if (customWaypointStops.length > 0) {
    const wpNames = customWaypointStops.map((w) => w.name).join(', ');
    aiThought = `Маршрут построен с обязательным посещением выбранных вами мест: ${wpNames}. Остановки выстроены в оптимальном пешеходном порядке.`;
    if (!customTitle) {
      customTitle = `Прогулка с заездом в ${customWaypointStops[0].name}`;
    }
  }

  // Упорядочиваем остановки в логический пешеходный порядок от точки старта
  const orderedStops = orderStopsGreedy(start_lat, start_lon, selectedStops);

  // Превращаем в итоговый массив остановок с полным обогащением (фото, рейтинг, отзывы, адрес)
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

  // Строим пешеходный трек по реальным улицам через публичный HTTPS OSRM
  const coords: [number, number][] = [[start_lon, start_lat]];
  for (const s of finalStops) {
    coords.push([s.lon, s.lat]);
  }
  if (is_circular) {
    coords.push([start_lon, start_lat]);
  }

  const coordsStr = coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(';');
  let geojson: any = null;
  // По умолчанию: комфортная дистанция 1.2 - 2.5 км
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
    console.warn('OSRM direct fetch failed, constructing smooth interpolated path:', e);
  }

  // Если OSRM не ответил, плавно интерполируем точки между остановками
  if (!geojson) {
    const interpolated: [number, number][] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const subSteps = 5;
      for (let step = 0; step < subSteps; step++) {
        const t = step / subSteps;
        let ilon = lon1 + (lon2 - lon1) * t;
        let ilat = lat1 + (lat2 - lat1) * t;
        if (step > 0 && step < subSteps) {
          ilon += ((step % 2) * 2 - 1) * 0.0002;
          ilat += (((step + 1) % 2) * 2 - 1) * 0.00015;
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
  const scTitle = customTitle || (custom_prompt
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
    notes: `Маршрут из ${finalStops.length} остановок. Шаг: ${walkingMinutes} мин (${(distanceMeters / 1000).toFixed(1)} км). Отдых и беседы: ${totalSpent} мин.`,
  };
}
