import { ASSET_MAP, ROOM_LOGICAL_HEIGHT, ROOM_LOGICAL_WIDTH } from '../assets/assetManifest';
import { RoomItem, TimeOfDay } from '../types';

/** Exact bulb centers of the two built-in wall sconces in `background.png` (measured from pixels). */
const WALL_SCONCES = [
  { x: 0.2244, y: 0.2216 },
  { x: 0.7739, y: 0.2214 },
] as const;

/** Bounding box covering both back-wall windows in `background_window_mask.png`. */
const WIN_X = Math.floor(0.28 * ROOM_LOGICAL_WIDTH);
const WIN_Y = Math.floor(0.06 * ROOM_LOGICAL_HEIGHT);
const WIN_W = Math.ceil(0.44 * ROOM_LOGICAL_WIDTH);
const WIN_H = Math.ceil(0.37 * ROOM_LOGICAL_HEIGHT);

/** Deterministic twinkling stars inside the window region (snapped to 4px pixel blocks). */
const STARS: Array<{ x: number; y: number; size: number; phase: number; speed: number }> = (() => {
  const stars: Array<{ x: number; y: number; size: number; phase: number; speed: number }> = [];
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 95; i++) {
    const x = WIN_X + Math.floor((rand() * WIN_W) / 4) * 4;
    const y = WIN_Y + Math.floor((rand() * (WIN_H * 0.78)) / 4) * 4;
    const size = rand() > 0.78 ? 4 : 3;
    stars.push({
      x,
      y,
      size,
      phase: rand() * Math.PI * 2,
      speed: 0.0018 + rand() * 0.0028,
    });
  }
  return stars;
})();

/** Pixel-art cloud sprites (in 4px block coordinates) that drift calmly across the sky. */
const CLOUDS = [
  { baseX: 0.08, y: 0.14, speed: 3.2, w: 15, h: 4 },
  { baseX: 0.36, y: 0.19, speed: 2.3, w: 12, h: 3 },
  { baseX: 0.65, y: 0.12, speed: 3.6, w: 18, h: 4 },
  { baseX: 0.88, y: 0.23, speed: 2.6, w: 11, h: 3 },
] as const;

interface LightingPreset {
  /** Sky vertical color stops (top, mid, horizon) */
  skyTop: [number, number, number];
  skyMid: [number, number, number];
  skyHorizon: [number, number, number];
  /** Distant hills color */
  hillFar: [number, number, number];
  hillNear: [number, number, number];
  /** Composite ambient tint over the whole room (RGBA) */
  ambientTint: [number, number, number, number];
  /** Slight darkening veil over baked-in bright sunlit floor patches at sunset/night */
  floorSunDampen: number;
  /** Warm radial glow intensity for wall sconces & placed Floor Lamps (0..1) */
  lampGlow: number;
  /** Star & moon visibility (0..1) */
  nightSky: number;
  /** Sun disc visibility & vertical fraction in window (0 = top, 1 = bottom) */
  sunAlpha: number;
  sunNormY: number;
  sunColor: [number, number, number];
  /** Cloud tint */
  cloudColor: [number, number, number, number];
}

