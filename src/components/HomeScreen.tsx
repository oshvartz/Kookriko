import React, { useState } from 'react';
import { Sparkles, Users, Play, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export const HomeScreen: React.FC = () => {
  const {
    nickname,
    setNickname,
    createRoom,
    joinRoom,
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

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-amber-950 via-stone-900 to-stone-950 text-amber-50 flex flex-col justify-between p-5 max-w-md mx-auto select-none">
      {/* Top Branding Header */}
      <header className="pt-4 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          4-Player WebRTC Card Game
        </div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <span className="text-4xl" role="img" aria-label="Rooster">
            🐓
          </span>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-400 bg-clip-text text-transparent drop-shadow">
            KOOKRIKO
          </h1>
          <span className="text-4xl" role="img" aria-label="Fox">
            🦊
          </span>
        </div>

        <p className="text-xs text-stone-300 max-w-xs mx-auto leading-relaxed">
          Swap out high-penalty <span className="text-red-300 font-semibold">Chickens (9)</span>,
          use <span className="text-orange-300 font-semibold">Fox Powers</span> to peek &amp; swap,
          and call <span className="text-amber-300 font-bold">Kookriko!</span> with the lowest hand.
        </p>
      </header>

      {/* Main Controls Card */}
      <main className="my-auto py-4 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs shadow-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={clearError}
              className="text-red-300 hover:text-white font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Nickname Input */}
        <div className="bg-stone-900/90 border border-stone-700/80 rounded-2xl p-4 shadow-xl space-y-3">
          <div>
            <label
              htmlFor="nickname-input"
              className="block text-xs font-bold uppercase tracking-wider text-amber-300/90 mb-1.5"
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
              className="w-full px-3.5 py-3 rounded-xl bg-stone-950 border border-stone-700 text-amber-50 placeholder-stone-500 text-base font-medium focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Create Game Button */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={isConnecting}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.99] disabled:opacity-50 text-stone-950 font-extrabold text-base shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting PeerJS...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Create Game (Host)</span>
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-stone-800 w-full" />
          <span className="bg-stone-900 px-3 text-[11px] font-bold uppercase tracking-widest text-stone-400">
            OR JOIN FRIENDS
          </span>
          <div className="border-t border-stone-800 w-full" />
        </div>

        {/* Join Game Form */}
        <form
          onSubmit={handleJoin}
          className="bg-stone-900/90 border border-stone-700/80 rounded-2xl p-4 shadow-xl space-y-3"
        >
          <label
            htmlFor="room-code-input"
            className="block text-xs font-bold uppercase tracking-wider text-emerald-300/90"
          >
            4-Letter Room Code
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
              className="w-36 px-3.5 py-3 rounded-xl bg-stone-950 border border-stone-700 text-center font-mono text-xl font-black tracking-[0.25em] uppercase text-emerald-300 placeholder-stone-600 focus:outline-none focus:border-emerald-400 transition"
            />
            <button
              type="submit"
              disabled={isConnecting || roomCodeInput.trim().length < 4}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-40 text-white font-bold text-base shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Users className="w-5 h-5" />
              <span>Join Game</span>
            </button>
          </div>
        </form>
      </main>

      {/* Footer Quick Legend */}
      <footer className="pb-2">
        <div className="rounded-xl bg-stone-900/60 border border-stone-800/80 p-3 text-[11px] text-stone-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Zero-Backend P2P: Host holds the master deck.</span>
          </div>
          <span className="text-stone-500 font-mono">2–4 Players</span>
        </div>
      </footer>
    </div>
  );
};
