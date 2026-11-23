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
import { FirebaseTransport, isFirebaseConfigured } from './FirebaseTransport';
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
} from './gameHelpers';

export {
  createDefaultSettings,
  createEmptyConnect4,
  createEmptyTicTacToe,
  createInitialPet,
  createShuffledSoundMemory,
};

type BroadcastPacket =
  | { kind: 'HELLO'; player: PlayerState }
  | {
      kind: 'SYNC_STATE';
      senderId: string;
      items: RoomItem[];
      settings: RoomSettings;
      connect4: Connect4State;
      tictactoe: TicTacToeState;
      soundMemory: SoundMemoryState;
      pet: PetState;
      events: SessionEvent[];
      player: PlayerState;
    }
  | { kind: 'PLAYER_UPDATE'; player: PlayerState }
  | { kind: 'PLAYER_LEAVE'; playerId: string; playerName: string }
  | { kind: 'ITEM_PLACE'; item: RoomItem; actorName: string }
  | { kind: 'ITEM_MOVE'; itemId: string; x: number; y: number }
  | { kind: 'ITEM_FLIP'; itemId: string; actorName: string }
  | { kind: 'ITEM_REMOVE'; itemId: string; actorName: string }
  | { kind: 'ROOM_TIDY'; actorName: string }
  | { kind: 'PRESET_APPLY'; items: RoomItem[]; settings: RoomSettings; presetName: string; actorName: string }
  | { kind: 'SETTINGS_UPDATE'; settings: RoomSettings; actorName: string }
  | { kind: 'CONNECT4_STATE'; connect4: Connect4State }
  | { kind: 'TICTACTOE_STATE'; tictactoe: TicTacToeState }
  | { kind: 'MEMORY_STATE'; soundMemory: SoundMemoryState }
  | { kind: 'PET_UPDATE'; pet: PetState }
  | { kind: 'PET_INTERACT'; actorName: string; timestamp: number }
  | { kind: 'SESSION_EVENT'; event: SessionEvent }
  | { kind: 'AUDIO_SIGNAL'; signal: AudioSignal };

export class LocalBroadcastTransport implements RoomTransport {
  public readonly mode = 'local-broadcast' as const;

  private channel: BroadcastChannel | null = null;
  private localPlayerId = '';
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
  private lastPositionBroadcastAt = 0;

  private getLocalActorName(): string {
    return this.snapshot.players[this.localPlayerId]?.name || 'Guest';
  }

  private appendEvent(event: SessionEvent, broadcast = false): void {
    if (this.snapshot.events.some((e) => e.id === event.id)) return;
    const nextEvents = [...this.snapshot.events, event].slice(-MAX_EVENTS);
    this.snapshot = { ...this.snapshot, events: nextEvents };
    if (broadcast) {
      this.post({ kind: 'SESSION_EVENT', event });
    }
  }

  private createEvent(
    type: SessionEventType,
    actorName: string,
    summary: string,
    payload?: Record<string, unknown>
  ): SessionEvent {
    return {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      actorName,
      summary,
      timestamp: Date.now(),
      payload,
    };
  }

