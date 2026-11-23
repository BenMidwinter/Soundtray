import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Music, Sliders, Waves, X } from 'lucide-react';
import {
  audioEngine,
  DRUM_PAD_LABELS,
  INSTRUMENT_RANGES,
  midiToNoteName,
  PERCUSSION_PAD_LABELS,
  scaleIndexToMidi,
  SCALES,
} from '../services/AudioEngine';
import { EPianoParams, InstrumentVoiceId, RoomSettings } from '../types';

/** Lower octave row (degrees 0..7) */
export const LOWER_ROW_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'] as const;
/** Upper octave row (degrees 8..15, à la Mandaloop two-row layout) */
export const UPPER_ROW_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i'] as const;

interface InstrumentDockProps {
  instrumentName: string;
  instrumentVoice: InstrumentVoiceId;
  settings: RoomSettings;
  reverbEnabled: boolean;
  onToggleReverb: () => void;
  epianoParams: EPianoParams;
  onChangeEPianoParams: (params: EPianoParams) => void;
  onTriggerNoteOn: (noteIndex: number, octaveShift: number) => void;
  onTriggerNoteOff: (noteIndex: number, octaveShift: number) => void;
  onClose: () => void;
}

export const InstrumentDock: React.FC<InstrumentDockProps> = ({
  instrumentName,
  instrumentVoice,
  settings,
  reverbEnabled,
  onToggleReverb,
  epianoParams,
  onChangeEPianoParams,
  onTriggerNoteOn,
  onTriggerNoteOff,
  onClose,
}) => {
  const range = INSTRUMENT_RANGES[instrumentVoice];
  const isPercussive = range.octaves === 1;

  const [octaveShift, setOctaveShift] = useState<number>(range.defaultOctaveShift);
  const [pressedIndices, setPressedIndices] = useState<Set<number>>(new Set());

  // Map pressed noteIndex -> octaveShift active when it was pressed (prevents stuck notes on octave change)
  const activeKeyMapRef = useRef<Map<number, number>>(new Map());
  const octaveShiftRef = useRef(octaveShift);
  useEffect(() => {
    octaveShiftRef.current = octaveShift;
  }, [octaveShift]);

  // Reset default octave when switching instruments
  useEffect(() => {
    setOctaveShift(range.defaultOctaveShift);
  }, [instrumentVoice, range.defaultOctaveShift]);

  const onNoteOnRef = useRef(onTriggerNoteOn);
  const onNoteOffRef = useRef(onTriggerNoteOff);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onNoteOnRef.current = onTriggerNoteOn;
    onNoteOffRef.current = onTriggerNoteOff;
    onCloseRef.current = onClose;
  }, [onTriggerNoteOn, onTriggerNoteOff, onClose]);

  const shiftOctave = (delta: number) => {
    setOctaveShift((prev) =>
      Math.max(range.minOctaveShift, Math.min(range.maxOctaveShift, prev + delta))
    );
  };

  // Direct zero-lag keyboard listener (supports 2-row melodic range + Z/X octave shift)
  useEffect(() => {
    const keyToIndex = (key: string): number => {
      const k = key.toLowerCase();
      const lower = LOWER_ROW_KEYS.indexOf(k as (typeof LOWER_ROW_KEYS)[number]);
      if (lower >= 0) return lower;
      if (!isPercussive) {
        const upper = UPPER_ROW_KEYS.indexOf(k as (typeof UPPER_ROW_KEYS)[number]);
        if (upper >= 0) return 8 + upper;
      }
      return -1;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.repeat) return;

      const k = e.key.toLowerCase();
      if (!isPercussive && k === 'z') {
        shiftOctave(-1);
        return;
      }
      if (!isPercussive && k === 'x') {
        shiftOctave(1);
        return;
      }

      const idx = keyToIndex(e.key);
      if (idx >= 0 && !activeKeyMapRef.current.has(idx)) {
        e.preventDefault();
        const oct = octaveShiftRef.current;
        activeKeyMapRef.current.set(idx, oct);
        onNoteOnRef.current(idx, oct);
        setPressedIndices(new Set(activeKeyMapRef.current.keys()));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const idx = keyToIndex(e.key);
      const heldOct = activeKeyMapRef.current.get(idx);
      if (idx >= 0 && heldOct !== undefined) {
        activeKeyMapRef.current.delete(idx);
        onNoteOffRef.current(idx, heldOct);
        setPressedIndices(new Set(activeKeyMapRef.current.keys()));
      }
    };

    const handleBlur = () => {
      activeKeyMapRef.current.forEach((oct, idx) => onNoteOffRef.current(idx, oct));
      activeKeyMapRef.current.clear();
      setPressedIndices(new Set());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      handleBlur();
    };
  }, [isPercussive, range.minOctaveShift, range.maxOctaveShift]);

  const effectiveRootMidi = settings.rootMidi + octaveShift * 12;

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    audioEngine.unlock();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture is unavailable on touch device
    }
    if (!activeKeyMapRef.current.has(idx)) {
      activeKeyMapRef.current.set(idx, octaveShift);
      onTriggerNoteOn(idx, octaveShift);
      setPressedIndices(new Set(activeKeyMapRef.current.keys()));
    }
  };

  const handlePointerUp = (idx: number) => {
    const heldOct = activeKeyMapRef.current.get(idx);
    if (heldOct !== undefined) {
      activeKeyMapRef.current.delete(idx);
      onTriggerNoteOff(idx, heldOct);
      setPressedIndices(new Set(activeKeyMapRef.current.keys()));
    }
  };

  const canShiftOctave = !isPercussive && range.maxOctaveShift > range.minOctaveShift;

  return (
    <div className="pointer-events-auto w-full max-w-4xl mx-auto bg-[#2b150a]/95 backdrop-blur-md border-2 border-[#e09f3e] rounded-2xl shadow-2xl p-2.5 sm:p-3 space-y-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#e09f3e]/20 border border-[#e09f3e] flex items-center justify-center flex-shrink-0">
            <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e09f3e]" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[#faedcd] leading-tight">
              {instrumentName}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#d4a373] leading-tight">
              {isPercussive
                ? 'Tap pads or press A–K'
                : `${midiToNoteName(effectiveRootMidi)} ${SCALES[settings.scaleId].label}`}
              {!isPercussive && (
                <span className="hidden md:inline">
                  {` · Upper Q–I · Lower A–K${canShiftOctave ? ' · Z/X octave' : ''}`}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Per-Instrument Octave Shifter */}
          {canShiftOctave && (
            <div className="inline-flex items-center rounded-lg bg-[#1f0f07] border border-[#8b552c] overflow-hidden">
              <button
                type="button"
                onClick={() => shiftOctave(-1)}
                disabled={octaveShift <= range.minOctaveShift}
                className="px-2 py-1 text-[#faedcd] hover:bg-[#3b1d0e] disabled:opacity-35"
                title="Octave down (Z)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 sm:px-2 text-[11px] font-mono font-bold text-[#e09f3e]">
                Oct {octaveShift >= 0 ? `+${octaveShift}` : octaveShift}
              </span>
              <button
                type="button"
                onClick={() => shiftOctave(1)}
                disabled={octaveShift >= range.maxOctaveShift}
                className="px-2 py-1 text-[#faedcd] hover:bg-[#3b1d0e] disabled:opacity-35"
                title="Octave up (X)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Global Room Reverb Toggle */}
          <button
            type="button"
            onClick={onToggleReverb}
            className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-colors ${
              reverbEnabled
                ? 'bg-[#e09f3e]/20 text-[#faedcd] border-[#e09f3e]'
                : 'bg-[#1f0f07] text-[#d4a373] border-[#8b552c]'
            }`}
            title="Global room reverb (shared with everyone in the room)"
          >
            <Waves className="w-3.5 h-3.5 text-[#e09f3e]" />
            <span>Reverb</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#5c2c16] hover:bg-[#7c3c1f] text-[11px] sm:text-xs font-semibold text-[#faedcd] border border-[#a86a3a]"
          >
            <X className="w-3.5 h-3.5" />
            <span>Step Back</span>
          </button>
        </div>
      </div>

      {/* E. Piano Synth Controls */}
      {instrumentVoice === 'epiano' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-[#1f0f07] border border-[#8b552c]/60 rounded-xl p-2">
          <label className="text-[11px] text-[#d4a373] flex flex-col gap-1">
            <span className="flex justify-between">
              <span className="inline-flex items-center gap-1">
                <Sliders className="w-3 h-3 text-[#e09f3e]" /> Attack
              </span>
              <span className="font-mono text-[#faedcd]">
                {Math.round(epianoParams.attack * 1000)}ms
              </span>
            </span>
            <input
              type="range"
              min={0.005}
              max={0.35}
              step={0.005}
              value={epianoParams.attack}
              onChange={(e) =>
                onChangeEPianoParams({ ...epianoParams, attack: parseFloat(e.target.value) })
              }
              className="accent-[#e09f3e]"
            />
          </label>

          <label className="text-[11px] text-[#d4a373] flex flex-col gap-1">
            <span className="flex justify-between">
              <span>Release</span>
              <span className="font-mono text-[#faedcd]">{epianoParams.release.toFixed(2)}s</span>
            </span>
            <input
              type="range"
              min={0.08}
              max={1.8}
              step={0.04}
              value={epianoParams.release}
              onChange={(e) =>
                onChangeEPianoParams({ ...epianoParams, release: parseFloat(e.target.value) })
              }
              className="accent-[#e09f3e]"
            />
          </label>

          <label className="text-[11px] text-[#d4a373] flex flex-col gap-1">
            <span className="flex justify-between">
              <span>Filter</span>
              <span className="font-mono text-[#faedcd]">
                {Math.round(epianoParams.filterFreq)}Hz
              </span>
            </span>
            <input
              type="range"
              min={400}
              max={8000}
              step={100}
              value={epianoParams.filterFreq}
              onChange={(e) =>
                onChangeEPianoParams({ ...epianoParams, filterFreq: parseFloat(e.target.value) })
              }
              className="accent-[#e09f3e]"
            />
          </label>

          <label className="text-[11px] text-[#d4a373] flex flex-col gap-1">
            <span className="flex justify-between">
              <span>Warmth / Drive</span>
              <span className="font-mono text-[#faedcd]">
                {Math.round(epianoParams.distortion * 100)}%
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={epianoParams.distortion}
              onChange={(e) =>
                onChangeEPianoParams({ ...epianoParams, distortion: parseFloat(e.target.value) })
              }
              className="accent-[#e09f3e]"
            />
          </label>
        </div>
      )}

      {/* Upper Octave Row (Q–I) for Melodic Instruments */}
      {!isPercussive && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 select-none">
          {UPPER_ROW_KEYS.map((keyChar, i) => {
            const idx = 8 + i;
            const isPressed = pressedIndices.has(idx);
            const label = midiToNoteName(
              scaleIndexToMidi(effectiveRootMidi, settings.scaleId, idx)
            );
            return (
              <button
                key={keyChar}
                type="button"
                onPointerDown={(e) => handlePointerDown(idx, e)}
                onPointerUp={() => handlePointerUp(idx)}
                onPointerCancel={() => handlePointerUp(idx)}
                className={`h-11 sm:h-12 lg:h-14 rounded-xl border-2 flex flex-col items-center justify-between p-1 sm:p-1.5 transition-transform touch-none ${
                  isPressed
                    ? 'bg-[#e09f3e] border-[#faedcd] text-[#231209] scale-95 shadow-inner'
                    : 'bg-[#f4e4bc] hover:bg-[#fefae0] border-[#a86a3a] text-[#3b1d0e]'
                }`}
              >
                <span className="text-[10px] font-mono uppercase opacity-70">
                  {keyChar.toUpperCase()}
                </span>
                <span className="text-xs sm:text-sm font-bold">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lower Octave Row (A–K) or 8 Drum/Percussion Pads */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 select-none">
        {LOWER_ROW_KEYS.map((keyChar, idx) => {
          const isPressed = pressedIndices.has(idx);
          const label =
            instrumentVoice === 'drums'
              ? DRUM_PAD_LABELS[idx]
              : instrumentVoice === 'percussion'
              ? PERCUSSION_PAD_LABELS[idx]
              : midiToNoteName(scaleIndexToMidi(effectiveRootMidi, settings.scaleId, idx));
          return (
            <button
              key={keyChar}
              type="button"
              onPointerDown={(e) => handlePointerDown(idx, e)}
              onPointerUp={() => handlePointerUp(idx)}
              onPointerCancel={() => handlePointerUp(idx)}
              className={`${
                isPercussive ? 'h-16 sm:h-20' : 'h-12 sm:h-14 lg:h-16'
              } rounded-xl border-2 flex flex-col items-center justify-between p-1 sm:p-1.5 transition-transform touch-none ${
                isPressed
                  ? 'bg-[#e09f3e] border-[#faedcd] text-[#231209] scale-95 shadow-inner'
                  : isPercussive
                  ? 'bg-[#5c2c16] hover:bg-[#6e351a] border-[#a86a3a] text-[#faedcd]'
                  : 'bg-[#fefae0] hover:bg-[#faedcd] border-[#a86a3a] text-[#3b1d0e]'
              }`}
            >
              <span className="text-[10px] font-mono uppercase opacity-70">
                {keyChar.toUpperCase()}
              </span>
              <span className="text-xs sm:text-sm font-bold text-center leading-tight">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
