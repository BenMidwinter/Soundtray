# Soundtray

A synchronous, latency-free online music therapy platform — a digital evolution of the **Sandtray** therapy modality in a warm, woody 16-bit virtual music room.

Hosted at **`https://soundtray.secat.app`**.

---

## Features

- **Latency-Free Audio ("Mandaloop Model"):** Streams lightweight `NOTE_ON` / `NOTE_OFF` signals via Firebase Realtime Database and synthesizes sound locally using the Web Audio API at full volume (no audio streaming delay or spatial drop-off).
- **9 Playable Instruments & Multi-Octave Range:** Grand Piano, E. Piano (sustained synth with Attack, Release, Filter & Warmth dials), Drum Kit, Percussion (Cajon), Guitar, Marimba, Xylophone, Saxophone, and Flute — with 2-row melodic range (`Q–I` / `A–K`), octave shift (`Z` / `X`), 11 global scales, 12 root notes, and global Room Reverb.
- **The Toy Box (Build Mode):** Separate tabs for **Instruments**, **Furniture** (with 8-color swatched & flippable Sofas and Beanbags), and **Games**, plus a top-center Remove bin with proximity protection and a Tidy Up button.
- **3 Synced Turn-Taken Games:** **Connect 4**, **Noughts & Crosses (Tic-Tac-Toe)**, and **Sound-Matching Memory Pairs** (6 musical motif pairs played live in the room's active key & scale). Solo play stays unrestricted; 2+ participants automatically get turn-taking seats with an optional Free Play toggle.
- **Time of Day & Room Atmosphere:** Live pixel-art sky behind the back windows (**Morning**, **Day**, **Sunset**, **Night**), subtle composite room lighting, and warm radial glow pools around the wall sconces and placed Floor Lamps.
- **4-Directional Stardew-Style Avatars & Pru:** 8 inclusive hairstyles (`Short`, `Long`, `Bob`, `Curly`, `Spiky`, `Ponytail`, `Twin Buns`, `Bald`), customizable skin/hair/T-shirt colors, Front/Side/Back walk cycles, plus **Pru** (synced wandering, napping, and greetings).
- **Clinical Boundaries & Room Hygiene:** Built-in & local custom **Room Layout Presets** (`localStorage`), an intentional **Exit Door** dialog, a collapsible **Session Events** drawer, and the **Janitor Protocol** (auto-wiping room state in Firebase when the last participant leaves).

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in your Firebase Web App credentials
npm run dev
```

If `.env.local` is omitted, Soundtray automatically falls back to **Local Multi-Tab Sync** (`BroadcastChannel`) so you can test multiplayer offline by opening two browser tabs on the same Room Code.

---

## Firebase Setup (`soundtray-bb517`)

1. **Realtime Database (`europe-west1`):**
   - Paste the contents of [`database.rules.json`](./database.rules.json) into **Firebase Console → Build → Realtime Database → Rules** and click **Publish**.
   - These rules block root-level listing of active Room Codes and restrict writes to authenticated room participants.
2. **Anonymous Authentication:**
   - Go to **Build → Authentication → Sign-in method → Anonymous → Enable**.
   - Under **Authentication → Settings → Authorized domains**, add **`soundtray.secat.app`** (`localhost` is already enabled).

---

## Deploying to `soundtray.secat.app` (GitHub Pages)

This repository includes [`public/CNAME`](./public/CNAME) and [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) for automatic deployment on push to `main`.

1. **GitHub Actions Secrets:** In your GitHub repo go to **Settings → Secrets and variables → Actions** and add the 8 secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
2. **DNS (`secat.app`):** Ensure the `CNAME` record for `soundtray` points to `benmidwinter.github.io`.
3. **GitHub Pages Settings:** After the first workflow run publishes the `gh-pages` branch, go to **Settings → Pages**, verify the source is `gh-pages`, confirm custom domain `soundtray.secat.app`, and enable **Enforce HTTPS**.
