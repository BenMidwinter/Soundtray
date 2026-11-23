import { INITIAL_ROOM_ITEMS } from './assetManifest';
import { RoomPreset } from '../types';

const CUSTOM_PRESETS_KEY = 'soundtray_custom_presets_v1';

export const BUILT_IN_PRESETS: RoomPreset[] = [
  {
    id: 'preset-default',
    name: 'Default Music Room',
    description: 'Balanced studio with grand piano, drums, guitar, sofa, lamp, and beanbag.',
    builtIn: true,
    items: INITIAL_ROOM_ITEMS.map((i) => ({ ...i })),
    settings: { timeOfDay: 'day', scaleId: 'pentatonic_major', rootMidi: 60 },
  },
  {
    id: 'preset-quiet-corner',
    name: 'Quiet Corner',
    description: 'Warm sunset lighting, gentle acoustic instruments, cosy seating, and Connect 4.',
    builtIn: true,
    items: [
      { id: 'qc-lamp-l', assetId: 'lamp', x: 0.21, y: 0.63 },
      { id: 'qc-lamp-r', assetId: 'lamp', x: 0.79, y: 0.63 },
      { id: 'qc-sofa', assetId: 'sofa_green', x: 0.5, y: 0.64 },
      { id: 'qc-sidetable', assetId: 'sidetable', x: 0.61, y: 0.65 },
      { id: 'qc-plant', assetId: 'plant', x: 0.27, y: 0.65 },
      { id: 'qc-coffee', assetId: 'coffeetable', x: 0.5, y: 0.76 },
      { id: 'qc-c4', assetId: 'connect4', x: 0.5, y: 0.77 },
      { id: 'qc-bb1', assetId: 'beanbag_orange', x: 0.36, y: 0.84 },
      { id: 'qc-bb2', assetId: 'beanbag_purple', x: 0.64, y: 0.84, flipped: true },
      { id: 'qc-marimba', assetId: 'marimba', x: 0.26, y: 0.86 },
      { id: 'qc-flute', assetId: 'flute', x: 0.74, y: 0.88 },
    ],
    settings: { timeOfDay: 'sunset', scaleId: 'pentatonic_minor', rootMidi: 62 },
  },
  {
    id: 'preset-full-band',
    name: 'Full Band Jam',
    description: 'All nine instruments arranged for energetic group improvisation.',
    builtIn: true,
    items: [
      { id: 'fb-piano', assetId: 'grandpiano', x: 0.27, y: 0.67 },
      { id: 'fb-epiano', assetId: 'epiano', x: 0.44, y: 0.65 },
      { id: 'fb-drums', assetId: 'drums', x: 0.62, y: 0.67 },
      { id: 'fb-bookshelf', assetId: 'bookshelf', x: 0.8, y: 0.63 },
      { id: 'fb-marimba', assetId: 'marimba', x: 0.24, y: 0.84 },
      { id: 'fb-cajon', assetId: 'percussion', x: 0.39, y: 0.88 },
      { id: 'fb-xylo', assetId: 'xylophone', x: 0.52, y: 0.9 },
      { id: 'fb-guitar', assetId: 'guitar', x: 0.65, y: 0.85 },
      { id: 'fb-sax', assetId: 'sax', x: 0.76, y: 0.84 },
      { id: 'fb-flute', assetId: 'flute', x: 0.45, y: 0.77 },
    ],
    settings: { timeOfDay: 'day', scaleId: 'dorian', rootMidi: 60 },
  },
  {
    id: 'preset-blank-sandtray',
    name: 'Blank Sandtray',
    description: 'Empty wooden floor so the client can build the room entirely from scratch.',
    builtIn: true,
    items: [],
    settings: { timeOfDay: 'morning' },
  },
];

export function loadCustomPresets(): RoomPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoomPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomPreset(preset: RoomPreset): RoomPreset[] {
  const existing = loadCustomPresets().filter((p) => p.id !== preset.id);
  const next = [{ ...preset, builtIn: false }, ...existing];
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function deleteCustomPreset(presetId: string): RoomPreset[] {
  const next = loadCustomPresets().filter((p) => p.id !== presetId);
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
