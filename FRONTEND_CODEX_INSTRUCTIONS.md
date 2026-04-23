# MusculoMove Frontend Codex Brief
## For the RajagopalLaiUhlrich2023 backend

## Mission
Build a polished web frontend that:
- visualizes the **full-body** model in 3D
- lets the user select **individual lower-body muscles**
- lets the user adjust muscle tightness
- updates the body in near-real time when feasible
- lets the user run optimization and view the resulting body pose
- keeps the backend’s biomechanics math and interpretation intact

This frontend is for a **mechanical accommodation demo**, not diagnosis or clinical decision support.

---

## Non-negotiable backend/model assumptions
Use the backend and model decisions already locked in:
- active model: `RajagopalLaiUhlrich2023.osim`
- full-body model remains intact
- frontend must render **full-body segment transforms**
- lower-body muscle analysis remains the primary analysis scope
- upper-body muscle metrics stay hidden by default
- optimizer remains **passive-only** in v1
- backend math and objective structure must not be silently changed during frontend work

The Rajagopal 2016 model family is a full-body OpenSim model with **22 rigid bodies**, **37 total DOF**, **80 lower-limb muscle–tendon units** (40 per leg), and **17 upper-body torque actuators**. It was validated primarily for healthy walking and running, not for quiet-standing clinical prediction. :contentReference[oaicite:0]{index=0}

---

## Critical rule: frontend work must not rewrite backend biomechanics
Codex is allowed to inspect and minimally adjust the backend **only if necessary** to support the frontend, but must preserve these math/design invariants unless explicitly approved by the user:

### Tightness model
For each selected actuator:
- `l_opt_new = l_opt_0 * (1 - severity * max_shortening_fraction)`

### Per-muscle metrics
Preserve:
- normalized fiber length  
  `l_f_tilde = l_f / l_opt`
- normalized passive force  
  `n_i = max(0, F_passive_i) / F_max_i`

### Group metric
For muscle group `G`:
- weighted normalized passive force  
  `N_G = sum(n_i * F_max_i) / sum(F_max_i)`

### Objective structure
Preserve exactly:
- `J(x) = J_selected(x) + 0.10 * J_global(x) + J_reg(x)`

Where:
- `J_selected(x) = sum over selected groups of N_G(x)^2`
- `J_global(x) = sum over all groups of N_G(x)^2`
- `J_reg(x) = sum_j w_j * (delta_q_j_in_radians)^2`

### Objective-weight policy
- Use the exact current objective structure and objective weights unless they are explicitly changed by the user.
- Do not tune weights automatically during migration to the new model.
- Do not rebalance selected-term, global-term, or regularization weights just because the active model changed.
- First reproduce stable behavior with the new model under the existing weights.
- Only change weights after side-by-side evaluation shows a clear modeling reason to do so.

### Current regularization weights to preserve
- `pelvis_tilt: 2.0`
- `pelvis_list: 2.0`
- `pelvis_rotation: 2.0`
- `lumbar_extension: 1.5`
- `hip_flexion_l: 1.0`
- `knee_angle_l: 0.5`
- `ankle_angle_l: 0.5`
- `hip_flexion_r: 1.0`
- `knee_angle_r: 0.5`
- `ankle_angle_r: 0.5`

These math rules come from the MusculoMove backend spec, not from the Rajagopal paper. Preserve them. :contentReference[oaicite:1]{index=1}

---

## Frontend output goals
The v1 frontend should provide:
1. **3D model viewport**
2. **individual muscle selection UI**
3. **tightness controls**
4. **evaluate / optimize interaction**
5. **optimizer status display**
6. **toggleable debug panel for transform inspection**
7. **full camera controls**
8. **smooth pose interpolation**
9. **graceful degraded behavior if backend is slow or unavailable**

---

## Preferred avatar / GLB strategy

### Preferred production avatar source
Use a **Ready Player Me full-body avatar exported as GLB** as the preferred production avatar source.

Why this is the best fit:
- Ready Player Me supports downloadable GLB avatars and has a web-focused avatar ecosystem.
- Ready Player Me provides avatar-performance controls through its avatar API.
- Ready Player Me also publishes **Visage**, an MIT-licensed React / three.js avatar-display library, which shows it is a good technical fit for a web frontend built with React and Three.js. :contentReference[oaicite:2]{index=2}

