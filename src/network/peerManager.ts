import type {
  ClientGameState,
  GameIntent,
  GameState,
} from '../types/game';
import { sanitizeStateForPlayer } from '../engine/sanitizer';

const RTDB_BASE_URL = 'https://kookriko-2026-default-rtdb.firebaseio.com';
const POLL_INTERVAL_MS = 450;

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface PeerCallbacks {
  onIntentReceived: (intent: GameIntent, sourceConn?: unknown) => void;
  onStateSyncReceived: (state: ClientGameState) => void;
  onPeerDisconnected: (playerId: string) => void;
  onError: (message: string) => void;
}

interface StoredIntentRecord {
  intentJson: string;
  sentAt: number;
}

interface StoredPlayerView {
  seq: number;
  updatedAt: number;
  payloadJson: string;
  errorSeq?: number;
  errorMessage?: string | null;
}

/**
 * Pure HTTPS (port 443) REST Polling Manager backed by Firebase Realtime Database.
 *
 * Strictly preserves the Host-Client Authoritative Architecture:
 * 1. The Host browser's Zustand store holds the authoritative `GameState` (full deck, hidden cards).
 * 2. Clients send lightweight JSON `GameIntent` payloads to `/rooms/<CODE>/intents.json`.
 * 3. The Host polls `/intents.json`, processes intents in memory, and writes only per-player
 *    sanitized `ClientGameState` snapshots to `/rooms/<CODE>/views/<playerId>.json`.
 * 4. Clients poll `/rooms/<CODE>/views/<myPlayerId>.json` over standard HTTPS port 443,
 *    bypassing all mobile carrier CGNAT, Wi-Fi extender isolation, and firewall blocks.
 */
class PeerManager {
  private callbacks: PeerCallbacks | null = null;
  private currentRoomCode = '';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPollingInFlight = false;
  private processedIntentKeys: Set<string> = new Set();
  private syncSeq = 0;
  private errorSeq = 0;
  private lastSeenSeq = 0;
  private lastSeenErrorSeq = 0;
  private latestMasterState: GameState | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  public setCallbacks(callbacks: PeerCallbacks): void {
    this.callbacks = callbacks;
  }

  private getRoomUrl(roomCode: string, subPath = ''): string {
    const suffix = subPath ? `/${subPath}` : '';
    return `${RTDB_BASE_URL}/rooms/${roomCode}${suffix}.json`;
  }

