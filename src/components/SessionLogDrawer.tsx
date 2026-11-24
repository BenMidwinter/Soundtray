import React, { useState } from 'react';
import { Check, ClipboardList, Copy, X } from 'lucide-react';
import { SessionEvent, SessionEventType } from '../types';

interface SessionLogDrawerProps {
  roomId: string;
  events: SessionEvent[];
  onClose: () => void;
}

const BADGE_STYLE: Record<SessionEventType, string> = {
  PLAYER_JOIN: 'bg-emerald-900/70 text-emerald-200 border-emerald-700/60',
  PLAYER_LEAVE: 'bg-stone-800 text-stone-300 border-stone-600/60',
  INSTRUMENT_OPEN: 'bg-amber-900/70 text-amber-200 border-amber-700/60',
  INSTRUMENT_CLOSE: 'bg-amber-950/70 text-amber-300/80 border-amber-800/50',
  INSTRUMENT_PERFORMANCE: 'bg-amber-800/85 text-amber-100 border-amber-500/75',
  ITEM_PLACE: 'bg-sky-900/70 text-sky-200 border-sky-700/60',
  ITEM_MOVE: 'bg-sky-950/70 text-sky-300 border-sky-800/60',
  ITEM_FLIP: 'bg-sky-950/70 text-sky-300 border-sky-800/60',
  ITEM_REMOVE: 'bg-rose-900/70 text-rose-200 border-rose-700/60',
  ROOM_TIDY: 'bg-rose-950/80 text-rose-200 border-rose-700/60',
  PRESET_APPLIED: 'bg-purple-900/70 text-purple-200 border-purple-700/60',
  SETTINGS_CHANGED: 'bg-indigo-900/70 text-indigo-200 border-indigo-700/60',
  CONNECT4_MOVE: 'bg-blue-900/70 text-blue-200 border-blue-700/60',
  CONNECT4_WIN: 'bg-yellow-800/80 text-yellow-100 border-yellow-600/60',
  CONNECT4_RESET: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
  TICTACTOE_MOVE: 'bg-orange-900/70 text-orange-200 border-orange-700/60',
  TICTACTOE_WIN: 'bg-yellow-800/80 text-yellow-100 border-yellow-600/60',
  TICTACTOE_RESET: 'bg-orange-950/80 text-orange-300 border-orange-800/60',
  MEMORY_MATCH: 'bg-teal-900/70 text-teal-200 border-teal-700/60',
  MEMORY_WIN: 'bg-yellow-800/80 text-yellow-100 border-yellow-600/60',
  MEMORY_RESET: 'bg-teal-950/80 text-teal-300 border-teal-800/60',
  PET_INTERACT: 'bg-pink-900/70 text-pink-200 border-pink-700/60',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Unobtrusive collapsible session event log (closed by default) so the therapist
 * can review meaningful room interactions and inspect the exact event schema
 * before wiring Firebase Realtime Database.
 */
export const SessionLogDrawer: React.FC<SessionLogDrawerProps> = ({
  roomId,
  events,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ roomId, events }, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <aside className="fixed right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-[#281309]/98 backdrop-blur-md border-l-2 border-[#a86a3a] shadow-2xl z-30 flex flex-col text-[#faedcd]">
      <div className="px-4 py-3 bg-[#3b1d0e] border-b border-[#8b552c]/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#e09f3e]" />
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-[#e09f3e]">
              Session Events
            </h2>
            <p className="text-[10px] text-[#d4a373]">{events.length} recorded in {roomId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#231209] hover:bg-[#5c2c16] border border-[#8b552c] text-[10px] font-semibold"
            title="Copy structured event log JSON"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-[#e09f3e]" />}
            {copied ? 'Copied' : 'JSON'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md bg-[#231209] hover:bg-[#5c2c16] border border-[#8b552c]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <p className="text-xs text-[#d4a373]/70 text-center py-8">
            No session events recorded yet.
          </p>
        ) : (
          [...events].reverse().map((evt) => {
            const transcript =
              typeof evt.payload?.transcript === 'string' && evt.payload.transcript.length > 0
                ? evt.payload.transcript
                : null;
            return (
              <div
                key={evt.id}
                className="bg-[#3b1d0e]/70 border border-[#8b552c]/50 rounded-lg p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      BADGE_STYLE[evt.type]
                    }`}
                  >
                    {evt.type}
                  </span>
                  <span className="text-[10px] font-mono text-[#d4a373]/75">
                    {formatTime(evt.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-[#faedcd] leading-snug">{evt.summary}</p>
                {transcript && (
                  <p className="text-[10px] font-mono leading-relaxed text-[#f4d38a]/90 bg-[#1f0e06]/85 border border-[#8b552c]/45 rounded-md p-2 max-h-24 overflow-y-auto break-words">
                    {transcript}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-2 bg-[#1f0e06] border-t border-[#8b552c]/50 text-[10px] text-[#d4a373]/80">
        Captures room events and grouped timestamped musical passages per instrument turn.
      </div>
    </aside>
  );
};
