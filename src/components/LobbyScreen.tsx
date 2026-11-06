import React, { useState } from 'react';
import {
  Copy,
  Check,
  Crown,
  Users,
  Play,
  LogOut,
  AlertCircle,
  Wifi,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export const LobbyScreen: React.FC = () => {
  const {
    clientState,
    role,
    myPlayerId,
    dispatchIntent,
    leaveRoom,
    errorMessage,
    clearError,
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!clientState) return null;

  const isHost = role === 'HOST';
  const canStart = isHost && clientState.players.length >= 2;

  const copyTextWithFallback = async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  };

  const handleCopyCode = async () => {
    try {
      await copyTextWithFallback(clientState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?room=${clientState.roomCode}`;
      await copyTextWithFallback(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleStartGame = () => {
    clearError();
    dispatchIntent({
      type: 'START_GAME',
      playerId: myPlayerId,
    });
  };

  const emptySlotCount = Math.max(0, 4 - clientState.players.length);

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-amber-950 via-stone-900 to-stone-950 text-amber-50 flex flex-col justify-between p-5 max-w-md mx-auto select-none">
      {/* Top Bar */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐓</span>
          <div>
            <h1 className="text-lg font-black tracking-wide text-amber-300 leading-none">
              KOOKRIKO LOBBY
            </h1>
            <p className="text-[11px] text-stone-400">
              {isHost ? 'You are the Host (Authoritative)' : 'Connected to Host'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={leaveRoom}
          className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 border border-stone-700 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave</span>
        </button>
      </header>

      {/* Center Content */}
      <main className="my-auto py-4 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={clearError}
              className="text-red-300 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Room Code Card */}
        <div className="bg-stone-900/95 border border-amber-500/30 rounded-2xl p-4 text-center shadow-xl space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300/80">
            Share Room Code With Friends
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-4xl font-black tracking-[0.28em] text-amber-300 pl-2">
              {clientState.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-200 transition cursor-pointer"
              title="Copy Room Code"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[11px] font-semibold text-amber-200 transition cursor-pointer"
            >
              {copiedLink ? '✓ Invite Link Copied!' : 'Copy Direct Join Link'}
            </button>
          </div>
          <p className="text-xs text-stone-400">
            {clientState.lastActionMessage}
          </p>
        </div>

        {/* Connected Players List (Max 4) */}
        <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-300">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Players in Coop</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {clientState.players.length} / 4
            </span>
          </div>

          <div className="space-y-2">
            {clientState.players.map((player, index) => {
              const isMe = player.id === myPlayerId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl border ${
                    isMe
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-stone-950/70 border-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-sm text-amber-300">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-sm text-amber-50">
                        <span>{player.nickname}</span>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-emerald-400" />
                        <span>Connected</span>
                      </div>
                    </div>
                  </div>

                  {player.isHost && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-bold">
                      <Crown className="w-3.5 h-3.5" />
                      Host
                    </span>
                  )}
                </div>
              );
            })}

            {Array.from({ length: emptySlotCount }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="flex items-center justify-between px-3.5 py-3 rounded-xl border border-dashed border-stone-800 bg-stone-950/30 text-stone-500 text-xs"
              >
                <span>Waiting for player...</span>
                <span className="font-mono text-[11px]">
                  Slot #{clientState.players.length + idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Action Footer */}
      <footer className="pb-2">
        {isHost ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-stone-950 font-black text-base shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {canStart
                  ? `Start Game (${clientState.players.length} Players)`
                  : 'Need at least 2 Players to Start'}
              </span>
            </button>
          </div>
        ) : (
          <div className="w-full py-4 px-5 rounded-2xl bg-stone-900 border border-stone-800 text-center text-sm text-stone-300 font-semibold">
            Waiting for the Host to start the game...
          </div>
        )}
      </footer>
    </div>
  );
};
