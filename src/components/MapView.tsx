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
}

export const MapView: React.FC<MapViewProps> = ({
  startLat,
  startLon,
  userLat,
  userLon,
  routeData,
  onMapClick,
  activeStopIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const isLoadedRef = useRef<boolean>(false);

  // Инициализация Яндекс Карт
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
            controls: [] // Минималистичные кастомные контролы
          }, {
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: false
          });

          mapInstanceRef.current = map;
          isLoadedRef.current = true;

          // Клик по карте для выбора точки
          map.events.add('click', (e: any) => {
            const coords = e.get('coords');
            if (coords && coords.length === 2) {
              onMapClick(coords[0], coords[1]);
            }
          });

          renderAllLayers(map);
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
      }
    };
  }, []);

  // Перерисовка слоев при изменении маршрута, точки старта или выбранной остановки
  useEffect(() => {
    if (mapInstanceRef.current && isLoadedRef.current) {
      renderAllLayers(mapInstanceRef.current);
    }
  }, [startLat, startLon, userLat, userLon, routeData, activeStopIndex]);

  const renderAllLayers = (map: any) => {
    map.geoObjects.removeAll();

    // 1. Текущее местоположение пользователя (если доступно и отличается от точки старта)
    if (userLat !== null && userLon !== null) {
      const isStartSameAsUser = Math.abs(startLat - userLat) < 0.0001 && Math.abs(startLon - userLon) < 0.0001;
      if (!isStartSameAsUser) {
        const userPlacemark = new window.ymaps.Placemark(
          [userLat, userLon],
          {
            hintContent: 'Вы находитесь здесь',
            balloonContent: 'Ваша текущая геопозиция'
          },
          {
            preset: 'islands#geolocationIcon',
            iconColor: '#2563eb'
          }
        );
        map.geoObjects.add(userPlacemark);
      }
    }

    // 2. Точка старта (Яндекс-стиль)
    const startPlacemark = new window.ymaps.Placemark(
      [startLat, startLon],
      {
        hintContent: 'Начало маршрута',
        balloonContentHeader: '<b style="font-size:14px; color:#16a34a">Точка старта</b>',
        balloonContentBody: '<div style="font-size:12px; margin-top:4px">Отсюда начнется ваша прогулка. Кликните по карте, чтобы перенести.</div>'
      },
      {
        preset: 'islands#darkGreenDotIconWithCaption',
        iconCaption: 'Старт'
      }
    );
    map.geoObjects.add(startPlacemark);

    // 3. Если есть построенный маршрут
    if (routeData && routeData.stops && routeData.stops.length > 0) {
      // Маркеры остановок
      routeData.stops.forEach((stop: RouteStop, index: number) => {
        const isActive = activeStopIndex === index;
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

        map.geoObjects.add(stopPlacemark);

        if (isActive) {
          stopPlacemark.balloon.open();
        }
      });

      // Линия пешеходного маршрута по реальным улицам
      if (routeData.geojson?.geometry?.coordinates) {
        // Координаты GeoJSON [lon, lat] -> Яндекс [lat, lon]
        const ymapsPoints = routeData.geojson.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

        const polyline = new window.ymaps.Polyline(
          ymapsPoints,
          {
            hintContent: `Пешком: ${(routeData.total_distance_meters / 1000).toFixed(1)} км (${routeData.total_walking_minutes} мин.)`
          },
          {
            strokeColor: '#fc3f1d', // Фирменный красный акцент Яндекс
            strokeWidth: 5,
            strokeOpacity: 0.9,
            strokeStyle: 'solid'
          }
        );

        map.geoObjects.add(polyline);

        // Плавная анимация к границам маршрута с учетом шторки снизу
        const bounds = polyline.geometry.getBounds();
        if (bounds) {
          map.setBounds(bounds, {
            checkZoomRange: true,
            zoomMargin: [60, 20, 260, 20], // Отступ снизу для шторки
            duration: 500
          });
        }
      }
    } else {
      map.setCenter([startLat, startLon], 14, { duration: 300 });
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full yandex-map-container overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
