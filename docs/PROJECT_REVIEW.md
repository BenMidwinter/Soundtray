# Soundtray — Project Review & Rebuild Architecture

## 1. Review of Prior AI Studio Iterations

Across December 2025 – February 2026, four AI Studio sessions explored Soundtray's concept.

### What Worked Well
- **Clinical & Creative Vision:** The digital "Sandtray" framing — warm oak/mahogany room, non-directive exploration, full-volume acoustics (no spatial attenuation), Pru the Jack Russell Terrier, and an explicit Exit Door boundary — is cohesive and distinctive.
- **The "Mandaloop" Audio Model:** Sending lightweight `NOTE_ON` / `NOTE_OFF` signals over Firebase Realtime Database and synthesizing locally via the Web Audio API solves the fundamental latency problem of online music therapy.
- **Global Musical Scales:** Locking melodic keys to configurable root notes + 11 musical scales (Major/Minor Pentatonic, modes, Harmonic Minor, Hirajoshi) ensures every interaction feels musical and low-pressure.
- **Pre-Rendered Pixel Assets:** Hosting all 33 PNG assets on GitHub Pages (`BenMidwinter/Soundtray`) decouples art assets from code bundles and supports CORS (`access-control-allow-origin: *`).
- **Lightweight React + HTML5 Canvas Architecture:** Much simpler, lighter, and easier to maintain for this 2D room than Phaser 3.

### What Got Caught Up (Root Causes)
1. **AI Studio Asset-Path Loop (~40 turns in Session 1):** AI Studio's cloud preview sandbox struggles with local static PNGs and repeatedly injected invalid `@/src/assets/...` path aliases.
2. **GitHub Pages Case-Sensitivity Bug (Session 3):** `AssetData.ts` pointed to `https://benmidwinter.github.io/soundtray/...` (lowercase `s`), which returns **HTTP 404**. The GitHub repo is `BenMidwinter/Soundtray` (capital **`S`**), where all 33 PNGs return **HTTP 200**.
3. **Phaser + Bulk Soundfont Crashes (Session 2):** Eagerly downloading multiple soundfont packs on boot caused repeated `Audio Load Error` crashes and Phaser constructor errors.
4. **Audio Latency & Key Repeat (Sessions 1 & 3):** Routing keypresses through React state updates and not ignoring `KeyboardEvent.repeat` caused audible lag and machine-gun note re-triggering on held keys.
5. **Floor Geometry & Build Mode UX Bugs (Session 3):** A hardcoded diamond floor polygon didn't match the one-point perspective trapezoid of `background.png`; Build Mode lacked single-placement gating (creating the "bookshelf paintbrush" bug); and the Remove zone sat underneath the bottom toolbar.

---

## 2. Rebuilt Foundation (Building Blocks)

| Building Block | File | What It Solves |
| --- | --- | --- |
| **Verified Asset Manifest & Floor Geometry** | `src/assets/assetManifest.ts` | Wires all 33 GitHub Pages PNGs using capital-`S` URL (`https://benmidwinter.github.io/Soundtray`), groups 8 sofa & 8 beanbag color variants, and maps the exact perspective floor trapezoid of `background.png` (`2816×1346`). |
| **Priority Non-Blocking Asset Loader** | `src/services/AssetLoader.ts` | Loads `background.png` first, visible room items second, and lazily warms the rest of the Toy Box in batches of 5 with CORS enabled and clean fallbacks. |
| **Mandaloop Zero-Latency Audio Engine** | `src/services/AudioEngine.ts` | Local Web Audio synthesis (`latencyHint: 'interactive'`), 9 tailored instrument voices (including sustained E. Piano with Attack/Release/Filter/Distortion), 11 global scales, master compressor, pre-built noise buffer, and `NOTE_ON`/`NOTE_OFF` voice tracking. |
| **Swappable Multiplayer Transport** | `src/services/RoomTransport.ts` | Abstract `RoomTransport` interface shipping with `LocalBroadcastTransport` (instant multi-tab multiplayer via `BroadcastChannel` + 50ms throttled position updates), ready to drop in `FirebaseTransport` without touching UI or canvas code. |
| **Decoupled 60fps Room Canvas** | `src/components/GameCanvas.tsx` | Runs `requestAnimationFrame` via refs (no loop restarts on React updates), depth-sorts items/avatars/Pru with grounded shadows, clamps movement & placement strictly to the wooden floor, supports WASD + Click/Tap-to-move, single-click placement, top-center Remove bin with proximity lock, and single-nearest instrument highlight. |
| **Warm Wooden UI & Dual Controls** | `Lobby.tsx`, `ToyBox.tsx`, `InstrumentDock.tsx` | Palette matched to the Soundtray pixel logo, live avatar customizer, color-swatched Toy Box, and multi-touch + keyboard Instrument Dock. |

---

## 3. Recommended Next Steps

1. **Firebase Realtime Database (`FirebaseTransport`):** Implement `RoomTransport` backed by Firebase RTDB (reusing the Mandaloop `events` + `users` + `onDisconnect` pattern) plus the **Janitor Protocol** (auto-wiping room state when the final user disconnects) and Room Password/Code validation.
2. **Real-Time Clinical Polish:**
   - Interactive **Connect 4** mini-game modal when clicking the Connect 4 object.
   - Room layout **Save / Load Presets** (e.g., "Default Music Room", "Quiet Corner", "Blank Canvas").
   - Custom **pixel sprite sheets** for therapist/client avatars (4-direction walk cycles) and Pru's animations.
3. **Sample-Hybrid Audio Upgrade (Optional):** Add optional lazy-loaded single-instrument samples (e.g., Salamander Piano) *on demand when an instrument is opened*, keeping the Web Audio synth as an instant zero-latency fallback.
4. **Deployment:** Deploy cleanly to GitHub Pages (via Vite + GitHub Actions, matching your Mandaloop setup) and test on iPad Safari for touch ergonomics and audio unlock behavior.
