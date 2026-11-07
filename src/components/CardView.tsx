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
  stackCount?: number;
  dealIndex?: number;
  disabled?: boolean;
  onClick?: () => void;
}

function getCardArtworkPath(card: Card | null): string {
  if (!card) return '/cards/card-back.png';
  if (card.kind === 'FOX_PEEK') return '/cards/card-peek.png';
  if (card.kind === 'FOX_SWAP') return '/cards/card-swap.png';
  if (card.kind === 'CHICKEN') return '/cards/card-9.png';
  const val = Math.max(0, Math.min(9, card.value ?? 0));
  return `/cards/card-${val}.png`;
}

function getCardTitle(card: Card | null): string {
  if (!card) return 'Hidden Card';
  if (card.kind === 'FOX_PEEK') return 'Fox Peek';
  if (card.kind === 'FOX_SWAP') return 'Fox Swap';
  if (card.kind === 'CHICKEN') return 'Chicken (9)';
  return `Card ${card.value ?? 0}`;
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
  stackCount = 0,
  dealIndex = 0,
  disabled = false,
  onClick,
}) => {
  // Explicit pixel dimensions in both Portrait and Mobile Landscape so cards NEVER collapse or overflow
  const sizeClasses = {
    sm: 'w-[46px] h-[54px] mobile-landscape:w-[38px] mobile-landscape:h-[45px] rounded-xl text-xs',
    md: 'w-[74px] h-[86px] mobile-landscape:w-[56px] mobile-landscape:h-[66px] rounded-2xl text-sm',
    lg: 'w-[72px] h-[84px] sm:w-[80px] sm:h-[94px] mobile-landscape:w-[60px] mobile-landscape:h-[70px] rounded-2xl text-base',
  }[size];

  const isShowingFront = Boolean(faceUp && card);
  const frontArtUrl = getCardArtworkPath(card);

  // Vibrant storybook border & shadow glow based on card identity
  const frontBorderGlow = !card
    ? 'border-amber-300'
    : card.kind === 'FOX_PEEK'
      ? 'border-sky-300 shadow-lg shadow-sky-400/40'
      : card.kind === 'FOX_SWAP'
        ? 'border-yellow-300 shadow-lg shadow-amber-400/40'
        : (card.value ?? 0) >= 5
          ? 'border-rose-400 shadow-lg shadow-rose-500/30'
          : 'border-amber-300 shadow-lg shadow-amber-400/35';

  const interactiveClasses = isSelected
    ? 'ring-3 ring-yellow-300 -translate-y-1.5 scale-106 shadow-2xl shadow-yellow-400/50 z-20 cursor-pointer animate-glow-gold'
    : isSelectable && !disabled
      ? 'ring-2.5 ring-emerald-300 hover:-translate-y-1 hover:scale-104 active:scale-95 shadow-xl shadow-emerald-400/40 cursor-pointer'
      : wasRecentlySwapped
        ? 'ring-3 ring-cyan-300 shadow-xl shadow-cyan-400/50 z-10 animate-swap-pop'
        : disabled
          ? 'opacity-60 cursor-not-allowed'
          : onClick
            ? 'cursor-pointer hover:-translate-y-0.5 active:scale-95'
            : 'cursor-default';

  const layers =
    stackCount > 24 ? 3 : stackCount > 10 ? 2 : stackCount > 2 ? 1 : 0;

  return (
    <div
      style={
        dealIndex > 0 ? { animationDelay: `${dealIndex * 65}ms` } : undefined
      }
      className={`relative inline-flex items-center justify-center shrink-0 animate-deal-in ${sizeClasses}`}
    >
      {/* 3D Physical Stack Layers underneath (for Deck & Discard piles) */}
      {layers >= 3 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-[5px] translate-y-[5px] rounded-[inherit] bg-amber-950 border border-amber-500/50 shadow-md pointer-events-none"
        />
      )}
      {layers >= 2 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-[3.5px] translate-y-[3.5px] rounded-[inherit] bg-amber-900 border border-amber-400/60 shadow-sm pointer-events-none"
        />
      )}
      {layers >= 1 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-[inherit] bg-amber-700 border border-amber-300/70 pointer-events-none"
        />
      )}

      <button
        type="button"
        title={isShowingFront ? getCardTitle(card) : 'Face-down card'}
        onClick={!disabled && (isSelectable || onClick) ? onClick : undefined}
        disabled={disabled && !isSelectable}
        className={`relative w-full h-full select-none transition-all duration-200 card-perspective bg-transparent p-0 rounded-[inherit] ${interactiveClasses}`}
      >
        {/* 3D Flipping Container */}
        <div
          className={`card-inner-3d rounded-[inherit] ${
            isShowingFront ? 'is-flipped' : ''
          }`}
        >
          {/* CARD BACK (Face Down) */}
          <div className="card-face rounded-[inherit] overflow-hidden bg-gradient-to-br from-amber-600 via-amber-800 to-amber-950 border-2 border-amber-300/85 shadow-lg">
            <img
              src="/cards/card-back.png"
              alt="Kookriko Card Back"
              draggable={false}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-yellow-200/40 pointer-events-none" />
          </div>

          {/* CARD FRONT (Face Up Illustrated Artwork) */}
          <div
            className={`card-face card-face-front rounded-[inherit] overflow-hidden bg-amber-50 border-2 ${frontBorderGlow}`}
          >
            {card && (
              <img
                src={frontArtUrl}
                alt={getCardTitle(card)}
                draggable={false}
                className="w-full h-full object-fill"
              />
            )}
            {/* Warm sunlit sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none" />
          </div>
        </div>

        {/* Selectable pulsing ring overlay */}
        {isSelectable && !disabled && !isSelected && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[inherit] ring-2 ring-yellow-300/90 animate-pulse pointer-events-none"
          />
        )}

        {/* Slot Number Pill (Bottom Right) */}
        {slotLabel && (
          <span className="absolute -bottom-1.5 right-0.5 z-20 px-1.5 py-0.2 rounded-full bg-amber-950/95 border border-yellow-300/70 text-[8px] font-mono font-black text-yellow-200 shadow-md leading-tight">
            {slotLabel}
          </span>
        )}

        {/* Top Action / Peek Badge */}
        {highlightBadge && (
          <span className="absolute -top-2 inset-x-0.5 z-20 bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400 text-amber-950 border border-amber-900/50 text-[7px] font-black uppercase tracking-tighter py-0.5 px-1 rounded-full shadow-md truncate leading-tight">
            {highlightBadge}
          </span>
        )}

        {/* Recently Swapped Notification Badge */}
        {wasRecentlySwapped && !highlightBadge && (
          <span className="absolute -top-2 inset-x-0.5 z-20 bg-gradient-to-r from-cyan-300 via-sky-300 to-teal-300 text-slate-950 border border-slate-900/40 text-[7px] font-black uppercase tracking-tighter py-0.5 px-1 rounded-full shadow-lg animate-bounce truncate leading-tight">
            {swapBadgeText ?? '⇄ SWAP'}
          </span>
        )}
      </button>
    </div>
  );
};