### Licensing / operational caveat
Do **not** make the frontend depend on live Ready Player Me account setup or partner credentials.

Ready Player Me’s own materials say avatars are free for non-commercial projects with credit, and that commercial projects can apply for partner access, which they describe as free. Because of that licensing / account flow, Codex must not block the project on live avatar generation. :contentReference[oaicite:3]{index=3}

### Required implementation decision
Build the frontend so the avatar asset is **swappable**:
- preferred runtime asset: local `public/models/avatar.glb`
- if that file exists, load it
- if it does not exist, fall back to a **debug visualization mode** that renders backend segments as simple sticks/capsules/boxes so development is never blocked by missing art assets

### Asset-path policy
Use a local configurable path:
- `public/models/avatar.glb`

Do **not** hardcode dependence on an external hosted avatar URL in v1.

---

## Backend probing policy
Codex should first inspect the backend codebase and determine:
- actual API routes
- actual request/response payloads
- actual lower-body muscle identifiers
- actual segment-transform response shape
- whether evaluate and optimize endpoints already exist
- whether a catalog endpoint already exists
- whether optimizer status is already exposed

If the backend is missing small fields needed by the frontend, Codex may make **minimal backend changes** to expose:
- full-body segment transforms
- optimizer/evaluation status
- lower-body muscle catalog
- selected-muscle identifiers
- current pose result needed for rendering

Codex must not redesign the backend architecture or change model math just to make the frontend easier.

---

## Frontend stack
Build the frontend from scratch in the existing `frontend` folder using:

- **Vite**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Three.js**
- **@react-three/fiber**
- **@react-three/drei**
- **Zustand** for app state
- optional **Framer Motion** for UI transitions
- optional **React Query / TanStack Query** for API request state if useful

The result should be a polished product-like web UI, not a plain debug page.

---

## UX requirements

### Primary user flow
The user should be able to:
1. open the app
2. see the current 3D body pose
3. select an individual muscle
4. choose side: left / right / bilateral
5. adjust tightness severity
6. see pose changes update in near-real time if feasible
7. press **Optimize** to compute a compensation pose
8. view the optimized pose with smooth interpolation
9. see current optimizer/request status
10. optionally open a debug panel for transform inspection

### Visible information in v1
Show only:
- optimizer/request status
- muscle controls
- side selector
- severity controls
- 3D model
- camera controls
- non-blocking warning if backend errors or is slow

Do **not** make numeric passive metrics a prominent primary UI surface in v1.
They may remain available in a hidden debug panel later if useful.

### Comparison view
Do **not** render a baseline ghost overlay in v1.
Only show the **current pose**.

---

## Muscle selection policy

### Selection mode
Use **individual muscles only** in the primary UI.

### Preset policy
Start with **individual-muscle presets**, not groups.

Expected useful preset examples:
- `iliacus`
- `psoas`
- `rectus_femoris`
- `biceps_femoris_long_head`
- `biceps_femoris_short_head`
- `semitendinosus`
- `semimembranosus`
- `soleus`
- `gastrocnemius_medialis`
- `gastrocnemius_lateralis`
- `tibialis_anterior`
- `gluteus_medius`
- `gluteus_maximus`

Codex should derive the exact available muscle names from the actual backend/model catalog instead of assuming names from the paper.

### Side selector policy
Each individual muscle row should have a side selector:
- `Left`
- `Right`
- `Bilateral`

Even though the UI is individual-muscle-first, the data model should be built so bilateral lower-body support is natural and not hacked in later.

---

## Interaction behavior

### Realtime policy
Preferred behavior:
- evaluate continuously with debounce **if tractable**

Fallback behavior:
- if continuous evaluation is too slow, update only on release
- optimization should happen only on pressing the **Optimize** button

### Practical threshold
Codex should implement this policy:
- start with debounced evaluate while dragging (roughly 150–250 ms debounce)
- observe actual round-trip time in dev
- if the experience is smooth enough, keep it
- if not, automatically degrade UX to “update on release” while preserving the same controls

### Optimize interaction
- optimization should always be explicit via button press in v1
- do not run the full optimizer on every slider tick

### Pose transition policy
Use **short smooth interpolation** between responses.
Target:
- about 150–300 ms interpolation duration
- interruptible when a new response arrives
- no long animation queueing

