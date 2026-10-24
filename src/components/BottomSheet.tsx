import React, { useState, useRef, useEffect } from 'react';
import type { RouteResponse, RouteRequest, RouteStop, DesiredWaypoint } from '../types';
import {
  Heart,
  Landmark,
  Coffee,
  Dog,
  Clock,
  Footprints,
  Navigation,
  Sparkles,
  MapPin,
  SlidersHorizontal,
  History,
  ChevronLeft,
  ChevronRight,
  Star,
  Flag,
  UtensilsCrossed,
  Camera,
  Trees,
  Croissant,
  ShoppingBag,
  Armchair,
  IceCream,
} from 'lucide-react';
import { calculateStopCount } from '../services/clientRouteEngine';
import { getCoordinatesDistance } from '../services/realPlacesService';
import { TimeWheelPickerModal } from './TimeWheelPickerModal';

interface BottomSheetProps {
  startLat: number;
  startLon: number;
  startName?: string;
  startAddress?: string;
  endLat?: number | null;
  endLon?: number | null;
  endName?: string;
  onClearEndPoint?: () => void;
  onStartPickingEndLocation?: () => void;
  isPickingEndLocation?: boolean;
  routeData: RouteResponse | null;
  isLoading: boolean;
  activeStopIndex: number | null;
  onSelectStop: (index: number) => void;
  onSubmit: (params: RouteRequest) => void;
  onReset: () => void;
  isTrackingUser?: boolean;
  onToggleTracking?: () => void;
  onOpenHistory?: () => void;
  historyCount?: number;
  onOpenPlaceDetails?: (stop: RouteStop, index: number) => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
  waypoints?: DesiredWaypoint[];
  onRemoveWaypoint?: (id: string) => void;
  onClearWaypoints?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

// Единый полный список форматов прогулки
export const WALK_FORMATS = [
  { id: 'walk', title: 'Прогулка', icon: Footprints },
  { id: 'sights', title: 'Памятники', icon: Landmark },
  { id: 'coffee', title: 'Кофейни', icon: Coffee },
  { id: 'fastfood', title: 'Фастфуд', icon: UtensilsCrossed },
  { id: 'views', title: 'Красивые виды', icon: Camera },
  { id: 'nature', title: 'Природа', icon: Trees },
  { id: 'bakery', title: 'Выпечка', icon: Croissant },
  { id: 'date', title: 'Свидание', icon: Heart },
  { id: 'dog_walk', title: 'С собакой', icon: Dog },
  { id: 'shopping', title: 'Магазины', icon: ShoppingBag },
  { id: 'quiet', title: 'Тихий отдых', icon: Armchair },
  { id: 'sweets', title: 'Сладкое', icon: IceCream },
];

/**
 * Распознает нужные форматы прогулки из произвольного текста пользователя
 * Например: "хочу вкусный кофе и легкую прогулку" -> ['coffee', 'walk']
 */
export function detectFormatsFromText(text: string): string[] {
  if (!text || !text.trim()) return [];
  const lower = text.toLowerCase();
  const detected: string[] = [];

  const matchAny = (keywords: string[]) => keywords.some((kw) => lower.includes(kw));

  if (matchAny(['прогулк', 'погулять', 'пройтись', 'пешком', 'променад', 'походить', 'шаг'])) {
    detected.push('walk');
  }
  if (matchAny(['достопримеч', 'памятник', 'мемориал', 'музей', 'храм', 'собор', 'церков', 'костел', 'архитектур', 'истор', 'старин'])) {
    detected.push('sights');
  }
  if (matchAny(['кофе', 'кофейн', 'капучино', 'латте', 'эспрессо', 'раф', 'американо', 'чай', 'coffee'])) {
    detected.push('coffee');
  }
  if (matchAny(['фастфуд', 'шаурм', 'шаверм', 'донер', 'бургер', 'кфс', 'kfc', 'пицц', 'стритфуд', 'макдональдс', 'чебурек', 'хот-дог', 'хотдог', 'картошк', 'фри', 'наггетс', 'бк', 'перекус', 'поесть', 'закусочн'])) {
    detected.push('fastfood');
  }
  if (matchAny(['вид', 'видов', 'виды', 'панорам', 'смотров', 'набережн', 'бульвар', 'закат', 'красив'])) {
    detected.push('views');
  }
  if (matchAny(['парк', 'природ', 'сквер', 'зелен', 'лес', 'пруд', 'озер', 'река', 'алле', 'дерев'])) {
    detected.push('nature');
  }
  if (matchAny(['пекарн', 'выпечк', 'булочк', 'булочн', 'круассан', 'пирож', 'булк', 'хлеб'])) {
    detected.push('bakery');
  }
  if (matchAny(['свидан', 'романтик', 'девушк', 'парен', 'любов'])) {
    detected.push('date');
  }
  if (matchAny(['собак', 'пес', 'псом', 'щен', 'питом', 'дог'])) {
    detected.push('dog_walk');
  }
  if (matchAny(['магазин', 'шопинг', 'тц', 'покупк', 'витрин', 'молл'])) {
    detected.push('shopping');
  }
  if (matchAny(['тишин', 'тих', 'спокойн', 'уединен', 'малолюд', 'тихий'])) {
    detected.push('quiet');
  }
  if (matchAny(['сладк', 'морожен', 'десерт', 'пирожн', 'торт', 'джелато', 'шоколад', 'конфет', 'кондитер'])) {
    detected.push('sweets');
  }

  return detected;
}

const TIME_CHIPS = [
  { label: '30м', value: 30 },
  { label: '45м', value: 45 },
  { label: '1ч', value: 60 },
  { label: '1.5ч', value: 90 },
  { label: '2ч', value: 120 },
  { label: '2.5ч', value: 150 },
  { label: '3ч', value: 180 },
  { label: '4ч', value: 240 },
  { label: '5ч+', value: 300 },
];

const QUICK_PROMPT_IDEAS = [
  'Вкусный кофе и легкая прогулка',
  'Горячая шаурма и тихий сквер',
  'Уютная кофейня и красивые виды',
  'Пекарня со свежими круассанами',
  'Смотровые площадки и набережная',
];

function getNowTimeStr(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  startLat,
  startLon,
  startName,
  endLat = null,
  endLon = null,
  endName,
  onClearEndPoint,
  onStartPickingEndLocation,
  isPickingEndLocation = false,
  routeData,
  isLoading,
  activeStopIndex,
  onSelectStop,
  onSubmit,
  onReset,
  isTrackingUser,
  onOpenHistory,
  onOpenPlaceDetails,
  isDesktopCollapsed: isDesktopCollapsedProp,
  onToggleDesktopCollapse,
  waypoints = [],
  onRemoveWaypoint,
  onClearWaypoints,
  isFavorite = false,
  onToggleFavorite,
}) => {
  // Единый выбор форматов прогулки (мультивыбор)
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['walk', 'coffee']);
  const [duration, setDuration] = useState<number>(60);
  const [isCircular, setIsCircular] = useState<boolean>(true);

  // Режим выбора времени: 'duration' (по минутам) или 'arrival' (прибыть к точному часу)
  const [timeMode, setTimeMode] = useState<'duration' | 'arrival'>('duration');
  const [targetArrivalTime, setTargetArrivalTime] = useState<string>('18:00');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(getNowTimeStr());

  // Время начала прогулки: сейчас или запланированное
  const [isStartTimeNow, setIsStartTimeNow] = useState<boolean>(true);
  const [customStartTime, setCustomStartTime] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 60000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  const [isStartPickerOpen, setIsStartPickerOpen] = useState<boolean>(false);
  const [isArrivalPickerOpen, setIsArrivalPickerOpen] = useState<boolean>(false);

  // Обновление текущего времени
  useEffect(() => {
    const t = setInterval(() => setCurrentTimeStr(getNowTimeStr()), 30000);
    return () => clearInterval(t);
  }, []);

  // Если задана конечная точка, отключаем круговой режим только если она действительно далеко (>= 150м)
  useEffect(() => {
    if (endLat !== null && endLon !== null) {
      const d = getCoordinatesDistance(startLat, startLon, endLat, endLon);
      if (d < 150) {
        setIsCircular(true);
      } else {
        setIsCircular(false);
      }
    } else {
      setIsCircular(true);
    }
  }, [endLat, endLon, startLat, startLon]);

  const effectiveStartTime = isStartTimeNow ? currentTimeStr : customStartTime;

  // Расчет времени финиша при выборе длительности
  const calculatedFinishTime = (() => {
    const [sh, sm] = effectiveStartTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm)) return '18:00';
    const totalMinutes = sh * 60 + sm + duration;
    const finalH = Math.floor(totalMinutes / 60) % 24;
    const finalM = totalMinutes % 60;
    return `${finalH.toString().padStart(2, '0')}:${finalM.toString().padStart(2, '0')}`;
  })();

  const handleApplyArrivalTime = (timeStr: string) => {
    setTargetArrivalTime(timeStr);
    const [th, tm] = timeStr.split(':').map(Number);
    const [sh, sm] = effectiveStartTime.split(':').map(Number);
    if (!isNaN(th) && !isNaN(tm) && !isNaN(sh) && !isNaN(sm)) {
      let diff = th * 60 + tm - (sh * 60 + sm);
      if (diff <= 0) diff += 24 * 60;
      const diffMins = Math.max(15, Math.min(360, diff));
      setDuration(diffMins);
    }
  };

  const handleApplyStartTime = (timeStr: string) => {
    setCustomStartTime(timeStr);
    setIsStartTimeNow(false);
    if (timeMode === 'arrival') {
      const [th, tm] = targetArrivalTime.split(':').map(Number);
      const [sh, sm] = timeStr.split(':').map(Number);
      if (!isNaN(th) && !isNaN(tm) && !isNaN(sh) && !isNaN(sm)) {
        let diff = th * 60 + tm - (sh * 60 + sm);
        if (diff <= 0) diff += 24 * 60;
        const diffMins = Math.max(15, Math.min(360, diff));
        setDuration(diffMins);
      }
    }
  };

  const [sheetState, setSheetState] = useState<'collapsed' | 'normal' | 'expanded'>('normal');

  const [internalDesktopCollapsed, setInternalDesktopCollapsed] = useState<boolean>(false);
  const isDesktopCollapsed = isDesktopCollapsedProp !== undefined ? isDesktopCollapsedProp : internalDesktopCollapsed;
  const toggleDesktopCollapse =
    onToggleDesktopCollapse || (() => setInternalDesktopCollapsed(!internalDesktopCollapsed));

  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [manualStopCount, setManualStopCount] = useState<number>(0);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  const touchStartY = useRef<number | null>(null);

  const handleDragStart = (clientY: number) => {
    touchStartY.current = clientY;
  };

  const handleDragEnd = (clientY: number) => {
    if (touchStartY.current === null) return;
    const deltaY = clientY - touchStartY.current;
    touchStartY.current = null;

    if (deltaY < -30) {
      if (sheetState === 'collapsed') setSheetState('normal');
      else if (sheetState === 'normal') setSheetState('expanded');
    } else if (deltaY > 30) {
      if (sheetState === 'expanded') setSheetState('normal');
      else if (sheetState === 'normal') setSheetState('collapsed');
    }
  };

  const handlePillClick = () => {
    if (sheetState === 'collapsed') setSheetState('normal');
    else if (sheetState === 'normal') setSheetState('expanded');
    else setSheetState('normal');
  };

  const toggleFormat = (id: string) => {
    setSelectedFormats((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Сохраняем хотя бы один выбранный формат
        return prev.filter((f) => f !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleCustomPromptChange = (newVal: string) => {
    setCustomPrompt(newVal);
    const detected = detectFormatsFromText(newVal);
    if (detected.length > 0) {
      setSelectedFormats((prev) => Array.from(new Set([...prev, ...detected])));
    }
  };

  const handleSelectPromptIdea = (idea: string) => {
    setCustomPrompt(idea);
    const detected = detectFormatsFromText(idea);
    if (detected.length > 0) {
      setSelectedFormats(detected);
    }
  };

  const effectiveStops = calculateStopCount(duration, manualStopCount);

  const isFarEnd =
    endLat !== null &&
    endLon !== null &&
    getCoordinatesDistance(startLat, startLon, endLat, endLon) >= 150;

  const handleBuildRoute = () => {
    onSubmit({
      start_lat: startLat,
      start_lon: startLon,
      duration_minutes: duration,
      scenario: selectedFormats[0] || 'walk',
      is_circular: isFarEnd ? false : isCircular,
      start_time: isStartTimeNow ? undefined : customStartTime,
      end_lat: isFarEnd && endLat !== null ? endLat : undefined,
      end_lon: isFarEnd && endLon !== null ? endLon : undefined,
      end_name: isFarEnd ? endName : undefined,
      target_arrival_time: timeMode === 'arrival' ? targetArrivalTime : calculatedFinishTime,
      custom_prompt: customPrompt.trim() || undefined,
      activities: selectedFormats,
      stop_count: effectiveStops,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
    });
    setSheetState('normal');
  };

  const heightClasses = {
    collapsed: 'h-[64px]',
    normal: 'h-[54vh]',
    expanded: 'h-[92vh]',
  }[sheetState];

  return (
    <div
      className={`fixed transition-all duration-300 ease-out z-30 flex flex-col bg-white dark:bg-neutral-900 shadow-2xl border-neutral-200/90 dark:border-neutral-800 
      bottom-0 inset-x-0 mx-auto w-full max-w-xl rounded-t-3xl border-t ${heightClasses}
      md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[450px] lg:md:w-[490px] md:h-full md:rounded-l-3xl md:rounded-r-none md:border-l md:border-t-0 md:shadow-2xl ${
        isDesktopCollapsed ? 'md:translate-x-full' : 'md:translate-x-0'
      }`}
    >
      {/* Кнопка сворачивания на ПК */}
      <button
        type="button"
        onClick={toggleDesktopCollapse}
        title={isDesktopCollapsed ? 'Развернуть панель маршрута' : 'Свернуть панель вправо'}
        className="hidden md:flex absolute top-24 -left-10 w-10 h-16 bg-white dark:bg-neutral-900 border-l border-t border-b border-neutral-200/90 dark:border-neutral-800 rounded-l-2xl shadow-xl items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-amber-500 cursor-pointer transition-all z-40"
      >
        {isDesktopCollapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* Островок шторки на мобильных */}
      <div
        onClick={handlePillClick}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
        onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientY)}
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onMouseUp={(e) => handleDragEnd(e.clientY)}
        className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0 group hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors md:hidden"
      >
        <div className="w-14 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full group-hover:bg-neutral-400 dark:group-hover:bg-neutral-500 transition-colors" />

        {sheetState === 'collapsed' && (
          <div className="mt-1 flex items-center justify-between w-full px-5 text-xs text-neutral-600 dark:text-neutral-300 font-bold">
            <span>{routeData ? `${routeData.scenario_title} (${routeData.stops.length} ост.)` : 'Куда пойдём?'}</span>
            <span className="text-amber-500 font-extrabold">Развернуть ↑</span>
          </div>
        )}
      </div>

      {/* Контентная часть */}
      <div
        className={`px-5 pb-6 overflow-y-auto space-y-4 flex-1 ${
          sheetState === 'collapsed' ? 'hidden md:block' : 'block'
        }`}
      >
        {!routeData ? (
          /* ================= ЭКРАН НАСТРОЙКИ МАРШРУТА ================= */
          <>
            {/* Шапка с живыми часами реального времени */}
            <div className="flex items-center justify-between pt-2 md:pt-4">
              <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Куда пойдём?</h2>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-xs">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Сейчас: {currentTimeStr}</span>
              </div>
            </div>

            {/* Блок: Точки старта и финиша прогулки */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60 space-y-2.5">
              {/* Точка старта */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 text-neutral-800 dark:text-neutral-200 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <img src="/start-flag.png" alt="Старт" className="w-5 h-5 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold block text-xs">Старт маршрута:</span>
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium truncate block">
                      {startName && !startName.includes(',') && !startName.includes('.')
                        ? startName
                        : startName || (isTrackingUser ? 'Моё текущее местоположение' : 'Выбранная точка на карте')}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">
                      Кликните по карте для смены точки
                    </span>
                  </div>
                </div>
              </div>

              {/* Точка финиша и выбор типа маршрута */}
              <div className="pt-2.5 border-t border-neutral-200/60 dark:border-neutral-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-neutral-800 dark:text-neutral-200 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-neutral-900/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                      <img src="/finish-flag.png" alt="Финиш" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-extrabold block text-xs">Формат маршрута:</span>
                      {isFarEnd ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold truncate block">
                          🏁 К финишу: {endName && !endName.includes('Точка 5') && !endName.includes(',') ? endName : 'Выбранная точка'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">
                          🔄 Кольцевой (возврат на старт)
                        </span>
                      )}
                    </div>
                  </div>

                  {isFarEnd ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onClearEndPoint) onClearEndPoint();
                        setIsCircular(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                    >
                      ✕ На старт
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onStartPickingEndLocation}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                        isPickingEndLocation
                          ? 'bg-rose-600 text-white shadow-md animate-pulse'
                          : 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{isPickingEndLocation ? 'Кликните на карте' : 'Выбрать финиш'}</span>
                    </button>
                  )}
                </div>

                {/* Переключатель: Кольцевой vs К точке финиша */}
                <div className="flex gap-1 bg-neutral-200/70 dark:bg-neutral-700/70 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCircular(true);
                      if (onClearEndPoint) onClearEndPoint();
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      !isFarEnd && isCircular
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🔄 Возврат на старт (кольцевой)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCircular(false);
                      if (!isFarEnd && onStartPickingEndLocation) onStartPickingEndLocation();
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isFarEnd || !isCircular
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <Flag className="w-3 h-3" />
                    <span>К финишу</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Поле авторского пожелания нейросети */}
            <div className="space-y-2">
              <div className="relative flex items-center">
                <Sparkles className="w-4 h-4 text-amber-500 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => handleCustomPromptChange(e.target.value)}
                  placeholder="Что хочется? Вкусный кофе, шаурма, парк, красивые виды..."
                  className="w-full text-sm pl-10 pr-9 py-3 bg-neutral-100 dark:bg-neutral-800/80 border border-transparent focus:border-amber-400 rounded-2xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none transition-all font-medium"
                />
                {customPrompt && (
                  <button
                    type="button"
                    onClick={() => handleCustomPromptChange('')}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-white text-sm cursor-pointer p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Быстрые подсказки-идеи */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {QUICK_PROMPT_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => handleSelectPromptIdea(idea)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-neutral-700 whitespace-nowrap transition-colors cursor-pointer font-medium"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            {/* Обязательные точки пользователя */}
            {waypoints.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                  <span>Обязательные места по пути ({waypoints.length}):</span>
                  {onClearWaypoints && (
                    <button
                      type="button"
                      onClick={onClearWaypoints}
                      className="text-amber-700 hover:underline cursor-pointer"
                    >
                      Очистить
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {waypoints.map((wp) => (
                    <span
                      key={wp.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-800 dark:text-neutral-200 border border-amber-200 dark:border-neutral-700"
                    >
                      <span>📍 {wp.name}</span>
                      {onRemoveWaypoint && (
                        <button
                          type="button"
                          onClick={() => onRemoveWaypoint(wp.id)}
                          className="hover:text-rose-500 cursor-pointer ml-1"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ================= ЕДИНЫЙ РАЗДЕЛ: ФОРМАТ И ПОЖЕЛАНИЯ К ПРОГУЛКЕ ================= */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block">
                  Формат и атмосфера прогулки
                </span>
                <span className="text-[11px] text-neutral-400">Выберите всё, что душе угодно</span>
              </div>

              {/* Адаптивная сетка карточек форматов БЕЗ мелких подписей */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                {WALK_FORMATS.map((fmt) => {
                  const Icon = fmt.icon;
                  const active = selectedFormats.includes(fmt.id);
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => toggleFormat(fmt.id)}
                      className={`px-2 py-2 sm:px-2.5 sm:py-2.5 min-h-[46px] rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 min-w-0 ${
                        active
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 shadow-md ring-2 ring-amber-400'
                          : 'bg-neutral-50 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          active
                            ? 'bg-amber-400/20 text-amber-400 dark:text-amber-600'
                            : 'bg-neutral-200/60 dark:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <span className="font-bold text-[11px] sm:text-xs leading-[1.15] select-none text-left break-words min-w-0">
                        {fmt.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Время прогулки и планирование */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60 space-y-3.5">
              {/* Старт прогулки: Сейчас или запланировать */}
              <div className="flex items-center justify-between pb-2.5 border-b border-neutral-200/60 dark:border-neutral-700/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Старт прогулки:</span>
                </div>

                <div className="flex items-center gap-1 bg-neutral-200/70 dark:bg-neutral-700/70 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setIsStartTimeNow(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isStartTimeNow
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Сейчас ({currentTimeStr})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsStartPickerOpen(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      !isStartTimeNow
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{!isStartTimeNow ? `В ${customStartTime}` : 'Задать время'}</span>
                  </button>
                </div>
              </div>

              {/* Переключатель: По времени vs Прибыть к */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-neutral-200/70 dark:bg-neutral-700 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTimeMode('duration')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timeMode === 'duration'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    ⏱️ По времени
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeMode('arrival')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timeMode === 'arrival'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    🎯 Прибыть к...
                  </button>
                </div>

                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                  {timeMode === 'duration' ? `Финиш в ~${calculatedFinishTime}` : `В запасе: ${duration} мин.`}
                </span>
              </div>

              {timeMode === 'duration' ? (
                <>
                  {/* Кнопки времени */}
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_CHIPS.map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => setDuration(chip.value)}
                        className={`flex-1 min-w-[50px] py-1.5 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          duration === chip.value
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md ring-2 ring-amber-400'
                            : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Ползунок времени */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                      <span>Точная настройка:</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white bg-neutral-200/70 dark:bg-neutral-700 px-2.5 py-0.5 rounded-lg">
                        {Math.floor(duration / 60) > 0 ? `${Math.floor(duration / 60)} ч ` : ''}
                        {duration % 60 ? `${duration % 60} мин` : ''} ({duration} мин.)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDuration((prev) => Math.max(15, prev - 10))}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 flex items-center justify-center font-bold text-xs cursor-pointer text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100"
                      >
                        -10
                      </button>
                      <input
                        type="range"
                        min="15"
                        max="360"
                        step="5"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="flex-1 accent-amber-500 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setDuration((prev) => Math.min(360, prev + 10))}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 flex items-center justify-center font-bold text-xs cursor-pointer text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                        Желаемое время прибытия:
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Нажмите, чтобы прокрутить время
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsArrivalPickerOpen(true)}
                      className="px-4 py-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-blue-500 font-mono font-black text-lg text-neutral-900 dark:text-white shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>{targetArrivalTime}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Настройка остановок */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showAdvancedSettings ? 'Скрыть количество остановок' : 'Настроить количество остановок'}</span>
              </button>

              {showAdvancedSettings && (
                <div className="mt-2.5 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-3 animate-in fade-in">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                      <span>Остановки на маршруте:</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        {manualStopCount === 0 ? `Авто (${effectiveStops})` : `${manualStopCount}`}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { label: 'Авто', val: 0 },
                        { label: '1', val: 1 },
                        { label: '2', val: 2 },
                        { label: '3', val: 3 },
                        { label: '4', val: 4 },
                        { label: '5', val: 5 },
                        { label: '6', val: 6 },
                      ].map((btn) => (
                        <button
                          key={btn.val}
                          type="button"
                          onClick={() => setManualStopCount(btn.val)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            manualStopCount === btn.val
                              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900'
                              : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Главная кнопка построения маршрута */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleBuildRoute}
              className="w-full h-14 rounded-2xl bg-[#FFCC00] hover:bg-[#F5C400] text-neutral-950 font-black text-base shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-neutral-900/30 border-t-neutral-900 rounded-full animate-spin" />
                  <span>Нейросеть строит маршрут...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5 fill-neutral-950" />
                  <span>Построить маршрут</span>
                </>
              )}
            </button>
          </>
        ) : (
          /* ================= ЭКРАН ГОТОВОГО МАРШРУТА ================= */
          <>
            {/* Шапка готового маршрута */}
            <div className="pt-2 md:pt-4 space-y-3">
              {/* Верхняя строка: Название маршрута + Кнопки действий */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                      {routeData.scenario_title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold truncate">
                      {routeData.ai_model || 'StepByStep AI'}
                    </span>
                    {routeData.is_circular ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold">
                        🔄 Кольцевой
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 font-bold">
                        🏁 В одну сторону
                      </span>
                    )}
                  </div>
                </div>

                {/* Панель действий: Избранное + История + Изменить */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={onToggleFavorite}
                      title={isFavorite ? 'Удалить из избранного' : 'Добавить прогулку в избранное'}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                        isFavorite
                          ? 'bg-amber-400 text-neutral-950 shadow-sm'
                          : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          isFavorite ? 'fill-neutral-950 text-neutral-950' : 'text-amber-500'
                        }`}
                      />
                      <span className="hidden sm:inline">{isFavorite ? 'В избранном' : 'В избранное'}</span>
                    </button>
                  )}

                  {onOpenHistory && (
                    <button
                      type="button"
                      onClick={onOpenHistory}
                      title="История прогулок"
                      className="text-xs font-bold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">История</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onReset}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                  >
                    Изменить
                  </button>
                </div>
              </div>

              {/* Карточка ключевых метрик прогулки (гармоничная сетка без пустого места) */}
              <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-xs text-center">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Длительность</span>
                    <span className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                      {Math.floor(routeData.total_route_minutes / 60) > 0 ? `${Math.floor(routeData.total_route_minutes / 60)}ч ` : ''}
                      {routeData.total_route_minutes % 60 ? `${routeData.total_route_minutes % 60}м` : ''}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-xs text-center">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Дистанция</span>
                    <span className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                      {(routeData.total_distance_meters / 1000).toFixed(1)} км
                    </span>
                    <span className="text-[10px] text-neutral-400 block">~{routeData.total_walking_minutes} мин. шаг</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-xs text-center">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Отдых</span>
                    <span className="text-base sm:text-lg font-black text-amber-500">
                      {Math.max(0, routeData.total_route_minutes - routeData.total_walking_minutes)} мин
                    </span>
                    <span className="text-[10px] text-neutral-400 block">{routeData.stops.length} ост.</span>
                  </div>
                </div>

                {/* Таймлайн: Старт -> Финиш */}
                {routeData.arrival_time && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Старт: <strong className="text-neutral-900 dark:text-white font-extrabold">{routeData.start_time || 'сейчас'}</strong></span>
                    </div>
                    <span className="text-neutral-400 font-bold">→</span>
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <Flag className="w-3.5 h-3.5 text-amber-500" />
                      <span>Прибытие: <strong className="font-extrabold">~{routeData.arrival_time}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Карточка конечной точки маршрута */}
              {routeData.end_point && routeData.end_point.name && routeData.end_point.name.toLowerCase() !== 'конечный пункт' && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-300">
                  <span className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-rose-600" />
                    <span>Финиш: {routeData.end_point.name}</span>
                  </span>
                  <span>Конечная точка</span>
                </div>
              )}
            </div>

            {/* Замысел прогулки */}
            {routeData.ai_thought && (
              <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-850 border border-amber-300/60 dark:border-amber-500/30 rounded-2xl p-4 shadow-sm space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                  <span>Замысел прогулки</span>
                </div>
                <p className="text-xs md:text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 font-medium">
                  {routeData.ai_thought}
                </p>
              </div>
            )}

            {/* Список остановок */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block">
                  Остановки маршрута ({routeData.stops.length}):
                </span>
                <span className="text-xs text-neutral-400">Нажмите на точку для инфо</span>
              </div>

              {routeData.stops.map((stop, idx) => {
                const isSelected = activeStopIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectStop(idx);
                      if (onOpenPlaceDetails) onOpenPlaceDetails(stop, idx);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-900 dark:border-white shadow-sm ring-2 ring-neutral-900 dark:ring-white'
                        : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Реальное фото или превью спутникового снимка */}
                      <div className="w-16 h-16 rounded-xl bg-neutral-200 dark:bg-neutral-700 overflow-hidden shrink-0 shadow-xs relative">
                        <img
                          src={stop.photo_url || stop.satellite_url}
                          alt={stop.name}
                          className="w-full h-full object-cover"
                        />
                        {!stop.photo_url && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-[10px] font-bold text-white text-center p-0.5">
                            Спутник
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-black text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {stop.name}
                            </h4>
                            {stop.is_custom_waypoint && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500 text-white shrink-0 shadow-xs">
                                ★ По пути
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 shrink-0">
                            ~{stop.spent_minutes} мин
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs">
                          {stop.rating && (
                            <span className="text-amber-500 font-bold flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {stop.rating.toFixed(1)}
                            </span>
                          )}
                          <span className="text-neutral-400 truncate">• {stop.category}</span>
                          {stop.arrival_time && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold ml-auto">
                              🕒 ~{stop.arrival_time}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {stop.address && (
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="truncate">{stop.address}</span>
                      </div>
                    )}

                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1.5 line-clamp-2 leading-relaxed">
                      {stop.description}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStop(idx);
                          if (onOpenPlaceDetails) onOpenPlaceDetails(stop, idx);
                        }}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Фото и информация</span>
                        <span>→</span>
                      </button>
                      <span className="text-[10px] text-neutral-400">
                        {stop.photo_url ? '📷 Реальное фото' : '🛰️ Спутниковый снимок'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Модальное окно выбора времени старта */}
      <TimeWheelPickerModal
        isOpen={isStartPickerOpen}
        onClose={() => setIsStartPickerOpen(false)}
        title="Время старта прогулки"
        initialTime={customStartTime}
        referenceTime={currentTimeStr}
        onConfirm={handleApplyStartTime}
      />

      {/* Модальное окно выбора времени прибытия */}
      <TimeWheelPickerModal
        isOpen={isArrivalPickerOpen}
        onClose={() => setIsArrivalPickerOpen(false)}
        title="Время прибытия"
        initialTime={targetArrivalTime}
        referenceTime={effectiveStartTime}
        onConfirm={handleApplyArrivalTime}
      />
    </div>
  );
};

export default BottomSheet;
