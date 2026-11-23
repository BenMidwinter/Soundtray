import {
  Connect4Cell,
  Connect4State,
  GameSeat,
  InstrumentVoiceId,
  PetState,
  RoomSettings,
  SoundMemoryCard,
  SoundMemoryState,
  TicTacToeState,
} from '../types';

export const MAX_EVENTS = 150;

export function createDefaultSettings(): RoomSettings {
  return {
    rootMidi: 60,
    scaleId: 'pentatonic_major',
    timeOfDay: 'day',
    reverbEnabled: true,
    pruEnabled: true,
  };
}

export function createInitialPet(): PetState {
  return {
    name: 'Pru',
    x: 0.54,
    y: 0.76,
    targetX: 0.54,
    targetY: 0.76,
    facing: 'right',
    behavior: 'idle',
    stateDurationMs: 4000,
    updatedAt: Date.now(),
    stateEndsAt: performance.now() + 4000,
  };
}

export function createEmptyConnect4(): Connect4State {
  return {
    board: Array.from({ length: 6 }, () => Array<Connect4Cell>(7).fill(0)),
    currentTurn: 1,
    turnMode: 'turn-based',
    seats: { 1: null, 2: null },
    winner: 0,
    winningCells: [],
    lastMove: null,
  };
}

export function createEmptyTicTacToe(
  prev?: Pick<TicTacToeState, 'turnMode' | 'seats' | 'scores'>
): TicTacToeState {
  return {
    board: Array<0 | 1 | 2>(9).fill(0),
    currentTurn: 1,
    turnMode: prev?.turnMode ?? 'turn-based',
    seats: prev?.seats ?? { 1: null, 2: null },
    winner: 0,
    winningLine: [],
    scores: prev?.scores ?? { 1: 0, 2: 0, draws: 0 },
    lastMove: null,
  };
}

const MEMORY_PAIRS: Array<{
  pairId: number;
  instrument: InstrumentVoiceId;
  label: string;
  degrees: number[];
  accentHex: string;
}> = [
  { pairId: 0, instrument: 'grandpiano', label: 'Piano Triad', degrees: [0, 2, 4], accentHex: '#e09f3e' },
  { pairId: 1, instrument: 'marimba', label: 'Marimba Bounce', degrees: [4, 2, 0], accentHex: '#c85a32' },
  { pairId: 2, instrument: 'guitar', label: 'Guitar Strums', degrees: [0, 4, 7], accentHex: '#b45309' },
  { pairId: 3, instrument: 'flute', label: 'Flute Birdsong', degrees: [5, 7], accentHex: '#2a7f7f' },
  { pairId: 4, instrument: 'xylophone', label: 'Xylo Sparkle', degrees: [7, 9, 11], accentHex: '#7a4b8a' },
  { pairId: 5, instrument: 'sax', label: 'Sax Riff', degrees: [2, 3, 5], accentHex: '#3563a8' },
];

export function createShuffledSoundMemory(
  prev?: Pick<SoundMemoryState, 'turnMode' | 'seats'>
): SoundMemoryState {
  const deck: SoundMemoryCard[] = [];
  let idCounter = 0;
  for (const pair of MEMORY_PAIRS) {
    deck.push({ ...pair, id: idCounter++, matched: false });
    deck.push({ ...pair, id: idCounter++, matched: false });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return {
    cards: deck,
    flippedIndices: [],
    currentTurn: 1,
    turnMode: prev?.turnMode ?? 'turn-based',
    seats: prev?.seats ?? { 1: null, 2: null },
    scores: { 1: 0, 2: 0 },
    winner: 0,
    lastFlippedAt: 0,
    lastActorName: null,
  };
}

export function checkConnect4Winner(
  board: Connect4Cell[][]
): { winner: 0 | 1 | 2 | 'draw'; winningCells: Array<[number, number]> } {
  const rows = 6;
  const cols = 7;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell === 0) continue;
      for (const [dr, dc] of dirs) {
        const line: Array<[number, number]> = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === cell) {
            line.push([nr, nc]);
          } else {
            break;
          }
        }
        if (line.length === 4) {
          return { winner: cell, winningCells: line };
        }
      }
    }
  }

  if (board[0].every((cell) => cell !== 0)) return { winner: 'draw', winningCells: [] };
  return { winner: 0, winningCells: [] };
}

const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function checkTicTacToeWinner(
  board: Array<0 | 1 | 2>
): { winner: 0 | 1 | 2 | 'draw'; winningLine: number[] } {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningLine: line };
    }
  }
  if (board.every((cell) => cell !== 0)) return { winner: 'draw', winningLine: [] };
  return { winner: 0, winningLine: [] };
}

export function resolveTurnSeat(
  seats: { 1: GameSeat | null; 2: GameSeat | null },
  currentTurn: 1 | 2,
  turnMode: 'turn-based' | 'free-play',
  playerCount: number,
  localPlayerId: string,
  actorName: string
): { allowed: boolean; nextSeats: { 1: GameSeat | null; 2: GameSeat | null } } {
  const nextSeats = { 1: seats[1] ?? null, 2: seats[2] ?? null };
  if (playerCount <= 1 || turnMode !== 'turn-based') {
    return { allowed: true, nextSeats };
  }
  const turnSeat = nextSeats[currentTurn];
  const otherTurn: 1 | 2 = currentTurn === 1 ? 2 : 1;
  const otherSeat = nextSeats[otherTurn];

  if (turnSeat && turnSeat.playerId !== localPlayerId) {
    return { allowed: false, nextSeats };
  }
  if (!turnSeat) {
    if (otherSeat?.playerId === localPlayerId) {
      return { allowed: false, nextSeats };
    }
    nextSeats[currentTurn] = { playerId: localPlayerId, name: actorName };
  }
  return { allowed: true, nextSeats };
}

