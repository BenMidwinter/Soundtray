import React, { useEffect, useRef, useState } from 'react';
import { FlipHorizontal2, Trash2 } from 'lucide-react';
import {
  ASSET_MAP,
  clampToFloor,
  FLOOR_POLYGON_NORM,
  ROOM_LOGICAL_HEIGHT,
  ROOM_LOGICAL_WIDTH,
} from '../assets/assetManifest';
import { assetLoader } from '../services/AssetLoader';
import { AtmosphereState } from '../services/AtmosphereRenderer';
import { drawPixelAvatar, drawPru } from '../services/SpriteRenderer';
import { FacingDirection, PetState, PlayerState, RoomItem, TimeOfDay, Vector2 } from '../types';

function isFlippableAsset(assetId: string): boolean {
  const def = ASSET_MAP[assetId];
  return def?.variantGroup === 'sofa' || def?.variantGroup === 'beanbag';
}

interface GameCanvasProps {
  localPlayerId: string;
  players: Record<string, PlayerState>;
  items: RoomItem[];
  pet: PetState;
  timeOfDay: TimeOfDay;
  pruHeartAt?: number;
  buildMode: boolean;
  selectedAssetId: string | null;
  placeFlipped: boolean;
  activeInstrumentId: string | null;
  isModalOpen: boolean;
  onUpdateLocalPlayer: (player: PlayerState) => void;
  onUpdatePet: (pet: PetState) => void;
  onPlaceItem: (assetId: string, x: number, y: number, flipped?: boolean) => void;
  onMoveItem: (itemId: string, x: number, y: number) => void;
  onFinishMoveItem: (itemId: string) => void;
  onFlipItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onOpenInstrument: (itemId: string) => void;
  onOpenGame: (gameAssetId: 'connect4' | 'tictactoe' | 'soundmemory') => void;
  onInteractPru: () => void;
  onClearSelectedAsset: () => void;
  onToast: (message: string) => void;
}

interface Drawable {
  y: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [selectedFlippableItemId, setSelectedFlippableItemId] = useState<string | null>(null);
  const selectedFlippableRef = useRef<string | null>(null);
  useEffect(() => {
    selectedFlippableRef.current = selectedFlippableItemId;
  }, [selectedFlippableItemId]);

  // Clear placed selection when leaving Build Mode or picking a new Toy Box asset
  useEffect(() => {
    if (!props.buildMode || props.selectedAssetId) {
      setSelectedFlippableItemId(null);
    }
  }, [props.buildMode, props.selectedAssetId]);

  // Clear selection if item was deleted
  useEffect(() => {
    if (
      selectedFlippableItemId &&
      !props.items.some((i) => i.id === selectedFlippableItemId)
    ) {
      setSelectedFlippableItemId(null);
    }
  }, [props.items, selectedFlippableItemId]);

  // Mutable real-time simulation refs (decoupled from React render cycle for smooth 60fps)
  const localPosRef = useRef<Vector2>({ x: 0.5, y: 0.82 });
  const localTargetRef = useRef<Vector2>({ x: 0.5, y: 0.82 });
  const localFacingRef = useRef<FacingDirection>('down');
  const walkPhaseRef = useRef(0);
  const keysHeldRef = useRef<Set<string>>(new Set());
  const remoteInterpRef = useRef<Record<string, { x: number; y: number; walkPhase: number }>>({});
  const atmosphereRef = useRef<AtmosphereState>(new AtmosphereState());

  // Hover & drag refs
  const pointerNormRef = useRef<Vector2 | null>(null);
  const dragRef = useRef<{
    itemId: string | null;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    overTrash: boolean;
  }>({ itemId: null, offsetX: 0, offsetY: 0, startX: 0, startY: 0, overTrash: false });

  // Pru — the room's 8kg tri-color Jack Russell mix
  const pruRef = useRef<PetState>({
    name: 'Pru',
    x: 0.54,
    y: 0.76,
    targetX: 0.54,
    targetY: 0.76,
    facing: 'right',
    behavior: 'idle',
    stateEndsAt: performance.now() + 3500,
  });

