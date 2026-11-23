import React from 'react';
import { BookmarkPlus, DoorClosed, DoorOpen } from 'lucide-react';

interface ExitDoorModalProps {
  roomId: string;
  onStay: () => void;
  onOpenPresets: () => void;
  onConfirmLeave: () => void;
}

/**
 * Clinical Exit Door boundary dialog — offers a calm, intentional transition
 * out of the therapy room rather than an abrupt disconnect.
 */
export const ExitDoorModal: React.FC<ExitDoorModalProps> = ({
  roomId,
  onStay,
  onOpenPresets,
  onConfirmLeave,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onStay}
    >
      <div
        className="w-full max-w-md bg-[#3b1d0e] border-2 border-[#a86a3a] rounded-2xl shadow-2xl p-6 space-y-5 text-[#faedcd]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#281309] border border-[#e09f3e]/60 flex items-center justify-center flex-shrink-0">
            <DoorOpen className="w-5 h-5 text-[#e09f3e]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#faedcd]">Step out of the music room?</h2>
            <p className="text-xs text-[#d4a373] mt-1 leading-relaxed">
              You&apos;re closing the door on room <span className="font-mono text-[#faedcd]">{roomId}</span>.
              If you&apos;d like to keep today&apos;s room arrangement for next time, you can save it as a
              preset first.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirmLeave}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#e09f3e] hover:bg-[#eba945] text-[#231209] text-sm font-bold"
          >
            <DoorClosed className="w-4 h-4" />
            Close the Door &amp; Leave
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenPresets}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#281309] hover:bg-[#5c2c16] border border-[#8b552c] text-xs font-semibold text-[#faedcd]"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-[#e09f3e]" />
              Save Layout First
            </button>

            <button
              type="button"
              onClick={onStay}
              className="px-3 py-2 rounded-xl bg-[#5c2c16] hover:bg-[#7c3c1f] border border-[#a86a3a] text-xs font-semibold text-[#faedcd]"
            >
              Stay in Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
