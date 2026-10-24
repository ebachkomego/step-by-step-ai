import type { RouteRequest, RouteResponse, RouteStop } from '../types';
import {
  fetchRealPlacesAround,
  enrichStopWithRealDetails,
  getCoordinatesDistance,
  type RealPOICandidate,
} from './realPlacesService';

export const SCENARIOS_INFO: Record<string, { title: string; defaultActivities: string[]; desc: string }> = {
  walk: {
    title: 'Прогулка',
    defaultActivities: ['walk', 'views'],
    desc: 'Пеший маршрут через красивые бульвары, набережные и открытые виды',
  },
  sights: {
    title: 'Памятники',
    defaultActivities: ['sights', 'walk'],
    desc: 'Архитектура, памятники, исторические соборы и городские достопримечательности',
  },
  coffee: {
    title: 'Кофейни',
    defaultActivities: ['coffee', 'views'],
    desc: 'Лучшие кофейни, кофе с собой, десерты и уютные посадки',
  },
  fastfood: {
    title: 'Фастфуд',
    defaultActivities: ['fastfood', 'walk'],
    desc: 'Сочная шаурма, бургеры, пицца, KFC и аппетитный перекус',
  },
  views: {
    title: 'Красивые виды',
    defaultActivities: ['views', 'walk'],
    desc: 'Смотровые площадки, панорамы, широкие бульвары и набережные',
  },
  nature: {
    title: 'Природа',
    defaultActivities: ['nature', 'walk'],
    desc: 'Тенистые аллеи, скверы, парки, пруды и чистый воздух',
  },
  bakery: {
    title: 'Выпечка',
    defaultActivities: ['bakery', 'coffee'],
    desc: 'Свежая выпечка, хрустящие круассаны и уютные булочные',
  },
  date: {
    title: 'Свидание',
    defaultActivities: ['date', 'coffee', 'views'],
    desc: 'Уютная атмосфера, вечерние огни, десерты и неспешное общение',
  },
  dog_walk: {
    title: 'С собакой',
    defaultActivities: ['dog_walk', 'nature'],
    desc: 'Просторные парки, зеленые аллеи и площадки вдали от дорог',
  },
  shopping: {
    title: 'Магазины',
    defaultActivities: ['shopping', 'walk'],
    desc: 'Оживленные улицы с витринами, торговые центры и галереи',
  },
  quiet: {
    title: 'Тихий отдых',
    defaultActivities: ['quiet', 'nature'],
    desc: 'Уединенные малолюдные аллеи и скамейки для спокойных бесед',
  },
  sweets: {
    title: 'Сладкое',
    defaultActivities: ['sweets', 'coffee'],
    desc: 'Джелато, авторские десерты и кондитерские лавки',
  },
  // Совместимость со старыми ключами
  tourist: {
    title: 'Прогулка',
    defaultActivities: ['walk', 'views'],
    desc: 'Красивые места города',
  },
  coffee_walk: {
    title: 'Кофейни',
    defaultActivities: ['coffee', 'views'],
    desc: 'Кофейни и аллеи',
  },
};

export type CategoryGroup =
  | 'fastfood'
  | 'coffee'
  | 'bakery'
  | 'sweets'
  | 'views'
  | 'nature'
  | 'sights'
  | 'shopping'
  | 'walk'
  | 'other';

/**
 * Определение смысловой группы места для соблюдения точного соответствия форматам прогулки
 */
