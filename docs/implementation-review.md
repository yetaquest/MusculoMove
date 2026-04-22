# Backend Review

## Findings that were blocking the current UI

1. The backend was hardcoded to `models/RajagopalLaiUhlrich2023.osim`, while the new rendering requirement is the FullBodyModel bundle at `models/FullBodyModel-4.0/Rajagopal2015.osim`.
2. The API had no route for serving a real model asset derived from the active `.osim` plus geometry, so the frontend was forced onto a placeholder avatar path.
3. `tools/opensim-viewer-backend` was present but not wired into the app, and its `pygltflib` dependency was missing from the Python environment.
4. The Stanford viewer code expects a flatter `opensim` namespace than `pyopensim` exposes directly, which caused import-time failures until a compatibility layer was added.

## Implemented backend changes

1. Switched `ACTIVE_MODEL_PATH` to `models/FullBodyModel-4.0/Rajagopal2015.osim`.
2. Added `ACTIVE_MODEL_GEOMETRY_PATH` for `models/FullBodyModel-4.0/Geometry`.
3. Excluded `ground` from the manifest body list so the body count stays aligned with rendered body segments.
4. Added viewer metadata to `/api/manifest`:
   - `viewer.asset_url`
   - `viewer.body_nodes`
   - `viewer.model_path`
   - `viewer.geometry_path`
   - `viewer.runtime`
5. Added `GET /api/viewer/model.gltf`, which generates and caches a GLTF using `tools/opensim-viewer-backend`.
6. Added an OpenSim compatibility shim in-process so the viewer tool can run against `pyopensim`.
7. Added `pygltflib` to the Python project dependencies.

## Current backend state

1. The active model is `FullBodyModel_MuscleActuatedLowerLimb_TorqueActuatedUpperBody`.
2. The current manifest reports:
   - `39` coordinates
   - `22` rendered bodies
   - `80` muscles
3. The lower-body passive analysis pipeline remains intact.
4. The optimizer remains on `ACTIVE OPTIMIZER PHASE 1`.
