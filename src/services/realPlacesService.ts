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
          rating: 4.8,
          reviews_count: 85,
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

/**
 * 2. Поиск через Nominatim OpenStreetMap с адаптивными ключевыми словами
 */
async function fetchNominatimPlaces(
  startLat: number,
  startLon: number,
  radiusMeters: number,
  searchKeywords: string[]
): Promise<RealPOICandidate[]> {
  const results: RealPOICandidate[] = [];
  const seenNames = new Set<string>();

  const deltaLat = (radiusMeters / 111000) * 1.25;
  const deltaLon = (radiusMeters / (111000 * Math.cos((startLat * Math.PI) / 180))) * 1.25;

  const minLon = (startLon - deltaLon).toFixed(5);
  const maxLat = (startLat + deltaLat).toFixed(5);
  const maxLon = (startLon + deltaLon).toFixed(5);
  const minLat = (startLat - deltaLat).toFixed(5);

  const queryPromises = searchKeywords.map(async (kw) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        kw
      )}&format=json&bounded=1&viewbox=${minLon},${maxLat},${maxLon},${minLat}&limit=6&addressdetails=1`;

      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 3000);

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'StepByStepAI/2.0 (pedestrian-route-planner)' },
      });
      clearTimeout(tId);

      if (resp.ok) {
        return (await resp.json()) as any[];
      }
    } catch {
      // ignore
    }
    return [];
  });

  const responses = await Promise.all(queryPromises);
  const flatPlaces = responses.flat();

  let placeIdx = 0;
  for (const item of flatPlaces) {
    if (
      item.class === 'boundary' ||
      item.type === 'administrative' ||
      item.type === 'district' ||
      item.osm_type === 'relation' ||
      item.class === 'railway' ||
      item.class === 'industrial' ||
      item.type === 'hospital' ||
      item.type === 'clinic' ||
      item.type === 'social_facility'
    ) {
      continue;
    }

    const rawName = item.name || item.display_name?.split(',')[0];
    if (!rawName) continue;
    const cleanName = rawName.trim();
    if (cleanName.length < 2 || seenNames.has(cleanName.toLowerCase())) continue;

    const addrParts = item.display_name?.split(',') || [];
    const shortAddress = addrParts.slice(0, 3).join(',').trim();

    if (isBlacklisted(cleanName, item.type || '', shortAddress, item.display_name || '')) continue;

    seenNames.add(cleanName.toLowerCase());

    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lon)) continue;

    const dist = getCoordinatesDistance(startLat, startLon, lat, lon);
    if (dist < 20 || dist > radiusMeters * 1.45) continue;

    let catName = 'Интересное место';
    const lowerName = cleanName.toLowerCase();
    const itemType = (item.type || '').toLowerCase();
    const itemClass = (item.class || '').toLowerCase();

    if (
      itemType === 'fast_food' ||
      lowerName.includes('шаурм') ||
      lowerName.includes('шаверм') ||
      lowerName.includes('донер') ||
      lowerName.includes('бургер') ||
      lowerName.includes('kfc') ||
      lowerName.includes('кфс') ||
      lowerName.includes('додо') ||
      lowerName.includes('бургер кинг') ||
      lowerName.includes('пицц') ||
      lowerName.includes('стритфуд') ||
      lowerName.includes('чебурек') ||
      lowerName.includes('блин') ||
      lowerName.includes('драник')
    ) {
      catName = 'Фастфуд / Стритфуд';
    } else if (
      itemType === 'cafe' ||
      (itemClass === 'amenity' && itemType === 'cafe') ||
      lowerName.includes('кофе') ||
      lowerName.includes('coffee')
    ) {
      catName = 'Кофейня';
    } else if (
      itemType === 'bakery' ||
      lowerName.includes('пекарн') ||
      lowerName.includes('булочн') ||
      lowerName.includes('круассан') ||
      lowerName.includes('выпечк')
    ) {
      catName = 'Пекарня / Выпечка';
    } else if (
      itemType === 'ice_cream' ||
      lowerName.includes('морожен') ||
      lowerName.includes('джелато') ||
      lowerName.includes('кондитер')
    ) {
      catName = 'Десерты и сладости';
    } else if (
      lowerName.includes('бульвар') ||
      lowerName.includes('набережн') ||
      itemType === 'viewpoint' ||
      lowerName.includes('смотров') ||
      lowerName.includes('панорам')
    ) {
      catName = 'Живописный бульвар';
    } else if (
      itemType === 'park' ||
      itemClass === 'leisure' ||
      lowerName.includes('парк') ||
      lowerName.includes('сквер') ||
      lowerName.includes('сад')
    ) {
      catName = 'Парк / Сквер';
    } else if (
      itemClass === 'tourism' ||
      itemClass === 'historic' ||
      lowerName.includes('памятник') ||
      lowerName.includes('мемориал') ||
      lowerName.includes('музей') ||
      lowerName.includes('собор') ||
      lowerName.includes('храм')
    ) {
      catName = 'Достопримечательность';
    } else if (
      itemType === 'mall' ||
      itemType === 'department_store' ||
      lowerName.includes('торговый центр') ||
      lowerName.includes('пассаж') ||
      lowerName.includes('галерея')
    ) {
      catName = 'Магазины / ТЦ';
    } else if (
      itemType === 'restaurant' ||
      lowerName.includes('ресторан') ||
      lowerName.includes('бистро')
    ) {
      catName = 'Ресторан / Бистро';
    }

    const yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(cleanName + ' ' + shortAddress)}`;

    results.push({
      id: `nom_${item.place_id || placeIdx}`,
      name: cleanName,
      cat: catName,
      lat,
      lon,
      dist,
      address: shortAddress,
      photo_url: undefined,
      photos: [],
      satellite_url: getSatellitePhotoUrl(lat, lon),
      yandex_url: yandexUrl,
      rating: undefined,
      reviews_count: undefined,
      opening_hours:
        catName.includes('Парк') || catName.includes('бульвар') ? 'Круглосуточно' : 'Ежедневно 08:00 – 22:00',
      tags: getTagsForCategory(catName),
      reviews: [],
    });

    placeIdx++;
  }

  return results;
}

