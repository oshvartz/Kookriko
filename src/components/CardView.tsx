import React from 'react';
import type { Card } from '../types/game';

export interface CardViewProps {
  card: Card | null;
  faceUp: boolean;
  size?: 'sm' | 'md' | 'lg';
  slotLabel?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  highlightBadge?: string;
  wasRecentlySwapped?: boolean;
  swapBadgeText?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  faceUp,
  size = 'lg',
  slotLabel,
  isSelectable = false,
  isSelected = false,
  highlightBadge,
  wasRecentlySwapped = false,
  swapBadgeText,
  disabled = false,
  onClick,
}) => {
  const sizeClasses = {
    sm: 'w-11 h-16 rounded-lg text-xs',
    md: 'w-20 h-28 rounded-xl text-sm',
    lg: 'w-full aspect-[5/7] max-w-[82px] rounded-xl text-base',
  }[size];

  const interactiveClasses = isSelected
    ? 'ring-3 ring-amber-300 scale-105 shadow-lg shadow-amber-400/40 z-10 cursor-pointer'
    : isSelectable && !disabled
      ? 'ring-2 ring-emerald-400/90 hover:scale-[1.03] active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer animate-pulse'
      : wasRecentlySwapped
        ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/40 z-10'
        : disabled
          ? 'opacity-60 cursor-not-allowed'
          : onClick
            ? 'cursor-pointer active:scale-95'
            : 'cursor-default';

  // Card Back (Face Down)
  if (!faceUp || !card) {
    return (
      <button
        type="button"
        onClick={!disabled && (isSelectable || onClick) ? onClick : undefined}
        disabled={disabled && !isSelectable}
        className={`relative select-none transition-all duration-150 flex flex-col items-center justify-center bg-gradient-to-br from-amber-800 via-amber-900 to-stone-900 border-2 border-amber-500/40 shadow-md ${sizeClasses} ${interactiveClasses}`}
      >
        {/* Inner decorative border */}
        <div className=" inset-1 absolute rounded-md border border-amber-400/20 pointer-events-none flex items-center justify-center">
          <span
            className={
              size === 'sm' ? 'text-base opacity-80' : 'text-2xl opacity-85'
            }
          >
            🐓
          </span>
        </div>

        {slotLabel && (
          <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-amber-200/70">
            {slotLabel}
          </span>
        )}

        {highlightBadge && (
          <span className="absolute -top-1.5 inset-x-1 bg-amber-400 text-stone-950 text-[8px] font-black uppercase tracking-tighter py-0.5 px-1 rounded shadow">
            {highlightBadge}
          </span>
        )}

        {wasRecentlySwapped && !highlightBadge && (
          <span className="absolute -top-1.5 inset-x-0.5 bg-cyan-400 text-stone-950 text-[7px] font-black uppercase tracking-tighter py-0.5 px-0.5 rounded shadow animate-bounce">
            {swapBadgeText ?? '⇄ SWAP'}
          </span>
        )}
      </button>
    );
  }

  // Face-up Card Styling based on Kind & Value
  let bgClass = 'from-emerald-900 via-emerald-950 to-stone-950 border-emerald-400/60 text-emerald-100';
  let emoji = '🌾';
  let titleText = `${card.value ?? ''}`;
  let subText = 'LOW';

  if (card.kind === 'CHICKEN') {
    bgClass = 'from-red-900 via-rose-950 to-stone-950 border-red-400/80 text-red-100';
    emoji = '🐓';
    titleText = '9';
    subText = 'CHICKEN';
  } else if (card.kind === 'FOX_PEEK') {
    bgClass = 'from-purple-900 via-indigo-950 to-stone-950 border-purple-400/80 text-purple-100';
    emoji = '🦊';
    titleText = 'PEEK';
    subText = 'POWER';
  } else if (card.kind === 'FOX_SWAP') {
    bgClass = 'from-orange-800 via-amber-950 to-stone-950 border-orange-400/80 text-orange-100';
    emoji = '🦊';
    titleText = 'SWAP';
    subText = 'POWER';
  } else if (card.value !== null) {
    if (card.value === 0) {
      bgClass = 'from-cyan-800 via-teal-950 to-stone-950 border-cyan-300/80 text-cyan-100';
      emoji = '🥚';
      subText = 'BEST';
    } else if (card.value <= 3) {
      bgClass = 'from-emerald-800 via-emerald-950 to-stone-950 border-emerald-400/70 text-emerald-100';
      emoji = '🐣';
      subText = 'GOOD';
    } else if (card.value <= 6) {
      bgClass = 'from-amber-800 via-amber-950 to-stone-950 border-amber-400/70 text-amber-100';
      emoji = '🌽';
      subText = 'MID';
    } else {
      bgClass = 'from-orange-900 via-red-950 to-stone-950 border-orange-400/70 text-orange-100';
      emoji = '🪶';
      subText = 'HIGH';
    }
  }

  return (
    <button
      type="button"
      onClick={!disabled && (isSelectable || onClick) ? onClick : undefined}
      disabled={disabled && !isSelectable}
      className={`relative select-none transition-all duration-150 flex flex-col items-center justify-between p-1.5 bg-gradient-to-br border-2 shadow-md ${bgClass} ${sizeClasses} ${interactiveClasses}`}
    >
      {/* Top corner */}
      <div className="w-full flex items-center justify-between leading-none">
        <span
          className={`font-black ${
            size === 'sm' ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {titleText}
        </span>
        {slotLabel && (
          <span className="text-[9px] font-mono opacity-60">{slotLabel}</span>
        )}
      </div>

      {/* Center Icon / Value */}
      <div className="flex flex-col items-center justify-center my-auto leading-none">
        <span className={size === 'sm' ? 'text-sm' : 'text-xl'}>{emoji}</span>
        <span
          className={`font-black tracking-tight mt-0.5 ${
            size === 'sm'
              ? 'text-xs'
              : card.kind === 'FOX_PEEK' || card.kind === 'FOX_SWAP'
                ? 'text-xs'
                : 'text-xl'
          }`}
        >
          {titleText}
        </span>
      </div>

      {/* Bottom Label */}
      {size !== 'sm' && (
        <div className="w-full text-center text-[8px] font-extrabold uppercase tracking-wider opacity-75 truncate">
          {subText}
        </div>
      )}

      {highlightBadge && (
        <span className="absolute -top-1.5 inset-x-1 bg-amber-400 text-stone-950 text-[8px] font-black uppercase tracking-tighter py-0.5 px-1 rounded shadow">
          {highlightBadge}
        </span>
      )}

      {wasRecentlySwapped && !highlightBadge && (
        <span className="absolute -top-1.5 inset-x-0.5 bg-cyan-400 text-stone-950 text-[7px] font-black uppercase tracking-tighter py-0.5 px-0.5 rounded shadow animate-bounce">
          {swapBadgeText ?? '⇄ SWAP'}
        </span>
      )}
    </button>
  );
};
