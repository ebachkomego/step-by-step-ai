import React from 'react';
import type { MapLayerType } from '../types';
import { Layers, Map, Eye, Image as ImageIcon, History, X } from 'lucide-react';

interface LayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLayer: MapLayerType;
  onSelectLayer: (layer: MapLayerType) => void;
  onOpenHistory?: () => void;
  isDark: boolean;
}

export const LayersModal: React.FC<LayersModalProps> = ({
  isOpen,
  onClose,
  currentLayer,
  onSelectLayer,
  onOpenHistory,
  isDark,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Затемненный фон с размытием */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Модальное окно в стиле Яндекс Карт */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1e2530] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 z-10 overflow-hidden transform transition-all pb-6 pt-3 px-5">
        {/* Ручка перетаскивания (для мобилок) */}
        <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Заголовок */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
              Слои карты
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Сегментные кнопки: [ Схема ] [ Спутник ] [ Гибрид ] в точности как на скриншоте */}
        <div className="grid grid-cols-3 gap-2 p-1.5 mt-4 rounded-2xl bg-neutral-100 dark:bg-[#161d28]">
          <button
            type="button"
            onClick={() => onSelectLayer('map')}
            className={`py-3 px-2 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
              currentLayer === 'map'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800/60'
            }`}
          >
            <Map className="w-5 h-5" />
            <span>Схема</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectLayer('satellite')}
            className={`py-3 px-2 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
              currentLayer === 'satellite'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800/60'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            <span>Спутник</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectLayer('hybrid')}
            className={`py-3 px-2 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
              currentLayer === 'hybrid'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800/60'
            }`}
          >
            <Eye className="w-5 h-5" />
            <span>Гибрид</span>
          </button>
        </div>

        {/* Дополнительные опции в стиле Яндекс Карт */}
        <div className="mt-5 space-y-2">
          {onOpenHistory && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHistory();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-neutral-50 dark:bg-[#161d28] hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">История прогулок</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Сохраненные и прошлые маршруты
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-500 group-hover:translate-x-0.5 transition-transform">
                Открыть →
              </span>
            </button>
          )}

          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#161d28] border border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Текущая тема интерфейса:</span>
            <span className="font-bold text-neutral-800 dark:text-neutral-200">
              {isDark ? '🌙 Тёмная карта (ночной режим)' : '☀️ Светлая карта (дневной режим)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayersModal;
