import React, { useMemo, useState } from 'react';
import { Armchair, Dices, FlipHorizontal2, Music, Sparkles, Trash2 } from 'lucide-react';
import { ASSET_MANIFEST, ASSET_MAP } from '../assets/assetManifest';
import { AssetDefinition } from '../types';

interface ToyBoxProps {
  selectedAssetId: string | null;
  placeFlipped: boolean;
  onSelectAsset: (assetId: string | null) => void;
  onTogglePlaceFlipped: () => void;
  onTidyRoom: () => void;
  itemCount: number;
}

type TabId = 'instrument' | 'furniture' | 'game';

export const ToyBox: React.FC<ToyBoxProps> = ({
  selectedAssetId,
  placeFlipped,
  onSelectAsset,
  onTogglePlaceFlipped,
  onTidyRoom,
  itemCount,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('instrument');
  const [sofaColorId, setSofaColorId] = useState('sofa_red');
  const [beanbagColorId, setBeanbagColorId] = useState('beanbag_red');

  const instruments = useMemo(
    () => ASSET_MANIFEST.filter((a) => a.category === 'instrument'),
    []
  );

  const games = useMemo(
    () => ASSET_MANIFEST.filter((a) => a.category === 'game'),
    []
  );

  const sofaVariants = useMemo(
    () => ASSET_MANIFEST.filter((a) => a.variantGroup === 'sofa'),
    []
  );

  const beanbagVariants = useMemo(
    () => ASSET_MANIFEST.filter((a) => a.variantGroup === 'beanbag'),
    []
  );

  const staticFurniture = useMemo(
    () => ASSET_MANIFEST.filter((a) => a.category === 'furniture' && !a.variantGroup),
    []
  );

  const renderCard = (def: AssetDefinition, labelOverride?: string, showMirrored = false) => {
    const isSelected = selectedAssetId === def.id;
    return (
      <button
        key={def.id}
        type="button"
        onClick={() => onSelectAsset(isSelected ? null : def.id)}
        className={`group flex-shrink-0 w-20 sm:w-24 p-1.5 sm:p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
          isSelected
            ? 'bg-[#e09f3e]/25 border-[#e09f3e] shadow-md -translate-y-0.5'
            : 'bg-[#281309]/90 border-[#8b552c]/50 hover:border-[#d4a373]'
        }`}
      >
        <div className="w-12 h-10 sm:w-14 sm:h-12 flex items-center justify-center">
          <img
            src={def.url}
            alt={def.name}
            loading="lazy"
            className={`max-w-full max-h-full object-contain pixelated pointer-events-none transition-transform ${
              showMirrored ? '-scale-x-100' : ''
            }`}
          />
        </div>
        <span className="text-[11px] font-medium text-[#faedcd] truncate w-full text-center">
          {labelOverride ?? def.name}
        </span>
      </button>
    );
  };

  const activeSofa = ASSET_MAP[sofaColorId];
  const activeBeanbag = ASSET_MAP[beanbagColorId];
  const isSofaSelected = selectedAssetId?.startsWith('sofa_') ?? false;
  const isBeanbagSelected = selectedAssetId?.startsWith('beanbag_') ?? false;

  return (
    <div className="pointer-events-auto w-full max-w-5xl mx-auto bg-[#3b1d0e]/95 backdrop-blur-md border-2 border-[#a86a3a] rounded-2xl shadow-2xl px-3 py-2 sm:px-4 sm:py-2.5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('instrument')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'instrument'
                ? 'bg-[#e09f3e] text-[#231209]'
                : 'bg-[#281309] text-[#d4a373] hover:text-[#faedcd]'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Instruments ({instruments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('furniture')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'furniture'
                ? 'bg-[#e09f3e] text-[#231209]'
                : 'bg-[#281309] text-[#d4a373] hover:text-[#faedcd]'
            }`}
          >
            <Armchair className="w-3.5 h-3.5" />
            Furniture
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('game')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'game'
                ? 'bg-[#e09f3e] text-[#231209]'
                : 'bg-[#281309] text-[#d4a373] hover:text-[#faedcd]'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            Games ({games.length})
          </button>

          <span className="hidden lg:inline-flex items-center gap-1 text-xs text-[#d4a373] ml-1">
            <Sparkles className="w-3.5 h-3.5 text-[#e09f3e]" />
            {selectedAssetId
              ? `Click the wooden floor to place "${ASSET_MAP[selectedAssetId]?.name}"`
              : 'Pick an item to place, drag items to move, or tap a placed sofa/beanbag to flip'}
          </span>
        </div>

        <button
          type="button"
          onClick={onTidyRoom}
          disabled={itemCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#7f2b1c] hover:bg-[#9c3422] disabled:opacity-40 text-[#faedcd] border border-[#b5442b] transition-colors"
          title="Clear all furniture, games, and instruments from the room"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Tidy Up Room
        </button>
      </div>

      {/* Item Strip */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1 touch-pan-x">
        {activeTab === 'instrument' ? (
          instruments.map((inst) => renderCard(inst))
        ) : activeTab === 'game' ? (
          games.map((g) => renderCard(g))
        ) : (
          <>
            {/* Grouped Sofas with Color Swatches + Flip Button (Sofas Only) */}
            {activeSofa && (
              <div className="flex-shrink-0 flex items-center gap-2 bg-[#281309]/80 border border-[#8b552c]/60 rounded-xl p-1.5">
                {renderCard(activeSofa, 'Sofa', isSofaSelected && placeFlipped)}
                <div className="flex flex-col justify-between gap-1.5 pr-1">
                  <div className="grid grid-cols-4 gap-1">
                    {sofaVariants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        title={v.name}
                        onClick={() => {
                          setSofaColorId(v.id);
                          onSelectAsset(v.id);
                        }}
                        className={`w-4 h-4 rounded-full border ${
                          sofaColorId === v.id
                            ? 'border-[#faedcd] scale-110 ring-1 ring-[#e09f3e]'
                            : 'border-black/40 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: v.variantHex }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSofaSelected) onSelectAsset(sofaColorId);
                      onTogglePlaceFlipped();
                    }}
                    className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                      isSofaSelected && placeFlipped
                        ? 'bg-[#e09f3e] text-[#231209] border-[#faedcd]'
                        : 'bg-[#3b1d0e] text-[#faedcd] border-[#8b552c] hover:border-[#e09f3e]'
                    }`}
                    title="Flip sofa direction"
                  >
                    <FlipHorizontal2 className="w-3 h-3" />
                    Flip
                  </button>
                </div>
              </div>
            )}

            {/* Grouped Beanbags with Color Swatches + Flip Button (Beanbags Only) */}
            {activeBeanbag && (
              <div className="flex-shrink-0 flex items-center gap-2 bg-[#281309]/80 border border-[#8b552c]/60 rounded-xl p-1.5">
                {renderCard(activeBeanbag, 'Beanbag', isBeanbagSelected && placeFlipped)}
                <div className="flex flex-col justify-between gap-1.5 pr-1">
                  <div className="grid grid-cols-4 gap-1">
                    {beanbagVariants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        title={v.name}
                        onClick={() => {
                          setBeanbagColorId(v.id);
                          onSelectAsset(v.id);
                        }}
                        className={`w-4 h-4 rounded-full border ${
                          beanbagColorId === v.id
                            ? 'border-[#faedcd] scale-110 ring-1 ring-[#e09f3e]'
                            : 'border-black/40 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: v.variantHex }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isBeanbagSelected) onSelectAsset(beanbagColorId);
                      onTogglePlaceFlipped();
                    }}
                    className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                      isBeanbagSelected && placeFlipped
                        ? 'bg-[#e09f3e] text-[#231209] border-[#faedcd]'
                        : 'bg-[#3b1d0e] text-[#faedcd] border-[#8b552c] hover:border-[#e09f3e]'
                    }`}
                    title="Flip beanbag direction"
                  >
                    <FlipHorizontal2 className="w-3 h-3" />
                    Flip
                  </button>
                </div>
              </div>
            )}

            {staticFurniture.map((item) => renderCard(item))}
          </>
        )}
      </div>
    </div>
  );
};
