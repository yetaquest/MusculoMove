# Backend How To Use

## Setup

From the repo root:

```bash
uv sync --cache-dir /tmp/uv-cache
```

## Check the active model and viewer configuration

Run:

```bash
uv run --cache-dir /tmp/uv-cache python main.py manifest
```

Expected high-signal fields:

1. `configuration.model_path = "models/RajagopalLaiUhlrich2023.osim"`
2. `configuration.body_count = 22`
3. `configuration.muscle_count = 80`
4. `viewer.asset_url = "/api/viewer/model.gltf"`
5. `viewer.geometry_path = "models/FullBodyModel-4.0/Geometry"`

## Start the API

```bash
uv run --cache-dir /tmp/uv-cache python main.py serve --host 127.0.0.1 --port 8000
```

Main routes:

1. `GET /api/health`
2. `GET /api/manifest`
3. `GET /api/viewer/model.gltf`
4. `POST /api/evaluate`
5. `POST /api/optimize`

## Evaluate a static pose

```bash
uv run --cache-dir /tmp/uv-cache python main.py evaluate --request docs/examples/evaluate-request.json
```

The request format is unchanged:

```json
{
  "pose": {
    "pelvis_tilt": -0.05,
    "pelvis_list": 0.02,
    "pelvis_rotation": 0.01,
    "lumbar_extension": 0.03,
    "hip_flexion_l": 0.04,
    "knee_angle_l": 0.02,
    "ankle_angle_l": -0.01,
    "hip_flexion_r": 0.17,
    "knee_angle_r": 0.09,
    "ankle_angle_r": -0.03
  },
  "tightness": [
    {
      "targets": ["hamstrings_r"],
      "severity": 0.6,
      "max_shortening_fraction": 0.2
    }
  ],
  "selected_groups": ["hamstrings_r", "plantarflexors_r"],
  "include_upper_body_debug_metrics": false
}
```

Rules:

1. Pose values are radians.
2. `severity` stays on `[0, 1]`.
3. `max_shortening_fraction` stays on `[0, 1]` and is required.
4. `segment_transforms` remain matrix-first backend output.

## Optimize the active bilateral subset

```bash
uv run --cache-dir /tmp/uv-cache python main.py optimize --request docs/examples/optimize-request.json
```

The optimizer now changes:

1. `pelvis_tilt`
2. `pelvis_list`
3. `pelvis_rotation`
4. `lumbar_extension`
5. `hip_flexion_l`
6. `knee_angle_l`
7. `ankle_angle_l`
8. `hip_flexion_r`
9. `knee_angle_r`
10. `ankle_angle_r`

## Viewer-specific check

To verify that the converted OpenSim viewer asset is available:

```bash
curl http://127.0.0.1:8000/api/viewer/model.gltf -o /tmp/musculomove-viewer.gltf
```

That route is generated from:

1. `models/RajagopalLaiUhlrich2023.osim`
2. `models/FullBodyModel-4.0/Geometry/`
3. `tools/opensim-viewer-backend/`

## Related docs

1. Review summary: [implementation-review.md](/home/etekmen13/projects/MusculoMove/docs/implementation-review.md)
2. Frontend usage: [frontend-how-to-use.md](/home/etekmen13/projects/MusculoMove/docs/frontend-how-to-use.md)
3. Operator instructions: [instructions.md](/home/etekmen13/projects/MusculoMove/docs/instructions.md)
