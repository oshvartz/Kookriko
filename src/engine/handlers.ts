import type { GameIntent, GameState, Player } from '../types/game';
import {
  dealInitialHands,
  drawCardFromDeckWithReshuffle,
  isFoxCard,
  resolveHandsAndScoreAtRoundEnd,
} from './deck';

export interface HandlerResult {
  nextState: GameState;
  error?: string;
}

function getActivePlayer(state: GameState): Player | null {
  return state.players[state.activePlayerIndex] ?? null;
}

function findNextConnectedPlayerIndex(
  players: readonly Player[],
  fromIndex: number
): number {
  const count = players.length;
  if (count === 0) return 0;
  for (let offset = 1; offset <= count; offset++) {
    const idx = (fromIndex + offset) % count;
    if (players[idx].isConnected) {
      return idx;
    }
  }
  return (fromIndex + 1) % count;
}

/**
 * Advances to the next player's turn, or concludes the round if Kookriko was called
 * and all remaining final turns have been completed.
 */
export function advanceTurnOrEndRound(
  state: GameState,
  actionSummary: string
): GameState {
  const currentPlayer = getActivePlayer(state);

  // If Kookriko is active, remove the current player from remaining final turns
  let remainingFinalIds = state.finalTurnPlayerIds;
  if (state.kookrikoCallerId !== null && currentPlayer) {
    remainingFinalIds = remainingFinalIds.filter(
      (id) => id !== currentPlayer.id
    );

    // Check if any connected player still has a final turn left
    const connectedRemaining = remainingFinalIds.filter((id) =>
      state.players.some((p) => p.id === id && p.isConnected)
    );

    if (connectedRemaining.length === 0) {
      // Round is over! Replace any hidden Fox cards in hands & score the round.
      const resolved = resolveHandsAndScoreAtRoundEnd(
        state.players,
        state.deck,
        state.discardPile
      );
      const winnerNames = resolved.players
        .filter((p) => resolved.winnerIds.includes(p.id))
        .map((p) => p.nickname)
        .join(' & ');

      return {
        ...state,
        phase: 'ROUND_OVER',
        players: resolved.players,
        deck: resolved.deck,
        discardPile: resolved.discardPile,
        turnStep: 'AWAITING_DRAW',
        drawnCard: null,
        drawnSource: null,
        activePeekSlot: null,
        finalTurnPlayerIds: [],
        winnerIds: resolved.winnerIds,
        lastActionMessage: `${actionSummary} Round over! Lowest score: ${winnerNames}!`,
      };
    }

    remainingFinalIds = connectedRemaining;
  }

  const nextIndex = findNextConnectedPlayerIndex(
    state.players,
    state.activePlayerIndex
  );
  const nextPlayer = state.players[nextIndex];

  return {
    ...state,
    activePlayerIndex: nextIndex,
    turnStep: 'AWAITING_DRAW',
    drawnCard: null,
    drawnSource: null,
    activePeekSlot: null,
    finalTurnPlayerIds: remainingFinalIds,
    lastActionMessage: `${actionSummary} Now ${nextPlayer.nickname}'s turn.`,
  };
}

/**
 * Handles a player joining or reconnecting to the room.
 */
export function handleJoinRoom(
  state: GameState,
  playerId: string,
  nickname: string
): HandlerResult {
  const existingIndex = state.players.findIndex((p) => p.id === playerId);
  if (existingIndex !== -1) {
    const updatedPlayers = state.players.map((p, idx) =>
      idx === existingIndex
        ? { ...p, nickname: nickname.trim() || p.nickname, isConnected: true }
        : p
    );
    return {
      nextState: {
        ...state,
        players: updatedPlayers,
        lastActionMessage: `${updatedPlayers[existingIndex].nickname} reconnected.`,
      },
    };
  }

  if (state.phase !== 'LOBBY') {
    return {
      nextState: state,
      error: 'Cannot join: Game has already started.',
    };
  }

  if (state.players.length >= 4) {
    return {
      nextState: state,
      error: 'Cannot join: Room is full (max 4 players).',
    };
  }

  const newPlayer: Player = {
    id: playerId,
    nickname: nickname.trim() || `Player ${state.players.length + 1}`,
    isHost: false,
    isConnected: true,
    hand: [],
    hasCompletedInitialPeek: false,
    roundScore: null,
    totalScore: 0,
  };

  return {
    nextState: {
      ...state,
      players: [...state.players, newPlayer],
      lastActionMessage: `${newPlayer.nickname} joined (${state.players.length + 1}/4).`,
    },
  };
}