const PRESETS: Record<TimeOfDay, LightingPreset> = {
  morning: {
    skyTop: [122, 178, 224],
    skyMid: [212, 206, 222],
    skyHorizon: [255, 212, 170],
    hillFar: [118, 134, 152],
    hillNear: [84, 108, 96],
    ambientTint: [255, 226, 202, 0.07],
    floorSunDampen: 0.08,
    lampGlow: 0.12,
    nightSky: 0,
    sunAlpha: 0.9,
    sunNormY: 0.62,
    sunColor: [255, 236, 185],
    cloudColor: [255, 240, 230, 0.72],
  },
  day: {
    skyTop: [96, 174, 236],
    skyMid: [164, 218, 250],
    skyHorizon: [248, 240, 194],
    hillFar: [94, 146, 128],
    hillNear: [72, 124, 78],
    ambientTint: [255, 245, 220, 0],
    floorSunDampen: 0,
    lampGlow: 0,
    nightSky: 0,
    sunAlpha: 0.85,
    sunNormY: 0.28,
    sunColor: [255, 248, 198],
    cloudColor: [255, 252, 244, 0.85],
  },
  sunset: {
    skyTop: [72, 48, 104],
    skyMid: [198, 96, 94],
    skyHorizon: [255, 172, 74],
    hillFar: [78, 42, 68],
    hillNear: [52, 28, 42],
    ambientTint: [188, 86, 42, 0.22],
    floorSunDampen: 0.18,
    lampGlow: 0.58,
    nightSky: 0.2,
    sunAlpha: 0.95,
    sunNormY: 0.72,
    sunColor: [255, 196, 96],
    cloudColor: [255, 184, 128, 0.65],
  },
  night: {
    skyTop: [12, 18, 46],
    skyMid: [22, 34, 76],
    skyHorizon: [38, 54, 102],
    hillFar: [18, 24, 52],
    hillNear: [12, 16, 36],
    ambientTint: [16, 26, 68, 0.52],
    floorSunDampen: 0.42,
    lampGlow: 1.0,
    nightSky: 1.0,
    sunAlpha: 0,
    sunNormY: 0.95,
    sunColor: [255, 180, 90],
    cloudColor: [70, 88, 138, 0.22],
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgbStr(c: [number, number, number], alpha = 1): string {
  const r = Math.round(c[0]);
  const g = Math.round(c[1]);
  const b = Math.round(c[2]);
  return alpha >= 0.999 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/**
 * Smoothly blends between TimeOfDay presets so atmosphere shifts feel calm and organic.
 */
export class AtmosphereState {
  private current: LightingPreset = clonePreset(PRESETS.day);

  public update(targetTime: TimeOfDay, dt: number): void {
    const target = PRESETS[targetTime];
    const t = Math.min(1, dt * 3.8);

    this.current.skyTop = lerpRgb(this.current.skyTop, target.skyTop, t);
    this.current.skyMid = lerpRgb(this.current.skyMid, target.skyMid, t);
    this.current.skyHorizon = lerpRgb(this.current.skyHorizon, target.skyHorizon, t);
    this.current.hillFar = lerpRgb(this.current.hillFar, target.hillFar, t);
    this.current.hillNear = lerpRgb(this.current.hillNear, target.hillNear, t);
    this.current.ambientTint = [
      lerp(this.current.ambientTint[0], target.ambientTint[0], t),
      lerp(this.current.ambientTint[1], target.ambientTint[1], t),
      lerp(this.current.ambientTint[2], target.ambientTint[2], t),
      lerp(this.current.ambientTint[3], target.ambientTint[3], t),
    ];
    this.current.floorSunDampen = lerp(this.current.floorSunDampen, target.floorSunDampen, t);
    this.current.lampGlow = lerp(this.current.lampGlow, target.lampGlow, t);
    this.current.nightSky = lerp(this.current.nightSky, target.nightSky, t);
    this.current.sunAlpha = lerp(this.current.sunAlpha, target.sunAlpha, t);
    this.current.sunNormY = lerp(this.current.sunNormY, target.sunNormY, t);
    this.current.sunColor = lerpRgb(this.current.sunColor, target.sunColor, t);
    this.current.cloudColor = [
      lerp(this.current.cloudColor[0], target.cloudColor[0], t),
      lerp(this.current.cloudColor[1], target.cloudColor[1], t),
      lerp(this.current.cloudColor[2], target.cloudColor[2], t),
      lerp(this.current.cloudColor[3], target.cloudColor[3], t),
    ];
  }

  /**
   * Renders the crisp pixel-art sky behind `background_window_mask.png`.
   */
  public drawSkyBehindWindows(ctx: CanvasRenderingContext2D, nowMs: number): void {
    const p = this.current;
    const block = 4; // Matches pixel-art block density of background.png

    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN_X, WIN_Y, WIN_W, WIN_H);
    ctx.clip();

    // 1. Banded pixel-art vertical sky gradient
    const bands = 14;
    const bandH = Math.ceil(WIN_H / bands / block) * block;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      const col =
        f < 0.52
          ? lerpRgb(p.skyTop, p.skyMid, f / 0.52)
          : lerpRgb(p.skyMid, p.skyHorizon, (f - 0.52) / 0.48);
      ctx.fillStyle = rgbStr(col);
      ctx.fillRect(WIN_X, WIN_Y + i * bandH, WIN_W, bandH + block);
    }

    // 2. Twinkling pixel stars & crescent moon (Sunset dusk & Night)
    if (p.nightSky > 0.02) {
      for (const s of STARS) {
        const twinkle = 0.55 + 0.45 * Math.sin(nowMs * s.speed + s.phase);
        ctx.fillStyle = `rgba(255, 248, 214, ${(p.nightSky * twinkle).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }

      // Pixel moon in upper-right window pane
      const mx = Math.round((0.638 * ROOM_LOGICAL_WIDTH) / block) * block;
      const my = Math.round((0.145 * ROOM_LOGICAL_HEIGHT) / block) * block;
      const moonR = 20;
      ctx.globalAlpha = p.nightSky;

      // Soft halo around moon
      const moonGlow = ctx.createRadialGradient(mx, my, 8, mx, my, 64);
      moonGlow.addColorStop(0, 'rgba(255, 248, 210, 0.35)');
      moonGlow.addColorStop(1, 'rgba(255, 248, 210, 0)');
      ctx.fillStyle = moonGlow;
      ctx.fillRect(mx - 64, my - 64, 128, 128);

      // Stepped pixel moon disc
      drawPixelDisc(ctx, mx, my, moonR, block, '#fff7cf');
      // Subtle crescent shadow bite
      drawPixelDisc(ctx, mx - block * 2, my - block, moonR - block, block, rgbStr(p.skyTop));
      ctx.globalAlpha = 1;
    }

    // 3. Glowing pixel sun (Morning / Day / Sunset)
    if (p.sunAlpha > 0.02) {
      const sx = Math.round((0.365 * ROOM_LOGICAL_WIDTH) / block) * block;
      const sy = Math.round((WIN_Y + WIN_H * p.sunNormY) / block) * block;
      ctx.globalAlpha = p.sunAlpha;

      const sunGlow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 95);
      sunGlow.addColorStop(0, rgbStr(p.sunColor, 0.55));
      sunGlow.addColorStop(1, rgbStr(p.sunColor, 0));
      ctx.fillStyle = sunGlow;
      ctx.fillRect(sx - 95, sy - 95, 190, 190);

      drawPixelDisc(ctx, sx, sy, 22, block, rgbStr(p.sunColor));
      ctx.globalAlpha = 1;
    }

    // 4. Slowly drifting pixel clouds
    if (p.cloudColor[3] > 0.04) {
      const tSec = nowMs / 1000;
      ctx.fillStyle = rgbStr([p.cloudColor[0], p.cloudColor[1], p.cloudColor[2]], p.cloudColor[3]);
      for (const cl of CLOUDS) {
        const rawX = (cl.baseX * WIN_W + tSec * cl.speed) % (WIN_W + cl.w * block * 2);
        const cx = WIN_X + Math.floor((rawX - cl.w * block) / block) * block;
        const cy = Math.floor((cl.y * ROOM_LOGICAL_HEIGHT) / block) * block;
        // Fluffy stepped pixel cloud silhouette
        ctx.fillRect(cx + block * 2, cy, (cl.w - 4) * block, block);
        ctx.fillRect(cx + block, cy + block, (cl.w - 2) * block, block);
        ctx.fillRect(cx, cy + block * 2, cl.w * block, block);
        if (cl.h > 3) {
          ctx.fillRect(cx + block * 2, cy + block * 3, (cl.w - 5) * block, block);
        }
      }
    }

    // 5. Distant pixel hills along bottom of window panes
    const hillBaseY = WIN_Y + WIN_H;
    drawPixelHills(ctx, WIN_X, WIN_W, hillBaseY, block, 42, 0.011, 0.5, rgbStr(p.hillFar));
    drawPixelHills(ctx, WIN_X, WIN_W, hillBaseY, block, 26, 0.017, 2.1, rgbStr(p.hillNear));

    ctx.restore();
  }

  /**
   * Softens the baked-in bright sunlit patches on the floorboards during Sunset/Night
   * (drawn right over the background room, underneath items/avatars).
   */
  public drawFloorLightAdjustment(ctx: CanvasRenderingContext2D): void {
    const p = this.current;
    if (p.floorSunDampen <= 0.01) return;

    const W = ROOM_LOGICAL_WIDTH;
    const H = ROOM_LOGICAL_HEIGHT;
    ctx.save();
    // Gently cool/darken the two sunlit wood patches on the floor at dusk/night
    const grad = ctx.createLinearGradient(0, H * 0.57, 0, H * 0.84);
    grad.addColorStop(0, `rgba(26, 22, 48, ${(p.floorSunDampen * 0.55).toFixed(3)})`);
    grad.addColorStop(0.65, `rgba(26, 22, 48, ${(p.floorSunDampen * 0.35).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(26, 22, 48, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(W * 0.16, H * 0.57, W * 0.68, H * 0.28);
    ctx.restore();
  }

  /**
   * Renders composite room lighting across ALL room entities (background, items, avatars, Pru)
   * PLUS warm radial glow pools around the two wall sconces and every placed Floor Lamp.
   */
  public drawCompositeLighting(
    ctx: CanvasRenderingContext2D,
    items: RoomItem[],
    nowMs: number
  ): void {
    const p = this.current;
    const W = ROOM_LOGICAL_WIDTH;
    const H = ROOM_LOGICAL_HEIGHT;

    // 1. Subtle composite ambient tint across the entire room
    if (p.ambientTint[3] > 0.008) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      // Multiply blends cleanly without washing out contrast; mix toward white by (1 - alpha)
      const a = p.ambientTint[3];
      const mr = Math.round(255 * (1 - a) + p.ambientTint[0] * a);
      const mg = Math.round(255 * (1 - a) + p.ambientTint[1] * a);
      const mb = Math.round(255 * (1 - a) + p.ambientTint[2] * a);
      ctx.fillStyle = `rgb(${mr},${mg},${mb})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // Gentle shadow fill for deeper cozy twilight mood at night
      if (p.nightSky > 0.2) {
        ctx.save();
        ctx.fillStyle = `rgba(10, 16, 42, ${(p.nightSky * 0.2).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // 2. Subtle cool moonlight wash spilling down from the windows at night
    if (p.nightSky > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const wx of [0.37, 0.63]) {
        const gx = wx * W;
        const gy = 0.63 * H;
        const moonPool = ctx.createRadialGradient(gx, gy, 10, gx, gy, 185);
        moonPool.addColorStop(0, `rgba(110, 148, 228, ${(p.nightSky * 0.13).toFixed(3)})`);
        moonPool.addColorStop(1, 'rgba(110, 148, 228, 0)');
        ctx.fillStyle = moonPool;
        ctx.fillRect(gx - 190, gy - 190, 380, 380);
      }
      ctx.restore();
    }

    // 3. Warm radial glow pools around the TWO wall sconces & placed Floor Lamps (Sunset / Night)
    if (p.lampGlow > 0.02) {
      const shimmer = 1 + Math.sin(nowMs * 0.0045) * 0.03 + Math.sin(nowMs * 0.011) * 0.015;
      const glowStrength = p.lampGlow * shimmer;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Built-in wall sconces
      for (const sc of WALL_SCONCES) {
        const sx = sc.x * W;
        const sy = sc.y * H;
        drawWarmLightPool(ctx, sx, sy, 175 * (0.85 + 0.2 * p.lampGlow), glowStrength * 0.68);
        drawWarmLightPool(ctx, sx, sy, 52, glowStrength * 0.55);
      }

      // Every placed Floor Lamp (`assetId === 'lamp'`) lights up the room!
      for (const item of items) {
        if (item.assetId !== 'lamp') continue;
        const def = ASSET_MAP[item.assetId];
        const drawH = H * (def?.heightFraction ?? 0.195);
        const lx = item.x * W;
        const shadeY = item.y * H - drawH * 0.82;
        const floorY = item.y * H - drawH * 0.05;

        // Bright warm glow radiating from the lampshade
        drawWarmLightPool(ctx, lx, shadeY, 195 * (0.85 + 0.2 * p.lampGlow), glowStrength * 0.72);
        drawWarmLightPool(ctx, lx, shadeY, 56, glowStrength * 0.55);

        // Cozy golden pool cast onto the floorboards around the lamp's base
        ctx.save();
        ctx.translate(lx, floorY);
        ctx.scale(1.5, 0.58);
        drawWarmLightPool(ctx, 0, 0, 95, glowStrength * 0.36);
        ctx.restore();
      }

      ctx.restore();
    }
  }
}

function drawWarmLightPool(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number
): void {
  const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);
  grad.addColorStop(0, `rgba(255, 224, 140, ${Math.min(0.95, alpha).toFixed(3)})`);
  grad.addColorStop(0.35, `rgba(255, 176, 78, ${(alpha * 0.55).toFixed(3)})`);
  grad.addColorStop(0.7, `rgba(235, 126, 42, ${(alpha * 0.18).toFixed(3)})`);
  grad.addColorStop(1, 'rgba(235, 126, 42, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPixelDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  block: number,
  color: string
): void {
  ctx.fillStyle = color;
  for (let dy = -radius; dy <= radius; dy += block) {
    for (let dx = -radius; dx <= radius; dx += block) {
      if (dx * dx + dy * dy <= radius * radius) {
        ctx.fillRect(cx + dx, cy + dy, block, block);
      }
    }
  }
}

function drawPixelHills(
  ctx: CanvasRenderingContext2D,
  startX: number,
  width: number,
  baseY: number,
  block: number,
  maxH: number,
  freq: number,
  phase: number,
  color: string
): void {
  ctx.fillStyle = color;
  for (let x = startX; x < startX + width; x += block) {
    const wave =
      Math.sin((x - startX) * freq + phase) * 0.55 +
      Math.sin((x - startX) * freq * 0.45 + phase * 1.7) * 0.45;
    const h = Math.max(block * 2, Math.round(((wave * 0.5 + 0.5) * maxH) / block) * block);
    ctx.fillRect(x, baseY - h, block, h);
  }
}

function clonePreset(p: LightingPreset): LightingPreset {
  return {
    ...p,
    skyTop: [...p.skyTop],
    skyMid: [...p.skyMid],
    skyHorizon: [...p.skyHorizon],
    hillFar: [...p.hillFar],
    hillNear: [...p.hillNear],
    ambientTint: [...p.ambientTint],
    sunColor: [...p.sunColor],
    cloudColor: [...p.cloudColor],
  };
}
