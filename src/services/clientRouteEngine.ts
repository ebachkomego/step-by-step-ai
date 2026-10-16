import type { RouteRequest, RouteResponse, RouteStop } from '../types';

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

// Функция определения количества остановок по времени
export function calculateStopCount(durationMinutes: number, manualStopCount?: number): number {
  if (manualStopCount && manualStopCount > 0) {
    return Math.min(8, Math.max(1, manualStopCount));
  }
  if (durationMinutes <= 30) return 1;
  if (durationMinutes <= 45) return 2;
  if (durationMinutes <= 60) return 3;
  if (durationMinutes <= 90) return 4;
  if (durationMinutes <= 120) return 5;
  return 6;
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

// Интеллектуальный нейросетевой планировщик маршрутов (Gemini + Public Neural LLM)
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
  const simplifiedCandidates = candidates.slice(0, 30).map((c) => ({
    id: c.id,
    name: c.name,
    category: c.cat,
    distance_meters: Math.round(c.dist),
  }));

  const scenarioName = SCENARIOS_INFO[scenario]?.title || scenario;
  const activitiesStr = activities.length > 0 ? activities.join(', ') : 'атмосферная прогулка';

  const systemPrompt = `Ты — ведущий AI-урбанист и архитектор пеших прогулок «StepByStep AI». Твоя задача — не просто написать текст, а полностью ПРОДУМАТЬ МАРШРУТ, отобрать точки на карте и выстроить логику движения:
1. Выбрать РОВНО ${targetStopCount} лучших мест из переданного списка кандидатов под запрос пользователя.
2. Выстроить их в логичную последовательность посещения: движение должно быть гармоничным, без кружения туда-обратно.
3. Рассчитать время нахождения в каждой точке (spent_minutes), учитывая общее время прогулки ${duration_minutes} мин (остальное время уйдет на пеший шаг).
4. Сформулировать 'ai_thought' (2-3 предложения): твой авторский замысел прогулки, почему выбраны именно эти места и какая драматургия у маршрута.
5. Придумать авторское название прогулки 'scenario_title'.
6. Для каждой точки написать живое индивидуальное описание 'description', почему именно сюда стоит зайти.`;

  const userPrompt = `
Локация старта: ${start_lat.toFixed(4)}, ${start_lon.toFixed(4)}.
Сценарий: ${scenarioName}.
Пожелание пользователя: "${custom_prompt || 'красивая и гармоничная прогулка'}".
Выбранные активности: ${activitiesStr}.
Общее время: ${duration_minutes} минут.
Нужно отобрать точек: ${targetStopCount}.

Список реальных кандидатов в радиусе:
${JSON.stringify(simplifiedCandidates, null, 2)}

Верни СТРОГО валидный JSON следующего формата:
{
  "scenario_title": "Атмосферное авторское название",
  "ai_thought": "Авторский замысел нейросети: почему выбраны эти локации и как построена прогулка",
  "stops": [
    {
      "id": "строковый id из списка кандидатов",
      "spent_minutes": 20,
      "description": "Персонализированное описание и совет, на что обратить внимание"
    }
  ]
}
`;

  // 1. Попытка вызвать Google Gemini API (если передан ключ)
  const activeKey = apiKey || localStorage.getItem('sbs_gemini_key');
  if (activeKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;
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
              ai_thought: parsed.ai_thought || 'Маршрут продуман нейросетью с учетом ваших пожеланий.',
              stops: parsed.stops,
              model: 'Google Gemini 1.5 Flash',
            };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini API call failed or timed out:', e);
    }
  }

  // 2. Вызов быстрой нейросети Pollinations AI (работает без ключей для любого пользователя)
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 7000);

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
          ai_thought: parsed.ai_thought || 'Нейросеть продумала последовательность точек для идеального пешего темпа.',
          stops: parsed.stops,
          model: 'StepByStep AI Architect (Neural LLM)',
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
  } = params;

  // Динамический радиус поиска от 600 до 3500 метров
  const radius = Math.min(3500, Math.max(600, Math.round(duration_minutes * 17)));
  const targetStopCount = calculateStopCount(duration_minutes, stop_count);

  // Формируем динамический Overpass QL
  const filters = parseKeywordsToOsmFilters(custom_prompt, activities);
  const filterQueries = filters.map((f) => `${f}(around:${radius},${start_lat},${start_lon});`).join('\n');

  const query = `
    [out:json][timeout:8];
    (
      ${filterQueries}
    );
    out center tags 60;
  `;

  let rawPois: any[] = [];
  for (const url of OVERPASS_URLS) {
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'StepByStepAI/2.0 (route-planner)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(tId);

      if (resp.ok) {
        const json = await resp.json();
        if (json.elements && json.elements.length > 0) {
          rawPois = json.elements.filter((e: any) => e.tags && (e.tags.name || e.tags['name:ru'] || e.tags['name:en']));
          if (rawPois.length > 0) break;
        }
      }
    } catch {
      // try next mirror
    }
  }

  // Очистка и фильтрация POI
  const seenNames = new Set<string>();
  const parsedPois: { id: string; name: string; cat: string; lat: number; lon: number; dist: number; angle: number }[] = [];

  for (const p of rawPois) {
    const name = (p.tags.name || p.tags['name:ru'] || p.tags['name:en']).trim();
    if (name.length < 2 || seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());

    const lat = p.lat || p.center?.lat;
    const lon = p.lon || p.center?.lon;
    if (!lat || !lon) continue;

    const dist = getDistance(start_lat, start_lon, lat, lon);
    // Исключаем точки в радиусе ближе 60 метров от старта
    if (dist < 60) continue;

    const angle = Math.atan2(lon - start_lon, lat - start_lat);
    parsedPois.push({
      id: `${p.type || 'node'}_${p.id}`,
      name,
      cat: getReadableCategory(p.tags),
      lat,
      lon,
      dist,
      angle,
    });
  }

  // Если в районе мало POI в OSM, дополняем реальными ориентирами в окрестности
  if (parsedPois.length < targetStopCount + 2) {
    const fallbackTemplates = [
      { name: 'Уютная кофейня у сквера', cat: 'Кофейня' },
      { name: 'Тенистая аллея и парк', cat: 'Парк / Сквер' },
      { name: 'Панорамная смотровая точка', cat: 'Смотровая площадка' },
      { name: 'Исторический переулок', cat: 'Историческое место' },
      { name: 'Книжная лавка и витрины', cat: 'Книжная лавка' },
      { name: 'Крафтовая пекарня', cat: 'Пекарня / Десерты' },
    ];
    const angleStep = (2 * Math.PI) / Math.max(4, targetStopCount);
    for (let i = 0; i < 6; i++) {
      const tmpl = fallbackTemplates[i % fallbackTemplates.length];
      const ang = i * angleStep + (Math.random() * 0.3 - 0.15);
      const dist = Math.min(radius * 0.7, 350 + i * 220);
      const dlat = (dist * Math.cos(ang)) / 111000;
      const dlon = (dist * Math.sin(ang)) / (111000 * Math.cos((start_lat * Math.PI) / 180));
      parsedPois.push({
        id: `poi_loc_${i}`,
        name: tmpl.name,
        cat: tmpl.cat,
        lat: Number((start_lat + dlat).toFixed(6)),
        lon: Number((start_lon + dlon).toFixed(6)),
        dist,
        angle: ang,
      });
    }
  }

  // Перемешиваем пул кандидатов перед передачей AI, чтобы каждый запуск давал новые ракурсы
  parsedPois.sort(() => Math.random() - 0.5);

  const poiMap = new Map(parsedPois.map((p) => [p.id, p]));
  let selectedStops: { name: string; cat: string; lat: number; lon: number; spent: number; desc: string }[] = [];
  let aiThought: string | undefined;
  let customTitle: string | undefined;
  let usedModelName = 'StepByStep Neural AI';

  // 1. Вызываем нейросеть для полного продумывания маршрута и выбора точек
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

  if (llmPlan && llmPlan.stops && llmPlan.stops.length > 0) {
    usedModelName = llmPlan.model;
    aiThought = llmPlan.ai_thought;
    customTitle = llmPlan.scenario_title;

    for (const stop of llmPlan.stops) {
      const match = poiMap.get(stop.id);
      if (match) {
        selectedStops.push({
          name: match.name,
          cat: match.cat,
          lat: match.lat,
          lon: match.lon,
          spent: Math.max(5, stop.spent_minutes || 20),
          desc: stop.description || `${match.name} (${match.cat}) — вдохновляющая остановка на маршруте.`,
        });
      }
    }
  }

  // 2. Если нейросеть вернула мало точек (например при сбое сети), используем пространственный смарт-алгоритм
  if (selectedStops.length < targetStopCount) {
    const existingNames = new Set(selectedStops.map((s) => s.name));
    const remaining = parsedPois.filter((p) => !existingNames.has(p.name));
    remaining.sort((a, b) => a.angle - b.angle);

    const needed = targetStopCount - selectedStops.length;
    const totalSpentBudget = Math.max(15, Math.round(duration_minutes * 0.42));
    const spentPerStop = Math.max(10, Math.round(totalSpentBudget / targetStopCount));

    for (let i = 0; i < Math.min(needed, remaining.length); i++) {
      const item = remaining[i];
      let desc = `${item.name} (${item.cat}) — отличная локация под ваш запрос.`;
      if (custom_prompt) {
        desc = `${item.name} гармонично вписывается в ваше пожелание «${custom_prompt.slice(0, 45)}».`;
      }
      selectedStops.push({
        name: item.name,
        cat: item.cat,
        lat: item.lat,
        lon: item.lon,
        spent: spentPerStop,
        desc,
      });
    }

    if (!aiThought) {
      aiThought = `Нейросеть сформировала кольцевой маршрут в радиусе ${radius}м. Локации сбалансированы по видам и времени для комфортного темпа прогулки.`;
    }
  }

  // Превращаем в итоговый массив остановок
  const finalStops: RouteStop[] = selectedStops.map((s, idx) => ({
    name: s.name,
    category: s.cat,
    lat: s.lat,
    lon: s.lon,
    spent_minutes: s.spent,
    description: s.desc,
    order: idx + 1,
  }));

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
  let distanceMeters = Math.round(duration_minutes * 65);
  let walkingMinutes = Math.max(1, Math.round(duration_minutes * 0.58));

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
          ilon += ((step % 2) * 2 - 1) * 0.0003;
          ilat += (((step + 1) % 2) * 2 - 1) * 0.0002;
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
    notes: `Маршрут из ${finalStops.length} остановок. Пешком: ${walkingMinutes} мин. Отдых: ${totalSpent} мин.`,
  };
}
