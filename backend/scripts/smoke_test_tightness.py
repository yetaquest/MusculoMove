from __future__ import annotations

from app.services.model_factory import build_model
from app.services.state_service import init_state, apply_pose_deg, realize_for_reporting
from app.adapters.opensim_muscles import equilibrate_muscles, read_muscle_outputs
from app.services.muscle_service import (
    apply_tightness_settings,
    aggregate_group_outputs,
)


def all_actuator_names(spec: dict) -> list[str]:
    names: list[str] = []
    for group_spec in spec["muscle_groups"].values():
        names.extend(group_spec["actuators"])
    return names


def run_case(tightness_settings: list[dict]) -> list[dict]:
    loaded = build_model()
    spec = loaded.spec
    model = loaded.model

    if tightness_settings:
        apply_tightness_settings(
            model=model,
            settings=tightness_settings,
            muscle_group_map=spec["muscle_groups"],
        )

    state = init_state(model)

    apply_pose_deg(
        model=model,
        state=state,
        pose_deg=spec["baseline_pose_deg"],
        coordinate_name_map=spec["coordinate_map"],
    )

    equilibrate_muscles(model, state)
    realize_for_reporting(model, state)

    actuator_outputs = read_muscle_outputs(
        model=model,
        state=state,
        actuator_names=all_actuator_names(spec),
    )

    grouped = aggregate_group_outputs(
        actuator_outputs=actuator_outputs,
        muscle_group_map=spec["muscle_groups"],
    )
    return grouped


def find_group(rows: list[dict], group_id: str) -> dict:
    for row in rows:
        if row["muscle_group_id"] == group_id:
            return row
    raise KeyError(group_id)


def main() -> None:
    baseline = run_case([])

    tightened = run_case(
        [
            {
                "muscle_group_id": "iliopsoas",
                "severity": 0.75,
                "max_shortening_fraction": 0.20,
            }
        ]
    )

    base_iliopsoas = find_group(baseline, "iliopsoas")
    tight_iliopsoas = find_group(tightened, "iliopsoas")

    print("\n=== ILIOPSOAS COMPARISON ===")
    print(
        f"baseline weighted normalized passive force: "
        f"{base_iliopsoas['weighted_normalized_passive_force']:.6f}"
    )
    print(
        f"tightened weighted normalized passive force: "
        f"{tight_iliopsoas['weighted_normalized_passive_force']:.6f}"
    )
    print(
        f"baseline mean normalized fiber length: "
        f"{base_iliopsoas['mean_normalized_fiber_length']:.6f}"
    )
    print(
        f"tightened mean normalized fiber length: "
        f"{tight_iliopsoas['mean_normalized_fiber_length']:.6f}"
    )

    print("\n=== TOP GROUPS AFTER TIGHTENING ===")
    for row in tightened[:8]:
        print(
            f"{row['display_name']:<24} "
            f"weighted={row['weighted_normalized_passive_force']:.6f}  "
            f"worst={row['worst_compartment_normalized_passive_force']:.6f}  "
            f"mean_len={row['mean_normalized_fiber_length']:.6f}"
        )


if __name__ == "__main__":
    main()
