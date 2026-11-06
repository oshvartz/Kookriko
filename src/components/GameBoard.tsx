import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Crown,
  Eye,
  Flame,
  LogOut,
  Repeat,
  RotateCcw,
  Sparkles,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { CardView } from './CardView';

export const GameBoard: React.FC = () => {
  const {
    clientState,
    myPlayerId,
    role,
    dispatchIntent,
    leaveRoom,
    errorMessage,
    clearError,
  } = useGameStore();

  // Local UI tap-selection state for Fox Swap (1 own slot + 1 opponent slot)
  const [selectedMySlot, setSelectedMySlot] = useState<number | null>(null);
  const [selectedOpponentTarget, setSelectedOpponentTarget] = useState<{
    playerId: string;
    slotIndex: number;
  } | null>(null);

  // Splash banner state when Kookriko is called so every player gets a huge visual alert
  const [kookrikoSplashCaller, setKookrikoSplashCaller] = useState<
    string | null
  >(null);

  const kookrikoCallerId = clientState?.kookrikoCallerId ?? null;
  const kookrikoCallerPlayer = clientState?.players.find(
    (p) => p.id === kookrikoCallerId
  );

  useEffect(() => {
    if (kookrikoCallerId && kookrikoCallerPlayer) {
      const callerLabel =
        kookrikoCallerId === myPlayerId
          ? 'YOU'
          : kookrikoCallerPlayer.nickname.toUpperCase();
      setKookrikoSplashCaller(callerLabel);
      const timer = setTimeout(() => {
        setKookrikoSplashCaller(null);
      }, 2800);
      return () => clearTimeout(timer);
    } else {
      setKookrikoSplashCaller(null);
    }
  }, [kookrikoCallerId, kookrikoCallerPlayer, myPlayerId]);

  if (!clientState) return null;

  const isHost = role === 'HOST';
  const myPlayer = clientState.players.find((p) => p.id === myPlayerId);
  const opponents = clientState.players.filter((p) => p.id !== myPlayerId);

  const isMyTurn =
    clientState.phase === 'PLAYING' &&
    clientState.activePlayerId === myPlayerId;
  const activePlayer = clientState.players.find(
    (p) => p.id === clientState.activePlayerId
  );

  const phase = clientState.phase;
  const turnStep = clientState.turnStep;
  const myDrawnCard = clientState.myDrawnCard;
  const topDiscard = clientState.topDiscard;
  const lastMoveEvent = clientState.lastMoveEvent;

  const isTopDiscardFox =
    topDiscard?.kind === 'FOX_PEEK' || topDiscard?.kind === 'FOX_SWAP';
  const isMyDrawnCardFox =
    myDrawnCard?.kind === 'FOX_PEEK' || myDrawnCard?.kind === 'FOX_SWAP';

  // Can I tap the Draw Pile?
  const canTapDrawPile = isMyTurn && turnStep === 'AWAITING_DRAW';

  // Can I tap the Discard Pile?
  const canDrawFromDiscard =
    isMyTurn &&
    turnStep === 'AWAITING_DRAW' &&
    topDiscard !== null &&
    !isTopDiscardFox;

  const canDiscardDrawnCard =
    isMyTurn &&
    turnStep === 'DECIDING_DRAWN_CARD' &&
    myDrawnCard !== null;

  // Can I tap my own hand cards?
  const canTapOwnCardForSwap =
    isMyTurn &&
    turnStep === 'DECIDING_DRAWN_CARD' &&
    myDrawnCard !== null &&
    !isMyDrawnCardFox;

  const canTapOwnCardForPeek = isMyTurn && turnStep === 'PEEKING_OWN_CARD';
  const canTapForFoxSwap = isMyTurn && turnStep === 'SELECTING_SWAP_CARDS';

  const canCallKookriko =
    isMyTurn &&
    (turnStep === 'AWAITING_DRAW' || turnStep === 'DECIDING_DRAWN_CARD') &&
    clientState.kookrikoCallerId === null;

  /**
   * Returns visual highlight metadata if a given player's card slot was involved
   * in the most recent swap (`HAND_SWAP` or `FOX_SWAP`).
   */
  const getSlotSwapHighlight = (
    playerId: string,
    slotIndex: number
  ): { isSwapped: boolean; badge?: string } => {
    if (!lastMoveEvent || phase === 'INITIAL_PEEK') {
      return { isSwapped: false };
    }

    if (lastMoveEvent.kind === 'HAND_SWAP') {
      if (
        lastMoveEvent.actorId === playerId &&
        lastMoveEvent.slotIndex === slotIndex
      ) {
        return {
          isSwapped: true,
          badge: `⇄ NEW`,
        };
      }
    }

    if (lastMoveEvent.kind === 'FOX_SWAP') {
      if (
        lastMoveEvent.actorId === playerId &&
        lastMoveEvent.actorSlotIndex === slotIndex
      ) {
        return {
          isSwapped: true,
          badge: `⇄ #${lastMoveEvent.targetSlotIndex + 1}`,
        };
      }
      if (
        lastMoveEvent.targetPlayerId === playerId &&
        lastMoveEvent.targetSlotIndex === slotIndex
      ) {
        return {
          isSwapped: true,
          badge: `⇄ #${lastMoveEvent.actorSlotIndex + 1}`,
        };
      }
    }

    return { isSwapped: false };
  };

  // Handlers
  const handleDrawPileTap = () => {
    if (!canTapDrawPile) return;
    clearError();
    dispatchIntent({ type: 'DRAW_FROM_DECK', playerId: myPlayerId });
  };

  const handleDiscardPileTap = () => {
    clearError();
    if (canDrawFromDiscard) {
      dispatchIntent({ type: 'DRAW_FROM_DISCARD', playerId: myPlayerId });
    } else if (canDiscardDrawnCard) {
      dispatchIntent({ type: 'DISCARD_DRAWN_CARD', playerId: myPlayerId });
    }
  };

  const handleOwnCardTap = (slotIndex: number) => {
    clearError();
    if (canTapOwnCardForSwap) {
      dispatchIntent({
        type: 'SWAP_WITH_HAND',
        playerId: myPlayerId,
        handSlotIndex: slotIndex,
      });
      return;
    }

    if (canTapOwnCardForPeek) {
      dispatchIntent({
        type: 'PEEK_OWN_CARD',
        playerId: myPlayerId,
        handSlotIndex: slotIndex,
      });
      return;
    }

    if (canTapForFoxSwap) {
      if (selectedOpponentTarget) {
        dispatchIntent({
          type: 'FOX_SWAP_CARDS',
          playerId: myPlayerId,
          mySlotIndex: slotIndex,
          targetPlayerId: selectedOpponentTarget.playerId,
          targetSlotIndex: selectedOpponentTarget.slotIndex,
        });
        setSelectedMySlot(null);
        setSelectedOpponentTarget(null);
      } else {
        setSelectedMySlot((prev) => (prev === slotIndex ? null : slotIndex));
      }
    }
  };

  const handleOpponentCardTap = (
    opponentId: string,
    opponentSlotIndex: number
  ) => {
    if (!canTapForFoxSwap) return;
    clearError();

    if (selectedMySlot !== null) {
      dispatchIntent({
        type: 'FOX_SWAP_CARDS',
        playerId: myPlayerId,
        mySlotIndex: selectedMySlot,
        targetPlayerId: opponentId,
        targetSlotIndex: opponentSlotIndex,
      });
      setSelectedMySlot(null);
      setSelectedOpponentTarget(null);
    } else {
      setSelectedOpponentTarget((prev) =>
        prev?.playerId === opponentId && prev?.slotIndex === opponentSlotIndex
          ? null
          : { playerId: opponentId, slotIndex: opponentSlotIndex }
      );
    }
  };

  // Helper instruction prompt for the local player
  const getInstructionPrompt = (): string => {
    if (phase === 'INITIAL_PEEK') {
      if (myPlayer?.hasCompletedInitialPeek) {
        return 'Waiting for other players to finish peeking...';
      }
      return 'Memorize your outer cards (#1 & #4), then tap "I\'m Ready!"';
    }
    if (phase === 'ROUND_OVER') {
      return 'All cards revealed! Lowest score wins the round.';
    }
    if (!isMyTurn) {
      return `Waiting for ${activePlayer?.nickname ?? 'opponent'}...`;
    }
    switch (turnStep) {
      case 'AWAITING_DRAW':
        return 'Tap the Draw Pile or Discard Pile, or call Kookriko!';
      case 'DECIDING_DRAWN_CARD':
        if (isMyDrawnCardFox) {
          return 'Tap "Use Fox Power" or tap Discard.';
        }
        if (clientState.drawnSource === 'DISCARD') {
          return 'Tap 1 of your 4 cards below to swap with this card.';
        }
        return 'Tap 1 of your 4 cards to swap, or tap Discard.';
      case 'PEEKING_OWN_CARD':
        return '🦊 Fox Peek: Tap 1 of your 4 cards below to secretly inspect it.';
      case 'PERFORMING_PEEK_VIEW':
        return 'Memorize your revealed card, then tap "Done Peeking".';
      case 'SELECTING_SWAP_CARDS':
        if (selectedMySlot !== null) {
          return `Selected your card #${selectedMySlot + 1}. Now tap any opponent's card above!`;
        }
        if (selectedOpponentTarget !== null) {
          return 'Selected opponent card. Now tap 1 of your 4 cards below to swap!';
        }
        return '🦊 Fox Swap: Tap 1 of your cards below AND 1 opponent card above.';
      default:
        return '';
    }
  };

  return (
    <div className="relative h-[100dvh] w-full max-w-md mx-auto overflow-hidden bg-gradient-to-b from-stone-950 via-stone-900 to-amber-950 text-amber-50 flex flex-col justify-between p-2.5 select-none">
      {/* FULL-SCREEN KOOKRIKO SPLASH ALERT OVERLAY (Shows for 2.8s when called) */}
      {kookrikoSplashCaller && phase === 'PLAYING' && (
        <div
          onClick={() => setKookrikoSplashCaller(null)}
          className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-6 cursor-pointer"
        >
          <div className="w-full rounded-3xl bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 p-5 text-center shadow-2xl border-2 border-yellow-300 animate-bounce space-y-2">
            <div className="text-5xl">🐓</div>
            <h2 className="text-3xl font-black tracking-tight text-white drop-shadow">
              KOOKRIKO!
            </h2>
            <p className="text-sm font-extrabold text-amber-100 uppercase tracking-wider">
              Called by {kookrikoSplashCaller}!
            </p>
            <p className="text-xs font-bold text-stone-950 bg-yellow-300/95 rounded-xl py-1.5 px-3 inline-block">
              Every other player gets 1 FINAL TURN!
            </p>
          </div>
        </div>
      )}

      {/* 1. TOP BAR + OPPONENTS ZONE (Anchored to Top Half) */}
      <section className="space-y-1.5 shrink-0">
        {/* Compact Header Bar */}
        <div className="flex items-center justify-between px-2 py-1 rounded-xl bg-stone-900/90 border border-stone-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-amber-300 tracking-wider">
              #{clientState.roomCode}
            </span>
          </div>

          <div className="text-[11px] text-stone-300 truncate max-w-[210px]">
            {clientState.lastActionMessage}
          </div>

          <button
            type="button"
            onClick={leaveRoom}
            className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
            title="Leave Game"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* PERSISTENT HIGH-VISIBILITY KOOKRIKO BANNER FOR ALL PLAYERS */}
        {clientState.kookrikoCallerId && phase === 'PLAYING' && (
          <div className="w-full px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-700 via-orange-600 to-red-700 border border-yellow-300/80 shadow-lg shadow-red-600/30 flex items-center justify-between text-white animate-pulse">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
              <span className="text-base">🐓</span>
              <span>
                KOOKRIKO BY{' '}
                {clientState.kookrikoCallerId === myPlayerId
                  ? 'YOU'
                  : kookrikoCallerPlayer?.nickname}
                !
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-yellow-300 text-stone-950 text-[10px] font-black uppercase flex items-center gap-1">
              <Flame className="w-3 h-3 fill-current" />
              Final Turns
            </span>
          </div>
        )}

        {/* Opponents Grid (1 to 3 Opponents) */}
        <div
          className={`grid gap-1.5 ${
            opponents.length === 1
              ? 'grid-cols-1 max-w-[240px] mx-auto'
              : opponents.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'
          }`}
        >
          {opponents.map((opp) => {
            const isOppTurn =
              phase === 'PLAYING' && clientState.activePlayerId === opp.id;
            const isKookrikoCaller = clientState.kookrikoCallerId === opp.id;
            const isRoundWinner =
              phase === 'ROUND_OVER' && clientState.winnerIds.includes(opp.id);

            return (
              <div
                key={opp.id}
                className={`rounded-xl p-1.5 border transition ${
                  isOppTurn
                    ? 'bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/10'
                    : isKookrikoCaller
                      ? 'bg-red-950/60 border-red-400/80'
                      : isRoundWinner
                        ? 'bg-emerald-500/15 border-emerald-400'
                        : 'bg-stone-900/80 border-stone-800'
                }`}
              >
                {/* Opponent Name & Score */}
                <div className="flex items-center justify-between gap-1 mb-1.5 px-0.5">
                  <div className="flex items-center gap-1 truncate">
                    {opp.isHost && (
                      <Crown className="w-3 h-3 text-yellow-400 shrink-0" />
                    )}
                    <span className="text-[11px] font-bold text-amber-100 truncate">
                      {opp.nickname}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isKookrikoCaller && (
                      <span
                        className="px-1 py-0.2 rounded bg-red-500 text-white text-[9px] font-black uppercase"
                        title="Called Kookriko!"
                      >
                        🐓
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-800 text-stone-300">
                      {phase === 'ROUND_OVER' && opp.roundScore !== null
                        ? `${opp.roundScore}pt (${opp.totalScore})`
                        : `${opp.totalScore}pt`}
                    </span>
                  </div>
                </div>

                {/* Opponent's 4 Cards */}
                <div className="flex items-center justify-center gap-1 pt-0.5">
                  {opp.hand.map((slot) => {
                    const isTargetSelected =
                      selectedOpponentTarget?.playerId === opp.id &&
                      selectedOpponentTarget?.slotIndex === slot.slotIndex;
                    const swapHighlight = getSlotSwapHighlight(
                      opp.id,
                      slot.slotIndex
                    );

                    return (
                      <CardView
                        key={slot.slotIndex}
                        card={slot.card}
                        faceUp={slot.isRevealedToMe}
                        size="sm"
                        slotLabel={`${slot.slotIndex + 1}`}
                        isSelectable={canTapForFoxSwap}
                        isSelected={isTargetSelected}
                        wasRecentlySwapped={swapHighlight.isSwapped}
                        swapBadgeText={swapHighlight.badge}
                        onClick={() =>
                          handleOpponentCardTap(opp.id, slot.slotIndex)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. DEAD CENTER: DRAW PILE, DISCARD PILE, DRAWN CARD & KOOKRIKO */}
      <main className="my-auto flex flex-col items-center justify-center gap-2 py-1">
        {errorMessage && (
          <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="font-bold text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* VISUAL SWAP BANNER (Clearly shows all players what swapped with what) */}
        {lastMoveEvent &&
          (lastMoveEvent.kind === 'FOX_SWAP' ||
            lastMoveEvent.kind === 'HAND_SWAP') && (
            <div className="w-full px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-400/60 text-cyan-100 text-[11px] font-bold flex items-center justify-center gap-2 shadow-md">
              <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              {lastMoveEvent.kind === 'FOX_SWAP' ? (
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="text-orange-300 font-black">🦊 FOX SWAP:</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-extrabold">
                    {lastMoveEvent.actorId === myPlayerId
                      ? 'You'
                      : lastMoveEvent.actorName}{' '}
                    #{lastMoveEvent.actorSlotIndex + 1}
                  </span>
                  <span className="text-cyan-300 font-black">⇄</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-extrabold">
                    {lastMoveEvent.targetPlayerId === myPlayerId
                      ? 'You'
                      : lastMoveEvent.targetPlayerName}{' '}
                    #{lastMoveEvent.targetSlotIndex + 1}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="text-cyan-300 font-black">🔄 SWAP:</span>
                  <span>
                    <strong>
                      {lastMoveEvent.actorId === myPlayerId
                        ? 'You'
                        : lastMoveEvent.actorName}
                    </strong>{' '}
                    swapped{' '}
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-extrabold">
                      Card #{lastMoveEvent.slotIndex + 1}
                    </span>{' '}
                    (from {lastMoveEvent.source === 'DISCARD' ? 'Discard' : 'Deck'}{' '}
                    → threw {lastMoveEvent.discardedLabel})
                  </span>
                </div>
              )}
            </div>
          )}

        {/* Turn Status Pill */}
        <div
          className={`px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wide border flex items-center gap-1.5 ${
            phase === 'ROUND_OVER'
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              : isMyTurn
                ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-md shadow-amber-400/20'
                : 'bg-stone-900/90 border-stone-700 text-stone-300'
          }`}
        >
          {phase === 'INITIAL_PEEK' && (
            <>
              <Eye className="w-3.5 h-3.5 text-amber-300" />
              <span>INITIAL PEEK PHASE</span>
            </>
          )}
          {phase === 'PLAYING' && (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isMyTurn
                  ? 'YOUR TURN!'
                  : `${activePlayer?.nickname.toUpperCase()}'S TURN`}
              </span>
            </>
          )}
          {phase === 'ROUND_OVER' && (
            <>
              <Trophy className="w-3.5 h-3.5 text-yellow-300" />
              <span>ROUND COMPLETE</span>
            </>
          )}
        </div>

        {/* Center Piles Row: Draw Pile & Discard Pile */}
        <div className="flex items-center justify-center gap-5">
          {/* Draw Pile */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Deck ({clientState.deckCount})
            </span>
            <CardView
              card={null}
              faceUp={false}
              size="md"
              isSelectable={canTapDrawPile}
              highlightBadge={canTapDrawPile ? 'TAP DRAW' : undefined}
              onClick={handleDrawPileTap}
            />
          </div>

          {/* Active Drawn Card Tray (Shown when a card is currently drawn) */}
          {myDrawnCard && isMyTurn && (
            <div className="flex flex-col items-center gap-1.5 px-2.5 py-2 rounded-2xl bg-amber-500/15 border-2 border-amber-400/70 shadow-xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                Drawn ({clientState.drawnSource})
              </span>
              <CardView
                card={myDrawnCard}
                faceUp={true}
                size="md"
                isSelected={true}
              />
              <div className="flex flex-col gap-1 w-full mt-0.5">
                {isMyDrawnCardFox && (
                  <button
                    type="button"
                    onClick={() =>
                      dispatchIntent({
                        type: 'ACTIVATE_FOX_POWER',
                        playerId: myPlayerId,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black text-[11px] flex items-center justify-center gap-1 shadow cursor-pointer"
                  >
                    {myDrawnCard.kind === 'FOX_PEEK' ? (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Use Peek</span>
                      </>
                    ) : (
                      <>
                        <Repeat className="w-3 h-3" />
                        <span>Use Swap</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDiscardPileTap}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 active:scale-95 border border-stone-600 text-amber-100 font-bold text-[11px] flex items-center justify-center gap-1 shadow cursor-pointer"
                >
                  <span>
                    {clientState.drawnSource === 'DISCARD'
                      ? '↩ Put Back'
                      : '✕ Discard'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Opponent Drawn Indicator (When an opponent is holding a drawn card) */}
          {!isMyTurn && clientState.activePlayerHasDrawnCard && (
            <div className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-2xl bg-stone-900/90 border border-stone-700">
              <span className="text-[9px] font-bold uppercase text-amber-300">
                From {clientState.drawnSource}
              </span>
              <CardView card={null} faceUp={false} size="sm" />
            </div>
          )}

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Discard ({clientState.discardCount})
            </span>
            {topDiscard ? (
              <CardView
                card={topDiscard}
                faceUp={true}
                size="md"
                isSelectable={canDrawFromDiscard || canDiscardDrawnCard}
                highlightBadge={
                  canDiscardDrawnCard
                    ? 'TAP DISCARD'
                    : canDrawFromDiscard
                      ? 'TAP TAKE'
                      : undefined
                }
                onClick={handleDiscardPileTap}
              />
            ) : (
              <button
                type="button"
                onClick={canDiscardDrawnCard ? handleDiscardPileTap : undefined}
                className={`w-20 h-28 rounded-xl border-2 border-dashed flex items-center justify-center text-[10px] font-bold uppercase ${
                  canDiscardDrawnCard
                    ? 'border-emerald-400 text-emerald-300 bg-emerald-950/30 animate-pulse cursor-pointer'
                    : 'border-stone-700 text-stone-600'
                }`}
              >
                {canDiscardDrawnCard ? 'Tap Discard' : 'Empty'}
              </button>
            )}
          </div>
        </div>

        {/* Contextual Center Action Buttons (Kookriko / Complete Peek / Next Round) */}
        <div className="flex items-center justify-center gap-2 min-h-[36px]">
          {canCallKookriko && (
            <button
              type="button"
              onClick={() =>
                dispatchIntent({ type: 'CALL_KOOKRIKO', playerId: myPlayerId })
              }
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:to-amber-400 active:scale-95 text-white font-black text-xs tracking-wide uppercase shadow-lg shadow-red-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🐓</span>
              <span>Call Kookriko!</span>
            </button>
          )}

          {isMyTurn && turnStep === 'PERFORMING_PEEK_VIEW' && (
            <button
              type="button"
              onClick={() =>
                dispatchIntent({ type: 'COMPLETE_PEEK', playerId: myPlayerId })
              }
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs uppercase shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Done Peeking (End Turn)</span>
            </button>
          )}

          {phase === 'ROUND_OVER' && (
            <div className="flex items-center gap-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={() =>
                    dispatchIntent({ type: 'START_GAME', playerId: myPlayerId })
                  }
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black text-xs uppercase shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Deal Next Round</span>
                </button>
              ) : (
                <span className="text-xs text-stone-300 font-semibold px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800">
                  Waiting for Host to deal next round...
                </span>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 3. BOTTOM ZONE: LOCAL PLAYER'S 4 CARDS (Anchored to Bottom) */}
      <footer className="shrink-0 bg-stone-900/95 border border-stone-700/80 rounded-2xl p-3 space-y-2.5 shadow-2xl">
        {/* Contextual Prompt Banner */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-stone-950/90 border border-stone-800">
          <p className="text-xs font-semibold text-amber-200 leading-snug">
            {getInstructionPrompt()}
          </p>

          {phase === 'INITIAL_PEEK' && !myPlayer?.hasCompletedInitialPeek && (
            <button
              type="button"
              onClick={() =>
                dispatchIntent({
                  type: 'FINISH_INITIAL_PEEK',
                  playerId: myPlayerId,
                })
              }
              className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>I&apos;m Ready!</span>
            </button>
          )}
        </div>

        {/* Local Player's 4 Cards Row */}
        {myPlayer && (
          <div className="flex items-center justify-around gap-2 pt-0.5">
            {myPlayer.hand.map((slot) => {
              const isOwnSelectable =
                canTapOwnCardForSwap ||
                canTapOwnCardForPeek ||
                canTapForFoxSwap;
              const isOwnSelected =
                canTapForFoxSwap && selectedMySlot === slot.slotIndex;
              const swapHighlight = getSlotSwapHighlight(
                myPlayerId,
                slot.slotIndex
              );

              let badge: string | undefined;
              if (
                phase === 'INITIAL_PEEK' &&
                !myPlayer.hasCompletedInitialPeek &&
                (slot.slotIndex === 0 || slot.slotIndex === 3)
              ) {
                badge = 'PEEK';
              } else if (canTapOwnCardForSwap) {
                badge = 'TAP SWAP';
              } else if (canTapOwnCardForPeek) {
                badge = 'TAP PEEK';
              } else if (canTapForFoxSwap) {
                badge = isOwnSelected ? 'SELECTED' : 'TAP SWAP';
              }

              return (
                <CardView
                  key={slot.slotIndex}
                  card={slot.card}
                  faceUp={slot.isRevealedToMe}
                  size="lg"
                  slotLabel={`#${slot.slotIndex + 1}`}
                  isSelectable={isOwnSelectable}
                  isSelected={isOwnSelected}
                  highlightBadge={badge}
                  wasRecentlySwapped={swapHighlight.isSwapped}
                  swapBadgeText={swapHighlight.badge}
                  onClick={() => handleOwnCardTap(slot.slotIndex)}
                />
              );
            })}
          </div>
        )}

        {/* Local Player Info Strip */}
        {myPlayer && (
          <div className="flex items-center justify-between px-1 pt-0.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-amber-300">
                {myPlayer.nickname} (You)
              </span>
              {clientState.kookrikoCallerId === myPlayerId && (
                <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black uppercase">
                  🐓 Called Kookriko
                </span>
              )}
              {phase === 'ROUND_OVER' &&
                clientState.winnerIds.includes(myPlayerId) && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold">
                    🏆 Round Winner!
                  </span>
                )}
            </div>

            <div className="font-mono text-stone-300 text-[11px]">
              {phase === 'ROUND_OVER' && myPlayer.roundScore !== null ? (
                <span>
                  Round:{' '}
                  <strong className="text-amber-300">
                    {myPlayer.roundScore}
                  </strong>{' '}
                  | Total: <strong>{myPlayer.totalScore}</strong>
                </span>
              ) : (
                <span>
                  Total Score:{' '}
                  <strong className="text-amber-300">
                    {myPlayer.totalScore}
                  </strong>
                </span>
              )}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};
