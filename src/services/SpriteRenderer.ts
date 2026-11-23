import { HairStyle, PetState, PlayerState } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function shiftRgb([r, g, b]: [number, number, number], delta: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n + delta)));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function buildStardewPalette(
  skinHex: string,
  shirtHex: string,
  hairHex: string
): Record<string, string> {
  const skin = hexToRgb(skinHex);
  const shirt = hexToRgb(shirtHex);
  const hair = hexToRgb(hairHex);
  return {
    O: '#241a16', // Warm dark brown-charcoal outline
    k: shiftRgb(hair, -42), // Hair deep outline / shadow
    H: shiftRgb(hair, 0), // Hair base
    h: shiftRgb(hair, 28), // Hair soft highlight
    d: shiftRgb(hair, -22), // Hair mid-shadow
    S: shiftRgb(skin, 0), // Skin base
    s: shiftRgb(skin, -22), // Skin soft shade
    b: shiftRgb(hair, -30), // Gentle eyebrow
    E: '#202838', // Soft dark pupil
    W: '#f6f4f0', // Soft outer eye pixel & sneaker toe cap
    T: shiftRgb(shirt, 0), // Sweater / shirt base
    t: shiftRgb(shirt, -28), // Shirt shadow / collar
    u: shiftRgb(shirt, 18), // Shirt subtle highlight
    P: '#3e444e', // Soft charcoal/denim trousers
    p: '#2a2e36', // Trouser shade
    N: '#385686', // Classic sneaker accent
  };
}

// ============================================================================
// BASE TORSO + LEGS PER VIEW (15w x 12h below the 11-row head)
// ============================================================================

const TORSO_FRONT = [
  '...OTTTTTTTO...',
  '..OTuTTTTTTtO..',
  '..OTtTTTTTtTO..',
  '..OTtTTTTTtTO..',
  '..OSSOTtTOSSO..',
];

const LEGS_FRONT_IDLE = [
  '..OssOPPPOssO..',
  '...OOOPpPOOO...',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '...OWNO.ONWO...',
  '...OOOO.OOOO...',
];

const LEGS_FRONT_WALK_A = [
  '..OssOPPPOssO..',
  '...OOOPpPOOO...',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '...OPO...OPO...',
  '...OWNO..ONWO..',
  '...OOOO...OO...',
];

const LEGS_FRONT_WALK_B = [
  '..OssOPPPOssO..',
  '...OOOPpPOOO...',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '...OPO...OPO...',
  '..OWNO..ONWO...',
  '...OO...OOOO...',
];

const TORSO_BACK = [
  '...OTTTTTTTO...',
  '..OTtTTTTTTtO..',
  '..OTtTTTTTtTO..',
  '..OTtTTTTTtTO..',
  '..OSSOTtTOSSO..',
];

const LEGS_BACK_IDLE = [
  '..OssOPPPOssO..',
  '...OOOPpPOOO...',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '...ONNO.ONNO...',
  '...OOOO.OOOO...',
];

const LEGS_BACK_WALK_A = [
  '..OssOPPPOssO..',
  '...OOOPpPOOO...',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '...OPO...OPO...',
  '...ONNO..ONNO..',
  '...OOOO...OO...',
];

const LEGS_BACK_WALK_B = [
  '..OssOPPPOssO..',
  '...OOOPpPOOO...',
  '....OPPOPPO....',
  '....OPPOPPO....',
  '...OPO...OPO...',
  '..ONNO..ONNO...',
  '...OO...OOOO...',
];

// Side profile (facing RIGHT; mirrored cleanly for LEFT)
const TORSO_SIDE = [
  '....OTTTTTO....',
  '....OTuTTtO....',
  '....OTTTtTO....',
  '....OTTSSTO....',
  '....OTtsstO....',
];

const LEGS_SIDE_IDLE = [
  '....OOPPPPO....',
  '.....OPPPO.....',
  '.....OPPpO.....',
  '.....OPPpO.....',
  '.....OPPpO.....',
  '.....ONNWO.....',
  '.....OOOOO.....',
];

const LEGS_SIDE_WALK_A = [
  '....OOPPPPO....',
  '....OPPPPPO....',
  '...OPpO.OPO....',
  '...OPO...OPO...',
  '..ONNO...ONWO..',
  '..OOOO...OOOO..',
  '...............',
];

