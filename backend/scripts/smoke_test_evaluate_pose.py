from __future__ import annotations

from pprint import pprint

from app.services.model_factory import build_model
from app.services.pose_analysis_service import evaluate_pose


def main() -> None:
    loaded = build_model()
    spec = loaded.spec

    result = evaluate_pose(
        pose_deg=spec["baseline_pose_deg"],
        selected_muscle_ids=["iliopsoas"],
        tightness_settings=[
            {
                "muscle_group_id": "iliopsoas",
                "severity": 0.75,
                "max_shortening_fraction": 0.20,
            }
        ],
    )

    print("\n=== MODEL ===")
    print(result["model_name"])

    print("\n=== POSE ===")
    pprint(result["pose_deg"])

    print("\n=== SELECTED GROUPS ===")
    for row in result["selected_groups"]:
        print(
            f"{row['display_name']:<24} "
            f"weighted={row['weighted_normalized_passive_force']:.6f}  "
            f"worst={row['worst_compartment_normalized_passive_force']:.6f}  "
            f"mean_len={row['mean_normalized_fiber_length']:.6f}"
        )

    print("\n=== SELECTED ACTUATORS ===")
    for row in result["selected_actuators"]:
        print(
            f"{row['actuator_id']:<14} "
            f"passive_N={row['passive_fiber_force_n']:.6f}  "
            f"norm_passive={row['normalized_passive_force']:.6f}  "
            f"norm_len={row['normalized_fiber_length']:.6f}"
        )

    print("\n=== TOP 8 GROUPS OVERALL ===")
    for row in result["all_groups"][:8]:
        print(
            f"{row['display_name']:<24} "
            f"weighted={row['weighted_normalized_passive_force']:.6f}  "
            f"worst={row['worst_compartment_normalized_passive_force']:.6f}  "
            f"mean_len={row['mean_normalized_fiber_length']:.6f}"
        )


if __name__ == "__main__":
    main()