export function getCategoryGroup(cat: string): CategoryGroup {
  const c = cat.toLowerCase();
  if (
    c.includes('фастфуд') ||
    c.includes('шаурм') ||
    c.includes('шаверм') ||
    c.includes('донер') ||
    c.includes('бургер') ||
    c.includes('kfc') ||
    c.includes('кфс') ||
    c.includes('пицц') ||
    c.includes('стритфуд') ||
    c.includes('додо') ||
    c.includes('чебурек') ||
    c.includes('блин') ||
    c.includes('драник')
  ) {
    return 'fastfood';
  }
  if (c.includes('кофе') || c.includes('чай') || c.includes('coffee')) {
    return 'coffee';
  }
  if (c.includes('пекарн') || c.includes('булочн') || c.includes('выпечк') || c.includes('круассан')) {
    return 'bakery';
  }
  if (c.includes('морожен') || c.includes('джелато') || c.includes('сладост') || c.includes('кондитер')) {
    return 'sweets';
  }
  if (
    c.includes('смотров') ||
    c.includes('набережн') ||
    c.includes('бульвар') ||
    c.includes('панорам') ||
    c.includes('вид')
  ) {
    return 'views';
  }
  if (
    c.includes('парк') ||
    c.includes('сквер') ||
    c.includes('сад') ||
    c.includes('алле') ||
    c.includes('пруд') ||
    c.includes('озер') ||
    c.includes('природ')
  ) {
    return 'nature';
  }
  if (
    c.includes('достопримеч') ||
    c.includes('памятник') ||
    c.includes('мемориал') ||
    c.includes('музей') ||
    c.includes('храм') ||
    c.includes('собор') ||
    c.includes('костел') ||
    c.includes('архитектур') ||
    c.includes('истор')
  ) {
    return 'sights';
  }
  if (c.includes('магазин') || c.includes('тц') || c.includes('торгов') || c.includes('галере') || c.includes('шопинг')) {
    return 'shopping';
  }
  if (c.includes('улиц') || c.includes('проспект') || c.includes('пешеходн') || c.includes('променад')) {
    return 'walk';
  }
  return 'other';
}

// Функция определения комфортного количества остановок
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
 * Расчет параметров движения вдоль пешеходного коридора А -> Б в метрах.
 */
export function getCorridorMetrics(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  pLat: number,
  pLon: number
): { t: number; lateralMeters: number } {
  const midLatRad = (((startLat + endLat) / 2) * Math.PI) / 180;
  const metersPerDegLat = 111132;
  const metersPerDegLon = 111320 * Math.cos(midLatRad);

  const dx = (endLon - startLon) * metersPerDegLon;
  const dy = (endLat - startLat) * metersPerDegLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return {
      t: 0,
      lateralMeters: getCoordinatesDistance(startLat, startLon, pLat, pLon),
    };
  }

  const px = (pLon - startLon) * metersPerDegLon;
  const py = (pLat - startLat) * metersPerDegLat;

  const t = (px * dx + py * dy) / lenSq;
  const cross = Math.abs(px * dy - py * dx);
  const lateralMeters = cross / Math.sqrt(lenSq);

  return { t, lateralMeters };
}

/**
 * Идеальный алгоритм построения кольцевого маршрута (Loop Polygon).
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
 * Сортировка остановок строго по направлению движения коридора А -> Б.
 */
