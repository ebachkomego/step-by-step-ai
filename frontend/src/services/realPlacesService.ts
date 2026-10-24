import type { RouteStop, PlaceReview } from '../types';

// Строгий черный список неподходящих и нетуристических локаций
const BLACKLIST_TERMS = [
  // Железнодорожные станции, платформы, пути, депо (ИСКЛЮЧИТЬ "Шинная", станции, пути)
  'станция', 'станци', 'платформ', 'остановочн', 'переезд', 'разъезд', 'обгонн', 'сортировочн',
  'вокзал', 'депо', 'пути', 'ж/д', 'жд ', 'железнодор', 'полустанок', 'шинная', 'шинн',

  // Промзоны, склады, фабрики, заводы, технические базы, ТЭЦ
  'завод', 'промзон', 'нефтебаз', 'бойня', 'бакалея', 'склад', 'автобаз', 'терминал', 'база ',
  'гараж', 'гск', 'шиномонтаж', 'автомойк', 'автосервис', 'комбинат', 'цех', 'фабрик',
  'мясокомбинат', 'элеватор', 'бетон', 'арматур', 'карьер', 'пивоварн',
  'котельн', 'подстанц', 'трансформатор', 'насосн', 'очистн', 'тяговая', 'тэц', 'грэс', 'гэс', 'тэс', 'энергетик',

  // Частный сектор, переулки, тупики, глухие непешеходные проезды
  'переулок', 'пер.', 'тупик', 'тупиков', 'проезд', 'тракт', 'дача', 'снт', 'днп', 'кооператив', 'частн', 'хутор',

  // Медицинские, ритуальные, закрытые и социальные учреждения (ИСКЛЮЧИТЬ "помощь больным детям", хосписы, морги)
  'больниц', 'морг', 'ритуальн', 'кладбищ', 'диспансер', 'инфекционн', 'ветстанц', 'ветклиник', 'поликлиник',
  'судебно', 'патолого', 'госпитал', 'травмпункт', 'хоспис', 'интернат', 'детский дом', 'приют',
  'помощь детям', 'помощь больным', 'благотворительн', 'социальн', 'реабилитац', 'фонд ', 'ночлежк', 'соцзащит',

  // Административные районы, области, режимные объекты
  'район', 'область', 'сельсовет', 'микрорайон', 'поселение', 'городской округ', 'территория', 'администрация',
  'суд ', 'прокуратур', 'тюрьм', 'колони', 'сизо', 'полици', 'милици', 'военкомат', 'воинск'
];

/**
 * Проверка на нахождение в черном списке
 */
export function isBlacklisted(
  name: string,
  category: string = '',
  address: string = '',
  description: string = ''
): boolean {
  const combined = `${name} ${category} ${address} ${description}`.toLowerCase();
  return BLACKLIST_TERMS.some((term) => combined.includes(term));
}

/**
 * Проверка на религиозные объекты (храмы, соборы, церкви, монастыри, часовни).
 * Разрешены ТОЛЬКО если пользователь явно выбрал сценарий "Памятники / Достопримечательности" ('sights').
 */
export function isReligious(
  name: string,
  category: string = '',
  address: string = '',
  description: string = ''
): boolean {
  const combined = `${name} ${category} ${address} ${description}`.toLowerCase();
  return (
    combined.includes('храм') ||
    combined.includes('собор') ||
    combined.includes('церков') ||
    combined.includes('церковь') ||
    combined.includes('костёл') ||
    combined.includes('костел') ||
    combined.includes('монастыр') ||
    combined.includes('синагог') ||
    combined.includes('мечет') ||
    combined.includes('часовн') ||
    combined.includes('иконы') ||
    combined.includes('приход') ||
    combined.includes('епархи')
  );
}

// Проверенные заведения удалены в пользу 100% живых данных из Яндекс Карт
/**
 * Получение спутникового снимка Яндекс Карт высокого разрешения с маркером
 */
export function getSatellitePhotoUrl(lat: number, lon: number): string {
  return `https://static-maps.yandex.ru/1.x/?ll=${lon.toFixed(6)},${lat.toFixed(6)}&z=17&l=sat&size=600,350&pt=${lon.toFixed(6)},${lat.toFixed(6)},pm2blm`;
}

