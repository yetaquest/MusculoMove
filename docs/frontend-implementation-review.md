# Frontend Implementation Review

## Scope

This change replaced the Vite starter frontend with a MusculoMove-specific React app and added the smallest backend transport changes required to support it.

## Backend review findings

Before frontend work:

1. The backend already had the core biomechanics pipeline:
   - hardcoded `RajagopalLaiUhlrich2023.osim`
   - XML-backed manifest parsing
   - lower-body muscle grouping
   - full-body segment transforms
   - phase-1 passive optimizer
2. The main missing frontend integration piece was transport.
3. The backend was still CLI-only and did not expose HTTP routes for a web app.

## Backend changes made for frontend support

Updated [main.py](/home/etekmen13/projects/MusculoMove/main.py:1) to add:

1. `serve` command for a small HTTP API
2. `GET /api/manifest`
3. `POST /api/evaluate`
4. `POST /api/optimize`
5. `GET /api/health`
6. CORS headers for local frontend development
7. frontend-friendly `status` payload injection for evaluate and optimize responses
8. lower-body muscle catalog output in the manifest payload

What was intentionally not changed:

1. the active model path
2. the tightness formula
3. the objective structure
4. the regularization weights
5. the optimizer coordinate subset
6. the matrix-first segment transform format

## Frontend files added or replaced

### API layer

Added:

1. [frontend/src/api/client.ts](/home/etekmen13/projects/MusculoMove/frontend/src/api/client.ts:1)
2. [frontend/src/api/normalize.ts](/home/etekmen13/projects/MusculoMove/frontend/src/api/normalize.ts:1)

Purpose:

1. call the backend routes
2. load the saved sample payload
3. normalize backend responses into a stable frontend shape

### State layer

Added:

1. [frontend/src/state/appStore.ts](/home/etekmen13/projects/MusculoMove/frontend/src/state/appStore.ts:1)

Purpose:

1. hold manifest data
2. hold active individual-muscle selections
3. preserve the last valid pose response
4. track interaction mode, request status, selected segment, and viewer mode

### Viewer utilities

Added:

1. [frontend/src/lib/segmentMap.ts](/home/etekmen13/projects/MusculoMove/frontend/src/lib/segmentMap.ts:1)
2. [frontend/src/lib/transformAdapter.ts](/home/etekmen13/projects/MusculoMove/frontend/src/lib/transformAdapter.ts:1)
3. [frontend/src/lib/interpolation.ts](/home/etekmen13/projects/MusculoMove/frontend/src/lib/interpolation.ts:1)
4. [frontend/src/lib/boneInspector.ts](/home/etekmen13/projects/MusculoMove/frontend/src/lib/boneInspector.ts:1)
5. [frontend/src/lib/muscleSelection.ts](/home/etekmen13/projects/MusculoMove/frontend/src/lib/muscleSelection.ts:1)

Purpose:

1. keep bone-name assumptions in one mapping layer
2. convert backend matrices into Three.js transforms
3. interpolate short pose transitions
4. log the avatar skeleton hierarchy for mapping work
5. convert individual-muscle UI selections into backend request payloads

### UI components

Added:

1. [frontend/src/components/viewer/ModelViewport.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/viewer/ModelViewport.tsx:1)
2. [frontend/src/components/controls/ControlRail.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/controls/ControlRail.tsx:1)
3. [frontend/src/components/status/StatusBar.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/status/StatusBar.tsx:1)
4. [frontend/src/components/debug/DebugPanel.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/debug/DebugPanel.tsx:1)
5. shadcn-style UI primitives:
   - [frontend/src/components/ui/button.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/ui/button.tsx:1)
   - [frontend/src/components/ui/card.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/ui/card.tsx:1)
   - [frontend/src/components/ui/badge.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/components/ui/badge.tsx:1)

### App shell

Replaced the starter app with:

1. [frontend/src/App.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/App.tsx:1)
2. [frontend/src/index.css](/home/etekmen13/projects/MusculoMove/frontend/src/index.css:1)
3. [frontend/src/main.tsx](/home/etekmen13/projects/MusculoMove/frontend/src/main.tsx:1)

What the new app does:

1. boot from a saved sample pose
2. probe whether `public/models/avatar.glb` exists
3. fetch the backend manifest
4. keep individual-muscle controls in the left rail
5. keep the viewer dominant in the center
6. keep status and debug tools on the right
7. preserve the last valid pose on request failure

### Sample payload

Added:

1. [frontend/public/sample-response.json](/home/etekmen13/projects/MusculoMove/frontend/public/sample-response.json:1)

Purpose:

1. provide the required saved backend-like transform payload
2. support the frontend smoke-test path
3. keep the viewer non-empty while the backend is unavailable or still loading

## Viewer behavior implemented

Implemented:

1. full-body transform playback
2. local avatar loading from `public/models/avatar.glb`
3. debug-geometry fallback when the avatar is unavailable
4. orbit, pan, and zoom
5. front / side / 3/4 camera preset buttons
6. short smooth interpolation between pose updates
7. segment debug inspection

Notes on mapping:

1. Some backend segments do not have one-to-one avatar bone matches:
   - `patella_*`
   - `talus_*`
   - `radius_*`
2. Those segments are intentionally left unmapped in avatar mode rather than forcing fragile or duplicate bone assignments.
3. The debug panel surfaces the applied/unapplied status for each segment.

## UI behavior implemented

Implemented:

1. individual lower-body muscle selection
2. left / right / bilateral side selector per muscle card
3. severity slider per active muscle
4. debounced evaluate requests
5. explicit optimize button
6. automatic degrade to release-based preview mode if evaluate gets slow enough
7. non-blocking warnings and toasts
8. stable last-valid-pose rendering on transient failures

## Verification

Verified successfully:

1. `uv run --cache-dir /tmp/uv-cache python -m py_compile main.py tests/test_main.py`
2. `uv run --cache-dir /tmp/uv-cache python -m unittest -v tests.test_main`
3. `cd frontend && npm run lint`
4. `cd frontend && npm run build`
5. `uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000`

Additional note:

1. The sandbox allowed starting the local API server with escalation.
2. The sandbox still blocked a second local client process from connecting back to that port during automated verification, so I could not complete an in-sandbox HTTP round-trip test from a separate process.
3. The frontend itself is wired to those routes through the Vite proxy and builds successfully against that contract.