export function orderCorridorStops(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  stops: RouteStop[]
): RouteStop[] {
  if (stops.length <= 1) return stops;

  const withProgression = stops.map((s) => {
    const metrics = getCorridorMetrics(startLat, startLon, endLat, endLon, s.lat, s.lon);
    return { ...s, t: metrics.t };
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

/**
 * Умная генерация вдохновляющего названия прогулки на основе остановок, форматов и финиша.
 * КАТЕГОРИЧЕСКИ исключает сухие технические строки вроде "Маршрут в выбранная точка финиша".
 */
export function generateSmartRouteTitle(
  scenario: string,
  activities: string[],
  stops: RouteStop[],
  endName?: string,
  customPrompt?: string
): string {
  if (customPrompt && customPrompt.trim().length > 3) {
    const cleanPrompt = customPrompt.trim();
    if (cleanPrompt.length <= 36) {
      return cleanPrompt.charAt(0).toUpperCase() + cleanPrompt.slice(1);
    }
  }

  // Очистка от технических заглушек финиша
  let cleanEndName: string | undefined = undefined;
  if (endName) {
    const lower = endName.toLowerCase().trim();
    if (
      !lower.includes('выбранная точка') &&
      !lower.includes('точка финиша') &&
      !lower.includes('конечная') &&
      !lower.includes('точка 5') &&
      !lower.match(/^\d+[\.,]\d+/)
    ) {
      cleanEndName = endName.replace(/^г\.\s*[^,]+,\s*/i, '').trim();
    }
  }

  const acts = activities.length > 0 ? activities : [scenario];

  // Знаковые остановки из маршрута
  const boulevardStop = stops.find(
    (s) => s.category.toLowerCase().includes('бульвар') || s.name.toLowerCase().includes('бульвар')
  )?.name;
  const parkStop = stops.find((s) => s.category.toLowerCase().includes('парк'))?.name;
  const foodStop = stops.find(
    (s) =>
      s.category.toLowerCase().includes('фастфуд') ||
      s.category.toLowerCase().includes('шаурм') ||
      s.category.toLowerCase().includes('кофе') ||
      s.category.toLowerCase().includes('пекарн')
  )?.name;

  let lead = 'Красивый пеший маршрут';
  if (acts.includes('fastfood')) {
    lead = 'Стритфуд и променад';
  } else if (acts.includes('coffee')) {
    lead = 'Ароматный кофе и прогулка';
  } else if (acts.includes('bakery')) {
    lead = 'Свежая выпечка и теплый маршрут';
  } else if (acts.includes('sweets')) {
    lead = 'Сладкий променад и десерты';
  } else if (acts.includes('sights')) {
    lead = 'Архитектурный променад';
  } else if (acts.includes('views')) {
    lead = 'Видовой маршрут по бульварам';
  } else if (acts.includes('nature')) {
    lead = 'Зеленый променад сквозь парки';
  } else if (acts.includes('date')) {
    lead = 'Романтический вечерний променад';
  } else if (acts.includes('dog_walk')) {
    lead = 'Просторная прогулка с любимцем';
  } else if (acts.includes('shopping')) {
    lead = 'Прогулка по оживленным витринам';
  } else if (acts.includes('quiet')) {
    lead = 'Тихий умиротворяющий променад';
  }

  if (cleanEndName) {
    return `${lead} к ${cleanEndName}`;
  }

  if (boulevardStop) {
    const bLower = boulevardStop.toLowerCase();
    const formatted = bLower.includes('оживленн')
      ? 'по оживленному пешеходному бульвару'
      : bLower.includes('прогулочн')
      ? 'по прогулочной аллее'
      : `вдоль ${boulevardStop}`;
    return `${lead} ${formatted}`;
  }

  if (parkStop) {
    return `${lead} через ${parkStop}`;
  }

  if (foodStop) {
    return `${lead} через ${foodStop}`;
  }

  return `${lead} по красивым местам`;
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
  end_name: string | undefined,
  targetStopCount: number,
  candidates: { id: string; name: string; cat: string; lat: number; lon: number; dist: number; address?: string }[],
  apiKey?: string
): Promise<LLMRouteResult | null> {
  const simplifiedCandidates = candidates.slice(0, 18).map((c) => ({
    id: c.id,
    name: c.name,
    category: c.cat,
    address: c.address || 'Пешая доступность',
    distance_meters: Math.round(c.dist),
  }));

  const acts = activities.length > 0 ? activities : [scenario];
  const formatNames = acts.map((a) => SCENARIOS_INFO[a]?.title || a).join(', ');

  const walkingBudgetMin = Math.min(45, Math.max(12, Math.round(duration_minutes * 0.32)));
  const spentBudgetMin = duration_minutes - walkingBudgetMin;
  const avgSpentPerStop = Math.max(12, Math.round(spentBudgetMin / targetStopCount));

  let routeTypeDesc = 'КРУГОВОЙ МАРШРУТ (ПЕТЛЯ) — плавное связное кольцо в одном районе с возвратом к старту.';
  if (has_endpoint) {
    routeTypeDesc = `МАРШРУТ К КОНЕЧНОЙ ТОЧКЕ (А -> Б)${end_name ? ` (к точке: ${end_name})` : ''} — последовательное движение вперед к финишу без возвратов назад.`;
  } else if (!is_circular) {
    routeTypeDesc = 'ЛИНЕЙНЫЙ МАРШРУТ — точки удаляются от старта в комфортном направлении.';
  }

  const systemPrompt = `Ты — ведущий AI-урбанист и архитектор пеших прогулок «StepByStep AI».
Твоя задача — составить гармоничный, атмосферный пешеходный маршрут под выбранные пользователем форматы.

СТРОГИЕ ПРАВИЛА:
1. ПОЖЕЛАНИЯ И ФОРМАТЫ: Пользователь выбрал: "${formatNames}".
   - "Прогулка" — это пеший маршрут через красивые бульвары, набережные и открытые виды (БЕЗ обязательной истории/архитектуры!).
   - "Памятники" — архитектура, памятники, исторические здания, соборы, музеи.
   - "Фастфуд" — сочная шаурма, бургеры, пиццерии, стритфуд, KFC.
   - "Кофейни" — кофе на вынос, спешелти кофейни, десерты.
   - "Красивые виды" — открытые смотровые виды, бульвары, панорамы, набережные.
   - "Природа" — зеленые парки, скверы, аллеи.
   - "Выпечка" — свежая выпечка, круассаны, булочные.
   - "Тихий отдых" — уединенные малолюдные аллеи и скамейки для спокойных бесед.
   - "Сладкое" — кондитерские, мороженое, десерты.
2. В 'scenario_title' ОБЯЗАТЕЛЬНО придумай уникальное, вдохновляющее и красивое название прогулки на русском языке (3-6 слов) исходя из остановок, форматов и конечной точки!
   Примеры отличных названий:
   - "Вкусный стритфуд и вечерний променад к ФОК Техас"
   - "Ароматный кофе сквозь зеленые аллеи"
   - "Архитектурные сокровища и видовые скверы"
   - "Живописный променад по бульвару к парку"
   Категорически ЗАПРЕЩЕНО писать сухие фразы вроде "Маршрут в выбранная точка финиша", "Маршрут в точку", "Прогулка 1"!
3. ТИП МАРШРУТА: ${routeTypeDesc}
4. ТОЛЬКО ИЗ СПИСКА: Выбирай строго id кандидатов из переданного списка.
5. Выбери РОВНО ${targetStopCount} лучших мест.
6. В 'ai_thought' (2-3 предложения) опиши логику прогулки.
7. В 'description' напиши приятный совет, чем полюбоваться или что взять.`;

  const userPrompt = `
Локация старта: ${start_lat.toFixed(4)}, ${start_lon.toFixed(4)}.
Выбранные форматы: ${formatNames}.
Формат трека: ${routeTypeDesc}.
Конечная точка: ${end_name || 'Не задана (кольцевой)'}.
Пожелание пользователя: "${custom_prompt || 'уютная неспешная прогулка, чтобы посидеть, перекусить и отдохнуть'}".
Количество остановок: ${targetStopCount}.

Список проверенных РЕАЛЬНЫХ кандидатов:
${JSON.stringify(simplifiedCandidates, null, 2)}

Верни СТРОГО валидный JSON следующего формата:
{
  "scenario_title": "Красивое образное название (3-6 слов)",
  "ai_thought": "Почему эти места подарят лучшие впечатления",
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
              const scTitle = parsed.scenario_title && !parsed.scenario_title.toLowerCase().includes('выбранная точка')
                ? parsed.scenario_title
                : '';
              return {
                scenario_title: scTitle,
                ai_thought: parsed.ai_thought || 'Маршрут гармонично сочетает выбранные вами места и красивые виды города.',
                stops: parsed.stops,
                model: `Google ${model}`,
              };
            }
          }
        }
      } catch {
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
        const scTitle = parsed.scenario_title && !parsed.scenario_title.toLowerCase().includes('выбранная точка')
          ? parsed.scenario_title
          : '';
        return {
          scenario_title: scTitle,
          ai_thought:
            parsed.ai_thought ||
            'Маршрут гармонично объединяет любимые форматы отдыха и комфортные пешеходные улицы.',
          stops: parsed.stops,
          model: 'StepByStep AI Engine',
        };
      }
    }
  } catch {
    // LLM fallback
  }

  return null;
}

/**
 * Построение пешеходного маршрута исключительно через Яндекс Карты (MultiRoute с routingMode: 'pedestrian').
 * Обеспечивает точный трек по реальным городским тротуарам, пешеходным переходам и аллеям.
 */
export async function buildYandexPedestrianRoute(
  coords: [number, number][] // [[lon, lat], ...]
): Promise<{ distanceMeters: number; walkingMinutes: number; geojson: any } | null> {
  if (typeof window === 'undefined' || !(window as any).ymaps) return null;
  const ymaps = (window as any).ymaps;

  return new Promise((resolve) => {
    ymaps.ready(() => {
      try {
        if (!ymaps.multiRouter?.MultiRoute) {
          resolve(null);
          return;
        }

        // Преобразование координат из [lon, lat] (GeoJSON) в [lat, lon] (Яндекс Карты)
        const refPoints = coords.map((c) => [c[1], c[0]]);

        const multiRoute = new ymaps.multiRouter.MultiRoute(
          {
            referencePoints: refPoints,
            params: {
              routingMode: 'pedestrian',
            },
          },
          {
            boundsAutoApply: false,
          }
        );

        const timeout = setTimeout(() => {
          resolve(null);
        }, 6000);

        multiRoute.model.events.add('requestsuccess', () => {
          clearTimeout(timeout);
          try {
            const activeRoute = multiRoute.getActiveRoute();
            if (!activeRoute) {
              resolve(null);
              return;
            }

            const distObj = activeRoute.properties.get('distance');
            const durObj = activeRoute.properties.get('duration');
            const distanceMeters = distObj ? Math.round(distObj.value) : 1000;
            const walkingMinutes = durObj
              ? Math.max(1, Math.round(durObj.value / 60))
              : Math.max(1, Math.round(distanceMeters / 75));

            const geoCoords: [number, number][] = [];
            const paths = activeRoute.getPaths();
            if (paths) {
              const pCount = typeof paths.getLength === 'function' ? paths.getLength() : (paths.length || 0);
              for (let i = 0; i < pCount; i++) {
                const path = typeof paths.get === 'function' ? paths.get(i) : paths[i];
                if (!path) continue;
                const segments = path.getSegments ? path.getSegments() : [];
                const sCount = typeof segments.getLength === 'function' ? segments.getLength() : (segments.length || 0);
                for (let j = 0; j < sCount; j++) {
                  const seg = typeof segments.get === 'function' ? segments.get(j) : segments[j];
                  if (!seg) continue;
                  const segPts = seg.geometry?.getCoordinates ? seg.geometry.getCoordinates() : null;
                  if (Array.isArray(segPts)) {
                    for (const pt of segPts) {
                      if (Array.isArray(pt) && pt.length >= 2) {
                        // Конвертация [lat, lon] в [lon, lat] для стандарта GeoJSON
                        geoCoords.push([pt[1], pt[0]]);
                      }
                    }
                  }
                }
              }
            }

            if (geoCoords.length > 0) {
              resolve({
                distanceMeters,
                walkingMinutes,
                geojson: {
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: geoCoords,
                  },
                },
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            console.warn('Error reading Yandex pedestrian route:', e);
            resolve(null);
          }
        });

        multiRoute.model.events.add('requestfail', (err: any) => {
          clearTimeout(timeout);
          console.warn('Yandex multiRoute requestfail:', err);
          resolve(null);
        });
      } catch (e) {
        console.warn('Yandex multiRoute init error:', e);
        resolve(null);
      }
    });
  });
}

/**
 * ГЛАВНЫЙ ГЕНЕРАТОР МАРШРУТА
 */
export async function generateRouteClientFallback(params: RouteRequest): Promise<RouteResponse> {
  const {
    start_lat,
    start_lon,
    duration_minutes,
    scenario,
    is_circular,
    start_time,
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

  const rawDist =
    end_lat !== undefined && end_lon !== undefined
      ? getDistance(start_lat, start_lon, end_lat, end_lon)
      : 0;

  // Если точка финиша не задана, либо совпадает со стартом (ближе 150м) — это ВСЕГДА кольцевой маршрут
  const isSamePoint = end_lat !== undefined && end_lon !== undefined && rawDist < 150;
  const effectiveIsCircular = is_circular || isSamePoint || end_lat === undefined || end_lon === undefined;
  const hasEndPoint = !effectiveIsCircular && end_lat !== undefined && end_lon !== undefined && !isSamePoint;
  const directDist = hasEndPoint ? rawDist : 0;

  // Комфортный компактный пешеходный радиус поиска под продолжительность прогулки
  let radius = 900;
  if (duration_minutes <= 35) radius = 700;
  else if (duration_minutes <= 55) radius = 950;
  else if (duration_minutes <= 85) radius = 1350;
  else if (duration_minutes <= 120) radius = 1850;
  else radius = 2500;

  if (hasEndPoint) {
    radius = Math.max(radius, Math.round(directDist * 0.65));
  }

  const targetStopCount = calculateStopCount(duration_minutes, stop_count);

  let searchCenterLat = start_lat;
  let searchCenterLon = start_lon;
  if (hasEndPoint && end_lat !== undefined && end_lon !== undefined) {
    searchCenterLat = (start_lat + end_lat) / 2;
    searchCenterLon = (start_lon + end_lon) / 2;
  }

  const acts = activities.length > 0 ? activities : [scenario || 'walk'];

  // Поиск реальных проверенных мест под выбранные форматы с учетом пожелания пользователя
  let realPlaces = await fetchRealPlacesAround(searchCenterLat, searchCenterLon, radius, acts, custom_prompt);

  let corridorCandidates: (RealPOICandidate & { t: number; lateralMeters: number; group: CategoryGroup })[] = [];

  if (hasEndPoint) {
    const maxLateralMeters = Math.min(450, Math.max(220, directDist * 0.35));

    for (const p of realPlaces) {
      const { t, lateralMeters } = getCorridorMetrics(start_lat, start_lon, end_lat, end_lon, p.lat, p.lon);

      // Строгий коридорный фильтр (без возвратов назад и без захода в глухие промзоны)
      if (t >= 0.04 && t <= 0.96 && lateralMeters <= maxLateralMeters) {
        corridorCandidates.push({
          ...p,
          t,
          lateralMeters,
          group: getCategoryGroup(p.cat),
        });
      }
    }

    corridorCandidates.sort((a, b) => a.t - b.t);
  }

  const parsedPois = hasEndPoint
    ? corridorCandidates
    : realPlaces.map((p) => ({
        ...p,
        t: 0,
        lateralMeters: 0,
        group: getCategoryGroup(p.cat),
      }));

  const poiMap = new Map(parsedPois.map((p) => [p.id, p]));
  let selectedStops: (RouteStop & { t?: number })[] = [];
  let aiThought: string | undefined;
  let customTitle: string | undefined;
  let usedModelName = 'StepByStep AI Engine';

  const walkingBudgetMin = Math.min(45, Math.max(12, Math.round(duration_minutes * 0.32)));
  const spentBudgetMin = duration_minutes - walkingBudgetMin;
  const defaultSpentPerStop = Math.max(12, Math.round(spentBudgetMin / Math.max(1, targetStopCount)));

  // Обязательные точки пользователя (если заданы)
  const customWaypointStops: (RouteStop & { t?: number })[] = (waypoints || []).map((w, idx) => {
    let tVal = 0;
    if (hasEndPoint) {
      tVal = getCorridorMetrics(start_lat, start_lon, end_lat, end_lon, w.lat, w.lon).t;
    }
    return {
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
      rating: undefined,
      reviews_count: undefined,
      opening_hours: 'Открыто для посещения',
      tags: ['Выбранная вами точка', 'Посетить по пути'],
      is_custom_waypoint: true,
      t: tVal,
    };
  });

  selectedStops.push(...customWaypointStops);

  // 2. Обращение к нейросети
  if (parsedPois.length > 0) {
    const llmPlan = await planRouteWithAI(
      start_lat,
      start_lon,
      duration_minutes,
      scenario,
      custom_prompt,
      acts,
      is_circular,
      hasEndPoint,
      end_name,
      targetStopCount,
      parsedPois,
      api_key
    );

    if (llmPlan && llmPlan.stops && llmPlan.stops.length > 0) {
      usedModelName = llmPlan.model;
      aiThought = llmPlan.ai_thought;
      if (llmPlan.scenario_title && llmPlan.scenario_title.length > 3) {
        customTitle = llmPlan.scenario_title;
      }

      for (const stop of llmPlan.stops) {
        if (selectedStops.length >= Math.max(targetStopCount, customWaypointStops.length)) break;
        const match = poiMap.get(stop.id);
        if (match && !selectedStops.some((s) => s.name.toLowerCase() === match.name.toLowerCase())) {
          const itemGroup = match.group;

          // Контроль дублирования еды (не делать несколько шаурмичных подряд, если не просили)
          const currentFastfoodCount = selectedStops.filter((s) => getCategoryGroup(s.category) === 'fastfood').length;
          const currentCoffeeCount = selectedStops.filter((s) => getCategoryGroup(s.category) === 'coffee').length;

          if (itemGroup === 'fastfood' && currentFastfoodCount >= 1 && !acts.includes('fastfood_multiple')) {
            continue;
          }
          if (itemGroup === 'coffee' && currentCoffeeCount >= 1 && !acts.includes('coffee_multiple')) {
            continue;
          }

          selectedStops.push({
            id: match.id,
            name: match.name,
            category: match.cat,
            lat: match.lat,
            lon: match.lon,
            spent_minutes: Math.max(12, stop.spent_minutes || defaultSpentPerStop),
            description: stop.description || `${match.name} (${match.cat}) — приятная остановка на маршруте.`,
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
            reviews: match.reviews || [],
            t: match.t,
          });
        }
      }
    }
  }

  // 3. ДОБОР ДО ТОЧНОГО КОЛИЧЕСТВА ОСТАНОВОК ПО ВЫБРАННЫМ ФОРМАТАМ
  if (selectedStops.length < targetStopCount) {
    const existingNames = new Set(selectedStops.map((s) => s.name.toLowerCase()));
    let remaining = parsedPois.filter((p) => !existingNames.has(p.name.toLowerCase()));

    // Ключевые слова из пользовательского пожелания в строке "Что хочется?"
    const promptKeywords = (custom_prompt || '')
      .toLowerCase()
      .split(/[\s,.;:!?]+/)
      .filter((w) => w.length >= 3 && !['хочу', 'очень', 'было', 'будет', 'надо', 'нужно', 'легкую', 'вкусный'].includes(w));

    const matchesPrompt = (item: { name: string; cat: string; tags?: string[] }) => {
      if (promptKeywords.length === 0) return false;
      const combined = `${item.name} ${item.cat} ${(item.tags || []).join(' ')}`.toLowerCase();
      return promptKeywords.some((kw) => combined.includes(kw));
    };

    // Приоритетные группы из выбранных форматов
    const desiredGroups: CategoryGroup[] = [];
    if (acts.includes('fastfood')) desiredGroups.push('fastfood');
    if (acts.includes('coffee')) desiredGroups.push('coffee');
    if (acts.includes('bakery')) desiredGroups.push('bakery');
    if (acts.includes('sweets')) desiredGroups.push('sweets');
    if (acts.includes('views') || acts.includes('walk')) desiredGroups.push('views');
    if (acts.includes('nature') || acts.includes('dog_walk') || acts.includes('quiet')) desiredGroups.push('nature');
    if (acts.includes('sights')) desiredGroups.push('sights');
    if (acts.includes('shopping')) desiredGroups.push('shopping');

    while (selectedStops.length < targetStopCount && remaining.length > 0) {
      let candidateIdx = -1;

      // 1. Сначала ищем места, напрямую упомянутые пользователем в строке "Что хочется?"
      if (promptKeywords.length > 0) {
        candidateIdx = remaining.findIndex((r) => matchesPrompt(r));
      }

      // 2. Затем ищем место из форматов, которые еще не представлены на маршруте
      if (candidateIdx === -1) {
        for (const dg of desiredGroups) {
          const hasGroup = selectedStops.some((s) => getCategoryGroup(s.category) === dg);
          if (!hasGroup) {
            candidateIdx = remaining.findIndex((r) => r.group === dg);
            if (candidateIdx !== -1) break;
          }
        }
      }

      // 3. Если все желаемые уже представлены, берем не-еду (чтобы не дублировать фастфуд/кофе)
      if (candidateIdx === -1) {
        candidateIdx = remaining.findIndex((r) => r.group !== 'fastfood' && r.group !== 'coffee');
      }

      if (candidateIdx === -1) {
        candidateIdx = 0;
      }

      const item = remaining.splice(candidateIdx, 1)[0];
      let desc = `${item.name} (${item.cat}) — приятное место для неспешного шага и отдыха.`;
      if (item.group === 'fastfood') {
        desc = `${item.name} — отличная остановка, чтобы взять любимый стритфуд (шаурму, бургер или пиццу) с собой.`;
      } else if (item.group === 'coffee') {
        desc = `${item.name} — уютная кофейня с ароматным кофе на вынос и свежими десертами.`;
      } else if (item.group === 'bakery') {
        desc = `${item.name} — теплая пекарня со свежей выпечкой и хрустящей выпечкой.`;
      } else if (item.group === 'views') {
        desc = `${item.name} — красивая панорамная зона с открытыми видами и широким тротуаром.`;
      } else if (item.group === 'nature') {
        desc = `${item.name} — живописная зеленая аллея со скамейками, где приятно пройтись вдали от шума.`;
      } else if (item.group === 'sights') {
        desc = `${item.name} — знаковое городское место с красивой архитектурой и историей.`;
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
        reviews: item.reviews || [],
        t: item.t,
      });
    }
  }

  // 4. ГЕОМЕТРИЧЕСКАЯ ОПТИМИЗАЦИЯ ПОРЯДКА ДВИЖЕНИЯ (только реальные проверенные места)
  let orderedStops: RouteStop[] = [];
  if (hasEndPoint && end_lat !== undefined && end_lon !== undefined) {
    orderedStops = orderCorridorStops(start_lat, start_lon, end_lat, end_lon, selectedStops);
  } else if (effectiveIsCircular) {
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

  // 5. Построение пешеходного трека через Яндекс Карты (MultiRoute pedestrian)
  const coords: [number, number][] = [[start_lon, start_lat]];
  for (const s of enrichedStops) {
    coords.push([s.lon, s.lat]);
  }
  if (hasEndPoint && end_lat !== undefined && end_lon !== undefined) {
    coords.push([end_lon, end_lat]);
  } else if (effectiveIsCircular) {
    coords.push([start_lon, start_lat]);
  }

  let geojson: any = null;
  let distanceMeters = Math.min(2600, Math.round(walkingBudgetMin * 60));
  let walkingMinutes = walkingBudgetMin;

  try {
    const yRouteResult = await buildYandexPedestrianRoute(coords);
    if (yRouteResult) {
      geojson = yRouteResult.geojson;
      distanceMeters = yRouteResult.distanceMeters;
      walkingMinutes = yRouteResult.walkingMinutes;
    }
  } catch (e) {
    console.warn('Yandex pedestrian route calculation error:', e);
  }

  // Резервный пешеходный трек по тротуарам (OSRM foot) если Яндекс MultiRoute недоступен, чтобы трек НИКОГДА не шел сквозь дома
  if (!geojson) {
    try {
      const coordsStr = coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(';');
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(
        `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`,
        { signal: controller.signal }
      );
      clearTimeout(tId);
      if (resp.ok) {
        const data = await resp.json();
        if (data.routes && data.routes.length > 0) {
          const r = data.routes[0];
          distanceMeters = Math.round(r.distance);
          walkingMinutes = Math.max(1, Math.round(r.duration / 60));
          geojson = {
            type: 'Feature',
            geometry: r.geometry,
          };
        }
      }
    } catch {}
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

  // 7. Расчет реального времени старта и прибытия
  let routeStartDate = new Date();
  if (target_arrival_time && !start_time) {
    const [ah, am] = target_arrival_time.split(':').map(Number);
    if (!isNaN(ah) && !isNaN(am)) {
      routeStartDate = new Date();
      routeStartDate.setHours(ah, am, 0, 0);
      routeStartDate = new Date(routeStartDate.getTime() - totalRouteMinutes * 60000);
      if (routeStartDate.getTime() < Date.now() - 30 * 60000) {
        routeStartDate.setDate(routeStartDate.getDate() + 1);
      }
    }
  } else if (start_time) {
    const [sh, sm] = start_time.split(':').map(Number);
    if (!isNaN(sh) && !isNaN(sm)) {
      routeStartDate = new Date();
      routeStartDate.setHours(sh, sm, 0, 0);
      if (routeStartDate.getTime() < Date.now() - 30 * 60000) {
        routeStartDate.setDate(routeStartDate.getDate() + 1);
      }
    }
  }

  const timeline = calculateRouteTimeline(routeStartDate, enrichedStops, walkingMinutes, effectiveIsCircular, hasEndPoint);
  enrichedStops = timeline.stops;

  // Умное название маршрута (никогда не пишет "маршрут в выбранная точка финиша")
  const scTitle =
    customTitle && !customTitle.toLowerCase().includes('выбранная точка')
      ? customTitle
      : generateSmartRouteTitle(scenario, acts, enrichedStops, end_name, custom_prompt);

  if (!aiThought) {
    aiThought = hasEndPoint
      ? `Прямой комфортный маршрут вперед к цели: посещение выбранных заведений, прогулка по широким оживленным бульварам и видовые точки города.`
      : `Сбалансированная круговая прогулка на ${duration_minutes} мин.: комфортные пешеходные улицы, парковые зоны и приятный отдых без лишней спешки.`;
  }

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
    is_circular: effectiveIsCircular,
    start_time: timeline.start_time,
    arrival_time: target_arrival_time || timeline.arrival_time,
    end_point:
      hasEndPoint && end_lat !== undefined && end_lon !== undefined
        ? {
            lat: end_lat,
            lon: end_lon,
            name: end_name && !end_name.toLowerCase().includes('выбранная точка') && end_name.toLowerCase() !== 'конечный пункт' ? end_name : 'Точка финиша',
            address: end_address,
          }
        : undefined,
    notes: `Маршрут из ${enrichedStops.length} остановок. Шаг: ${walkingMinutes} мин (${(distanceMeters / 1000).toFixed(
      1
    )} км). Отдых: ${totalSpent} мин. Прибытие: ~${target_arrival_time || timeline.arrival_time}.`,
  };
}
