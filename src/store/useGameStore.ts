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
import { soundFX } from '../utils/sound';

export type NetworkRole = 'NONE' | 'HOST' | 'CLIENT';
export type ConnectionStatus = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type HostIntentProcessor = (
  state: GameState,
  intent: GameIntent
) => { nextState: GameState; error?: string };

const BOT_NAMES = ['🦊 Sly Fox', '🐓 Lady Cluck', '🐣 Barnaby'];

function isBotId(id: string): boolean {
  return id.startsWith('bot-');
}

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
let botTimer: ReturnType<typeof setTimeout> | null = null;

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
  startSoloGame: (nickname?: string) => void;
  addBotPlayer: () => void;
  dispatchIntent: (intent: GameIntent) => void;
  leaveRoom: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const scheduleBotActionsIfNeeded = () => {
    if (botTimer) {
      clearTimeout(botTimer);
      botTimer = null;
    }

    const { role, masterState } = get();
    if (role !== 'HOST' || !masterState) return;

    // 1. Bots automatically complete initial peek
    if (masterState.phase === 'INITIAL_PEEK') {
      const unreadyBot = masterState.players.find(
        (p) => isBotId(p.id) && !p.hasCompletedInitialPeek
      );
      if (unreadyBot) {
        botTimer = setTimeout(() => {
          processIntentOnHost({
            type: 'FINISH_INITIAL_PEEK',
            playerId: unreadyBot.id,
          });
        }, 450);
      }
      return;
    }

    // 2. Active Bot turn execution during PLAYING phase
    if (masterState.phase === 'PLAYING') {
      const activePlayer = masterState.players[masterState.activePlayerIndex];
      if (!activePlayer || !isBotId(activePlayer.id)) return;

      botTimer = setTimeout(() => {
        const currentMaster = get().masterState;
        if (!currentMaster || currentMaster.phase !== 'PLAYING') return;
        const bot = currentMaster.players[currentMaster.activePlayerIndex];
        if (!bot || !isBotId(bot.id)) return;

        // Calculate bot's current numeric hand sum
        const handValues = bot.hand.map((c) =>
          c.value !== null ? c.value : 5
        );
        const totalHandScore = handValues.reduce((a, b) => a + b, 0);
        const highestSlotIndex = handValues.indexOf(Math.max(...handValues));

        if (currentMaster.turnStep === 'AWAITING_DRAW') {
          // If bot has a very strong hand (<= 8 points) and nobody called Kookriko yet, call Kookriko!
          if (
            currentMaster.kookrikoCallerId === null &&
            totalHandScore <= 8 &&
            Math.random() < 0.65
          ) {
            processIntentOnHost({ type: 'CALL_KOOKRIKO', playerId: bot.id });
            return;
          }

          const topDiscard =
            currentMaster.discardPile[currentMaster.discardPile.length - 1] ??
            null;
          if (
            topDiscard &&
            topDiscard.value !== null &&
            topDiscard.value <= 3 &&
            handValues[highestSlotIndex] > topDiscard.value + 1
          ) {
            processIntentOnHost({
              type: 'DRAW_FROM_DISCARD',
              playerId: bot.id,
            });
          } else {
            processIntentOnHost({ type: 'DRAW_FROM_DECK', playerId: bot.id });
          }
          return;
        }

        if (currentMaster.turnStep === 'DECIDING_DRAWN_CARD') {
          const drawn = currentMaster.drawnCard;
          if (!drawn) return;

          if (drawn.kind === 'FOX_PEEK' || drawn.kind === 'FOX_SWAP') {
            processIntentOnHost({
              type: 'ACTIVATE_FOX_POWER',
              playerId: bot.id,
            });
            return;
          }

          const drawnVal = drawn.value ?? 5;
          if (
            currentMaster.drawnSource === 'DISCARD' ||
            drawnVal < handValues[highestSlotIndex]
          ) {
            processIntentOnHost({
              type: 'SWAP_WITH_HAND',
              playerId: bot.id,
              handSlotIndex: highestSlotIndex,
            });
          } else {
            processIntentOnHost({
              type: 'DISCARD_DRAWN_CARD',
              playerId: bot.id,
            });
          }
          return;
        }

        if (currentMaster.turnStep === 'PEEKING_OWN_CARD') {
          processIntentOnHost({
            type: 'PEEK_OWN_CARD',
            playerId: bot.id,
            handSlotIndex: Math.floor(Math.random() * 4),
          });
          return;
        }

        if (currentMaster.turnStep === 'PERFORMING_PEEK_VIEW') {
          processIntentOnHost({
            type: 'COMPLETE_PEEK',
            playerId: bot.id,
          });
          return;
        }

        if (currentMaster.turnStep === 'SELECTING_SWAP_CARDS') {
          const opponents = currentMaster.players.filter(
            (p) => p.id !== bot.id
          );
          const targetOpp =
            opponents[Math.floor(Math.random() * opponents.length)];
          if (targetOpp) {
            processIntentOnHost({
              type: 'FOX_SWAP_CARDS',
              playerId: bot.id,
              mySlotIndex: highestSlotIndex,
              targetPlayerId: targetOpp.id,
              targetSlotIndex: Math.floor(Math.random() * 4),
            });
          }
        }
      }, 950);
    }
  };

  const playSoundForIntent = (intent: GameIntent, nextState: GameState) => {
    switch (intent.type) {
      case 'DRAW_FROM_DECK':
      case 'DRAW_FROM_DISCARD':
      case 'DISCARD_DRAWN_CARD':
      case 'PEEK_OWN_CARD':
        soundFX.playCardTap();
        break;
      case 'SWAP_WITH_HAND':
      case 'FOX_SWAP_CARDS':
        soundFX.playCardSwap();
        break;
      case 'ACTIVATE_FOX_POWER':
        soundFX.playFoxPower();
        break;
      case 'CALL_KOOKRIKO':
        soundFX.playKookrikoCall();
        break;
      default:
        break;
    }
    if (nextState.phase === 'ROUND_OVER') {
      soundFX.playRoundWin();
    }
  };

  const processIntentOnHost = (intent: GameIntent, sourceConn?: unknown) => {
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

    playSoundForIntent(intent, nextState);

    const hostClientView = sanitizeStateForPlayer(nextState, myPlayerId);
    set({
      masterState: nextState,
      clientState: hostClientView,
      errorMessage: null,
    });

    peerManager.broadcastSanitizedState(nextState);
    scheduleBotActionsIfNeeded();
  };

  // Wire PeerManager callbacks into the Zustand store
  peerManager.setCallbacks({
    onIntentReceived: (intent, conn) => {
      processIntentOnHost(intent, conn);
    },
    onStateSyncReceived: (syncedState) => {
      const prevPhase = get().clientState?.phase;
      const prevKookriko = get().clientState?.kookrikoCallerId;
      if (syncedState.kookrikoCallerId && !prevKookriko) {
        soundFX.playKookrikoCall();
      } else if (syncedState.phase === 'ROUND_OVER' && prevPhase !== 'ROUND_OVER') {
        soundFX.playRoundWin();
      } else {
        soundFX.playCardTap();
      }
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

    startSoloGame: (nicknameInput?: string) => {
      const state = get();
      const chosenName =
        (nicknameInput ?? state.nickname).trim() || 'You';
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

      const bot1: Player = {
        id: 'bot-1',
        nickname: BOT_NAMES[0],
        isHost: false,
        isConnected: true,
        hand: [],
        hasCompletedInitialPeek: false,
        roundScore: null,
        totalScore: 0,
      };

      const bot2: Player = {
        id: 'bot-2',
        nickname: BOT_NAMES[1],
        isHost: false,
        isConnected: true,
        hand: [],
        hasCompletedInitialPeek: false,
        roundScore: null,
        totalScore: 0,
      };

      const baseState: GameState = {
        ...createInitialMasterState('SOLO', hostPlayer),
        players: [hostPlayer, bot1, bot2],
      };

      const processor = externalIntentProcessor ?? processHostGameIntent;
      const { nextState } = processor(baseState, {
        type: 'START_GAME',
        playerId: state.myPlayerId,
      });

      set({
        nickname: chosenName,
        role: 'HOST',
        connectionStatus: 'CONNECTED',
        masterState: nextState,
        clientState: sanitizeStateForPlayer(nextState, state.myPlayerId),
        errorMessage: null,
      });

      soundFX.playCardSwap();
      scheduleBotActionsIfNeeded();
    },

    addBotPlayer: () => {
      const { role, masterState } = get();
      if (role !== 'HOST' || !masterState || masterState.phase !== 'LOBBY') {
        return;
      }
      if (masterState.players.length >= 4) return;

      const existingBots = masterState.players.filter((p) =>
        isBotId(p.id)
      ).length;
      const botId = `bot-${existingBots + 1}-${Date.now().toString(36).slice(-3)}`;
      const botName = BOT_NAMES[existingBots % BOT_NAMES.length];

      processIntentOnHost({
        type: 'JOIN_ROOM',
        playerId: botId,
        nickname: botName,
      });
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
      if (botTimer) {
        clearTimeout(botTimer);
        botTimer = null;
      }
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