  /**
   * Host side: creates a room node in Firebase RTDB and starts polling for Client intents.
   */
  public async createHostPeer(roomCode: string): Promise<string> {
    this.destroy();
    const normalizedCode = roomCode.trim().toUpperCase();
    this.currentRoomCode = normalizedCode;

    const initRes = await fetch(this.getRoomUrl(normalizedCode), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meta: {
          roomCode: normalizedCode,
          createdAt: Date.now(),
        },
      }),
    });

    if (!initRes.ok) {
      throw new Error(
        `Failed to initialize room ${normalizedCode} (HTTP ${initRes.status}).`
      );
    }

    // Start Host polling loop for incoming Client intents
    this.pollTimer = setInterval(() => {
      void this.pollHostIntents();
    }, POLL_INTERVAL_MS);

    return normalizedCode;
  }

  private async pollHostIntents(): Promise<void> {
    if (this.isPollingInFlight || !this.currentRoomCode) return;
    this.isPollingInFlight = true;
    const activeRoom = this.currentRoomCode;

    try {
      const res = await fetch(this.getRoomUrl(activeRoom, 'intents'), {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) return;

      const records = (await res.json()) as Record<
        string,
        StoredIntentRecord
      > | null;
      if (!records || typeof records !== 'object') return;

      const sortedKeys = Object.keys(records).sort();
      for (const key of sortedKeys) {
        if (this.processedIntentKeys.has(key)) continue;
        this.processedIntentKeys.add(key);

        // Delete processed intent from queue asynchronously
        void fetch(this.getRoomUrl(activeRoom, `intents/${key}`), {
          method: 'DELETE',
        }).catch(() => {});

        const item = records[key];
        if (!item || !item.intentJson) continue;

        try {
          const intent = JSON.parse(item.intentJson) as GameIntent;
          this.callbacks?.onIntentReceived(intent);
        } catch {
          // Ignore malformed intent
        }
      }
    } catch {
      // Ignore transient network hiccups during polling
    } finally {
      this.isPollingInFlight = false;
    }
  }

  /**
   * Client side: verifies room exists, posts JOIN_ROOM intent, and polls for its
   * personalized sanitized `ClientGameState` view.
   */
  public async connectToHost(
    roomCode: string,
    myPlayerId: string,
    nickname: string
  ): Promise<void> {
    this.destroy();
    const normalizedCode = roomCode.trim().toUpperCase();
    this.currentRoomCode = normalizedCode;

    // 1. Verify the room exists on Firebase RTDB
    const metaRes = await fetch(this.getRoomUrl(normalizedCode, 'meta'), {
      method: 'GET',
      cache: 'no-store',
    });

    if (!metaRes.ok) {
      throw new Error(
        `Unable to reach room server (HTTP ${metaRes.status}).`
      );
    }

    const metaData = (await metaRes.json()) as { createdAt?: number } | null;
    if (!metaData || !metaData.createdAt) {
      throw new Error(
        `Room "${normalizedCode}" was not found. Check the 4-letter code.`
      );
    }

    // 2. Post JOIN_ROOM intent to `/rooms/<CODE>/intents.json`
    await this.postIntentToRoom(normalizedCode, {
      type: 'JOIN_ROOM',
      playerId: myPlayerId,
      nickname,
    });

    // 3. Poll `/rooms/<CODE>/views/<myPlayerId>.json` until the first STATE_SYNC arrives
    return new Promise((resolve, reject) => {
      let settled = false;

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.destroy();
          reject(
            new Error(
              `Room "${normalizedCode}" Host did not respond. Make sure the Host tab is open.`
            )
          );
        }
      }, 12000);

      const pollMyView = async () => {
        if (this.isPollingInFlight || !this.currentRoomCode) return;
        this.isPollingInFlight = true;

        try {
          const res = await fetch(
            this.getRoomUrl(normalizedCode, `views/${myPlayerId}`),
            {
              method: 'GET',
              cache: 'no-store',
            }
          );
          if (!res.ok) return;

          const view = (await res.json()) as StoredPlayerView | null;
          if (!view) return;

          if (
            view.errorSeq &&
            view.errorSeq > this.lastSeenErrorSeq &&
            view.errorMessage
          ) {
            this.lastSeenErrorSeq = view.errorSeq;
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              this.destroy();
              reject(new Error(view.errorMessage));
              return;
            } else {
              this.callbacks?.onError(view.errorMessage);
            }
          }

          if (view.seq && view.seq > this.lastSeenSeq && view.payloadJson) {
            this.lastSeenSeq = view.seq;
            const parsedState = JSON.parse(
              view.payloadJson
            ) as ClientGameState;
            this.callbacks?.onStateSyncReceived(parsedState);

            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              resolve();
            }
          }
        } catch {
          // Ignore transient fetch hiccup
        } finally {
          this.isPollingInFlight = false;
        }
      };

      void pollMyView();
      this.pollTimer = setInterval(() => {
        void pollMyView();
      }, POLL_INTERVAL_MS);
    });
  }

  private async postIntentToRoom(
    roomCode: string,
    intent: GameIntent
  ): Promise<void> {
    const record: StoredIntentRecord = {
      intentJson: JSON.stringify(intent),
      sentAt: Date.now(),
    };
    const res = await fetch(this.getRoomUrl(roomCode, 'intents'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      throw new Error(`Failed to send intent (HTTP ${res.status}).`);
    }
  }

  /**
   * Client side: sends a lightweight JSON intent over HTTPS POST to the Host's intent queue.
   */
  public sendIntentToHost(intent: GameIntent): void {
    if (!this.currentRoomCode) {
      this.callbacks?.onError('Not connected to a room.');
      return;
    }
    void this.postIntentToRoom(this.currentRoomCode, intent).catch(() => {
      this.callbacks?.onError('Network error sending action. Please try again.');
    });
  }

  /**
   * Host side: writes an error message to a specific client's view node.
   */
  public sendErrorToConnection(
    _conn: unknown,
    message: string,
    targetPlayerId?: string
  ): void {
    if (!targetPlayerId || !this.currentRoomCode) return;
    const roomCode = this.currentRoomCode;
    const nextErrSeq = ++this.errorSeq;

    this.writeChain = this.writeChain.then(async () => {
      try {
        await fetch(this.getRoomUrl(roomCode, `views/${targetPlayerId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            errorSeq: nextErrSeq,
            errorMessage: message,
          }),
        });
      } catch {
        // Ignore error write failure
      }
    });
  }

  /**
   * Host side: sanitizes the master state individually for each connected client
   * and writes their personalized `ClientGameState` to `/rooms/<CODE>/views`.
   */
  public broadcastSanitizedState(masterState: GameState): void {
    if (!this.currentRoomCode) return;
    this.latestMasterState = masterState;
    const roomCode = this.currentRoomCode;
    const nextSeq = ++this.syncSeq;

    this.writeChain = this.writeChain.then(async () => {
      const stateToWrite = this.latestMasterState ?? masterState;
      const viewsPatch: Record<string, StoredPlayerView> = {};
      const now = Date.now();

      for (const player of stateToWrite.players) {
        if (player.isHost) continue;
        const sanitized = sanitizeStateForPlayer(stateToWrite, player.id);
        viewsPatch[player.id] = {
          seq: nextSeq,
          updatedAt: now,
          payloadJson: JSON.stringify(sanitized),
        };
      }

      if (Object.keys(viewsPatch).length === 0) return;

      try {
        await fetch(this.getRoomUrl(roomCode, 'views'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(viewsPatch),
        });
      } catch {
        // Ignore transient write error
      }
    });
  }

  public destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPollingInFlight = false;
    this.currentRoomCode = '';
    this.processedIntentKeys.clear();
    this.lastSeenSeq = 0;
    this.lastSeenErrorSeq = 0;
    this.latestMasterState = null;
  }
}

export const peerManager = new PeerManager();
