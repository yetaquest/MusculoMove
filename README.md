# MusculoMove

MusculoMove now uses `models/RajagopalLaiUhlrich2023.osim` as the active model and uses `models/FullBodyModel-4.0/Geometry/` plus `tools/opensim-viewer-backend/` to generate the rendered full-body GLTF shown in the UI.

The backend keeps lower-body passive muscle analysis as the default scope, returns full-body segment transforms, and now runs a bilateral pelvis-aware active optimizer on:

- `pelvis_tilt`
- `pelvis_list`
- `pelvis_rotation`
- `lumbar_extension`
- `hip_flexion_l`
- `knee_angle_l`
- `ankle_angle_l`
- `hip_flexion_r`
- `knee_angle_r`
- `ankle_angle_r`

## Commands

Install Python dependencies:

```bash
uv sync --cache-dir /tmp/uv-cache
```

Print manifest and viewer metadata:

```bash
uv run --cache-dir /tmp/uv-cache python main.py manifest
```

Start the backend API:

```bash
uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Notes

- The active model path is hardcoded to `models/RajagopalLaiUhlrich2023.osim`.
- The viewer asset is generated on demand at `GET /api/viewer/model.gltf`.
- Tightness still follows `l_opt,new = l_opt,0 (1 - s alpha)` and requires an explicit `max_shortening_fraction`.
- The backend returns matrix-first `segment_transforms`; the frontend applies those transforms onto converted OpenSim body nodes such as `Body:/bodyset/pelvis`.

## Docs

- Review summary: [docs/implementation-review.md](/home/etekmen13/projects/MusculoMove/docs/implementation-review.md)
- Backend usage: [docs/how-to-use.md](/home/etekmen13/projects/MusculoMove/docs/how-to-use.md)
- Frontend usage: [docs/frontend-how-to-use.md](/home/etekmen13/projects/MusculoMove/docs/frontend-how-to-use.md)
- Change log: [docs/fullbody-viewer-migration.md](/home/etekmen13/projects/MusculoMove/docs/fullbody-viewer-migration.md)
- Operator instructions: [docs/instructions.md](/home/etekmen13/projects/MusculoMove/docs/instructions.md)
