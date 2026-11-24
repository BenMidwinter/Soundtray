import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  Dog,
  DoorOpen,
  Hammer,
  LayoutGrid,
  Moon,
  Music,
  Sun,
  Sunrise,
  Sunset,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ASSET_MAP, INITIAL_ROOM_ITEMS } from './assets/assetManifest';
import { Connect4Modal } from './components/Connect4Modal';
import { ExitDoorModal } from './components/ExitDoorModal';
import { GameCanvas } from './components/GameCanvas';
import { InstrumentDock } from './components/InstrumentDock';
import { Lobby } from './components/Lobby';
import { RoomPresetsModal } from './components/RoomPresetsModal';
import { SessionLogDrawer } from './components/SessionLogDrawer';
import { SoundMemoryModal } from './components/SoundMemoryModal';
import { TicTacToeModal } from './components/TicTacToeModal';
import { ToyBox } from './components/ToyBox';
import { assetLoader, AssetLoadStatus } from './services/AssetLoader';
import { validateDisplayName, validateRoomCode } from './services/contentFilter';
import {
  audioEngine,
  DEFAULT_EPIANO_PARAMS,
  DRUM_PAD_LABELS,
  midiToNoteName,
  PERCUSSION_PAD_LABELS,
  ROOT_NOTES,
  scaleIndexToMidi,
  SCALES,
} from './services/AudioEngine';
import {
  createDefaultSettings,
  createEmptyConnect4,
  createEmptyTicTacToe,
  createInitialPet,
  createShuffledSoundMemory,
  roomTransport,
} from './services/RoomTransport';
import {
  AudioSignal,
  EPianoParams,
  HairStyle,
  InstrumentVoiceId,
  PlayerState,
  RecordedPerformanceNote,
  RoomSnapshot,
  ScaleId,
  TimeOfDay,
} from './types';

interface ActivePerformanceBout {
  itemId: string;
  assetId: string;
  instrumentName: string;
  instrumentVoice: InstrumentVoiceId;
  startedAt: number;
  rootMidi: number;
  scaleId: ScaleId;
  part: number;
  notes: RecordedPerformanceNote[];
  openNoteSlots: Map<number, number>;
}

const MAX_NOTES_PER_BOUT = 250;

function formatClockTenths(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const tenths = Math.floor(d.getMilliseconds() / 100);
  return `${hh}:${mm}:${ss}.${tenths}`;
}

function buildPerformanceTranscript(
  notes: RecordedPerformanceNote[],
  isPercussive: boolean
): string {
  return notes
    .map((n) => {
      const stamp = `[${formatClockTenths(n.at)}]`;
      if (isPercussive || n.durationMs === undefined) {
        return `${stamp} ${n.note}`;
      }
      const durSec = Math.max(0.05, n.durationMs / 1000).toFixed(2);
      return `${stamp} ${n.note} (${durSec}s)`;
    })
    .join(', ');
}

const TIME_OPTIONS: Array<{
  id: TimeOfDay;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'morning', label: 'Morning', Icon: Sunrise },
  { id: 'day', label: 'Day', Icon: Sun },
  { id: 'sunset', label: 'Sunset', Icon: Sunset },
  { id: 'night', label: 'Night', Icon: Moon },
];

function createClientId(): string {
  return `player-${Math.random().toString(36).slice(2, 9)}`;
}