/**
 * Host starts a new round (from LOBBY or ROUND_OVER).
 */
export function handleStartGame(
  state: GameState,
  playerId: string
): HandlerResult {
  const caller = state.players.find((p) => p.id === playerId);
  if (!caller || !caller.isHost) {
    return { nextState: state, error: 'Only the Host can start the game.' };
  }

  if (state.players.length < 2) {
    return {
      nextState: state,
      error: 'Need at least 2 players to start Kookriko.',
    };
  }

  const dealt = dealInitialHands(state.players);

  return {
    nextState: {
      ...state,
      phase: 'INITIAL_PEEK',
      players: dealt.players,
      deck: dealt.deck,
      discardPile: dealt.discardPile,
      activePlayerIndex: 0,
      turnStep: 'AWAITING_DRAW',
      drawnCard: null,
      drawnSource: null,
      activePeekSlot: null,
      kookrikoCallerId: null,
      finalTurnPlayerIds: [],
      winnerIds: [],
      lastActionMessage:
        'Memorize your 2 outer cards, then tap "I\'m Ready!"',
    },
  };
}

/**
 * Player confirms they have memorized their outer 2 cards in INITIAL_PEEK phase.
 */
export function handleFinishInitialPeek(
  state: GameState,
  playerId: string
): HandlerResult {
  if (state.phase !== 'INITIAL_PEEK') {
    return { nextState: state, error: 'Not in the initial peek phase.' };
  }

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hasCompletedInitialPeek: true } : p
  );

  const allReady = updatedPlayers
    .filter((p) => p.isConnected)
    .every((p) => p.hasCompletedInitialPeek);

  if (allReady) {
    const firstPlayer = updatedPlayers[0];
    return {
      nextState: {
        ...state,
        phase: 'PLAYING',
        players: updatedPlayers,
        activePlayerIndex: 0,
        turnStep: 'AWAITING_DRAW',
        lastActionMessage: `All players ready! ${firstPlayer.nickname}'s turn.`,
      },
    };
  }

  const readyCount = updatedPlayers.filter(
    (p) => p.hasCompletedInitialPeek
  ).length;
  return {
    nextState: {
      ...state,
      players: updatedPlayers,
      lastActionMessage: `Waiting for players to peek (${readyCount}/${updatedPlayers.length} ready)...`,
    },
  };
}

/**
 * Active player draws the top card from the face-down Deck.
 */
export function handleDrawFromDeck(
  state: GameState,
  playerId: string
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (state.turnStep !== 'AWAITING_DRAW') {
    return { nextState: state, error: 'You have already drawn a card.' };
  }

  const { drawn, deck, discardPile } = drawCardFromDeckWithReshuffle(
    state.deck,
    state.discardPile
  );

  if (!drawn) {
    return { nextState: state, error: 'No cards left to draw.' };
  }

  return {
    nextState: {
      ...state,
      deck,
      discardPile,
      drawnCard: drawn,
      drawnSource: 'DECK',
      turnStep: 'DECIDING_DRAWN_CARD',
      lastActionMessage: `${activePlayer.nickname} drew a card from the deck.`,
    },
  };
}

/**
 * Active player takes the top face-up card from the Discard pile.
 * Per Rat-a-Tat Cat rules, you can only take Number/Chicken cards from Discard
 * (never Fox power cards), and you MUST swap it into your hand.
 */
