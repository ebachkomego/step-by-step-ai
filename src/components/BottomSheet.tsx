import React, { useState } from 'react';
import type { RouteResponse, RouteRequest } from '../types';
import { 
  Heart, 
  Landmark, 
  Coffee, 
  Dog, 
  MapPin, 
  Clock, 
  Footprints, 
  RotateCcw, 
  Compass, 
  Navigation,
  ExternalLink,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sliders,
  Send,
  Key
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
  onCurrentLocation: () => void;
  isTrackingUser: boolean;
  onToggleTracking: () => void;
}

const SCENARIOS = [
  { id: 'date', title: 'Свидание', icon: Heart, desc: 'Кофейни, виды и романтика' },
  { id: 'tourist', title: 'Прогулка', icon: Landmark, desc: 'Архитектура и история' },
  { id: 'coffee_walk', title: 'За кофе', icon: Coffee, desc: 'Кофе навынос и скверы' },
  { id: 'dog_walk', title: 'С собакой', icon: Dog, desc: 'Парки и тихие аллеи' },
];

const TIME_CHIPS = [
  { label: '30 мин', value: 30 },
  { label: '45 мин', value: 45 },
  { label: '1 час', value: 60 },
  { label: '1.5 часа', value: 90 },
  { label: '2 часа', value: 120 },
  { label: '3 часа', value: 180 },
];

const ACTIVITIES = [
  { id: 'coffee', label: '☕ Кофе и десерт' },
  { id: 'nature', label: '🌿 Зеленый парк' },
  { id: 'photo', label: '📸 Красивые виды' },
  { id: 'history', label: '🏛️ Памятники и история' },
  { id: 'shopping', label: '🛍️ Книжные и сувениры' },
  { id: 'pets', label: '🐕 Площадки для питомцев' },
  { id: 'food', label: '🥐 Вкусный перекус' },
];

