import React from 'react';
import type { RouteHistoryItem } from '../types';
import { History, Trash2, RotateCcw, X, Footprints, Coffee, MapPin, Sparkles } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: RouteHistoryItem[];
  onSelectRoute: (item: RouteHistoryItem) => void;
  onDeleteRoute: (id: string) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectRoute,
  onDeleteRoute,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Затемненный фон */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Окно истории */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 z-10 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Шапка */}
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
                <span>История прогулок</span>
                {history.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {history.length}
                  </span>
                )}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Повторяйте понравившиеся маршруты в один клик
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                title="Очистить всю историю"
                className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                Очистить
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Список сохраненных прогулок */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {history.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                <History className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
                История пуста
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
                Создайте маршрут в приложении — он автоматически сохранится здесь, и вы сможете повторить его в любой момент.
              </p>
            </div>
          ) : (
            history.map((item) => {
              const walkingKm = (item.total_distance_meters / 1000).toFixed(1);
              const restMinutes = Math.max(0, item.total_route_minutes - item.total_walking_minutes);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all space-y-3"
                >
                  {/* Верхняя строка карточки: сценарий + дата + удаление */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                          {item.scenario_title}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          • {item.dateFormatted}
                        </span>
                      </div>
                      {item.custom_prompt && (
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mt-1 line-clamp-1 italic">
                          «{item.custom_prompt}»
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteRoute(item.id)}
                      title="Удалить из истории"
                      className="text-neutral-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Ключевые показатели прогулки */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Время</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white">
                        {item.total_route_minutes} мин
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Дистанция</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white">
                        {walkingKm} км
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Остановки</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white">
                        {item.stopsCount} мест
                      </span>
                    </div>
                  </div>

                  {/* Список ключевых мест (превью) */}
                  {item.stops && item.stops.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1.5">
                        {item.stops.slice(0, 3).map((stop, sIdx) => (
                          <span
                            key={sIdx}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-neutral-200/60 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 truncate max-w-[200px]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            {stop.name}
                          </span>
                        ))}
                        {item.stops.length > 3 && (
                          <span className="text-[11px] text-neutral-400 font-semibold self-center">
                            +{item.stops.length - 3} ещё
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Кнопка повторить прогулку */}
                  <button
                    type="button"
                    onClick={() => onSelectRoute(item)}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Повторить эту прогулку</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