export function handleDrawFromDiscard(
  state: GameState,
  playerId: string
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (state.turnStep !== 'AWAITING_DRAW') {
    return { nextState: state, error: 'You have already drawn a card.' };
  }
  if (state.discardPile.length === 0) {
    return { nextState: state, error: 'Discard pile is empty.' };
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  if (isFoxCard(topCard)) {
    return {
      nextState: state,
      error: 'Fox power cards cannot be drawn from the discard pile.',
    };
  }

  const nextDiscard = state.discardPile.slice(0, state.discardPile.length - 1);

  return {
    nextState: {
      ...state,
      discardPile: nextDiscard,
      drawnCard: topCard,
      drawnSource: 'DISCARD',
      turnStep: 'DECIDING_DRAWN_CARD',
      lastActionMessage: `${activePlayer.nickname} took ${topCard.value} from the discard pile.`,
    },
  };
}

/**
 * Active player discards the card they just drew from the Deck without swapping.
 */
export function handleDiscardDrawnCard(
  state: GameState,
  playerId: string
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (state.turnStep !== 'DECIDING_DRAWN_CARD' || !state.drawnCard) {
    return { nextState: state, error: 'No drawn card to discard.' };
  }
  if (state.drawnSource === 'DISCARD') {
    // Allow putting the taken discard card back onto the discard pile to undo taking it
    return {
      nextState: {
        ...state,
        discardPile: [...state.discardPile, state.drawnCard],
        drawnCard: null,
        drawnSource: null,
        turnStep: 'AWAITING_DRAW',
        lastActionMessage: `${activePlayer.nickname} returned ${state.drawnCard.value} to the discard pile.`,
      },
    };
  }

  const discarded = state.drawnCard;
  const nextDiscardPile = [...state.discardPile, discarded];

  const cardLabel =
    discarded.kind === 'FOX_PEEK'
      ? 'Fox Peek'
      : discarded.kind === 'FOX_SWAP'
        ? 'Fox Swap'
        : `${discarded.value}`;

  const intermediateState: GameState = {
    ...state,
    discardPile: nextDiscardPile,
    drawnCard: null,
    drawnSource: null,
  };

  return {
    nextState: advanceTurnOrEndRound(
      intermediateState,
      `${activePlayer.nickname} discarded ${cardLabel}.`
    ),
  };
}

/**
 * Active player swaps their drawn Number/Chicken card with one of their 4 hand slots
 * (`handSlotIndex` 0..3), placing the replaced hand card face-up on the discard pile.
 * Also supports executing a Fox Swap when both own & target slots are provided.
 */
export function handleSwap(
  state: GameState,
  playerId: string,
  handSlotIndex: number
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (state.turnStep !== 'DECIDING_DRAWN_CARD' || !state.drawnCard) {
    return { nextState: state, error: 'Draw a card first before swapping.' };
  }
  if (isFoxCard(state.drawnCard)) {
    return {
      nextState: state,
      error:
        'Fox power cards cannot be placed into your hand. Use its power or discard it!',
    };
  }
  if (handSlotIndex < 0 || handSlotIndex > 3) {
    return { nextState: state, error: 'Invalid hand card slot.' };
  }

  const incomingCard = state.drawnCard;
  const outgoingCard = activePlayer.hand[handSlotIndex];

  const updatedHand = activePlayer.hand.map((c, idx) =>
    idx === handSlotIndex ? incomingCard : c
  );
  const updatedPlayers = state.players.map((p, idx) =>
    idx === state.activePlayerIndex ? { ...p, hand: updatedHand } : p
  );

  const nextDiscardPile = [...state.discardPile, outgoingCard];

  const intermediateState: GameState = {
    ...state,
    players: updatedPlayers,
    discardPile: nextDiscardPile,
    drawnCard: null,
    drawnSource: null,
  };

  return {
    nextState: advanceTurnOrEndRound(
      intermediateState,
      `${activePlayer.nickname} swapped card #${handSlotIndex + 1}.`
    ),
  };
}

/**
 * Active player chooses to activate the drawn Fox card (`FOX_PEEK` or `FOX_SWAP`).
 * The Fox card is placed on the discard pile and the turn transitions to the power target step.
 */
export function handleActivateFoxPower(
  state: GameState,
  playerId: string
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (
    state.turnStep !== 'DECIDING_DRAWN_CARD' ||
    !state.drawnCard ||
    !isFoxCard(state.drawnCard)
  ) {
    return { nextState: state, error: 'You do not have an active Fox card.' };
  }

  const foxCard = state.drawnCard;
  const nextDiscardPile = [...state.discardPile, foxCard];

  if (foxCard.kind === 'FOX_PEEK') {
    return {
      nextState: {
        ...state,
        discardPile: nextDiscardPile,
        drawnCard: null,
        drawnSource: null,
        turnStep: 'PEEKING_OWN_CARD',
        lastActionMessage: `${activePlayer.nickname} played Fox Peek! Select one of your cards to inspect.`,
      },
    };
  }

  // FOX_SWAP
  return {
    nextState: {
      ...state,
      discardPile: nextDiscardPile,
      drawnCard: null,
      drawnSource: null,
      turnStep: 'SELECTING_SWAP_CARDS',
      lastActionMessage: `${activePlayer.nickname} played Fox Swap! Select 1 of your cards and 1 opponent card.`,
    },
  };
}

/**
 * Active player selects one of their 4 cards (`handSlotIndex`) to privately view
 * after playing a Fox Peek card.
 */
export function handlePeek(
  state: GameState,
  playerId: string,
  handSlotIndex: number
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (state.turnStep !== 'PEEKING_OWN_CARD') {
    return { nextState: state, error: 'Not currently in Fox Peek selection.' };
  }
  if (handSlotIndex < 0 || handSlotIndex > 3) {
    return { nextState: state, error: 'Invalid hand card slot.' };
  }

  return {
    nextState: {
      ...state,
      turnStep: 'PERFORMING_PEEK_VIEW',
      activePeekSlot: { playerId, slotIndex: handSlotIndex },
      lastActionMessage: `${activePlayer.nickname} is peeking at card #${handSlotIndex + 1}...`,
    },
  };
}

/**
 * Active player finishes inspecting their peeked card and ends their turn.
 */
export function handleCompletePeek(
  state: GameState,
  playerId: string
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (state.turnStep !== 'PERFORMING_PEEK_VIEW') {
    return { nextState: state, error: 'No active peek to complete.' };
  }

  const slotNum = (state.activePeekSlot?.slotIndex ?? 0) + 1;
  return {
    nextState: advanceTurnOrEndRound(
      state,
      `${activePlayer.nickname} peeked at their card #${slotNum}.`
    ),
  };
}

/**
 * Active player completes a Fox Swap by exchanging one of their own cards (`mySlotIndex`)
 * with one of an opponent's cards (`targetPlayerId`, `targetSlotIndex`) without revealing either.
 */
export function handleFoxSwapCards(
  state: GameState,
  playerId: string,
  mySlotIndex: number,
  targetPlayerId: string,
  targetSlotIndex: number
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return { nextState: state, error: 'It is not your turn.' };
  }
  if (state.turnStep !== 'SELECTING_SWAP_CARDS') {
    return { nextState: state, error: 'Not currently in Fox Swap step.' };
  }
  if (playerId === targetPlayerId) {
    return {
      nextState: state,
      error: 'You must choose an opponent card to swap with.',
    };
  }
  if (
    mySlotIndex < 0 ||
    mySlotIndex > 3 ||
    targetSlotIndex < 0 ||
    targetSlotIndex > 3
  ) {
    return { nextState: state, error: 'Invalid card slot index.' };
  }

  const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
  if (!targetPlayer) {
    return { nextState: state, error: 'Target opponent not found.' };
  }

  const myCard = activePlayer.hand[mySlotIndex];
  const opponentCard = targetPlayer.hand[targetSlotIndex];

  const updatedPlayers = state.players.map((p) => {
    if (p.id === playerId) {
      const nextHand = p.hand.map((c, idx) =>
        idx === mySlotIndex ? opponentCard : c
      );
      return { ...p, hand: nextHand };
    }
    if (p.id === targetPlayerId) {
      const nextHand = p.hand.map((c, idx) =>
        idx === targetSlotIndex ? myCard : c
      );
      return { ...p, hand: nextHand };
    }
    return p;
  });

  const intermediateState: GameState = {
    ...state,
    players: updatedPlayers,
  };

  return {
    nextState: advanceTurnOrEndRound(
      intermediateState,
      `${activePlayer.nickname} used Fox Swap with ${targetPlayer.nickname}!`
    ),
  };
}

