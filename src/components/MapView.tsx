import React, { useEffect, useRef } from 'react';
import type { RouteResponse, RouteStop } from '../types';

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
  isTrackingUser?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  startLat,
  startLon,
  userLat,
  userLon,
  routeData,
  onMapClick,
  activeStopIndex,
  isTrackingUser = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userPlacemarkRef = useRef<any>(null);
  const startPlacemarkRef = useRef<any>(null);
  const routeCollectionRef = useRef<any>(null);
  const isLoadedRef = useRef<boolean>(false);

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

  // 2. Обновление маркера старта при изменении startLat / startLon
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoadedRef.current) return;
    updateStartMarker(mapInstanceRef.current, startLat, startLon);
  }, [startLat, startLon]);

  // 3. Обновление маркера живой геолокации пользователя при изменении userLat / userLon
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

  // 4. Отрисовка маршрута при изменении данных или активной остановки
  useEffect(() => {
    if (!mapInstanceRef.current || !routeCollectionRef.current || !isLoadedRef.current) return;
    renderRouteObjects(mapInstanceRef.current, routeCollectionRef.current, routeData, activeStopIndex);
  }, [routeData, activeStopIndex]);

  // Хелпер: Обновление / создание маркера старта
  const updateStartMarker = (map: any, lat: number, lon: number) => {
    if (startPlacemarkRef.current) {
      startPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
    } else {
      const startPlacemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          hintContent: 'Точка старта',
          balloonContentHeader: '<b style="font-size:14px; color:#16a34a">Точка старта</b>',
          balloonContentBody: '<div style="font-size:12px; margin-top:4px">Отсюда начинается прогулка. Нажмите на карту для выбора другого места.</div>'
        },
        {
          preset: 'islands#darkGreenDotIconWithCaption',
          iconCaption: 'Старт'
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

  return (
    <div className="absolute inset-0 w-full h-full yandex-map-container overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default MapView;
