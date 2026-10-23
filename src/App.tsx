import React, { useState, useEffect, useRef } from 'react';
import { MapView } from './components/MapView';
import { BottomSheet } from './components/BottomSheet';
import { LayersModal } from './components/LayersModal';
import { HistoryModal } from './components/HistoryModal';
import { CitySearchBar } from './components/CitySearchBar';
import { PlaceDetailsModal } from './components/PlaceDetailsModal';
import type { RouteRequest, RouteResponse, MapLayerType, RouteHistoryItem, RouteStop, DesiredWaypoint } from './types';
import { Sun, Moon, Navigation, AlertCircle, History, Layers } from 'lucide-react';
import { generateRouteClientFallback } from './services/clientRouteEngine';

export const App: React.FC = () => {
  // 1. Тема оформления (Светлая / Темная) с сохранением в localStorage
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('sbs_theme') || localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 2. Слой карты: 'map' (Схема), 'satellite' (Спутник), 'hybrid' (Гибрид)
  const [mapType, setMapType] = useState<MapLayerType>(() => {
    const saved = localStorage.getItem('sbs_map_type') as MapLayerType | null;
    if (saved && ['map', 'satellite', 'hybrid'].includes(saved)) {
      return saved;
    }
    return 'map';
  });

  // 3. Модальные окна слоев и истории
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // 4. История прогулок с сохранением в localStorage
  const [history, setHistory] = useState<RouteHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem('sbs_route_history');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse route history:', e);
    }
    return [];
  });

  // Координаты старта (по умолчанию центр Москвы, Красная площадь)
  const [startLat, setStartLat] = useState<number>(55.751244);
  const [startLon, setStartLon] = useState<number>(37.618423);

  // Координаты финиша (конечной точки прогулки)
  const [endLat, setEndLat] = useState<number | null>(null);
  const [endLon, setEndLon] = useState<number | null>(null);
  const [endName, setEndName] = useState<string | undefined>(undefined);
  const [endAddress, setEndAddress] = useState<string | undefined>(undefined);
  const [isPickingEndLocation, setIsPickingEndLocation] = useState<boolean>(false);

  // Живые координаты пользователя (GPS)
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [isTrackingUser, setIsTrackingUser] = useState<boolean>(true);

  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Выбранная карточка места для детального просмотра с фото и отзывами
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<{
    stop: RouteStop;
    index: number;
  } | null>(null);

  // Точки / заведения, которые пользователь отметил для обязательного посещения по пути
  const [waypoints, setWaypoints] = useState<DesiredWaypoint[]>([]);

  // Состояние сворачивания боковой панели на ПК
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState<boolean>(false);

  const handleAddWaypoint = (wp: DesiredWaypoint) => {
    setWaypoints((prev) => {
      if (prev.some((w) => w.id === wp.id || (Math.abs(w.lat - wp.lat) < 0.0001 && Math.abs(w.lon - wp.lon) < 0.0001))) {
        return prev;
      }
      return [...prev, wp];
    });
  };

  const handleRemoveWaypoint = (id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  };

  const handleClearWaypoints = () => {
    setWaypoints([]);
  };

  const handleToggleWaypoint = (stop: RouteStop) => {
    setWaypoints((prev) => {
      const exists = prev.some((w) => w.id === stop.id || (Math.abs(w.lat - stop.lat) < 0.0001 && Math.abs(w.lon - stop.lon) < 0.0001));
      if (exists) {
        return prev.filter((w) => w.id !== stop.id && !(Math.abs(w.lat - stop.lat) < 0.0001 && Math.abs(w.lon - stop.lon) < 0.0001));
      } else {
        return [
          ...prev,
          {
            id: stop.id || `wp_${Date.now()}`,
            name: stop.name,
            lat: stop.lat,
            lon: stop.lon,
            address: stop.address,
            category: stop.category,
            photo_url: stop.photo_url,
          },
        ];
      }
    });
  };

  const watchIdRef = useRef<number | null>(null);
  const isInitialLocationSetRef = useRef<boolean>(false);

  // Применение темы к <html> и <head>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('sbs_theme', 'dark');
      localStorage.setItem('theme', 'dark');
      document.getElementById('theme-color-meta')?.setAttribute('content', '#121212');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('sbs_theme', 'light');
      localStorage.setItem('theme', 'light');
      document.getElementById('theme-color-meta')?.setAttribute('content', '#ffffff');
    }
  }, [isDark]);

  // Смена слоя карты
  const handleSelectLayer = (type: MapLayerType) => {
    setMapType(type);
    localStorage.setItem('sbs_map_type', type);
  };

  // Непрерывное отслеживание геолокации в реальном времени (watchPosition)
  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorMessage('Геолокация не поддерживается вашим браузером');
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      setUserLat(latitude);
      setUserLon(longitude);

      // При первом получении или если активно слежение за пользователем
      if (!isInitialLocationSetRef.current) {
        setStartLat(latitude);
        setStartLon(longitude);
        isInitialLocationSetRef.current = true;
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Geolocation watch error:', err.message);
    };

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    };

    const id = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Выбор точки финиша кликом по карте
  const handleSelectEndLocation = (lat: number, lon: number) => {
    setEndLat(lat);
    setEndLon(lon);
    setIsPickingEndLocation(false);
    if (window.ymaps && window.ymaps.geocode) {
      window.ymaps.geocode([lat, lon], { results: 1 }).then((res: any) => {
        const firstGeoObject = res.geoObjects.get(0);
        if (firstGeoObject) {
          const name = firstGeoObject.getAddressLine() || firstGeoObject.properties.get('name');
          setEndName(name);
          setEndAddress(name);
        } else {
          setEndName(`Точка ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
      }).catch(() => {
        setEndName(`Точка ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      });
    } else {
      setEndName(`Точка ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }
  };

  // Выбор точки финиша через поисковую строку
  const handleSetFinishFromSearch = (lat: number, lon: number, name: string, address?: string) => {
    setEndLat(lat);
    setEndLon(lon);
    setEndName(name);
    setEndAddress(address || name);
    setIsPickingEndLocation(false);
  };

  // Очистка точки финиша
  const handleClearEndPoint = () => {
    setEndLat(null);
    setEndLon(null);
    setEndName(undefined);
    setEndAddress(undefined);
    setIsPickingEndLocation(false);
  };

  // Клик по карте для выбора произвольной точки старта или финиша
  const handleMapClick = (lat: number, lon: number) => {
    if (isPickingEndLocation) {
      handleSelectEndLocation(lat, lon);
      return;
    }
    setStartLat(lat);
    setStartLon(lon);
    setIsTrackingUser(false);
    setErrorMessage(null);
  };

  // Выбор точки через строку поиска городов и мест
  const handleSelectSearchLocation = (lat: number, lon: number) => {
    setStartLat(lat);
    setStartLon(lon);
    setIsTrackingUser(false);
    setRouteData(null);
    setActiveStopIndex(null);
    setErrorMessage(null);
  };

  // Переключение режима фиксации на местоположении пользователя
  const handleToggleTracking = () => {
    if (!isTrackingUser) {
      setIsTrackingUser(true);
      if (userLat !== null && userLon !== null) {
        setStartLat(userLat);
        setStartLon(userLon);
      } else {
        requestInstantLocation();
      }
    } else {
      setIsTrackingUser(false);
    }
  };

  // Мгновенный запрос местоположения по кнопке
  const requestInstantLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Геолокация недоступна');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLon(longitude);
        setStartLat(latitude);
        setStartLon(longitude);
        setIsTrackingUser(true);
        setErrorMessage(null);
      },
      (err) => {
        console.warn('Geolocation prompt error:', err.message);
        setErrorMessage('Доступ к геолокации запрещен. Кликните по карте, чтобы выбрать точку старта.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Сохранение построенного маршрута в историю
  const saveRouteToHistory = (
    data: RouteResponse,
    reqStartLat: number,
    reqStartLon: number,
    customPrompt?: string
  ) => {
    try {
      const now = new Date();
      const dateFormatted = now.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      const newItem: RouteHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        dateFormatted,
        scenario_title: data.scenario_title,
        scenario: data.scenario,
        total_route_minutes: data.total_route_minutes,
        total_walking_minutes: data.total_walking_minutes,
        total_distance_meters: data.total_distance_meters,
        stopsCount: data.stops.length,
        stops: data.stops,
        routeData: data,
        startLat: reqStartLat,
        startLon: reqStartLon,
        custom_prompt: customPrompt,
      };

      setHistory((prev) => {
        const updated = [newItem, ...prev.filter((item) => Math.abs(item.timestamp - newItem.timestamp) > 3000)].slice(0, 30);
        localStorage.setItem('sbs_route_history', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.warn('Failed to save route to history:', e);
    }
  };

  // Повтор маршрута из истории
  const handleSelectHistoryRoute = (item: RouteHistoryItem) => {
    setRouteData(item.routeData);
    setStartLat(item.startLat);
    setStartLon(item.startLon);
    setIsTrackingUser(false);
    setIsHistoryOpen(false);
    setActiveStopIndex(null);
  };

  // Удаление отдельного маршрута из истории
  const handleDeleteHistoryRoute = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem('sbs_route_history', JSON.stringify(updated));
      return updated;
    });
  };

  // Полная очистка истории
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('sbs_route_history');
  };

  // Генерация нового маршрута
  const handleGenerateRoute = async (params: RouteRequest) => {
    setIsLoading(true);
    setErrorMessage(null);
    setActiveStopIndex(null);

    try {
      let data: RouteResponse | null = null;

      // 1. Попытка запроса к бэкенду (таймаут 3.5 сек)
      try {
        const apiUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:8000/api/generate-route'
          : '/api/generate-route';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
        }
      } catch (backendErr) {
        console.warn('Backend request bypassed or timed out, using client walk engine.');
      }

      // 2. Если бэкенд недоступен или вернул ошибку, мгновенно используем клиентский AI-движок
      if (!data) {
        data = await generateRouteClientFallback(params);
      }

      setRouteData(data);
      saveRouteToHistory(data, params.start_lat, params.start_lon, params.custom_prompt);
    } catch (err: any) {
      console.error('Failed to generate route:', err);
      try {
        const fallbackData = await generateRouteClientFallback(params);
        setRouteData(fallbackData);
        saveRouteToHistory(fallbackData, params.start_lat, params.start_lon, params.custom_prompt);
      } catch (e) {
        setErrorMessage('Не удалось построить маршрут. Попробуйте изменить параметры или запрос.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950 font-sans">
      {/* 1. Интерактивная карта (на весь экран) */}
      <MapView
        startLat={startLat}
        startLon={startLon}
        endLat={endLat}
        endLon={endLon}
        endName={endName}
        userLat={userLat}
        userLon={userLon}
        routeData={routeData}
        onMapClick={handleMapClick}
        isPickingEndLocation={isPickingEndLocation}
        onSelectEndLocation={handleSelectEndLocation}
        onCancelPickingEnd={() => setIsPickingEndLocation(false)}
        activeStopIndex={activeStopIndex}
        isDark={isDark}
        mapType={mapType}
        isTrackingUser={isTrackingUser}
        onToggleLayers={() => setIsLayersOpen(true)}
        onLocateUser={requestInstantLocation}
        onSelectStop={(idx) => setActiveStopIndex(idx)}
        onOpenPlaceDetails={(stop, index) => setSelectedPlaceDetails({ stop, index })}
        isDesktopCollapsed={isDesktopCollapsed}
      />

      {/* 2. Верхняя плавающая панель управления и поиска */}
      <div className="absolute top-3 inset-x-3 sm:top-4 sm:left-4 sm:right-auto z-20 pointer-events-none flex items-center gap-2 max-w-full sm:max-w-xl md:max-w-2xl sm:w-full">
        {/* Логотип */}
        <div className="pointer-events-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-3 sm:px-3.5 py-2 rounded-2xl shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFCC00] animate-pulse" />
          <span className="font-extrabold text-xs sm:text-sm tracking-tight text-neutral-900 dark:text-white">
            StepByStep
          </span>
        </div>

        {/* Поиск городов и мест (между названием и историей) */}
        <div className="pointer-events-auto flex-1 min-w-0">
          <CitySearchBar
            onSelectLocation={handleSelectSearchLocation}
            onAddWaypoint={handleAddWaypoint}
            onSetFinish={handleSetFinishFromSearch}
            existingWaypointIds={waypoints.map((w) => w.id)}
          />
        </div>

        {/* Кнопки истории и темы */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          {/* Кнопка "История прогулок" */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            aria-label="История прогулок"
            title="История прошлых прогулок"
            className="h-10 px-2.5 sm:px-3 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <History className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold hidden md:inline">История</span>
            {history.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-black flex items-center justify-center">
                {history.length}
              </span>
            )}
          </button>

          {/* Переключатель темы (Светлая / Темная) */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            aria-label="Сменить тему"
            title={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
          </button>
        </div>
      </div>

      {/* 3. Оповещение об ошибке */}
      {errorMessage && (
        <div className="absolute top-20 inset-x-4 max-w-md mx-auto z-30 bg-rose-500 text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-white/80 hover:text-white font-bold ml-2 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Боковая панель на ПК / Нижняя шторка на мобильных устройствах */}
      <BottomSheet
        startLat={startLat}
        startLon={startLon}
        endLat={endLat}
        endLon={endLon}
        endName={endName}
        onClearEndPoint={handleClearEndPoint}
        onStartPickingEndLocation={() => setIsPickingEndLocation(true)}
        isPickingEndLocation={isPickingEndLocation}
        routeData={routeData}
        isLoading={isLoading}
        activeStopIndex={activeStopIndex}
        onSelectStop={(idx) => setActiveStopIndex(idx)}
        onSubmit={handleGenerateRoute}
        onReset={() => {
          setRouteData(null);
          setActiveStopIndex(null);
        }}
        isTrackingUser={isTrackingUser}
        onToggleTracking={handleToggleTracking}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        onOpenPlaceDetails={(stop, index) => setSelectedPlaceDetails({ stop, index })}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleDesktopCollapse={() => setIsDesktopCollapsed((prev) => !prev)}
        waypoints={waypoints}
        onRemoveWaypoint={handleRemoveWaypoint}
        onClearWaypoints={handleClearWaypoints}
      />

      {/* 5. Модальное окно слоев карты (Схема / Спутник / Гибрид) */}
      <LayersModal
        isOpen={isLayersOpen}
        onClose={() => setIsLayersOpen(false)}
        currentLayer={mapType}
        onSelectLayer={handleSelectLayer}
        onOpenHistory={() => setIsHistoryOpen(true)}
        isDark={isDark}
      />

      {/* 6. Модальное окно истории прогулок */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectRoute={handleSelectHistoryRoute}
        onDeleteRoute={handleDeleteHistoryRoute}
        onClearHistory={handleClearHistory}
      />

      {/* 7. Детальная карточка места с фото, рейтингом и отзывами */}
      <PlaceDetailsModal
        stop={selectedPlaceDetails?.stop || null}
        stopIndex={selectedPlaceDetails?.index}
        onClose={() => setSelectedPlaceDetails(null)}
        isWaypoint={Boolean(
          selectedPlaceDetails?.stop &&
          waypoints.some(
            (w) =>
              w.id === selectedPlaceDetails.stop.id ||
              (Math.abs(w.lat - selectedPlaceDetails.stop.lat) < 0.0001 &&
                Math.abs(w.lon - selectedPlaceDetails.stop.lon) < 0.0001)
          )
        )}
        onToggleWaypoint={handleToggleWaypoint}
        onSetAsStart={(stop) => {
          setStartLat(stop.lat);
          setStartLon(stop.lon);
          setIsTrackingUser(false);
          setRouteData(null);
        }}
        onSetAsFinish={(stop) => {
          handleSetFinishFromSearch(stop.lat, stop.lon, stop.name, stop.address);
          setRouteData(null);
        }}
      />
    </div>
  );
};

export default App;