export const App: React.FC = () => {
  const [inRoom, setInRoom] = useState(false);
  const [localPlayerId] = useState<string>(() => createClientId());
  const [snapshot, setSnapshot] = useState<RoomSnapshot>({
    roomId: '',
    players: {},
    items: INITIAL_ROOM_ITEMS,
    settings: createDefaultSettings(),
    connect4: createEmptyConnect4(),
    tictactoe: createEmptyTicTacToe(),
    soundMemory: createShuffledSoundMemory(),
    pet: createInitialPet(),
    events: [],
  });

  const [buildMode, setBuildMode] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [placeFlipped, setPlaceFlipped] = useState(false);
  const [activeInstrumentId, setActiveInstrumentId] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<'connect4' | 'tictactoe' | 'soundmemory' | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSessionLog, setShowSessionLog] = useState(false);
  const [muted, setMuted] = useState(false);
  const [epianoParams, setEPianoParams] = useState<EPianoParams>(DEFAULT_EPIANO_PARAMS);
  const [assetStatus, setAssetStatus] = useState<AssetLoadStatus>(() => assetLoader.getStatus());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const prevConnect4WinnerRef = useRef<0 | 1 | 2 | 'draw'>(0);
  const prevTttWinnerRef = useRef<0 | 1 | 2 | 'draw'>(0);
  const activeBoutRef = useRef<ActivePerformanceBout | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  // Preload priority PNG assets immediately on app boot
  useEffect(() => {
    const unsub = assetLoader.subscribe(setAssetStatus);
    void assetLoader.preloadPriority(INITIAL_ROOM_ITEMS.map((i) => i.assetId));
    return unsub;
  }, []);

  // Subscribe to room state & remote Mandaloop audio signals
  useEffect(() => {
    const unsubSnap = roomTransport.onSnapshot((next) => {
      setSnapshot(next);
    });

    const unsubAudio = roomTransport.onRemoteAudio((signal: AudioSignal) => {
      audioEngine.handleSignal(signal);
      setSnapshot((prev) => {
        const remote = prev.players[signal.sourceId];
        if (!remote || signal.type !== 'NOTE_ON') return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [signal.sourceId]: { ...remote, lastActiveNoteAt: performance.now() },
          },
        };
      });
    });

    return () => {
      unsubSnap();
      unsubAudio();
      roomTransport.disconnect();
    };
  }, []);

  // Sync global room reverb setting into the local Web Audio engine whenever any participant changes it
  useEffect(() => {
    audioEngine.setReverbEnabled(snapshot.settings.reverbEnabled);
  }, [snapshot.settings.reverbEnabled]);

  // Play gentle marimba chime when someone wins Connect 4 or Tic-Tac-Toe
  useEffect(() => {
    const w = snapshot.connect4.winner;
    if ((w === 1 || w === 2) && prevConnect4WinnerRef.current === 0) {
      audioEngine.playUiCue('connect4_win');
    }
    prevConnect4WinnerRef.current = w;
  }, [snapshot.connect4.winner]);

  useEffect(() => {
    const w = snapshot.tictactoe.winner;
    if ((w === 1 || w === 2) && prevTttWinnerRef.current === 0) {
      audioEngine.playUiCue('connect4_win');
    }
    prevTttWinnerRef.current = w;
  }, [snapshot.tictactoe.winner]);

  const isModalOpen = activeGame !== null || showPresets || showExitModal;

  // Shortcut 'B' toggles Build Mode when not playing or inside a modal
  useEffect(() => {
    if (!inRoom) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' && isModalOpen) {
        setActiveGame(null);
        setShowPresets(false);
        setShowExitModal(false);
        return;
      }
      if (e.key.toLowerCase() === 'b' && !activeInstrumentId && !isModalOpen && !e.repeat) {
        setBuildMode((prev) => {
          const next = !prev;
          if (!next) setSelectedAssetId(null);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inRoom, activeInstrumentId, isModalOpen]);

  const handleEnterRoom = (config: {
    name: string;
    roomId: string;
    skinTone: string;
    shirtColor: string;
    hairColor: string;
    hairStyle: HairStyle;
  }) => {
    if (!validateDisplayName(config.name).valid || !validateRoomCode(config.roomId).valid) {
      return;
    }
    audioEngine.unlock();

    const localPlayer: PlayerState = {
      id: localPlayerId,
      name: config.name,
      skinTone: config.skinTone,
      shirtColor: config.shirtColor,
      hairColor: config.hairColor,
      hairStyle: config.hairStyle,
      x: 0.5,
      y: 0.82,
      targetX: 0.5,
      targetY: 0.82,
      facing: 'down',
      activeInstrumentId: null,
    };

    roomTransport.connect(config.roomId, localPlayer);
    setInRoom(true);
  };

  const flushPerformanceBout = useCallback(
    (isCheckpoint = false) => {
      const bout = activeBoutRef.current;
      if (!bout) return;

      const endedAt = Date.now();
      const isPercussive =
        bout.instrumentVoice === 'drums' || bout.instrumentVoice === 'percussion';

      // Close any notes still held down when stepping back / checkpointing
      if (!isPercussive && bout.openNoteSlots.size > 0) {
        for (const noteIdx of bout.openNoteSlots.values()) {
          const entry = bout.notes[noteIdx];
          if (entry && entry.durationMs === undefined) {
            entry.durationMs = Math.max(10, endedAt - entry.at);
          }
        }
        bout.openNoteSlots.clear();
      }

      const actor = snapshot.players[localPlayerId]?.name || 'Guest';
      const durationMs = Math.max(0, endedAt - bout.startedAt);
      const durationSec = Math.max(1, Math.round(durationMs / 1000));
      const rootLabel =
        ROOT_NOTES.find((r) => r.midi === bout.rootMidi)?.label ?? midiToNoteName(bout.rootMidi);
      const scaleLabel = SCALES[bout.scaleId]?.label ?? bout.scaleId;
      const notesCopy = bout.notes.map((n) => ({ ...n }));
      const transcript = buildPerformanceTranscript(notesCopy, isPercussive);
      const unit = isPercussive ? 'hit' : 'note';
      const plural = notesCopy.length === 1 ? '' : 's';

      let summary: string;
      if (notesCopy.length === 0) {
        summary = `${actor} stepped back from ${bout.instrumentName} (no notes played)`;
      } else if (isCheckpoint) {
        summary = isPercussive
          ? `${actor} played ${bout.instrumentName} (${notesCopy.length} ${unit}${plural}, part ${bout.part})`
          : `${actor} played ${bout.instrumentName} (${notesCopy.length} ${unit}${plural} in ${rootLabel} ${scaleLabel}, part ${bout.part})`;
      } else {
        summary = isPercussive
          ? `${actor} played ${bout.instrumentName} for ${durationSec}s (${notesCopy.length} ${unit}${plural}) and stepped back`
          : `${actor} played ${bout.instrumentName} for ${durationSec}s (${notesCopy.length} ${unit}${plural} in ${rootLabel} ${scaleLabel}) and stepped back`;
      }

      roomTransport.recordEvent('INSTRUMENT_PERFORMANCE', summary, {
        assetId: bout.assetId,
        instrument: bout.instrumentVoice,
        instrumentName: bout.instrumentName,
        startedAt: bout.startedAt,
        endedAt,
        durationMs,
        rootMidi: bout.rootMidi,
        rootLabel,
        scaleId: bout.scaleId,
        scaleLabel,
        part: bout.part,
        ...(isCheckpoint ? { continued: true } : {}),
        noteCount: notesCopy.length,
        transcript,
        notes: notesCopy,
      });

      if (isCheckpoint) {
        activeBoutRef.current = {
          ...bout,
          startedAt: endedAt,
          part: bout.part + 1,
          notes: [],
          openNoteSlots: new Map(),
        };
      } else {
        activeBoutRef.current = null;
      }
    },
    [localPlayerId, snapshot.players]
  );

  const handleConfirmLeaveRoom = () => {
    flushPerformanceBout(false);
    audioEngine.releaseAllForSource(localPlayerId);
    roomTransport.disconnect();
    setActiveInstrumentId(null);
    setActiveGame(null);
    setShowPresets(false);
    setShowExitModal(false);
    setShowSessionLog(false);
    setBuildMode(false);
    setSelectedAssetId(null);
    setInRoom(false);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioEngine.setMuted(next);
  };

  const handleToggleReverb = () => {
    roomTransport.updateSettings({
      ...snapshot.settings,
      reverbEnabled: !snapshot.settings.reverbEnabled,
    });
  };

  const activeItem = useMemo(
    () => snapshot.items.find((i) => i.id === activeInstrumentId) ?? null,
    [snapshot.items, activeInstrumentId]
  );

  const activeAssetDef = activeItem ? ASSET_MAP[activeItem.assetId] : null;

  const handleCloseInstrument = useCallback(() => {
    if (activeBoutRef.current) {
      flushPerformanceBout(false);
    } else if (activeAssetDef) {
      roomTransport.recordEvent(
        'INSTRUMENT_CLOSE',
        `${snapshot.players[localPlayerId]?.name || 'Guest'} stepped back from ${activeAssetDef.name}`,
        { assetId: activeAssetDef.id }
      );
    }
    audioEngine.releaseAllForSource(localPlayerId);
    roomTransport.setLocalActiveInstrument(null);
    setActiveInstrumentId(null);
  }, [activeAssetDef, flushPerformanceBout, localPlayerId, snapshot.players]);

  const handleTriggerNoteOn = useCallback(
    (noteIndex: number, octaveShift: number) => {
      if (!activeAssetDef?.instrumentVoice) return;
      const now = Date.now();
      const midiNote = scaleIndexToMidi(
        snapshot.settings.rootMidi + octaveShift * 12,
        snapshot.settings.scaleId,
        noteIndex
      );
      const voiceSlot = octaveShift * 32 + noteIndex;
      const signal: AudioSignal = {
        type: 'NOTE_ON',
        sourceId: localPlayerId,
        instrument: activeAssetDef.instrumentVoice,
        noteIndex: voiceSlot,
        midiNote,
        velocity: 0.85,
        epianoParams: activeAssetDef.instrumentVoice === 'epiano' ? epianoParams : undefined,
        timestamp: now,
      };

      audioEngine.noteOn(signal);
      roomTransport.sendAudioSignal(signal);

      // Buffer note into the active instrument bout for grouped INSTRUMENT_PERFORMANCE logging
      const bout = activeBoutRef.current;
      if (bout) {
        const isDrums = activeAssetDef.instrumentVoice === 'drums';
        const isPerc = activeAssetDef.instrumentVoice === 'percussion';
        const padIdx = ((noteIndex % 8) + 8) % 8;
        const noteEntry: RecordedPerformanceNote = isDrums
          ? {
              note: DRUM_PAD_LABELS[padIdx] ?? `Pad ${padIdx + 1}`,
              pad: padIdx,
              at: now,
              offsetMs: Math.max(0, now - bout.startedAt),
            }
          : isPerc
          ? {
              note: PERCUSSION_PAD_LABELS[padIdx] ?? `Pad ${padIdx + 1}`,
              pad: padIdx,
              at: now,
              offsetMs: Math.max(0, now - bout.startedAt),
            }
          : {
              note: midiToNoteName(midiNote),
              midi: midiNote,
              at: now,
              offsetMs: Math.max(0, now - bout.startedAt),
            };

        const idx = bout.notes.push(noteEntry) - 1;
        if (!isDrums && !isPerc) {
          bout.openNoteSlots.set(voiceSlot, idx);
        }
        if (bout.notes.length >= MAX_NOTES_PER_BOUT) {
          flushPerformanceBout(true);
        }
      }

      const me = snapshot.players[localPlayerId];
      if (me) {
        roomTransport.updateLocalPlayer({ ...me, lastActiveNoteAt: performance.now() });
      }
    },
    [
      activeAssetDef,
      epianoParams,
      flushPerformanceBout,
      localPlayerId,
      snapshot.players,
      snapshot.settings,
    ]
  );

  const handleTriggerNoteOff = useCallback(
    (noteIndex: number, octaveShift: number) => {
      if (!activeAssetDef?.instrumentVoice) return;
      const now = Date.now();
      const midiNote = scaleIndexToMidi(
        snapshot.settings.rootMidi + octaveShift * 12,
        snapshot.settings.scaleId,
        noteIndex
      );
      const voiceSlot = octaveShift * 32 + noteIndex;
      const signal: AudioSignal = {
        type: 'NOTE_OFF',
        sourceId: localPlayerId,
        instrument: activeAssetDef.instrumentVoice,
        noteIndex: voiceSlot,
        midiNote,
        velocity: 0,
        timestamp: now,
      };
      audioEngine.noteOff(localPlayerId, activeAssetDef.instrumentVoice, voiceSlot);
      roomTransport.sendAudioSignal(signal);

      // Stamp hold duration onto the matching note in the active performance bout
      const bout = activeBoutRef.current;
      if (bout) {
        const noteIdx = bout.openNoteSlots.get(voiceSlot);
        if (noteIdx !== undefined) {
          const entry = bout.notes[noteIdx];
          if (entry) {
            entry.durationMs = Math.max(10, now - entry.at);
          }
          bout.openNoteSlots.delete(voiceSlot);
        }
      }
    },
    [activeAssetDef, localPlayerId, snapshot.settings]
  );

  if (!inRoom) {
    return <Lobby assetStatus={assetStatus} onEnterRoom={handleEnterRoom} />;
  }

  const playerCount = Object.keys(snapshot.players).length;

  return (
    <div className="h-app-screen w-screen flex flex-col bg-[#1b0d06] text-[#faedcd] overflow-hidden">
      {/* Top Bar */}
      <header className="flex-shrink-0 bg-[#3b1d0e] border-b-2 border-[#a86a3a]/70 px-2.5 sm:px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <span className="font-black tracking-wide text-sm sm:text-base text-[#e09f3e]">
            SOUNDTRAY
          </span>
          <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#231209] border border-[#8b552c] text-[11px] sm:text-xs font-mono text-[#faedcd]">
            {snapshot.roomId}
          </span>
          <span
            className="inline-flex items-center gap-1 text-xs text-[#d4a373]"
            title={
              roomTransport.mode === 'firebase'
                ? 'Live Firebase Realtime Database sync active'
                : 'Local multi-tab sync mode (add Firebase env vars for remote sessions)'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                roomTransport.mode === 'firebase' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <Users className="w-3.5 h-3.5 text-[#e09f3e]" />
            {playerCount}
          </span>
        </div>

        {/* Center Controls: Mode + Global Scale + Time of Day + Pru */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Play / Build Toggle */}
          <div className="inline-flex rounded-xl bg-[#231209] p-0.5 border border-[#8b552c]">
            <button
              type="button"
              onClick={() => {
                setBuildMode(false);
                setSelectedAssetId(null);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                !buildMode
                  ? 'bg-[#e09f3e] text-[#231209]'
                  : 'text-[#d4a373] hover:text-[#faedcd]'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              Play
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeBoutRef.current) flushPerformanceBout(false);
                setActiveInstrumentId(null);
                roomTransport.setLocalActiveInstrument(null);
                audioEngine.releaseAllForSource(localPlayerId);
                setBuildMode(true);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                buildMode
                  ? 'bg-[#e09f3e] text-[#231209]'
                  : 'text-[#d4a373] hover:text-[#faedcd]'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Toy Box</span>
              <span className="hidden xl:inline">(B)</span>
            </button>
          </div>

          {/* Global Root Note & Scale Selector */}
          <div className="inline-flex items-center gap-1 bg-[#231209] border border-[#8b552c] rounded-xl px-2 py-1">
            <select
              aria-label="Root Note"
              value={snapshot.settings.rootMidi}
              onChange={(e) =>
                roomTransport.updateSettings({
                  ...snapshot.settings,
                  rootMidi: Number(e.target.value),
                })
              }
              className="bg-transparent text-xs font-bold text-[#e09f3e] focus:outline-none cursor-pointer"
            >
              {ROOT_NOTES.map((r) => (
                <option key={r.midi} value={r.midi} className="bg-[#2b150a] text-[#faedcd]">
                  {r.label}
                </option>
              ))}
            </select>

            <span className="text-[#8b552c]">·</span>

            <select
              aria-label="Global Musical Scale"
              value={snapshot.settings.scaleId}
              onChange={(e) =>
                roomTransport.updateSettings({
                  ...snapshot.settings,
                  scaleId: e.target.value as ScaleId,
                })
              }
              className="bg-transparent text-xs font-medium text-[#faedcd] focus:outline-none cursor-pointer max-w-[116px] sm:max-w-none"
            >
              {Object.values(SCALES).map((s) => (
                <option key={s.id} value={s.id} className="bg-[#2b150a] text-[#faedcd]">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time of Day Switcher */}
          <div
            className="inline-flex items-center rounded-xl bg-[#231209] p-0.5 border border-[#8b552c]"
            role="group"
            aria-label="Time of Day"
          >
            {TIME_OPTIONS.map(({ id, label, Icon }) => {
              const active = snapshot.settings.timeOfDay === id;
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() =>
                    roomTransport.updateSettings({
                      ...snapshot.settings,
                      timeOfDay: id,
                    })
                  }
                  className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-[#e09f3e] text-[#231209]'
                      : 'text-[#d4a373] hover:text-[#faedcd]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden 2xl:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Synced Pru Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={snapshot.settings.pruEnabled}
            onClick={() =>
              roomTransport.updateSettings({
                ...snapshot.settings,
                pruEnabled: !snapshot.settings.pruEnabled,
              })
            }
            title={
              snapshot.settings.pruEnabled
                ? 'Pru is in the room (click to toggle off for everyone)'
                : 'Pru is resting outside (click to invite her back)'
            }
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
              snapshot.settings.pruEnabled
                ? 'bg-[#231209] border-[#e09f3e]/80 text-[#faedcd]'
                : 'bg-[#231209]/70 border-[#8b552c] text-[#d4a373]/80 hover:text-[#faedcd]'
            }`}
          >
            <Dog
              className={`w-3.5 h-3.5 ${
                snapshot.settings.pruEnabled ? 'text-[#e09f3e]' : 'text-[#8b552c]'
              }`}
            />
            <span>Pru</span>
            <span
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                snapshot.settings.pruEnabled ? 'bg-[#e09f3e]' : 'bg-[#5c2c16]'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-[#231209] shadow transition-transform ${
                  snapshot.settings.pruEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
        </div>

        {/* Right Controls: Presets, Session Events, Mute, Exit Door */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setShowPresets(true)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#231209] hover:bg-[#2f180c] border border-[#8b552c] text-xs font-semibold text-[#faedcd]"
            title="Load or save room layout presets"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#e09f3e]" />
            <span className="hidden xl:inline">Presets</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSessionLog((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              showSessionLog
                ? 'bg-[#e09f3e] text-[#231209] border-[#faedcd]'
                : 'bg-[#231209] hover:bg-[#2f180c] border-[#8b552c] text-[#faedcd]'
            }`}
            title="Toggle structured session event log"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Events</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="p-1.5 rounded-lg bg-[#231209] hover:bg-[#2f180c] border border-[#8b552c] text-[#faedcd]"
            title={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-[#b5442b]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#e09f3e]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#5c2c16] hover:bg-[#7c3c1f] border border-[#a86a3a] text-xs font-bold text-[#faedcd]"
            title="Close the room door (clinical session boundary)"
          >
            <DoorOpen className="w-3.5 h-3.5 text-[#e09f3e]" />
            <span className="hidden sm:inline">Exit</span>
            <span className="hidden xl:inline">Door</span>
          </button>
        </div>
      </header>

      {/* Main Content: Rock-Steady Room Stage + Bottom Overlay Docks (never shifts or resizes room) */}
      <main className="relative flex-1 min-h-0 overflow-hidden">
        <GameCanvas
          localPlayerId={localPlayerId}
          players={snapshot.players}
          items={snapshot.items}
          pet={snapshot.pet}
          pruEnabled={snapshot.settings.pruEnabled}
          timeOfDay={snapshot.settings.timeOfDay}
          pruHeartAt={snapshot.pruHeartAt}
          buildMode={buildMode}
          selectedAssetId={selectedAssetId}
          placeFlipped={placeFlipped}
          activeInstrumentId={activeInstrumentId}
          isModalOpen={isModalOpen}
          onUpdateLocalPlayer={(player) => roomTransport.updateLocalPlayer(player)}
          onUpdatePet={(pet) => roomTransport.updatePet(pet)}
          onPlaceItem={(assetId, x, y, flipped) => {
            void assetLoader.loadOne(assetId);
            roomTransport.placeItem({
              id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              assetId,
              x,
              y,
              flipped: flipped || undefined,
            });
          }}
          onMoveItem={(itemId, x, y) => roomTransport.moveItem(itemId, x, y)}
          onFinishMoveItem={(itemId) => {
            const moved = snapshot.items.find((i) => i.id === itemId);
            if (!moved) return;
            const label = ASSET_MAP[moved.assetId]?.name ?? moved.assetId;
            roomTransport.recordEvent(
              'ITEM_MOVE',
              `${snapshot.players[localPlayerId]?.name || 'Guest'} moved ${label}`,
              { assetId: moved.assetId }
            );
          }}
          onFlipItem={(itemId) => roomTransport.flipItem(itemId)}
          onRemoveItem={(itemId) => roomTransport.removeItem(itemId)}
          onOpenInstrument={(itemId) => {
            audioEngine.unlock();
            if (activeBoutRef.current) flushPerformanceBout(false);
            const target = snapshot.items.find((i) => i.id === itemId);
            const def = target ? ASSET_MAP[target.assetId] : null;
            const label = def?.name ?? target?.assetId ?? 'instrument';
            if (target && def?.instrumentVoice) {
              activeBoutRef.current = {
                itemId: target.id,
                assetId: target.assetId,
                instrumentName: label,
                instrumentVoice: def.instrumentVoice,
                startedAt: Date.now(),
                rootMidi: snapshot.settings.rootMidi,
                scaleId: snapshot.settings.scaleId,
                part: 1,
                notes: [],
                openNoteSlots: new Map(),
              };
            }
            roomTransport.setLocalActiveInstrument(itemId);
            roomTransport.recordEvent(
              'INSTRUMENT_OPEN',
              `${snapshot.players[localPlayerId]?.name || 'Guest'} started playing ${label}`,
              { assetId: target?.assetId }
            );
            setActiveInstrumentId(itemId);
          }}
          onOpenGame={(gameId) => {
            audioEngine.unlock();
            setActiveGame(gameId);
          }}
          onInteractPru={() => {
            audioEngine.unlock();
            audioEngine.playUiCue('pru_happy');
            roomTransport.interactWithPru();
          }}
          onClearSelectedAsset={() => setSelectedAssetId(null)}
          onToast={showToast}
        />

        {/* Toast Notification */}
        {toast && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#2b150a]/95 border border-[#e09f3e] text-xs font-semibold text-[#faedcd] shadow-xl z-30">
            {toast}
          </div>
        )}

        {/* Bottom Overlay Dock: Toy Box, Instrument Dock, or Subtle Play Hint (pinned within 100dvh) */}
        {buildMode ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 sm:px-3 pb-safe z-20">
            <ToyBox
              selectedAssetId={selectedAssetId}
              placeFlipped={placeFlipped}
              onSelectAsset={(id) => {
                if (id) void assetLoader.loadOne(id);
                setSelectedAssetId(id);
              }}
              onTogglePlaceFlipped={() => setPlaceFlipped((prev) => !prev)}
              onTidyRoom={() => {
                roomTransport.tidyRoom();
                showToast('Room tidied up.');
              }}
              itemCount={snapshot.items.length}
            />
          </div>
        ) : activeItem && activeAssetDef?.instrumentVoice ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 sm:px-3 pb-safe z-20">
            <InstrumentDock
              instrumentName={activeAssetDef.name}
              instrumentVoice={activeAssetDef.instrumentVoice}
              settings={snapshot.settings}
              reverbEnabled={snapshot.settings.reverbEnabled}
              onToggleReverb={handleToggleReverb}
              epianoParams={epianoParams}
              onChangeEPianoParams={setEPianoParams}
              onTriggerNoteOn={handleTriggerNoteOn}
              onTriggerNoteOff={handleTriggerNoteOff}
              onClose={handleCloseInstrument}
            />
          </div>
        ) : !isModalOpen ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-safe flex justify-center z-10">
            <div className="px-3 py-1 rounded-full bg-[#231209]/90 border border-[#8b552c]/70 text-[11px] text-[#d4a373] shadow text-center">
              <strong className="text-[#faedcd]">Tap</strong> the floor to move · Walk up and{' '}
              <strong className="text-[#faedcd]">tap</strong> an instrument, game, or Pru
              <span className="hidden lg:inline">
                {' '}
                · Keyboard: <strong className="text-[#faedcd]">WASD</strong> +{' '}
                <strong className="text-[#faedcd]">Space</strong>
              </span>
            </div>
          </div>
        ) : null}
      </main>

      {/* Modals & Drawers */}
      {activeGame === 'connect4' && (
        <Connect4Modal
          state={snapshot.connect4}
          localPlayerId={localPlayerId}
          playerCount={playerCount}
          onDropDisc={(col, colorOverride) => roomTransport.dropConnect4Disc(col, colorOverride)}
          onSetTurnMode={(mode) => roomTransport.setConnect4TurnMode(mode)}
          onClaimSeat={(seat) => roomTransport.claimConnect4Seat(seat)}
          onReset={() => roomTransport.resetConnect4()}
          onClose={() => setActiveGame(null)}
        />
      )}

      {activeGame === 'tictactoe' && (
        <TicTacToeModal
          state={snapshot.tictactoe}
          localPlayerId={localPlayerId}
          playerCount={playerCount}
          onPlayCell={(idx) => roomTransport.playTicTacToeCell(idx)}
          onSetTurnMode={(mode) => roomTransport.setTicTacToeTurnMode(mode)}
          onClaimSeat={(seat) => roomTransport.claimTicTacToeSeat(seat)}
          onReset={() => roomTransport.resetTicTacToe()}
          onClose={() => setActiveGame(null)}
        />
      )}

      {activeGame === 'soundmemory' && (
        <SoundMemoryModal
          state={snapshot.soundMemory}
          settings={snapshot.settings}
          localPlayerId={localPlayerId}
          playerCount={playerCount}
          onFlipCard={(idx) => roomTransport.flipMemoryCard(idx)}
          onResolveMismatch={() => roomTransport.resolveMemoryMismatch()}
          onSetTurnMode={(mode) => roomTransport.setMemoryTurnMode(mode)}
          onClaimSeat={(seat) => roomTransport.claimMemorySeat(seat)}
          onReset={() => roomTransport.resetSoundMemory()}
          onClose={() => setActiveGame(null)}
        />
      )}

      {showPresets && (
        <RoomPresetsModal
          currentItems={snapshot.items}
          currentSettings={snapshot.settings}
          onApplyPreset={(preset) => {
            preset.items.forEach((it) => void assetLoader.loadOne(it.assetId));
            roomTransport.applyPreset(preset);
            showToast(`Loaded "${preset.name}"`);
          }}
          onClose={() => setShowPresets(false)}
        />
      )}

      {showExitModal && (
        <ExitDoorModal
          roomId={snapshot.roomId}
          onStay={() => setShowExitModal(false)}
          onOpenPresets={() => {
            setShowExitModal(false);
            setShowPresets(true);
          }}
          onConfirmLeave={handleConfirmLeaveRoom}
        />
      )}

      {showSessionLog && (
        <SessionLogDrawer
          roomId={snapshot.roomId}
          events={snapshot.events}
          onClose={() => setShowSessionLog(false)}
        />
      )}
    </div>
  );
};

export default App;
