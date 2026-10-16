import React, { useEffect, useRef } from 'react';
import type { RouteResponse, RouteStop, MapLayerType } from '../types';
import { Layers, Plus, Minus, Navigation } from 'lucide-react';

declare global {
  interface Window {
    ymaps?: any;
  }
}

interface MapViewProps {
  startLat: number;
  startLon: number;
  userLat: number | null;
  userLon: number | null;
  routeData: RouteResponse | null;
  onMapClick: (lat: number, lon: number) => void;
  activeStopIndex: number | null;
  isDark: boolean;
  mapType: MapLayerType;
  isTrackingUser?: boolean;
  onToggleLayers?: () => void;
  onLocateUser?: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  startLat,
  startLon,
  userLat,
  userLon,
  routeData,
  onMapClick,
  activeStopIndex,
  isDark,
  mapType,
  isTrackingUser = false,
  onToggleLayers,
  onLocateUser,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userPlacemarkRef = useRef<any>(null);
  const startPlacemarkRef = useRef<any>(null);
  const routeCollectionRef = useRef<any>(null);
  const isLoadedRef = useRef<boolean>(false);

  // Хелпер применения типа карты (Схема, Спутник, Гибрид, Нативная темная тема Яндекса)
  const applyMapType = (map: any, type: MapLayerType, dark: boolean) => {
    if (!map || !window.ymaps) return;

    try {
      if (type === 'satellite') {
        map.setType('yandex#satellite');
      } else if (type === 'hybrid') {
        map.setType('yandex#hybrid');
      } else {
        // Режим 'map' (Схема)
        if (dark) {
          try {
            // Проверяем / регистрируем нативный темный слой Яндекс Карт
            if (window.ymaps.layer && window.ymaps.layer.storage) {
              if (!window.ymaps.layer.storage.get('custom#dark')) {
                window.ymaps.layer.storage.add('custom#dark', function () {
                  return new window.ymaps.Layer(
                    'https://core-renderer-tiles.maps.yandex.net/tiles?l=map&theme=dark&%c&%l',
                    { tileTransparent: false }
                  );
                });
                window.ymaps.mapType.storage.add(
                  'custom#dark',
                  new window.ymaps.MapType('Схема (темная)', ['custom#dark'])
                );
              }
              map.setType('custom#dark');
              return;
            }
          } catch (layerErr) {
            console.warn('Native dark layer registration fallback:', layerErr);
          }
          map.setType('yandex#map');
        } else {
          map.setType('yandex#map');
        }
      }
    } catch (e) {
      console.warn('Could not set map type:', e);
      try {
        map.setType('yandex#map');
      } catch (_) {}
    }
  };

  // 1. Инициализация Яндекс Карт
  useEffect(() => {
    if (!containerRef.current) return;

    const initMap = () => {
      if (!window.ymaps || mapInstanceRef.current) return;

      window.ymaps.ready(() => {
        if (!containerRef.current) return;

        try {
          const map = new window.ymaps.Map(containerRef.current, {
            center: [startLat, startLon],
            zoom: 14,
            controls: [] // Минималистичный чистый вид в стиле Яндекс Go
          }, {
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: false
          });

          mapInstanceRef.current = map;

          // Применяем текущий слой (Схема / Спутник / Гибрид / Темный)
          applyMapType(map, mapType, isDark);

          // Коллекция для элементов маршрута (остановки и трек)
          const routeCollection = new window.ymaps.GeoObjectCollection();
          map.geoObjects.add(routeCollection);
          routeCollectionRef.current = routeCollection;

          // Клик по карте для выбора произвольной точки старта
          map.events.add('click', (e: any) => {
            const coords = e.get('coords');
            if (coords && coords.length === 2) {
              onMapClick(coords[0], coords[1]);
            }
          });

          // Создание стартового маркера
          updateStartMarker(map, startLat, startLon);

          // Создание маркера пользователя, если координаты уже есть
          if (userLat !== null && userLon !== null) {
            updateUserMarker(map, userLat, userLon);
          }

          // Если уже есть данные маршрута
          if (routeData) {
            renderRouteObjects(map, routeCollection, routeData, activeStopIndex);
          }

          isLoadedRef.current = true;
        } catch (e) {
          console.error('Yandex Maps init error:', e);
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
        routeCollectionRef.current = null;
      }
    };
  }, []);

  // 2. Обновление слоя и темы карты при изменении mapType или isDark
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    applyMapType(mapInstanceRef.current, mapType, isDark);
  }, [mapType, isDark]);

