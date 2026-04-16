from __future__ import annotations

from typing import Iterable

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


def selected_actuator_names(
    spec: dict, selected_muscle_ids: Iterable[str]
) -> list[str]:
    names: list[str] = []
    for muscle_group_id in selected_muscle_ids:
        if muscle_group_id not in spec["muscle_groups"]:
            raise KeyError(f"Unknown selected muscle group: {muscle_group_id}")
        names.extend(spec["muscle_groups"][muscle_group_id]["actuators"])
    return names


def filter_selected_groups(
    group_rows: list[dict], selected_muscle_ids: Iterable[str]
) -> list[dict]:
    wanted = set(selected_muscle_ids)
    return [row for row in group_rows if row["muscle_group_id"] in wanted]


def evaluate_pose(
    pose_deg: dict[str, float],
    selected_muscle_ids: list[str] | None = None,
    tightness_settings: list[dict] | None = None,
    top_k_groups: int | None = None,
) -> dict:
    """
    Core backend evaluation for one pose.

    Inputs:
      - pose_deg: pose values in degrees keyed by app coordinate ids
      - selected_muscle_ids: UI muscle group ids like ["iliopsoas"]
      - tightness_settings: list of settings dictionaries
      - top_k_groups: if provided, only keep the top-k overall muscle groups
                      in the returned "all_groups" list

    Returns:
      Plain Python dict ready to become JSON later.
    """
    selected_muscle_ids = selected_muscle_ids or []
    tightness_settings = tightness_settings or []

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
        pose_deg=pose_deg,
        coordinate_name_map=spec["coordinate_map"],
    )

    equilibrate_muscles(model, state)
    realize_for_reporting(model, state)

    all_outputs = read_muscle_outputs(
        model=model,
        state=state,
        actuator_names=all_actuator_names(spec),
    )

    grouped_outputs_full = aggregate_group_outputs(
        actuator_outputs=all_outputs,
        muscle_group_map=spec["muscle_groups"],
    )

    selected_outputs = (
        read_muscle_outputs(
            model=model,
            state=state,
            actuator_names=selected_actuator_names(spec, selected_muscle_ids),
        )
        if selected_muscle_ids
        else []
    )

    selected_group_outputs = filter_selected_groups(
        grouped_outputs_full, selected_muscle_ids
    )

    if top_k_groups is not None:
        grouped_outputs = grouped_outputs_full[:top_k_groups]
    else:
        grouped_outputs = grouped_outputs_full

    return {
        "model_name": model.getName(),
        "osim_file": spec["osim_file"],
        "pose_deg": pose_deg,
        "selected_muscle_ids": selected_muscle_ids,
        "tightness_settings": tightness_settings,
        "top_k_groups": top_k_groups,
        "all_groups_total_count": len(grouped_outputs_full),
        "selected_groups": selected_group_outputs,
        "selected_actuators": selected_outputs,
        "all_groups": grouped_outputs,
    }
