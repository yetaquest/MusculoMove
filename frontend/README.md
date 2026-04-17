# MusculoMove Frontend

This frontend is a Vite + React + TypeScript app that visualizes the MusculoMove backend in 3D. It loads the local avatar at `public/models/avatar.glb` when available and falls back to debug segment geometry when the avatar is missing or cannot be used.

## Run it

1. Start the backend API from the repo root:

```bash
uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000
```

2. In `frontend/`, install dependencies if needed:

```bash
npm install
```

3. Start the frontend dev server:

```bash
npm run dev
```

The Vite dev server proxies `/api/*` requests to `http://127.0.0.1:8000`.

## Avatar path

Place the swappable avatar asset at:

```text
frontend/public/models/avatar.glb
```

If the file exists, the app loads it and applies mapped backend segment transforms to the bones it can resolve. If the file is missing, the app automatically falls back to debug geometry mode.

## Debug mode

The app includes:

1. a saved fallback sample response at `public/sample-response.json`
2. a toggleable debug panel
3. segment-to-bone mapping in `src/lib/segmentMap.ts`
4. bone hierarchy logging in `src/lib/boneInspector.ts`

Open the browser console after the avatar loads to inspect the logged bone hierarchy. That output is intended to help adjust segment-to-bone mappings without scattering bone-name guesses throughout the app.

## Commands

```bash
npm run dev
npm run build
npm run lint
```