/**
 * Active player calls "Kookriko!" to signal the end of the round.
 * Every other connected player receives 1 final turn.
 * - If called during `AWAITING_DRAW`, the caller's turn finishes immediately and final turns begin.
 * - If called while completing their turn action (`DECIDING_DRAWN_CARD`, etc.), Kookriko is armed
 *   and final turns begin as soon as the caller completes their current turn action.
 */
export function handleKookriko(
  state: GameState,
  playerId: string
): HandlerResult {
  if (state.phase !== 'PLAYING') {
    return { nextState: state, error: 'Round is not currently active.' };
  }
  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== playerId) {
    return {
      nextState: state,
      error: 'You can only call Kookriko on your turn.',
    };
  }
  if (state.kookrikoCallerId !== null) {
    return {
      nextState: state,
      error: 'Kookriko has already been called this round!',
    };
  }

  // Collect all other connected players in turn order
  const otherPlayerIds: string[] = [];
  const count = state.players.length;
  for (let offset = 1; offset < count; offset++) {
    const idx = (state.activePlayerIndex + offset) % count;
    const p = state.players[idx];
    if (p.isConnected && p.id !== playerId) {
      otherPlayerIds.push(p.id);
    }
  }

  const stateWithKookriko: GameState = {
    ...state,
    kookrikoCallerId: playerId,
    finalTurnPlayerIds: otherPlayerIds,
  };

  if (state.turnStep === 'AWAITING_DRAW') {
    return {
      nextState: advanceTurnOrEndRound(
        stateWithKookriko,
        `🐓 ${activePlayer.nickname} called KOOKRIKO! Final turn for everyone else!`
      ),
    };
  }

  return {
    nextState: {
      ...stateWithKookriko,
      lastActionMessage: `🐓 ${activePlayer.nickname} called KOOKRIKO! Finish your move to start final turns.`,
    },
  };
}

