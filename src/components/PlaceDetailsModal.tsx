import React from 'react';
import type { RouteStop } from '../types';
import { X, Star, MapPin, Clock, Coffee, Sparkles, CheckCircle2 } from 'lucide-react';

interface PlaceDetailsModalProps {
  stop: RouteStop | null;
  onClose: () => void;
  stopIndex?: number | null;
}

export const PlaceDetailsModal: React.FC<PlaceDetailsModalProps> = ({
  stop,
  onClose,
  stopIndex,
}) => {
  if (!stop) return null;

  const rating = stop.rating || 4.8;
  const reviewsCount = stop.reviews_count || 128;
  const tags = stop.tags || ['Wi-Fi', 'Кофе с собой', 'Оплата картой', 'Уютная атмосфера'];
  const reviews = stop.reviews || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Затемненный фон */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Карточка заведения */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 z-10 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Фотография места с градиентом и бейджами */}
        <div className="relative w-full h-52 sm:h-60 bg-neutral-800 shrink-0 overflow-hidden">
          {stop.photo_url ? (
            <img
              src={stop.photo_url}
              alt={stop.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-neutral-400">
              <Coffee className="w-12 h-12 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Кнопка закрытия */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Номер остановки в маршруте */}
          {stopIndex !== undefined && stopIndex !== null && (
            <div className="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-amber-400 text-neutral-950 font-black text-xs shadow-md">
              Остановка #{stopIndex + 1}
            </div>
          )}

          {/* Название и категория на фоне фото */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-300">
              {stop.category}
            </span>
            <h3 className="text-2xl font-black tracking-tight leading-tight mt-0.5 drop-shadow-sm">
              {stop.name}
            </h3>
          </div>
        </div>

        {/* Контент с отзывами и параметрами */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Рейтинг, адрес и часы работы */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            {/* Рейтинг со звёздочкой */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/40 text-amber-700 dark:text-amber-300 font-extrabold text-sm">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{rating.toFixed(1)}</span>
              <span className="text-xs opacity-75 font-medium">({reviewsCount} оценок)</span>
            </div>

            {/* Часы работы */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{stop.opening_hours || 'Открыто сейчас'}</span>
            </div>

            {/* Время на остановке */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs ml-auto">
              <Coffee className="w-3.5 h-3.5 text-amber-500" />
              <span>~{stop.spent_minutes} мин на отдых</span>
            </div>
          </div>

          {/* Адрес */}
          {stop.address && (
            <div className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
              <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
              <span>{stop.address}</span>
            </div>
          )}

          {/* Описание / почему выбрано это место */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 space-y-1">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              О месте и атмосфере
            </span>
            <p className="text-xs md:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium">
              {stop.description}
            </p>
          </div>

          {/* Теги особенностей */}
          {tags && tags.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                Особенности и удобства:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Отзывы посетителей */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-neutral-900 dark:text-white">
                Отзывы посетителей ({reviews.length}):
              </span>
              <span className="text-xs text-neutral-400">Проверенные оценки</span>
            </div>

            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-400 text-neutral-950 font-black text-xs flex items-center justify-center">
                        {rev.author.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {rev.author}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{rev.rating}.0</span>
                      <span className="text-[10px] text-neutral-400 pl-1 font-normal">
                        {rev.date}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal">
                    «{rev.text}»
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Нижняя кнопка закрытия */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlaceDetailsModal;
