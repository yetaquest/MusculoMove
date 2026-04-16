from __future__ import annotations

from typing import Iterable

import numpy as np
from scipy.optimize import minimize

from app.services.model_factory import build_model
from app.services.pose_analysis_service import evaluate_pose


OPT_COORDS = [
    "pelvis_tilt",
    "lumbar_extension",
    "hip_flexion_r",
    "knee_angle_r",
    "ankle_angle_r",
]

REG_WEIGHTS = {
    "pelvis_tilt": 2.0,
    "lumbar_extension": 1.5,
    "hip_flexion_r": 1.0,
    "knee_angle_r": 0.5,
    "ankle_angle_r": 0.5,
}


def pose_vector_from_dict(pose_deg: dict[str, float]) -> np.ndarray:
    return np.array([float(pose_deg[c]) for c in OPT_COORDS], dtype=float)


def pose_dict_from_vector(
    x: np.ndarray, base_pose_deg: dict[str, float]
) -> dict[str, float]:
    pose = dict(base_pose_deg)
    for i, coord in enumerate(OPT_COORDS):
        pose[coord] = float(x[i])
    return pose


def bounds_from_spec(spec: dict) -> list[tuple[float, float]]:
    bounds = []
    for coord in OPT_COORDS:
        lo, hi = spec["optimizer_bounds_deg"][coord]
        bounds.append((float(lo), float(hi)))
    return bounds


def objective_function(
    x: np.ndarray,
    base_pose_deg: dict[str, float],
    selected_muscle_ids: list[str],
    tightness_settings: list[dict],
) -> float:
    pose_deg = pose_dict_from_vector(x, base_pose_deg)

    result = evaluate_pose(
        pose_deg=pose_deg,
        selected_muscle_ids=selected_muscle_ids,
        tightness_settings=tightness_settings,
    )

    selected_term = sum(
        row["weighted_normalized_passive_force"] ** 2
        for row in result["selected_groups"]
    )

    global_term = 0.10 * sum(
        row["weighted_normalized_passive_force"] ** 2 for row in result["all_groups"]
    )

    regularization = 0.0
    for coord, weight in REG_WEIGHTS.items():
        delta_deg = pose_deg[coord] - base_pose_deg[coord]
        delta_rad = delta_deg * 3.141592653589793 / 180.0
        regularization += weight * (delta_rad**2)

    return selected_term + global_term + regularization


def objective_breakdown(
    x,
    base_pose_deg,
    selected_muscle_ids,
    tightness_settings,
):
    pose_deg = pose_dict_from_vector(x, base_pose_deg)

    result = evaluate_pose(
        pose_deg=pose_deg,
        selected_muscle_ids=selected_muscle_ids,
        tightness_settings=tightness_settings,
    )

    selected_term = sum(
        row["weighted_normalized_passive_force"] ** 2
        for row in result["selected_groups"]
    )

    global_term = 0.10 * sum(
        row["weighted_normalized_passive_force"] ** 2 for row in result["all_groups"]
    )

    regularization = 0.0
    for coord, weight in REG_WEIGHTS.items():
        delta_deg = pose_deg[coord] - base_pose_deg[coord]
        delta_rad = delta_deg * 3.141592653589793 / 180.0
        regularization += weight * (delta_rad**2)

    return {
        "selected_term": selected_term,
        "global_term": global_term,
        "regularization": regularization,
        "total": selected_term + global_term + regularization,
    }


def solve_adapted_pose(
    selected_muscle_ids: list[str],
    tightness_settings: list[dict],
    initial_pose_deg: dict[str, float] | None = None,
    maxiter: int = 40,
) -> dict:
    loaded = build_model()
    spec = loaded.spec

    base_pose_deg = dict(spec["baseline_pose_deg"])
    if initial_pose_deg is not None:
        base_pose_deg.update(initial_pose_deg)

    x0 = pose_vector_from_dict(base_pose_deg)
    bounds = bounds_from_spec(spec)

    result = minimize(
        fun=objective_function,
        x0=x0,
        args=(base_pose_deg, selected_muscle_ids, tightness_settings),
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": maxiter},
    )

    adapted_pose_deg = pose_dict_from_vector(result.x, base_pose_deg)

    baseline_eval = evaluate_pose(
        pose_deg=base_pose_deg,
        selected_muscle_ids=selected_muscle_ids,
        tightness_settings=tightness_settings,
    )

    adapted_eval = evaluate_pose(
        pose_deg=adapted_pose_deg,
        selected_muscle_ids=selected_muscle_ids,
        tightness_settings=tightness_settings,
    )

    return {
        "success": bool(result.success),
        "message": str(result.message),
        "objective_value": float(result.fun),
        "base_pose_deg": base_pose_deg,
        "adapted_pose_deg": adapted_pose_deg,
        "baseline_eval": baseline_eval,
        "adapted_eval": adapted_eval,
    }