/**
 * Master dispatcher that routes incoming `GameIntent` payloads on the Host
 * to the appropriate pure game engine handler.
 */
export function processHostGameIntent(
  state: GameState,
  intent: GameIntent
): HandlerResult {
  switch (intent.type) {
    case 'JOIN_ROOM':
      return handleJoinRoom(state, intent.playerId, intent.nickname);

    case 'START_GAME':
      return handleStartGame(state, intent.playerId);

    case 'FINISH_INITIAL_PEEK':
      return handleFinishInitialPeek(state, intent.playerId);

    case 'DRAW_FROM_DECK':
      return handleDrawFromDeck(state, intent.playerId);

    case 'DRAW_FROM_DISCARD':
      return handleDrawFromDiscard(state, intent.playerId);

    case 'DISCARD_DRAWN_CARD':
      return handleDiscardDrawnCard(state, intent.playerId);

    case 'SWAP_WITH_HAND':
      return handleSwap(state, intent.playerId, intent.handSlotIndex);

    case 'ACTIVATE_FOX_POWER':
      return handleActivateFoxPower(state, intent.playerId);

    case 'PEEK_OWN_CARD':
      return handlePeek(state, intent.playerId, intent.handSlotIndex);

    case 'COMPLETE_PEEK':
      return handleCompletePeek(state, intent.playerId);

    case 'FOX_SWAP_CARDS':
      return handleFoxSwapCards(
        state,
        intent.playerId,
        intent.mySlotIndex,
        intent.targetPlayerId,
        intent.targetSlotIndex
      );

    case 'CALL_KOOKRIKO':
      return handleKookriko(state, intent.playerId);

    default:
      return { nextState: state, error: 'Unknown game intent.' };
  }
}
