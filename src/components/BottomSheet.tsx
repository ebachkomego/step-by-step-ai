import React, { useState, useRef } from 'react';
import type { RouteResponse, RouteRequest } from '../types';
import { 
  Heart, 
  Landmark, 
  Coffee, 
  Dog, 
  Clock, 
  Footprints, 
  RotateCcw, 
  Compass, 
  Navigation,
  ExternalLink,
  Sparkles,
  MapPin,
  SlidersHorizontal,
  History
} from 'lucide-react';
import { calculateStopCount } from '../services/clientRouteEngine';

interface BottomSheetProps {
  startLat: number;
  startLon: number;
  routeData: RouteResponse | null;
  isLoading: boolean;
  activeStopIndex: number | null;
  onSelectStop: (index: number) => void;
  onSubmit: (params: RouteRequest) => void;
  onReset: () => void;
  isTrackingUser: boolean;
  onToggleTracking: () => void;
  onOpenHistory?: () => void;
  historyCount?: number;
}

const SCENARIOS = [
  { id: 'date', title: 'Свидание', icon: Heart, desc: 'Кофейни, виды и романтика' },
  { id: 'tourist', title: 'Прогулка', icon: Landmark, desc: 'Архитектура и история' },
  { id: 'coffee_walk', title: 'За кофе', icon: Coffee, desc: 'Кофе с собой и скверы' },
  { id: 'dog_walk', title: 'С собакой', icon: Dog, desc: 'Парки и тихие аллеи' },
];

const TIME_CHIPS = [
  { label: '30 мин', value: 30 },
  { label: '45 мин', value: 45 },
  { label: '1 час', value: 60 },
  { label: '1.5 ч', value: 90 },
  { label: '2 часа', value: 120 },
  { label: '3 часа', value: 180 },
];

const ACTIVITIES = [
  { id: 'coffee', label: '☕ Кофе и десерт' },
  { id: 'nature', label: '🌿 Зеленый парк' },
  { id: 'photo', label: '📸 Красивые виды' },
  { id: 'history', label: '🏛️ Памятники и история' },
  { id: 'shopping', label: '🛍️ Книжные и сувениры' },
  { id: 'pets', label: '🐕 Площадки для собак' },
  { id: 'food', label: '🥐 Вкусный перекус' },
];

const QUICK_PROMPT_IDEAS = [
  'Уютная кофейня с матчей и тихий парк',
  'Книжные лавки и старинные дворики',
  'Смотровые площадки и набережная',
  'Красивый сквер и выпечка с корицей',
];

