import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Music, RotateCcw, Trophy, Users, Volume2, X } from 'lucide-react';
import { audioEngine } from '../services/AudioEngine';
import { RoomSettings, SoundMemoryCard, SoundMemoryState } from '../types';

interface SoundMemoryModalProps {
  state: SoundMemoryState;
  settings: RoomSettings;
  localPlayerId: string;
  playerCount: number;
  onFlipCard: (
    index: number
  ) => { card: SoundMemoryCard; matched: boolean; mismatch: boolean } | null;
  onResolveMismatch: () => void;
  onSetTurnMode: (mode: 'turn-based' | 'free-play') => void;
  onClaimSeat: (seat: 1 | 2) => void;
  onReset: () => void;
  onClose: () => void;
}

export const SoundMemoryModal: React.FC<SoundMemoryModalProps> = ({
  state,
  settings,
  localPlayerId,
  playerCount,
  onFlipCard,
  onResolveMismatch,
  onSetTurnMode,
  onClaimSeat,
  onReset,
  onClose,
}) => {
  const [showVisualHints, setShowVisualHints] = useState(false);
  const [playingCardIndex, setPlayingCardIndex] = useState<number | null>(null);
  const mismatchTimerRef = useRef<number | null>(null);

  const isSolo = playerCount <= 1;
  const isTurnLocked = !isSolo && state.turnMode === 'turn-based';
  const currentSeat = state.seats[state.currentTurn];
  const otherSeat = state.seats[state.currentTurn === 1 ? 2 : 1];

  const isMyTurn =
    !isTurnLocked ||
    (currentSeat
      ? currentSeat.playerId === localPlayerId
      : otherSeat?.playerId !== localPlayerId);

  // Clean up mismatch timer on unmount
  useEffect(() => {
    return () => {
      if (mismatchTimerRef.current) window.clearTimeout(mismatchTimerRef.current);
    };
  }, []);

  // Play motif when a remote partner flips a card so BOTH parties hear the musical card!
  const prevFlippedLenRef = useRef<number>(state.flippedIndices.length);
  const lastRemoteTimestampRef = useRef<number>(state.lastFlippedAt);
  useEffect(() => {
    if (
      state.lastFlippedAt > lastRemoteTimestampRef.current &&
      state.flippedIndices.length > prevFlippedLenRef.current
    ) {
      const newestIdx = state.flippedIndices[state.flippedIndices.length - 1];
      const card = state.cards[newestIdx];
      if (card) {
        audioEngine.playMotif(card.instrument, settings.rootMidi, settings.scaleId, card.degrees);
        setPlayingCardIndex(newestIdx);
        window.setTimeout(() => setPlayingCardIndex(null), 550);
      }
    }
    prevFlippedLenRef.current = state.flippedIndices.length;
    lastRemoteTimestampRef.current = state.lastFlippedAt;
  }, [state.cards, state.flippedIndices, state.lastFlippedAt, settings.rootMidi, settings.scaleId]);

  const handleCardClick = (index: number) => {
    if (!isMyTurn || state.winner !== 0 || state.flippedIndices.length >= 2) return;
    const res = onFlipCard(index);
    if (!res) return;

    // Immediately play the musical motif in the room's active key & scale
    lastRemoteTimestampRef.current = Date.now() + 50;
    audioEngine.playMotif(
      res.card.instrument,
      settings.rootMidi,
      settings.scaleId,
      res.card.degrees
    );
    setPlayingCardIndex(index);
    window.setTimeout(() => setPlayingCardIndex((cur) => (cur === index ? null : cur)), 550);

    if (res.matched) {
      window.setTimeout(() => audioEngine.playUiCue('connect4_win'), 480);
    } else if (res.mismatch) {
      if (mismatchTimerRef.current) window.clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = window.setTimeout(() => {
        onResolveMismatch();
      }, 1250);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-[#3b1d0e] border-2 border-[#e09f3e] rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3 text-[#faedcd]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black tracking-wide text-[#e09f3e]">
              SOUND-MATCHING MEMORY
            </h2>
            <p className="text-xs text-[#d4a373]">
              Listen to each musical motif and match the 6 instrument pairs
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowVisualHints((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                showVisualHints
                  ? 'bg-[#e09f3e]/25 border-[#e09f3e] text-[#faedcd]'
                  : 'bg-[#281309] border-[#8b552c] text-[#d4a373]'
              }`}
              title="Optionally show instrument names when cards flip"
            >
              {showVisualHints ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Hints
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#281309] hover:bg-[#5c2c16] border border-[#8b552c]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Turn-Taking Seats Bar (2+ players) */}
        {!isSolo && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#231209] border border-[#8b552c]/60 rounded-xl px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[#e09f3e]" />
              <button
                type="button"
                onClick={() => onClaimSeat(1)}
                className={`px-2 py-0.5 rounded-md border font-semibold ${
                  state.seats[1]?.playerId === localPlayerId
                    ? 'bg-[#e09f3e]/30 border-[#e09f3e] text-white'
                    : 'bg-[#2b150a] border-[#8b552c] text-[#d4a373]'
                }`}
              >
                P1: {state.seats[1]?.name ?? 'Join'} ({state.scores[1]})
              </button>
              <button
                type="button"
                onClick={() => onClaimSeat(2)}
                className={`px-2 py-0.5 rounded-md border font-semibold ${
                  state.seats[2]?.playerId === localPlayerId
                    ? 'bg-teal-900/60 border-teal-400 text-white'
                    : 'bg-[#2b150a] border-[#8b552c] text-[#d4a373]'
                }`}
              >
                P2: {state.seats[2]?.name ?? 'Join'} ({state.scores[2]})
              </button>
            </div>

            <div className="inline-flex rounded-lg bg-[#3b1d0e] p-0.5 border border-[#8b552c]">
              <button
                type="button"
                onClick={() => onSetTurnMode('turn-based')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  state.turnMode === 'turn-based'
                    ? 'bg-[#e09f3e] text-[#231209]'
                    : 'text-[#d4a373]'
                }`}
              >
                Take Turns
              </button>
              <button
                type="button"
                onClick={() => onSetTurnMode('free-play')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  state.turnMode === 'free-play'
                    ? 'bg-[#e09f3e] text-[#231209]'
                    : 'text-[#d4a373]'
                }`}
              >
                Free Play
              </button>
            </div>
          </div>
        )}

        {/* Turn Status */}
        <div className="flex items-center justify-between gap-2 bg-[#281309] border border-[#8b552c]/60 rounded-xl px-3 py-2 text-xs">
          {state.winner !== 0 ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#e09f3e]">
              <Trophy className="w-4 h-4" />
              {state.winner === 'draw'
                ? 'All 6 pairs matched — a tie!'
                : `All 6 pairs matched! ${
                    state.seats[state.winner]?.name ?? `Player ${state.winner}`
                  } wins!`}
            </span>
          ) : (
            <span className="font-semibold">
              {isTurnLocked
                ? isMyTurn
                  ? `Your turn (Player ${state.currentTurn}) — match a pair for a bonus turn`
                  : `Waiting for ${currentSeat?.name ?? `Player ${state.currentTurn}`}...`
                : `Pairs found: ${state.scores[1] + state.scores[2]} / 6`}
            </span>
          )}
          <span className="text-[11px] text-[#d4a373]">
            {state.flippedIndices.length === 2 ? 'Listening...' : 'Flip 2 cards'}
          </span>
        </div>

        {/* 4x3 Musical Memory Card Grid */}
        <div className="bg-[#5c2c16] border-4 border-[#2b150a] rounded-2xl p-3 shadow-inner">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {state.cards.map((card, idx) => {
              const isFlipped = state.flippedIndices.includes(idx);
              const isFaceUp = card.matched || isFlipped;
              const isPlaying = playingCardIndex === idx;
              const canClick =
                !isFaceUp && state.winner === 0 && state.flippedIndices.length < 2 && isMyTurn;

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    if (card.matched) {
                      // Re-listen to any matched pair gently!
                      audioEngine.playMotif(
                        card.instrument,
                        settings.rootMidi,
                        settings.scaleId,
                        card.degrees
                      );
                      setPlayingCardIndex(idx);
                      window.setTimeout(() => setPlayingCardIndex(null), 500);
                    } else if (canClick) {
                      handleCardClick(idx);
                    }
                  }}
                  className={`h-20 sm:h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 transition-all ${
                    card.matched
                      ? 'bg-[#fefae0] border-[#e09f3e] text-[#3b1d0e]'
                      : isFlipped
                      ? 'bg-[#faedcd] border-white text-[#3b1d0e] scale-[1.03] shadow-lg'
                      : canClick
                      ? 'bg-gradient-to-br from-[#2b4d82] to-[#1e3a66] hover:from-[#365f9e] hover:to-[#24457a] border-[#a86a3a] text-[#e09f3e] cursor-pointer'
                      : 'bg-[#1e3a66]/80 border-[#8b552c]/60 text-[#e09f3e]/60 cursor-default'
                  } ${isPlaying ? 'ring-2 ring-[#e09f3e]' : ''}`}
                >
                  {isFaceUp ? (
                    <>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow"
                        style={{ backgroundColor: card.matched || showVisualHints ? card.accentHex : '#5c2c16' }}
                      >
                        {isPlaying ? (
                          <Volume2 className="w-4 h-4 animate-pulse" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-center leading-tight">
                        {card.matched || showVisualHints ? card.label : 'Listen...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Music className="w-5 h-5 opacity-90" />
                      <span className="text-[10px] font-mono text-[#faedcd]/70">#{idx + 1}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#d4a373]">
            Tip: Tap any matched card to hear its motif again
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5c2c16] hover:bg-[#7c3c1f] border border-[#a86a3a] text-xs font-bold text-[#faedcd]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#e09f3e]" />
            New Shuffle
          </button>
        </div>
      </div>
    </div>
  );
};