const LEGS_SIDE_WALK_B = [
  '....OOPPPPO....',
  '....OPPPPPO....',
  '....OPO.OPpO...',
  '...OPO...OPO...',
  '..ONWO...ONNO..',
  '..OOOO...OOOO..',
  '...............',
];

interface HairViewSet {
  front: string[];
  back: string[];
  side: string[];
  frontDrape?: string[];
  backDrape?: string[];
  sideDrape?: string[];
}

const HAIR_SETS: Record<HairStyle, HairViewSet> = {
  short: {
    front: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHddHHHdddk..',
      '..kddSSSSSddk..',
      '..kdSbbSbbSdk..',
      '..kSSWEsEWSSk..',
      '..kSSWEsEWSSk..',
      '...kSSSSSSSk...',
      '....ksssssk....',
      '....ktttttk....',
    ],
    back: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHHHHHHHHdk..',
      '..kHHHHHHHHdk..',
      '..kHHHHHHHddk..',
      '..kHdddddddk...',
      '...kdddddddk...',
      '....ksssssk....',
      '....ksssssk....',
      '....ktttttk....',
    ],
    side: [
      '....kkkkkk.....',
      '...kHhhHHdk....',
      '..kHhHHHHHdk...',
      '..kHHHHdddSk...',
      '..kHHHddSSSO...',
      '..kHHddSSbbO...',
      '..kHddSSSEWO...',
      '..kHddSSSEWO...',
      '...kddSSSSSO...',
      '....ksssssO....',
      '....ktttttO....',
    ],
  },
  long: {
    front: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHdHSSSHddk..',
      '.kHdHSSSSSHddk.',
      '.kHdSbbSbbSddk.',
      '.kHdSWEsEWSddk.',
      '.kHdSWEsEWSddk.',
      '.kHdkSSSSSkddk.',
      '.kHdkksssSkddk.',
      '.kHdktttttkddk.',
    ],
    frontDrape: ['..kdk.....kdk..', '..kdk.....kdk..', '..k.k.....k.k..'],
    back: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHHHHHHHHdk..',
      '.kHHHHHHHHHddk.',
      '.kHHHHHHHHHddk.',
      '.kHHHHHHHHHddk.',
      '.kHHHhHHHHdddk.',
      '.kHHHHHHHHdddk.',
      '.kHddddddHdddk.',
      '.kHddddddHdddk.',
    ],
    backDrape: ['.kHddddddHdddk.', '.kHddddddHdddk.', '..kdddddddddk..', '...kkkkkkkkk...'],
    side: [
      '....kkkkkk.....',
      '...kHhhHHdk....',
      '..kHhHHHHHdk...',
      '.kHHHHHHHHdSk..',
      '.kHHHHHHddSSO..',
      '.kHHHHHddSbbO..',
      '.kHHHHHddSEWO..',
      '.kHHHHHddSEWO..',
      '.kHHHHHddSSSO..',
      '.kHHHHHddssO...',
      '.kHHHHHddttO...',
    ],
    sideDrape: ['.kHHHHdd.......', '.kHHHdd........', '..kddk.........'],
  },
  bob: {
    front: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHdHSSSHddk..',
      '.kHdHSSSSSHddk.',
      '.kHdSbbSbbSddk.',
      '.kHdSWEsEWSddk.',
      '.kHdSWEsEWSddk.',
      '.kHdkSSSSSkddk.',
      '.kddkkssskkddk.',
      '..kk.ktttk.kk..',
    ],
    back: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHHHHHHHHdk..',
      '.kHHHHHHHHHddk.',
      '.kHHHHHHHHHddk.',
      '.kHHHHHHHHHddk.',
      '.kHddddddHdddk.',
      '.kddHddddHdddk.',
      '..kkkkkkkkkkk..',
      '....ktttttk....',
    ],
    side: [
      '....kkkkkk.....',
      '...kHhhHHdk....',
      '..kHhHHHHHdk...',
      '.kHHHHHHHHdSk..',
      '.kHHHHHHddSSO..',
      '.kHHHHHddSbbO..',
      '.kHHHHHddSEWO..',
      '.kHHHHHddSEWO..',
      '.kHHHHHddSSSO..',
      '.kdddddksssO...',
      '..kkkkkttttO...',
    ],
  },
  curly: {
    front: [
      '...kkkkkkkkk...',
      '..kHhhHHHhhdk..',
      '.kHhHHHHHHHhdk.',
      '.kHHdHSSSHdHdk.',
      '.kHdHSSSSSHddk.',
      '.kHdSbbSbbSddk.',
      '.kHdSWEsEWSddk.',
      '.kddSWEsEWSddk.',
      '..kdkSSSSSkdk..',
      '...kkssssskk...',
      '....ktttttk....',
    ],
    back: [
      '...kkkkkkkkk...',
      '..kHhhHHHhhdk..',
      '.kHhHHHHHHHhdk.',
      '.kHHHHHHHHHHdk.',
      '.kHHhHHHHhHHdk.',
      '.kHHHHHHHHHHdk.',
      '.kHHddHHddHHdk.',
      '.kHddddddddHdk.',
      '..kdddddddddk..',
      '...ksssssssk...',
      '....ktttttk....',
    ],
    side: [
      '...kkkkkkkk....',
      '..kHhhHHHdk....',
      '.kHhHHHHHHdk...',
      '.kHHHHHHHHdSk..',
      '.kHHhHHHddSSO..',
      '.kHHHHHddSbbO..',
      '.kHHddHddSEWO..',
      '.kHdddddkSEWO..',
      '..kdddkSSSSSO..',
      '...kkksssssO...',
      '....kttttttO...',
    ],
  },
  spiky: {
    front: [
      '...k.k.k.k.k...',
      '..kHkHkHkHkdk..',
      '..kHhHHHHHHdk..',
      '..kHddHHHdddk..',
      '..kddSSSSSddk..',
      '..kdSbbSbbSdk..',
      '..kSSWEsEWSSk..',
      '..kSSWEsEWSSk..',
      '...kSSSSSSSk...',
      '....ksssssk....',
      '....ktttttk....',
    ],
    back: [
      '...k.k.k.k.k...',
      '..kHkHkHkHkdk..',
      '..kHhHHHHHHdk..',
      '..kHHHHHHHHdk..',
      '..kHHHHHHHHdk..',
      '..kHHHHHHHddk..',
      '..kHdddddddk...',
      '...kdddddddk...',
      '....ksssssk....',
      '....ksssssk....',
      '....ktttttk....',
    ],
    side: [
      '...k.k.k.k.....',
      '..kHkHkHkHdk...',
      '..kHhHHHHHHdk..',
      '..kHHHHdddSk...',
      '..kHHHddSSSO...',
      '..kHHddSSbbO...',
      '..kHddSSSEWO...',
      '..kHddSSSEWO...',
      '...kddSSSSSO...',
      '....ksssssO....',
      '....ktttttO....',
    ],
  },
  ponytail: {
    front: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHddHHHdddk..',
      '..kddSSSSSddk..',
      '..kdSbbSbbSdk..',
      '..kSSWEsEWSSk..',
      '..kSSWEsEWSSk..',
      '...kSSSSSSSk...',
      '....ksssssk....',
      '....ktttttk....',
    ],
    back: [
      '....kkkkkkk....',
      '...kHhhHHHdk...',
      '..kHhHHHHHHdk..',
      '..kHHHHHHHHdk..',
      '..kHHkkkkHHdk..',
      '..kHkHhhHkHdk..',
      '..kdkHHHHdkdk..',
      '...kkHHHHkdk...',
      '....kHHHHk.....',
      '....kddddk.....',
      '....kttttk.....',
    ],
    side: [
      '....kkkkkk.....',
      '..kkHhhHHdk....',
      '.kHkkHHHHHdk...',
      '.kHHkHHHddSk...',
      'kHHdkHHddSSO...',
      'kHddkHddSbbO...',
      'kddk.kddSEWO...',
      '.kk..kddSEWO...',
      '.....kddSSSO...',
      '.....kssssO....',
      '.....kttttO....',
    ],
  },
  buns: {
    front: [
      '.kkk.kkkkk.kkk.',
      'kHhdkHhhHHkdHdk',
      'kHddkHHHHHkdddk',
      '.kkkHdHHHddkkk.',
      '..kddSSSSSddk..',
      '..kdSbbSbbSdk..',
      '..kSSWEsEWSSk..',
      '..kSSWEsEWSSk..',
      '...kSSSSSSSk...',
      '....ksssssk....',
      '....ktttttk....',
    ],
    back: [
      '.kkk.kkkkk.kkk.',
      'kHhdkHhhHHkdHdk',
      'kHddkHHHHHkdddk',
      '.kkkHHHHHHHkkk.',
      '..kHHHHHHHHdk..',
      '..kHHHHHHHddk..',
      '..kHdddddddk...',
      '...kdddddddk...',
      '....ksssssk....',
      '....ksssssk....',
      '....ktttttk....',
    ],
    side: [
      '..kkk.kkkk.....',
      '.kHhdkHhHHdk...',
      '.kHddkHHHHHdk..',
      '..kkkHHHdddSk..',
      '..kHHHddSSSO...',
      '..kHHddSSbbO...',
      '..kHddSSSEWO...',
      '..kHddSSSEWO...',
      '...kddSSSSSO...',
      '....ksssssO....',
      '....ktttttO....',
    ],
  },
  bald: {
    front: [
      '...............',
      '....OOOOOOO....',
      '...OSSSSSSsO...',
      '..OSSSSSSSSsO..',
      '..OSSSSSSSSsO..',
      '..OSbbSSbbSsO..',
      '..OSSWEsEWSSO..',
      '..OSSWEsEWSSO..',
      '...OSSSSSSsO...',
      '....OsssssO....',
      '....OttttTO....',
    ],
    back: [
      '...............',
      '....OOOOOOO....',
      '...OSSSSSSsO...',
      '..OSSSSSSSSsO..',
      '..OSSSSSSSSsO..',
      '..OSSSSSSSSsO..',
      '..OSSSSSSssO...',
      '...OSSSSssO....',
      '....OsssssO....',
      '....OsssssO....',
      '....OtttttO....',
    ],
    side: [
      '...............',
      '....OOOOOO.....',
      '...OSSSSSsO....',
      '..OSSSSSSSsO...',
      '..OSSSSSSSSO...',
      '..OSSSSSSbbO...',
      '..OSSSSSSEWO...',
      '..OSSSSSSEWO...',
      '...OSSSSSSSO...',
      '....OsssssO....',
      '....OttttTO....',
    ],
  },
};

