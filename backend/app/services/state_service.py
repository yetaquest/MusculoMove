from __future__ import annotations

from typing import Mapping

import opensim as osim


def init_state(model: osim.Model) -> osim.State:
    return model.initSystem()


def apply_pose_deg(
    model: osim.Model,
    state: osim.State,
    pose_deg: Mapping[str, float],
    coordinate_name_map: Mapping[str, str],
) -> None:
    coordinate_set = model.getCoordinateSet()

    for app_coord_id, osim_coord_name in coordinate_name_map.items():
        if app_coord_id not in pose_deg:
            continue

        value_deg = float(pose_deg[app_coord_id])
        coord = coordinate_set.get(osim_coord_name)
        coord.setValue(state, value_deg * 3.141592653589793 / 180.0, False)

    model.realizePosition(state)


def realize_for_reporting(model: osim.Model, state: osim.State) -> None:
    model.realizePosition(state)
    model.realizeVelocity(state)
    model.realizeDynamics(state)
