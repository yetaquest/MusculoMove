Implement realtime interactive posture updates for the MusculoMove backend without removing the exact OpenSim optimizer.

Project context:
- Backend-first OpenSim project
- Hardcoded model config, no YAML
- Active model: Arnoldetal2010_2Legs_Default_v2.1.osim
- Lower body only
- Static pose evaluation only
- Tightness is currently modeled by shortening optimal fiber length
- Main signals: passive loading and normalized fiber length
- Posture adaptation is optimized over a small DOF subset
- Outputs must stay JSON-friendly
- Segment transforms are the bridge to frontend rendering

Goal:
Make muscle-tightness slider updates feel realtime. Do not run the full nonlinear pose optimization on every slider tick. Instead, add a surrogate-based interactive mode plus exact refinement.

What to build:
1. Keep the current exact optimizer as source of truth.
2. Add an offline sampling pipeline for one tightness control first:
   - sweep tightness over ~31 evenly spaced values in [0, 1]
   - for each sample, run the exact solve
   - store:
     - optimized DOFs
     - objective value
     - selected muscle passive metrics
     - surrounding muscle passive metrics
     - normalized fiber lengths
     - segment transforms
3. Fit a cheap surrogate over the sampled data:
   - start with 1D cubic splines for each scalar output
   - do not use a neural net unless clearly necessary
4. Add an interactive inference path:
   - during slider drag, return surrogate-predicted pose/metrics/transforms immediately
   - on slider release, run the exact optimizer starting from the surrogate-predicted pose or previous exact pose as a warm start
5. Reuse the OpenSim model/system initialization where possible:
   - do not rebuild/init the model for every request unless structurally required
6. Keep changes incremental and testable.

Implementation requirements:
- First inspect the existing backend structure and adapt to it instead of inventing a new architecture
- Preserve current API behavior where possible
- Add new code in a clean backend service layer
- Keep code simple and explicit
- Prefer small utilities over heavy abstractions
- Add logging/timing so we can compare:
  - exact solve time
  - surrogate inference time
  - refinement solve time
- If some existing runtime cost is coming from repeated model construction/initSystem, fix that first before adding more complexity

Suggested deliverables:
- sampling script
- surrogate fitting module
- realtime analysis service with two modes:
  - interactive surrogate mode
  - exact refine mode
- minimal API changes to expose both
- one benchmark/test script that prints latency and error against the exact solution

Validation criteria:
- For one muscle group / one scalar tightness input, surrogate outputs should be smooth
- Interactive response should be near-instant
- Exact refinement should remain available
- Report pose error and metric error between surrogate and exact outputs
- If the mapping is not smooth, say so clearly and stop before overengineering

Important:
- Do not jump to frontend work
- Do not introduce YAML model specs
- Do not replace the exact optimizer entirely
- Explain what each result means physically, not just technically

Start by identifying the smallest set of files to change, then implement the 1D sweep + spline surrogate end to end.
