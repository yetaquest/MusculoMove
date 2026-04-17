# How To Use MusculoMove

## 1. Install dependencies

From the repo root:

```bash
uv sync --cache-dir /tmp/uv-cache
```

If the OpenSim runtime is not already available on the machine, install OpenBLAS first:

```bash
sudo apt install libopenblas-dev
```

## 2. Confirm the backend can load the active model

Run:

```bash
uv run --cache-dir /tmp/uv-cache python main.py manifest
```

What this does:

1. Loads the hardcoded active model `models/RajagopalLaiUhlrich2023.osim`
2. Confirms the coordinate, body, and muscle counts
3. Prints the active optimizer phase, muscle groups, and bounds
4. Reports whether the OpenSim runtime is available

You should see:

1. `model_path` set to `models/RajagopalLaiUhlrich2023.osim`
2. `runtime.available` set to `true`
3. `active_optimizer_phase` set to `ACTIVE OPTIMIZER PHASE 1`

## 3. Evaluate a static pose

Use the provided example request:

```bash
uv run --cache-dir /tmp/uv-cache python main.py evaluate --request docs/examples/evaluate-request.json
```

The example request file is [docs/examples/evaluate-request.json](/home/etekmen13/projects/MusculoMove/docs/examples/evaluate-request.json).

Request format:

```json
{
  "pose": {
    "pelvis_tilt": -0.05,
    "lumbar_extension": 0.03,
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

Rules for `evaluate` requests:

1. `pose` values are radians.
2. You may omit any coordinate and the model default will be used.
3. `tightness[].severity` must stay on `[0, 1]`.
4. `tightness[].max_shortening_fraction` must be explicit and must stay on `[0, 1]`.
5. `tightness[].targets` can be:
   - lower-body group names like `hamstrings_r`
   - exact muscle names like `semimem_r`
6. `selected_groups` must use lower-body group names from the manifest output.

What `evaluate` returns:

1. `metadata`
2. `tightness`
3. `pose_rad`
4. `per_actuator`
5. `per_group`
6. `objective`
7. `segment_transforms`
8. `debug`

Important output fields:

1. `per_actuator` contains lower-body muscle metrics only by default.
2. `per_group` contains weighted normalized passive force, worst compartment normalized passive force, and mean normalized fiber length.
3. `segment_transforms` always contains the full body, with:
   - `translation_m`
   - `rotation_matrix_3x3`

Verified example result for `docs/examples/evaluate-request.json`:

1. `metadata.selected_groups` = `["hamstrings_r", "plantarflexors_r"]`
2. `objective.total` ≈ `0.040606`
3. `metadata.full_body_transform_count` = `22`
4. `tightness` applies to `bflh_r`, `bfsh_r`, `semimem_r`, and `semiten_r`

## 4. Optimize the phase-1 posture subset

Use the provided example optimization request:

```bash
uv run --cache-dir /tmp/uv-cache python main.py optimize --request docs/examples/optimize-request.json
```

The example request file is [docs/examples/optimize-request.json](/home/etekmen13/projects/MusculoMove/docs/examples/optimize-request.json).

Request format:

```json
{
  "tightness": [
    {
      "targets": ["hamstrings_r"],
      "severity": 0.6,
      "max_shortening_fraction": 0.2
    }
  ],
  "selected_groups": ["hamstrings_r"],
  "seed_pose": {
    "pelvis_tilt": 0.0,
    "lumbar_extension": 0.0,
    "hip_flexion_r": 0.0,
    "knee_angle_r": 0.0,
    "ankle_angle_r": 0.0
  },
  "max_iterations": 8,
  "initial_step_rad": 0.08726646259971647,
  "tolerance_rad": 0.008726646259971648
}
```

What the optimizer currently changes:

1. `pelvis_tilt`
2. `lumbar_extension`
3. `hip_flexion_r`
4. `knee_angle_r`
5. `ankle_angle_r`

What it does not currently optimize:

1. `pelvis_list`
2. `pelvis_rotation`
3. `hip_rotation_r`
4. pelvis translations
5. upper-body joints beyond the included trunk coordinate

The optimizer output includes:

1. `optimized_pose_rad`
2. `objective`
3. `optimizer.trace`
4. lower-body muscle metrics
5. full-body transforms

Verified example result for `docs/examples/optimize-request.json`:

1. `optimized_pose_rad` returned the default phase-1 pose for this specific request
2. `objective.total` ≈ `0.000897`
3. `optimizer.iterations` = `4`
4. `len(optimizer.trace)` = `5`

## 5. Interpret the results correctly

Use the results as:

1. a model-based passive accommodation sandbox
2. a way to compare how lower-body passive tightness changes posture and compensation
3. a backend data source for full-body rendering plus lower-body muscle analysis

Do not use the results as:

1. diagnosis
2. neurological explanation
3. subject-specific clinical prediction
4. proof of validated quiet standing

## 6. Change the inputs safely

Recommended workflow:

1. Start with `main.py manifest` to inspect valid coordinate names and bounds.
2. Copy one of the example JSON files in `docs/examples/`.
3. Change only one or two values at a time.
4. Keep optimization requests inside the current phase-1 subset unless you are intentionally changing the code.
5. Use lower-body muscle groups by default instead of large lists of individual muscles.

## 7. Common target names

Examples of valid lower-body group names:

1. `hamstrings_r`
2. `hamstrings_l`
3. `plantarflexors_r`
4. `plantarflexors_l`
5. `hip_flexors_r`
6. `hip_flexors_l`
7. `quadriceps_r`
8. `quadriceps_l`
9. `gluteus_maximus_r`
10. `gluteus_maximus_l`

Examples of valid phase-1 coordinate names:

1. `pelvis_tilt`
2. `lumbar_extension`
3. `hip_flexion_r`
4. `knee_angle_r`
5. `ankle_angle_r`

## 8. Verified commands

These commands were executed successfully in this repo state:

```bash
uv run --cache-dir /tmp/uv-cache python main.py manifest
uv run --cache-dir /tmp/uv-cache python main.py evaluate --request docs/examples/evaluate-request.json
uv run --cache-dir /tmp/uv-cache python main.py optimize --request docs/examples/optimize-request.json
uv run --cache-dir /tmp/uv-cache python -m unittest -v tests.test_main
```

## 9. Related docs

1. Review summary: [docs/implementation-review.md](/home/etekmen13/projects/MusculoMove/docs/implementation-review.md)
2. Static evaluation example: [docs/examples/evaluate-request.json](/home/etekmen13/projects/MusculoMove/docs/examples/evaluate-request.json)
3. Optimizer example: [docs/examples/optimize-request.json](/home/etekmen13/projects/MusculoMove/docs/examples/optimize-request.json)
