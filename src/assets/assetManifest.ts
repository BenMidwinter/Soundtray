import { AssetDefinition, RoomItem, Vector2 } from '../types';

/**
 * Cleaned, tight-cropped PNG assets stored locally in `public/assets/`.
 * Originates from `https://benmidwinter.github.io/Soundtray` (shelf removed,
 * leftover white backgrounds & edge halos stripped, tight alpha bounding boxes,
 * plus custom form-fitting silhouette shadows in `public/assets/shadows/`).
 *
 * Logical Real-World Scale Reference (H = 673px, back-wall wainscoting ≈ 101px ≈ 1.0m):
 *  - Human Avatar (1.72m): ~121px (0.180 H)
 *  - Pru (8kg Jack Russell mix, ~0.42m head height): ~32px (0.048 H, ~26% of avatar height)
 */
export const ASSET_BASE_URL = '/assets';

/** Logical canvas dimensions matching `background.png` (1408 x 673, ~2.092:1). */
export const ROOM_LOGICAL_WIDTH = 1408;
export const ROOM_LOGICAL_HEIGHT = 673;

/**
 * Normalized walkable trapezoid mapped directly to the wooden floor & baseboards of `background.png`.
 * Vertices ordered clockwise: back-left, back-right, front-right, front-left.
 */
export const FLOOR_POLYGON_NORM: readonly Vector2[] = [
  { x: 0.198, y: 0.585 },
  { x: 0.802, y: 0.585 },
  { x: 0.908, y: 0.972 },
  { x: 0.092, y: 0.972 },
] as const;

export const FLOOR_MIN_Y = 0.585;
export const FLOOR_MAX_Y = 0.972;

export function getFloorXBounds(y: number): { minX: number; maxX: number } {
  const clampedY = Math.max(FLOOR_MIN_Y, Math.min(FLOOR_MAX_Y, y));
  const t = (clampedY - FLOOR_MIN_Y) / (FLOOR_MAX_Y - FLOOR_MIN_Y);
  const minX = 0.198 + (0.092 - 0.198) * t;
  const maxX = 0.802 + (0.908 - 0.802) * t;
  return { minX, maxX };
}

export function isPointInFloor(x: number, y: number): boolean {
  if (y < FLOOR_MIN_Y || y > FLOOR_MAX_Y) return false;
  const { minX, maxX } = getFloorXBounds(y);
  return x >= minX && x <= maxX;
}

export function clampToFloor(x: number, y: number, marginX = 0.025): Vector2 {
  const clampedY = Math.max(FLOOR_MIN_Y, Math.min(FLOOR_MAX_Y, y));
  const { minX, maxX } = getFloorXBounds(clampedY);
  const safeMin = Math.min(minX + marginX, 0.5);
  const safeMax = Math.max(maxX - marginX, 0.5);
  return {
    x: Math.max(safeMin, Math.min(safeMax, x)),
    y: clampedY,
  };
}

const VARIANT_COLORS: Array<{ key: string; label: string; hex: string }> = [
  { key: 'red', label: 'Red', hex: '#c0392b' },
  { key: 'orange', label: 'Orange', hex: '#d97706' },
  { key: 'yellow', label: 'Yellow', hex: '#eab308' },
  { key: 'green', label: 'Green', hex: '#2e7d32' },
  { key: 'blue', label: 'Blue', hex: '#2563eb' },
  { key: 'purple', label: 'Purple', hex: '#7c3aed' },
  { key: 'brown', label: 'Brown', hex: '#7c4a2d' },
  { key: 'black', label: 'Black', hex: '#262626' },
];

const assetUrl = (filename: string) => `${ASSET_BASE_URL}/${filename}`;
const shadowUrl = (filename: string) => `${ASSET_BASE_URL}/shadows/${filename}`;