---

## 3D viewer requirements

### Full-body transform policy
Update **full-body segments** from backend transforms on every response.

Do not update only the lower body in the viewer.
Even though analysis is lower-body-first, the body on screen should update as a whole.

### Camera controls
Must include:
- orbit
- pan
- zoom
- preset front / side / 3/4 views
- reset camera button

### Lighting and scene
Use a polished but simple studio-like scene:
- neutral background
- one key light + one fill light + ambient/HDRI if useful
- ground shadow or subtle contact shadow if helpful
- no distracting environment art

### Transform application policy
Backend remains **matrix-first**.
Frontend should:
- read `translation_m`
- read `rotation_matrix_3x3`
- convert to Three.js transform objects
- derive quaternions on the frontend as needed for the rig

Do not require backend quaternions in v1.

---

## GLB / rig mapping requirements

### Bone-name uncertainty
The user does **not** know the final GLB bone names.

Therefore Codex must implement a small debug utility that:
- inspects the loaded GLB skeleton
- prints/logs the bone hierarchy
- helps map backend segment names to GLB bone names

### Required mapping layer
Create a dedicated mapping file, for example:
- `src/lib/segmentMap.ts`

This file should map backend segment/frame names to GLB bones.
Do not scatter bone-name assumptions throughout the app.

### Required fallback
If a segment cannot be mapped to a GLB bone:
- do not crash
- warn in debug mode
- leave the unmatched bone in rest pose
- continue rendering other mapped segments

### Strong recommendation
Apply transforms through a dedicated adapter layer.
Do not directly mutate arbitrary bones from raw API responses.

---

## Debug panel requirements
Include a **toggleable debug panel** that can be opened or closed.

It should show at least:
- selected segment name
- mapped GLB bone name
- backend translation
- backend rotation matrix
- derived quaternion
- whether the segment was successfully applied
- latest request mode (`evaluate`, `optimize`, or fallback)

This panel is for development and troubleshooting, not primary UX.

---

## Error and slow-backend handling
If the backend is slow or unavailable:
- keep the **last valid pose** on screen
- show a **non-blocking warning**
- do not blank the viewer
- do not hard reset controls unless necessary

Recommended UI behavior:
- subtle toast or status banner
- loading spinner only near the action that is in progress
- preserve previous successful state until replaced by a new successful response

Optional but recommended:
- include a local saved sample JSON payload so the viewer can be tested even when the backend is down

---

## Backend request/response expectations
Codex should infer actual payloads from the codebase, but the frontend should ideally work with an internal normalized shape like:

```ts
type SegmentTransform = {
  translation_m: [number, number, number];
  rotation_matrix_3x3: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
};

type EvaluateOrOptimizeResponse = {
  pose_deg?: Record<string, number>;
  pose_delta_deg_from_baseline?: Record<string, number>;
  segment_transforms: Record<string, SegmentTransform>;
  lower_body_muscle_metrics?: Record<string, unknown>;
  status?: {
    phase?: string;
    message?: string;
    running?: boolean;
    mode?: "evaluate" | "optimize";
  };
};
````

Codex may adapt this to the real backend, but should normalize data into a frontend-safe internal shape.

---

## Recommended frontend architecture

### Suggested folder structure

```text
frontend/
  src/
    api/
      client.ts
      normalize.ts
    components/
      layout/
      viewer/
      controls/
      debug/
      status/
    lib/
      segmentMap.ts
      transformAdapter.ts
      boneInspector.ts
      interpolation.ts
    state/
      appStore.ts
    types/
      api.ts
      viewer.ts
    assets/
    App.tsx
    main.tsx
