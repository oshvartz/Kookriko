import type { ClientCardSlot, ClientGameState, ClientPlayer, GameState } from '../types/game';

/**
 * Produces a strictly sanitized view of the authoritative Master GameState
 * tailored to a single recipient (`viewerPlayerId`).
 *
 * Security / Fairness guarantees:
 * - Never exposes `deck` contents (only `deckCount`).
 * - Only exposes `topDiscard` and `discardCount`.
 * - Only exposes `myDrawnCard` if `viewerPlayerId` is the current active player.
 * - A player's hand card is `null` unless:
 *   (a) `phase === 'ROUND_OVER'`,
 *   (b) `phase === 'INITIAL_PEEK'` AND it is the viewer's own hand AND slotIndex is 0 or 3 (outer cards) AND viewer hasn't finished initial peek,
 *   (c) `turnStep === 'PERFORMING_PEEK_VIEW'` AND `activePeekSlot` matches the viewer and slotIndex.
 */
export function sanitizeStateForPlayer(
  master: GameState,
  viewerPlayerId: string
): ClientGameState {
  const activePlayer = master.players[master.activePlayerIndex] ?? null;
  const isViewerActive = activePlayer?.id === viewerPlayerId;

  const sanitizedPlayers: ClientPlayer[] = master.players.map((player) => {
    const isOwnHand = player.id === viewerPlayerId;

    const handSlots: ClientCardSlot[] = player.hand.map((card, slotIndex) => {
      let shouldReveal = false;

      if (master.phase === 'ROUND_OVER') {
        shouldReveal = true;
      } else if (
        master.phase === 'INITIAL_PEEK' &&
        isOwnHand &&
        !player.hasCompletedInitialPeek &&
        (slotIndex === 0 || slotIndex === 3)
      ) {
        shouldReveal = true;
      } else if (
        master.phase === 'PLAYING' &&
        master.turnStep === 'PERFORMING_PEEK_VIEW' &&
        isOwnHand &&
        master.activePeekSlot?.playerId === viewerPlayerId &&
        master.activePeekSlot?.slotIndex === slotIndex
      ) {
        shouldReveal = true;
      }

      return {
        slotIndex,
        card: shouldReveal ? card : null,
        isRevealedToMe: shouldReveal,
      };
    });

    return {
      id: player.id,
      nickname: player.nickname,
      isHost: player.isHost,
      isConnected: player.isConnected,
      hand: handSlots,
      hasCompletedInitialPeek: player.hasCompletedInitialPeek,
      roundScore: player.roundScore,
      totalScore: player.totalScore,
    };
  });

  const topDiscard =
    master.discardPile.length > 0
      ? master.discardPile[master.discardPile.length - 1]
      : null;

  return {
    roomCode: master.roomCode,
    myPlayerId: viewerPlayerId,
    phase: master.phase,
    players: sanitizedPlayers,
    deckCount: master.deck.length,
    discardCount: master.discardPile.length,
    topDiscard,
    activePlayerId: activePlayer?.id ?? null,
    turnStep: master.turnStep,
    myDrawnCard: isViewerActive ? master.drawnCard : null,
    activePlayerHasDrawnCard: master.drawnCard !== null,
    drawnSource: master.drawnSource,
    kookrikoCallerId: master.kookrikoCallerId,
    lastActionMessage: master.lastActionMessage,
    winnerIds: master.winnerIds,
  };
}