export const ASSET_MANIFEST: AssetDefinition[] = [
  // --- CORE ROOM ---
  {
    id: 'background',
    name: 'Music Room',
    url: assetUrl('background.png'),
    category: 'core',
    heightFraction: 1,
  },
  {
    id: 'background_window_mask',
    name: 'Music Room (Window Cutout)',
    url: assetUrl('background_window_mask.png'),
    category: 'core',
    heightFraction: 1,
  },

  // --- INSTRUMENTS (9 — calibrated to real-world proportions vs 1.72m avatar) ---
  {
    id: 'grandpiano',
    name: 'Grand Piano',
    url: assetUrl('grandpiano.png'),
    shadowUrl: shadowUrl('grandpiano.png'),
    category: 'instrument',
    heightFraction: 0.235, // ~158px (parlor grand with open lid)
    instrumentVoice: 'grandpiano',
    interactRadius: 0.11,
  },
  {
    id: 'drums',
    name: 'Drum Kit',
    url: assetUrl('drums.png'),
    shadowUrl: shadowUrl('drums.png'),
    category: 'instrument',
    heightFraction: 0.215, // ~145px (cymbals at ~1.4m)
    instrumentVoice: 'drums',
    interactRadius: 0.1,
  },
  {
    id: 'epiano',
    name: 'E. Piano',
    url: assetUrl('epiano.png'),
    shadowUrl: shadowUrl('epiano.png'),
    category: 'instrument',
    heightFraction: 0.158, // ~106px (~0.90m waist-height Rhodes on legs)
    instrumentVoice: 'epiano',
    interactRadius: 0.095,
  },
  {
    id: 'marimba',
    name: 'Marimba',
    url: assetUrl('marimba.png'),
    shadowUrl: shadowUrl('marimba.png'),
    category: 'instrument',
    heightFraction: 0.155, // ~104px (~0.90m waist height, ~145px wide)
    instrumentVoice: 'marimba',
    interactRadius: 0.095,
  },
  {
    id: 'guitar',
    name: 'Guitar',
    url: assetUrl('guitar.png'),
    shadowUrl: shadowUrl('guitar.png'),
    category: 'instrument',
    heightFraction: 0.095, // ~64px (~1.0m acoustic guitar angled -> ~0.71m vertical span)
    instrumentVoice: 'guitar',
    interactRadius: 0.085,
  },
  {
    id: 'sax',
    name: 'Saxophone',
    url: assetUrl('sax.png'),
    shadowUrl: shadowUrl('sax.png'),
    category: 'instrument',
    heightFraction: 0.098, // ~66px (~0.75m alto/tenor sax)
    instrumentVoice: 'sax',
    interactRadius: 0.085,
  },
  {
    id: 'percussion',
    name: 'Percussion (Cajon)',
    url: assetUrl('percussion.png'),
    shadowUrl: shadowUrl('percussion.png'),
    category: 'instrument',
    heightFraction: 0.082, // ~55px (~0.49m seat-height cajon)
    instrumentVoice: 'percussion',
    interactRadius: 0.085,
  },
  {
    id: 'xylophone',
    name: 'Xylophone',
    url: assetUrl('xylophone.png'),
    shadowUrl: shadowUrl('xylophone.png'),
    category: 'instrument',
    heightFraction: 0.072, // ~48px (~0.55m floor xylophone + mallets)
    instrumentVoice: 'xylophone',
    interactRadius: 0.085,
  },
  {
    id: 'flute',
    name: 'Flute',
    url: assetUrl('flute.png'),
    shadowUrl: shadowUrl('flute.png'),
    category: 'instrument',
    heightFraction: 0.048, // ~32px (~0.67m concert flute lying diagonally)
    instrumentVoice: 'flute',
    interactRadius: 0.085,
  },

  // --- FURNITURE & GAMES (6 — wall shelf removed) ---
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    url: assetUrl('bookshelf.png'),
    shadowUrl: shadowUrl('bookshelf.png'),
    category: 'furniture',
    heightFraction: 0.235, // ~158px (~1.95m tall bookcase, taller than avatar)
  },
  {
    id: 'lamp',
    name: 'Floor Lamp',
    url: assetUrl('lamp.png'),
    shadowUrl: shadowUrl('lamp.png'),
    category: 'furniture',
    heightFraction: 0.195, // ~131px (~1.70m standing floor lamp)
  },
  {
    id: 'plant',
    name: 'Potted Plant',
    url: assetUrl('plant.png'),
    shadowUrl: shadowUrl('plant.png'),
    category: 'furniture',
    heightFraction: 0.155, // ~104px (~1.25m potted Monstera)
  },
  {
    id: 'sidetable',
    name: 'Side Table',
    url: assetUrl('sidetable.png'),
    shadowUrl: shadowUrl('sidetable.png'),
    category: 'furniture',
    heightFraction: 0.102, // ~69px (~0.62m sofa armrest height)
  },
  {
    id: 'coffeetable',
    name: 'Coffee Table',
    url: assetUrl('coffeetable.png'),
    shadowUrl: shadowUrl('coffeetable.png'),
    category: 'furniture',
    heightFraction: 0.092, // ~62px (~0.48m knee-high coffee table)
  },
  // --- GAMES (3 — separate Games category in Toy Box) ---
  {
    id: 'connect4',
    name: 'Connect 4',
    url: assetUrl('connect4.png'),
    shadowUrl: shadowUrl('connect4.png'),
    category: 'game',
    heightFraction: 0.06, // ~40px (~0.30m board game)
    interactRadius: 0.085,
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    url: assetUrl('tictactoe.png'),
    shadowUrl: shadowUrl('tictactoe.png'),
    category: 'game',
    heightFraction: 0.064, // ~43px wooden 3x3 tabletop board
    interactRadius: 0.085,
  },
  {
    id: 'soundmemory',
    name: 'Sound Memory',
    url: assetUrl('soundmemory.png'),
    shadowUrl: shadowUrl('soundmemory.png'),
    category: 'game',
    heightFraction: 0.064, // ~43px musical memory card tray
    interactRadius: 0.085,
  },

  // --- SOFA VARIANTS (8) ---
  ...VARIANT_COLORS.map(
    (c): AssetDefinition => ({
      id: `sofa_${c.key}`,
      name: `${c.label} Sofa`,
      url: assetUrl(`sofa_${c.key}.png`),
      shadowUrl: shadowUrl(`sofa_${c.key}.png`),
      category: 'furniture',
      variantGroup: 'sofa',
      variantColorName: c.label,
      variantHex: c.hex,
      heightFraction: 0.145, // ~98px (~0.85m backrest, ~155px wide 3-seater)
    })
  ),

  // --- BEANBAG VARIANTS (8) ---
  ...VARIANT_COLORS.map(
    (c): AssetDefinition => ({
      id: `beanbag_${c.key}`,
      name: `${c.label} Beanbag`,
      url: assetUrl(`beanbag_${c.key}.png`),
      shadowUrl: shadowUrl(`beanbag_${c.key}.png`),
      category: 'furniture',
      variantGroup: 'beanbag',
      variantColorName: c.label,
      variantHex: c.hex,
      heightFraction: 0.098, // ~66px (~0.60m cozy floor beanbag)
    })
  ),
];

