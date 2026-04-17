# Frontend How To Use

## 1. Start the backend API

From the repo root:

```bash
uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000
```

This starts the HTTP API used by the frontend.

Available routes:

1. `GET /api/manifest`
2. `POST /api/evaluate`
3. `POST /api/optimize`
4. `GET /api/health`

## 2. Start the frontend

In `frontend/`:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8000`.

## 3. Optional production build

In `frontend/`:

```bash
npm run build
```

## 4. Avatar behavior

Preferred avatar file:

```text
frontend/public/models/avatar.glb
```

Frontend behavior:

1. If `avatar.glb` exists, the app loads it and applies mapped transforms through `src/lib/segmentMap.ts`.
2. If the file is missing, the app falls back to debug geometry mode automatically.
3. If some backend segments do not have a matching bone, the app does not crash. Those segments remain unapplied in avatar mode and remain inspectable in the debug panel.

## 5. Primary flow

1. Open the app.
2. The viewer starts from the saved sample response while the backend is being queried.
3. Use the left rail to add individual lower-body muscles.
4. Set the side for each muscle:
   - `Left`
   - `Right`
   - `Bilateral`
5. Adjust severity on `[0, 1]`.
6. Press `Optimize` to compute the passive compensation pose.
7. Use camera preset buttons:
   - `Front`
   - `Side`
   - `3/4`
8. Orbit, pan, and zoom the viewer directly.
9. Open `Show debug` to inspect transforms, segment mappings, and quaternions.

## 6. Realtime behavior

Current frontend behavior:

1. Slider edits trigger debounced `evaluate` requests by default.
2. If backend round-trip time crosses the slow threshold, the UI degrades to release-based preview mode.
3. `Optimize` is always explicit and is never run automatically on slider drag.
4. The last valid pose stays on screen if a request fails.

## 7. Important interpretation note

This frontend is a mechanical accommodation demo for a model-based passive posture sandbox.

It should not be interpreted as:

1. diagnosis
2. neurological explanation
3. subject-specific clinical prediction
4. validated quiet-standing truth

## 8. Debugging mapping issues

Files to inspect:

1. [frontend/src/lib/segmentMap.ts](/home/etekmen13/projects/MusculoMove/frontend/src/lib/segmentMap.ts:1)
2. [frontend/src/lib/boneInspector.ts](/home/etekmen13/projects/MusculoMove/frontend/src/lib/boneInspector.ts:1)
3. [frontend/public/sample-response.json](/home/etekmen13/projects/MusculoMove/frontend/public/sample-response.json:1)

Workflow:

1. Load the app with `avatar.glb` present.
2. Open the browser console.
3. Look for the logged bone hierarchy from `boneInspector.ts`.
4. Compare bone names against `segmentMap.ts`.
5. Adjust the mapping file if a backend segment should drive a different bone.

## 9. Verified commands

These commands were executed successfully for this repo state:

```bash
uv run --cache-dir /tmp/uv-cache python -m py_compile main.py tests/test_main.py
uv run --cache-dir /tmp/uv-cache python -m unittest -v tests.test_main
cd frontend && npm run lint
cd frontend && npm run build
```

The backend API server was also started successfully with:

```bash
uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000
```

## 10. Related docs

1. Backend usage: [docs/how-to-use.md](/home/etekmen13/projects/MusculoMove/docs/how-to-use.md)
2. Frontend review log: [docs/frontend-implementation-review.md](/home/etekmen13/projects/MusculoMove/docs/frontend-implementation-review.md)
