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
  ExternalLink
} from 'lucide-react';

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
}) => {
  const [scenario, setScenario] = useState<string>('date');
  const [duration, setDuration] = useState<number>(60);
  const [isCircular, setIsCircular] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const handleBuildRoute = () => {
    onSubmit({
      start_lat: startLat,
      start_lon: startLon,
      duration_minutes: duration,
      scenario,
      is_circular: isCircular,
    });
  };

  // Ссылка для открытия маршрута в нативных Яндекс Картах
  const openInYandexMaps = () => {
    if (!routeData || !routeData.stops.length) return;
    const rtext = [
      `${startLat},${startLon}`,
      ...routeData.stops.map(s => `${s.lat},${s.lon}`),
      ...(isCircular ? [`${startLat},${startLon}`] : [])
    ].join('~');
    const url = `https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`;
    window.open(url, '_blank');
  };

  return (
    <div
      className={`fixed bottom-0 inset-x-0 mx-auto w-full max-w-xl bg-white dark:bg-neutral-900 shadow-2xl rounded-t-3xl border-t border-neutral-200 dark:border-neutral-800 transition-all duration-300 z-30 flex flex-col ${
        isExpanded ? 'max-h-[82vh]' : 'max-h-[140px]'
      }`}
    >
      {/* Ручка шторки (Drag handle как в Яндекс Go) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full pt-3 pb-1.5 flex items-center justify-center cursor-pointer group"
        aria-label="Свернуть/развернуть"
      >
        <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full group-hover:bg-neutral-400 transition-colors" />
      </button>

      {/* Контентная часть */}
      <div className="px-5 pb-6 overflow-y-auto space-y-4">
        {!routeData ? (
          /* ================= ЭКРАН НАСТРОЙКИ МАРШРУТА ================= */
          <>
            {/* Заголовок и текущая точка */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Куда пойдем?
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="font-mono text-[11px]">
                    {startLat.toFixed(4)}, {startLon.toFixed(4)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onCurrentLocation}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-500" />
                <span>Мое место</span>
              </button>
            </div>

            {isExpanded && (
              <>
                {/* Выбор сценария (Тарифы Яндекс Go) */}
                <div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SCENARIOS.map((sc) => {
                      const Icon = sc.icon;
                      const isSelected = scenario === sc.id;
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => setScenario(sc.id)}
                          className={`p-3 rounded-2xl text-left border transition-all ${
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
                            {isSelected && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                          </div>
                          <span className={`text-[10px] line-clamp-1 ${isSelected ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                            {sc.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Время прогулки (Чипы в 1 тап) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Время прогулки
                    </span>
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      {duration} мин.
                    </span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {TIME_CHIPS.map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => setDuration(chip.value)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                          duration === chip.value
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Переключатель: Вернуться в старт */}
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
                    className="w-4 h-4 rounded text-neutral-900 accent-neutral-900 dark:accent-amber-400 cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* Главная кнопка в стиле Яндекс Go */}
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
                  <span>Прокладываем маршрут...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4" />
                  <span>Построить маршрут</span>
                </>
              )}
            </button>
          </>
        ) : (
          /* ================= ЭКРАН ГОТОВОГО МАРШРУТА ================= */
          <>
            {/* Сводка */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                  {routeData.scenario_title}
                </span>
                <h3 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-white mt-0.5">
                  {Math.floor(routeData.total_route_minutes / 60) > 0 ? `${Math.floor(routeData.total_route_minutes / 60)} ч ` : ''}
                  {routeData.total_route_minutes % 60 ? `${routeData.total_route_minutes % 60} мин` : ''}
                </h3>
                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3.5 h-3.5 text-neutral-400" />
                    {(routeData.total_distance_meters / 1000).toFixed(1)} км пешком ({routeData.total_walking_minutes} мин.)
                  </span>
                  <span>•</span>
                  <span>{routeData.stops.length} остановки</span>
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

            {/* Быстрое действие: Открыть в Яндекс Картах для навигации */}
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
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Остановки прогулки
              </span>

              {routeData.stops.map((stop, idx) => {
                const isSelected = activeStopIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => onSelectStop(idx)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
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
    </div>
  );
};
