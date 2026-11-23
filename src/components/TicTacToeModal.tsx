import React from 'react';
import { RotateCcw, Trophy, Users, X } from 'lucide-react';
import { audioEngine } from '../services/AudioEngine';
import { TicTacToeState } from '../types';

interface TicTacToeModalProps {
  state: TicTacToeState;
  localPlayerId: string;
  playerCount: number;
  onPlayCell: (index: number) => boolean;
  onSetTurnMode: (mode: 'turn-based' | 'free-play') => void;
  onClaimSeat: (seat: 1 | 2) => void;
  onReset: () => void;
  onClose: () => void;
}

export const TicTacToeModal: React.FC<TicTacToeModalProps> = ({
  state,
  localPlayerId,
  playerCount,
  onPlayCell,
  onSetTurnMode,
  onClaimSeat,
  onReset,
  onClose,
}) => {
  const isSolo = playerCount <= 1;
  const isTurnLocked = !isSolo && state.turnMode === 'turn-based';
  const currentSeat = state.seats[state.currentTurn];
  const otherSeat = state.seats[state.currentTurn === 1 ? 2 : 1];

  const isMyTurn =
    !isTurnLocked ||
    (currentSeat
      ? currentSeat.playerId === localPlayerId
      : otherSeat?.playerId !== localPlayerId);

  const handleCellClick = (index: number) => {
    if (state.winner !== 0 || !isMyTurn) return;
    if (onPlayCell(index)) {
      audioEngine.playUiCue('disc_drop');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#3b1d0e] border-2 border-[#e09f3e] rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3.5 text-[#faedcd]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black tracking-wide text-[#e09f3e]">
              NOUGHTS &amp; CROSSES
            </h2>
            <p className="text-xs text-[#d4a373]">
              {isSolo
                ? 'Solo warm-up — turn-taking activates automatically with 2+ people'
                : 'Synced wooden board with player turn-taking'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#281309] hover:bg-[#5c2c16] border border-[#8b552c]"
          >
            <X className="w-4 h-4" />
          </button>
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
                    ? 'bg-red-900/60 border-red-400 text-white'
                    : 'bg-[#2b150a] border-[#8b552c] text-[#d4a373]'
                }`}
              >
                X: {state.seats[1]?.name ?? 'Join'}
              </button>
              <button
                type="button"
                onClick={() => onClaimSeat(2)}
                className={`px-2 py-0.5 rounded-md border font-semibold ${
                  state.seats[2]?.playerId === localPlayerId
                    ? 'bg-amber-900/60 border-yellow-300 text-white'
                    : 'bg-[#2b150a] border-[#8b552c] text-[#d4a373]'
                }`}
              >
                O: {state.seats[2]?.name ?? 'Join'}
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

        {/* Turn Status + Scoreboard */}
        <div className="flex items-center justify-between gap-2 bg-[#281309] border border-[#8b552c]/60 rounded-xl px-3 py-2 text-xs">
          {state.winner === 1 || state.winner === 2 ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#e09f3e]">
              <Trophy className="w-4 h-4" />
              {state.winner === 1 ? 'X' : 'O'} wins!
            </span>
          ) : state.winner === 'draw' ? (
            <span className="text-sm font-bold text-[#faedcd]">It&apos;s a draw!</span>
          ) : (
            <span className="font-semibold">
              {isTurnLocked
                ? isMyTurn
                  ? `Your turn (${state.currentTurn === 1 ? 'X' : 'O'})`
                  : `Waiting for ${
                      currentSeat?.name ?? (state.currentTurn === 1 ? 'X' : 'O')
                    }...`
                : `${state.currentTurn === 1 ? 'X' : 'O'}'s turn`}
            </span>
          )}

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#d4a373]">
            <span className="text-red-400 font-bold">X:{state.scores[1]}</span>
            <span className="text-amber-300 font-bold">O:{state.scores[2]}</span>
            <span>Draw:{state.scores.draws}</span>
          </div>
        </div>

        {/* 3x3 Wooden Board */}
        <div className="bg-[#7c4a2d] border-4 border-[#5c2c16] rounded-2xl p-3 shadow-inner">
          <div className="grid grid-cols-3 gap-2.5">
            {state.board.map((cell, idx) => {
              const isWin = state.winningLine.includes(idx);
              const canPlay = cell === 0 && state.winner === 0 && isMyTurn;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canPlay}
                  onClick={() => handleCellClick(idx)}
                  className={`aspect-square rounded-xl border-2 flex items-center justify-center text-4xl font-black transition-all ${
                    isWin
                      ? 'bg-[#e09f3e]/30 border-[#faedcd] scale-[1.03]'
                      : cell === 0 && canPlay
                      ? 'bg-[#faedcd]/95 hover:bg-[#fefae0] border-[#a86a3a] cursor-pointer'
                      : 'bg-[#faedcd]/90 border-[#a86a3a] cursor-default'
                  }`}
                >
                  {cell === 1 ? (
                    <span className="text-[#c0392b] drop-shadow">X</span>
                  ) : cell === 2 ? (
                    <span className="text-[#d97706] drop-shadow">O</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#d4a373]">
            {state.lastMove
              ? `Last move: ${state.lastMove.actorName} (${state.lastMove.player === 1 ? 'X' : 'O'})`
              : 'Tap any square to place your piece'}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5c2c16] hover:bg-[#7c3c1f] border border-[#a86a3a] text-xs font-bold text-[#faedcd]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#e09f3e]" />
            New Round
          </button>
        </div>
      </div>
    </div>
  );
};