  public connect(roomId: string, localPlayer: PlayerState): void {
    this.disconnect();

    this.localPlayerId = localPlayer.id;
    const joinEvt = this.createEvent(
      'PLAYER_JOIN',
      localPlayer.name,
      `${localPlayer.name} entered room ${roomId}`,
      { roomId }
    );

    this.snapshot = {
      roomId,
      players: { [localPlayer.id]: { ...localPlayer } },
      items: INITIAL_ROOM_ITEMS.map((i) => ({ ...i })),
      settings: createDefaultSettings(),
      connect4: createEmptyConnect4(),
      tictactoe: createEmptyTicTacToe(),
      soundMemory: createShuffledSoundMemory(),
      pet: createInitialPet(),
      events: [joinEvt],
    };

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`soundtray-room:${roomId.toUpperCase()}`);
      this.channel.onmessage = (event: MessageEvent<BroadcastPacket>) => {
        this.handlePacket(event.data);
      };
      this.post({ kind: 'HELLO', player: localPlayer });
      this.post({ kind: 'SESSION_EVENT', event: joinEvt });
    }

    window.addEventListener('beforeunload', this.handleUnload);
    this.emitSnapshot();
  }

  public disconnect(): void {
    window.removeEventListener('beforeunload', this.handleUnload);
    if (this.channel && this.localPlayerId) {
      this.post({
        kind: 'PLAYER_LEAVE',
        playerId: this.localPlayerId,
        playerName: this.getLocalActorName(),
      });
      this.channel.close();
    }
    this.channel = null;
    this.localPlayerId = '';
  }

  private handleUnload = (): void => {
    if (this.channel && this.localPlayerId) {
      this.post({
        kind: 'PLAYER_LEAVE',
        playerId: this.localPlayerId,
        playerName: this.getLocalActorName(),
      });
    }
  };

  public updateLocalPlayer(player: PlayerState): void {
    this.snapshot = {
      ...this.snapshot,
      players: { ...this.snapshot.players, [player.id]: { ...player } },
    };
    this.emitSnapshot();

    const now = performance.now();
    if (now - this.lastPositionBroadcastAt >= 50) {
      this.lastPositionBroadcastAt = now;
      this.post({ kind: 'PLAYER_UPDATE', player });
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
    this.post({ kind: 'PLAYER_UPDATE', player: updated });
  }

  public sendAudioSignal(signal: AudioSignal): void {
    this.post({ kind: 'AUDIO_SIGNAL', signal });
  }

  public placeItem(item: RoomItem): void {
    const actor = this.getLocalActorName();
    const label = ASSET_MAP[item.assetId]?.name ?? item.assetId;
    this.snapshot = { ...this.snapshot, items: [...this.snapshot.items, item] };
    this.appendEvent(
      this.createEvent('ITEM_PLACE', actor, `${actor} placed ${label}`, {
        assetId: item.assetId,
        flipped: Boolean(item.flipped),
      }),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'ITEM_PLACE', item, actorName: actor });
  }

  public moveItem(itemId: string, x: number, y: number): void {
    this.snapshot = {
      ...this.snapshot,
      items: this.snapshot.items.map((it) => (it.id === itemId ? { ...it, x, y } : it)),
    };
    this.emitSnapshot();
    this.post({ kind: 'ITEM_MOVE', itemId, x, y });
  }

  public flipItem(itemId: string): void {
    const actor = this.getLocalActorName();
    const target = this.snapshot.items.find((i) => i.id === itemId);
    const label = target ? ASSET_MAP[target.assetId]?.name ?? target.assetId : 'item';
    this.snapshot = {
      ...this.snapshot,
      items: this.snapshot.items.map((it) =>
        it.id === itemId ? { ...it, flipped: !it.flipped } : it
      ),
    };
    this.appendEvent(
      this.createEvent('ITEM_FLIP', actor, `${actor} flipped ${label}`, { itemId }),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'ITEM_FLIP', itemId, actorName: actor });
  }

  public removeItem(itemId: string): void {
    const actor = this.getLocalActorName();
    const target = this.snapshot.items.find((i) => i.id === itemId);
    const label = target ? ASSET_MAP[target.assetId]?.name ?? target.assetId : 'item';
    this.snapshot = {
      ...this.snapshot,
      items: this.snapshot.items.filter((it) => it.id !== itemId),
    };
    this.appendEvent(
      this.createEvent('ITEM_REMOVE', actor, `${actor} removed ${label}`, {
        assetId: target?.assetId,
      }),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'ITEM_REMOVE', itemId, actorName: actor });
  }

  public tidyRoom(): void {
    const actor = this.getLocalActorName();
    this.snapshot = { ...this.snapshot, items: [] };
    this.appendEvent(this.createEvent('ROOM_TIDY', actor, `${actor} tidied up the room`), true);
    this.emitSnapshot();
    this.post({ kind: 'ROOM_TIDY', actorName: actor });
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
    this.appendEvent(
      this.createEvent('PRESET_APPLIED', actor, `${actor} loaded "${preset.name}"`, {
        presetId: preset.id,
        itemCount: nextItems.length,
      }),
      true
    );
    this.emitSnapshot();
    this.post({
      kind: 'PRESET_APPLY',
      items: nextItems,
      settings: nextSettings,
      presetName: preset.name,
      actorName: actor,
    });
  }

  public updateSettings(settings: RoomSettings): void {
    const prev = this.snapshot.settings;
    const actor = this.getLocalActorName();
    this.snapshot = { ...this.snapshot, settings: { ...settings } };

    if (prev.timeOfDay !== settings.timeOfDay) {
      this.appendEvent(
        this.createEvent('SETTINGS_CHANGED', actor, `${actor} set lighting to ${settings.timeOfDay}`, {
          timeOfDay: settings.timeOfDay,
        }),
        true
      );
    } else if (prev.reverbEnabled !== settings.reverbEnabled) {
      this.appendEvent(
        this.createEvent(
          'SETTINGS_CHANGED',
          actor,
          `${actor} turned room reverb ${settings.reverbEnabled ? 'on' : 'off'}`,
          { reverbEnabled: settings.reverbEnabled }
        ),
        true
      );
    } else if (prev.scaleId !== settings.scaleId || prev.rootMidi !== settings.rootMidi) {
      this.appendEvent(
        this.createEvent('SETTINGS_CHANGED', actor, `${actor} changed scale to ${settings.scaleId}`, {
          rootMidi: settings.rootMidi,
          scaleId: settings.scaleId,
        }),
        true
      );
    }

    this.emitSnapshot();
    this.post({ kind: 'SETTINGS_UPDATE', settings, actorName: actor });
  }

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
    this.post({ kind: 'CONNECT4_STATE', connect4: nextC4 });
  }

  public setConnect4TurnMode(mode: 'turn-based' | 'free-play'): void {
    const nextC4: Connect4State = { ...this.snapshot.connect4, turnMode: mode };
    this.snapshot = { ...this.snapshot, connect4: nextC4 };
    this.emitSnapshot();
    this.post({ kind: 'CONNECT4_STATE', connect4: nextC4 });
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
    const colorName = discColor === 1 ? 'Red' : 'Yellow';
    this.appendEvent(
      winner === 1 || winner === 2
        ? this.createEvent('CONNECT4_WIN', actor, `${colorName} won Connect 4!`, { col, row: targetRow })
        : this.createEvent('CONNECT4_MOVE', actor, `${actor} dropped ${colorName} in column ${col + 1}`, {
            col,
            row: targetRow,
            color: colorName,
          }),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'CONNECT4_STATE', connect4: nextC4 });
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
    this.appendEvent(
      this.createEvent('CONNECT4_RESET', actor, `${actor} started a fresh Connect 4 game`),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'CONNECT4_STATE', connect4: nextC4 });
  }

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
    this.post({ kind: 'TICTACTOE_STATE', tictactoe: nextTtt });
  }

  public setTicTacToeTurnMode(mode: 'turn-based' | 'free-play'): void {
    const nextTtt: TicTacToeState = { ...this.snapshot.tictactoe, turnMode: mode };
    this.snapshot = { ...this.snapshot, tictactoe: nextTtt };
    this.emitSnapshot();
    this.post({ kind: 'TICTACTOE_STATE', tictactoe: nextTtt });
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
    const sym = mark === 1 ? 'X' : 'O';
    this.appendEvent(
      winner === 1 || winner === 2
        ? this.createEvent('TICTACTOE_WIN', actor, `${sym} won Tic-Tac-Toe!`, { index })
        : this.createEvent('TICTACTOE_MOVE', actor, `${actor} placed ${sym}`, { index }),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'TICTACTOE_STATE', tictactoe: nextTtt });
    return true;
  }

  public resetTicTacToe(): void {
    const actor = this.getLocalActorName();
    const nextTtt = createEmptyTicTacToe(this.snapshot.tictactoe);
    this.snapshot = { ...this.snapshot, tictactoe: nextTtt };
    this.appendEvent(
      this.createEvent('TICTACTOE_RESET', actor, `${actor} started a new Tic-Tac-Toe round`),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'TICTACTOE_STATE', tictactoe: nextTtt });
  }

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
    this.post({ kind: 'MEMORY_STATE', soundMemory: nextMem });
  }

  public setMemoryTurnMode(mode: 'turn-based' | 'free-play'): void {
    const nextMem: SoundMemoryState = { ...this.snapshot.soundMemory, turnMode: mode };
    this.snapshot = { ...this.snapshot, soundMemory: nextMem };
    this.emitSnapshot();
    this.post({ kind: 'MEMORY_STATE', soundMemory: nextMem });
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
          this.appendEvent(
            this.createEvent(
              'MEMORY_WIN',
              actor,
              `Sound Memory completed! (${nextScores[1]}–${nextScores[2]})`
            ),
            true
          );
        } else {
          this.appendEvent(
            this.createEvent('MEMORY_MATCH', actor, `${actor} matched ${c1.label}!`, {
              pairId: c1.pairId,
            }),
            true
          );
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
    this.post({ kind: 'MEMORY_STATE', soundMemory: nextMem });
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
    this.post({ kind: 'MEMORY_STATE', soundMemory: nextMem });
  }

  public resetSoundMemory(): void {
    const actor = this.getLocalActorName();
    const nextMem = createShuffledSoundMemory(this.snapshot.soundMemory);
    this.snapshot = { ...this.snapshot, soundMemory: nextMem };
    this.appendEvent(
      this.createEvent('MEMORY_RESET', actor, `${actor} shuffled a new Sound Memory game`),
      true
    );
    this.emitSnapshot();
    this.post({ kind: 'MEMORY_STATE', soundMemory: nextMem });
  }

  public updatePet(pet: PetState): void {
    this.snapshot = { ...this.snapshot, pet: { ...pet } };
    this.emitSnapshot();
    this.post({ kind: 'PET_UPDATE', pet });
  }

  public interactWithPru(): void {
    const actor = this.getLocalActorName();
    this.snapshot = { ...this.snapshot, pruHeartAt: performance.now() };
    this.appendEvent(this.createEvent('PET_INTERACT', actor, `${actor} said hello to Pru`), true);
    this.emitSnapshot();
    this.post({ kind: 'PET_INTERACT', actorName: actor, timestamp: Date.now() });
  }

  public recordEvent(
    type: SessionEventType,
    summary: string,
    payload?: Record<string, unknown>
  ): void {
    const actor = this.getLocalActorName();
    this.appendEvent(this.createEvent(type, actor, summary, payload), true);
    this.emitSnapshot();
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

  private post(packet: BroadcastPacket): void {
    try {
      this.channel?.postMessage(packet);
    } catch {
      // ignore if channel closed
    }
  }

  private handlePacket(packet: BroadcastPacket): void {
    switch (packet.kind) {
      case 'HELLO': {
        this.snapshot = {
          ...this.snapshot,
          players: { ...this.snapshot.players, [packet.player.id]: packet.player },
        };
        const me = this.snapshot.players[this.localPlayerId];
        if (me) {
          this.post({
            kind: 'SYNC_STATE',
            senderId: this.localPlayerId,
            items: this.snapshot.items,
            settings: this.snapshot.settings,
            connect4: this.snapshot.connect4,
            tictactoe: this.snapshot.tictactoe,
            soundMemory: this.snapshot.soundMemory,
            pet: this.snapshot.pet,
            events: this.snapshot.events,
            player: me,
          });
        }
        this.emitSnapshot();
        break;
      }
      case 'SYNC_STATE': {
        this.snapshot = {
          ...this.snapshot,
          players: { ...this.snapshot.players, [packet.player.id]: packet.player },
          items: packet.items,
          settings: packet.settings,
          connect4: packet.connect4,
          tictactoe: packet.tictactoe,
          soundMemory: packet.soundMemory,
          pet: packet.pet,
          events:
            packet.events.length > this.snapshot.events.length
              ? packet.events
              : this.snapshot.events,
        };
        this.emitSnapshot();
        break;
      }
      case 'PLAYER_UPDATE': {
        this.snapshot = {
          ...this.snapshot,
          players: { ...this.snapshot.players, [packet.player.id]: packet.player },
        };
        this.emitSnapshot();
        break;
      }
      case 'PLAYER_LEAVE': {
        const nextPlayers = { ...this.snapshot.players };
        delete nextPlayers[packet.playerId];
        this.snapshot = { ...this.snapshot, players: nextPlayers };
        this.appendEvent(
          this.createEvent('PLAYER_LEAVE', packet.playerName, `${packet.playerName} left the room`),
          false
        );
        this.emitSnapshot();
        break;
      }
      case 'ITEM_PLACE': {
        if (!this.snapshot.items.some((i) => i.id === packet.item.id)) {
          this.snapshot = { ...this.snapshot, items: [...this.snapshot.items, packet.item] };
          this.emitSnapshot();
        }
        break;
      }
      case 'ITEM_MOVE': {
        this.snapshot = {
          ...this.snapshot,
          items: this.snapshot.items.map((it) =>
            it.id === packet.itemId ? { ...it, x: packet.x, y: packet.y } : it
          ),
        };
        this.emitSnapshot();
        break;
      }
      case 'ITEM_FLIP': {
        this.snapshot = {
          ...this.snapshot,
          items: this.snapshot.items.map((it) =>
            it.id === packet.itemId ? { ...it, flipped: !it.flipped } : it
          ),
        };
        this.emitSnapshot();
        break;
      }
      case 'ITEM_REMOVE': {
        this.snapshot = {
          ...this.snapshot,
          items: this.snapshot.items.filter((it) => it.id !== packet.itemId),
        };
        this.emitSnapshot();
        break;
      }
      case 'ROOM_TIDY': {
        this.snapshot = { ...this.snapshot, items: [] };
        this.emitSnapshot();
        break;
      }
      case 'PRESET_APPLY': {
        this.snapshot = { ...this.snapshot, items: packet.items, settings: packet.settings };
        this.emitSnapshot();
        break;
      }
      case 'SETTINGS_UPDATE': {
        this.snapshot = { ...this.snapshot, settings: packet.settings };
        this.emitSnapshot();
        break;
      }
      case 'CONNECT4_STATE': {
        this.snapshot = { ...this.snapshot, connect4: packet.connect4 };
        this.emitSnapshot();
        break;
      }
      case 'TICTACTOE_STATE': {
        this.snapshot = { ...this.snapshot, tictactoe: packet.tictactoe };
        this.emitSnapshot();
        break;
      }
      case 'MEMORY_STATE': {
        this.snapshot = { ...this.snapshot, soundMemory: packet.soundMemory };
        this.emitSnapshot();
        break;
      }
      case 'PET_UPDATE': {
        this.snapshot = { ...this.snapshot, pet: packet.pet };
        this.emitSnapshot();
        break;
      }
      case 'PET_INTERACT': {
        this.snapshot = { ...this.snapshot, pruHeartAt: performance.now() };
        this.emitSnapshot();
        break;
      }
      case 'SESSION_EVENT': {
        this.appendEvent(packet.event, false);
        this.emitSnapshot();
        break;
      }
      case 'AUDIO_SIGNAL': {
        if (packet.signal.sourceId !== this.localPlayerId) {
          this.audioListeners.forEach((cb) => cb(packet.signal));
        }
        break;
      }
    }
  }

  private emitSnapshot(): void {
    this.snapshotListeners.forEach((cb) => cb(this.snapshot));
  }
}

/**
 * Automatically selects Firebase Realtime Database when VITE_FIREBASE_* env vars
 * are configured, and falls back seamlessly to local multi-tab BroadcastChannel sync.
 */
export const roomTransport: RoomTransport = isFirebaseConfigured()
  ? new FirebaseTransport()
  : new LocalBroadcastTransport();
