import React, { useState } from 'react';
import { RotateCcw, Trophy, Users, X } from 'lucide-react';
import { audioEngine } from '../services/AudioEngine';
import { Connect4State } from '../types';

interface Connect4ModalProps {
  state: Connect4State;
  localPlayerId: string;
  playerCount: number;
  onDropDisc: (col: number, colorOverride?: 1 | 2) => boolean;
  onSetTurnMode: (mode: 'turn-based' | 'free-play') => void;
  onClaimSeat: (seat: 1 | 2) => void;
  onReset: () => void;
  onClose: () => void;
}

export const Connect4Modal: React.FC<Connect4ModalProps> = ({
  state,
  localPlayerId,
  playerCount,
  onDropDisc,
  onSetTurnMode,
  onClaimSeat,
  onReset,
  onClose,
}) => {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [freePickColor, setFreePickColor] = useState<1 | 2 | null>(null);

  const isSolo = playerCount <= 1;
  const isTurnLocked = !isSolo && state.turnMode === 'turn-based';

  const currentSeat = state.seats[state.currentTurn];
  const otherTurn: 1 | 2 = state.currentTurn === 1 ? 2 : 1;
  const otherSeat = state.seats[otherTurn];

  const isMyTurn =
    !isTurnLocked ||
    (currentSeat
      ? currentSeat.playerId === localPlayerId
      : otherSeat?.playerId !== localPlayerId);

  const activeColor: 1 | 2 =
    !isTurnLocked && freePickColor ? freePickColor : state.currentTurn;

  const isWinningCell = (r: number, c: number) =>
    state.winningCells.some(([wr, wc]) => wr === r && wc === c);

  const handleColumnClick = (col: number) => {
    if (state.winner !== 0 || !isMyTurn) return;
    const dropped = onDropDisc(col, !isTurnLocked ? freePickColor ?? undefined : undefined);
    if (dropped) {
      audioEngine.playUiCue('disc_drop');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#3b1d0e] border-2 border-[#e09f3e] rounded-2xl shadow-2xl p-5 space-y-3.5 text-[#faedcd]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black tracking-wide text-[#e09f3e]">CONNECT 4</h2>
            <p className="text-xs text-[#d4a373]">
              {isSolo
                ? 'Solo play — turn-taking automatically activates when 2+ people join'
                : 'Synced shared board with player turn-taking'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#281309] hover:bg-[#5c2c16] border border-[#8b552c] text-[#faedcd]"
            aria-label="Close Connect 4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Turn-Taking Seats Bar (visible when 2+ people are in the room) */}
        {!isSolo && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#231209] border border-[#8b552c]/60 rounded-xl px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[#e09f3e]" />
              <button
                type="button"
                onClick={() => onClaimSeat(1)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                  state.seats[1]?.playerId === localPlayerId
                    ? 'bg-red-900/60 border-red-400 text-white font-bold'
                    : 'bg-[#2b150a] border-[#8b552c] text-[#d4a373] hover:text-[#faedcd]'
                }`}
                title="Take Red seat"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                {state.seats[1]?.name ?? 'Join Red'}
              </button>
              <button
                type="button"
                onClick={() => onClaimSeat(2)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                  state.seats[2]?.playerId === localPlayerId
                    ? 'bg-amber-900/60 border-yellow-300 text-white font-bold'
                    : 'bg-[#2b150a] border-[#8b552c] text-[#d4a373] hover:text-[#faedcd]'
                }`}
                title="Take Yellow seat"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                {state.seats[2]?.name ?? 'Join Yellow'}
              </button>
            </div>

            <div className="inline-flex rounded-lg bg-[#3b1d0e] p-0.5 border border-[#8b552c]">
              <button
                type="button"
                onClick={() => {
                  setFreePickColor(null);
                  onSetTurnMode('turn-based');
                }}
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

        {/* Turn Status / Colour Picker */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#281309] border border-[#8b552c]/60 rounded-xl px-3 py-2">
          {state.winner === 1 || state.winner === 2 ? (
            <div className="flex items-center gap-2 text-sm font-bold text-[#e09f3e]">
              <Trophy className="w-4 h-4" />
              <span>{state.winner === 1 ? 'Red' : 'Yellow'} wins!</span>
            </div>
          ) : state.winner === 'draw' ? (
            <span className="text-sm font-bold text-[#faedcd]">Board full — it&apos;s a draw!</span>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-4 h-4 rounded-full border-2 border-white/70 ${
                  activeColor === 1 ? 'bg-red-500' : 'bg-yellow-400'
                }`}
              />
              <span className="font-semibold">
                {isTurnLocked
                  ? isMyTurn
                    ? `Your turn (${state.currentTurn === 1 ? 'Red' : 'Yellow'})`
                    : `Waiting for ${
                        currentSeat?.name ?? (state.currentTurn === 1 ? 'Red' : 'Yellow')
                      }...`
                  : freePickColor
                  ? `Free Play: ${freePickColor === 1 ? 'Red' : 'Yellow'}`
                  : `${state.currentTurn === 1 ? 'Red' : 'Yellow'}'s turn`}
              </span>
            </div>
          )}

          {/* Free colour picker (available solo or in Free Play mode) */}
          {!isTurnLocked && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#d4a373]">Disc:</span>
              <button
                type="button"
                onClick={() => setFreePickColor(null)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  freePickColor === null
                    ? 'bg-[#e09f3e] text-[#231209] border-[#faedcd]'
                    : 'bg-[#3b1d0e] text-[#d4a373] border-[#8b552c]'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setFreePickColor(1)}
                className={`w-5 h-5 rounded-full bg-red-500 border-2 ${
                  freePickColor === 1 ? 'border-white scale-110' : 'border-red-900 opacity-75'
                }`}
                title="Drop Red discs freely"
              />
              <button
                type="button"
                onClick={() => setFreePickColor(2)}
                className={`w-5 h-5 rounded-full bg-yellow-400 border-2 ${
                  freePickColor === 2 ? 'border-white scale-110' : 'border-yellow-900 opacity-75'
                }`}
                title="Drop Yellow discs freely"
              />
            </div>
          )}
        </div>

        {/* Column Drop Preview Row */}
        <div className="grid grid-cols-7 gap-2 px-3">
          {Array.from({ length: 7 }).map((_, col) => {
            const colHasSpace = state.board[0][col] === 0 && state.winner === 0 && isMyTurn;
            return (
              <div key={col} className="h-7 flex items-center justify-center">
                {hoverCol === col && colHasSpace && (
                  <div
                    className={`w-7 h-7 rounded-full border-2 border-white/70 shadow-md transition-transform ${
                      activeColor === 1 ? 'bg-red-500' : 'bg-yellow-400'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Royal Blue Connect 4 Frame */}
        <div className="bg-[#1d4ed8] border-4 border-[#1e3a8a] rounded-2xl p-3 shadow-inner">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 6 }).map((_, r) =>
              Array.from({ length: 7 }).map((__, c) => {
                const val = state.board[r][c];
                const winning = isWinningCell(r, c);
                const isLast = state.lastMove?.row === r && state.lastMove?.col === c;
                const canDrop = state.winner === 0 && state.board[0][c] === 0 && isMyTurn;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onMouseEnter={() => setHoverCol(c)}
                    onMouseLeave={() => setHoverCol(null)}
                    onClick={() => handleColumnClick(c)}
                    disabled={!canDrop}
                    className="aspect-square rounded-full bg-[#172554] p-0.5 flex items-center justify-center focus:outline-none disabled:cursor-default cursor-pointer"
                    aria-label={`Column ${c + 1}, Row ${r + 1}`}
                  >
                    <div
                      className={`w-full h-full rounded-full transition-all duration-150 ${
                        val === 1
                          ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-inner'
                          : val === 2
                          ? 'bg-gradient-to-br from-yellow-300 to-amber-500 shadow-inner'
                          : 'bg-[#281309]/85'
                      } ${
                        winning
                          ? 'ring-4 ring-white animate-pulse'
                          : isLast
                          ? 'ring-2 ring-white/70'
                          : ''
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#d4a373]">
            {state.lastMove
              ? `Last move: ${state.lastMove.actorName} (${
                  state.lastMove.player === 1 ? 'Red' : 'Yellow'
                }, col ${state.lastMove.col + 1})`
              : isMyTurn
              ? 'Click any column to drop a disc'
              : 'Waiting for your partner to move'}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5c2c16] hover:bg-[#7c3c1f] border border-[#a86a3a] text-xs font-bold text-[#faedcd]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#e09f3e]" />
            New Game
          </button>
        </div>
      </div>
    </div>
  );
};
