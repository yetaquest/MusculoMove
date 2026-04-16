from __future__ import annotations

from app.services.optimization_service import solve_adapted_pose

from app.services.optimization_service import (
    solve_adapted_pose,
    objective_breakdown,
    pose_vector_from_dict,
)


def print_group(label: str, row: dict) -> None:
    print(
        f"{label:<20} "
        f"weighted={row['weighted_normalized_passive_force']:.6f}  "
        f"worst={row['worst_compartment_normalized_passive_force']:.6f}  "
        f"mean_len={row['mean_normalized_fiber_length']:.6f}"
    )


def main() -> None:
    result = solve_adapted_pose(
        selected_muscle_ids=["iliopsoas"],
        tightness_settings=[
            {
                "muscle_group_id": "iliopsoas",
                "severity": 0.75,
                "max_shortening_fraction": 0.20,
            }
        ],
        maxiter=15,
    )

    baseline_breakdown = objective_breakdown(
        x=pose_vector_from_dict(result["base_pose_deg"]),
        base_pose_deg=result["base_pose_deg"],
        selected_muscle_ids=["iliopsoas"],
        tightness_settings=[
            {
                "muscle_group_id": "iliopsoas",
                "severity": 0.75,
                "max_shortening_fraction": 0.20,
            }
        ],
    )

    adapted_breakdown = objective_breakdown(
        x=pose_vector_from_dict(result["adapted_pose_deg"]),
        base_pose_deg=result["base_pose_deg"],
        selected_muscle_ids=["iliopsoas"],
        tightness_settings=[
            {
                "muscle_group_id": "iliopsoas",
                "severity": 0.75,
                "max_shortening_fraction": 0.20,
            }
        ],
    )

    print("\n=== OBJECTIVE BREAKDOWN: BASELINE ===")
    print(baseline_breakdown)

    print("\n=== OBJECTIVE BREAKDOWN: ADAPTED ===")
    print(adapted_breakdown)

    print("\n=== OPTIMIZER STATUS ===")
    print("success:", result["success"])
    print("message:", result["message"])
    print("objective:", result["objective_value"])

    print("\n=== BASE POSE ===")
    for k, v in result["base_pose_deg"].items():
        print(f"{k}: {v:.3f}")

    print("\n=== ADAPTED POSE ===")
    for k, v in result["adapted_pose_deg"].items():
        print(f"{k}: {v:.3f}")

    baseline_group = result["baseline_eval"]["selected_groups"][0]
    adapted_group = result["adapted_eval"]["selected_groups"][0]

    print("\n=== ILIOPSOAS BEFORE / AFTER ===")
    print_group("baseline", baseline_group)
    print_group("adapted", adapted_group)

    print("\n=== TOP 6 GROUPS AFTER ADAPTATION ===")
    for row in result["adapted_eval"]["all_groups"][:6]:
        print_group(row["display_name"], row)


if __name__ == "__main__":
    main()
