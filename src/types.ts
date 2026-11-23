export interface Vector2 {
  /** Normalized room coordinate (0..1 across canvas width) */
  x: number;
  /** Normalized room coordinate (0..1 across canvas height) */
  y: number;
}

export type AssetCategory = 'core' | 'instrument' | 'furniture' | 'game';

export type InstrumentVoiceId =
  | 'grandpiano'
  | 'epiano'
  | 'drums'
  | 'guitar'
  | 'marimba'
  | 'percussion'
  | 'sax'
  | 'xylophone'
  | 'flute';

export interface AssetDefinition {
  id: string;
  name: string;
  url: string;
  category: AssetCategory;
  /** Optional variant family so 8 sofas / 8 beanbags group neatly in the Toy Box */
  variantGroup?: 'sofa' | 'beanbag';
  variantColorName?: string;
  variantHex?: string;
  /** Optional pre-generated form-fitting contact shadow PNG matching this sprite's exact silhouette */
  shadowUrl?: string;
  /** Target height as a fraction of canvas height (fixed 16-bit real-world scale vs 1.72m avatar) */
  heightFraction: number;
  /** Audio voice identifier for playable instruments */
  instrumentVoice?: InstrumentVoiceId;
  /** Proximity interaction radius in normalized X units */
  interactRadius?: number;
}

export interface RoomItem {
  id: string;
  assetId: string;
  /** Normalized foot anchor position on the floor (0..1) */
  x: number;
  y: number;
  /** Horizontal flip (supported for sofas and beanbags only) */
  flipped?: boolean;
}

export type HairStyle =
  | 'short'
  | 'long'
  | 'bob'
  | 'curly'
  | 'spiky'
  | 'ponytail'
  | 'buns'
  | 'bald';

export type FacingDirection = 'down' | 'up' | 'left' | 'right';

export interface PlayerState {
  id: string;
  /** Firebase Anonymous Auth UID (present when connected via Firebase) */
  uid?: string;
  name: string;
  skinTone: string;
  shirtColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: FacingDirection;
  activeInstrumentId: string | null;
  lastActiveNoteAt?: number;
}

export type PetBehavior = 'idle' | 'walk' | 'sleep';

export interface PetState {
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: 'left' | 'right';
  behavior: PetBehavior;
  /** Duration in ms until next state transition (relative to when this state started) */
  stateDurationMs?: number;
  /** UTC timestamp when this pet state was published */
  updatedAt?: number;
  /** Local performance.now() timer for state transitions */
  stateEndsAt: number;
}

export type ScaleId =
  | 'major'
  | 'minor'
  | 'harmonic_minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'hirajoshi'
  | 'pentatonic_major'
  | 'pentatonic_minor';

export interface EPianoParams {
  attack: number;     // 0.005 .. 0.35 s
  release: number;    // 0.08 .. 1.8 s
  filterFreq: number; // 400 .. 8000 Hz
  distortion: number; // 0 .. 1
}

export interface AudioSignal {
  type: 'NOTE_ON' | 'NOTE_OFF';
  sourceId: string;
  instrument: InstrumentVoiceId;
  /** Index into the active scale (0..7) or drum pad index (0..7) */
  noteIndex: number;
  /** Computed MIDI note (for melodic instruments) */
  midiNote: number;
  velocity: number;
  epianoParams?: EPianoParams;
  timestamp: number;
}

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

export interface RoomSettings {
  rootMidi: number; // e.g. 60 = C4
  scaleId: ScaleId;
  timeOfDay: TimeOfDay;
  reverbEnabled: boolean;
  pruEnabled: boolean;
}

export type Connect4Cell = 0 | 1 | 2; // 0 = empty, 1 = Red, 2 = Yellow

export interface GameSeat {
  playerId: string;
  name: string;
}

export interface Connect4State {
  /** 6 rows (0 = top, 5 = bottom) x 7 columns */
  board: Connect4Cell[][];
  currentTurn: 1 | 2;
  /** Turn-taking mode (auto-enforced when 2+ players are in the room; solo stays unrestricted) */
  turnMode: 'turn-based' | 'free-play';
  seats: { 1: GameSeat | null; 2: GameSeat | null };
  winner: 0 | 1 | 2 | 'draw';
  winningCells: Array<[number, number]>;
  lastMove: { row: number; col: number; player: 1 | 2; actorName: string } | null;
}