function overlayRows(base: string[], overlay?: string[]): string[] {
  if (!overlay || overlay.length === 0) return base;
  return base.map((row, idx) => {
    const ov = overlay[idx];
    if (!ov) return row;
    let out = '';
    for (let c = 0; c < row.length; c++) {
      out += ov[c] && ov[c] !== '.' ? ov[c] : row[c];
    }
    return out;
  });
}

function composeAvatarGrid(
  hairStyle: HairStyle,
  view: 'front' | 'back' | 'side',
  walkStep: -1 | 0 | 1
): string[] {
  const hair = HAIR_SETS[hairStyle] ?? HAIR_SETS.short;
  if (view === 'back') {
    const torso = overlayRows(TORSO_BACK, hair.backDrape);
    const legs =
      walkStep === -1 ? LEGS_BACK_IDLE : walkStep === 0 ? LEGS_BACK_WALK_A : LEGS_BACK_WALK_B;
    return [...hair.back, ...torso, ...legs];
  }
  if (view === 'side') {
    const torso = overlayRows(TORSO_SIDE, hair.sideDrape);
    const legs =
      walkStep === -1 ? LEGS_SIDE_IDLE : walkStep === 0 ? LEGS_SIDE_WALK_A : LEGS_SIDE_WALK_B;
    return [...hair.side, ...torso, ...legs];
  }
  const torso = overlayRows(TORSO_FRONT, hair.frontDrape);
  const legs =
    walkStep === -1 ? LEGS_FRONT_IDLE : walkStep === 0 ? LEGS_FRONT_WALK_A : LEGS_FRONT_WALK_B;
  return [...hair.front, ...torso, ...legs];
}