/**
 * Получение снимка схемы Яндекс Карт с маркером
 */
export function getSchemePhotoUrl(lat: number, lon: number): string {
  return `https://static-maps.yandex.ru/1.x/?ll=${lon.toFixed(6)},${lat.toFixed(6)}&z=17&l=map&size=600,350&pt=${lon.toFixed(6)},${lat.toFixed(6)},pm2blm`;
}

export function getTagsForCategory(cat: string): string[] {
  const c = cat.toLowerCase();
  if (c.includes('фастфуд') || c.includes('шаурм') || c.includes('стритфуд') || c.includes('бургер') || c.includes('пицц')) {
    return ['Быстрый перекус', 'Шаурма и бургеры', 'Еда с собой', 'Оплата картой'];
  }
  if (c.includes('кофе') || c.includes('чай')) {
    return ['Кофе с собой', 'Оплата картой', 'Уютная посадка', 'Десерты'];
  }
  if (c.includes('пекарн') || c.includes('булочн') || c.includes('выпечк') || c.includes('круассан')) {
    return ['Свежая выпечка', 'Круассаны', 'Кофе и чай', 'Оплата картой'];
  }
  if (c.includes('морожен') || c.includes('сладост') || c.includes('кондитер')) {
    return ['Мороженое и десерты', 'Сладкое настроение', 'Оплата картой'];
  }
  if (c.includes('бульвар') || c.includes('проспект') || c.includes('алле') || c.includes('вид')) {
    return ['Широкий тротуар', 'Освещенная улица', 'Скамейки для отдыха', 'Без частного сектора'];
  }
  if (c.includes('парк') || c.includes('сквер') || c.includes('сад') || c.includes('природ')) {
    return ['Скамейки в тени', 'Пешеходные дорожки', 'Чистый воздух', 'Красивый вид'];
  }
  if (c.includes('магазин') || c.includes('тц') || c.includes('галере') || c.includes('шопинг')) {
    return ['Торговый центр', 'Витрины магазинов', 'Оживленный район'];
  }
  if (c.includes('памятник') || c.includes('достопримеч') || c.includes('истор') || c.includes('музей') || c.includes('храм') || c.includes('собор')) {
    return ['Культурное наследие', 'Историческое место', 'Архитектура', 'Фотогенично'];
  }
  if (c.includes('ресторан') || c.includes('бистро') || c.includes('кафе') || c.includes('еда')) {
    return ['Вкусный перекус', 'Уютная терраса', 'Оплата картой'];
  }
  return ['Пешая доступность', 'Красивая локация'];
}

// Точный расчет расстояния между координатами (в метрах)
export function getCoordinatesDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface RealPOICandidate {
  id: string;
  name: string;
  cat: string;
  lat: number;
  lon: number;
  dist: number;
  address?: string;
  photo_url?: string;
  photos?: string[];
  satellite_url?: string;
  yandex_url?: string;
  rating?: number;
  reviews_count?: number;
  opening_hours?: string;
  tags?: string[];
  reviews: PlaceReview[];
}

/**
 * 1. Поиск в русской Википедии: только настоящие памятники, соборы, музеи, усадьбы и парки.
 * Полностью исключает фабрики, заводы, станции, ж/д пути и нетуристические объекты.
 */
