import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  Play,
  AlertCircle,
  Loader2,
  BookOpen,
  Bot,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { RulesModal } from './RulesModal';
import { soundFX } from '../utils/sound';

export const HomeScreen: React.FC = () => {
  const {
    nickname,
    setNickname,
    createRoom,
    joinRoom,
    startSoloGame,
    connectionStatus,
    errorMessage,
    clearError,
  } = useGameStore();

  const [roomCodeInput, setRoomCodeInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        return roomParam.trim().toUpperCase().slice(0, 4);
      }
    }
    return '';
  });

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [muted, setMuted] = useState(() => soundFX.isMuted());
  const isConnecting = connectionStatus === 'CONNECTING';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await createRoom(nickname);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await joinRoom(roomCodeInput, nickname);
  };

  const handleSolo = () => {
    clearError();
    startSoloGame(nickname);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-tabletop text-amber-50 flex flex-col justify-between p-4 mobile-landscape:py-2 mobile-landscape:px-4 max-w-md mobile-landscape:max-w-4xl mx-auto select-none overflow-y-auto overflow-x-hidden">
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Top Action Bar */}
      <div className="flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => setMuted(soundFX.toggleMute())}
          className="px-3 py-1.5 mobile-landscape:py-1 rounded-xl bg-wood-panel hover:brightness-110 border border-amber-400/40 text-amber-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          title="Toggle Sound Effects"
        >
          {muted ? (
            <VolumeX className="w-3.5 h-3.5 text-stone-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-yellow-300" />
          )}
          <span>{muted ? 'Muted' : 'SFX On'}</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-yellow-300/40 text-yellow-200 text-[11px] font-black tracking-wide uppercase">
          <Sparkles className="w-3 h-3" />
          <span>2–4 Player Card Game</span>
        </div>

        <button
          type="button"
          onClick={() => setIsRulesOpen(true)}
          className="px-3 py-1.5 mobile-landscape:py-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Cards</span>
        </button>
      </div>

      {/* Main Content: Single Column in Portrait, 2-Column Side-by-Side in Mobile Landscape */}
      <div className="my-auto py-2 mobile-landscape:py-1 grid grid-cols-1 mobile-landscape:grid-cols-12 gap-4 mobile-landscape:gap-4 items-center">
        {/* Left Column (Hero Showcase) */}
        <header className="mobile-landscape:col-span-5 text-center space-y-2 mobile-landscape:space-y-1">
          {/* Fanned Illustrated Card Showcase */}
          <div
            onClick={() => setIsRulesOpen(true)}
            title="Click to inspect all 12 cards!"
            className="relative h-26 mobile-landscape:h-20 flex items-center justify-center pt-1 cursor-pointer group animate-float-slow mobile-landscape:scale-90"
          >
            <img
              src="/cards/card-0.png"
              alt="Card 0"
              className="w-[58px] h-[68px] rounded-xl shadow-xl border-2 border-amber-300 -rotate-15 -translate-x-14 translate-y-2 transition-transform group-hover:-translate-x-16 group-hover:-rotate-18"
            />
            <img
              src="/cards/card-peek.png"
              alt="Peek Card"
              className="w-[62px] h-[70px] rounded-xl shadow-xl border-2 border-sky-300 -rotate-7 -translate-x-7 translate-y-0.5 z-10 transition-transform group-hover:-translate-x-8"
            />
            <img
              src="/cards/card-9.png"
              alt="Card 9"
              className="w-[66px] h-[76px] rounded-2xl shadow-2xl border-2 border-yellow-200 z-20 -translate-y-1 transition-transform group-hover:-translate-y-2.5 group-hover:scale-105"
            />
            <img
              src="/cards/card-swap.png"
              alt="Swap Card"
              className="w-[62px] h-[70px] rounded-xl shadow-xl border-2 border-yellow-300 rotate-7 translate-x-7 translate-y-0.5 z-10 transition-transform group-hover:translate-x-8"
            />
            <img
              src="/cards/card-1.png"
              alt="Card 1"
              className="w-[58px] h-[68px] rounded-xl shadow-xl border-2 border-amber-300 rotate-15 translate-x-14 translate-y-2 transition-transform group-hover:translate-x-16 group-hover:rotate-18"
            />
          </div>

          <div>
            <h1 className="text-4xl mobile-landscape:text-2xl font-black tracking-tight bg-gradient-to-r from-yellow-200 via-amber-300 to-orange-300 bg-clip-text text-transparent drop-shadow-md">
              KOOKRIKO!
            </h1>
            <p className="text-xs mobile-landscape:text-[11px] text-amber-100/90 max-w-xs mx-auto leading-snug mt-0.5">
              Collect clever{' '}
              <span className="text-yellow-300 font-extrabold">Foxes (0–4)</span>,
              ditch noisy{' '}
              <span className="text-rose-300 font-extrabold">Chickens (5–9)</span>,
              and shout{' '}
              <span className="text-yellow-200 font-black">Kookriko!</span>
            </p>
          </div>
        </header>

        {/* Right Column (Controls) */}
        <main className="mobile-landscape:col-span-7 space-y-2.5 mobile-landscape:space-y-2">
          {errorMessage && (
            <div className="flex items-start gap-2 p-2.5 rounded-2xl bg-red-900/90 border border-red-300 text-white text-xs shadow-lg">
              <AlertCircle className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
              <button
                type="button"
                onClick={clearError}
                className="text-yellow-200 hover:text-white font-bold px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Nickname + Host/Solo Card */}
          <div className="bg-wood-panel border-2 border-amber-400/45 rounded-3xl p-3.5 mobile-landscape:p-2.5 shadow-2xl space-y-2.5 mobile-landscape:space-y-2">
            <div>
              <label
                htmlFor="nickname-input"
                className="block text-[11px] mobile-landscape:text-[10px] font-black uppercase tracking-wider text-yellow-300 mb-1"
              >
                Your Nickname
              </label>
              <input
                id="nickname-input"
                type="text"
                maxLength={16}
                placeholder="e.g. Clucky, SlyFox..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={isConnecting}
                className="w-full px-3 py-2 mobile-landscape:py-1.5 rounded-xl bg-stone-950/90 border border-amber-400/40 text-amber-50 placeholder-stone-400 text-sm font-bold focus:outline-none focus:border-yellow-300 transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Create Multiplayer Room */}
              <button
                type="button"
                onClick={handleCreate}
                disabled={isConnecting}
                className="py-2.5 mobile-landscape:py-2 px-3 rounded-xl bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 hover:from-yellow-200 hover:to-orange-300 active:scale-[0.99] disabled:opacity-50 text-amber-950 font-black text-xs shadow-lg shadow-amber-500/25 border border-yellow-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Host Multiplayer</span>
                  </>
                )}
              </button>

              {/* Instant Solo vs Bots */}
              <button
                type="button"
                onClick={handleSolo}
                disabled={isConnecting}
                className="py-2.5 mobile-landscape:py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] border border-emerald-200/60 text-stone-950 font-black text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Solo vs AI Bots</span>
              </button>
            </div>
          </div>

          {/* Join Game Form */}
          <form
            onSubmit={handleJoin}
            className="bg-wood-panel border-2 border-amber-400/35 rounded-3xl p-3.5 mobile-landscape:p-2.5 shadow-xl space-y-1.5"
          >
            <label
              htmlFor="room-code-input"
              className="block text-[11px] mobile-landscape:text-[10px] font-black uppercase tracking-wider text-yellow-200"
            >
              Join Friends with 4-Letter Room Code
            </label>
            <div className="flex gap-2">
              <input
                id="room-code-input"
                type="text"
                maxLength={4}
                placeholder="ABCD"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                disabled={isConnecting}
                className="w-32 px-3 py-2 mobile-landscape:py-1.5 rounded-xl bg-stone-950/90 border border-amber-400/40 text-center font-mono text-base font-black tracking-[0.25em] uppercase text-yellow-300 placeholder-stone-600 focus:outline-none focus:border-yellow-300 transition"
              />
              <button
                type="submit"
                disabled={isConnecting || roomCodeInput.trim().length < 4}
                className="flex-1 py-2 mobile-landscape:py-1.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-40 text-stone-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Join Room</span>
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* Footer Quick Legend */}
      <footer className="pb-0.5 shrink-0">
        <button
          type="button"
          onClick={() => setIsRulesOpen(true)}
          className="w-full rounded-2xl bg-parchment border border-amber-500/60 px-3.5 py-2 mobile-landscape:py-1.5 text-xs mobile-landscape:text-[11px] font-bold text-amber-950 flex items-center justify-between gap-2 cursor-pointer transition hover:brightness-105"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">🃏</span>
            <span>Tap to inspect all 12 illustrated Fox &amp; Chicken cards</span>
          </div>
          <span className="text-orange-800 font-black">View Deck →</span>
        </button>
      </footer>
    </div>
  );
};
