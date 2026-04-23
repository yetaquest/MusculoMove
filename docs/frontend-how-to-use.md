# Frontend How To Use

## Start the backend first

From the repo root:

```bash
uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000
```

The frontend depends on:

1. `GET /api/manifest`
2. `GET /api/viewer/model.gltf`
3. `POST /api/evaluate`
4. `POST /api/optimize`

## Start the frontend

In `frontend/`:

```bash
npm install
npm run dev
```

## Runtime flow

1. The app loads the saved sample pose first.
2. It fetches `/api/manifest`.
3. It reads `viewer.asset_url` and `viewer.body_nodes`.
4. It loads the backend-generated OpenSim GLTF.
5. It applies backend `segment_transforms` onto OpenSim node names such as `Body:/bodyset/pelvis`.
6. If the GLTF request fails, it falls back to debug boxes and surfaces a warning instead of blanking the scene.

## Primary interaction flow

1. Add or remove lower-body muscle tightening selections from the left rail.
2. Adjust severity on `[0, 1]`.
3. The compact muscle grid stays scrollable inside the card instead of growing the page.
4. Use `Optimize` for the bilateral pelvis-aware compensation solve.
5. Use camera preset buttons for `Front`, `Side`, and `3/4`.
6. Open `Show debug` to inspect segment transforms, node mappings, and quaternions.

## Important behavior change

The viewer no longer uses:

1. `frontend/public/models/avatar.glb`
2. `segmentMap.ts`
3. `boneInspector.ts`

The primary render source is now the converted OpenSim GLTF served by the backend.

## Verification

These commands were used against the updated frontend code:

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

## Related docs

1. Backend usage: [how-to-use.md](/home/etekmen13/projects/MusculoMove/docs/how-to-use.md)
2. Frontend review: [frontend-implementation-review.md](/home/etekmen13/projects/MusculoMove/docs/frontend-implementation-review.md)
3. Operator instructions: [instructions.md](/home/etekmen13/projects/MusculoMove/docs/instructions.md)
