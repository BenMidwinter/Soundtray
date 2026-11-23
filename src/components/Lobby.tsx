import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, DoorOpen, RotateCw, Sparkles } from 'lucide-react';
import { HAIR_COLORS, HAIR_STYLES, SHIRT_COLORS, SKIN_TONES } from '../assets/assetManifest';
import { AssetLoadStatus } from '../services/AssetLoader';
import { drawPixelAvatar } from '../services/SpriteRenderer';
import { FacingDirection, HairStyle } from '../types';

const PREVIEW_VIEWS: Array<{ dir: FacingDirection; label: string }> = [
  { dir: 'down', label: 'Front' },
  { dir: 'right', label: 'Side' },
  { dir: 'up', label: 'Back' },
  { dir: 'left', label: 'Left' },
];

interface LobbyProps {
  assetStatus: AssetLoadStatus;
  onEnterRoom: (config: {
    name: string;
    roomId: string;
    skinTone: string;
    shirtColor: string;
    hairColor: string;
    hairStyle: HairStyle;
  }) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ assetStatus, onEnterRoom }) => {
  const [name, setName] = useState('Ben');
  const [roomId, setRoomId] = useState('OAK-ROOM-01');
  const [skinTone, setSkinTone] = useState(SKIN_TONES[1].hex);
  const [shirtColor, setShirtColor] = useState(SHIRT_COLORS[0].hex);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[1].hex);
  const [hairStyleIdx, setHairStyleIdx] = useState(0);
  const [previewViewIdx, setPreviewViewIdx] = useState(0);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const hairStyle: HairStyle = HAIR_STYLES[hairStyleIdx].id;
  const previewView = PREVIEW_VIEWS[previewViewIdx];

  const cycleHair = (delta: number) => {
    setHairStyleIdx((prev) => (prev + delta + HAIR_STYLES.length) % HAIR_STYLES.length);
  };

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    drawPixelAvatar(
      ctx,
      { name: '', skinTone, shirtColor, hairColor, hairStyle, facing: previewView.dir },
      canvas.width / 2,
      canvas.height - 14,
      1.0,
      0,
      true,
      0
    );
  }, [skinTone, shirtColor, hairColor, hairStyle, previewView.dir]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'Guest';
    const cleanRoom = roomId.trim().toUpperCase() || 'OAK-ROOM-01';
    onEnterRoom({ name: cleanName, roomId: cleanRoom, skinTone, shirtColor, hairColor, hairStyle });
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-gradient-to-b from-[#2b150a] via-[#3b1d0e] to-[#231209] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#3b1d0e]/95 border-2 border-[#a86a3a] rounded-2xl shadow-2xl overflow-hidden">
        {/* Pixel-art wooden Soundtray Banner */}
        <div className="bg-[#1b0d06] border-b-2 border-[#a86a3a]/70 p-3 flex justify-center">
          <img
            src="/logo.png"
            alt="Soundtray"
            className="max-h-36 w-auto object-contain rounded-lg pixelated"
          />
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-7 space-y-5">
          <div className="text-center space-y-1">
            <p className="text-[#faedcd]/90 text-sm">
              A warm, latency-free virtual music therapy room. Open this URL in two tabs with the
              same Room Code to test live multiplayer sync.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Avatar Preview Card */}
            <div className="md:col-span-5 flex flex-col items-center bg-[#281309] border border-[#8b552c]/60 rounded-xl p-4">
              <span className="text-xs uppercase tracking-wider text-[#d4a373] mb-2">
                Your Avatar
              </span>
              <canvas
                ref={previewRef}
                width={150}
                height={150}
                className="pixelated rounded-lg bg-[#3b1d0e]/60 border border-[#8b552c]/40"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-[#faedcd]">
                  {name.trim() || 'Guest'}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewViewIdx((prev) => (prev + 1) % PREVIEW_VIEWS.length)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#3b1d0e] hover:bg-[#5c2c16] border border-[#8b552c] text-[10px] font-semibold text-[#d4a373]"
                  title="Turn avatar around to preview Front, Side, and Back views"
                >
                  <RotateCw className="w-3 h-3 text-[#e09f3e]" />
                  {previewView.label}
                </button>
              </div>
            </div>

            {/* Form Controls */}
            <div className="md:col-span-7 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-[#d4a373] mb-1">
                    Display Name
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    placeholder="Your name"
                    className="w-full px-3 py-2 rounded-lg bg-[#231209] border border-[#8b552c] text-[#faedcd] placeholder-[#d4a373]/40 focus:outline-none focus:border-[#e09f3e]"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-[#d4a373] mb-1">
                    Room Code
                  </span>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    maxLength={20}
                    placeholder="OAK-ROOM-01"
                    className="w-full px-3 py-2 rounded-lg bg-[#231209] border border-[#8b552c] text-[#faedcd] font-mono uppercase placeholder-[#d4a373]/40 focus:outline-none focus:border-[#e09f3e]"
                  />
                </label>
              </div>

              {/* Skin Tone */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#d4a373] mb-1.5">
                  Skin Tone
                </span>
                <div className="flex flex-wrap gap-2">
                  {SKIN_TONES.map((tone) => (
                    <button
                      key={tone.hex}
                      type="button"
                      title={tone.label}
                      onClick={() => setSkinTone(tone.hex)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        skinTone === tone.hex
                          ? 'border-[#faedcd] scale-110 ring-2 ring-[#e09f3e]'
                          : 'border-[#5c2c16] hover:scale-105'
                      }`}
                      style={{ backgroundColor: tone.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Hair Style Cycler & Color */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#d4a373]">
                    Hair Style ({hairStyleIdx + 1}/{HAIR_STYLES.length})
                  </span>
                  <div className="inline-flex items-center gap-1 rounded-lg bg-[#231209] p-0.5 border border-[#8b552c]">
                    <button
                      type="button"
                      onClick={() => cycleHair(-1)}
                      className="p-1 rounded hover:bg-[#3b1d0e] text-[#faedcd]"
                      aria-label="Previous hair style"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-[#e09f3e]" />
                    </button>
                    <span className="min-w-[74px] text-center text-xs font-bold text-[#faedcd]">
                      {HAIR_STYLES[hairStyleIdx].label}
                    </span>
                    <button
                      type="button"
                      onClick={() => cycleHair(1)}
                      className="p-1 rounded hover:bg-[#3b1d0e] text-[#faedcd]"
                      aria-label="Next hair style"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-[#e09f3e]" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {HAIR_COLORS.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={swatch.label}
                      onClick={() => setHairColor(swatch.hex)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        hairColor === swatch.hex
                          ? 'border-[#faedcd] scale-110 ring-2 ring-[#e09f3e]'
                          : 'border-[#5c2c16] hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* T-Shirt Color */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#d4a373] mb-1.5">
                  T-Shirt Color
                </span>
                <div className="flex flex-wrap gap-2">
                  {SHIRT_COLORS.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={swatch.label}
                      onClick={() => setShirtColor(swatch.hex)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        shirtColor === swatch.hex
                          ? 'border-[#faedcd] scale-110 ring-2 ring-[#e09f3e]'
                          : 'border-[#5c2c16] hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#8b552c]/50">
            <div className="flex items-center gap-2 text-xs text-[#d4a373]">
              <Sparkles className="w-3.5 h-3.5 text-[#e09f3e]" />
              <span>
                Room assets: {assetStatus.loaded}/{assetStatus.total} loaded
                {assetStatus.failed > 0 ? ` (${assetStatus.failed} unavailable)` : ''}
              </span>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#e09f3e] hover:bg-[#eba945] text-[#231209] font-bold shadow-lg transition-colors"
            >
              <DoorOpen className="w-4 h-4" />
              Enter Music Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