  // 3. Обновление маркера старта при изменении startLat / startLon
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    updateStartMarker(mapInstanceRef.current, startLat, startLon);
  }, [startLat, startLon]);

  // 4. Обновление маркера живой геолокации пользователя при изменении userLat / userLon
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    if (userLat !== null && userLon !== null) {
      updateUserMarker(mapInstanceRef.current, userLat, userLon);
      
      // Если включено авто-слежение и нет активного маршрута — плавно центрируем
      if (isTrackingUser && !routeData) {
        mapInstanceRef.current.panTo([userLat, userLon], { duration: 300, flying: false });
      }
    }
  }, [userLat, userLon, isTrackingUser, routeData]);

  // 5. Отрисовка маршрута при изменении данных или активной остановки
  useEffect(() => {
    if (!mapInstanceRef.current || !routeCollectionRef.current || !isLoadedRef.current) return;
    renderRouteObjects(mapInstanceRef.current, routeCollectionRef.current, routeData, activeStopIndex);
  }, [routeData, activeStopIndex]);

  // Хэндлеры для кнопок масштабирования
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

  // Хелпер: Обновление / создание маркера старта (минималистичный синий пин)
  const updateStartMarker = (map: any, lat: number, lon: number) => {
    if (startPlacemarkRef.current) {
      startPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
    } else {
      const startPlacemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          hintContent: 'Точка старта прогулки',
          balloonContentHeader: '<b style="font-size:14px; color:#2b79c2">Точка старта</b>',
          balloonContentBody: '<div style="font-size:12px; margin-top:4px; line-height:1.4">Отсюда начинается ваш пеший маршрут.<br/><span style="color:#64748b">Кликните по карте в любом месте для смены точки старта.</span></div>'
        },
        {
          iconLayout: 'default#image',
          iconImageHref: '/start-pin.png',
          iconImageSize: [32, 49],
          iconImageOffset: [-16, -49]
        }
      );
      map.geoObjects.add(startPlacemark);
      startPlacemarkRef.current = startPlacemark;
    }
  };

  // Хелпер: Обновление / создание маркера текущего GPS пользователя
  const updateUserMarker = (map: any, lat: number, lon: number) => {
    if (userPlacemarkRef.current) {
      userPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
    } else {
      const userPlacemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          hintContent: 'Вы находитесь здесь (GPS)',
          balloonContent: '<b>Ваша живая геопозиция</b><div style="font-size:11px;color:#666">Отслеживается в реальном времени</div>'
        },
        {
          preset: 'islands#geolocationIcon',
          iconColor: '#2563eb'
        }
      );
      map.geoObjects.add(userPlacemark);
      userPlacemarkRef.current = userPlacemark;
    }
  };

  // Хелпер: Отрисовка остановок и линии маршрута в коллекции
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

    // Добавляем маркеры остановок
    data.stops.forEach((stop: RouteStop, index: number) => {
      const isActive = activeIndex === index;
      const stopPlacemark = new window.ymaps.Placemark(
        [stop.lat, stop.lon],
        {
          iconContent: `${index + 1}`,
          balloonContentHeader: `<b style="font-size:14px">${index + 1}. ${stop.name}</b>`,
          balloonContentBody: `
            <div style="font-size:12px; margin-top:4px; line-height:1.4">
              <div style="color:#64748b; margin-bottom:2px"><b>Категория:</b> ${stop.category}</div>
              <div style="color:#64748b; margin-bottom:4px"><b>Время в точке:</b> ${stop.spent_minutes} мин.</div>
              <p style="margin:0; color:#1e293b">${stop.description}</p>
            </div>
          `,
          hintContent: `${index + 1}. ${stop.name}`
        },
        {
          preset: isActive ? 'islands#redCircleIcon' : 'islands#blackCircleIcon',
          iconColor: isActive ? '#fc3f1d' : '#222222',
          balloonCloseButton: true
        }
      );

      collection.add(stopPlacemark);

      if (isActive) {
        stopPlacemark.balloon.open();
      }
    });

    // Добавляем пешеходную линию GeoJSON
    if (data.geojson?.geometry?.coordinates) {
      const ymapsPoints = data.geojson.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

      const polyline = new window.ymaps.Polyline(
        ymapsPoints,
        {
          hintContent: `Пешком: ${(data.total_distance_meters / 1000).toFixed(1)} км (${data.total_walking_minutes} мин.)`
        },
        {
          strokeColor: '#fc3f1d', // Фирменный акцент Яндекс
          strokeWidth: 5,
          strokeOpacity: 0.9,
          strokeStyle: 'solid'
        }
      );

      collection.add(polyline);

      // Плавный зум к границам маршрута с учетом шторки снизу
      const bounds = polyline.geometry.getBounds();
      if (bounds) {
        map.setBounds(bounds, {
          checkZoomRange: true,
          zoomMargin: [60, 20, 260, 20],
          duration: 500
        });
      }
    }
  };

  const isSatelliteOrHybrid = mapType === 'satellite' || mapType === 'hybrid';

  return (
    <div className={`absolute inset-0 w-full h-full yandex-map-container overflow-hidden ${isSatelliteOrHybrid ? 'satellite-active' : ''} ${isDark && !isSatelliteOrHybrid ? 'native-dark-layer' : ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Плавающие кнопки управления картой справа (в стиле Яндекс Карт из скриншота) */}
      <div className="absolute right-4 top-20 z-20 flex flex-col gap-2.5 pointer-events-auto">
        {/* Кнопка слоев карты */}
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

        {/* Зум + / - */}
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

        {/* Кнопка Мое местоположение на карте */}
        {onLocateUser && (
          <button
            type="button"
            onClick={onLocateUser}
            title="Моё местоположение"
            aria-label="Моё местоположение"
            className="w-11 h-11 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer mt-0.5"
          >
            <Navigation className={`w-5 h-5 ${isTrackingUser ? 'text-emerald-500 fill-emerald-500/20' : 'text-blue-500'}`} />
          </button>
        )}
      </div>
    </div>
  );
};

export default MapView;
