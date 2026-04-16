from __future__ import annotations

from typing import Iterable


def apply_tightness_settings(
    model,
    settings: Iterable[dict],
    muscle_group_map: dict,
) -> None:
    """
    v1 tightness definition:
    shorten optimal fiber length by severity * max_shortening_fraction.

    Example setting:
    {
        "muscle_group_id": "iliopsoas",
        "severity": 0.5,
        "max_shortening_fraction": 0.20
    }
    """
    muscles = model.getMuscles()

    for setting in settings:
        muscle_group_id = setting["muscle_group_id"]
        severity = float(setting.get("severity", 0.0))
        max_shortening_fraction = float(setting.get("max_shortening_fraction", 0.20))

        if muscle_group_id not in muscle_group_map:
            raise KeyError(f"Unknown muscle_group_id: {muscle_group_id}")

        group_spec = muscle_group_map[muscle_group_id]
        actuator_names = group_spec["actuators"]

        for actuator_name in actuator_names:
            muscle = muscles.get(actuator_name)

            original_opt_len = float(muscle.getOptimalFiberLength())
            scale = 1.0 - severity * max_shortening_fraction
            new_opt_len = original_opt_len * scale

            muscle.setOptimalFiberLength(new_opt_len)


def aggregate_group_outputs(
    actuator_outputs: list[dict],
    muscle_group_map: dict,
) -> list[dict]:
    """
    Aggregate actuator-level outputs into UI muscle-group outputs.

    Weighted normalized passive force:
        weighted average by max isometric force.

    Worst compartment:
        max normalized passive force within the group.
    """
    actuator_to_group: dict[str, str] = {}
    group_display_names: dict[str, str] = {}

    for group_id, group_spec in muscle_group_map.items():
        group_display_names[group_id] = group_spec["display_name"]
        for actuator_name in group_spec["actuators"]:
            actuator_to_group[actuator_name] = group_id

    grouped: dict[str, list[dict]] = {}
    for row in actuator_outputs:
        actuator_id = row["actuator_id"]
        if actuator_id not in actuator_to_group:
            continue
        group_id = actuator_to_group[actuator_id]
        grouped.setdefault(group_id, []).append(row)

    summaries: list[dict] = []

    for group_id, rows in grouped.items():
        total_force_capacity = sum(r["max_isometric_force_n"] for r in rows)

        if total_force_capacity > 0:
            weighted_norm_passive = (
                sum(
                    r["normalized_passive_force"] * r["max_isometric_force_n"]
                    for r in rows
                )
                / total_force_capacity
            )
        else:
            weighted_norm_passive = 0.0

        worst_compartment = max(r["normalized_passive_force"] for r in rows)
        mean_norm_fiber_length = sum(r["normalized_fiber_length"] for r in rows) / len(
            rows
        )

        summaries.append(
            {
                "muscle_group_id": group_id,
                "display_name": group_display_names[group_id],
                "weighted_normalized_passive_force": weighted_norm_passive,
                "worst_compartment_normalized_passive_force": worst_compartment,
                "mean_normalized_fiber_length": mean_norm_fiber_length,
                "actuator_count": len(rows),
            }
        )

    summaries.sort(
        key=lambda x: x["weighted_normalized_passive_force"],
        reverse=True,
    )
    return summaries