export interface TicTacToeState {
  /** 9 cells (0..8), 0 = empty, 1 = X, 2 = O */
  board: Array<0 | 1 | 2>;
  currentTurn: 1 | 2;
  turnMode: 'turn-based' | 'free-play';
  seats: { 1: GameSeat | null; 2: GameSeat | null };
  winner: 0 | 1 | 2 | 'draw';
  winningLine: number[];
  scores: { 1: number; 2: number; draws: number };
  lastMove: { index: number; player: 1 | 2; actorName: string } | null;
}

export interface SoundMemoryCard {
  id: number;
  pairId: number;
  instrument: InstrumentVoiceId;
  label: string;
  /** Scale degree sequence played when card is flipped */
  degrees: number[];
  accentHex: string;
  matched: boolean;
  matchedBy?: 1 | 2;
}

export interface SoundMemoryState {
  cards: SoundMemoryCard[];
  /** Currently face-up unmatched card indices (0, 1, or 2 cards) */
  flippedIndices: number[];
  currentTurn: 1 | 2;
  turnMode: 'turn-based' | 'free-play';
  seats: { 1: GameSeat | null; 2: GameSeat | null };
  scores: { 1: number; 2: number };
  winner: 0 | 1 | 2 | 'draw';
  lastFlippedAt: number;
  lastActorName: string | null;
}

export interface RoomPreset {
  id: string;
  name: string;
  description: string;
  builtIn?: boolean;
  items: RoomItem[];
  settings?: Partial<RoomSettings>;
}

export type SessionEventType =
  | 'PLAYER_JOIN'
  | 'PLAYER_LEAVE'
  | 'INSTRUMENT_OPEN'
  | 'INSTRUMENT_CLOSE'
  | 'ITEM_PLACE'
  | 'ITEM_MOVE'
  | 'ITEM_FLIP'
  | 'ITEM_REMOVE'
  | 'ROOM_TIDY'
  | 'PRESET_APPLIED'
  | 'SETTINGS_CHANGED'
  | 'CONNECT4_MOVE'
  | 'CONNECT4_WIN'
  | 'CONNECT4_RESET'
  | 'TICTACTOE_MOVE'
  | 'TICTACTOE_WIN'
  | 'TICTACTOE_RESET'
  | 'MEMORY_MATCH'
  | 'MEMORY_WIN'
  | 'MEMORY_RESET'
  | 'PET_INTERACT';

export interface SessionEvent {
  id: string;
  type: SessionEventType;
  actorName: string;
  summary: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export interface RoomSnapshot {
  roomId: string;
  players: Record<string, PlayerState>;
  items: RoomItem[];
  settings: RoomSettings;
  connect4: Connect4State;
  tictactoe: TicTacToeState;
  soundMemory: SoundMemoryState;
  pet: PetState;
  pruHeartAt?: number;
  events: SessionEvent[];
}

export interface RoomTransport {
  readonly mode: 'local-broadcast' | 'firebase';
  connect(roomId: string, localPlayer: PlayerState): void;
  disconnect(): void;
  updateLocalPlayer(player: PlayerState): void;
  setLocalActiveInstrument(instrumentId: string | null): void;
  sendAudioSignal(signal: AudioSignal): void;
  placeItem(item: RoomItem): void;
  moveItem(itemId: string, x: number, y: number): void;
  flipItem(itemId: string): void;
  removeItem(itemId: string): void;
  tidyRoom(): void;
  applyPreset(preset: RoomPreset): void;
  updateSettings(settings: RoomSettings): void;
  dropConnect4Disc(col: number, colorOverride?: 1 | 2): boolean;
  setConnect4TurnMode(mode: 'turn-based' | 'free-play'): void;
  claimConnect4Seat(seat: 1 | 2): void;
  resetConnect4(): void;
  playTicTacToeCell(index: number): boolean;
  setTicTacToeTurnMode(mode: 'turn-based' | 'free-play'): void;
  claimTicTacToeSeat(seat: 1 | 2): void;
  resetTicTacToe(): void;
  flipMemoryCard(index: number): { card: SoundMemoryCard; matched: boolean; mismatch: boolean } | null;
  resolveMemoryMismatch(): void;
  setMemoryTurnMode(mode: 'turn-based' | 'free-play'): void;
  claimMemorySeat(seat: 1 | 2): void;
  resetSoundMemory(): void;
  updatePet(pet: PetState): void;
  interactWithPru(): void;
  recordEvent(type: SessionEventType, summary: string, payload?: Record<string, unknown>): void;
  onSnapshot(listener: (snapshot: RoomSnapshot) => void): () => void;
  onRemoteAudio(listener: (signal: AudioSignal) => void): () => void;
}