```

### Key modules

* `client.ts`
  Discovers and calls actual backend endpoints.

* `normalize.ts`
  Normalizes backend payloads into a consistent frontend shape.

* `segmentMap.ts`
  Stores backend-segment to GLB-bone mappings.

* `transformAdapter.ts`
  Converts matrix-first backend transforms into Three.js transforms.

* `boneInspector.ts`
  Prints / inspects GLB hierarchy to help mapping.

* `interpolation.ts`
  Handles short smooth transform interpolation.

* `appStore.ts`
  Keeps UI state, selection state, request state, and latest result.

---

## UI layout recommendation

Use a modern dashboard layout:

### Left panel

* muscle search
* preset muscle list
* active muscle cards
* side selector per active muscle
* severity slider per active muscle
* evaluate/optimize controls
* reset button

### Center panel

* 3D viewer
* camera controls
* top-right status chip
* optional floating buttons for preset views and reset

### Right panel or drawer

* optimizer/request status
* debug toggle
* debug transform inspector when enabled

For smaller screens:

* convert side panels into drawers/sheets
* keep the 3D viewer dominant

---

## Styling requirements

Target a polished product-like UI:

* clean neutral palette
* strong typography hierarchy
* rounded cards
* subtle shadows
* restrained use of accent color
* smooth hover/focus transitions
* good empty / loading / error states

Do not build a raw debug-looking interface as the default experience.

---

## Frontend smoke test (must pass before live API wiring)

Before relying on live backend calls, Codex must make this pass:

1. load the frontend
2. load the GLB if present, otherwise load debug segment geometry
3. use one saved backend-like JSON transform payload
4. apply transforms to at least:

   * pelvis
   * right femur
   * right tibia
   * right foot
5. verify those parts move correctly in 3D
6. verify interpolation works
7. verify debug panel shows transform details

Only after that should Codex wire live API evaluate/optimize calls.

This is the first must-pass frontend smoke test.

---

## Live API integration plan

After the smoke test passes:

### Phase 1

* probe backend routes
* normalize payloads
* wire `evaluate` requests
* display current pose updates
* keep UI stable under repeated requests

### Phase 2

* wire `optimize` requests
* show optimizer/request status
* animate transition to optimized pose

### Phase 3

* harden fallback/error behavior
* add bone-inspection tooling
* verify full-body transform updates
* clean styling and polish

---

## Allowed backend adjustments

Codex may make backend adjustments **only if necessary** for frontend integration, such as:

* exposing full-body segment transforms in evaluate responses
* exposing optimizer status/messages
* exposing a muscle catalog endpoint
* making response objects JSON-stable and frontend-friendly
* adding a sample response fixture for smoke testing

Codex must **not**:

* redesign the backend
* swap models
* change biomechanics formulas
* change objective weights
* silently change optimizer coordinates
* remove matrix-first transform output

---

## Environment assumptions

* frontend development happens in **WSL / Node / npm**
* final deliverable is a **website**
* use cross-platform npm scripts
* do not rely on Windows-only frontend scripts

---

## Deliverables

Codex should deliver:

1. a new frontend app in the cleared `frontend` folder
2. a product-like UI
3. a working 3D viewer
4. full-body transform playback
5. individual-muscle selection UI
6. side selector per selected muscle
7. severity controls
8. evaluate/optimize wiring
9. short smooth interpolation
10. toggleable debug panel
11. non-blocking error handling
12. a passing smoke test path
13. a short README explaining:

* how to run the frontend
* where to place `public/models/avatar.glb`
* how to use debug mode if no GLB is present
* how to inspect bone names / mapping issues

---

## Things Codex should not do silently

* do not switch away from `RajagopalLaiUhlrich2023.osim`
* do not change backend optimization math
* do not change objective weights
* do not invent new biomechanics metrics as primary UI outputs
* do not block development on obtaining a specific GLB
* do not assume Ready Player Me credentials are available
* do not hardcode fragile bone names throughout the codebase
* do not remove matrix-first transforms
* do not make optimization run on every slider tick
* do not discard the last valid pose on transient backend errors

---

## Recommended default implementation strategy

1. Build the viewer and debug transform pipeline first.
2. Make avatar loading asset-swappable.
3. Support both:

   * local `avatar.glb`
   * no-GLB debug geometry mode
4. Probe backend routes and normalize responses.
5. Implement debounced evaluate if tractable.
6. Keep optimize on button press.
7. Polish the UI only after transform playback is working.

---

## Helpful technical note on the avatar choice

Preferred production avatar source: **Ready Player Me full-body GLB**.
Implementation must still stay generic enough to swap in any local humanoid GLB later.

Ready Player Me is the preferred source because it aligns well with a web React/Three pipeline and supports downloadable GLB avatars; their ecosystem also includes a React/three.js display library. But because account/licensing flow can vary by project, the repo itself should not depend on live RPM integration for v1. ([landing.readyplayer.me][1])
