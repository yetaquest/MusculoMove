# MusculoMove Codex Brief — RajagopalLaiUhlrich2023

## Combined from Rajagopal 2016 model facts + MusculoMove optimization spec

## Mission

Build a lower-body biomechanics demo in OpenSim that shows how passive muscle tightness changes static standing-like posture and compensation patterns.

The project goal is to model **mechanical accommodation** under passive tissue changes.
Do not frame outputs as diagnosis, neurological causation, or subject-specific prediction. 

---

## Active model

Use exactly this active model file:

`models/RajagopalLaiUhlrich2023.osim`

Rules:

* Do not use the Arnold model as the active model.
* Do not switch to YAML-based model specs.
* Do not rerun PassiveMuscleForceCalibration scripts.
* Do not integrate PassiveMuscleForceCalibration workflow code right now.
* Do not generate a new calibrated model right now.
* Use the already improved `.osim` file directly as the active model.
* Keep the full-body model intact. 

Implementation meaning:

* The project should treat `RajagopalLaiUhlrich2023.osim` as the single source-of-truth model file.
* Codex should wire the backend to load this file directly from the hardcoded repo path above.
* If older loading logic references the Arnold model, replace only the hardcoded model path and dependent name maps, not the whole architecture. 

Important provenance rule:

* Rajagopal 2016 explains the model family and its assumptions, but the **actual `.osim` file** is the authoritative source for exact coordinate names, muscle names, default values, and current parameter values. 

---

## What Rajagopal 2016 gives the project

The Rajagopal 2016 model is a **full-body** OpenSim model with **22 rigid bodies**, **37 total DOF**, **80 lower-limb muscle–tendon units** (40 per leg), and **17 ideal torque actuators** for the upper body. Its lower-limb musculotendon parameters combine cadaver-derived architecture data from Ward et al. with MRI muscle-volume data from 24 healthy young adults, and the paper validates the model for healthy walking and running. 

The paper’s validation claims are specifically about **gait simulations**: walking/running muscle-driven simulations ran in about 10 minutes on a typical desktop, and muscle-generated joint moments matched inverse-dynamics moments within about 3% RMSE of peak moments. That supports Rajagopal as a solid model base, but it does **not** make it a validated quiet-standing or clinical compensation model. 

---

## Scope

### Analysis scope

* Analysis focus remains the **lower body up to below the torso**.
* Lower-body muscle groups are the primary analysis target.
* Pelvis and lower-trunk posture are part of the lower-body compensation system.
* Plan the architecture for **bilateral lower-body analysis**, not a permanently right-only design. 

### Rendering scope

* Return **full-body segment transforms** for rendering.
* Frontend may render a full rigged humanoid / GLB.
* Full-body rendering does not imply full-body muscle analysis. 

### Upper-body policy

* Keep the upper body present in the model.
* Return transforms for all body segments.
* Do not expose upper-body tightness controls in v1.
* Do not include upper-body muscles in the default analysis pipeline.
* Keep upper-body muscle metrics behind a **debug flag** only. 

Rajagopal-specific interpretation:

* The upper body in Rajagopal 2016 is primarily there to track gross torso/arm motion in gait, and it uses torque actuators rather than detailed upper-body muscles. Its upper-body joint descriptions are simplified and do not capture detailed scapular motion or full spinal bending. For MusculoMove, that supports keeping full-body transforms while restricting muscle analysis to the lower body. 

---

## Baseline pose

Use the model’s **default/anatomical pose** as the project baseline for now.

Interpretation rule:

* Do not describe this baseline as a validated quiet-standing posture.
* It is the model’s default/anatomical pose, not a proven natural-stance measurement.

---

## Rajagopal model anatomy and coordinate facts to preserve conceptually

These are model-family facts Codex should respect conceptually when mapping coordinates and interpreting transforms:

* The model coordinate axes are aligned so that in anatomical position: **x anterior**, **y superior**, **z right**. 
* Pelvis orientation relative to ground is represented by a **pelvis-fixed ZXY rotation** using **pelvis tilt, list, and rotation**. 
* Each hip is a ball-and-socket joint using **hip flexion, adduction, rotation**. 
* The knee is modeled as a **single flexion DOF** with coupled secondary motions parameterized from the knee flexion angle. 
* Ankle, subtalar, and metatarsophalangeal joints are modeled as pin joints. 
* Rajagopal 2016 reports lower-body ROMs that encompass the walking/running motions they simulated: hip flex/ext, hip abd/add, hip rotation, knee flexion 0–120°, ankle plantar/dorsiflexion, subtalar eversion/inversion, toe extension/flexion. These are model-family ROM references, not your final standing-optimizer bounds. 

