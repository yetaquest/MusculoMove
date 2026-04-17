# MusculoMove

This repo now provides a minimal static-pose backend for the full-body OpenSim model at `models/RajagopalLaiUhlrich2023.osim`. The implementation keeps lower-body muscle analysis as the default scope, returns full-body segment transforms, and keeps the passive optimizer on the phase-1 coordinate subset from `AGENTS.md`.

## Commands

Print manifest and configuration data:

```bash
uv run --cache-dir /tmp/uv-cache python main.py manifest
```

Evaluate a static pose request:

```bash
uv run --cache-dir /tmp/uv-cache python main.py evaluate --request path/to/request.json
```

Run the phase-1 passive optimizer:

```bash
uv run --cache-dir /tmp/uv-cache python main.py optimize --request path/to/request.json
```

## Notes

- The active model path is hardcoded to `models/RajagopalLaiUhlrich2023.osim`.
- Tightness follows `l_opt,new = l_opt,0 (1 - s alpha)` and requires an explicit `max_shortening_fraction` in each request directive.
- Native OpenSim evaluation is working in the current environment after installing `libopenblas`.

Detailed review notes for this implementation live in [docs/implementation-review.md](/home/etekmen13/projects/MusculoMove/docs/implementation-review.md).
Exact product usage instructions and example request files live in [docs/how-to-use.md](/home/etekmen13/projects/MusculoMove/docs/how-to-use.md).
