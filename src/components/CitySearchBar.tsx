import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

interface SearchResultItem {
  id: string;
  name: string;
  description: string;
  lat: number;
  lon: number;
}

interface CitySearchBarProps {
  onSelectLocation: (lat: number, lon: number, name: string) => void;
}

export const CitySearchBar: React.FC<CitySearchBarProps> = ({ onSelectLocation }) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Закрытие выпадающего списка при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Поиск через Yandex Maps Geocoder или Nominatim
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);

      const items: SearchResultItem[] = [];

      // 1. Попытка поиска через встроенный геокодер Яндекс Карт
      if (typeof window !== 'undefined' && (window as any).ymaps?.geocode) {
        try {
          const res = await (window as any).ymaps.geocode(trimmed, { results: 5 });
          const count = res.geoObjects.getLength();
          for (let i = 0; i < count; i++) {
            const obj = res.geoObjects.get(i);
            const coords = obj.geometry.getCoordinates();
            const name = obj.properties.get('name') || trimmed;
            const desc = obj.properties.get('description') || '';
            if (coords && coords.length === 2) {
              items.push({
                id: `ymaps_search_${i}`,
                name,
                description: desc,
                lat: coords[0],
                lon: coords[1],
              });
            }
          }
        } catch (e) {
          console.warn('Ymaps geocode error, falling back:', e);
        }
      }

      // 2. Если Яндекс не вернул результаты или недоступен — быстрый поиск через Nominatim
      if (items.length === 0) {
        try {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            trimmed
          )}&format=json&limit=5&addressdetails=1`;
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'StepByStepAI/2.0 (route-planner)' },
          });
          if (resp.ok) {
            const data = await resp.json();
            for (const d of data) {
              const nameParts = d.display_name.split(',');
              items.push({
                id: `osm_${d.place_id}`,
                name: nameParts[0].trim(),
                description: nameParts.slice(1, 4).join(',').trim(),
                lat: parseFloat(d.lat),
                lon: parseFloat(d.lon),
              });
            }
          }
        } catch (e) {
          console.warn('Nominatim fallback error:', e);
        }
      }

      setResults(items);
      setIsLoading(false);
      setIsOpen(items.length > 0);
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelectLocation(item.lat, item.lon, `${item.name}${item.description ? ` (${item.description})` : ''}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xs md:max-w-md mx-2 pointer-events-auto">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Поиск города или места..."
          className="w-full h-10 pl-9 pr-8 text-xs sm:text-sm font-semibold rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-neutral-200/80 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
        />
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-neutral-400 animate-spin absolute right-3" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2.5 w-5 h-5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white text-xs cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Выпадающий список подсказок городов и локаций */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-12 inset-x-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden z-50 divide-y divide-neutral-100 dark:divide-neutral-800/60 animate-in fade-in slide-in-from-top-2 duration-150">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70 transition-colors cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                  {item.name}
                </div>
                {item.description && (
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CitySearchBar;