  // Synced Pru state: update local target/behavior whenever remote keeper publishes a new pet command
  const lastPetUpdatedAtRef = useRef<number>(0);
  useEffect(() => {
    const incoming = props.pet;
    if (incoming.updatedAt && incoming.updatedAt !== lastPetUpdatedAtRef.current) {
      lastPetUpdatedAtRef.current = incoming.updatedAt;
      pruRef.current = {
        ...pruRef.current,
        targetX: incoming.targetX,
        targetY: incoming.targetY,
        facing: incoming.facing,
        behavior: incoming.behavior,
        stateDurationMs: incoming.stateDurationMs,
        updatedAt: incoming.updatedAt,
        stateEndsAt: performance.now() + (incoming.stateDurationMs ?? 4500),
      };
      // If very far (e.g. just joined room), snap to synced coordinates
      if (Math.hypot(pruRef.current.x - incoming.x, pruRef.current.y - incoming.y) > 0.25) {
        pruRef.current.x = incoming.x;
        pruRef.current.y = incoming.y;
      }
    }
  }, [props.pet]);

  // Sync initial local player position once when joining
  const initializedPlayerIdRef = useRef<string>('');
  useEffect(() => {
    const me = props.players[props.localPlayerId];
    if (me && initializedPlayerIdRef.current !== props.localPlayerId) {
      initializedPlayerIdRef.current = props.localPlayerId;
      localPosRef.current = { x: me.x, y: me.y };
      localTargetRef.current = { x: me.x, y: me.y };
      localFacingRef.current = me.facing;
    }
  }, [props.localPlayerId, props.players]);

  const isPlayInteractable = (assetId: string): boolean => {
    const def = ASSET_MAP[assetId];
    return Boolean(def && (def.category === 'instrument' || def.category === 'game'));
  };