function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  palette: Record<string, string>,
  p: number
): void {
  const rows = grid.length;
  const cols = grid[0].length;
  const x0 = Math.round((-cols * p) / 2);
  const y0 = Math.round(-rows * p);

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    for (let c = 0; c < cols; c++) {
      const col = palette[row[c]];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x0 + c * p, y0 + r * p, p, p);
      }
    }
  }
}

/**
 * Draws a warm, 4-directional Stardew-Valley-style 16-bit pixel-art avatar grounded on (x, y).
 * Supports Front ('down'), Behind ('up'), Side ('right'), and mirrored Side ('left') across 8 hairstyles.
 */
export function drawPixelAvatar(
  ctx: CanvasRenderingContext2D,
  player: Pick<
    PlayerState,
    'name' | 'skinTone' | 'shirtColor' | 'hairColor' | 'hairStyle' | 'facing' | 'lastActiveNoteAt'
  >,
  x: number,
  y: number,
  scale: number,
  walkPhase: number,
  isLocal: boolean,
  nowMs: number
): void {
  const p = Math.max(2, Math.round(5 * scale));
  const isWalking = walkPhase > 0.01;
  const walkStep: -1 | 0 | 1 = isWalking ? ((Math.floor(walkPhase / 1.8) % 2) as 0 | 1) : -1;
  const bob = isWalking ? (walkStep === 0 ? -Math.round(p * 0.4) : 0) : 0;

  const view: 'front' | 'back' | 'side' =
    player.facing === 'up'
      ? 'back'
      : player.facing === 'left' || player.facing === 'right'
      ? 'side'
      : 'front';
  const mirrorX = player.facing === 'left' ? -1 : 1;

  const palette = buildStardewPalette(
    player.skinTone,
    player.shirtColor,
    player.hairColor || '#5a3222'
  );

  const grid = composeAvatarGrid(player.hairStyle || 'short', view, walkStep);

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  // Form-fitting stepped pixel-art contact shadow under sneakers
  const shHalf = view === 'side' ? 4 : 5;
  ctx.fillStyle = 'rgba(24, 10, 3, 0.34)';
  ctx.fillRect(-p * shHalf, -p, p * shHalf * 2, p * 2);
  ctx.fillStyle = 'rgba(24, 10, 3, 0.18)';
  ctx.fillRect(-p * (shHalf + 1), -Math.round(p * 0.6), p * (shHalf + 1) * 2, Math.round(p * 1.4));

  ctx.save();
  ctx.translate(0, bob);
  ctx.scale(mirrorX, 1);

  drawPixelGrid(ctx, grid, palette, p);

  // Floating musical note sparkle when recently playing
  if (player.lastActiveNoteAt && nowMs - player.lastActiveNoteAt < 750) {
    const age = (nowMs - player.lastActiveNoteAt) / 750;
    ctx.scale(mirrorX, 1);
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(p * 5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('♪', mirrorX * p * 5, -p * 23 - age * p * 6);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Name badge
  if (player.name) {
    ctx.font = `600 ${Math.max(11, Math.round(12 * scale))}px system-ui, -apple-system, sans-serif`;
    const metrics = ctx.measureText(player.name);
    const padX = 7;
    const badgeW = metrics.width + padX * 2;
    const badgeH = 19;
    const badgeY = -p * 25.5 + bob;

    ctx.fillStyle = isLocal ? 'rgba(92, 44, 22, 0.9)' : 'rgba(35, 18, 9, 0.84)';
    ctx.strokeStyle = isLocal ? '#e09f3e' : 'rgba(250, 237, 205, 0.35)';
    ctx.lineWidth = 1.25;
    roundRect(ctx, -badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#faedcd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.name, 0, badgeY + 0.5);
  }

  ctx.restore();
}

const PRU_PALETTE: Record<string, string> = {
  O: '#1c1410',
  K: '#1a1614',
  D: '#342e2a',
  W: '#f7f4ee',
  S: '#dad5cd',
  G: '#b0aba5',
  T: '#c26222',
  L: '#de823a',
  E: '#783412',
  B: '#381a0c',
};

const PRU_IDLE_A = [
  '...............OOO....',
  '..............OEKTO...',
  '.............OEBKTLO..',
  'OO..........OEBKTLTLO.',
  'WWOOO..OOOOOOKKBTLLWKO',
  'OWKKKOOOWGWWKKDWKTTWOO',
  '.OOOOWWWWGWKKKKDWKOO..',
  '.....OWSWWWKKKKWWWO...',
  '.....OWW.OOTKOO.OWO...',
  '.....OWO.OS.....OWO...',
  '.....OWO.OO.....OWO...',
  '.....OO..........OO...',
];

const PRU_IDLE_B = [
  '...............OOO....',
  '..............OEKTO...',
  'O............OEBKTLO..',
  'WOO.........OEBKTLTLO.',
  'OWKKO..OOOOOOKKBTLLWKO',
  '.OOOKOOOWGWWKKDWKTTWOO',
  '.....WWWWGWKKKKDWKOO..',
  '.....OWSWWWKKKKWWWO...',
  '.....OWW.OOTKOO.OWO...',
  '.....OWO.OS.....OWO...',
  '.....OWO.OO.....OWO...',
  '.....OO..........OO...',
];

const PRU_WALK_A = [
  '...............OOO....',
  'O.............OEKTO...',
  'WO...........OEBKTLO..',
  'OWKOO.......OEBKTLTLO.',
  '.OOKKO.OOOOOOKKBTLLWKO',
  '...OOKKOWGWWKKDWKTTWOO',
  '.....OWWWGWKKKKDWKOO..',
  '.....OWSWWWKKKKWWWO...',
  '....OWWO.OOTKOO..OWO..',
  '...OWO....OS......OWO.',
  '...OO.....OO.......OO.',
  '......................',
];

const PRU_SLEEP = [
  '....OOOOOOOO.....',
  '..OOWWGWKKKKOO...',
  '.OWWGGWWKKKKWKO..',
  'OWSWWWWKKKKWETLO.',
  'OWWKKKKKWWWKBTLO.',
  '.OOWWKKKKWWWKOO..',
  '..OOOWWWKKKWOO...',
  '.....OOOOOOO.....',
];

export function drawPru(
  ctx: CanvasRenderingContext2D,
  pru: PetState,
  x: number,
  y: number,
  scale: number,
  nowMs: number
): void {
  const p = Math.max(2, Math.round(3 * scale));
  const dir = pru.facing === 'left' ? -1 : 1;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  if (pru.behavior === 'sleep') {
    ctx.fillStyle = 'rgba(24, 10, 3, 0.34)';
    ctx.fillRect(-p * 8, -p * 1, p * 16, p * 2);
  } else {
    ctx.fillStyle = 'rgba(24, 10, 3, 0.32)';
    ctx.fillRect(dir > 0 ? -p * 6 : -p * 8, -p * 1, p * 14, p * 2);
  }

  ctx.save();
  ctx.scale(dir, 1);

  if (pru.behavior === 'sleep') {
    drawPixelGrid(ctx, PRU_SLEEP, PRU_PALETTE, p);
  } else if (pru.behavior === 'walk') {
    const frame = Math.floor(nowMs / 160) % 2;
    const bounce = frame === 0 ? -p * 0.5 : 0;
    ctx.translate(0, Math.round(bounce));
    drawPixelGrid(ctx, frame === 0 ? PRU_WALK_A : PRU_IDLE_B, PRU_PALETTE, p);
  } else {
    const wagFrame = Math.floor(nowMs / 420) % 2;
    drawPixelGrid(ctx, wagFrame === 0 ? PRU_IDLE_A : PRU_IDLE_B, PRU_PALETTE, p);
  }

  ctx.restore();

  if (pru.behavior === 'sleep') {
    const drift = (nowMs % 2400) / 2400;
    ctx.globalAlpha = 0.85 - drift * 0.7;
    ctx.fillStyle = '#faedcd';
    ctx.font = `bold ${Math.round(p * 3.8)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('z', p * 4 * dir, -p * 8 - drift * p * 5);
    ctx.globalAlpha = 1;
  }

  ctx.font = `600 ${Math.max(10, Math.round(10.5 * scale))}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(250, 237, 205, 0.8)';
  ctx.textAlign = 'center';
  ctx.fillText(pru.name, 0, p * 4);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
