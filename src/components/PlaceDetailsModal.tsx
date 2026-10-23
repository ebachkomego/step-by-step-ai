import React, { useState } from 'react';
import type { RouteStop } from '../types';
import {
  X,
  Star,
  MapPin,
  Clock,
  Coffee,
  Sparkles,
  CheckCircle2,
  Plus,
  Check,
  Navigation,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CameraOff,
  Flag,
} from 'lucide-react';
import { getSatellitePhotoUrl, getSchemePhotoUrl } from '../services/realPlacesService';

interface PlaceDetailsModalProps {
  stop: RouteStop | null;
  onClose: () => void;
  stopIndex?: number | null;
  isWaypoint?: boolean;
  onToggleWaypoint?: (stop: RouteStop) => void;
  onSetAsStart?: (stop: RouteStop) => void;
  onSetAsFinish?: (stop: RouteStop) => void;
}

export const PlaceDetailsModal: React.FC<PlaceDetailsModalProps> = ({
  stop,
  onClose,
  stopIndex,
  isWaypoint = false,
  onToggleWaypoint,
  onSetAsStart,
  onSetAsFinish,
}) => {
  if (!stop) return null;

  const realPhotos = stop.photos && stop.photos.length > 0 ? stop.photos : stop.photo_url ? [stop.photo_url] : [];
  const hasRealPhotos = realPhotos.length > 0;

  const [activeMediaTab, setActiveMediaTab] = useState<'photo' | 'satellite' | 'scheme'>(
    hasRealPhotos ? 'photo' : 'satellite'
  );
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState<number>(0);
  const [photoError, setPhotoError] = useState<boolean>(false);

  const satelliteUrl = stop.satellite_url || getSatellitePhotoUrl(stop.lat, stop.lon);
  const schemeUrl = getSchemePhotoUrl(stop.lat, stop.lon);

  let currentDisplayImage = satelliteUrl;
  if (activeMediaTab === 'photo' && hasRealPhotos && !photoError) {
    currentDisplayImage = realPhotos[currentPhotoIdx % realPhotos.length];
  } else if (activeMediaTab === 'scheme') {
    currentDisplayImage = schemeUrl;
  } else {
    currentDisplayImage = satelliteUrl;
  }

  const tags = stop.tags || ['Пешая доступность', 'Красивая локация'];
  const yandexUrl =
    stop.yandex_url ||
    `https://yandex.ru/maps/?text=${encodeURIComponent(stop.name + ' ' + (stop.address || ''))}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Затемненный фон */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Карточка заведения */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 z-10 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Фотография места с галереей и бейджами */}
        <div className="relative w-full h-56 sm:h-64 bg-neutral-900 shrink-0 overflow-hidden">
          <img
            key={currentDisplayImage}
            src={currentDisplayImage}
            alt={stop.name}
            onError={() => {
              if (activeMediaTab === 'photo') setPhotoError(true);
            }}
            className="w-full h-full object-cover transition-all duration-300"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

          {/* Плашка отсутствия реальных фотографий */}
          {!hasRealPhotos && activeMediaTab === 'photo' && (
            <div className="absolute top-14 left-4 right-4 p-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center gap-2 text-xs">
              <CameraOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Фотографии заведения отсутствуют. Отображается спутниковый снимок.</span>
            </div>
          )}

          {/* Переключатель вкладок медиа: Фото / Спутник / Схема */}
          <div className="absolute top-3.5 right-13 flex items-center bg-black/60 backdrop-blur-md rounded-full p-0.5 border border-white/20 z-10">
            {hasRealPhotos && (
              <button
                type="button"
                onClick={() => {
                  setActiveMediaTab('photo');
                  setPhotoError(false);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                  activeMediaTab === 'photo' && !photoError
                    ? 'bg-amber-400 text-neutral-950 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                📷 Фото {realPhotos.length > 1 ? `(${realPhotos.length})` : ''}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveMediaTab('satellite')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                activeMediaTab === 'satellite' || (!hasRealPhotos && activeMediaTab === 'photo')
                  ? 'bg-amber-400 text-neutral-950 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              🛰️ Спутник
            </button>
            <button
              type="button"
              onClick={() => setActiveMediaTab('scheme')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                activeMediaTab === 'scheme'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              🗺️ Схема
            </button>
          </div>

          {/* Кнопки перелистывания фото (если фотографий несколько) */}
          {activeMediaTab === 'photo' && realPhotos.length > 1 && (
            <div className="absolute inset-y-0 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentPhotoIdx((prev) => (prev > 0 ? prev - 1 : realPhotos.length - 1));
                }}
                className="pointer-events-auto w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentPhotoIdx((prev) => (prev + 1) % realPhotos.length);
                }}
                className="pointer-events-auto w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Индикатор текущего фото */}
          {activeMediaTab === 'photo' && realPhotos.length > 1 && (
            <div className="absolute top-14 right-4 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white z-10">
              {currentPhotoIdx + 1} / {realPhotos.length}
            </div>
          )}

          {/* Кнопка закрытия */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Бейджи на фото */}
          <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 z-10">
            {stopIndex !== undefined && stopIndex !== null && (
              <div className="px-3 py-1 rounded-full bg-amber-400 text-neutral-950 font-black text-xs shadow-md">
                Остановка #{stopIndex + 1}
              </div>
            )}
            {(isWaypoint || stop.is_custom_waypoint) && (
              <div className="px-3 py-1 rounded-full bg-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Точка по пути</span>
              </div>
            )}
          </div>

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

        {/* Контент с параметрами заведения */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Рейтинг, часы работы и время на отдых */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            {stop.rating ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/40 text-amber-700 dark:text-amber-300 font-extrabold text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{stop.rating.toFixed(1)}</span>
                {stop.reviews_count && (
                  <span className="text-xs opacity-75 font-medium">({stop.reviews_count} оценок)</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium text-xs">
                <span>Проверенная локация</span>
              </div>
            )}

            {/* Часы работы */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{stop.opening_hours || 'Открыто для посещения'}</span>
            </div>

            {/* Время на отдых */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs ml-auto">
              <Coffee className="w-3.5 h-3.5 text-amber-500" />
              <span>~{stop.spent_minutes} мин на отдых</span>
            </div>
          </div>

          {/* Тайминг прибытия и отправления по реальному времени */}
          {stop.arrival_time && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 text-xs font-semibold text-amber-900 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Прибытие: ~{stop.arrival_time}</span>
              </span>
              {stop.departure_time && <span>Отправление дальше: ~{stop.departure_time}</span>}
            </div>
          )}

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

          {/* Блок проверенных отзывов в Яндекс Картах (без выдуманных текстов) */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Реальные отзывы гостей</span>
              </span>
              <span className="text-[11px] text-neutral-400">Официальные данные</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Мы не генерируем фальшивые отзывы. Вы можете посмотреть оценки, отзывы и фотографии реальных посетителей прямо на карточке заведения:
            </p>
            <a
              href={yandexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400/90 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <span>Смотреть отзывы и фото в Яндекс Картах</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Нижние кнопки действий */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col sm:flex-row items-center gap-2">
          {onToggleWaypoint && (
            <button
              type="button"
              onClick={() => onToggleWaypoint(stop)}
              className={`w-full sm:flex-1 py-3 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                isWaypoint || stop.is_custom_waypoint
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-neutral-950'
              }`}
            >
              {isWaypoint || stop.is_custom_waypoint ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>✓ В вашем маршруте (убрать)</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>+ Посетить по пути</span>
                </>
              )}
            </button>
          )}

          {onSetAsStart && (
            <button
              type="button"
              onClick={() => {
                onSetAsStart(stop);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              title="Сделать это место началом прогулки"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-500" />
              <span>Старт отсюда</span>
            </button>
          )}

          {onSetAsFinish && (
            <button
              type="button"
              onClick={() => {
                onSetAsFinish(stop);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              title="Сделать это место конечной точкой прогулки"
            >
              <Flag className="w-3.5 h-3.5 text-rose-500" />
              <span>Финиш здесь</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-neutral-200/80 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlaceDetailsModal;
