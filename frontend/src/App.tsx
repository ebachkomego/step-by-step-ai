import React, { useState, useEffect } from 'react';
import { MapView } from './components/MapView';
import { BottomSheet } from './components/BottomSheet';
import type { RouteRequest, RouteResponse } from './types';
import { Sun, Moon, Navigation, AlertCircle } from 'lucide-react';
import { generateRouteClientFallback } from './services/clientRouteEngine';

export const App: React.FC = () => {
  // Тема оформления (Светлая / Темная)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Координаты старта (по умолчанию центр Москвы, Красная площадь)
  const [startLat, setStartLat] = useState<number>(55.751244);
  const [startLon, setStartLon] = useState<number>(37.618423);

  // Координаты пользователя (GPS)
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Применение темы к <html> элементу
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      document.getElementById('theme-color-meta')?.setAttribute('content', '#121212');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      document.getElementById('theme-color-meta')?.setAttribute('content', '#ffffff');
    }
  }, [isDark]);

  // Запрос геолокации при ПЕРВОМ заходе на сайт
  useEffect(() => {
    handleRequestLocation(true);
  }, []);

  const handleRequestLocation = (isInitial = false) => {
    if (!navigator.geolocation) {
      if (!isInitial) {
        setErrorMessage('Геолокация не поддерживается вашим браузером');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLon(longitude);
        setStartLat(latitude);
        setStartLon(longitude);
        setErrorMessage(null);
      },
      (err) => {
        console.warn('Geolocation prompt:', err.message);
        if (!isInitial) {
          setErrorMessage('Доступ к геолокации запрещен. Кликните по карте, чтобы выбрать точку старта.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleMapClick = (lat: number, lon: number) => {
    setStartLat(lat);
    setStartLon(lon);
    setErrorMessage(null);
  };

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

      // 2. Если бэкенд недоступен или вернул 500, моментально используем клиентский движок
      if (!data) {
        data = await generateRouteClientFallback(params);
      }

      setRouteData(data);
    } catch (err: any) {
      console.error('Failed to generate route:', err);
      try {
        const fallbackData = await generateRouteClientFallback(params);
        setRouteData(fallbackData);
      } catch (e) {
        setErrorMessage('Не удалось построить маршрут. Попробуйте еще раз.');
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

        {/* Кнопки переключения темы и геолокации */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Кнопка "Моё место" */}
          <button
            type="button"
            onClick={() => handleRequestLocation(false)}
            aria-label="Мое местоположение"
            className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-blue-500" />
          </button>

          {/* Переключатель темы (Светлая / Темная) */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            aria-label="Сменить тему"
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
            className="text-white/80 hover:text-white font-bold ml-2 text-sm"
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
        onCurrentLocation={() => handleRequestLocation(false)}
      />
    </div>
  );
};

export default App;
