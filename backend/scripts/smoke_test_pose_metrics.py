from __future__ import annotations

from app.services.model_factory import build_model
from app.services.state_service import init_state, apply_pose_deg, realize_for_reporting
from app.adapters.opensim_muscles import equilibrate_muscles, read_muscle_outputs
from app.services.muscle_service import aggregate_group_outputs


def all_actuator_names(spec: dict) -> list[str]:
    names: list[str] = []
    for group_spec in spec["muscle_groups"].values():
        names.extend(group_spec["actuators"])
    return names


def main() -> None:
    loaded = build_model()
    spec = loaded.spec
    model = loaded.model

    state = init_state(model)

    apply_pose_deg(
        model=model,
        state=state,
        pose_deg=spec["baseline_pose_deg"],
        coordinate_name_map=spec["coordinate_map"],
    )

    equilibrate_muscles(model, state)
    realize_for_reporting(model, state)

    outputs = read_muscle_outputs(
        model=model,
        state=state,
        actuator_names=all_actuator_names(spec),
    )

    grouped = aggregate_group_outputs(
        actuator_outputs=outputs,
        muscle_group_map=spec["muscle_groups"],
    )

    print("\n=== MODEL ===")
    print(model.getName())

    print("\n=== TOP GROUPS BY WEIGHTED NORMALIZED PASSIVE FORCE ===")
    for row in grouped:
        print(
            f"{row['display_name']:<24} "
            f"weighted={row['weighted_normalized_passive_force']:.6f}  "
            f"worst={row['worst_compartment_normalized_passive_force']:.6f}  "
            f"mean_len={row['mean_normalized_fiber_length']:.6f}"
        )

    print("\n=== SAMPLE ACTUATOR OUTPUTS ===")
    for row in outputs[:10]:
        print(
            f"{row['actuator_id']:<14} "
            f"passive_N={row['passive_fiber_force_n']:.6f}  "
            f"norm_passive={row['normalized_passive_force']:.6f}  "
            f"norm_len={row['normalized_fiber_length']:.6f}"
        )


if __name__ == "__main__":
    main()
