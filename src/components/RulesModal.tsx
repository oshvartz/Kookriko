import React from 'react';
import { X, Sparkles, Eye, Repeat } from 'lucide-react';
import { CardView } from './CardView';
import type { Card } from '../types/game';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOX_CARDS: { card: Card; label: string; copies: string }[] = [
  { card: { id: 'g-0', kind: 'NUMBER', value: 0 }, label: 'Liberty Fox (0 pts)', copies: '4× in deck' },
  { card: { id: 'g-1', kind: 'NUMBER', value: 1 }, label: 'Beach Fox (1 pt)', copies: '4× in deck' },
  { card: { id: 'g-2', kind: 'NUMBER', value: 2 }, label: 'Sleepy Fox (2 pts)', copies: '4× in deck' },
  { card: { id: 'g-3', kind: 'NUMBER', value: 3 }, label: 'Wizard Fox (3 pts)', copies: '4× in deck' },
  { card: { id: 'g-4', kind: 'NUMBER', value: 4 }, label: 'Pouncing Fox (4 pts)', copies: '4× in deck' },
];

const CHICKEN_CARDS: { card: Card; label: string; copies: string }[] = [
  { card: { id: 'g-5', kind: 'NUMBER', value: 5 }, label: 'Lady Hen (5 pts)', copies: '4× in deck' },
  { card: { id: 'g-6', kind: 'NUMBER', value: 6 }, label: 'Mama Hen (6 pts)', copies: '4× in deck' },
  { card: { id: 'g-7', kind: 'NUMBER', value: 7 }, label: 'Golden Chick (7 pts)', copies: '4× in deck' },
  { card: { id: 'g-8', kind: 'NUMBER', value: 8 }, label: 'Flapping Hen (8 pts)', copies: '4× in deck' },
  { card: { id: 'g-9', kind: 'CHICKEN', value: 9 }, label: 'Chicks Overload! (9 pts)', copies: '9× in deck' },
];

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-3xl bg-gradient-to-b from-stone-900 via-stone-900 to-amber-950 border-2 border-amber-500/40 shadow-2xl p-4 text-amber-50 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦊</span>
            <div>
              <h2 className="text-lg font-black tracking-wide text-amber-300 leading-none">
                CARD GALLERY &amp; RULES
              </h2>
              <p className="text-[11px] text-stone-400 mt-0.5">
                51-Card Deck • Lowest Score Wins!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Rules Summary */}
        <div className="rounded-2xl bg-stone-950/80 border border-stone-800 p-3 space-y-2 text-xs text-stone-300">
          <div className="font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>How to Play Kookriko</span>
          </div>
          <ul className="space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              Each player gets <strong>4 face-down cards</strong> and peeks at their{' '}
              <span className="text-amber-200 font-semibold">2 outer cards (#1 &amp; #4)</span> once at the start.
            </li>
            <li>
              On your turn, draw from the <strong>Deck</strong> or take the top{' '}
              <strong>Discard</strong> card to swap into your hand.
            </li>
            <li>
              Keep <span className="text-orange-300 font-bold">low Fox cards (0–4)</span> and ditch{' '}
              <span className="text-rose-300 font-bold">high Chicken cards (5–9)</span>!
            </li>
            <li>
              When you think your 4 cards have the lowest total, call{' '}
              <span className="text-yellow-300 font-black">🐓 KOOKRIKO!</span> Everyone else gets 1 final turn!
            </li>
          </ul>
        </div>

        {/* Low Cards: Foxes 0-4 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-orange-300">
              🦊 Low Score Cards: Clever Foxes (0–4)
            </h3>
            <span className="text-[10px] font-bold text-stone-400">4 copies each</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {FOX_CARDS.map((item) => (
              <div key={item.card.id} className="flex flex-col items-center gap-1">
                <CardView card={item.card} faceUp={true} size="sm" />
                <span className="text-[9px] font-bold text-amber-200/90 text-center leading-tight">
                  {item.card.value} pt
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* High Cards: Chickens 5-9 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-300">
              🐓 High Penalty Cards: Chickens (5–9)
            </h3>
            <span className="text-[10px] font-bold text-rose-400">Nine has 9 copies!</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {CHICKEN_CARDS.map((item) => (
              <div key={item.card.id} className="flex flex-col items-center gap-1">
                <CardView card={item.card} faceUp={true} size="sm" />
                <span className="text-[9px] font-bold text-rose-200/90 text-center leading-tight">
                  {item.card.value} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Cards: Peek & Swap */}
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-sky-300">
            ⚡ Special Action Cards (3 copies each)
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-sky-950/40 border border-sky-400/30 p-2.5 flex items-center gap-2.5">
              <CardView
                card={{ id: 'g-peek', kind: 'FOX_PEEK', value: null }}
                faceUp={true}
                size="sm"
              />
              <div className="text-[11px] space-y-0.5">
                <div className="font-black text-sky-300 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>PEEK (3×)</span>
                </div>
                <p className="text-stone-300 leading-tight text-[10px]">
                  Secretly look at any 1 of your own 4 face-down cards.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-950/40 border border-amber-400/30 p-2.5 flex items-center gap-2.5">
              <CardView
                card={{ id: 'g-swap', kind: 'FOX_SWAP', value: null }}
                faceUp={true}
                size="sm"
              />
              <div className="text-[11px] space-y-0.5">
                <div className="font-black text-amber-300 flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  <span>SWAP (3×)</span>
                </div>
                <p className="text-stone-300 leading-tight text-[10px]">
                  Blindly swap 1 of your cards with any opponent&apos;s card!
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer"
        >
          Got It, Let&apos;s Play!
        </button>
      </div>
    </div>
  );
};
