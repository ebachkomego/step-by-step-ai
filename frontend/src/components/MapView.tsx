import React, { useEffect, useRef } from 'react';
import type { RouteResponse, RouteStop, MapLayerType } from '../types';
import { Layers, Plus, Minus, Navigation, Flag } from 'lucide-react';

declare global {
  interface Window {
    ymaps?: any;
    sbsOpenStop?: (idx: number) => void;
  }
}

interface MapViewProps {
  startLat: number;
  startLon: number;
  endLat?: number | null;
  endLon?: number | null;
  endName?: string;
  endAddress?: string;
  userLat: number | null;
  userLon: number | null;
  routeData: RouteResponse | null;
  onMapClick: (lat: number, lon: number) => void;
  isPickingEndLocation?: boolean;
  onSelectEndLocation?: (lat: number, lon: number) => void;
  onCancelPickingEnd?: () => void;
  activeStopIndex: number | null;
  isDark: boolean;
  mapType: MapLayerType;
  isTrackingUser?: boolean;
  onToggleLayers?: () => void;
  onLocateUser?: () => void;
  onSelectStop?: (index: number) => void;
  onOpenPlaceDetails?: (stop: RouteStop, index: number) => void;
  isDesktopCollapsed?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  startLat,
  startLon,
  endLat = null,
  endLon = null,
  endName,
  endAddress: _endAddress,
  userLat,
  userLon,
  routeData,
  onMapClick,
  isPickingEndLocation = false,
  onSelectEndLocation,
  onCancelPickingEnd,
  activeStopIndex,
  isDark,
  mapType,
  isTrackingUser = false,
  onToggleLayers,
  onLocateUser,
  onSelectStop,
  onOpenPlaceDetails,
  isDesktopCollapsed = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userPlacemarkRef = useRef<any>(null);
  const startPlacemarkRef = useRef<any>(null);
  const endPlacemarkRef = useRef<any>(null);
  const routeCollectionRef = useRef<any>(null);
  const isLoadedRef = useRef<boolean>(false);
  const lastRenderedRouteIdRef = useRef<any>(null);

  const isPickingEndRef = useRef(isPickingEndLocation);
  isPickingEndRef.current = isPickingEndLocation;

  const onSelectEndRef = useRef(onSelectEndLocation);
  onSelectEndRef.current = onSelectEndLocation;

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Глобальный хэндлер для клика по кнопке внутри балуна Яндекс Карт
  useEffect(() => {
    window.sbsOpenStop = (idx: number) => {
      if (routeData && routeData.stops && routeData.stops[idx]) {
        if (onSelectStop) onSelectStop(idx);
        if (onOpenPlaceDetails) onOpenPlaceDetails(routeData.stops[idx], idx);
      }
    };
    return () => {
      delete window.sbsOpenStop;
    };
  }, [routeData, onSelectStop, onOpenPlaceDetails]);

  // Хелпер применения типа карты (Схема, Спутник, Гибрид)
  const applyMapType = (map: any, type: MapLayerType, _dark: boolean) => {
    if (!map || !window.ymaps) return;

    try {
      if (type === 'satellite') {
        map.setType('yandex#satellite');
      } else if (type === 'hybrid') {
        map.setType('yandex#hybrid');
      } else {
        // Стандартная надежная схема Яндекс Карт с полной доступностью тайлов во всех городах
        map.setType('yandex#map');
      }
    } catch (e) {
      console.warn('Could not set map type:', e);
      try {
        map.setType('yandex#map');
      } catch (_) {}
    }
  };