---

## Evaluation assumptions

* Static pose evaluation first.
* Passive-only optimizer 
* Leave hooks for future balance/contact terms, but do not implement them now.
* Tightness means **muscle-property tightening only**.
* Lower-body behavior may still depend mechanically on pelvis, lumbar, torso, and overall full-body configuration. 

Rajagopal-specific interpretation:

* Rajagopal 2016 does **not** include ligaments or other soft tissues, and it omits some smaller lower-limb muscles if the underlying datasets did not include enough architecture/volume information; the omitted muscles account for less than about 4% of lower-limb muscle volume on average. Do not imply that the model provides complete passive capsule/ligament restraint. 

---

## Tightness model

Keep severity on **[0,1]**.

Use the current muscle-based tightening model first:

* tighten muscles by modifying muscle properties
* keep the implementation simple and explicit
* do not add separate tendon/capsule UI controls 

### Tightness formula to implement

For each selected actuator:

[
\ell_{opt,new} = \ell_{opt,0}(1 - s\alpha)
]

Where:

* (\ell_{opt,0}) = original optimal fiber length
* (s \in [0,1]) = severity
* (\alpha) = max shortening fraction 

Rules:

* Keep this as the tightening mechanism.
* Do not silently replace it with tendon slack length edits, capsule edits, or custom tissue-specific sliders. 

Interpretation rule:

* tightness means muscle-property tightening only.
* Do not claim tissue-specific separation for muscle vs tendon vs capsule unless a separate validated model is introduced. 

Rajagopal-specific caution:

* Because Rajagopal 2016 is a Hill-type muscle model with passive fiber and tendon curves derived from Millard et al., changing optimal fiber length will affect normalized fiber length and passive loading in a model whose passive behavior can already be sensitive at stretched positions. That is acceptable for your sandbox, but it is one more reason not to overclaim physiology. 

---

## Pelvis policy

Treat pelvis adjustment as part of the lower-body compensation system.

Rules:

* Keep the pelvis segment fully present in the model and returned in transforms.
* Treat pelvis rotational DOFs as part of lower-body compensation.
* Keep `pelvis_tilt` in the active optimizer first.
* Add `pelvis_list` and `pelvis_rotation` **together** after the current optimizer behavior is stable.
* Do not optimize pelvis translations yet:

  * `pelvis_tx`
  * `pelvis_ty`
  * `pelvis_tz` 

Reason:
Without explicit balance/contact constraints, free pelvis translations can create unrealistic whole-body shifts that bypass meaningful joint-level compensation. 

Rajagopal-specific note:

* The model does have 6 pelvis DOF, but your optimizer should intentionally use only the rotational subset for now. That is a project decision, not a model limitation.

---

## Optimizer

### Active optimizer phase 1

Keep the current 5-DOF subset until stable:

* `pelvis_tilt`
* `lumbar_extension`
* `hip_flexion_r`
* `knee_angle_r`
* `ankle_angle_r` 

### Active optimizer phase 2

After phase 1 is stable, add together:

* `pelvis_list`
* `pelvis_rotation` 

### Active optimizer phase 3

After pelvis rotational behavior is stable, add:

* `hip_rotation_r` 

### Later only if needed

* consider `subtalar_angle_r` later
* do not add it before `hip_rotation_r` 

Rules:

* Do not widen the optimizer unless it is obvious to do so, and each time it is changed, it needs to be explicitly stated in all-caps for debugging.
* Do not optimize upper-body joints in v1 beyond already-included trunk coordinates required for the current posture subset.
* Structure the code so bilateral lower-body optimization can be added later without redesigning the pipeline. 

---

## Optimization math to preserve

These formulas come from the **MusculoMove spec**, not the Rajagopal paper. Keep them unless explicitly changed by the user. 

### Per-muscle metrics

Normalized fiber length:
[
\tilde{\ell}*{f,i} = \frac{\ell*{f,i}}{\ell_{opt,i}}
]

Normalized passive force:
[
n_i = \frac{\max(0, F^{passive}_i)}{F^{max}_i}
]

