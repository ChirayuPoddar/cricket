# Shadow Cricket AI

A browser-based first-person cricket arcade prototype inspired by Shadow Cricket. The game keeps the 3D batting crease as the primary experience, with a minimal HUD, webcam swing detection, AI commentary, and playable keyboard fallback.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open the local Vite URL in Chrome or Safari. Allow webcam permissions for arm-tracked batting, or press `Space` to swing without a webcam.

## Build

```bash
npm run build
```

## AI Setup

Copy `.env.example` to `.env` and add a Gemini key:

```bash
VITE_GEMINI_API_KEY=your_key_here
```

When no key is present, commentary and narration use arcade template fallbacks, so the game remains fully playable.

live link: https://cricket-woad.vercel.app/

