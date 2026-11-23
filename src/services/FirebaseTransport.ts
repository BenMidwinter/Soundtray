import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth, signInAnonymously } from 'firebase/auth';
import {
  Database,
  get,
  getDatabase,
  limitToLast,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  query,
  ref,
  remove,
  set,
  Unsubscribe,
  update,
} from 'firebase/database';
import { ASSET_MAP, INITIAL_ROOM_ITEMS } from '../assets/assetManifest';
import {
  AudioSignal,
  Connect4State,
  PetState,
  PlayerState,
  RoomItem,
  RoomPreset,
  RoomSettings,
  RoomSnapshot,
  RoomTransport,
  SessionEvent,
  SessionEventType,
  SoundMemoryCard,
  SoundMemoryState,
  TicTacToeState,
} from '../types';
import {
  checkConnect4Winner,
  checkTicTacToeWinner,
  claimSeatHelper,
  createDefaultSettings,
  createEmptyConnect4,
  createEmptyTicTacToe,
  createInitialPet,
  createShuffledSoundMemory,
  MAX_EVENTS,
  resolveTurnSeat,
  sanitizeConnect4,
  sanitizePet,
  sanitizeSettings,
  sanitizeSoundMemory,
  sanitizeTicTacToe,
} from './gameHelpers';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
}

/** Strip undefined values recursively before writing to Firebase Realtime Database. */
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Firebase Realtime Database Transport implementing Soundtray's Mandaloop signal model
 * and Room Hygiene (Janitor Protocol).
 */
export class FirebaseTransport implements RoomTransport {
  public readonly mode = 'firebase' as const;

  private app: FirebaseApp;
  private db: Database;
  private auth: Auth;

  private roomId = '';
  private localPlayerId = '';
  private authUid: string | undefined;
  private unsubscribers: Unsubscribe[] = [];
  private connectedAt = 0;

  private snapshot: RoomSnapshot = {
    roomId: '',
    players: {},
    items: INITIAL_ROOM_ITEMS.map((i) => ({ ...i })),
    settings: createDefaultSettings(),
    connect4: createEmptyConnect4(),
    tictactoe: createEmptyTicTacToe(),
    soundMemory: createShuffledSoundMemory(),
    pet: createInitialPet(),
    events: [],
  };