  const getNearestInteractable = (pos: Vector2, items: RoomItem[]): RoomItem | null => {
    let best: RoomItem | null = null;
    let bestDist = Infinity;
    for (const item of items) {
      if (!isPlayInteractable(item.assetId)) continue;
      const def = ASSET_MAP[item.assetId];
      const radius = def?.interactRadius ?? 0.095;
      const dx = pos.x - item.x;
      const dy = (pos.y - item.y) * 1.45;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius && dist < bestDist) {
        best = item;
        bestDist = dist;
      }
    }
    return best;
  };

  const isItemInUseByAnyPlayer = (item: RoomItem): boolean => {
    const def = ASSET_MAP[item.assetId];
    if (!def || def.category !== 'instrument') return false;
    const radius = def.interactRadius ?? 0.095;
    const { players, localPlayerId } = propsRef.current;

    for (const p of Object.values(players)) {
      const px = p.id === localPlayerId ? localPosRef.current.x : p.x;
      const py = p.id === localPlayerId ? localPosRef.current.y : p.y;
      const dist = Math.hypot(px - item.x, (py - item.y) * 1.45);
      if (dist <= radius || p.activeInstrumentId === item.id) {
        return true;
      }
    }
    return false;
  };

  // Keyboard movement (WASD / Arrows) + Space/E interact (instruments & Connect 4)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const {
        activeInstrumentId,
        isModalOpen,
        buildMode,
        items,
        onOpenInstrument,
        onOpenGame,
      } = propsRef.current;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (activeInstrumentId || isModalOpen) return;

      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysHeldRef.current.add(k);
        return;
      }

      if ((e.code === 'Space' || k === 'e') && !buildMode && !e.repeat) {
        const nearest = getNearestInteractable(localPosRef.current, items);
        if (nearest) {
          e.preventDefault();
          const def = ASSET_MAP[nearest.assetId];
          if (def?.category === 'game') {
            onOpenGame(nearest.assetId as 'connect4' | 'tictactoe' | 'soundmemory');
          } else {
            onOpenInstrument(nearest.id);
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      keysHeldRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Main 60FPS Game Loop (never restarted on React prop changes)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const {
        localPlayerId,
        players,
        items,
        timeOfDay,
        pruHeartAt,
        buildMode,
        selectedAssetId,
        placeFlipped,
        activeInstrumentId,
        isModalOpen,
        onUpdateLocalPlayer,
      } = propsRef.current;

      // Smoothly transition Time of Day lighting
      atmosphereRef.current.update(timeOfDay, dt);

      // 1. Update Local Player Movement
      const me = players[localPlayerId];
      if (me && !activeInstrumentId && !isModalOpen) {
        const keys = keysHeldRef.current;
        let moveX = 0;
        let moveY = 0;
        if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
        if (keys.has('d') || keys.has('arrowright')) moveX += 1;
        if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
        if (keys.has('s') || keys.has('arrowdown')) moveY += 1;

        let moved = false;
        const speedX = 0.24;
        const speedY = 0.21;

        if (moveX !== 0 || moveY !== 0) {
          const len = Math.hypot(moveX, moveY);
          const nx = localPosRef.current.x + (moveX / len) * speedX * dt;
          const ny = localPosRef.current.y + (moveY / len) * speedY * dt;
          const clamped = clampToFloor(nx, ny);
          localPosRef.current = clamped;
          localTargetRef.current = clamped;
          if (moveX !== 0) {
            localFacingRef.current = moveX < 0 ? 'left' : 'right';
          } else if (moveY < 0) {
            localFacingRef.current = 'up';
          } else {
            localFacingRef.current = 'down';
          }
          walkPhaseRef.current += dt * 11;
          moved = true;
        } else {
          const dx = localTargetRef.current.x - localPosRef.current.x;
          const dy = localTargetRef.current.y - localPosRef.current.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.003) {
            const stepDist = Math.min(dist, 0.26 * dt);
            const nx = localPosRef.current.x + (dx / dist) * stepDist;
            const ny = localPosRef.current.y + (dy / dist) * stepDist;
            localPosRef.current = clampToFloor(nx, ny);
            // Weight Y slightly higher since canvas is 2:1 wide so walking up/down naturally shows Back/Front view
            if (Math.abs(dy) * 1.4 > Math.abs(dx)) {
              localFacingRef.current = dy < 0 ? 'up' : 'down';
            } else if (Math.abs(dx) > 0.002) {
              localFacingRef.current = dx < 0 ? 'left' : 'right';
            }
            walkPhaseRef.current += dt * 11;
            moved = true;
          } else {
            walkPhaseRef.current = 0;
          }
        }

        if (moved) {
          onUpdateLocalPlayer({
            ...me,
            x: localPosRef.current.x,
            y: localPosRef.current.y,
            targetX: localTargetRef.current.x,
            targetY: localTargetRef.current.y,
            facing: localFacingRef.current,
          });
        }
      }

      // 2. Smoothly interpolate remote players
      for (const p of Object.values(players)) {
        if (p.id === localPlayerId) continue;
        const prev = remoteInterpRef.current[p.id] ?? { x: p.x, y: p.y, walkPhase: 0 };
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          prev.x += dx * Math.min(1, dt * 12);
          prev.y += dy * Math.min(1, dt * 12);
          prev.walkPhase += dt * 10;
        } else {
          prev.walkPhase = 0;
        }
        remoteInterpRef.current[p.id] = prev;
      }

      // 3. Update Pru AI (designated keeper publishes wandering transitions; all peers smoothly walk her)
      const sortedIds = Object.keys(players).sort();
      const isPruKeeper = sortedIds.length === 0 || sortedIds[0] === localPlayerId;
      updatePru(pruRef.current, dt, now, isPruKeeper);

      // 4. Render Scene
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        renderScene(ctx, now, {
          localPlayerId,
          players,
          items,
          pruHeartAt,
          buildMode,
          selectedAssetId,
          placeFlipped,
          activeInstrumentId,
          isModalOpen,
        });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const updatePru = (pru: PetState, dt: number, now: number, isKeeper: boolean) => {
    if (pru.behavior === 'walk') {
      const dx = pru.targetX - pru.x;
      const dy = pru.targetY - pru.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.006) {
        pru.x = pru.targetX;
        pru.y = pru.targetY;
        if (isKeeper) {
          const nextBehavior = Math.random() < 0.45 ? 'sleep' : 'idle';
          const dur =
            nextBehavior === 'sleep'
              ? 9000 + Math.random() * 6000
              : 3500 + Math.random() * 3500;
          pru.behavior = nextBehavior;
          pru.stateDurationMs = dur;
          pru.stateEndsAt = now + dur;
          pru.updatedAt = Date.now();
          lastPetUpdatedAtRef.current = pru.updatedAt;
          propsRef.current.onUpdatePet({ ...pru });
        } else {
          pru.behavior = 'idle';
        }
      } else {
        const speed = 0.075 * dt;
        const next = clampToFloor(pru.x + (dx / dist) * speed, pru.y + (dy / dist) * speed, 0.05);
        pru.x = next.x;
        pru.y = next.y;
        pru.facing = dx < 0 ? 'left' : 'right';
      }
    } else if (isKeeper && now >= pru.stateEndsAt) {
      if (Math.random() < 0.65) {
        const randY = 0.65 + Math.random() * 0.27;
        const randX = 0.24 + Math.random() * 0.52;
        const clamped = clampToFloor(randX, randY, 0.06);
        pru.targetX = clamped.x;
        pru.targetY = clamped.y;
        pru.facing = clamped.x < pru.x ? 'left' : 'right';
        pru.behavior = 'walk';
        pru.stateDurationMs = 6000;
        pru.stateEndsAt = now + 6000;
      } else {
        const dur = 5000 + Math.random() * 5000;
        pru.behavior = pru.behavior === 'sleep' ? 'idle' : 'sleep';
        pru.stateDurationMs = dur;
        pru.stateEndsAt = now + dur;
      }
      pru.updatedAt = Date.now();
      lastPetUpdatedAtRef.current = pru.updatedAt;
      propsRef.current.onUpdatePet({ ...pru });
    }
  };

  const renderScene = (
    ctx: CanvasRenderingContext2D,
    now: number,
    state: {
      localPlayerId: string;
      players: Record<string, PlayerState>;
      items: RoomItem[];
      pruHeartAt?: number;
      buildMode: boolean;
      selectedAssetId: string | null;
      placeFlipped: boolean;
      activeInstrumentId: string | null;
      isModalOpen: boolean;
    }
  ) => {
    const W = ROOM_LOGICAL_WIDTH;
    const H = ROOM_LOGICAL_HEIGHT;

    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    // A. Live Pixel-Art Sky behind the Window Cutout Mask
    const windowMaskImg = assetLoader.get('background_window_mask');
    const bgImg = assetLoader.get('background');

    if (windowMaskImg) {
      atmosphereRef.current.drawSkyBehindWindows(ctx, now);
      ctx.drawImage(windowMaskImg, 0, 0, W, H);
      atmosphereRef.current.drawFloorLightAdjustment(ctx);
    } else if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#3b1d0e';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7c4a2d';
      ctx.beginPath();
      FLOOR_POLYGON_NORM.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x * W, pt.y * H);
        else ctx.lineTo(pt.x * W, pt.y * H);
      });
      ctx.closePath();
      ctx.fill();
    }

    // B. Subtle floor boundary guide in Build Mode
    if (state.buildMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(224, 159, 62, 0.48)';
      ctx.fillStyle = 'rgba(224, 159, 62, 0.06)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      FLOOR_POLYGON_NORM.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x * W, pt.y * H);
        else ctx.lineTo(pt.x * W, pt.y * H);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // C. Compute single nearest playable instrument or Connect 4 for Play Mode highlight
    const nearestInteractable =
      !state.buildMode && !state.activeInstrumentId && !state.isModalOpen
        ? getNearestInteractable(localPosRef.current, state.items)
        : null;

    // D. Click-to-move target marker on floor
    if (!state.buildMode) {
      const distToTarget = Math.hypot(
        localTargetRef.current.x - localPosRef.current.x,
        localTargetRef.current.y - localPosRef.current.y
      );
      if (distToTarget > 0.015) {
        const tx = localTargetRef.current.x * W;
        const ty = localTargetRef.current.y * H;
        const pulse = 1 + Math.sin(now * 0.01) * 0.15;
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 237, 205, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(tx, ty, 12 * pulse, 5 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // E. Collect all depth-sorted drawables (items + players + Pru)
    const drawables: Drawable[] = [];
    let promptToDraw: { px: number; topY: number; label: string } | null = null;

    for (const item of state.items) {
      const def = ASSET_MAP[item.assetId];
      if (!def) continue;
      const isHighlighted = nearestInteractable?.id === item.id;
      const isDragged = dragRef.current.itemId === item.id;
      const isSelectedFlippable = state.buildMode && selectedFlippableRef.current === item.id;
      const shouldFlip = Boolean(item.flipped) && isFlippableAsset(item.assetId);

      drawables.push({
        y: item.y,
        draw: (c) => {
          const px = item.x * W;
          const py = item.y * H;
          const targetH = H * def.heightFraction;
          const img = assetLoader.get(def.id);

          c.save();
          if (isDragged) {
            c.globalAlpha = dragRef.current.overTrash ? 0.45 : 0.85;
          }

          const aspect = img ? img.naturalWidth / img.naturalHeight : 1;
          const drawW = targetH * aspect;
          const drawH = targetH;

          // Mirror horizontally around item center when flipped (Sofas & Beanbags only)
          if (shouldFlip) {
            c.translate(px, 0);
            c.scale(-1, 1);
            c.translate(-px, 0);
          }

          // Custom form-fitting silhouette contact shadow (zero basic circles!)
          const shadowImg = assetLoader.getShadow(def.id);
          if (img && shadowImg) {
            const imgScale = drawH / img.naturalHeight;
            const padX = Math.max(12, Math.floor(img.naturalWidth * 0.08));
            const padTop = Math.max(8, Math.floor(img.naturalHeight * 0.04));
            const shW = shadowImg.naturalWidth * imgScale;
            const shH = shadowImg.naturalHeight * imgScale;
            const shX = px - drawW / 2 - padX * imgScale;
            const shY = py - drawH - padTop * imgScale;
            c.imageSmoothingEnabled = true;
            c.drawImage(shadowImg, shX, shY, shW, shH);
            c.imageSmoothingEnabled = false;
          }

          if (img) {
            if (isHighlighted || isSelectedFlippable) {
              c.save();
              c.shadowColor = 'rgba(224, 159, 62, 0.9)';
              c.shadowBlur = 14;
              c.drawImage(img, px - drawW / 2, py - drawH, drawW, drawH);
              c.restore();
            }
            c.drawImage(img, px - drawW / 2, py - drawH, drawW, drawH);
          } else {
            c.fillStyle = 'rgba(92, 44, 22, 0.85)';
            c.strokeStyle = '#e09f3e';
            c.lineWidth = 2;
            c.fillRect(px - 36, py - 48, 72, 48);
            c.strokeRect(px - 36, py - 48, 72, 48);
            c.fillStyle = '#faedcd';
            c.font = '600 11px system-ui, sans-serif';
            c.textAlign = 'center';
            c.fillText(def.name, px, py - 20);
          }

          c.restore();

          if (isHighlighted) {
            promptToDraw = {
              px,
              topY: py - drawH,
              label:
                def.category === 'game'
                  ? `SPACE or TAP · Play ${def.name}`
                  : `SPACE or TAP · ${def.name}`,
            };
          }
        },
      });
    }

    // Add Pru (fixed crisp scale + synced floating pixel heart when greeted!)
    const pru = pruRef.current;
    drawables.push({
      y: pru.y,
      draw: (c) => {
        const px = pru.x * W;
        const py = pru.y * H;
        drawPru(c, pru, px, py, 1.0, now);
        if (state.pruHeartAt && now - state.pruHeartAt < 1400) {
          const age = (now - state.pruHeartAt) / 1400;
          c.save();
          c.globalAlpha = 1 - age;
          c.fillStyle = '#f43f5e';
          c.font = 'bold 18px sans-serif';
          c.textAlign = 'center';
          c.fillText('♥', px, py - 42 - age * 26);
          c.restore();
        }
      },
    });

    // Add Players (fixed crisp scale)
    for (const p of Object.values(state.players)) {
      const isLocal = p.id === state.localPlayerId;
      const pos = isLocal
        ? localPosRef.current
        : remoteInterpRef.current[p.id] ?? { x: p.x, y: p.y, walkPhase: 0 };
      const phase = isLocal ? walkPhaseRef.current : (remoteInterpRef.current[p.id]?.walkPhase ?? 0);
      const facing = isLocal ? localFacingRef.current : p.facing;

      drawables.push({
        y: pos.y,
        draw: (c) => {
          drawPixelAvatar(
            c,
            { ...p, facing },
            pos.x * W,
            pos.y * H,
            1.0,
            phase,
            isLocal,
            now
          );
        },
      });
    }

    // Sort back-to-front by Y foot anchor
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      d.draw(ctx);
    }

    // F. Ghost placement preview in Build Mode
    if (state.buildMode && state.selectedAssetId && pointerNormRef.current && !dragRef.current.itemId) {
      const def = ASSET_MAP[state.selectedAssetId];
      if (def) {
        const clamped = clampToFloor(pointerNormRef.current.x, pointerNormRef.current.y);
        const px = clamped.x * W;
        const py = clamped.y * H;
        const targetH = H * def.heightFraction;
        const img = assetLoader.get(def.id);
        const shadowImg = assetLoader.getShadow(def.id);
        const aspect = img ? img.naturalWidth / img.naturalHeight : 1;
        const drawW = targetH * aspect;
        const drawH = targetH;
        const shouldFlip = state.placeFlipped && isFlippableAsset(def.id);

        ctx.save();
        ctx.globalAlpha = 0.68;
        if (shouldFlip) {
          ctx.translate(px, 0);
          ctx.scale(-1, 1);
          ctx.translate(-px, 0);
        }
        if (img && shadowImg) {
          const imgScale = drawH / img.naturalHeight;
          const padX = Math.max(12, Math.floor(img.naturalWidth * 0.08));
          const padTop = Math.max(8, Math.floor(img.naturalHeight * 0.04));
          ctx.drawImage(
            shadowImg,
            px - drawW / 2 - padX * imgScale,
            py - drawH - padTop * imgScale,
            shadowImg.naturalWidth * imgScale,
            shadowImg.naturalHeight * imgScale
          );
        }
        if (img) {
          ctx.shadowColor = 'rgba(224, 159, 62, 0.75)';
          ctx.shadowBlur = 10;
          ctx.drawImage(img, px - drawW / 2, py - drawH, drawW, drawH);
        }
        ctx.restore();
      }
    }

    // G. Composite Room Lighting + Warm Radial Glows (Wall Sconces & Placed Floor Lamps)
    atmosphereRef.current.drawCompositeLighting(ctx, state.items, now);

    // H. Crisp Play Mode Prompt Pill (drawn ABOVE lighting so it stays legible at Night)
    if (promptToDraw) {
      const { px, topY, label } = promptToDraw;
      const bob = Math.sin(now * 0.007) * 4;
      const pillY = topY - 16 + bob;
      ctx.save();
      ctx.font = '700 12px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const bw = tw + 18;
      const bh = 24;
      ctx.fillStyle = '#2b150a';
      ctx.strokeStyle = '#e09f3e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px - bw / 2, pillY - bh / 2, bw, bh, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fefae0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px, pillY + 0.5);
      ctx.restore();
    }
  };

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): Vector2 => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const hitTestItem = (pt: Vector2): RoomItem | null => {
    const sorted = [...propsRef.current.items].sort((a, b) => b.y - a.y);
    for (const item of sorted) {
      const def = ASSET_MAP[item.assetId];
      if (!def) continue;
      const normH = def.heightFraction;
      const img = assetLoader.get(def.id);
      const aspect = img ? img.naturalWidth / img.naturalHeight : 1;
      const halfW = ((normH * aspect * ROOM_LOGICAL_HEIGHT) / ROOM_LOGICAL_WIDTH) * 0.5;
      const top = item.y - normH;
      const bottom = item.y + 0.01;
      if (pt.x >= item.x - halfW && pt.x <= item.x + halfW && pt.y >= top && pt.y <= bottom) {
        return item;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormalizedPoint(e);
    pointerNormRef.current = pt;

    const {
      buildMode,
      selectedAssetId,
      placeFlipped,
      activeInstrumentId,
      isModalOpen,
      onPlaceItem,
      onOpenInstrument,
      onOpenGame,
      onInteractPru,
      onClearSelectedAsset,
      onToast,
    } = propsRef.current;

    if (activeInstrumentId || isModalOpen) return;

    if (buildMode) {
      if (selectedAssetId) {
        const clamped = clampToFloor(pt.x, pt.y);
        const flip = placeFlipped && isFlippableAsset(selectedAssetId);
        onPlaceItem(selectedAssetId, clamped.x, clamped.y, flip);
        if (!e.shiftKey) {
          onClearSelectedAsset();
        }
        return;
      }

      const hit = hitTestItem(pt);
      if (hit) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = {
          itemId: hit.id,
          offsetX: hit.x - pt.x,
          offsetY: hit.y - pt.y,
          startX: hit.x,
          startY: hit.y,
          overTrash: false,
        };
        setDraggingItemId(hit.id);
        setOverTrash(false);
        setSelectedFlippableItemId(isFlippableAsset(hit.assetId) ? hit.id : null);
      } else {
        setSelectedFlippableItemId(null);
      }
      return;
    }

    // PLAY MODE:
    const pru = pruRef.current;
    if (Math.hypot(pt.x - pru.x, (pt.y - pru.y) * 1.5) < 0.048) {
      pru.behavior = 'idle';
      pru.stateEndsAt = performance.now() + 4500;
      onInteractPru();
      onToast('Pru wags her tail happily!');
      return;
    }

    const hit = hitTestItem(pt);
    if (hit && isPlayInteractable(hit.assetId)) {
      const def = ASSET_MAP[hit.assetId];
      const radius = def?.interactRadius ?? 0.095;
      const dist = Math.hypot(
        localPosRef.current.x - hit.x,
        (localPosRef.current.y - hit.y) * 1.45
      );
      if (dist <= radius * 1.15) {
        if (def?.category === 'game') {
          onOpenGame(hit.assetId as 'connect4' | 'tictactoe' | 'soundmemory');
        } else {
          onOpenInstrument(hit.id);
        }
        return;
      }
    }

    localTargetRef.current = clampToFloor(pt.x, pt.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormalizedPoint(e);
    pointerNormRef.current = pt;

    if (dragRef.current.itemId) {
      const isInTrashZone = pt.y < 0.16 && pt.x > 0.37 && pt.x < 0.63;
      dragRef.current.overTrash = isInTrashZone;
      setOverTrash(isInTrashZone);

      if (!isInTrashZone) {
        const clamped = clampToFloor(
          pt.x + dragRef.current.offsetX,
          pt.y + dragRef.current.offsetY
        );
        propsRef.current.onMoveItem(dragRef.current.itemId, clamped.x, clamped.y);
      }
    }
  };

  const handlePointerUp = () => {
    const draggedId = dragRef.current.itemId;
    if (!draggedId) return;

    const { overTrash: shouldDelete, startX, startY } = dragRef.current;
    dragRef.current = { itemId: null, offsetX: 0, offsetY: 0, startX: 0, startY: 0, overTrash: false };
    setDraggingItemId(null);
    setOverTrash(false);

    const item = propsRef.current.items.find((i) => i.id === draggedId);
    if (shouldDelete) {
      if (item && isItemInUseByAnyPlayer(item)) {
        propsRef.current.onToast(
          'Someone is right beside that instrument — step away before removing it.'
        );
        return;
      }
      propsRef.current.onRemoveItem(draggedId);
      setSelectedFlippableItemId(null);
    } else if (item && Math.hypot(item.x - startX, item.y - startY) > 0.01) {
      propsRef.current.onFinishMoveItem(draggedId);
    }
  };

  const selectedFlippableItem = selectedFlippableItemId
    ? props.items.find((i) => i.id === selectedFlippableItemId) ?? null
    : null;

  return (
    <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4 select-none">
      {/* Aspect-locked stage matching background.png (1408x673) */}
      <div className="relative w-full max-w-[1408px] max-h-full aspect-[2816/1346] rounded-2xl overflow-hidden border-2 border-[#a86a3a]/80 shadow-2xl bg-[#1b0d06]">
        <canvas
          ref={canvasRef}
          width={ROOM_LOGICAL_WIDTH}
          height={ROOM_LOGICAL_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            pointerNormRef.current = null;
          }}
          className={`w-full h-full block touch-none ${
            props.buildMode
              ? props.selectedAssetId
                ? 'cursor-crosshair'
                : draggingItemId
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-pointer'
          }`}
        />

        {/* Top-Center Remove Drop Zone (while dragging any item in Build Mode) */}
        {props.buildMode && draggingItemId && (
          <div
            className={`pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl border-2 flex items-center gap-2 text-xs font-bold shadow-xl transition-all ${
              overTrash
                ? 'bg-[#b5442b] border-[#faedcd] text-white scale-105'
                : 'bg-[#2b150a]/90 border-[#b5442b] text-[#faedcd]'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {overTrash ? 'Release to Remove Item' : 'Drag Here to Remove'}
          </div>
        )}

        {/* Top-Center Flip Button for Placed Sofas & Beanbags ONLY */}
        {props.buildMode && !draggingItemId && selectedFlippableItem && (
          <button
            type="button"
            onClick={() => props.onFlipItem(selectedFlippableItem.id)}
            className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border-2 border-[#e09f3e] bg-[#2b150a]/95 hover:bg-[#3b1d0e] text-[#faedcd] text-xs font-bold shadow-xl inline-flex items-center gap-2 transition-transform active:scale-95"
          >
            <FlipHorizontal2 className="w-4 h-4 text-[#e09f3e]" />
            Flip {ASSET_MAP[selectedFlippableItem.assetId]?.name}
          </button>
        )}
      </div>
    </div>
  );
};
