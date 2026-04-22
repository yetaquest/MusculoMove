# FullBody Viewer Migration

## Scope of the change

This migration replaced the previous placeholder viewer path with a real OpenSim rendering pipeline built from:

1. `models/FullBodyModel-4.0/Rajagopal2015.osim`
2. `models/FullBodyModel-4.0/Geometry/`
3. `tools/opensim-viewer-backend/`

## Code changes

1. Backend:
   - switched the active model path
   - added viewer runtime/status reporting
   - added on-demand GLTF generation and caching
   - added a viewer asset route
   - added `pyopensim` compatibility aliases required by the Stanford converter
2. Frontend:
   - removed `avatar.glb` probing
   - removed bone-mapping logic
   - added manifest-driven OpenSim GLTF loading
   - applied segment transforms to OpenSim body nodes
   - kept debug geometry as a fallback only
3. Tests:
   - updated model path assertions
   - updated model name assertions
   - added viewer metadata assertions
4. Docs:
   - refreshed root and frontend READMEs
   - refreshed backend/frontend usage docs
   - added operator instructions

## Validation completed

1. `uv run python main.py manifest`
2. `uv run python -m unittest tests.test_main`
3. `npm run lint`
4. `npm run build`
5. direct GLTF generation through the backend viewer helper