const QUICK_PROMPT_IDEAS = [
  'Хочу кофейню с матчей и тихий парк',
  'Книжные лавки и старинные дворики',
  'Смотровые площадки и набережная',
  'Уютный сквер и выпечка с корицей',
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
  onCurrentLocation,
  isTrackingUser,
  onToggleTracking,
}) => {
  const [scenario, setScenario] = useState<string>('date');
  const [duration, setDuration] = useState<number>(60);
  const [isCircular, setIsCircular] = useState<boolean>(true);
  // Состояния шторки: 'collapsed' (свернуто), 'normal' (стандартное), 'expanded' (во весь экран)
  const [sheetState, setSheetState] = useState<'collapsed' | 'normal' | 'expanded'>('normal');

  // Кастомный промпт нейросети и выбранные активности
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['coffee', 'nature']);
  const [manualStopCount, setManualStopCount] = useState<number>(0); // 0 = авто

  // Личный API-ключ Gemini (сохраняется в localStorage)
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('sbs_gemini_key') || '');
  const [showKeyField, setShowKeyField] = useState<boolean>(false);

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
      api_key: apiKey.trim() || undefined,
    });
    // При построении разворачиваем шторку в стандартный или расширенный вид
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

  // Переключение состояния шторки по клику на ручку
  const cycleSheetState = () => {
    if (sheetState === 'collapsed') setSheetState('normal');
    else if (sheetState === 'normal') setSheetState('expanded');
    else setSheetState('collapsed');
  };

  // Рассчитанное количество остановок
  const effectiveStops = calculateStopCount(duration, manualStopCount);

  // Классы высоты в зависимости от sheetState
  const heightClasses = {
    collapsed: 'h-[76px] overflow-hidden',
    normal: 'h-[55vh] md:h-[50vh]',
    expanded: 'h-[88vh]',
  }[sheetState];

  return (
    <div
      className={`fixed bottom-0 inset-x-0 mx-auto w-full max-w-xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-2xl rounded-t-3xl border-t border-neutral-200/80 dark:border-neutral-800 transition-all duration-300 ease-out z-30 flex flex-col ${heightClasses}`}
    >
      {/* 1. Верхняя полоска-ручка для свайпа / клика */}
      <div
        onClick={cycleSheetState}
        className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer select-none group shrink-0"
      >
        <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full group-hover:bg-neutral-400 transition-colors" />
        
        {/* Кнопка с подсказкой свернутого состояния */}
        {sheetState === 'collapsed' && (
          <div className="flex items-center justify-between w-full px-5 mt-1">
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
              {routeData ? `${routeData.scenario_title} • ${routeData.total_route_minutes} мин` : 'Куда пойдем сегодня?'}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
              <span>Развернуть</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>

      {/* 2. Контентная часть со скроллом */}
      {sheetState !== 'collapsed' && (
        <div className="px-5 pb-6 overflow-y-auto space-y-4 flex-1">
          {!routeData ? (
            /* ================= ЭКРАН НАСТРОЙКИ МАРШРУТА ================= */
            <>
              {/* Шапка: Текущий адрес + геолокация */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>Куда пойдем?</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Яндекс Карты
                    </span>
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${isTrackingUser ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                    <span className="font-mono text-[11px]">
                      {startLat.toFixed(4)}, {startLon.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {isTrackingUser ? '• GPS в эфире' : '• выбран старт'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleTracking}
                    title={isTrackingUser ? 'Слежение за GPS включено' : 'Включить авто-слежение'}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all ${
                      isTrackingUser
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300/50'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                    }`}
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isTrackingUser ? 'animate-spin' : ''}`} />
                    <span>{isTrackingUser ? 'Следить' : 'Мое место'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSheetState(sheetState === 'expanded' ? 'normal' : 'expanded')}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  >
                    {sheetState === 'expanded' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 1. Индивидуальный промпт для нейросети */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-neutral-800/80 dark:to-neutral-800/50 p-3.5 rounded-2xl border border-amber-200/60 dark:border-neutral-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>Что вы хотите? (Пожелание нейросети)</span>
                  </label>
                  <span className="text-[10px] text-neutral-400 font-medium">Свободный текст</span>
                </div>

                <div className="relative">
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Например: найти винтажный книжный, кофейню с матчей и красивую набережную..."
                    className="w-full text-xs p-2.5 pr-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                  {customPrompt && (
                    <button
                      type="button"
                      onClick={() => setCustomPrompt('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Быстрые идеи для клика */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {QUICK_PROMPT_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setCustomPrompt(idea)}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-white/80 dark:bg-neutral-900/80 text-neutral-600 dark:text-neutral-300 border border-amber-200/50 dark:border-neutral-700 whitespace-nowrap hover:bg-amber-100 transition-colors"
                    >
                      {idea}
                    </button>
                  ))}
                </div>

                {/* Подключение / статус личного Gemini API ключа */}
                <div className="pt-1 border-t border-amber-200/40 dark:border-neutral-700/60">
                  <button
                    type="button"
                    onClick={() => setShowKeyField(!showKeyField)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>{apiKey ? '✓ Личный ключ Gemini подключен' : 'Подключить личный Google Gemini API ключ'}</span>
                  </button>

                  {showKeyField && (
                    <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-amber-300/70 dark:border-neutral-700 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-[10px] text-neutral-500">
                        <span>Google Gemini API Key:</span>
                        {apiKey && <span className="text-emerald-500 font-bold">Активен (Google 2.0/2.5 Flash)</span>}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setApiKey(val);
                            if (val) localStorage.setItem('sbs_gemini_key', val);
                            else localStorage.removeItem('sbs_gemini_key');
                          }}
                          placeholder="Вставьте AIzaSy..."
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        {apiKey && (
                          <button
                            type="button"
                            onClick={() => {
                              setApiKey('');
                              localStorage.removeItem('sbs_gemini_key');
                            }}
                            className="text-[10px] px-2 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer font-medium"
                          >
                            Сбросить
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-tight">
                        Ключ сохраняется в вашем браузере. Если ключ не указан, автоматически работает встроенная быстрая нейросеть.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Выбор сценария (Тарифы Яндекс Go) */}
              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 block">
                  Основной сценарий
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SCENARIOS.map((sc) => {
                    const Icon = sc.icon;
                    const isSelected = scenario === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setScenario(sc.id)}
                        className={`p-2.5 rounded-2xl text-left border transition-all ${
                          isSelected
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-md'
                            : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400 dark:text-amber-600' : 'text-neutral-400'}`} />
                            {sc.title}
                          </span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        </div>
                        <span className={`text-[10px] line-clamp-1 ${isSelected ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                          {sc.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Выбор действий (Активности) */}
              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 block">
                  Чем хотите заняться по пути? (Выбор действий)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITIES.map((act) => {
                    const active = selectedActivities.includes(act.id);
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => toggleActivity(act.id)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
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

              {/* 4. Выбор времени прогулки */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Время прогулки
                  </span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                    {duration} минут ({Math.floor(duration / 60)}ч {duration % 60 ? `${duration % 60}м` : ''})
                  </span>
                </div>

                {/* Чипы быстрого выбора */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {TIME_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setDuration(chip.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                        duration === chip.value
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm font-bold'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Ползунок для точной настройки */}
                <input
                  type="range"
                  min="20"
                  max="180"
                  step="10"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-[#FFCC00] mt-2"
                />
              </div>

              {/* 5. Настройка количества остановок (динамически от времени + ручной выбор) */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200 dark:border-neutral-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-500" />
                    Остановки по маршруту:
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {manualStopCount === 0 ? `Авто (${effectiveStops} точек)` : `${manualStopCount} точек`}
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
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                        manualStopCount === btn.val
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900'
                          : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Закольцевать маршрут */}
              <div className="flex items-center justify-between py-1">
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

              {/* 7. Главная кнопка в стиле Яндекс Go */}
              <button
                type="button"
                onClick={handleBuildRoute}
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
                  isLoading
                    ? 'bg-amber-300 text-neutral-700 cursor-wait'
                    : 'bg-[#FFCC00] hover:bg-[#F5C400] text-neutral-950 shadow-amber-500/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-900/30 border-t-neutral-900 rounded-full animate-spin" />
                    <span>Нейросеть прокладывает маршрут...</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    <span>Построить маршрут ({effectiveStops} точек)</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* ================= ЭКРАН ГОТОВОГО МАРШРУТА ================= */
            <>
              {/* Сводка маршрута */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                      {routeData.scenario_title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold">
                      {routeData.ai_model || 'AI Route'}
                    </span>
                  </div>

                  <h3 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-white mt-0.5">
                    {Math.floor(routeData.total_route_minutes / 60) > 0 ? `${Math.floor(routeData.total_route_minutes / 60)} ч ` : ''}
                    {routeData.total_route_minutes % 60 ? `${routeData.total_route_minutes % 60} мин` : ''}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                    <span className="flex items-center gap-1 font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-lg">
                      <Footprints className="w-3.5 h-3.5 text-neutral-400" />
                      {(routeData.total_distance_meters / 1000).toFixed(1)} км шагом ({routeData.total_walking_minutes} мин.)
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
                      <Coffee className="w-3.5 h-3.5 text-amber-500" />
                      {Math.max(0, routeData.total_route_minutes - routeData.total_walking_minutes)} мин. отдых и беседы
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      • {routeData.stops.length} остановок
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Изменить
                </button>
              </div>

              {/* Замысел маршрута от нейросети */}
              {routeData.ai_thought && (
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-850 border border-amber-300/50 dark:border-amber-500/30 rounded-2xl p-3.5 shadow-sm space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                    <span>Замысел прогулки от нейросети</span>
                    <span className="text-[10px] ml-auto px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-semibold truncate max-w-[130px]">
                      {routeData.ai_model || 'AI Архитектор'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200">
                    {routeData.ai_thought}
                  </p>
                </div>
              )}

              {/* Кнопка навигации в Яндекс Картах */}
              <button
                type="button"
                onClick={openInYandexMaps}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FC3F1D] hover:bg-[#E53818] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                <Navigation className="w-4 h-4" />
                <span>Поехать по маршруту в Яндекс Картах</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>

              {/* Список остановок (Таймлайн) */}
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                  Остановки маршрута ({routeData.stops.length}):
                </span>

                {routeData.stops.map((stop, idx) => {
                  const isSelected = activeStopIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectStop(idx)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-900 dark:border-white shadow-sm ring-1 ring-neutral-900 dark:ring-white'
                          : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-snug">
                            {stop.name}
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 shrink-0">
                          {stop.spent_minutes} мин.
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 pl-7">
                        {stop.category}
                      </div>

                      <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-2 pl-7 leading-relaxed">
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