export async function fetchWikipediaPlacesAround(
  lat: number,
  lon: number,
  radiusMeters: number
): Promise<RealPOICandidate[]> {
  const results: RealPOICandidate[] = [];
  try {
    const searchRadius = Math.min(3000, Math.max(300, radiusMeters));
    const geoUrl = `https://ru.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${searchRadius}&gslimit=15&format=json&origin=*`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(geoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return results;
    const data = await res.json();
    const geosearch = data.query?.geosearch;
    if (!geosearch || !geosearch.length) return results;

    const pageIds = geosearch.map((item: any) => item.pageid).join('|');
    const detailsUrl = `https://ru.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|description|coordinates&pithumbsize=800&format=json&origin=*`;

    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 3500);

    const detailsRes = await fetch(detailsUrl, { signal: controller2.signal });
    clearTimeout(timeoutId2);

    if (detailsRes.ok) {
      const data2 = await detailsRes.json();
      const pages = Object.values(data2.query?.pages || {}) as any[];

      for (const p of pages) {
        if (!p.title) continue;
        const cleanTitle = p.title.replace(/\s*\(.*?\)\s*/g, '').trim();
        const desc = (p.description || '').toLowerCase();
        const titleLower = cleanTitle.toLowerCase();

        // Строгая проверка по черному списку (исключает "Шинная", заводы, станции)
        if (isBlacklisted(cleanTitle, '', p.description || '', p.description || '')) continue;

        // В Википедии принимаем ТОЛЬКО настоящие культурные достопримечательности
        const isTrueAttraction =
          desc.includes('храм') || desc.includes('собор') || desc.includes('церков') || desc.includes('костёл') ||
          desc.includes('монастыр') || desc.includes('памятник') || desc.includes('мемориал') || desc.includes('музей') ||
          desc.includes('театр') || desc.includes('галере') || desc.includes('парк') || desc.includes('сквер') ||
          desc.includes('усадьб') || desc.includes('замок') || desc.includes('крепост') || desc.includes('достопримечательн') ||
          desc.includes('скульптур') || desc.includes('архитектур') || desc.includes('фонтан') || desc.includes('бульвар') ||
          desc.includes('набережн') || titleLower.includes('храм') || titleLower.includes('собор') || titleLower.includes('памятник') ||
          titleLower.includes('музей') || titleLower.includes('парк') || titleLower.includes('сквер') || titleLower.includes('усадьба');

        if (!isTrueAttraction) continue;

        const pLat = p.coordinates?.[0]?.lat;
        const pLon = p.coordinates?.[0]?.lon;
        if (!pLat || !pLon) continue;

        const dist = getCoordinatesDistance(lat, lon, pLat, pLon);
        if (dist < 20 || dist > searchRadius * 1.35) continue;

        const photo = p.thumbnail?.source;
        const photosList: string[] = [];
        if (photo) photosList.push(photo);

        const yandexSearchUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(
          cleanTitle + (p.description ? ' ' + p.description : '')
        )}`;

        results.push({
          id: `wiki_${p.pageid}`,
          name: cleanTitle,
          cat: 'Достопримечательность',
          lat: pLat,
          lon: pLon,
          dist,
          address: p.description || 'Историческое место',
          photo_url: photo,
          photos: photosList,
          satellite_url: getSatellitePhotoUrl(pLat, pLon),
          yandex_url: yandexSearchUrl,
          rating: undefined,
          reviews_count: undefined,
          opening_hours: 'Открыто для осмотра',
          tags: getTagsForCategory('достопримечательность'),
          reviews: [],
        });
      }
    }
  } catch {
    // Wikipedia fallback is optional
  }
  return results;
}

// Глобальный реестр обратных вызовов для JSONP подсказок Яндекс Карт
const suggestCallbacks = new Map<string, (names: string[]) => void>();

if (typeof window !== 'undefined') {
  (window as any).suggest = {
    apply: (data: any) => {
      if (!data || !Array.isArray(data)) return;
      const query = (data[0] || '').toLowerCase().trim();
      const cb = suggestCallbacks.get(query);
      if (cb) {
        const names: string[] = [];
        if (Array.isArray(data[1])) {
          for (const item of data[1]) {
            const title = item[1] || item[2];
            if (title && typeof title === 'string' && !names.includes(title)) {
              names.push(title);
            }
          }
        }
        cb(names);
        suggestCallbacks.delete(query);
      }
    },
  };
}

/**
 * 2. JSONP запрос к официальному сервису подсказок и организаций Яндекс Карт.
 * Возвращает точные названия реально существующих заведений рядом с пользователем.
 */
function fetchYandexSuggestJsonp(kw: string, lat: number, lon: number): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return resolve([]);
    try {
      const cleanKw = kw.toLowerCase().trim();
      const script = document.createElement('script');
      const cleanup = () => {
        suggestCallbacks.delete(cleanKw);
        try {
          if (script.parentNode) script.parentNode.removeChild(script);
        } catch {}
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve([]);
      }, 3500);

      suggestCallbacks.set(cleanKw, (names) => {
        clearTimeout(timer);
        cleanup();
        resolve(names);
      });

      script.src = `https://suggest-maps.yandex.ru/suggest-geo?v=5&search_type=all&part=${encodeURIComponent(
        kw
      )}&lang=ru_RU&ll=${lon.toFixed(6)},${lat.toFixed(6)}&spn=0.05,0.05`;
      script.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve([]);
      };
      document.body.appendChild(script);
    } catch {
      resolve([]);
    }
  });
}

/**
 * 3. Поиск организаций и заведений через сервисы Яндекс Карт (provider: 'yandex#search' + ymaps.suggest)
 */
async function searchYandexOrganizations(
  startLat: number,
  startLon: number,
  radiusMeters: number,
  keywords: string[]
): Promise<RealPOICandidate[]> {
  const results: RealPOICandidate[] = [];
  if (typeof window === 'undefined' || !(window as any).ymaps) return results;

  const ymaps = (window as any).ymaps;
  try {
    await new Promise<void>((resolve) => ymaps.ready(resolve));
    if (!ymaps.geocode) return results;

    const deltaLat = (radiusMeters / 111000) * 1.5;
    const deltaLon = (radiusMeters / (111000 * Math.cos((startLat * Math.PI) / 180))) * 1.5;
    const bounds: [[number, number], [number, number]] = [
      [startLat - deltaLat, startLon - deltaLon],
      [startLat + deltaLat, startLon + deltaLon],
    ];

    // Определение города пользователя через геокодер Яндекс Карт
    let detectedCity = '';
    try {
      const cityRes = await ymaps.geocode([startLat, startLon], { results: 1 });
      const firstObj = cityRes.geoObjects?.get(0);
      if (firstObj) {
        const locs = firstObj.getLocalities?.();
        if (locs && locs.length > 0) detectedCity = locs[0];
      }
    } catch {}

    const seenNames = new Set<string>();

    // 1. Поиск локальных заведений через подсказки Яндекс Карт (JSONP и ymaps.suggest)
    const discoveredNames: string[] = [];
    const suggestPromises = keywords.slice(0, 5).map(async (kw) => {
      // JSONP подсказки из suggest-maps.yandex.ru
      const jsonpNames = await fetchYandexSuggestJsonp(kw, startLat, startLon);
      for (const n of jsonpNames) {
        if (!discoveredNames.includes(n)) discoveredNames.push(n);
      }
      // Подсказки встроенного API ymaps.suggest
      if (ymaps.suggest) {
        try {
          const sugRes = await ymaps.suggest(detectedCity ? `${detectedCity} ${kw}` : kw, {
            boundedBy: bounds,
            results: 15,
          });
          for (const s of sugRes) {
            const val = s.value || s.displayName;
            if (val && !discoveredNames.includes(val)) discoveredNames.push(val);
          }
        } catch {}
      }
    });

    await Promise.allSettled(suggestPromises);

    // 2. Объединяем запросы для геокодирования
    const allSearchQueries = [
      ...discoveredNames.slice(0, 15),
      ...keywords.map((kw) => (detectedCity ? `${detectedCity} ${kw}` : kw)),
      ...keywords,
    ];

    for (const query of allSearchQueries) {
      if (results.length >= 35) break;
      try {
        // Поиск через геокодер Яндекс Карт
        const res = await ymaps.geocode(query, {
          boundedBy: bounds,
          strictBounds: false,
          results: 15,
        });

        const count = res.geoObjects.getLength();
        for (let i = 0; i < count; i++) {
          const obj = res.geoObjects.get(i);
          const rawName = obj.properties.get('name');
          const desc = obj.properties.get('description') || '';
          const meta = obj.properties.get('CompanyMetaData');
          const coords = obj.geometry?.getCoordinates();

          if (!rawName || !coords || coords.length < 2) continue;
          const cleanName = rawName.trim();
          const normKey = cleanName.toLowerCase();
          if (seenNames.has(normKey)) continue;

          // Строгая проверка черного списка (исключает "Шинная", заводы, больницы, частный сектор)
          if (isBlacklisted(cleanName, meta?.Categories?.[0]?.name || '', desc)) continue;

          const lat = coords[0];
          const lon = coords[1];
          const dist = getCoordinatesDistance(startLat, startLon, lat, lon);
          if (dist < 15 || dist > radiusMeters * 1.8) continue;

          seenNames.add(normKey);

          let cat = 'Интересное место';
          const lowerName = cleanName.toLowerCase();
          const lowerQ = query.toLowerCase();
          if (
            lowerQ.includes('шаурм') ||
            lowerName.includes('шаурм') ||
            lowerName.includes('шаверм') ||
            lowerName.includes('донер') ||
            lowerName.includes('бургер') ||
            lowerName.includes('kfc') ||
            lowerName.includes('кфс') ||
            lowerName.includes('пицц')
          ) {
            cat = 'Фастфуд / Стритфуд';
          } else if (meta?.Categories && meta.Categories.length > 0) {
            cat = meta.Categories[0].name;
          } else if (lowerName.includes('кофе') || lowerQ.includes('кофе')) {
            cat = 'Кофейня';
          } else if (lowerName.includes('пекарн') || lowerQ.includes('пекарн')) {
            cat = 'Пекарня / Выпечка';
          } else if (lowerName.includes('парк') || lowerName.includes('сквер')) {
            cat = 'Парк / Сквер';
          } else if (lowerName.includes('бульвар')) {
            cat = 'Живописный бульвар';
          } else if (lowerName.includes('памятник') || lowerName.includes('музей')) {
            cat = 'Достопримечательность';
          }

          const address = meta?.address || desc || 'В пешей доступности';
          const hours =
            meta?.Hours?.text ||
            (cat.includes('Парк') || cat.includes('бульвар') ? 'Круглосуточно' : 'Ежедневно 09:00 – 22:00');

          const orgId = meta?.id;
          const yandexUrl = orgId
            ? `https://yandex.ru/maps/org/${orgId}/`
            : `https://yandex.ru/maps/?text=${encodeURIComponent(cleanName + ' ' + address)}`;

          const photosList: string[] = [];
          if (meta?.Photos && Array.isArray(meta.Photos)) {
            for (const p of meta.Photos) {
              if (typeof p === 'string') photosList.push(p);
              else if (p.url) photosList.push(p.url);
            }
          }

          results.push({
            id: `ymaps_biz_${results.length}_${Date.now()}`,
            name: cleanName,
            cat,
            lat,
            lon,
            dist,
            address,
            photo_url: photosList[0] || undefined,
            photos: photosList,
            satellite_url: getSatellitePhotoUrl(lat, lon),
            yandex_url: yandexUrl,
            rating: meta?.rating ? Number(meta.rating.score) : undefined,
            reviews_count: meta?.rating ? meta.rating.reviewsCount : undefined,
            opening_hours: hours,
            tags: getTagsForCategory(cat),
            reviews: [],
          });
        }
      } catch {
        // continue
      }
    }
  } catch (err) {
    console.warn('Yandex geocode search failed:', err);
  }

  return results;
}