export const ASSET_MAP: Record<string, AssetDefinition> = Object.fromEntries(
  ASSET_MANIFEST.map((def) => [def.id, def])
);

export const INITIAL_ROOM_ITEMS: RoomItem[] = [
  { id: 'init-lamp', assetId: 'lamp', x: 0.21, y: 0.63 },
  { id: 'init-piano', assetId: 'grandpiano', x: 0.3, y: 0.67 },
  { id: 'init-sofa', assetId: 'sofa_red', x: 0.5, y: 0.64 },
  { id: 'init-drums', assetId: 'drums', x: 0.7, y: 0.68 },
  { id: 'init-plant', assetId: 'plant', x: 0.81, y: 0.65 },
  { id: 'init-beanbag', assetId: 'beanbag_blue', x: 0.36, y: 0.84 },
  { id: 'init-guitar', assetId: 'guitar', x: 0.63, y: 0.83 },
];

export const SKIN_TONES = [
  { label: 'Porcelain', hex: '#fde2c8' },
  { label: 'Warm Sand', hex: '#f1c29b' },
  { label: 'Golden', hex: '#d89b6a' },
  { label: 'Chestnut', hex: '#a96c45' },
  { label: 'Espresso', hex: '#6c4229' },
];

export const SHIRT_COLORS = [
  { label: 'Terracotta', hex: '#c85a32' },
  { label: 'Amber', hex: '#d99126' },
  { label: 'Sage', hex: '#5f7a48' },
  { label: 'Teal', hex: '#2a7f7f' },
  { label: 'Cobalt', hex: '#3563a8' },
  { label: 'Plum', hex: '#7a4b8a' },
  { label: 'Rose', hex: '#b8506e' },
  { label: 'Charcoal', hex: '#374151' },
];

export const HAIR_COLORS = [
  { label: 'Espresso', hex: '#241a15' },
  { label: 'Chestnut', hex: '#5a3222' },
  { label: 'Auburn', hex: '#8b3e22' },
  { label: 'Honey Blonde', hex: '#c88a36' },
  { label: 'Silver', hex: '#9ca3af' },
  { label: 'Plum Dye', hex: '#6b3a7d' },
];

export const HAIR_STYLES: Array<{
  id: 'short' | 'long' | 'bob' | 'curly' | 'spiky' | 'ponytail' | 'buns' | 'bald';
  label: string;
}> = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'bob', label: 'Bob' },
  { id: 'curly', label: 'Curly' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'buns', label: 'Twin Buns' },
  { id: 'bald', label: 'Bald' },
];
