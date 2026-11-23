import React, { useState } from 'react';
import { BookmarkPlus, LayoutGrid, Trash2, X } from 'lucide-react';
import {
  BUILT_IN_PRESETS,
  deleteCustomPreset,
  loadCustomPresets,
  saveCustomPreset,
} from '../assets/roomPresets';
import { RoomItem, RoomPreset, RoomSettings } from '../types';

interface RoomPresetsModalProps {
  currentItems: RoomItem[];
  currentSettings: RoomSettings;
  onApplyPreset: (preset: RoomPreset) => void;
  onClose: () => void;
}

export const RoomPresetsModal: React.FC<RoomPresetsModalProps> = ({
  currentItems,
  currentSettings,
  onApplyPreset,
  onClose,
}) => {
  const [customPresets, setCustomPresets] = useState<RoomPreset[]>(() => loadCustomPresets());
  const [presetName, setPresetName] = useState('');

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = presetName.trim();
    if (!clean) return;
    const newPreset: RoomPreset = {
      id: `custom-${Date.now()}`,
      name: clean,
      description: `${currentItems.length} item${currentItems.length === 1 ? '' : 's'} · ${
        currentSettings.timeOfDay
      } lighting`,
      builtIn: false,
      items: currentItems.map((i) => ({ ...i })),
      settings: { ...currentSettings },
    };
    setCustomPresets(saveCustomPreset(newPreset));
    setPresetName('');
  };

  const handleDelete = (id: string) => {
    setCustomPresets(deleteCustomPreset(id));
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col bg-[#3b1d0e] border-2 border-[#a86a3a] rounded-2xl shadow-2xl overflow-hidden text-[#faedcd]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#281309] border-b border-[#8b552c]/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-[#e09f3e]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-[#e09f3e]">
              Room Layout Presets
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#3b1d0e] hover:bg-[#5c2c16] border border-[#8b552c]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Save Current Room */}
          <form onSubmit={handleSaveCurrent} className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#d4a373]">
              Save Current Room Arrangement ({currentItems.length} items)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                maxLength={32}
                placeholder="e.g., Sam's Tuesday Setup"
                className="flex-1 px-3 py-2 rounded-lg bg-[#231209] border border-[#8b552c] text-sm text-[#faedcd] placeholder-[#d4a373]/40 focus:outline-none focus:border-[#e09f3e]"
              />
              <button
                type="submit"
                disabled={!presetName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e09f3e] hover:bg-[#eba945] disabled:opacity-40 text-[#231209] text-xs font-bold"
              >
                <BookmarkPlus className="w-4 h-4" />
                Save
              </button>
            </div>
          </form>

          {/* Saved Custom Presets */}
          {customPresets.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4a373]">
                Your Saved Rooms
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {customPresets.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#281309] border border-[#8b552c]/70 rounded-xl p-3 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-[#faedcd]">{p.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-[#d4a373]/60 hover:text-red-400 p-0.5"
                          title="Delete saved preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#d4a373] mt-0.5">{p.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPreset(p);
                        onClose();
                      }}
                      className="w-full py-1.5 rounded-lg bg-[#5c2c16] hover:bg-[#7c3c1f] border border-[#a86a3a] text-xs font-bold text-[#faedcd]"
                    >
                      Load Room
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Built-In Clinical Presets */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4a373]">
              Built-In Layouts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BUILT_IN_PRESETS.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#281309] border border-[#8b552c]/70 rounded-xl p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#faedcd]">{p.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#3b1d0e] text-[#d4a373]">
                        {p.items.length} items
                      </span>
                    </div>
                    <p className="text-[11px] text-[#d4a373] mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPreset(p);
                      onClose();
                    }}
                    className="w-full py-1.5 rounded-lg bg-[#5c2c16] hover:bg-[#7c3c1f] border border-[#a86a3a] text-xs font-bold text-[#faedcd]"
                  >
                    Load Layout
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
