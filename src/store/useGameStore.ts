import { create } from 'zustand';
import type {
  ClientGameState,
  GameIntent,
  GameState,
  Player,
} from '../types/game';
import { sanitizeStateForPlayer } from '../engine/sanitizer';
import { processHostGameIntent } from '../engine/handlers';
import { generateRoomCode, peerManager } from '../network/peerManager';

export type NetworkRole = 'NONE' | 'HOST' | 'CLIENT';
export type ConnectionStatus = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type HostIntentProcessor = (
  state: GameState,
  intent: GameIntent
) => { nextState: GameState; error?: string };

function createPlayerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `player-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
}

function createInitialMasterState(
  roomCode: string,
  hostPlayer: Player
): GameState {
  return {
    roomCode,
    phase: 'LOBBY',
    players: [hostPlayer],
    deck: [],
    discardPile: [],
    activePlayerIndex: 0,
    turnStep: 'AWAITING_DRAW',
    drawnCard: null,
    drawnSource: null,
    activePeekSlot: null,
    kookrikoCallerId: null,
    finalTurnPlayerIds: [],
    lastActionMessage: `${hostPlayer.nickname} created room ${roomCode}. Waiting for players (2–4)...`,
    lastMoveEvent: null,
    winnerIds: [],
  };
}

let externalIntentProcessor: HostIntentProcessor | null = null;

export function registerHostIntentProcessor(processor: HostIntentProcessor) {
  externalIntentProcessor = processor;
}

export interface GameStore {
  myPlayerId: string;
  nickname: string;
  role: NetworkRole;
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;

  /**
   * Authoritative Master GameState.
   * ONLY non-null when `role === 'HOST'`.
   */
  masterState: GameState | null;

  /**
   * Sanitized GameState view for the local player.
   * Both Host and Client UIs render strictly from `clientState`.
   */
  clientState: ClientGameState | null;

  setNickname: (nickname: string) => void;
  clearError: () => void;
  createRoom: (nickname?: string) => Promise<void>;
  joinRoom: (roomCode: string, nickname?: string) => Promise<void>;
  dispatchIntent: (intent: GameIntent) => void;
  leaveRoom: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const processIntentOnHost = (
    intent: GameIntent,
    sourceConn?: unknown
  ) => {
    const { role, masterState, myPlayerId } = get();
    if (role !== 'HOST' || !masterState) return;

    const processor = externalIntentProcessor ?? processHostGameIntent;
    const { nextState, error } = processor(masterState, intent);

    if (error) {
      if (intent.playerId && intent.playerId !== myPlayerId) {
        peerManager.sendErrorToConnection(sourceConn, error, intent.playerId);
      } else {
        set({ errorMessage: error });
      }
      return;
    }

    const hostClientView = sanitizeStateForPlayer(nextState, myPlayerId);
    set({
      masterState: nextState,
      clientState: hostClientView,
      errorMessage: null,
    });

    peerManager.broadcastSanitizedState(nextState);
  };

  // Wire PeerManager callbacks into the Zustand store
  peerManager.setCallbacks({
    onIntentReceived: (intent, conn) => {
      processIntentOnHost(intent, conn);
    },
    onStateSyncReceived: (syncedState) => {
      set({
        clientState: syncedState,
        connectionStatus: 'CONNECTED',
        errorMessage: null,
      });
    },
    onPeerDisconnected: (disconnectedPlayerId) => {
      const { role, masterState, myPlayerId } = get();
      if (role !== 'HOST' || !masterState) return;

      const disconnectedPlayer = masterState.players.find(
        (p) => p.id === disconnectedPlayerId
      );
      if (!disconnectedPlayer) return;

      const updatedPlayers =
        masterState.phase === 'LOBBY'
          ? masterState.players.filter((p) => p.id !== disconnectedPlayerId)
          : masterState.players.map((p) =>
              p.id === disconnectedPlayerId ? { ...p, isConnected: false } : p
            );

      const nextState: GameState = {
        ...masterState,
        players: updatedPlayers,
        lastActionMessage: `${disconnectedPlayer.nickname} disconnected.`,
      };

      set({
        masterState: nextState,
        clientState: sanitizeStateForPlayer(nextState, myPlayerId),
      });
      peerManager.broadcastSanitizedState(nextState);
    },
    onError: (message) => {
      set({
        errorMessage: message,
        connectionStatus: get().clientState ? get().connectionStatus : 'ERROR',
      });
    },
  });

  return {
    myPlayerId: createPlayerId(),
    nickname: '',
    role: 'NONE',
    connectionStatus: 'IDLE',
    errorMessage: null,
    masterState: null,
    clientState: null,

    setNickname: (nickname: string) => set({ nickname }),
    clearError: () => set({ errorMessage: null }),

    createRoom: async (nicknameInput?: string) => {
      const state = get();
      const chosenName =
        (nicknameInput ?? state.nickname).trim() || 'Host Hen';
      const roomCode = generateRoomCode();

      set({
        nickname: chosenName,
        connectionStatus: 'CONNECTING',
        errorMessage: null,
      });

      try {
        const registeredCode = await peerManager.createHostPeer(roomCode);
        const hostPlayer: Player = {
          id: state.myPlayerId,
          nickname: chosenName,
          isHost: true,
          isConnected: true,
          hand: [],
          hasCompletedInitialPeek: false,
          roundScore: null,
          totalScore: 0,
        };

        const initialMaster = createInitialMasterState(
          registeredCode,
          hostPlayer
        );
        const initialClientView = sanitizeStateForPlayer(
          initialMaster,
          state.myPlayerId
        );

        set({
          role: 'HOST',
          connectionStatus: 'CONNECTED',
          masterState: initialMaster,
          clientState: initialClientView,
          errorMessage: null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create room';
        set({
          role: 'NONE',
          connectionStatus: 'ERROR',
          errorMessage: message,
        });
      }
    },

    joinRoom: async (roomCodeInput: string, nicknameInput?: string) => {
      const state = get();
      const chosenName =
        (nicknameInput ?? state.nickname).trim() || 'Chicky Player';
      const cleanCode = roomCodeInput.trim().toUpperCase();

      if (!cleanCode) {
        set({
          connectionStatus: 'ERROR',
          errorMessage: 'Please enter a valid 4-letter room code.',
        });
        return;
      }

      set({
        nickname: chosenName,
        role: 'CLIENT',
        connectionStatus: 'CONNECTING',
        errorMessage: null,
      });

      try {
        await peerManager.connectToHost(
          cleanCode,
          state.myPlayerId,
          chosenName
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to join room';
        set({
          role: 'NONE',
          connectionStatus: 'ERROR',
          errorMessage: message,
        });
      }
    },

    dispatchIntent: (intent: GameIntent) => {
      const { role } = get();
      if (role === 'HOST') {
        processIntentOnHost(intent);
      } else if (role === 'CLIENT') {
        peerManager.sendIntentToHost(intent);
      }
    },

    leaveRoom: () => {
      peerManager.destroy();
      set({
        role: 'NONE',
        connectionStatus: 'IDLE',
        errorMessage: null,
        masterState: null,
        clientState: null,
      });
    },
  };
});
