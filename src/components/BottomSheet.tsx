import React, { useState, useRef } from 'react';
import type { RouteResponse, RouteRequest, RouteStop } from '../types';
import { 
  Heart, 
  Landmark, 
  Coffee, 
  Dog, 
  Clock, 
  Footprints, 
  RotateCcw, 
  Navigation,
  Sparkles,
  MapPin,
  SlidersHorizontal,
  History,
  ChevronLeft,
  ChevronRight,
  Star
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
  onOpenPlaceDetails?: (stop: RouteStop, index: number) => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

const SCENARIOS = [
  { id: 'date', title: 'Свидание', icon: Heart, desc: 'Кофейни, виды и романтика' },
  { id: 'tourist', title: 'Прогулка', icon: Landmark, desc: 'Архитектура и история' },
  { id: 'coffee_walk', title: 'За кофе', icon: Coffee, desc: 'Кофе с собой и скверы' },
  { id: 'dog_walk', title: 'С собакой', icon: Dog, desc: 'Парки и тихие аллеи' },
];

const TIME_CHIPS = [
  { label: '30 мин', value: 30, short: '30м' },
  { label: '45 мин', value: 45, short: '45м' },
  { label: '1 час', value: 60, short: '1ч' },
  { label: '1.5 ч', value: 90, short: '1.5ч' },
  { label: '2 часа', value: 120, short: '2ч' },
  { label: '3 часа', value: 180, short: '3ч' },
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
  onOpenPlaceDetails,
  isDesktopCollapsed: isDesktopCollapsedProp,
  onToggleDesktopCollapse,
}) => {
  const [scenario, setScenario] = useState<string>('date');
  const [duration, setDuration] = useState<number>(60);
  const [isCircular, setIsCircular] = useState<boolean>(true);

  // Состояние на мобильных (шторка снизу): 'collapsed' | 'normal' | 'expanded'
  const [sheetState, setSheetState] = useState<'collapsed' | 'normal' | 'expanded'>('normal');

  // Состояние на ПК (боковая панель справа): свернута вбок или открыта
  const [internalDesktopCollapsed, setInternalDesktopCollapsed] = useState<boolean>(false);
  const isDesktopCollapsed = isDesktopCollapsedProp !== undefined ? isDesktopCollapsedProp : internalDesktopCollapsed;
  const toggleDesktopCollapse = onToggleDesktopCollapse || (() => setInternalDesktopCollapsed(!internalDesktopCollapsed));

  // Кастомный промпт нейросети и выбранные активности
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['coffee', 'nature']);
  const [manualStopCount, setManualStopCount] = useState<number>(0); // 0 = авто
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // Реф и хэндлер для интерактивного ползунка времени
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  const activeChipIndex = Math.max(
    0,
    TIME_CHIPS.findIndex((c) => c.value === duration)
  );

  const handleSliderPointer = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const fraction = Math.max(0, Math.min(0.999, x / rect.width));
    const idx = Math.min(TIME_CHIPS.length - 1, Math.floor(fraction * TIME_CHIPS.length));
    setDuration(TIME_CHIPS[idx].value);
  };

  // Отслеживание свайпов / перетаскивания островка на мобилках
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

  const effectiveStops = calculateStopCount(duration, manualStopCount);

  // Классы высоты для 3 положений шторки на мобильных
  const heightClasses = {
    collapsed: 'h-[64px]',
    normal: 'h-[52vh]',
    expanded: 'h-[92vh]',
  }[sheetState];

  return (
    <div
      className={`fixed transition-all duration-300 ease-out z-30 flex flex-col bg-white dark:bg-neutral-900 shadow-2xl border-neutral-200/90 dark:border-neutral-800 
      /* Мобильный вид: шторка снизу по центру */
      bottom-0 inset-x-0 mx-auto w-full max-w-xl rounded-t-3xl border-t ${heightClasses}
      /* Десктопный вид (ПК): отдельная панель справа сбоку на весь экран */
      md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[440px] lg:md:w-[480px] md:h-full md:rounded-l-3xl md:rounded-r-none md:border-l md:border-t-0 md:shadow-2xl ${
        isDesktopCollapsed ? 'md:translate-x-full' : 'md:translate-x-0'
      }`}
    >
      {/* Кнопка сворачивания/разворачивания боковой панели на ПК */}
      <button
        type="button"
        onClick={toggleDesktopCollapse}
        title={isDesktopCollapsed ? 'Развернуть панель маршрута' : 'Свернуть панель вправо'}
        className="hidden md:flex absolute top-24 -left-10 w-10 h-16 bg-white dark:bg-neutral-900 border-l border-t border-b border-neutral-200/90 dark:border-neutral-800 rounded-l-2xl shadow-xl items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-amber-500 cursor-pointer transition-all z-40"
      >
        {isDesktopCollapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* 1. Верхний островок управления шторкой (на мобилках) */}
      <div
        onClick={handlePillClick}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
        onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientY)}
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onMouseUp={(e) => handleDragEnd(e.clientY)}
        className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0 group hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors md:hidden"
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

      {/* 2. Контентная часть панели */}
      <div className={`px-5 pb-6 overflow-y-auto space-y-4 flex-1 ${sheetState === 'collapsed' ? 'hidden md:block' : 'block'}`}>
        {!routeData ? (
          /* ================= ЭКРАН НАСТРОЙКИ МАРШРУТА ================= */
          <>
            {/* Шапка: Чистый заголовок + кнопки */}
            <div className="flex items-center justify-between pt-2 md:pt-4">
              <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                Куда пойдём?
              </h2>

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

            {/* 1. Поле пожелания нейросети */}
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

            {/* 2. Сценарии прогулок */}
            <div>
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block mb-2.5">
                Сценарий прогулки
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {SCENARIOS.map((s) => {
                  const Icon = s.icon;
                  const isSelected = scenario === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setScenario(s.id)}
                      className={`p-3 text-left rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-sm'
                          : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-amber-400 text-neutral-950'
                            : 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-sm truncate">{s.title}</div>
                        <div
                          className={`text-xs truncate ${
                            isSelected ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'
                          }`}
                        >
                          {s.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Чем заняться в пути */}
            <div>
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block mb-2.5">
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
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  Время прогулки
                </span>
                <span className="text-sm font-extrabold text-neutral-900 dark:text-white bg-amber-100 dark:bg-neutral-800 px-3 py-1 rounded-xl">
                  {duration} минут ({Math.floor(duration / 60) > 0 ? `${Math.floor(duration / 60)}ч ` : ''}{duration % 60 ? `${duration % 60}м` : ''})
                </span>
              </div>

              {/* Кнопки времени ровно в 6 колонок */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {TIME_CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setDuration(chip.value)}
                    className={`py-2 px-1 text-center rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                      duration === chip.value
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md ring-2 ring-amber-400'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Ползунок времени с рисками, ровно спозиционированный под кнопками выбора */}
              <div
                ref={sliderContainerRef}
                className="relative mt-3 pt-1 pb-1 select-none cursor-pointer"
                onPointerDown={(e) => {
                  handleSliderPointer(e.clientX);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) {
                    handleSliderPointer(e.clientX);
                  }
                }}
              >
                {/* Горизонтальный фоновый трек между центрами первой и последней колонки */}
                <div className="absolute top-[16px] left-[8.33%] right-[8.33%] h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full" />

                {/* Активная подсвеченная часть трека */}
                <div
                  className="absolute top-[16px] left-[8.33%] h-1 bg-amber-400 rounded-full transition-all duration-150"
                  style={{
                    width: `${(activeChipIndex / 5) * (100 - 16.66)}%`
                  }}
                />

                {/* Сетка рисок в точности по 6 колонкам */}
                <div className="grid grid-cols-6 gap-1.5 sm:gap-2 relative z-10">
                  {TIME_CHIPS.map((chip, idx) => {
                    const isActive = duration === chip.value;
                    const isPassed = activeChipIndex >= idx;

                    return (
                      <div
                        key={chip.value}
                        onClick={() => setDuration(chip.value)}
                        className="flex flex-col items-center justify-center group py-0.5"
                      >
                        {/* Риска / Ползунок */}
                        <div className="h-6 flex items-center justify-center">
                          {isActive ? (
                            <div className="w-5 h-5 rounded-full bg-amber-400 shadow-md ring-4 ring-amber-400/25 flex items-center justify-center transition-transform scale-110">
                              <div className="w-2 h-2 rounded-full bg-neutral-900" />
                            </div>
                          ) : (
                            <div
                              className={`w-1 rounded-full transition-all ${
                                isPassed
                                  ? 'bg-amber-400 h-3.5'
                                  : 'bg-neutral-300 dark:bg-neutral-600 h-2.5 group-hover:h-3.5 group-hover:bg-neutral-400'
                              }`}
                            />
                          )}
                        </div>

                        {/* Подпись риска по минутам */}
                        <span
                          className={`text-[11px] font-bold mt-1 transition-colors ${
                            isActive
                              ? 'text-amber-500 dark:text-amber-400 font-black'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          {chip.short}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
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

                  {/* Кольцевой маршрут */}
                  <label className="flex items-center justify-between pt-1 cursor-pointer">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Вернуться в точку старта
                    </span>
                    <input
                      type="checkbox"
                      checked={isCircular}
                      onChange={(e) => setIsCircular(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-neutral-300"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Главная кнопка запуска построения */}
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
                  <span>Построить маршрут ({effectiveStops} {effectiveStops === 1 ? 'остановка' : effectiveStops < 5 ? 'остановки' : 'остановок'})</span>
                </>
              )}
            </button>
          </>
        ) : (
          /* ================= ЭКРАН ГОТОВОГО МАРШРУТА ================= */
          <>
            {/* Сводка маршрута с крупными четкими цифрами */}
            <div className="flex items-start justify-between pt-2 md:pt-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-500">
                    {routeData.scenario_title}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold truncate max-w-[170px]">
                    {routeData.ai_model || 'Gemini 3.5 Flash'}
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
                    {routeData.ai_model || 'Gemini 3.5 Flash'}
                  </span>
                </div>
                <p className="text-xs md:text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 font-medium">
                  {routeData.ai_thought}
                </p>
              </div>
            )}

            {/* Список остановок с фотографиями, рейтингом и карточкой места */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block">
                  Остановки маршрута ({routeData.stops.length}):
                </span>
                <span className="text-xs text-neutral-400">
                  Нажмите на точку для отзывов и фото
                </span>
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
                      {/* Миниатюра реального фото заведения */}
                      {stop.photo_url ? (
                        <div className="w-16 h-16 rounded-xl bg-neutral-200 dark:bg-neutral-700 overflow-hidden shrink-0 shadow-xs">
                          <img
                            src={stop.photo_url}
                            alt={stop.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0">
                          <Coffee className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-black text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {stop.name}
                            </h4>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 shrink-0">
                            {stop.spent_minutes} мин
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="text-amber-500 font-bold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {stop.rating?.toFixed(1) || '4.8'}
                          </span>
                          <span className="text-neutral-400 truncate">
                            • {stop.category}
                          </span>
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
                        <span>Карточка места и отзывы</span>
                        <span>→</span>
                      </button>
                      <span className="text-[10px] text-neutral-400">
                        {stop.reviews_count || 120} отзывов
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BottomSheet;