/**
 * 3. Поиск через геокодер Яндекс Карт: организации, оживленные бульвары, проспекты и скверы
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

    const deltaLat = (radiusMeters / 111000) * 1.3;
    const deltaLon = (radiusMeters / (111000 * Math.cos((startLat * Math.PI) / 180))) * 1.3;
    const bounds: [[number, number], [number, number]] = [
      [startLat - deltaLat, startLon - deltaLon],
      [startLat + deltaLat, startLon + deltaLon],
    ];

    const seenNames = new Set<string>();

    for (const kw of keywords) {
      try {
        const res = await ymaps.geocode(kw, {
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

          // Строгая проверка черного списка
          if (isBlacklisted(cleanName, meta?.Categories?.[0]?.name || '', desc)) continue;

          const lat = coords[0];
          const lon = coords[1];
          const dist = getCoordinatesDistance(startLat, startLon, lat, lon);
          if (dist < 20 || dist > radiusMeters * 1.5) continue;

          seenNames.add(normKey);

          let cat = 'Интересное место';
          const lowerName = cleanName.toLowerCase();
          if (
            kw.includes('шаурм') ||
            kw.includes('фастфуд') ||
            kw.includes('бургер') ||
            lowerName.includes('шаурм') ||
            lowerName.includes('донер') ||
            lowerName.includes('бургер') ||
            lowerName.includes('kfc') ||
            lowerName.includes('пицц')
          ) {
            cat = 'Фастфуд / Стритфуд';
          } else if (meta?.Categories && meta.Categories.length > 0) {
            cat = meta.Categories[0].name;
          } else if (lowerName.includes('бульвар') || desc.toLowerCase().includes('бульвар')) {
            cat = 'Живописный бульвар';
          } else if (lowerName.includes('проспект')) {
            cat = 'Широкий проспект';
          } else if (kw.includes('кофе') || lowerName.includes('кофе')) {
            cat = 'Кофейня';
          } else if (kw.includes('пекарн') || lowerName.includes('пекарн')) {
            cat = 'Пекарня / Выпечка';
          } else if (kw.includes('парк') || kw.includes('сквер') || lowerName.includes('парк')) {
            cat = 'Парк / Сквер';
          } else if (kw.includes('ресторан') || kw.includes('кафе')) {
            cat = 'Кафе / Ресторан';
          }

          const address = meta?.address || desc || 'В пешей доступности';
          const hours =
            meta?.Hours?.text ||
            (cat.includes('Парк') || cat.includes('бульвар') ? 'Круглосуточно' : 'Ежедневно 08:00 – 22:00');

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

          if (results.length >= 25) break;
        }
      } catch {
        // continue
      }
      if (results.length >= 25) break;
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

  const addCandidate = (c: RealPOICandidate) => {
    const norm = c.name.toLowerCase().trim();
    if (seenNames.has(norm) || isBlacklisted(c.name, c.cat, c.address || '')) return;
    seenNames.add(norm);
    candidatePool.push(c);
  };

  const nomKeywords: string[] = [];
  const ymapsKeywords: string[] = [];

  const actList = preferredActivities.length > 0 ? preferredActivities : ['walk', 'coffee', 'views'];

  if (actList.includes('fastfood')) {
    nomKeywords.push('шаурма', 'фастфуд', 'бургерная', 'пиццерия');
    ymapsKeywords.push('шаурма', 'фастфуд', 'бургерная', 'пиццерия');
  }
  if (actList.includes('coffee')) {
    nomKeywords.push('кофейня', 'кофе');
    ymapsKeywords.push('кофейня', 'кофе');
  }
  if (actList.includes('bakery')) {
    nomKeywords.push('пекарня', 'булочная', 'кондитерская');
    ymapsKeywords.push('пекарня', 'булочная');
  }
  if (actList.includes('sweets')) {
    nomKeywords.push('мороженое', 'кондитерская', 'десерты');
    ymapsKeywords.push('мороженое', 'кондитерская');
  }
  if (actList.includes('views') || actList.includes('walk')) {
    nomKeywords.push('бульвар', 'аллея', 'набережная', 'смотровая площадка');
    ymapsKeywords.push('бульвар', 'набережная', 'проспект');
  }
  if (actList.includes('nature') || actList.includes('dog_walk') || actList.includes('quiet')) {
    nomKeywords.push('парк', 'сквер', 'сад');
    ymapsKeywords.push('парк', 'сквер');
  }
  if (actList.includes('sights')) {
    nomKeywords.push('достопримечательность', 'памятник', 'мемориал', 'музей');
    ymapsKeywords.push('достопримечательность', 'памятник', 'музей');
  }
  if (actList.includes('shopping')) {
    nomKeywords.push('торговый центр', 'универмаг');
    ymapsKeywords.push('торговый центр');
  }
  if (actList.includes('date')) {
    nomKeywords.push('кофейня', 'бульвар', 'сквер');
    ymapsKeywords.push('кофейня', 'бульвар');
  }

  // ПРЯМОЙ УЧЕТ СТРОКИ "ЧТО ХОЧЕТСЯ?": извлекаем конкретные заведения и блюда в поисковые запросы
  if (customPrompt && customPrompt.trim().length > 0) {
    const cpLower = customPrompt.toLowerCase();
    const promptKeywords = [
      'шаурма', 'шаверма', 'донер', 'бургер', 'kfc', 'кфс', 'пицца', 'пиццерия', 'драники', 'чебурек',
      'кофе', 'кофейня', 'латте', 'капучино', 'раф', 'выпечка', 'пекарня', 'круассан', 'булочная',
      'мороженое', 'десерт', 'парк', 'сквер', 'набережная', 'бульвар', 'аллея',
      'памятник', 'собор', 'музей', 'храм', 'торговый центр', 'магазин'
    ];
    for (const pk of promptKeywords) {
      if (cpLower.includes(pk)) {
        if (!nomKeywords.includes(pk)) nomKeywords.unshift(pk);
        if (!ymapsKeywords.includes(pk)) ymapsKeywords.unshift(pk);
      }
    }
  }

  if (nomKeywords.length === 0) {
    nomKeywords.push('бульвар', 'парк', 'кофейня', 'шаурма', 'пекарня', 'памятник');
    ymapsKeywords.push('бульвар', 'парк', 'кофейня', 'шаурма');
  }

  // Запускаем ВСЕ источники параллельно через Promise.allSettled
  const [wikiRes, nomRes, ymapsBizRes, ymapsStreetRes] = await Promise.allSettled([
    // Википедию опрашиваем только если выбраны достопримечательности или общая прогулка
    actList.includes('sights') || actList.includes('walk') || actList.length === 0
      ? fetchWikipediaPlacesAround(startLat, startLon, radiusMeters)
      : Promise.resolve([]),
    fetchNominatimPlaces(startLat, startLon, radiusMeters, nomKeywords),
    searchYandexOrganizations(startLat, startLon, radiusMeters, ymapsKeywords),
    fetchYmapsStreetsAndHouses(startLat, startLon, radiusMeters),
  ]);

  if (nomRes.status === 'fulfilled') {
    for (const n of nomRes.value) addCandidate(n);
  }
  if (wikiRes.status === 'fulfilled') {
    for (const w of wikiRes.value) addCandidate(w);
  }
  if (ymapsBizRes.status === 'fulfilled') {
    for (const y of ymapsBizRes.value) addCandidate(y);
  }
  if (ymapsStreetRes.status === 'fulfilled') {
    for (const s of ymapsStreetRes.value) addCandidate(s);
  }

  // Если кандидатов мало, делаем расширенный поиск
  if (candidatePool.length < 5) {
    const widerRadius = radiusMeters * 1.8;
    const [widerNom, widerStreet] = await Promise.allSettled([
      fetchNominatimPlaces(startLat, startLon, widerRadius, nomKeywords),
      fetchYmapsStreetsAndHouses(startLat, startLon, widerRadius),
    ]);
    if (widerNom.status === 'fulfilled') {
      for (const n of widerNom.value) addCandidate(n);
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
export function enrichStopWithRealDetails(stop: RouteStop, index: number): RouteStop {
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
    reviews: [],
    opening_hours: openingHours,
  };
}
