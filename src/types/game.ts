export type CardKind = 'NUMBER' | 'CHICKEN' | 'FOX_PEEK' | 'FOX_SWAP';

export interface Card {
  id: string;
  kind: CardKind;
  /**
   * 0-8 for NUMBER cards, 9 for CHICKEN cards, null for FOX power cards.
   */
  value: number | null;
}

/**
 * What a client is allowed to see for a given card slot in a player's hand.
 * `card` is non-null ONLY if that card is currently revealed to the receiving player
 * (e.g., during initial outer-card peek, an active Fox Peek, or at ROUND_OVER).
 */
export interface ClientCardSlot {
  slotIndex: number;
  card: Card | null;
  isRevealedToMe: boolean;
}

/**
 * Authoritative Player representation stored in the Host's master state.
 */
export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  isConnected: boolean;
  /** Always 4 cards once dealt */
  hand: Card[];
  /** Whether the player has finished peeking at their outer 2 cards in INITIAL_PEEK phase */
  hasCompletedInitialPeek: boolean;
  /** Score for the current/last completed round */
  roundScore: number | null;
  /** Cumulative score across rounds in this session */
  totalScore: number;
}

/**
 * Sanitized Player representation sent to clients.
 */
export interface ClientPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  isConnected: boolean;
  hand: ClientCardSlot[];
  hasCompletedInitialPeek: boolean;
  roundScore: number | null;
  totalScore: number;
}

export type GamePhase = 'LOBBY' | 'INITIAL_PEEK' | 'PLAYING' | 'ROUND_OVER';

export type TurnStep =
  | 'AWAITING_DRAW'
  | 'DECIDING_DRAWN_CARD'
  | 'PEEKING_OWN_CARD'
  | 'PERFORMING_PEEK_VIEW'
  | 'SELECTING_SWAP_CARDS';

export type DrawSource = 'DECK' | 'DISCARD';

/**
 * Authoritative Master GameState held exclusively in the Host's memory.
 * Clients never receive this raw structure.
 */
export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  activePlayerIndex: number;
  turnStep: TurnStep;
  drawnCard: Card | null;
  drawnSource: DrawSource | null;
  /**
   * When a player uses Fox Peek and selects one of their 4 slots,
   * we temporarily record the slot index here so the sanitizer reveals it only to them
   * until they confirm they are done peeking.
   */
  activePeekSlot: { playerId: string; slotIndex: number } | null;
  /**
   * ID of the player who called "Kookriko!" to trigger the final round of turns.
   */
  kookrikoCallerId: string | null;
  /**
   * Remaining player IDs who still get one final turn after Kookriko is called.
   */
  finalTurnPlayerIds: string[];
  /**
   * Human-readable status or action log message for the table banner.
   */
  lastActionMessage: string;
  winnerIds: string[];
}

/**
 * Sanitized GameState broadcast by the Host to a specific Client (and also used by Host UI).
 */
export interface ClientGameState {
  roomCode: string;
  myPlayerId: string;
  phase: GamePhase;
  players: ClientPlayer[];
  deckCount: number;
  discardCount: number;
  topDiscard: Card | null;
  activePlayerId: string | null;
  turnStep: TurnStep;
  /**
   * Only populated with the actual Card for the active turn player;
   * other players see ` null ` here and check `activePlayerHasDrawnCard`.
   */
  myDrawnCard: Card | null;
  activePlayerHasDrawnCard: boolean;
  drawnSource: DrawSource | null;
  kookrikoCallerId: string | null;
  lastActionMessage: string;
  winnerIds: string[];
}

/**
 * Lightweight JSON Intents sent from Clients (or Host UI) to the Host's authoritative engine.
 */
export type GameIntent =
  | {
      type: 'JOIN_ROOM';
      playerId: string;
      nickname: string;
    }
  | {
      type: 'START_GAME';
      playerId: string;
    }
  | {
      type: 'FINISH_INITIAL_PEEK';
      playerId: string;
    }
  | {
      type: 'DRAW_FROM_DECK';
      playerId: string;
    }
  | {
      type: 'DRAW_FROM_DISCARD';
      playerId: string;
    }
  | {
      type: 'DISCARD_DRAWN_CARD';
      playerId: string;
    }
  | {
      type: 'SWAP_WITH_HAND';
      playerId: string;
      handSlotIndex: number;
    }
  | {
      type: 'ACTIVATE_FOX_POWER';
      playerId: string;
    }
  | {
      type: 'PEEK_OWN_CARD';
      playerId: string;
      handSlotIndex: number;
    }
  | {
      type: 'COMPLETE_PEEK';
      playerId: string;
    }
  | {
      type: 'FOX_SWAP_CARDS';
      playerId: string;
      mySlotIndex: number;
      targetPlayerId: string;
      targetSlotIndex: number;
    }
  | {
      type: 'CALL_KOOKRIKO';
      playerId: string;
    };

/**
 * Messages transmitted over PeerJS DataConnections.
 */
export type PeerWireMessage =
  | {
      kind: 'INTENT';
      intent: GameIntent;
    }
  | {
      kind: 'STATE_SYNC';
      state: ClientGameState;
    }
  | {
      kind: 'ERROR';
      message: string;
    };
