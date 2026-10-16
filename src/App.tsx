import React, { useState, useEffect, useRef } from 'react';
import { MapView } from './components/MapView';
import { BottomSheet } from './components/BottomSheet';
import { LayersModal } from './components/LayersModal';
import { HistoryModal } from './components/HistoryModal';
import type { RouteRequest, RouteResponse, MapLayerType, RouteHistoryItem } from './types';
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

  // Живые координаты пользователя (GPS)
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [isTrackingUser, setIsTrackingUser] = useState<boolean>(true);

  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const isInitialLocationSetRef = useRef<boolean>(false);

  // Применение темы к <html> и <head>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sbs_theme', 'dark');
      localStorage.setItem('theme', 'dark');
      document.getElementById('theme-color-meta')?.setAttribute('content', '#121212');
    } else {
      document.documentElement.classList.remove('dark');
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

  // Клик по карте для выбора произвольной точки старта
  const handleMapClick = (lat: number, lon: number) => {
    setStartLat(lat);
    setStartLon(lon);
    setIsTrackingUser(false);
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
      {/* 1. Интерактивная карта Яндекс (на весь экран) */}
      <MapView
        startLat={startLat}
        startLon={startLon}
        userLat={userLat}
        userLon={userLon}
        routeData={routeData}
        onMapClick={handleMapClick}
        activeStopIndex={activeStopIndex}
        isDark={isDark}
        mapType={mapType}
        isTrackingUser={isTrackingUser}
        onToggleLayers={() => setIsLayersOpen(true)}
        onLocateUser={requestInstantLocation}
      />

      {/* 2. Верхняя плавающая панель управления (в стиле Яндекс Карт / Такси) */}
      <div className="absolute top-4 inset-x-4 max-w-xl mx-auto flex items-center justify-between pointer-events-none z-20">
        {/* Логотип */}
        <div className="pointer-events-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFCC00] animate-pulse" />
          <span className="font-extrabold text-sm tracking-tight text-neutral-900 dark:text-white">
            StepByStep
          </span>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
            Маршруты
          </span>
        </div>

        {/* Кнопки переключения темы, слоев, истории и геолокации */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Кнопка "История прогулок" */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            aria-label="История прогулок"
            title="История прошлых прогулок"
            className="h-10 px-3 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <History className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold hidden sm:inline">История</span>
            {history.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-black flex items-center justify-center">
                {history.length}
              </span>
            )}
          </button>

          {/* Кнопка "Слои карты" */}
          <button
            type="button"
            onClick={() => setIsLayersOpen(true)}
            aria-label="Слои карты"
            title="Слои карты: Схема, Спутник, Гибрид"
            className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-blue-500" />
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

          {/* Кнопка "Моё место" */}
          <button
            type="button"
            onClick={requestInstantLocation}
            aria-label="Моё местоположение"
            title="Определить моё местоположение"
            className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Navigation className={`w-4 h-4 ${isTrackingUser ? 'text-emerald-500 fill-emerald-500/20' : 'text-blue-500'}`} />
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

      {/* 4. Нижняя шторка (Bottom Sheet) в стиле Яндекс Go */}
      <BottomSheet
        startLat={startLat}
        startLon={startLon}
        routeData={routeData}
        isLoading={isLoading}
        activeStopIndex={activeStopIndex}
        onSelectStop={(idx) => setActiveStopIndex(idx)}
        onSubmit={handleGenerateRoute}
        onReset={() => setRouteData(null)}
        isTrackingUser={isTrackingUser}
        onToggleTracking={handleToggleTracking}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
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
    </div>
  );
};

export default App;