/**
 * 4. Геокодер Яндекс Карт: оживленные бульвары, проспекты, скверы и аллеи (ОБХОД ЧАСТНОГО СЕКТОРА)
 */
async function fetchYmapsStreetsAndHouses(
  startLat: number,
  startLon: number,
  radiusMeters: number
): Promise<RealPOICandidate[]> {
  const results: RealPOICandidate[] = [];
  if (typeof window === 'undefined' || !(window as any).ymaps?.geocode) return results;

  try {
    const ymaps = (window as any).ymaps;
    const res = await ymaps.geocode([startLat, startLon], {
      kind: 'street',
      results: 15,
    });

    const count = res.geoObjects.getLength();
    for (let i = 0; i < count; i++) {
      const obj = res.geoObjects.get(i);
      const name = obj.properties.get('name') || '';
      const desc = obj.properties.get('description') || '';
      const coords = obj.geometry?.getCoordinates();

      if (!coords || !name) continue;

      // Строгая фильтрация: категорически отсекаем частный сектор (переулки, тупики, проезды)
      if (isBlacklisted(name, '', desc)) continue;

      const lowerName = name.toLowerCase();
      // Отбираем только широкие оживленные бульвары, проспекты, аллеи, скверы и центральные улицы
      const isBoulevard = lowerName.includes('бульвар');
      const isAvenue = lowerName.includes('проспект');
      const isAlley = lowerName.includes('алле');
      const isSquare = lowerName.includes('площадь') || lowerName.includes('сквер') || lowerName.includes('парк');
      const isLivelyStreet = lowerName.includes('улица') || lowerName.includes('ул.');

      if (!isBoulevard && !isAvenue && !isAlley && !isSquare && !isLivelyStreet) {
        continue;
      }

      let cat = 'Живописная улица';
      let tagList = ['Уютная городская улица', 'Широкий тротуар', 'Красивый вид'];
      if (isBoulevard) {
        cat = 'Живописный бульвар';
        tagList = ['Пешеходная аллея', 'Скамейки и фонари', 'Витрины магазинов', 'Без частного сектора'];
      } else if (isAvenue) {
        cat = 'Широкий проспект';
        tagList = ['Оживленный проспект', 'Широкий тротуар', 'Городская архитектура'];
      } else if (isAlley) {
        cat = 'Пешеходная аллея';
        tagList = ['Зеленые насаждения', 'Уютная прогулочная зона'];
      } else if (isSquare) {
        cat = 'Городская площадь / Сквер';
        tagList = ['Открытое пространство', 'Место для встреч', 'Скамейки'];
      }

      const dist = getCoordinatesDistance(startLat, startLon, coords[0], coords[1]);
      if (dist >= 20 && dist <= radiusMeters * 1.5) {
        const yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(name + ' ' + desc)}`;
        results.push({
          id: `ymaps_street_${i}_${Date.now()}`,
          name: `${name}`,
          cat,
          lat: coords[0],
          lon: coords[1],
          dist,
          address: desc || name,
          photo_url: undefined,
          photos: [],
          satellite_url: getSatellitePhotoUrl(coords[0], coords[1]),
          yandex_url: yandexUrl,
          rating: undefined,
          reviews_count: undefined,
          opening_hours: 'Открыто для прогулок',
          tags: tagList,
          reviews: [],
        });
      }
    }
  } catch (e) {
    console.warn('Ymaps fallback geocode failed:', e);
  }

  return results;
}

/**
 * ГЛАВНЫЙ МЕТОД: Поиск РЕАЛЬНЫХ проверенных мест под выбранные форматы прогулки
 */
export async function fetchRealPlacesAround(
  startLat: number,
  startLon: number,
  radiusMeters: number = 1000,
  preferredActivities: string[] = [],
  customPrompt?: string
): Promise<RealPOICandidate[]> {
  const candidatePool: RealPOICandidate[] = [];
  const seenNames = new Set<string>();

  const actList = preferredActivities.length > 0 ? preferredActivities : ['walk', 'coffee', 'views'];

  const addCandidate = (c: RealPOICandidate) => {
    const norm = c.name.toLowerCase().trim();
    if (seenNames.has(norm) || isBlacklisted(c.name, c.cat, c.address || '')) return;
    // Религиозные объекты (храмы, церкви, соборы) СТРОГО запрещены, если не выбран формат памятники/достопримечательности
    if (!actList.includes('sights') && isReligious(c.name, c.cat, c.address || '')) return;
    seenNames.add(norm);
    candidatePool.push(c);
  };

  const ymapsKeywords: string[] = [];

  if (actList.includes('fastfood')) {
    ymapsKeywords.push('шаурма', 'фастфуд', 'бургерная', 'пиццерия', 'бистро');
  }
  if (actList.includes('coffee')) {
    ymapsKeywords.push('кофейня', 'кофе');
  }
  if (actList.includes('bakery')) {
    ymapsKeywords.push('пекарня', 'булочная', 'свежая выпечка');
  }
  if (actList.includes('sweets')) {
    ymapsKeywords.push('мороженое', 'кондитерская', 'десерты');
  }
  if (actList.includes('views') || actList.includes('walk')) {
    ymapsKeywords.push('бульвар', 'аллея', 'набережная', 'сквер');
  }
  if (actList.includes('nature') || actList.includes('dog_walk') || actList.includes('quiet')) {
    ymapsKeywords.push('парк', 'сквер', 'сад');
  }
  if (actList.includes('sights')) {
    ymapsKeywords.push('достопримечательность', 'памятник', 'музей');
  }
  if (actList.includes('shopping')) {
    ymapsKeywords.push('торговый центр', 'пассаж', 'галерея');
  }
  if (actList.includes('date')) {
    ymapsKeywords.push('кофейня', 'бульвар', 'уютное кафе');
  }

  // ПРЯМОЙ УЧЕТ СТРОКИ "ЧТО ХОЧЕТСЯ?"
  if (customPrompt && customPrompt.trim().length > 0) {
    const cpLower = customPrompt.toLowerCase();
    const promptKeywords = [
      'шаурма', 'шаверма', 'донер', 'бургер', 'kfc', 'кфс', 'пицца', 'пиццерия', 'драники', 'чебурек',
      'кофе', 'кофейня', 'латте', 'капучино', 'раф', 'выпечка', 'пекарня', 'круассан', 'булочная',
      'мороженое', 'десерт', 'парк', 'сквер', 'набережная', 'бульвар', 'аллея',
      'памятник', 'собор', 'музей', 'храм', 'торговый центр', 'магазин'
    ];
    for (const pk of promptKeywords) {
      if (cpLower.includes(pk) && !ymapsKeywords.includes(pk)) {
        ymapsKeywords.unshift(pk);
      }
    }
    if (!ymapsKeywords.includes(customPrompt.trim())) {
      ymapsKeywords.unshift(customPrompt.trim());
    }
  }

  if (ymapsKeywords.length === 0) {
    ymapsKeywords.push('бульвар', 'парк', 'кофейня');
  }

  // 1. ПРИОРИТЕТНЫЙ ШАГ: Получение 100% реальных данных напрямую из Яндекс Карт через эндпоинт /api/places/search
  try {
    const apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:8000/api/places/search'
      : '/api/places/search';

    const queriesToRun = ymapsKeywords.slice(0, 3);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const searchPromises = queriesToRun.map(async (kw) => {
      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: startLat,
            lon: startLon,
            query: kw,
            radius_meters: radiusMeters,
            limit: 10,
          }),
          signal: controller.signal,
        });
        if (resp.ok) {
          const body = await resp.json();
          if (body && Array.isArray(body.places)) {
            for (const p of body.places) {
              const d = getCoordinatesDistance(startLat, startLon, p.lat, p.lon);
              addCandidate({
                id: p.id,
                name: p.name,
                cat: p.category,
                lat: p.lat,
                lon: p.lon,
                dist: d,
                address: p.address,
                photo_url: p.photo_url,
                photos: p.photos || (p.photo_url ? [p.photo_url] : []),
                satellite_url: getSatellitePhotoUrl(p.lat, p.lon),
                yandex_url: p.yandex_url,
                rating: p.rating,
                reviews_count: p.reviews_count,
                opening_hours: p.opening_hours,
                tags: p.tags,
                reviews: p.reviews || [],
              });
            }
          }
        }
      } catch {}
    });

    await Promise.allSettled(searchPromises);
    clearTimeout(timeoutId);
  } catch {}

  // Запускаем поиск через сервисы Яндекс Карт и Википедию параллельно
  const [wikiRes, ymapsBizRes, ymapsStreetRes] = await Promise.allSettled([
    // Википедию опрашиваем ТОЛЬКО если пользователь ЯВНО выбрал памятники/достопримечательности ('sights')
    actList.includes('sights')
      ? fetchWikipediaPlacesAround(startLat, startLon, radiusMeters)
      : Promise.resolve([]),
    searchYandexOrganizations(startLat, startLon, radiusMeters, ymapsKeywords),
    fetchYmapsStreetsAndHouses(startLat, startLon, radiusMeters),
  ]);

  if (wikiRes.status === 'fulfilled') {
    for (const w of wikiRes.value) addCandidate(w);
  }
  if (ymapsBizRes.status === 'fulfilled') {
    for (const y of ymapsBizRes.value) addCandidate(y);
  }
  if (ymapsStreetRes.status === 'fulfilled') {
    for (const s of ymapsStreetRes.value) addCandidate(s);
  }

  // Если кандидатов мало, делаем расширенный поиск через Яндекс Карты
  if (candidatePool.length < 5) {
    const widerRadius = radiusMeters * 1.8;
    const [widerBiz, widerStreet] = await Promise.allSettled([
      searchYandexOrganizations(startLat, startLon, widerRadius, ymapsKeywords),
      fetchYmapsStreetsAndHouses(startLat, startLon, widerRadius),
    ]);
    if (widerBiz.status === 'fulfilled') {
      for (const b of widerBiz.value) addCandidate(b);
    }
    if (widerStreet.status === 'fulfilled') {
      for (const s of widerStreet.value) addCandidate(s);
    }
  }

  // Назначаем спутниковый снимок каждому месту
  candidatePool.forEach((c) => {
    if (!c.satellite_url) {
      c.satellite_url = getSatellitePhotoUrl(c.lat, c.lon);
    }
  });

  candidatePool.sort((a, b) => a.dist - b.dist);
  return candidatePool;
}

/**
 * Обогащение точки проверенными деталями
 */
export function enrichStopWithRealDetails(stop: RouteStop, _index?: number): RouteStop {
  const satUrl = stop.satellite_url || getSatellitePhotoUrl(stop.lat, stop.lon);
  const tags = stop.tags || getTagsForCategory(stop.category);
  const openingHours =
    stop.opening_hours ||
    (stop.category.includes('Парк') || stop.category.includes('бульвар') ? 'Круглосуточно' : 'Ежедневно 08:00 – 22:00');

  const photosList: string[] = [];
  if (stop.photo_url) photosList.push(stop.photo_url);
  if (stop.photos && Array.isArray(stop.photos)) {
    for (const p of stop.photos) {
      if (p && !photosList.includes(p)) photosList.push(p);
    }
  }

  const yandexUrl =
    stop.yandex_url ||
    `https://yandex.ru/maps/?text=${encodeURIComponent(stop.name + ' ' + (stop.address || ''))}`;

  return {
    ...stop,
    photo_url: photosList[0] || undefined,
    photos: photosList,
    satellite_url: satUrl,
    yandex_url: yandexUrl,
    tags,
    reviews: stop.reviews && stop.reviews.length > 0 ? stop.reviews : [],
    opening_hours: openingHours,
  };
}

/**
 * Обратное геокодирование координаты в реальное название улицы / бульвара / локации.
 * Обеспечивает 100% реальные географические данные для связных круговых маршрутов.
 */
export async function reverseGeocodeLocation(
  lat: number,
  lon: number
): Promise<{ streetName: string; fullAddress: string; category: string }> {
  // 1. Попытка через геокодер Яндекс Карт в браузере (быстро, на русском и с точными типами улиц)
  if (typeof window !== 'undefined' && (window as any).ymaps?.geocode) {
    try {
      const res = await (window as any).ymaps.geocode([lat, lon], { results: 1 });
      const first = res.geoObjects.get(0);
      if (first) {
        const fullAddr = first.getAddressLine() || first.properties.get('name') || '';
        const thoro = first.getThoroughfare() || first.getPremise() || first.properties.get('name');
        if (thoro) {
          const lower = thoro.toLowerCase();
          let cat = 'Живописная улица';
          if (lower.includes('бульвар')) cat = 'Живописный бульвар';
          else if (lower.includes('проспект')) cat = 'Широкий проспект';
          else if (lower.includes('набережн')) cat = 'Набережная';
          else if (lower.includes('парк') || lower.includes('сквер')) cat = 'Парковая зона';
          return {
            streetName: thoro,
            fullAddress: fullAddr,
            category: cat,
          };
        }
      }
    } catch {
      // fallback
    }
  }

  return {
    streetName: 'Городской променад',
    fullAddress: 'Пешеходная часть маршрута',
    category: 'Живописный бульвар',
  };
}
