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
  BookOpen,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { CardView } from './CardView';
import { RulesModal } from './RulesModal';
import { soundFX } from '../utils/sound';

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

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [muted, setMuted] = useState(() => soundFX.isMuted());

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
      }, 2600);
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
      return 'Memorize outer cards (#1 & #4), then tap Ready!';
    }
    if (phase === 'ROUND_OVER') {
      return 'All cards revealed! Lowest score wins the round.';
    }
    if (!isMyTurn) {
      return `Waiting for ${activePlayer?.nickname ?? 'opponent'}...`;
    }
    switch (turnStep) {
      case 'AWAITING_DRAW':
        return 'Tap Draw or Discard Pile, or call Kookriko!';
      case 'DECIDING_DRAWN_CARD':
        if (isMyDrawnCardFox) {
          return 'Tap "Use Fox Power" or tap Discard.';
        }
        if (clientState.drawnSource === 'DISCARD') {
          return 'Tap 1 of your 4 cards to swap with this card.';
        }
        return 'Tap 1 of your 4 cards to swap, or tap Discard.';
      case 'PEEKING_OWN_CARD':
        return '🦊 Fox Peek: Tap 1 of your 4 cards to inspect.';
      case 'PERFORMING_PEEK_VIEW':
        return 'Memorize your card, then tap "Done Peeking".';
      case 'SELECTING_SWAP_CARDS':
        if (selectedMySlot !== null) {
          return `Selected #${selectedMySlot + 1}. Now tap any opponent's card!`;
        }
        if (selectedOpponentTarget !== null) {
          return 'Selected opponent card. Now tap 1 of your cards!';
        }
        return '🦊 Fox Swap: Tap 1 of your cards & 1 opponent card.';
      default:
        return '';
    }
  };

  return (
    <div className="relative h-[100dvh] w-full max-w-md mobile-landscape:max-w-none mx-auto overflow-y-auto overflow-x-hidden bg-tabletop text-amber-50 flex flex-col justify-between p-2.5 mobile-landscape:px-2.5 mobile-landscape:py-1.5 select-none">
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* FULL-SCREEN KOOKRIKO SPLASH ALERT OVERLAY */}
      {kookrikoSplashCaller && phase === 'PLAYING' && (
        <div
          onClick={() => setKookrikoSplashCaller(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="w-full max-w-xs rounded-3xl bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 p-4 text-center shadow-2xl border-3 border-yellow-200 animate-bounce space-y-1.5">
            <img
              src="/cards/card-9.png"
              alt="Kookriko Rooster"
              className="w-16 h-18 mx-auto rounded-2xl border-2 border-yellow-200 shadow-xl"
            />
            <h2 className="text-2xl font-black tracking-tight text-white drop-shadow">
              KOOKRIKO!
            </h2>
            <p className="text-xs font-extrabold text-amber-100 uppercase tracking-wider">
              Called by {kookrikoSplashCaller}!
            </p>
            <p className="text-[11px] font-bold text-stone-950 bg-yellow-300/95 rounded-xl py-1 px-2.5 inline-block">
              Every other player gets 1 FINAL TURN!
            </p>
          </div>
        </div>
      )}

      {/* TOP HEADER BAR (Shared across Portrait & Mobile Landscape) */}
      <header className="shrink-0 space-y-1">
        <div className="flex items-center justify-between px-2.5 py-1.5 mobile-landscape:py-1 rounded-2xl bg-wood-panel border border-amber-400/40 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-300/40 font-mono font-black text-yellow-300 tracking-wider text-[11px]">
              #{clientState.roomCode}
            </span>
            {clientState.kookrikoCallerId && phase === 'PLAYING' && (
              <span className="hidden mobile-landscape:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-orange-500 border border-yellow-300 text-white text-[10px] font-black uppercase animate-pulse">
                <Flame className="w-3 h-3 fill-current" />
                Kookriko by{' '}
                {clientState.kookrikoCallerId === myPlayerId
                  ? 'You'
                  : kookrikoCallerPlayer?.nickname}
              </span>
            )}
          </div>

          <div className="text-[11px] text-amber-100 font-semibold truncate max-w-[180px] mobile-landscape:max-w-[320px]">
            {clientState.lastActionMessage}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMuted(soundFX.toggleMute())}
              className="p-1 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-400/30 text-amber-200 cursor-pointer transition"
              title="Toggle Sound Effects"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-stone-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-yellow-300" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="p-1 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-400/30 text-yellow-200 cursor-pointer transition"
              title="Card Gallery & Rules"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={leaveRoom}
              className="p-1 rounded-xl bg-amber-950/80 hover:bg-red-900/80 border border-amber-400/30 text-amber-200 cursor-pointer transition"
              title="Leave Game"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Portrait-mode Kookriko Alert Banner */}
        {clientState.kookrikoCallerId && phase === 'PLAYING' && (
          <div className="mobile-landscape:hidden w-full px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-red-600 border border-yellow-300 shadow-lg flex items-center justify-between text-white animate-pulse">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
              <span className="text-sm">🐓</span>
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
      </header>

      {/* ADAPTIVE BODY: Vertical Stack in Portrait/Desktop, 3-Column Tabletop in Mobile Landscape */}
      <div className="flex-1 min-h-0 flex flex-col justify-between mobile-landscape:flex-row mobile-landscape:items-center mobile-landscape:justify-between mobile-landscape:gap-2 pt-1">
        {/* ZONE 1: OPPONENTS (Top in Portrait, Left Column in Mobile Landscape) */}
        <section className="shrink-0 mobile-landscape:w-[30%] mobile-landscape:max-h-full mobile-landscape:overflow-y-auto">
          <div
            className={`grid gap-1.5 mobile-landscape:gap-1 ${
              opponents.length === 1
                ? 'grid-cols-1 max-w-[260px] mx-auto w-full'
                : opponents.length === 2
                  ? 'grid-cols-2 mobile-landscape:grid-cols-1'
                  : 'grid-cols-3 mobile-landscape:grid-cols-1'
            }`}
          >
            {opponents.map((opp) => {
              const isOppTurn =
                phase === 'PLAYING' && clientState.activePlayerId === opp.id;
              const isKookrikoCaller = clientState.kookrikoCallerId === opp.id;
              const isRoundWinner =
                phase === 'ROUND_OVER' &&
                clientState.winnerIds.includes(opp.id);

              return (
                <div
                  key={opp.id}
                  className={`rounded-2xl p-1.5 mobile-landscape:p-1 border-2 transition-all duration-300 ${
                    isOppTurn
                      ? 'bg-gradient-to-b from-amber-500/35 to-amber-900/75 border-yellow-300 shadow-lg shadow-amber-400/25'
                      : isKookrikoCaller
                        ? 'bg-red-950/75 border-red-400 shadow-md'
                        : isRoundWinner
                          ? 'bg-emerald-800/65 border-emerald-300 shadow-lg'
                          : 'bg-wood-panel border-amber-500/35'
                  }`}
                >
                  {/* Opponent Name & Score */}
                  <div className="flex items-center justify-between gap-1 mb-1 px-0.5">
                    <div className="flex items-center gap-1 truncate">
                      {opp.isHost && (
                        <Crown className="w-3 h-3 text-yellow-300 shrink-0" />
                      )}
                      <span className="text-[11px] mobile-landscape:text-[10px] font-black text-amber-50 truncate">
                        {opp.nickname}
                      </span>
                      {isOppTurn && (
                        <span className="w-2 h-2 rounded-full bg-yellow-300 animate-ping shrink-0" />
                      )}
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
                      <span
                        className={`text-[10px] mobile-landscape:text-[9px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                          isRoundWinner
                            ? 'bg-yellow-300 text-stone-950'
                            : 'bg-amber-950/90 border border-amber-400/30 text-yellow-200'
                        }`}
                      >
                        {phase === 'ROUND_OVER' && opp.roundScore !== null
                          ? `${opp.roundScore}pt (${opp.totalScore})`
                          : `${opp.totalScore}pt`}
                      </span>
                    </div>
                  </div>

                  {/* Opponent's 4 Cards */}
                  <div className="flex items-center justify-center gap-1.5 mobile-landscape:gap-1 pt-0.5 pb-0.5">
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
                          dealIndex={slot.slotIndex + 1}
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

        {/* ZONE 2: CENTER FELT TABLETOP (Center in both Portrait & Mobile Landscape) */}
        <main className="my-auto mobile-landscape:my-0 mobile-landscape:w-[37%] flex flex-col items-center justify-center gap-1.5 mobile-landscape:gap-1 py-1">
          {errorMessage && (
            <div className="w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-red-900/95 border border-red-300 text-white text-[11px] shadow-lg">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="font-bold text-yellow-200"
              >
                ✕
              </button>
            </div>
          )}

          {/* VISUAL SWAP BANNER */}
          {lastMoveEvent &&
            (lastMoveEvent.kind === 'FOX_SWAP' ||
              lastMoveEvent.kind === 'HAND_SWAP') && (
              <div className="w-full px-2.5 py-1 mobile-landscape:py-0.5 rounded-xl bg-gradient-to-r from-sky-900/95 via-cyan-900/95 to-sky-900/95 border border-cyan-300/70 text-cyan-50 text-[10px] font-bold flex items-center justify-center gap-1 shadow-md">
                <ArrowLeftRight className="w-3 h-3 text-cyan-300 shrink-0" />
                {lastMoveEvent.kind === 'FOX_SWAP' ? (
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    <span className="text-yellow-300 font-black">🦊 SWAP:</span>
                    <span className="px-1 py-0.2 rounded bg-cyan-400/25 border border-cyan-300/50 text-white font-extrabold">
                      {lastMoveEvent.actorId === myPlayerId
                        ? 'You'
                        : lastMoveEvent.actorName}{' '}
                      #{lastMoveEvent.actorSlotIndex + 1}
                    </span>
                    <span className="text-yellow-300 font-black">⇄</span>
                    <span className="px-1 py-0.2 rounded bg-cyan-400/25 border border-cyan-300/50 text-white font-extrabold">
                      {lastMoveEvent.targetPlayerId === myPlayerId
                        ? 'You'
                        : lastMoveEvent.targetPlayerName}{' '}
                      #{lastMoveEvent.targetSlotIndex + 1}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap justify-center truncate">
                    <span className="text-yellow-300 font-black">🔄 SWAP:</span>
                    <span className="truncate">
                      <strong>
                        {lastMoveEvent.actorId === myPlayerId
                          ? 'You'
                          : lastMoveEvent.actorName}
                      </strong>{' '}
                      swapped #{lastMoveEvent.slotIndex + 1} (threw{' '}
                      {lastMoveEvent.discardedLabel})
                    </span>
                  </div>
                )}
              </div>
            )}

          {/* Turn Status Pill */}
          <div
            className={`px-3.5 py-0.5 rounded-full text-[11px] font-black tracking-wide border-2 flex items-center gap-1.5 transition-all duration-300 ${
              phase === 'ROUND_OVER'
                ? 'bg-gradient-to-r from-emerald-400 to-teal-400 border-yellow-200 text-stone-950 shadow-lg'
                : isMyTurn
                  ? 'bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400 text-amber-950 border-white shadow-lg shadow-amber-400/35'
                  : 'bg-wood-panel border-amber-400/50 text-amber-100'
            }`}
          >
            {phase === 'INITIAL_PEEK' && (
              <>
                <Eye className="w-3 h-3 text-yellow-300" />
                <span>MEMORIZE OUTER 2 CARDS</span>
              </>
            )}
            {phase === 'PLAYING' && (
              <>
                <Sparkles className="w-3 h-3" />
                <span>
                  {isMyTurn
                    ? 'YOUR TURN!'
                    : `${activePlayer?.nickname.toUpperCase()}'S TURN`}
                </span>
              </>
            )}
            {phase === 'ROUND_OVER' && (
              <>
                <Trophy className="w-3 h-3" />
                <span>ROUND COMPLETE!</span>
              </>
            )}
          </div>

          {/* Center Tabletop Felt Mat: Draw Pile & Discard Pile */}
          <div className="w-full rounded-3xl bg-felt-mat px-3 py-2.5 mobile-landscape:py-1.5 flex items-center justify-center gap-4 mobile-landscape:gap-2.5">
            {/* Draw Pile */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] mobile-landscape:text-[9px] font-black uppercase tracking-wider text-yellow-200/90">
                Draw ({clientState.deckCount})
              </span>
              <CardView
                card={null}
                faceUp={false}
                size="md"
                stackCount={clientState.deckCount}
                isSelectable={canTapDrawPile}
                highlightBadge={canTapDrawPile ? 'TAP DRAW' : undefined}
                onClick={handleDrawPileTap}
              />
            </div>

            {/* Active Drawn Card Tray */}
            {myDrawnCard && isMyTurn && (
              <div className="animate-draw-pop flex flex-col items-center gap-1 px-2 py-1.5 mobile-landscape:p-1.5 rounded-2xl bg-gradient-to-b from-amber-900/95 to-stone-950/95 border-2 border-yellow-300 shadow-2xl">
                <span className="text-[9px] mobile-landscape:text-[8px] font-black uppercase tracking-wider text-yellow-300">
                  Drawn ({clientState.drawnSource})
                </span>
                <CardView
                  card={myDrawnCard}
                  faceUp={true}
                  size="md"
                  isSelected={true}
                />
                <div className="flex flex-col mobile-landscape:flex-row gap-1 w-full mt-0.5">
                  {isMyDrawnCardFox && (
                    <button
                      type="button"
                      onClick={() =>
                        dispatchIntent({
                          type: 'ACTIVATE_FOX_POWER',
                          playerId: myPlayerId,
                        })
                      }
                      className="w-full px-2 py-1 rounded-xl bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 text-amber-950 font-black text-[10px] mobile-landscape:text-[9px] flex items-center justify-center gap-1 shadow-md cursor-pointer"
                    >
                      {myDrawnCard.kind === 'FOX_PEEK' ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Peek</span>
                        </>
                      ) : (
                        <>
                          <Repeat className="w-3 h-3" />
                          <span>Swap</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDiscardPileTap}
                    className="w-full px-2 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 border border-amber-300/40 text-amber-100 font-bold text-[10px] mobile-landscape:text-[9px] flex items-center justify-center gap-1 shadow cursor-pointer"
                  >
                    <span>
                      {clientState.drawnSource === 'DISCARD'
                        ? '↩ Back'
                        : '✕ Throw'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Opponent Drawn Indicator */}
            {!isMyTurn && clientState.activePlayerHasDrawnCard && (
              <div className="animate-draw-pop flex flex-col items-center gap-1 px-2 py-1 rounded-2xl bg-wood-panel border border-yellow-300/50">
                <span className="text-[8px] font-bold uppercase text-yellow-300">
                  From {clientState.drawnSource}
                </span>
                <CardView card={null} faceUp={false} size="sm" />
              </div>
            )}

            {/* Discard Pile */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] mobile-landscape:text-[9px] font-black uppercase tracking-wider text-yellow-200/90">
                Discard ({clientState.discardCount})
              </span>
              {topDiscard ? (
                <CardView
                  card={topDiscard}
                  faceUp={true}
                  size="md"
                  stackCount={clientState.discardCount}
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
                  onClick={
                    canDiscardDrawnCard ? handleDiscardPileTap : undefined
                  }
                  className={`w-[74px] h-[86px] mobile-landscape:w-[56px] mobile-landscape:h-[66px] rounded-2xl border-2 border-dashed flex items-center justify-center text-[10px] font-bold uppercase ${
                    canDiscardDrawnCard
                      ? 'border-yellow-300 text-yellow-200 bg-emerald-950/50 animate-pulse cursor-pointer'
                      : 'border-amber-200/30 text-amber-100/50'
                  }`}
                >
                  {canDiscardDrawnCard ? 'Tap Discard' : 'Empty'}
                </button>
              )}
            </div>
          </div>

          {/* Contextual Center Action Buttons (Kookriko / Complete Peek / Next Round) */}
          <div className="flex items-center justify-center gap-2 min-h-[30px]">
            {canCallKookriko && (
              <button
                type="button"
                onClick={() =>
                  dispatchIntent({
                    type: 'CALL_KOOKRIKO',
                    playerId: myPlayerId,
                  })
                }
                className="px-4 py-1.5 mobile-landscape:py-1 rounded-2xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:to-yellow-400 active:scale-95 text-white font-black text-xs mobile-landscape:text-[11px] tracking-wide uppercase shadow-xl shadow-red-600/40 border-2 border-yellow-300 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="text-sm">🐓</span>
                <span>Call Kookriko!</span>
              </button>
            )}

            {isMyTurn && turnStep === 'PERFORMING_PEEK_VIEW' && (
              <button
                type="button"
                onClick={() =>
                  dispatchIntent({
                    type: 'COMPLETE_PEEK',
                    playerId: myPlayerId,
                  })
                }
                className="px-4 py-1.5 mobile-landscape:py-1 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-stone-950 font-black text-xs mobile-landscape:text-[11px] uppercase shadow-lg border border-yellow-200 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Done Peeking</span>
              </button>
            )}

            {phase === 'ROUND_OVER' && (
              <div className="flex items-center gap-2">
                {isHost ? (
                  <button
                    type="button"
                    onClick={() =>
                      dispatchIntent({
                        type: 'START_GAME',
                        playerId: myPlayerId,
                      })
                    }
                    className="px-4 py-1.5 mobile-landscape:py-1 rounded-2xl bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 hover:from-yellow-200 hover:to-orange-300 text-amber-950 font-black text-xs mobile-landscape:text-[11px] uppercase shadow-xl border-2 border-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Deal Next Round</span>
                  </button>
                ) : (
                  <span className="text-xs text-amber-100 font-bold px-3 py-1 rounded-xl bg-wood-panel border border-amber-400/40">
                    Waiting for Host...
                  </span>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ZONE 3: LOCAL PLAYER'S 4 CARDS (Bottom in Portrait, Right Column 2x2 Grid in Mobile Landscape) */}
        <footer className="shrink-0 mobile-landscape:w-[31%] bg-wood-panel border-2 border-amber-400/50 rounded-3xl p-2.5 mobile-landscape:p-2 space-y-2 mobile-landscape:space-y-1.5 shadow-2xl">
          {/* Storybook Parchment Prompt Banner */}
          <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 mobile-landscape:py-1 rounded-2xl bg-parchment border border-amber-500/60">
            <p className="text-xs mobile-landscape:text-[10px] font-extrabold text-amber-950 leading-tight">
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
                className="shrink-0 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-[11px] mobile-landscape:text-[10px] flex items-center gap-1 shadow-md cursor-pointer animate-bounce"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready!</span>
              </button>
            )}
          </div>

          {/* Local Player's 4 Cards: 4-across in Portrait, 2x2 Grid in Mobile Landscape so cards are NEVER trimmed! */}
          {myPlayer && (
            <div className="flex items-center justify-around gap-1.5 mobile-landscape:grid mobile-landscape:grid-cols-2 mobile-landscape:gap-x-3 mobile-landscape:gap-y-2 mobile-landscape:place-items-center pt-1 pb-1">
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
                    dealIndex={slot.slotIndex + 1}
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
            <div className="flex items-center justify-between px-1 pt-0.5 text-xs mobile-landscape:text-[10px]">
              <div className="flex items-center gap-1 truncate">
                <span className="font-black text-yellow-300 truncate">
                  {myPlayer.nickname} (You)
                </span>
                {clientState.kookrikoCallerId === myPlayerId && (
                  <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[9px] font-black uppercase">
                    🐓
                  </span>
                )}
                {phase === 'ROUND_OVER' &&
                  clientState.winnerIds.includes(myPlayerId) && (
                    <span className="px-1.5 py-0.2 rounded-full bg-yellow-300 text-amber-950 text-[9px] font-black">
                      🏆 Win!
                    </span>
                  )}
              </div>

              <div className="flex items-center gap-1 font-mono shrink-0">
                {phase === 'ROUND_OVER' && myPlayer.roundScore !== null && (
                  <span className="text-emerald-300 font-black">
                    +{myPlayer.roundScore}pt
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded-lg bg-amber-950/90 border border-amber-400/40 text-yellow-200 font-bold">
                  Total: {myPlayer.totalScore}pt
                </span>
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};