  // 1. Инициализация карты
  useEffect(() => {
    if (!containerRef.current) return;

    const initMap = () => {
      if (!window.ymaps || mapInstanceRef.current) return;

      window.ymaps.ready(() => {
        if (!containerRef.current) return;

        try {
          const map = new window.ymaps.Map(
            containerRef.current,
            {
              center: [startLat, startLon],
              zoom: 14,
              controls: [],
            },
            {
              suppressMapOpenBlock: true,
              yandexMapDisablePoiInteractivity: false,
            }
          );

          mapInstanceRef.current = map;

          applyMapType(map, mapType, isDark);

          const routeCollection = new window.ymaps.GeoObjectCollection();
          map.geoObjects.add(routeCollection);
          routeCollectionRef.current = routeCollection;

          // Клик по карте для выбора произвольной точки старта или финиша
          map.events.add('click', (e: any) => {
            const coords = e.get('coords');
            if (coords && coords.length === 2) {
              if (isPickingEndRef.current && onSelectEndRef.current) {
                onSelectEndRef.current(coords[0], coords[1]);
              } else if (onMapClickRef.current) {
                onMapClickRef.current(coords[0], coords[1]);
              }
            }
          });

          // Создание стартового маркера
          updateStartMarker(map, startLat, startLon);

          // Создание конечного маркера (если задан)
          if (endLat !== null && endLon !== null) {
            updateEndMarker(map, endLat, endLon, endName);
          }

          // Создание маркера пользователя
          if (userLat !== null && userLon !== null) {
            updateUserMarker(map, userLat, userLon);
          }

          // Если уже есть данные маршрута
          if (routeData) {
            renderRouteObjects(map, routeCollection, routeData, activeStopIndex);
          }

          isLoadedRef.current = true;
        } catch (e) {
          console.error('Map init error:', e);
        }
      });
    };

    if (window.ymaps) {
      initMap();
    } else {
      const interval = setInterval(() => {
        if (window.ymaps) {
          clearInterval(interval);
          initMap();
        }
      }, 200);
      return () => clearInterval(interval);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
        userPlacemarkRef.current = null;
        startPlacemarkRef.current = null;
        endPlacemarkRef.current = null;
        routeCollectionRef.current = null;
      }
    };
  }, []);

  // 2. Обновление слоя и темы карты
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    applyMapType(mapInstanceRef.current, mapType, isDark);
  }, [mapType, isDark]);

  // 3. Обновление маркера старта
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    updateStartMarker(mapInstanceRef.current, startLat, startLon);
    if (!routeData && (endLat === null || endLon === null)) {
      mapInstanceRef.current.panTo([startLat, startLon], { duration: 500, flying: true });
    }
  }, [startLat, startLon, routeData]);

  // 4. Обновление маркера финиша
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    updateEndMarker(mapInstanceRef.current, endLat, endLon, endName);
  }, [endLat, endLon, endName]);

  // 5. Обновление маркера живой геолокации пользователя
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    if (userLat !== null && userLon !== null) {
      updateUserMarker(mapInstanceRef.current, userLat, userLon);
      if (isTrackingUser && !routeData) {
        mapInstanceRef.current.panTo([userLat, userLon], { duration: 300, flying: false });
      }
    }
  }, [userLat, userLon, isTrackingUser, routeData]);

  // 6. Отрисовка маршрута
  useEffect(() => {
    if (!mapInstanceRef.current || !routeCollectionRef.current || !isLoadedRef.current) return;
    renderRouteObjects(mapInstanceRef.current, routeCollectionRef.current, routeData, activeStopIndex);
  }, [routeData, activeStopIndex]);

  // 7. Автоматическая адаптация размера карты при открытии панели или смене маршрута
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    const t = setTimeout(() => {
      try {
        mapInstanceRef.current.container.fitToViewport();
      } catch (e) {
        // ignore
      }
    }, 200);
    return () => clearTimeout(t);
  }, [routeData, isDesktopCollapsed]);

  // Хэндлеры зума
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setZoom(currentZoom + 1, { duration: 200 });
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setZoom(currentZoom - 1, { duration: 200 });
    }
  };

  // Стартовый маркер
  const updateStartMarker = (map: any, lat: number, lon: number) => {
    if (startPlacemarkRef.current) {
      startPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
    } else {
      const startPlacemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          hintContent: 'Точка старта прогулки',
          balloonContentHeader: '<b style="font-size:14px; color:#10b981">Точка старта</b>',
          balloonContentBody:
            '<div style="font-size:12px; margin-top:4px; line-height:1.4">Отсюда начинается ваш пеший маршрут.<br/><span style="color:#64748b">Кликните по карте, чтобы перенести старт.</span></div>',
        },
        {
          iconLayout: 'default#image',
          iconImageHref: '/start-flag.png',
          iconImageSize: [36, 36],
          iconImageOffset: [-5, -34],
        }
      );
      map.geoObjects.add(startPlacemark);
      startPlacemarkRef.current = startPlacemark;
    }
  };

  // Конечный маркер (Финиш 🏁)
  const updateEndMarker = (map: any, lat: number | null, lon: number | null, name?: string) => {
    if (lat === null || lon === null) {
      if (endPlacemarkRef.current) {
        map.geoObjects.remove(endPlacemarkRef.current);
        endPlacemarkRef.current = null;
      }
      return;
    }

    if (endPlacemarkRef.current) {
      endPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
    } else {
      const endPlacemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          hintContent: name || 'Конечная точка прогулки (Финиш 🏁)',
          balloonContentHeader: '<b style="font-size:14px; color:#e11d48">Точка финиша 🏁</b>',
          balloonContentBody: `<div style="font-size:12px; margin-top:4px; line-height:1.4"><b>${
            name || 'Конечная остановка маршрута'
          }</b><br/><span style="color:#64748b">Сюда ведет завершающий отрезок вашей прогулки.</span></div>`,
        },
        {
          iconLayout: 'default#image',
          iconImageHref: '/finish-flag.png',
          iconImageSize: [36, 36],
          iconImageOffset: [-5, -34],
        }
      );
      map.geoObjects.add(endPlacemark);
      endPlacemarkRef.current = endPlacemark;
    }
  };

  // Маркер пользователя
  const updateUserMarker = (map: any, lat: number, lon: number) => {
    if (userPlacemarkRef.current) {
      userPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
    } else {
      const userPlacemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          hintContent: 'Вы находитесь здесь (GPS)',
          balloonContent:
            '<b>Ваша геопозиция</b><div style="font-size:11px;color:#666">Отслеживается в реальном времени</div>',
        },
        {
          preset: 'islands#geolocationIcon',
          iconColor: '#2563eb',
        }
      );
      map.geoObjects.add(userPlacemark);
      userPlacemarkRef.current = userPlacemark;
    }
  };

  // Отрисовка маршрута и остановок
  const renderRouteObjects = (
    map: any,
    collection: any,
    data: RouteResponse | null,
    activeIndex: number | null
  ) => {
    collection.removeAll();

    if (!data || !data.stops || data.stops.length === 0) {
      return;
    }

    data.stops.forEach((stop: RouteStop, index: number) => {
      const isActive = activeIndex === index;
      const rating = stop.rating ? stop.rating.toFixed(1) : '—';

      const stopPlacemark = new window.ymaps.Placemark(
        [stop.lat, stop.lon],
        {
          iconContent: `${index + 1}`,
          balloonContentHeader: `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <b style="font-size:15px; color:#0f172a;">${index + 1}. ${stop.name}</b>
              ${stop.rating ? `<span style="font-size:12px; font-weight:800; color:#eab308; white-space:nowrap;">★ ${rating}</span>` : ''}
            </div>
            ${stop.is_custom_waypoint ? '<div style="margin-top:2px;"><span style="font-size:10px; font-weight:800; background:#10b981; color:#fff; padding:2px 6px; border-radius:6px;">★ ВАША ТОЧКА ПО ПУТИ</span></div>' : ''}
          `,
          balloonContentBody: `
            <div style="font-size:12px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; min-width:230px; line-height:1.4; padding-top:2px;">
              ${
                stop.photo_url
                  ? `<img src="${stop.photo_url}" style="width:100%; height:110px; object-fit:cover; border-radius:10px; margin-bottom:8px; display:block;" />`
                  : ''
              }
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <span style="color:#d97706; font-weight:700; font-size:11px; text-transform:uppercase;">${stop.category}</span>
                <span style="color:#16a34a; font-weight:600; font-size:11px;">⏱ ~${stop.spent_minutes} мин.</span>
              </div>
              ${stop.arrival_time ? `<div style="color:#0f172a; font-weight:600; font-size:11px; margin-bottom:4px;">🕒 Прибытие: ~${stop.arrival_time}</div>` : ''}
              ${stop.address ? `<div style="color:#64748b; font-size:11px; margin-bottom:4px;">📍 ${stop.address}</div>` : ''}
              <p style="margin:0 0 10px 0; color:#334155; font-size:12px;">${stop.description}</p>
              <button onclick="window.sbsOpenStop && window.sbsOpenStop(${index})" style="width:100%; padding:8px 0; background:#0f172a; color:#ffffff; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer;">
                Смотреть фото и инфо →
              </button>
            </div>
          `,
          hintContent: `${index + 1}. ${stop.name}`,
        },
        {
          preset: isActive
            ? 'islands#redCircleIcon'
            : stop.is_custom_waypoint
            ? 'islands#darkGreenCircleIcon'
            : 'islands#blackCircleIcon',
          iconColor: isActive ? '#fc3f1d' : stop.is_custom_waypoint ? '#10b981' : '#222222',
          balloonCloseButton: true,
          balloonAutoPan: false,
        }
      );

      stopPlacemark.events.add('click', () => {
        if (onSelectStop) onSelectStop(index);
        if (onOpenPlaceDetails) onOpenPlaceDetails(stop, index);
      });

      collection.add(stopPlacemark);

      if (isActive) {
        stopPlacemark.balloon.open();
      }
    });

    const isNewRoute = lastRenderedRouteIdRef.current !== data;
    lastRenderedRouteIdRef.current = data;

    // Пешеходная линия GeoJSON
    if (data.geojson?.geometry?.coordinates) {
      const ymapsPoints = data.geojson.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

      const polyline = new window.ymaps.Polyline(
        ymapsPoints,
        {
          hintContent: `Пешком: ${(data.total_distance_meters / 1000).toFixed(1)} км (${data.total_walking_minutes} мин.)`,
        },
        {
          strokeColor: '#fc3f1d',
          strokeWidth: 5,
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
        }
      );

      collection.add(polyline);

      if (isNewRoute) {
        const bounds = polyline.geometry.getBounds();
        if (bounds && bounds.length === 2) {
          const p1 = bounds[0];
          const p2 = bounds[1];
          const deltaLat = Math.abs(p1[0] - p2[0]);
          const deltaLon = Math.abs(p1[1] - p2[1]);
          // Если точки слишком близко друг к другу (например < 150м), центрируем с безопасным зумом 15
          if (deltaLat < 0.0015 && deltaLon < 0.0015) {
            map.setCenter(p1, 15, { duration: 500 });
          } else {
            map.setBounds(bounds, {
              checkZoomRange: true,
              zoomMargin: [60, 20, 260, 20],
              duration: 500,
            }).then(() => {
              try {
                if (map.getZoom() > 16) map.setZoom(16);
              } catch (_) {}
            });
          }
        }
      } else if (activeStopIndex !== null && data?.stops?.[activeStopIndex]) {
        const targetStop = data.stops[activeStopIndex];
        map.panTo([targetStop.lat, targetStop.lon], { duration: 350, flying: true });
      }
    }
  };

  const isSatelliteOrHybrid = mapType === 'satellite' || mapType === 'hybrid';

  return (
    <div
      className={`absolute inset-0 w-full h-full yandex-map-container overflow-hidden ${
        isSatelliteOrHybrid ? 'satellite-active' : ''
      }`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Плавающий баннер при выборе точки финиша на карте */}
      {isPickingEndLocation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-rose-600 text-white font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <Flag className="w-4 h-4 animate-bounce" />
          <span>Кликните по карте, чтобы выбрать точку финиша 🏁</span>
          {onCancelPickingEnd && (
            <button
              type="button"
              onClick={onCancelPickingEnd}
              className="px-2 py-0.5 rounded-lg bg-black/30 hover:bg-black/50 text-white text-xs cursor-pointer"
            >
              Отмена
            </button>
          )}
        </div>
      )}

      {/* Плавающие кнопки управления картой */}
      <div
        className={`absolute top-20 z-20 flex flex-col gap-2.5 pointer-events-auto transition-all duration-300 ${
          isDesktopCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-[460px] lg:md:right-[500px]'
        }`}
      >
        {onToggleLayers && (
          <button
            type="button"
            onClick={onToggleLayers}
            title="Слои карты: Схема, Спутник, Гибрид"
            aria-label="Слои карты"
            className="w-11 h-11 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Layers className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
          </button>
        )}

        <div className="flex flex-col rounded-2xl overflow-hidden shadow-lg border border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Приблизить карту"
            aria-label="Приблизить карту"
            className="w-11 h-11 flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer border-b border-neutral-200/60 dark:border-neutral-800"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Отдалить карту"
            aria-label="Отдалить карту"
            className="w-11 h-11 flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        {onLocateUser && (
          <button
            type="button"
            onClick={onLocateUser}
            title={isTrackingUser ? 'Вы привязаны к геолокации' : 'Нажмите, чтобы вернуться к вашей геолокации'}
            aria-label="Мое местоположение"
            className={`w-11 h-11 rounded-2xl shadow-lg border backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
              isTrackingUser
                ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/25 scale-105'
                : 'bg-white/95 dark:bg-neutral-900/95 border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:scale-105 active:scale-95'
            }`}
          >
            <Navigation className={`w-5 h-5 ${isTrackingUser ? 'fill-white text-white' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
};