Preserve these outputs per actuator:

* passive fiber force
* passive force multiplier
* normalized fiber length
* muscle stiffness
* max isometric force
* normalized passive force 

### Group metric

For muscle group (G), preserve weighted normalized passive force:
[
N_G = \frac{\sum_{i \in G} n_i F^{max}*i}{\sum*{i \in G} F^{max}_i}
]

Also preserve:

* worst compartment normalized passive force
* mean normalized fiber length 

### Objective function

Keep the objective structure exactly:
[
J(x) = J_{selected}(x) + 0.10,J_{global}(x) + J_{reg}(x)
]

Where:
[
J_{selected}(x) = \sum_{G \in S} N_G(x)^2
]

[
J_{global}(x) = \sum_{G \in \mathcal{G}} N_G(x)^2
]

Regularization:
[
J_{reg}(x) = \sum_j w_j(\Delta q^{rad}_j)^2
]

Rules:

* Keep radians-based regularization.
* Do not silently switch back to degree-squared regularization.
* Keep the optimization bound-constrained.
* Keep the optimizer passive-only in v1. 

### Objective-weight policy

* Use the exact current objective structure and objective weights unless they are explicitly changed by the user.
* Do not tune weights automatically during migration to the new model.
* Do not rebalance selected-term, global-term, or regularization weights just because the active model changed.
* First reproduce stable behavior with the new model under the existing weights.
* Only change weights after side-by-side evaluation shows a clear modeling reason to do so. 

### Current regularization weights to preserve

* `pelvis_tilt`: 2.0
* `lumbar_extension`: 1.5
* `hip_flexion_r`: 1.0
* `knee_angle_r`: 0.5
* `ankle_angle_r`: 0.5 

Important provenance rule:

* These weights are **MusculoMove design choices**, not values from Rajagopal 2016. Rajagopal gives the musculoskeletal model; MusculoMove gives the optimizer.

---

## Bounds

Use a **two-layer strategy**.

### Outer hard safety bounds

* based on model/literature ROM
* used to prevent impossible or unsafe optimizer search behavior

### Inner optimization bounds

* narrower ranges for plausible standing-like compensation
* these are the actual working bounds for the optimizer 

Rules:

* Do not use broad full-ROM values directly as the standing-compensation search space.
* Do not use visual plausibility as the main rule.
* Prefer literature/model consistency plus plausible standing compensation behavior. 

Rajagopal-specific note:

* The paper explicitly says the model’s tested geometry/force behavior was within the reported ROM ranges used for gait; users are encouraged to test muscle-tendon paths in the kinematic region of their own study. That supports your conservative standing-compensation subset approach. 

---

## Transforms

### Backend canonical output

Use:

* `translation_m`
* `rotation_matrix_3x3`

### Frontend adapter

* convert matrices to quaternions for the GLB rig as needed 

Rules:

* Keep matrix-first output in the backend for verification/debugging.
* Do not make quaternion the only canonical backend format. 

Rajagopal-specific note:

* Segment transforms should be read from the loaded OpenSim model at the appropriate realization stage, not reconstructed from paper kinematics.

---

## Required evaluation order

1. load model
2. apply tightness settings
3. initialize state
4. apply pose
5. equilibrate muscles
6. realize required stages
7. read muscle outputs
8. aggregate group outputs
9. read segment transforms  

Rules:

* do not skip muscle equilibration
* do not read stage-dependent values at the wrong realization stage
* keep evaluation order explicit and testable 

Rajagopal-specific note:

* The Rajagopal paper’s simulation pipeline used OpenSim tools like IK, RRA, and CMC for gait; your MusculoMove backend is not reproducing that workflow. It is loading the model and evaluating static postures directly. So keep the OpenSim-state pipeline clean and minimal.

---

## Outputs to preserve

### Per actuator

Preserve:

* passive fiber force
* passive force multiplier
* normalized fiber length
* muscle stiffness
* max isometric force
* normalized passive force 

### Per muscle group

Preserve:

* weighted normalized passive force
* worst compartment normalized passive force
* mean normalized fiber length 

### Output scope policy

* default API outputs should include **lower-body muscle metrics only**
* full-body transforms should always be available
* upper-body muscle metrics should be available only behind a debug flag 

---

## Model scope implementation policy

