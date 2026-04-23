# Instructions

## One-time setup

1. From the repo root, run:

```bash
uv sync --cache-dir /tmp/uv-cache
```

2. In `frontend/`, run:

```bash
npm install
```

## Run the full stack

1. Start the backend:

```bash
uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000
```

2. In a second terminal, start the frontend:

```bash
cd frontend
npm run dev
```

3. Open the Vite URL shown in the terminal.

## What to expect

1. The app first loads the saved sample pose.
2. It then fetches the backend manifest, baseline pose, and generated OpenSim GLTF.
3. The rendered model should come from `models/RajagopalLaiUhlrich2023.osim`, not `avatar.glb`.
4. Left, right, and bilateral selections should all drive the bilateral pelvis-aware optimizer.
5. If the model asset cannot be loaded, the app falls back to debug geometry and shows a warning.

## Verification commands

Run these after changes:

```bash
uv run --cache-dir /tmp/uv-cache python main.py manifest
uv run --cache-dir /tmp/uv-cache python -m unittest tests.test_main
cd frontend && npm run lint
cd frontend && npm run build
```

## Important files

1. Active model: [models/RajagopalLaiUhlrich2023.osim](/home/etekmen13/projects/MusculoMove/models/RajagopalLaiUhlrich2023.osim)
2. Geometry bundle: [models/FullBodyModel-4.0/Geometry](/home/etekmen13/projects/MusculoMove/models/FullBodyModel-4.0/Geometry)
3. Backend entrypoint: [main.py](/home/etekmen13/projects/MusculoMove/main.py:1)
4. Viewer backend source: [tools/opensim-viewer-backend](/home/etekmen13/projects/MusculoMove/tools/opensim-viewer-backend)
5. Frontend viewport: [frontend/src/components/viewer/ModelViewport.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/viewer/ModelViewport.tsx:1)