export const BottomSheet: React.FC<BottomSheetProps> = ({
  startLat,
  startLon,
  routeData,
  isLoading,
  activeStopIndex,
  onSelectStop,
  onSubmit,
  onReset,
  isTrackingUser,
  onToggleTracking,
  onOpenHistory,
  historyCount,
}) => {
  const [scenario, setScenario] = useState<string>('date');
  const [duration, setDuration] = useState<number>(60);
  const [isCircular, setIsCircular] = useState<boolean>(true);

  // 3 положения шторки в точности как в Яндекс Картах:
  // 1) 'collapsed' — полностью убранная (торчит только верхняя строка ~64px)
  // 2) 'normal' — на половину экрана (~52vh)
  // 3) 'expanded' — на весь экран (~92vh)
  const [sheetState, setSheetState] = useState<'collapsed' | 'normal' | 'expanded'>('normal');

  // Кастомный промпт нейросети и выбранные активности
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['coffee', 'nature']);
  const [manualStopCount, setManualStopCount] = useState<number>(0); // 0 = авто
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // Отслеживание свайпов / перетаскивания островка
  const touchStartY = useRef<number | null>(null);

  const handleDragStart = (clientY: number) => {
    touchStartY.current = clientY;
  };

  const handleDragEnd = (clientY: number) => {
    if (touchStartY.current === null) return;
    const deltaY = clientY - touchStartY.current;
    touchStartY.current = null;

    if (deltaY < -30) {
      // Свайп ВВЕРХ
      if (sheetState === 'collapsed') setSheetState('normal');
      else if (sheetState === 'normal') setSheetState('expanded');
    } else if (deltaY > 30) {
      // Свайп ВНИЗ
      if (sheetState === 'expanded') setSheetState('normal');
      else if (sheetState === 'normal') setSheetState('collapsed');
    }
  };

  // Клик по островку переключает режимы
  const handlePillClick = () => {
    if (sheetState === 'collapsed') setSheetState('normal');
    else if (sheetState === 'normal') setSheetState('expanded');
    else setSheetState('normal');
  };

  const toggleActivity = (id: string) => {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleBuildRoute = () => {
    onSubmit({
      start_lat: startLat,
      start_lon: startLon,
      duration_minutes: duration,
      scenario,
      is_circular: isCircular,
      custom_prompt: customPrompt.trim() || undefined,
      activities: selectedActivities,
      stop_count: manualStopCount > 0 ? manualStopCount : undefined,
    });
    setSheetState('normal');
  };

  const openInYandexMaps = () => {
    if (!routeData || !routeData.stops.length) return;
    const rtext = [
      `${startLat},${startLon}`,
      ...routeData.stops.map((s) => `${s.lat},${s.lon}`),
      ...(isCircular ? [`${startLat},${startLon}`] : []),
    ].join('~');
    const url = `https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`;
    window.open(url, '_blank');
  };

  const effectiveStops = calculateStopCount(duration, manualStopCount);

  // Классы высоты для 3 положений шторки
  const heightClasses = {
    collapsed: 'h-[64px]',
    normal: 'h-[52vh]',
    expanded: 'h-[92vh]',
  }[sheetState];

  return (
    <div
      className={`fixed bottom-0 inset-x-0 mx-auto w-full max-w-xl bg-white dark:bg-neutral-900 shadow-2xl rounded-t-3xl border-t border-neutral-200/90 dark:border-neutral-800 transition-all duration-300 ease-out z-30 flex flex-col overflow-hidden ${heightClasses}`}
    >
      {/* 1. Верхний островок управления шторкой (Яндекс Карты) */}
      <div
        onClick={handlePillClick}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
        onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientY)}
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onMouseUp={(e) => handleDragEnd(e.clientY)}
        className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0 group hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="w-14 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full group-hover:bg-neutral-400 dark:group-hover:bg-neutral-500 transition-colors" />

        {/* В свернутом виде видна аккуратная строка вызова */}
        {sheetState === 'collapsed' && (
          <div className="flex items-center justify-between w-full px-5 mt-1.5 cursor-pointer">
            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">
              {routeData ? `${routeData.scenario_title} • ${routeData.total_route_minutes} мин` : 'Куда пойдем сегодня?'}
            </span>
            <span className="text-xs font-bold text-amber-500 whitespace-nowrap pl-2">
              Потяните вверх ↑
            </span>
          </div>
        )}
      </div>

      {/* 2. Контентная часть шторки */}
      {sheetState !== 'collapsed' && (
        <div className="px-5 pb-6 overflow-y-auto space-y-4 flex-1">
          {!routeData ? (
            /* ================= ЭКРАН НАСТРОЙКИ МАРШРУТА ================= */
            <>
              {/* Шапка: Заголовок + Геолокация */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>Куда пойдем?</span>
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                      Яндекс Карты
                    </span>
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${isTrackingUser ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                    <span className="font-mono">
                      {startLat.toFixed(4)}, {startLon.toFixed(4)}
                    </span>
                    <span>
                      {isTrackingUser ? '• GPS активен' : '• выбран старт'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenHistory && (
                    <button
                      type="button"
                      onClick={onOpenHistory}
                      title="История прошлых прогулок"
                      className="px-3 py-2 text-xs font-bold rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                      <span>История</span>
                      {historyCount && historyCount > 0 ? (
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-black flex items-center justify-center">
                          {historyCount}
                        </span>
                      ) : null}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onToggleTracking}
                    title={isTrackingUser ? 'Точка старта привязана к вашему GPS' : 'Привязать старт к вашему GPS'}
                    className={`px-3.5 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                      isTrackingUser
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300/50'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isTrackingUser ? 'text-emerald-500 fill-emerald-500/20' : 'text-neutral-500'}`} />
                    <span>Моё место</span>
                  </button>
                </div>
              </div>

              {/* 1. Поле пожелания нейросети (Чистый поисковый вид) */}
              <div className="space-y-2">
                <div className="relative flex items-center">
                  <Sparkles className="w-4 h-4 text-amber-500 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Что хочется? Кофе, тихий парк, красивые виды..."
                    className="w-full text-sm pl-10 pr-9 py-3 bg-neutral-100 dark:bg-neutral-800/80 border border-transparent focus:border-amber-400 rounded-2xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none transition-all font-medium"
                  />
                  {customPrompt && (
                    <button
                      type="button"
                      onClick={() => setCustomPrompt('')}
                      className="absolute right-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-white text-sm cursor-pointer p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Быстрые подсказки-идеи в аккуратную ленту */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {QUICK_PROMPT_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setCustomPrompt(idea)}
                      className="text-xs px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-neutral-700 whitespace-nowrap transition-colors cursor-pointer font-medium"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Сценарии (Компактные карточки в стиле тарифов Яндекс Go) */}
              <div>
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2 block">
                  Сценарий прогулки
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SCENARIOS.map((sc) => {
                    const Icon = sc.icon;
                    const isSelected = scenario === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setScenario(sc.id)}
                        className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-sm'
                            : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold leading-tight">{sc.title}</div>
                          <div className={`text-xs truncate mt-0.5 ${isSelected ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                            {sc.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Активности (Крупные удобные теги) */}
              <div>
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2 block">
                  Чем заняться в пути
                </span>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITIES.map((act) => {
                    const active = selectedActivities.includes(act.id);
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => toggleActivity(act.id)}
                        className={`text-xs md:text-sm px-3.5 py-2 rounded-xl border transition-all cursor-pointer font-medium ${
                          active
                            ? 'bg-amber-400 text-neutral-950 font-bold border-amber-400 shadow-sm'
                            : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                        }`}
                      >
                        {act.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Время прогулки */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    Время прогулки
                  </span>
                  <span className="text-sm font-extrabold text-neutral-900 dark:text-white bg-amber-100 dark:bg-neutral-800 px-3 py-1 rounded-xl">
                    {duration} минут ({Math.floor(duration / 60)}ч {duration % 60 ? `${duration % 60}м` : ''})
                  </span>
                </div>

                {/* Чипсы времени */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {TIME_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setDuration(chip.value)}
                      className={`py-2 px-1 text-center rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                        duration === chip.value
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Ползунок времени */}
                <input
                  type="range"
                  min="20"
                  max="180"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full mt-3 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-[#FFCC00]"
                />
              </div>

              {/* 5. Дополнительные настройки (сворачиваемый блок для чистоты) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{showAdvancedSettings ? 'Скрыть настройки остановок' : 'Настроить количество остановок'}</span>
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
                          { label: '5+', val: 5 },
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

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200 dark:border-neutral-700">
                      <label htmlFor="circ-switch" className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2 cursor-pointer select-none">
                        <RotateCcw className="w-4 h-4 text-neutral-400" />
                        <span>Вернуться в точку старта</span>
                      </label>
                      <input
                        id="circ-switch"
                        type="checkbox"
                        checked={isCircular}
                        onChange={(e) => setIsCircular(e.target.checked)}
                        className="w-4 h-4 rounded text-neutral-900 accent-[#FFCC00] cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Главная кнопка в стиле Яндекс Go (Крупная и заметная) */}
              <button
                type="button"
                onClick={handleBuildRoute}
                disabled={isLoading}
                className={`w-full h-14 rounded-2xl font-extrabold text-base shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
                  isLoading
                    ? 'bg-amber-300 text-neutral-800 cursor-wait'
                    : 'bg-[#FFCC00] hover:bg-[#F5C400] text-neutral-950 shadow-amber-500/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-neutral-900/30 border-t-neutral-900 rounded-full animate-spin" />
                    <span>Нейросеть проектирует маршрут...</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-5 h-5" />
                    <span>Построить маршрут ({effectiveStops} остановок)</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* ================= ЭКРАН ГОТОВОГО МАРШРУТА ================= */
            <>
              {/* Сводка маршрута с крупными четкими цифрами */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-500">
                      {routeData.scenario_title}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold truncate max-w-[170px]">
                      {routeData.ai_model || 'Gemini 2.5 Flash'}
                    </span>
                  </div>

                  <h3 className="text-3xl font-black tracking-tight text-neutral-950 dark:text-white mt-1">
                    {Math.floor(routeData.total_route_minutes / 60) > 0 ? `${Math.floor(routeData.total_route_minutes / 60)} ч ` : ''}
                    {routeData.total_route_minutes % 60 ? `${routeData.total_route_minutes % 60} мин` : ''}
                  </h3>

                  {/* Разделение времени: Шаг vs Отдых */}
                  <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-neutral-600 dark:text-neutral-300 mt-2">
                    <span className="flex items-center gap-1.5 font-semibold bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-xl">
                      <Footprints className="w-4 h-4 text-neutral-400" />
                      {(routeData.total_distance_meters / 1000).toFixed(1)} км шагом ({routeData.total_walking_minutes} мин.)
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                      <Coffee className="w-4 h-4 text-amber-500" />
                      {Math.max(0, routeData.total_route_minutes - routeData.total_walking_minutes)} мин. отдых и беседы
                    </span>
                    <span className="text-xs text-neutral-400 pl-1">
                      • {routeData.stops.length} остановок
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenHistory && (
                    <button
                      type="button"
                      onClick={onOpenHistory}
                      title="История прошлых прогулок"
                      className="text-xs font-bold px-3 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>История</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onReset}
                    className="text-xs font-bold px-3.5 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
                  >
                    Изменить
                  </button>
                </div>
              </div>

              {/* Замысел маршрута от нейросети */}
              {routeData.ai_thought && (
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-850 border border-amber-300/60 dark:border-amber-500/30 rounded-2xl p-4 shadow-sm space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                    <span>Замысел прогулки от нейросети</span>
                    <span className="text-xs ml-auto px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-semibold truncate max-w-[150px]">
                      {routeData.ai_model || 'Gemini 2.5 Flash'}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 font-medium">
                    {routeData.ai_thought}
                  </p>
                </div>
              )}

              {/* Кнопка навигации в Яндекс Картах */}
              <button
                type="button"
                onClick={openInYandexMaps}
                className="w-full h-13 rounded-2xl bg-[#FC3F1D] hover:bg-[#E53818] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-red-500/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                <span>Открыть маршрут в Яндекс Картах</span>
                <ExternalLink className="w-4 h-4 opacity-80" />
              </button>

              {/* Список остановок (Крупные читаемые карточки) */}
              <div className="space-y-3 pt-2">
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block">
                  Остановки маршрута ({routeData.stops.length}):
                </span>

                {routeData.stops.map((stop, idx) => {
                  const isSelected = activeStopIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectStop(idx)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-900 dark:border-white shadow-sm ring-2 ring-neutral-900 dark:ring-white'
                          : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-base font-bold text-neutral-900 dark:text-white leading-snug">
                            {stop.name}
                          </h4>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 shrink-0">
                          {stop.spent_minutes} мин.
                        </span>
                      </div>

                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-1 pl-8">
                        {stop.category}
                      </div>

                      <p className="text-xs md:text-sm text-neutral-700 dark:text-neutral-300 mt-2.5 pl-8 leading-relaxed font-normal">
                        {stop.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
