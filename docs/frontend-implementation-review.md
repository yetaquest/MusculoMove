# Frontend Review

## Findings

1. The viewer pipeline depended on `frontend/public/models/avatar.glb`, which is unrelated to the actual OpenSim model and geometry bundle.
2. Segment application relied on a hand-maintained bone map, so the UI could never be a faithful render of the OpenSim model itself.
3. The docs still described avatar probing and debug fallback as the primary flow, which no longer matched the intended product direction.

## Implemented frontend changes

1. Removed the `avatar.glb` probe from the app boot flow.
2. Replaced the avatar viewport path with a manifest-driven OpenSim GLTF path.
3. Added direct node application using backend-supplied names such as `Body:/bodyset/pelvis`.
4. Kept debug geometry only as a fallback path when the generated GLTF cannot be loaded.
5. Removed the stale avatar-specific helpers:
   - `frontend/src/lib/segmentMap.ts`
   - `frontend/src/lib/boneInspector.ts`
6. Updated the debug panel to report mapped OpenSim node names instead of guessed bone names.

## Result

The UI is now wired to the actual converted OpenSim model instead of a placeholder rig. The backend remains the source of truth for both the rendered asset location and the segment-to-node mapping.
