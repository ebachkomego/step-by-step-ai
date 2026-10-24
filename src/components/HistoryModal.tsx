import React, { useState } from 'react';
import type { RouteHistoryItem } from '../types';
import { History, Trash2, RotateCcw, X, Star, Footprints, Coffee, Flag, Sparkles } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: RouteHistoryItem[];
  onSelectRoute: (item: RouteHistoryItem) => void;
  onDeleteRoute: (id: string) => void;
  onClearHistory: () => void;
  onToggleFavorite: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectRoute,
  onDeleteRoute,
  onClearHistory,
  onToggleFavorite,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');

  if (!isOpen) return null;

  const favoriteItems = history.filter((item) => item.isFavorite);
  const displayItems = activeTab === 'favorites' ? favoriteItems : history;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Затемненный фон */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Окно истории */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 z-10 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Шапка с вкладками "Все" и "Избранное" */}
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">
                  Прогулки и маршруты
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Повторяйте любимые пешие прогулки в один клик
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {history.length > 0 && activeTab === 'all' && (
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

          {/* Вкладки: Все прогулки vs Избранные */}
          <div className="flex p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <span>Все прогулки</span>
              <span className="px-1.5 py-0.2 rounded-md bg-neutral-200 dark:bg-neutral-700 text-[11px]">
                {history.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-amber-400 text-neutral-950 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>Избранные</span>
              <span className="px-1.5 py-0.2 rounded-md bg-neutral-200 dark:bg-neutral-700 text-[11px]">
                {favoriteItems.length}
              </span>
            </button>
          </div>
        </div>

        {/* Список сохраненных прогулок */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {displayItems.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                {activeTab === 'favorites' ? (
                  <Star className="w-7 h-7 text-amber-400" />
                ) : (
                  <History className="w-7 h-7" />
                )}
              </div>
              <h4 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
                {activeTab === 'favorites' ? 'В избранном пока ничего нет' : 'История прогулок пуста'}
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
                {activeTab === 'favorites'
                  ? 'Нажмите на звёздочку ⭐ на карточке любого маршрута, чтобы сохранить его в избранное и быстро находить.'
                  : 'Создайте маршрут в приложении — он автоматически появится здесь, и вы сможете повторить его в любой момент.'}
              </p>
            </div>
          ) : (
            displayItems.map((item) => {
              const walkingKm = (item.total_distance_meters / 1000).toFixed(1);
              const isFav = !!item.isFavorite;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/70 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all space-y-3"
                >
                  {/* Верхняя строка карточки: название маршрута + дата + избранное + удаление */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
                          {item.scenario_title}
                        </span>
                        <span className="text-[11px] text-neutral-400 shrink-0">• {item.dateFormatted}</span>
                      </div>
                      {item.custom_prompt && (
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mt-1 line-clamp-1 italic">
                          «{item.custom_prompt}»
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Кнопка "В избранное" */}
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(item.id)}
                        title={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isFav
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                            : 'text-neutral-400 hover:text-amber-500 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/60'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>

                      {/* Кнопка "Удалить" */}
                      <button
                        type="button"
                        onClick={() => onDeleteRoute(item.id)}
                        title="Удалить"
                        className="text-neutral-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-700/60 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ключевые показатели прогулки */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-white dark:bg-neutral-900/90 border border-neutral-200/50 dark:border-neutral-700/80 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Время</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white">
                        {item.total_route_minutes} мин
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Дистанция</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white">{walkingKm} км</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Остановки</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white">
                        {item.stopsCount} мест
                      </span>
                    </div>
                  </div>

                  {/* Список остановок (превью) */}
                  {item.stops && item.stops.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.stops.slice(0, 3).map((stop, sIdx) => (
                        <span
                          key={sIdx}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-neutral-200/60 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]"
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
                  )}

                  {/* Кнопка повторить прогулку */}
                  <button
                    type="button"
                    onClick={() => onSelectRoute(item)}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
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
