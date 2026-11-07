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
  Bot,
  BookOpen,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { RulesModal } from './RulesModal';

export const LobbyScreen: React.FC = () => {
  const {
    clientState,
    role,
    myPlayerId,
    dispatchIntent,
    addBotPlayer,
    leaveRoom,
    errorMessage,
    clearError,
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  if (!clientState) return null;

  const isHost = role === 'HOST';
  const canStart = isHost && clientState.players.length >= 2;
  const canAddBot = isHost && clientState.players.length < 4;

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
    <div className="min-h-[100dvh] w-full bg-tabletop text-amber-50 flex flex-col justify-between p-4 mobile-landscape:py-2 mobile-landscape:px-4 max-w-md mobile-landscape:max-w-4xl mx-auto select-none overflow-y-auto overflow-x-hidden">
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Top Bar */}
      <header className="flex items-center justify-between pt-0.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐓</span>
          <div>
            <h1 className="text-base font-black tracking-wide text-yellow-300 leading-none">
              KOOKRIKO LOBBY
            </h1>
            <p className="text-[11px] text-amber-200/80">
              {isHost ? 'You are the Host' : 'Connected to Host'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsRulesOpen(true)}
            className="px-3 py-1.5 mobile-landscape:py-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 text-xs font-black flex items-center gap-1 cursor-pointer shadow"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={leaveRoom}
            className="px-3 py-1.5 mobile-landscape:py-1 rounded-xl bg-wood-panel hover:brightness-110 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-400/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Center Content: Stacked in Portrait, 2-Column in Mobile Landscape */}
      <main className="my-auto py-2.5 mobile-landscape:py-1.5 grid grid-cols-1 mobile-landscape:grid-cols-12 gap-3.5 mobile-landscape:gap-4 items-center">
        {errorMessage && (
          <div className="mobile-landscape:col-span-12 flex items-start gap-2.5 p-2.5 rounded-xl bg-red-900/90 border border-red-300 text-white text-xs">
            <AlertCircle className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={clearError}
              className="text-yellow-200 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Room Code Card */}
        <div className="mobile-landscape:col-span-5 bg-wood-panel border-2 border-amber-400/50 rounded-3xl p-4 mobile-landscape:p-3 text-center shadow-2xl space-y-2">
          <div className="text-[11px] font-black uppercase tracking-widest text-yellow-300">
            Share Room Code With Friends
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-4xl mobile-landscape:text-3xl font-black tracking-[0.28em] text-yellow-200 pl-2">
              {clientState.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-yellow-300/40 text-yellow-200 transition cursor-pointer"
              title="Copy Room Code"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-300" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="px-3.5 py-1 rounded-xl bg-parchment text-xs font-black text-amber-950 transition cursor-pointer hover:brightness-105"
            >
              {copiedLink ? '✓ Invite Link Copied!' : 'Copy Direct Join Link'}
            </button>
          </div>
          <p className="text-xs text-amber-200/80">
            {clientState.lastActionMessage}
          </p>
        </div>

        {/* Connected Players List (Max 4) */}
        <div className="mobile-landscape:col-span-7 bg-wood-panel border-2 border-amber-400/40 rounded-3xl p-3.5 mobile-landscape:p-3 space-y-2 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-yellow-200">
              <Users className="w-4 h-4 text-yellow-300" />
              <span>Players in Coop</span>
            </div>
            <div className="flex items-center gap-2">
              {canAddBot && (
                <button
                  type="button"
                  onClick={addBotPlayer}
                  className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-stone-950 text-[11px] font-black flex items-center gap-1 cursor-pointer transition shadow"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>+ Add AI Bot</span>
                </button>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-yellow-200 border border-yellow-300/40">
                {clientState.players.length} / 4
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 mobile-landscape:grid-cols-2 gap-1.5">
            {clientState.players.map((player, index) => {
              const isMe = player.id === myPlayerId;
              const isBot = player.id.startsWith('bot-');
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-3 py-2 mobile-landscape:py-1.5 rounded-2xl border ${
                    isMe
                      ? 'bg-amber-400/20 border-yellow-300/60'
                      : 'bg-stone-950/65 border-amber-500/25'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-7 h-7 rounded-full bg-amber-950 border border-yellow-300/50 flex items-center justify-center font-black text-xs text-yellow-300 shrink-0">
                      {index + 1}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-50 truncate">
                        <span className="truncate">{player.nickname}</span>
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-yellow-300 text-amber-950 font-black">
                            YOU
                          </span>
                        )}
                        {isBot && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-400 text-stone-950 font-black">
                            BOT
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-amber-200/80 flex items-center gap-1">
                        <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                        <span>{isBot ? 'Ready' : 'Connected'}</span>
                      </div>
                    </div>
                  </div>

                  {player.isHost && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/25 border border-yellow-300/50 text-yellow-200 text-[10px] font-black shrink-0">
                      <Crown className="w-3 h-3" />
                      Host
                    </span>
                  )}
                </div>
              );
            })}

            {Array.from({ length: emptySlotCount }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="flex items-center justify-between px-3 py-2 mobile-landscape:py-1.5 rounded-2xl border border-dashed border-amber-400/30 bg-stone-950/35 text-amber-200/50 text-xs"
              >
                <span>Waiting for player...</span>
                <span className="font-mono text-[10px]">
                  #{clientState.players.length + idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Action Footer */}
      <footer className="pb-0.5 shrink-0">
        {isHost ? (
          <button
            type="button"
            onClick={handleStartGame}
            disabled={!canStart}
            className="w-full py-3 mobile-landscape:py-2 px-5 rounded-2xl bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 hover:from-yellow-200 hover:to-orange-300 disabled:opacity-40 text-amber-950 font-black text-base mobile-landscape:text-sm shadow-xl border-2 border-yellow-100 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>
              {canStart
                ? `Start Game (${clientState.players.length} Players)`
                : 'Add an AI Bot or Invite a Friend to Start'}
            </span>
          </button>
        ) : (
          <div className="w-full py-3 mobile-landscape:py-2 px-5 rounded-2xl bg-wood-panel border border-amber-400/40 text-center text-sm text-amber-100 font-bold">
            Waiting for the Host to start the game...
          </div>
        )}
      </footer>
    </div>
  );
};
