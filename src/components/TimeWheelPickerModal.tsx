import React, { useState, useEffect, useRef } from 'react';

interface TimeWheelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialTime?: string; // "HH:MM"
  onConfirm: (time: string) => void;
  referenceTime?: string; // Current reference time "HH:MM"
  isDark?: boolean;
}

interface WheelColumnProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}) => {
  const touchStartY = useRef<number | null>(null);

  const wrapValue = (v: number) => {
    const range = max - min + 1;
    let res = v;
    while (res < min) res += range;
    while (res > max) res -= range;
    return res;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      onChange(wrapValue(value + step));
    } else if (e.deltaY < 0) {
      onChange(wrapValue(value - step));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(deltaY) > 22) {
      if (deltaY < 0) {
        onChange(wrapValue(value + step));
      } else {
        onChange(wrapValue(value - step));
      }
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  const offsets = [-2, -1, 0, 1, 2];

  return (
    <div
      className="flex flex-col items-center select-none py-2 px-3 w-24 sm:w-28"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 mb-2 uppercase tracking-wider">
        {label}
      </span>

      <div className="flex flex-col items-center justify-center gap-1.5 w-full">
        {offsets.map((offset) => {
          const itemVal = wrapValue(value + offset * step);
          const formatted = itemVal.toString().padStart(2, '0');
          const isSelected = offset === 0;
          const isNear = Math.abs(offset) === 1;

          return (
            <button
              key={offset}
              type="button"
              onClick={() => {
                if (!isSelected) onChange(itemVal);
              }}
              className={`h-11 w-full flex items-center justify-center rounded-xl transition-all font-mono cursor-pointer ${
                isSelected
                  ? 'text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800/80 scale-105 shadow-inner'
                  : isNear
                  ? 'text-xl sm:text-2xl font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 opacity-60'
                  : 'text-base sm:text-lg font-medium text-neutral-300 dark:text-neutral-700 opacity-25'
              }`}
            >
              {formatted}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const TimeWheelPickerModal: React.FC<TimeWheelPickerModalProps> = ({
  isOpen,
  onClose,
  title,
  initialTime = '12:00',
  onConfirm,
  referenceTime,
}) => {
  const [selectedHours, setSelectedHours] = useState<number>(() => {
    const [h] = (initialTime || '12:00').split(':').map(Number);
    return isNaN(h) ? 12 : h;
  });

  const [selectedMinutes, setSelectedMinutes] = useState<number>(() => {
    const [, m] = (initialTime || '12:00').split(':').map(Number);
    return isNaN(m) ? 0 : m;
  });

  useEffect(() => {
    if (isOpen && initialTime) {
      const [h, m] = initialTime.split(':').map(Number);
      if (!isNaN(h)) setSelectedHours(h);
      if (!isNaN(m)) setSelectedMinutes(m);
    }
  }, [isOpen, initialTime]);

  if (!isOpen) return null;

  // Расчет подписи разницы во времени ("Через X ч Y мин" как на скриншоте)
  const calculateDeltaLabel = () => {
    if (!referenceTime) return null;
    const [refH, refM] = referenceTime.split(':').map(Number);
    if (isNaN(refH) || isNaN(refM)) return null;

    const refTotal = refH * 60 + refM;
    const targetTotal = selectedHours * 60 + selectedMinutes;
    let diff = targetTotal - refTotal;
    if (diff < 0) diff += 24 * 60; // следующий день

    if (diff === 0) {
      return 'Прямо сейчас';
    }

    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    if (hours > 0 && minutes > 0) {
      return `Через ${hours} ч ${minutes} мин`;
    }
    if (hours > 0) {
      return `Через ${hours} ч`;
    }
    return `Через ${minutes} мин`;
  };

  const deltaLabel = calculateDeltaLabel();

  const handleApply = () => {
    const timeStr = `${selectedHours.toString().padStart(2, '0')}:${selectedMinutes
      .toString()
      .padStart(2, '0')}`;
    onConfirm(timeStr);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xs sm:max-w-sm rounded-3xl bg-neutral-900 text-white p-6 shadow-2xl border border-neutral-800 flex flex-col items-center animate-in zoom-in-95 duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <h3 className="text-xl font-black text-center text-white tracking-tight">
          {title}
        </h3>

        {/* Подзаголовок (как на скриншоте пользователя) */}
        {deltaLabel && (
          <span className="text-xs font-semibold text-neutral-400 mt-1 mb-2 text-center">
            {deltaLabel}
          </span>
        )}

        {/* Скроллер барабана времени (ч и м) */}
        <div className="flex items-center justify-center gap-4 my-4 p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 w-full">
          <WheelColumn
            label="ч"
            value={selectedHours}
            min={0}
            max={23}
            onChange={(h) => setSelectedHours(h)}
          />

          <span className="text-3xl font-extrabold text-neutral-500 -mt-2">:</span>

          <WheelColumn
            label="м"
            value={selectedMinutes}
            min={0}
            max={59}
            onChange={(m) => setSelectedMinutes(m)}
          />
        </div>

        {/* Кнопки внизу (Отмена / Готово, как на скриншоте) */}
        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-sm transition-all active:scale-95 cursor-pointer text-center"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer text-center"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeWheelPickerModal;
