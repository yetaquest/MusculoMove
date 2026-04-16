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
        top_k_groups=6,
        include_segment_transforms=True,
    )

    print("\n=== MODEL ===")
    print(result["model_name"])

    print("\n=== POSE DELTAS FROM BASELINE ===")
    pprint(result["pose_delta_deg_from_baseline"])

    print("\n=== TOP GROUPS ===")
    for row in result["all_groups"]:
        print(
            f"{row['display_name']:<24} "
            f"weighted={row['weighted_normalized_passive_force']:.6f}  "
            f"worst={row['worst_compartment_normalized_passive_force']:.6f}  "
            f"mean_len={row['mean_normalized_fiber_length']:.6f}"
        )

    print("\n=== SEGMENT TRANSFORMS ===")
    for row in result["segment_transforms"]:
        print(f"\n[{row['segment_id']}]")
        print("translation_m =", row["translation_m"])
        print("rotation_matrix =")
        for mat_row in row["rotation_matrix"]:
            print("  ", mat_row)


if __name__ == "__main__":
    main()