export function claimSeatHelper(
  seats: { 1: GameSeat | null; 2: GameSeat | null },
  seat: 1 | 2,
  localPlayerId: string,
  actorName: string
): { 1: GameSeat | null; 2: GameSeat | null } {
  const otherSeat: 1 | 2 = seat === 1 ? 2 : 1;
  const nextSeats = { 1: seats[1] ?? null, 2: seats[2] ?? null };
  if (nextSeats[otherSeat]?.playerId === localPlayerId) {
    nextSeats[otherSeat] = null;
  }
  nextSeats[seat] = { playerId: localPlayerId, name: actorName };
  return nextSeats;
}

// --- Firebase RTDB Sanitizers (RTDB strips empty arrays and null keys) ---

export function sanitizeSettings(raw: Partial<RoomSettings> | null | undefined): RoomSettings {
  const def = createDefaultSettings();
  if (!raw) return def;
  return {
    rootMidi: typeof raw.rootMidi === 'number' ? raw.rootMidi : def.rootMidi,
    scaleId: raw.scaleId ?? def.scaleId,
    timeOfDay: raw.timeOfDay ?? def.timeOfDay,
    reverbEnabled: typeof raw.reverbEnabled === 'boolean' ? raw.reverbEnabled : def.reverbEnabled,
    pruEnabled: typeof raw.pruEnabled === 'boolean' ? raw.pruEnabled : def.pruEnabled,
  };
}

export function sanitizeConnect4(raw: Partial<Connect4State> | null | undefined): Connect4State {
  const def = createEmptyConnect4();
  if (!raw) return def;
  const board = Array.from({ length: 6 }, (_, r) => {
    const row = raw.board?.[r];
    return Array.from({ length: 7 }, (__, c) => ((row?.[c] ?? 0) as Connect4Cell));
  });
  return {
    board,
    currentTurn: raw.currentTurn === 2 ? 2 : 1,
    turnMode: raw.turnMode === 'free-play' ? 'free-play' : 'turn-based',
    seats: {
      1: raw.seats?.[1] ?? null,
      2: raw.seats?.[2] ?? null,
    },
    winner: raw.winner ?? 0,
    winningCells: Array.isArray(raw.winningCells) ? raw.winningCells : [],
    lastMove: raw.lastMove ?? null,
  };
}

export function sanitizeTicTacToe(raw: Partial<TicTacToeState> | null | undefined): TicTacToeState {
  const def = createEmptyTicTacToe();
  if (!raw) return def;
  return {
    board: Array.from({ length: 9 }, (_, i) => ((raw.board?.[i] ?? 0) as 0 | 1 | 2)),
    currentTurn: raw.currentTurn === 2 ? 2 : 1,
    turnMode: raw.turnMode === 'free-play' ? 'free-play' : 'turn-based',
    seats: {
      1: raw.seats?.[1] ?? null,
      2: raw.seats?.[2] ?? null,
    },
    winner: raw.winner ?? 0,
    winningLine: Array.isArray(raw.winningLine) ? raw.winningLine : [],
    scores: {
      1: raw.scores?.[1] ?? 0,
      2: raw.scores?.[2] ?? 0,
      draws: raw.scores?.draws ?? 0,
    },
    lastMove: raw.lastMove ?? null,
  };
}

export function sanitizeSoundMemory(
  raw: Partial<SoundMemoryState> | null | undefined
): SoundMemoryState {
  if (!raw || !Array.isArray(raw.cards) || raw.cards.length === 0) {
    return createShuffledSoundMemory();
  }
  return {
    cards: raw.cards.map((c) => ({
      ...c,
      degrees: Array.isArray(c.degrees) ? c.degrees : [0, 2, 4],
      matched: Boolean(c.matched),
    })),
    flippedIndices: Array.isArray(raw.flippedIndices) ? raw.flippedIndices : [],
    currentTurn: raw.currentTurn === 2 ? 2 : 1,
    turnMode: raw.turnMode === 'free-play' ? 'free-play' : 'turn-based',
    seats: {
      1: raw.seats?.[1] ?? null,
      2: raw.seats?.[2] ?? null,
    },
    scores: {
      1: raw.scores?.[1] ?? 0,
      2: raw.scores?.[2] ?? 0,
    },
    winner: raw.winner ?? 0,
    lastFlippedAt: raw.lastFlippedAt ?? 0,
    lastActorName: raw.lastActorName ?? null,
  };
}

export function sanitizePet(raw: Partial<PetState> | null | undefined): PetState {
  const def = createInitialPet();
  if (!raw) return def;
  const dur = raw.stateDurationMs ?? 4500;
  return {
    name: raw.name ?? 'Pru',
    x: typeof raw.x === 'number' ? raw.x : def.x,
    y: typeof raw.y === 'number' ? raw.y : def.y,
    targetX: typeof raw.targetX === 'number' ? raw.targetX : def.targetX,
    targetY: typeof raw.targetY === 'number' ? raw.targetY : def.targetY,
    facing: raw.facing === 'left' ? 'left' : 'right',
    behavior: raw.behavior === 'walk' || raw.behavior === 'sleep' ? raw.behavior : 'idle',
    stateDurationMs: dur,
    updatedAt: raw.updatedAt ?? Date.now(),
    stateEndsAt: performance.now() + dur,
  };
}