* Load the full-body model unchanged.
* Return transforms for all body segments.
* Analyze and report muscle metrics only for lower-body muscle groups by default.
* Keep upper-body muscle metrics debug-only.
* Do not expose upper-body tightness controls in v1.
* Do not optimize upper-body joints in v1 beyond any already-included trunk coordinates required for the current posture subset. 

---

## Rajagopal 2016 model facts Codex should know but not reimplement

These are **model provenance facts**, not formulas Codex should try to rebuild from scratch in Option A:

* Muscle paths were adapted from Arnold et al. but Rajagopal replaced ellipsoidal wrapping with **cylindrical wrapping surfaces** for speed. 
* Lower-limb muscle–tendon units use the **Millard Hill-type muscle model** with passive fiber force-length, tendon force-strain, and force-velocity behavior from Millard et al.; the active fiber force-length curve was modified to better reflect whole-muscle behavior. 
* Optimal fiber lengths came from Ward et al.; tendon slack lengths were set by matching normalized fiber length in a pose of about **7° hip flexion, 2° hip abduction, 0° knee flexion, and 20° plantarflexion**, with a special treatment for semimembranosus. 
* If tendon slack length was smaller than optimal fiber length, Rajagopal modeled that tendon as rigid; **17 of 40 muscle–tendon units per leg** met that criterion in the paper’s model. 
* Maximum isometric force was scaled from MRI muscle-volume data using a specific tension of **60 N/cm²**, chosen to help generate running-level joint moments. 

Implementation rule:

* Do **not** recalculate or overwrite these model parameters from the paper unless the user later explicitly asks for a custom calibrated model build. In Option A, load the `.osim` file as-is.

---

## Known Rajagopal limitations that matter for MusculoMove

Codex should preserve these interpretation limits:

* Rajagopal 2016 was validated for **healthy walking/running**, not for all static standing problems. 
* The model likely **overestimates passive fiber force** when muscles are stretched beyond optimal length and may overestimate loss of active force from fiber-length/velocity effects because each muscle path is simplified to a one-dimensional line of action. 
* The paper reports passive knee-extension artifacts from long quadriceps fibers in swing; this is especially relevant because your project is driven by passive behavior. 
* The model has **no ligaments or other soft tissues**, so passive joint/capsule restriction is not included by default. 
* The authors advise users to test muscle-tendon paths in the kinematic region of their actual application. 

Project interpretation:

* MusculoMove should present results as **generic model-based passive accommodation**, not as fully validated human standing truth.

---

## Coding priorities

* mathematical rigor first in the backend biomechanics pipeline
* incremental, smoke-testable implementation
* no speculative abstractions
* no unnecessary architecture changes
* prefer small explicit functions
* keep outputs JSON-friendly 

---

## Debugging priority order

When something fails, first classify it as:

1. environment/import/path
2. file content / wrong file / empty file
3. OpenSim state/stage/equilibrium misuse
4. passive-scaling or optimization-scaling issue
5. transform extraction / frontend bridge mismatch  

Then run the smallest next useful test. 

---

## Near-term priorities

1. Update model-loading code to use that exact hardcoded path.
2. Verify exact coordinate names and lower-body muscle names from the actual `.osim` file.
3. Reproduce stable pose evaluation with the new model.
4. Return full-body transforms cleanly.
5. Keep lower-body muscle analysis stable and JSON-friendly.
6. Keep the optimizer on the phase-1 subset until behavior is stable.
7. Add `pelvis_list` and `pelvis_rotation` together only after that.
8. Add `hip_rotation_r` after pelvis rotational behavior is stable.
9. Only then move farther into frontend rendering.

---

## Things Codex should not change silently

* do not switch back to YAML model specs
* do not replace the active model
* do not rerun passive calibration scripts
* do not integrate PassiveMuscleForceCalibration workflow code right now
* do not remove radians-based coordinate application logic
* do not skip `equilibrateMuscles`
* do not widen the optimizer without approval
* do not add pelvis translations to optimization yet
* do not expose upper-body tightness controls in v1
* do not include upper-body muscle metrics in default outputs
* do not claim clinical, neurological, or subject-specific validity
* do not replace full-body transforms with lower-body-only transforms
* do not remove smoke tests in favor of feature coding
* do not change objective weights unless explicitly approved
* do not tune regularization weights automatically during model migration
* do not change the `0.10` global-term coefficient unless explicitly approved 