  private snapshotListeners = new Set<(snapshot: RoomSnapshot) => void>();
  private audioListeners = new Set<(signal: AudioSignal) => void>();
  private lastPositionSyncAt = 0;
  private lastItemMoveSyncAt = 0;
  private lastSeenGreetedAt = 0;
  private audioPushCount = 0;

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.db = getDatabase(this.app);
    this.auth = getAuth(this.app);
  }

  private getLocalActorName(): string {
    return this.snapshot.players[this.localPlayerId]?.name || 'Guest';
  }

  private roomPath(subpath = ''): string {
    const cleanRoom = this.roomId.replace(/[.#$[\]/]/g, '_').toUpperCase();
    return subpath ? `rooms/${cleanRoom}/${subpath}` : `rooms/${cleanRoom}`;
  }

  public connect(roomId: string, localPlayer: PlayerState): void {
    this.disconnect();
    this.roomId = roomId.toUpperCase();
    this.localPlayerId = localPlayer.id;
    this.connectedAt = Date.now();
    this.lastSeenGreetedAt = Date.now();
    this.audioPushCount = 0;

    // Optimistic local state while Firebase connects
    this.snapshot = {
      roomId: this.roomId,
      players: { [localPlayer.id]: { ...localPlayer } },
      items: INITIAL_ROOM_ITEMS.map((i) => ({ ...i })),
      settings: createDefaultSettings(),
      connect4: createEmptyConnect4(),
      tictactoe: createEmptyTicTacToe(),
      soundMemory: createShuffledSoundMemory(),
      pet: createInitialPet(),
      events: [],
    };
    this.emitSnapshot();

    void this.connectAsync(localPlayer);
  }

  private async connectAsync(localPlayer: PlayerState): Promise<void> {
    try {
      // 1. Silent Anonymous Auth (required by database.rules.json)
      try {
        if (!this.auth.currentUser) {
          const cred = await signInAnonymously(this.auth);
          this.authUid = cred.user.uid;
        } else {
          this.authUid = this.auth.currentUser.uid;
        }
      } catch (authErr) {
        console.warn(
          '[FirebaseTransport] Anonymous Auth failed (enable Anonymous sign-in in Firebase Console → Authentication):',
          authErr
        );
      }

      const playerPayload: PlayerState = stripUndefined({
        ...localPlayer,
        uid: this.authUid,
      });

      const roomRef = ref(this.db, this.roomPath());
      const playersRef = ref(this.db, this.roomPath('players'));
      const myPlayerRef = ref(this.db, this.roomPath(`players/${localPlayer.id}`));

      // 2. Janitor safety net: if room has no active players (fresh or stale crash), wipe & initialize cleanly
      const existingPlayersSnap = await get(playersRef);
      const existingPlayers = existingPlayersSnap.val() as Record<string, PlayerState> | null;
      const hasActivePlayers = Boolean(existingPlayers && Object.keys(existingPlayers).length > 0);

      if (!hasActivePlayers) {
        const initialItemsMap: Record<string, RoomItem> = {};
        for (const it of INITIAL_ROOM_ITEMS) {
          initialItemsMap[it.id] = { ...it };
        }
        await set(
          roomRef,
          stripUndefined({
            meta: {
              createdAt: Date.now(),
              lastActivityAt: Date.now(),
            },
            settings: createDefaultSettings(),
            items: initialItemsMap,
            games: {
              connect4: createEmptyConnect4(),
              tictactoe: createEmptyTicTacToe(),
              soundMemory: createShuffledSoundMemory(),
            },
            pet: createInitialPet(),
            players: {
              [localPlayer.id]: playerPayload,
            },
          })
        );
      } else {
        await set(myPlayerRef, playerPayload);
      }

      // 3. Register automatic presence cleanup on tab close / network drop
      await onDisconnect(myPlayerRef).remove();

      // 4. Record join event
      this.recordEvent(
        'PLAYER_JOIN',
        `${localPlayer.name} entered room ${this.roomId}`,
        { roomId: this.roomId }
      );

      // 5. Subscribe to live room buckets
      this.subscribeToRoom();
    } catch (err) {
      console.error('[FirebaseTransport] Connection error:', err);
    }
  }

  private subscribeToRoom(): void {
    // Players
    this.unsubscribers.push(
      onValue(ref(this.db, this.roomPath('players')), (snap) => {
        const raw = (snap.val() as Record<string, PlayerState> | null) ?? {};
        // Preserve local note sparkle timestamp so remote updates don't erase it
        const merged: Record<string, PlayerState> = {};
        for (const [id, p] of Object.entries(raw)) {
          const prev = this.snapshot.players[id];
          merged[id] = {
            ...p,
            hairColor: p.hairColor || '#5a3222',
            hairStyle: p.hairStyle || 'short',
            facing: p.facing || 'down',
            activeInstrumentId: p.activeInstrumentId ?? null,
            lastActiveNoteAt: prev?.lastActiveNoteAt,
          };
        }
        this.snapshot = { ...this.snapshot, players: merged };
        this.emitSnapshot();
      })
    );

    // Global Settings
    this.unsubscribers.push(
      onValue(ref(this.db, this.roomPath('settings')), (snap) => {
        this.snapshot = {
          ...this.snapshot,
          settings: sanitizeSettings(snap.val() as Partial<RoomSettings> | null),
        };
        this.emitSnapshot();
      })
    );

    // Room Items (keyed map -> array)
    this.unsubscribers.push(
      onValue(ref(this.db, this.roomPath('items')), (snap) => {
        const raw = snap.val() as Record<string, RoomItem> | null;
        const items = raw ? Object.values(raw).filter(Boolean) : [];
        this.snapshot = { ...this.snapshot, items };
        this.emitSnapshot();
      })
    );

    // Games
    this.unsubscribers.push(
      onValue(ref(this.db, this.roomPath('games/connect4')), (snap) => {
        this.snapshot = {
          ...this.snapshot,
          connect4: sanitizeConnect4(snap.val() as Partial<Connect4State> | null),
        };
        this.emitSnapshot();
      })
    );

    this.unsubscribers.push(
      onValue(ref(this.db, this.roomPath('games/tictactoe')), (snap) => {
        this.snapshot = {
          ...this.snapshot,
          tictactoe: sanitizeTicTacToe(snap.val() as Partial<TicTacToeState> | null),
        };
        this.emitSnapshot();
      })
    );

    this.unsubscribers.push(
      onValue(ref(this.db, this.roomPath('games/soundMemory')), (snap) => {
        this.snapshot = {
          ...this.snapshot,
          soundMemory: sanitizeSoundMemory(snap.val() as Partial<SoundMemoryState> | null),
        };
        this.emitSnapshot();
      })
    );

    // Synced Pru (wandering + greetings)
    this.unsubscribers.push(
      onValue(ref(this.db, this.roomPath('pet')), (snap) => {
        const raw = snap.val() as (Partial<PetState> & { lastGreetedAt?: number }) | null;
        if (!raw) return;
        const nextPet = sanitizePet(raw);
        let pruHeartAt = this.snapshot.pruHeartAt;
        if (raw.lastGreetedAt && raw.lastGreetedAt > this.lastSeenGreetedAt) {
          this.lastSeenGreetedAt = raw.lastGreetedAt;
          pruHeartAt = performance.now();
        }
        this.snapshot = { ...this.snapshot, pet: nextPet, pruHeartAt };
        this.emitSnapshot();
      })
    );

    // Structured Session Events (last 150)
    this.unsubscribers.push(
      onValue(query(ref(this.db, this.roomPath('events')), limitToLast(MAX_EVENTS)), (snap) => {
        const raw = snap.val() as Record<string, SessionEvent> | null;
        const events = raw
          ? Object.values(raw).sort((a, b) => a.timestamp - b.timestamp)
          : [];
        this.snapshot = { ...this.snapshot, events };
        this.emitSnapshot();
      })
    );

    // Ephemeral Mandaloop Audio Signals (ignore historical signals older than join)
    const audioQuery = query(ref(this.db, this.roomPath('audioSignals')), limitToLast(30));
    this.unsubscribers.push(
      onChildAdded(audioQuery, (snap) => {
        const sig = snap.val() as AudioSignal | null;
        if (!sig) return;
        if (sig.timestamp < this.connectedAt - 1000) return;
        if (sig.sourceId === this.localPlayerId) return;
        this.audioListeners.forEach((cb) => cb(sig));
      })
    );
  }

  public disconnect(): void {
    const roomToClean = this.roomId;
    const playerToClean = this.localPlayerId;
    const actorName = this.getLocalActorName();

    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.roomId = '';
    this.localPlayerId = '';

    if (roomToClean && playerToClean) {
      const cleanRoom = roomToClean.replace(/[.#$[\]/]/g, '_').toUpperCase();
      const roomRef = ref(this.db, `rooms/${cleanRoom}`);
      const playersRef = ref(this.db, `rooms/${cleanRoom}/players`);
      const myPlayerRef = ref(this.db, `rooms/${cleanRoom}/players/${playerToClean}`);

      void (async () => {
        try {
          await remove(myPlayerRef);
          const remaining = await get(playersRef);
          const val = remaining.val() as Record<string, unknown> | null;
          if (!val || Object.keys(val).length === 0) {
            // Janitor Protocol: last participant left -> wipe entire room cleanly!
            await remove(roomRef);
          } else {
            const leaveEvt: SessionEvent = {
              id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: 'PLAYER_LEAVE',
              actorName,
              summary: `${actorName} left the room`,
              timestamp: Date.now(),
            };
            await set(ref(this.db, `rooms/${cleanRoom}/events/${leaveEvt.id}`), leaveEvt);
          }
        } catch (err) {
          console.warn('[FirebaseTransport] Cleanup on disconnect warning:', err);
        }
      })();
    }
  }

  public updateLocalPlayer(player: PlayerState): void {
    this.snapshot = {
      ...this.snapshot,
      players: {
        ...this.snapshot.players,
        [player.id]: { ...player },
      },
    };
    this.emitSnapshot();

    if (!this.roomId) return;
    const now = performance.now();
    if (now - this.lastPositionSyncAt >= 50) {
      this.lastPositionSyncAt = now;
      const { lastActiveNoteAt: _omitLocal, ...remoteSafe } = player;
      void update(
        ref(this.db, this.roomPath(`players/${player.id}`)),
        stripUndefined({ ...remoteSafe, uid: this.authUid })
      );
    }
  }

  public setLocalActiveInstrument(instrumentId: string | null): void {
    const me = this.snapshot.players[this.localPlayerId];
    if (!me) return;
    const updated = { ...me, activeInstrumentId: instrumentId };
    this.snapshot = {
      ...this.snapshot,
      players: { ...this.snapshot.players, [this.localPlayerId]: updated },
    };
    this.emitSnapshot();
    if (this.roomId) {
      void update(ref(this.db, this.roomPath(`players/${this.localPlayerId}`)), {
        activeInstrumentId: instrumentId,
      });
    }
  }

  public sendAudioSignal(signal: AudioSignal): void {
    if (!this.roomId) return;
    const signalsRef = ref(this.db, this.roomPath('audioSignals'));
    void push(signalsRef, stripUndefined(signal));

    // Gently keep the ephemeral audioSignals node lean during long sessions
    this.audioPushCount += 1;
    if (this.audioPushCount >= 80) {
      this.audioPushCount = 0;
      void remove(signalsRef);
    }
  }

  public placeItem(item: RoomItem): void {
    const actor = this.getLocalActorName();
    const label = ASSET_MAP[item.assetId]?.name ?? item.assetId;
    this.snapshot = { ...this.snapshot, items: [...this.snapshot.items, item] };
    this.emitSnapshot();

    if (this.roomId) {
      void set(ref(this.db, this.roomPath(`items/${item.id}`)), stripUndefined(item));
      this.recordEvent('ITEM_PLACE', `${actor} placed ${label}`, {
        assetId: item.assetId,
        flipped: Boolean(item.flipped),
      });
    }
  }

  public moveItem(itemId: string, x: number, y: number): void {
    this.snapshot = {
      ...this.snapshot,
      items: this.snapshot.items.map((it) => (it.id === itemId ? { ...it, x, y } : it)),
    };
    this.emitSnapshot();

    if (!this.roomId) return;
    const now = performance.now();
    if (now - this.lastItemMoveSyncAt >= 50) {
      this.lastItemMoveSyncAt = now;
      void update(ref(this.db, this.roomPath(`items/${itemId}`)), { x, y });
    }
  }

  public flipItem(itemId: string): void {
    const actor = this.getLocalActorName();
    const target = this.snapshot.items.find((i) => i.id === itemId);
    if (!target) return;
    const nextFlipped = !target.flipped;
    const label = ASSET_MAP[target.assetId]?.name ?? target.assetId;

    this.snapshot = {
      ...this.snapshot,
      items: this.snapshot.items.map((it) =>
        it.id === itemId ? { ...it, flipped: nextFlipped } : it
      ),
    };
    this.emitSnapshot();

    if (this.roomId) {
      void update(ref(this.db, this.roomPath(`items/${itemId}`)), { flipped: nextFlipped });
      this.recordEvent('ITEM_FLIP', `${actor} flipped ${label}`, { itemId });
    }
  }

  public removeItem(itemId: string): void {
    const actor = this.getLocalActorName();
    const target = this.snapshot.items.find((i) => i.id === itemId);
    const label = target ? ASSET_MAP[target.assetId]?.name ?? target.assetId : 'item';

    this.snapshot = {
      ...this.snapshot,
      items: this.snapshot.items.filter((it) => it.id !== itemId),
    };
    this.emitSnapshot();

    if (this.roomId) {
      void remove(ref(this.db, this.roomPath(`items/${itemId}`)));
      this.recordEvent('ITEM_REMOVE', `${actor} removed ${label}`, { assetId: target?.assetId });
    }
  }

  public tidyRoom(): void {
    const actor = this.getLocalActorName();
    this.snapshot = { ...this.snapshot, items: [] };
    this.emitSnapshot();
    if (this.roomId) {
      void remove(ref(this.db, this.roomPath('items')));
      this.recordEvent('ROOM_TIDY', `${actor} tidied up the room`);
    }
  }

  public applyPreset(preset: RoomPreset): void {
    const actor = this.getLocalActorName();
    const nextItems = preset.items.map((it, idx) => ({
      ...it,
      id: `preset-${Date.now()}-${idx}`,
    }));
    const nextSettings: RoomSettings = {
      ...this.snapshot.settings,
      ...(preset.settings ?? {}),
    };
    this.snapshot = { ...this.snapshot, items: nextItems, settings: nextSettings };
    this.emitSnapshot();

    if (this.roomId) {
      const itemsMap: Record<string, RoomItem> = {};
      for (const it of nextItems) itemsMap[it.id] = stripUndefined(it);
      void set(ref(this.db, this.roomPath('items')), itemsMap);
      void set(ref(this.db, this.roomPath('settings')), stripUndefined(nextSettings));
      this.recordEvent('PRESET_APPLIED', `${actor} loaded "${preset.name}"`, {
        presetId: preset.id,
        itemCount: nextItems.length,
      });
    }
  }

  public updateSettings(settings: RoomSettings): void {
    const prev = this.snapshot.settings;
    const actor = this.getLocalActorName();
    this.snapshot = { ...this.snapshot, settings: { ...settings } };
    this.emitSnapshot();

    if (this.roomId) {
      void set(ref(this.db, this.roomPath('settings')), stripUndefined(settings));
      if (prev.timeOfDay !== settings.timeOfDay) {
        this.recordEvent('SETTINGS_CHANGED', `${actor} set lighting to ${settings.timeOfDay}`, {
          timeOfDay: settings.timeOfDay,
        });
      } else if (prev.reverbEnabled !== settings.reverbEnabled) {
        this.recordEvent(
          'SETTINGS_CHANGED',
          `${actor} turned room reverb ${settings.reverbEnabled ? 'on' : 'off'}`,
          { reverbEnabled: settings.reverbEnabled }
        );
      } else if (prev.scaleId !== settings.scaleId || prev.rootMidi !== settings.rootMidi) {
        this.recordEvent('SETTINGS_CHANGED', `${actor} changed scale to ${settings.scaleId}`, {
          rootMidi: settings.rootMidi,
          scaleId: settings.scaleId,
        });
      }
    }
  }

  // --- CONNECT 4 ---

  public claimConnect4Seat(seat: 1 | 2): void {
    const nextC4: Connect4State = {
      ...this.snapshot.connect4,
      seats: claimSeatHelper(
        this.snapshot.connect4.seats,
        seat,
        this.localPlayerId,
        this.getLocalActorName()
      ),
    };
    this.snapshot = { ...this.snapshot, connect4: nextC4 };
    this.emitSnapshot();
    if (this.roomId) void set(ref(this.db, this.roomPath('games/connect4')), stripUndefined(nextC4));
  }

  public setConnect4TurnMode(mode: 'turn-based' | 'free-play'): void {
    const nextC4: Connect4State = { ...this.snapshot.connect4, turnMode: mode };
    this.snapshot = { ...this.snapshot, connect4: nextC4 };
    this.emitSnapshot();
    if (this.roomId) void set(ref(this.db, this.roomPath('games/connect4')), stripUndefined(nextC4));
  }

  public dropConnect4Disc(col: number, colorOverride?: 1 | 2): boolean {
    const c4 = this.snapshot.connect4;
    if (c4.winner !== 0 || col < 0 || col > 6) return false;

    const actor = this.getLocalActorName();
    const playerCount = Object.keys(this.snapshot.players).length;
    const turnCheck = colorOverride
      ? { allowed: true, nextSeats: c4.seats }
      : resolveTurnSeat(c4.seats, c4.currentTurn, c4.turnMode, playerCount, this.localPlayerId, actor);
    if (!turnCheck.allowed) return false;

    let targetRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (c4.board[r][col] === 0) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return false;

    const discColor: 1 | 2 = colorOverride ?? c4.currentTurn;
    const nextBoard = c4.board.map((row) => [...row]);
    nextBoard[targetRow][col] = discColor;
    const { winner, winningCells } = checkConnect4Winner(nextBoard);

    const nextC4: Connect4State = {
      board: nextBoard,
      currentTurn: discColor === 1 ? 2 : 1,
      turnMode: c4.turnMode,
      seats: turnCheck.nextSeats,
      winner,
      winningCells,
      lastMove: { row: targetRow, col, player: discColor, actorName: actor },
    };

    this.snapshot = { ...this.snapshot, connect4: nextC4 };
    this.emitSnapshot();

    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/connect4')), stripUndefined(nextC4));
      const colorName = discColor === 1 ? 'Red' : 'Yellow';
      if (winner === 1 || winner === 2) {
        this.recordEvent('CONNECT4_WIN', `${colorName} won Connect 4!`, { col, row: targetRow });
      } else {
        this.recordEvent('CONNECT4_MOVE', `${actor} dropped ${colorName} in column ${col + 1}`, {
          col,
          row: targetRow,
          color: colorName,
        });
      }
    }
    return true;
  }

  public resetConnect4(): void {
    const actor = this.getLocalActorName();
    const prev = this.snapshot.connect4;
    const nextC4: Connect4State = {
      ...createEmptyConnect4(),
      turnMode: prev.turnMode,
      seats: prev.seats,
    };
    this.snapshot = { ...this.snapshot, connect4: nextC4 };
    this.emitSnapshot();
    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/connect4')), stripUndefined(nextC4));
      this.recordEvent('CONNECT4_RESET', `${actor} started a fresh Connect 4 game`);
    }
  }

  // --- TIC-TAC-TOE ---

  public claimTicTacToeSeat(seat: 1 | 2): void {
    const nextTtt: TicTacToeState = {
      ...this.snapshot.tictactoe,
      seats: claimSeatHelper(
        this.snapshot.tictactoe.seats,
        seat,
        this.localPlayerId,
        this.getLocalActorName()
      ),
    };
    this.snapshot = { ...this.snapshot, tictactoe: nextTtt };
    this.emitSnapshot();
    if (this.roomId) void set(ref(this.db, this.roomPath('games/tictactoe')), stripUndefined(nextTtt));
  }

  public setTicTacToeTurnMode(mode: 'turn-based' | 'free-play'): void {
    const nextTtt: TicTacToeState = { ...this.snapshot.tictactoe, turnMode: mode };
    this.snapshot = { ...this.snapshot, tictactoe: nextTtt };
    this.emitSnapshot();
    if (this.roomId) void set(ref(this.db, this.roomPath('games/tictactoe')), stripUndefined(nextTtt));
  }

  public playTicTacToeCell(index: number): boolean {
    const ttt = this.snapshot.tictactoe;
    if (ttt.winner !== 0 || index < 0 || index > 8 || ttt.board[index] !== 0) return false;

    const actor = this.getLocalActorName();
    const playerCount = Object.keys(this.snapshot.players).length;
    const turnCheck = resolveTurnSeat(
      ttt.seats,
      ttt.currentTurn,
      ttt.turnMode,
      playerCount,
      this.localPlayerId,
      actor
    );
    if (!turnCheck.allowed) return false;

    const mark = ttt.currentTurn;
    const nextBoard = [...ttt.board];
    nextBoard[index] = mark;
    const { winner, winningLine } = checkTicTacToeWinner(nextBoard);
    const nextScores = { ...ttt.scores };
    if (winner === 1) nextScores[1] += 1;
    else if (winner === 2) nextScores[2] += 1;
    else if (winner === 'draw') nextScores.draws += 1;

    const nextTtt: TicTacToeState = {
      board: nextBoard,
      currentTurn: mark === 1 ? 2 : 1,
      turnMode: ttt.turnMode,
      seats: turnCheck.nextSeats,
      winner,
      winningLine,
      scores: nextScores,
      lastMove: { index, player: mark, actorName: actor },
    };

    this.snapshot = { ...this.snapshot, tictactoe: nextTtt };
    this.emitSnapshot();

    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/tictactoe')), stripUndefined(nextTtt));
      const sym = mark === 1 ? 'X' : 'O';
      if (winner === 1 || winner === 2) {
        this.recordEvent('TICTACTOE_WIN', `${sym} won Tic-Tac-Toe!`, { index });
      } else {
        this.recordEvent('TICTACTOE_MOVE', `${actor} placed ${sym}`, { index });
      }
    }
    return true;
  }

  public resetTicTacToe(): void {
    const actor = this.getLocalActorName();
    const nextTtt = createEmptyTicTacToe(this.snapshot.tictactoe);
    this.snapshot = { ...this.snapshot, tictactoe: nextTtt };
    this.emitSnapshot();
    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/tictactoe')), stripUndefined(nextTtt));
      this.recordEvent('TICTACTOE_RESET', `${actor} started a new Tic-Tac-Toe round`);
    }
  }

  // --- SOUND-MATCHING MEMORY ---

  public claimMemorySeat(seat: 1 | 2): void {
    const nextMem: SoundMemoryState = {
      ...this.snapshot.soundMemory,
      seats: claimSeatHelper(
        this.snapshot.soundMemory.seats,
        seat,
        this.localPlayerId,
        this.getLocalActorName()
      ),
    };
    this.snapshot = { ...this.snapshot, soundMemory: nextMem };
    this.emitSnapshot();
    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/soundMemory')), stripUndefined(nextMem));
    }
  }

  public setMemoryTurnMode(mode: 'turn-based' | 'free-play'): void {
    const nextMem: SoundMemoryState = { ...this.snapshot.soundMemory, turnMode: mode };
    this.snapshot = { ...this.snapshot, soundMemory: nextMem };
    this.emitSnapshot();
    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/soundMemory')), stripUndefined(nextMem));
    }
  }

  public flipMemoryCard(
    index: number
  ): { card: SoundMemoryCard; matched: boolean; mismatch: boolean } | null {
    const mem = this.snapshot.soundMemory;
    if (mem.winner !== 0 || index < 0 || index >= mem.cards.length) return null;
    if (mem.flippedIndices.length >= 2) return null;
    if (mem.flippedIndices.includes(index) || mem.cards[index].matched) return null;

    const actor = this.getLocalActorName();
    const playerCount = Object.keys(this.snapshot.players).length;
    const turnCheck = resolveTurnSeat(
      mem.seats,
      mem.currentTurn,
      mem.turnMode,
      playerCount,
      this.localPlayerId,
      actor
    );
    if (!turnCheck.allowed) return null;

    const nextFlipped = [...mem.flippedIndices, index];
    const pickedCard = mem.cards[index];
    let nextCards = mem.cards;
    let nextScores = { ...mem.scores };
    let nextWinner: 0 | 1 | 2 | 'draw' = mem.winner;
    let matched = false;
    let mismatch = false;
    let finalFlipped = nextFlipped;

    if (nextFlipped.length === 2) {
      const [i1, i2] = nextFlipped;
      const c1 = mem.cards[i1];
      const c2 = mem.cards[i2];
      if (c1.pairId === c2.pairId) {
        matched = true;
        nextCards = mem.cards.map((c, idx) =>
          idx === i1 || idx === i2 ? { ...c, matched: true, matchedBy: mem.currentTurn } : c
        );
        nextScores[mem.currentTurn] += 1;
        finalFlipped = [];

        if (nextCards.every((c) => c.matched)) {
          if (nextScores[1] > nextScores[2]) nextWinner = 1;
          else if (nextScores[2] > nextScores[1]) nextWinner = 2;
          else nextWinner = 'draw';
          this.recordEvent(
            'MEMORY_WIN',
            `Sound Memory completed! (${nextScores[1]}–${nextScores[2]})`
          );
        } else {
          this.recordEvent('MEMORY_MATCH', `${actor} matched ${c1.label}!`, {
            pairId: c1.pairId,
          });
        }
      } else {
        mismatch = true;
      }
    }

    const nextMem: SoundMemoryState = {
      cards: nextCards,
      flippedIndices: finalFlipped,
      currentTurn: mem.currentTurn,
      turnMode: mem.turnMode,
      seats: turnCheck.nextSeats,
      scores: nextScores,
      winner: nextWinner,
      lastFlippedAt: Date.now(),
      lastActorName: actor,
    };

    this.snapshot = { ...this.snapshot, soundMemory: nextMem };
    this.emitSnapshot();
    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/soundMemory')), stripUndefined(nextMem));
    }
    return { card: pickedCard, matched, mismatch };
  }

  public resolveMemoryMismatch(): void {
    const mem = this.snapshot.soundMemory;
    if (mem.flippedIndices.length !== 2) return;
    const nextMem: SoundMemoryState = {
      ...mem,
      flippedIndices: [],
      currentTurn: mem.currentTurn === 1 ? 2 : 1,
    };
    this.snapshot = { ...this.snapshot, soundMemory: nextMem };
    this.emitSnapshot();
    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/soundMemory')), stripUndefined(nextMem));
    }
  }

  public resetSoundMemory(): void {
    const actor = this.getLocalActorName();
    const nextMem = createShuffledSoundMemory(this.snapshot.soundMemory);
    this.snapshot = { ...this.snapshot, soundMemory: nextMem };
    this.emitSnapshot();
    if (this.roomId) {
      void set(ref(this.db, this.roomPath('games/soundMemory')), stripUndefined(nextMem));
      this.recordEvent('MEMORY_RESET', `${actor} shuffled a new Sound Memory game`);
    }
  }

  // --- SYNCED PRU (Wandering + Greetings) ---

  public updatePet(pet: PetState): void {
    this.snapshot = { ...this.snapshot, pet: { ...pet } };
    this.emitSnapshot();
    if (this.roomId) {
      const { stateEndsAt: _localTimer, ...remotePet } = pet;
      void update(
        ref(this.db, this.roomPath('pet')),
        stripUndefined({ ...remotePet, updatedAt: Date.now() })
      );
    }
  }

  public interactWithPru(): void {
    const actor = this.getLocalActorName();
    const nowUtc = Date.now();
    this.lastSeenGreetedAt = nowUtc;
    this.snapshot = { ...this.snapshot, pruHeartAt: performance.now() };
    this.emitSnapshot();
    if (this.roomId) {
      void update(ref(this.db, this.roomPath('pet')), {
        behavior: 'idle',
        lastGreetedAt: nowUtc,
        lastGreetedBy: actor,
      });
      this.recordEvent('PET_INTERACT', `${actor} said hello to Pru`);
    }
  }

  public recordEvent(
    type: SessionEventType,
    summary: string,
    payload?: Record<string, unknown>
  ): void {
    const actor = this.getLocalActorName();
    const evt: SessionEvent = stripUndefined({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      actorName: actor,
      summary,
      timestamp: Date.now(),
      payload,
    });
    if (!this.snapshot.events.some((e) => e.id === evt.id)) {
      this.snapshot = {
        ...this.snapshot,
        events: [...this.snapshot.events, evt].slice(-MAX_EVENTS),
      };
      this.emitSnapshot();
    }
    if (this.roomId) {
      void set(ref(this.db, this.roomPath(`events/${evt.id}`)), evt);
    }
  }

  public onSnapshot(listener: (snapshot: RoomSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    listener(this.snapshot);
    return () => this.snapshotListeners.delete(listener);
  }

  public onRemoteAudio(listener: (signal: AudioSignal) => void): () => void {
    this.audioListeners.add(listener);
    return () => this.audioListeners.delete(listener);
  }

  private emitSnapshot(): void {
    this.snapshotListeners.forEach((cb) => cb(this.snapshot));
  }
}
