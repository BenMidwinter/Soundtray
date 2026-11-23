import { AudioSignal, EPianoParams, InstrumentVoiceId, ScaleId } from '../types';

export interface ScaleDefinition {
  id: ScaleId;
  label: string;
  intervals: number[];
}

export const SCALES: Record<ScaleId, ScaleDefinition> = {
  pentatonic_major: { id: 'pentatonic_major', label: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
  pentatonic_minor: { id: 'pentatonic_minor', label: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
  major: { id: 'major', label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { id: 'minor', label: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  harmonic_minor: { id: 'harmonic_minor', label: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  dorian: { id: 'dorian', label: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { id: 'phrygian', label: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { id: 'lydian', label: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { id: 'mixolydian', label: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  locrian: { id: 'locrian', label: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
  hirajoshi: { id: 'hirajoshi', label: 'Hirajoshi', intervals: [0, 2, 3, 7, 8] },
};

export const ROOT_NOTES: Array<{ midi: number; label: string }> = [
  { midi: 60, label: 'C' },
  { midi: 61, label: 'C#' },
  { midi: 62, label: 'D' },
  { midi: 63, label: 'Eb' },
  { midi: 64, label: 'E' },
  { midi: 65, label: 'F' },
  { midi: 66, label: 'F#' },
  { midi: 67, label: 'G' },
  { midi: 68, label: 'Ab' },
  { midi: 69, label: 'A' },
  { midi: 70, label: 'Bb' },
  { midi: 71, label: 'B' },
];

export const DEFAULT_EPIANO_PARAMS: EPianoParams = {
  attack: 0.015,
  release: 0.55,
  filterFreq: 2800,
  distortion: 0.15,
};

export interface InstrumentRangeConfig {
  octaves: 1 | 2;
  defaultOctaveShift: number;
  minOctaveShift: number;
  maxOctaveShift: number;
}

/** Musical range & natural register per instrument (multi-octave melodic instruments à la Mandaloop). */
export const INSTRUMENT_RANGES: Record<InstrumentVoiceId, InstrumentRangeConfig> = {
  grandpiano: { octaves: 2, defaultOctaveShift: 0, minOctaveShift: -2, maxOctaveShift: 1 },
  epiano: { octaves: 2, defaultOctaveShift: 0, minOctaveShift: -2, maxOctaveShift: 1 },
  marimba: { octaves: 2, defaultOctaveShift: 0, minOctaveShift: -1, maxOctaveShift: 1 },
  guitar: { octaves: 2, defaultOctaveShift: -1, minOctaveShift: -1, maxOctaveShift: 1 },
  sax: { octaves: 2, defaultOctaveShift: -1, minOctaveShift: -1, maxOctaveShift: 1 },
  xylophone: { octaves: 2, defaultOctaveShift: 0, minOctaveShift: 0, maxOctaveShift: 1 },
  flute: { octaves: 2, defaultOctaveShift: 0, minOctaveShift: 0, maxOctaveShift: 1 },
  drums: { octaves: 1, defaultOctaveShift: 0, minOctaveShift: 0, maxOctaveShift: 0 },
  percussion: { octaves: 1, defaultOctaveShift: 0, minOctaveShift: 0, maxOctaveShift: 0 },
};

export const DRUM_PAD_LABELS = [
  'Kick',
  'Snare',
  'Closed Hat',
  'Open Hat',
  'Low Tom',
  'Mid Tom',
  'Clap',
  'Crash',
];

export const PERCUSSION_PAD_LABELS = [
  'Conga Lo',
  'Conga Hi',
  'Woodblock',
  'Shaker',
  'Clave',
  'Triangle',
  'Cowbell',
  'Rim',
];

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function scaleIndexToMidi(rootMidi: number, scaleId: ScaleId, noteIndex: number): number {
  const intervals = SCALES[scaleId]?.intervals ?? SCALES.pentatonic_major.intervals;
  const octaveOffset = Math.floor(noteIndex / intervals.length);
  const degree = ((noteIndex % intervals.length) + intervals.length) % intervals.length;
  return rootMidi + octaveOffset * 12 + intervals[degree];
}

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ActiveVoice {
  release: () => void;
}

/**
 * Soundtray Audio Engine ("Mandaloop Model"):
 * - Strictly signal-driven (`NOTE_ON` / `NOTE_OFF`) — zero audio streaming.
 * - Full-volume local synthesis (no spatial drop-off, per clinical requirements).
 * - Immediate execution on keydown/pointerdown with pre-built noise buffer and master compressor.
 */
class AudioEngineService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeVoices = new Map<string, ActiveVoice>();
  private muted = false;
  private reverbEnabled = true;

  public init(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 4;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.65;

      // Subtle warm wooden-room reverb send (procedural impulse response — zero asset load risk)
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createRoomImpulse(this.ctx, 1.35, 2.8);
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = this.reverbEnabled ? 0.22 : 0;

      this.compressor.connect(this.masterGain);
      this.compressor.connect(this.reverbSend);
      this.reverbSend.connect(this.reverbNode);
      this.reverbNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 1.0);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.015);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setReverbEnabled(enabled: boolean): void {
    this.reverbEnabled = enabled;
    if (this.ctx && this.reverbSend) {
      this.reverbSend.gain.setTargetAtTime(enabled ? 0.22 : 0, this.ctx.currentTime, 0.04);
    }
  }

  public isReverbEnabled(): boolean {
    return this.reverbEnabled;
  }

  /** Soft non-intrusive acoustic cues for room interactions (Connect 4, Pru). */
  public playUiCue(kind: 'disc_drop' | 'connect4_win' | 'pru_happy'): void {
    this.init();
    if (!this.ctx || !this.compressor) return;
    const now = this.ctx.currentTime;

    if (kind === 'disc_drop') {
      this.synthToneClick(520, 0.05, 0.28, now, 'triangle');
      this.synthToneClick(340, 0.06, 0.22, now + 0.04, 'sine');
    } else if (kind === 'connect4_win') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((hz, idx) => {
        this.playMallet(hz, now + idx * 0.09, 0.45, 'marimba');
      });
    } else if (kind === 'pru_happy') {
      this.synthPitchDrop(420, 620, 0.08, 0.16, now);
      this.synthPitchDrop(480, 720, 0.09, 0.14, now + 0.09);
    }
  }

  /** Plays a short 2–3 note musical motif in the room's active key & scale (for Sound Memory cards). */
  public playMotif(
    instrument: InstrumentVoiceId,
    rootMidi: number,
    scaleId: ScaleId,
    degrees: number[]
  ): void {
    this.init();
    if (!this.ctx || !this.compressor) return;
    const stepMs = 155;
    degrees.forEach((deg, idx) => {
      const midiNote = scaleIndexToMidi(rootMidi, scaleId, deg);
      window.setTimeout(() => {
        const sig: AudioSignal = {
          type: 'NOTE_ON',
          sourceId: `motif-${instrument}-${idx}`,
          instrument,
          noteIndex: deg,
          midiNote,
          velocity: 0.78,
          timestamp: Date.now(),
        };
        this.noteOn(sig);
        window.setTimeout(() => {
          this.noteOff(sig.sourceId, instrument, deg);
        }, 280);
      }, idx * stepMs);
    });
  }

  public handleSignal(signal: AudioSignal): void {
    if (signal.type === 'NOTE_ON') {
      this.noteOn(signal);
    } else {
      this.noteOff(signal.sourceId, signal.instrument, signal.noteIndex);
    }
  }

  public noteOn(signal: AudioSignal): void {
    this.init();
    if (!this.ctx || !this.compressor) return;

    const voiceKey = `${signal.sourceId}:${signal.instrument}:${signal.noteIndex}`;
    const existing = this.activeVoices.get(voiceKey);
    if (existing) {
      existing.release();
      this.activeVoices.delete(voiceKey);
    }

    const now = this.ctx.currentTime;
    const freq = midiToFreq(signal.midiNote);
    const vel = Math.max(0.1, Math.min(1, signal.velocity));

    switch (signal.instrument) {
      case 'drums':
        this.triggerDrum(signal.noteIndex, now, vel);
        break;
      case 'percussion':
        this.triggerPercussion(signal.noteIndex, now, vel);
        break;
      case 'grandpiano':
        this.activeVoices.set(voiceKey, this.playGrandPiano(freq, now, vel));
        break;
      case 'epiano':
        this.activeVoices.set(
          voiceKey,
          this.playEPiano(freq, now, vel, signal.epianoParams ?? DEFAULT_EPIANO_PARAMS)
        );
        break;
      case 'guitar':
        this.activeVoices.set(voiceKey, this.playGuitar(freq, now, vel));
        break;
      case 'marimba':
        this.playMallet(freq, now, vel, 'marimba');
        break;
      case 'xylophone':
        this.playMallet(freq, now, vel, 'xylophone');
        break;
      case 'sax':
        this.activeVoices.set(voiceKey, this.playSax(freq, now, vel));
        break;
      case 'flute':
        this.activeVoices.set(voiceKey, this.playFlute(freq, now, vel));
        break;
    }
  }

  public noteOff(sourceId: string, instrument: InstrumentVoiceId, noteIndex: number): void {
    const voiceKey = `${sourceId}:${instrument}:${noteIndex}`;
    const voice = this.activeVoices.get(voiceKey);
    if (voice) {
      voice.release();
      this.activeVoices.delete(voiceKey);
    }
  }

  public releaseAllForSource(sourceId: string): void {
    const prefix = `${sourceId}:`;
    for (const [key, voice] of this.activeVoices.entries()) {
      if (key.startsWith(prefix)) {
        voice.release();
        this.activeVoices.delete(key);
      }
    }
  }

  // --- MELODIC VOICES ---

  private playGrandPiano(freq: number, now: number, vel: number): ActiveVoice {
    const ctx = this.ctx!;
    const out = this.compressor!;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.22, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.02, now + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(7000, freq * 8), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2), now + 1.8);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(0.55 * vel, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.18 * vel, now + 0.35);
    amp.gain.exponentialRampToValueAtTime(0.0008, now + 2.6);

    osc1.connect(filter);
    osc2.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(amp);
    amp.connect(out);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.75);
    osc2.stop(now + 2.75);

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        const t = ctx.currentTime;
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(Math.max(amp.gain.value, 0.0005), t);
        amp.gain.exponentialRampToValueAtTime(0.0005, t + 0.32);
        try {
          osc1.stop(t + 0.36);
          osc2.stop(t + 0.36);
        } catch {
          // already stopped
        }
      },
    };
  }

  private playEPiano(freq: number, now: number, vel: number, params: EPianoParams): ActiveVoice {
    const ctx = this.ctx!;
    const out = this.compressor!;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.setValueAtTime(6, now);

    shaper.curve = this.makeDistortionCurve(params.distortion * 55);
    shaper.oversample = '2x';

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.filterFreq, now);
    filter.Q.value = 1.6;

    // Sustained envelope (no automatic decay while held — matches Ben's E. Piano spec)
    const attack = Math.max(0.005, params.attack);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(0.42 * vel, now + attack);

    osc1.connect(shaper);
    osc2.connect(shaper);
    shaper.connect(filter);
    filter.connect(amp);
    amp.connect(out);

    osc1.start(now);
    osc2.start(now);

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        const t = ctx.currentTime;
        const rel = Math.max(0.06, params.release);
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(Math.max(amp.gain.value, 0.0005), t);
        amp.gain.exponentialRampToValueAtTime(0.0005, t + rel);
        try {
          osc1.stop(t + rel + 0.05);
          osc2.stop(t + rel + 0.05);
        } catch {
          // already stopped
        }
      },
    };
  }

  private playGuitar(freq: number, now: number, vel: number): ActiveVoice {
    const ctx = this.ctx!;
    const out = this.compressor!;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(Math.min(5000, freq * 7), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(380, freq * 1.4), now + 0.9);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(0.45 * vel, now + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(out);

    osc.start(now);
    osc.stop(now + 1.7);

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        const t = ctx.currentTime;
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(Math.max(amp.gain.value, 0.0005), t);
        amp.gain.exponentialRampToValueAtTime(0.0005, t + 0.25);
        try {
          osc.stop(t + 0.28);
        } catch {
          // already stopped
        }
      },
    };
  }

  private playMallet(freq: number, now: number, vel: number, kind: 'marimba' | 'xylophone'): void {
    const ctx = this.ctx!;
    const out = this.compressor!;

    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    const amp = ctx.createGain();

    const baseFreq = kind === 'xylophone' ? freq * 2 : freq;
    const decay = kind === 'xylophone' ? 0.42 : 0.78;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(baseFreq * (kind === 'xylophone' ? 3 : 4), now);
    overtoneGain.gain.setValueAtTime(kind === 'xylophone' ? 0.3 : 0.16, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(0.55 * vel, now + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0008, now + decay);

    osc.connect(amp);
    overtone.connect(overtoneGain);
    overtoneGain.connect(amp);
    amp.connect(out);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + decay + 0.05);
    overtone.stop(now + 0.12);
  }

  private playSax(freq: number, now: number, vel: number): ActiveVoice {
    const ctx = this.ctx!;
    const out = this.compressor!;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    lfo.frequency.setValueAtTime(5.2, now);
    lfoGain.gain.setValueAtTime(0, now);
    lfoGain.gain.linearRampToValueAtTime(3.5, now + 0.35);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(Math.min(2800, freq * 2.8), now);
    filter.Q.value = 1.6;

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(0.45 * vel, now + 0.055);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(out);

    osc.start(now);
    lfo.start(now);

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        const t = ctx.currentTime;
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(Math.max(amp.gain.value, 0.0005), t);
        amp.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
        try {
          osc.stop(t + 0.22);
          lfo.stop(t + 0.22);
        } catch {
          // already stopped
        }
      },
    };
  }

  private playFlute(freq: number, now: number, vel: number): ActiveVoice {
    const ctx = this.ctx!;
    const out = this.compressor!;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const amp = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2, now);

    lfo.frequency.setValueAtTime(4.8, now);
    lfoGain.gain.setValueAtTime(0, now);
    lfoGain.gain.linearRampToValueAtTime(4.5, now + 0.3);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(0.36 * vel, now + 0.07);

    // Subtle breath transient
    if (this.noiseBuffer) {
      const breath = ctx.createBufferSource();
      breath.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * 4;
      bp.Q.value = 3;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.08 * vel, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      breath.connect(bp);
      bp.connect(bg);
      bg.connect(out);
      breath.start(now);
      breath.stop(now + 0.16);
    }

    osc.connect(amp);
    amp.connect(out);

    osc.start(now);
    lfo.start(now);

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        const t = ctx.currentTime;
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(Math.max(amp.gain.value, 0.0005), t);
        amp.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
        try {
          osc.stop(t + 0.26);
          lfo.stop(t + 0.26);
        } catch {
          // already stopped
        }
      },
    };
  }

  // --- DRUM & PERCUSSION VOICES ---

  private triggerDrum(pad: number, now: number, vel: number): void {
    const idx = ((pad % 8) + 8) % 8;
    switch (idx) {
      case 0: // Kick
        this.synthPitchDrop(145, 42, 0.28, 0.85 * vel, now);
        break;
      case 1: // Snare
        this.synthPitchDrop(210, 110, 0.12, 0.35 * vel, now);
        this.synthNoiseBurst(1200, 'highpass', 0.18, 0.55 * vel, now);
        break;
      case 2: // Closed Hi-Hat
        this.synthNoiseBurst(6800, 'highpass', 0.06, 0.38 * vel, now);
        break;
      case 3: // Open Hi-Hat
        this.synthNoiseBurst(6200, 'highpass', 0.32, 0.38 * vel, now);
        break;
      case 4: // Low Tom
        this.synthPitchDrop(130, 72, 0.24, 0.65 * vel, now);
        break;
      case 5: // Mid Tom
        this.synthPitchDrop(195, 118, 0.2, 0.6 * vel, now);
        break;
      case 6: // Clap
        this.synthNoiseBurst(1600, 'bandpass', 0.14, 0.55 * vel, now);
        this.synthNoiseBurst(1600, 'bandpass', 0.12, 0.4 * vel, now + 0.018);
        break;
      case 7: // Crash
        this.synthNoiseBurst(4500, 'highpass', 0.85, 0.42 * vel, now);
        break;
    }
  }

  private triggerPercussion(pad: number, now: number, vel: number): void {
    const idx = ((pad % 8) + 8) % 8;
    switch (idx) {
      case 0: // Conga Lo
        this.synthPitchDrop(240, 165, 0.22, 0.65 * vel, now);
        break;
      case 1: // Conga Hi
        this.synthPitchDrop(350, 245, 0.18, 0.6 * vel, now);
        break;
      case 2: // Woodblock
        this.synthToneClick(780, 0.07, 0.55 * vel, now);
        break;
      case 3: // Shaker
        this.synthNoiseBurst(5200, 'bandpass', 0.09, 0.36 * vel, now);
        break;
      case 4: // Clave
        this.synthToneClick(2450, 0.045, 0.48 * vel, now);
        break;
      case 5: // Triangle
        this.synthToneClick(3900, 0.55, 0.3 * vel, now);
        break;
      case 6: // Cowbell
        this.synthToneClick(560, 0.18, 0.4 * vel, now, 'square');
        this.synthToneClick(845, 0.16, 0.28 * vel, now, 'square');
        break;
      case 7: // Rim
        this.synthToneClick(1480, 0.04, 0.5 * vel, now, 'triangle');
        break;
    }
  }

  private synthPitchDrop(startHz: number, endHz: number, dur: number, vol: number, now: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(endHz, now + dur * 0.65);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.compressor!);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private synthToneClick(
    hz: number,
    dur: number,
    vol: number,
    now: number,
    type: OscillatorType = 'sine'
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.compressor!);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private synthNoiseBurst(
    freq: number,
    filterType: BiquadFilterType,
    dur: number,
    vol: number,
    now: number
  ): void {
    if (!this.ctx || !this.noiseBuffer || !this.compressor) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);

    src.start(now);
    src.stop(now + dur + 0.02);
  }

  private createRoomImpulse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return impulse;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 256;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    if (amount <= 0.01) {
      for (let i = 0; i < samples; i++) {
        curve[i] = (i * 2) / samples - 1;
      }
      return curve;
    }
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}

export const audioEngine = new AudioEngineService();
