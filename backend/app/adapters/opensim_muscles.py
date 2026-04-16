from __future__ import annotations

from typing import Iterable

import opensim as osim


def equilibrate_muscles(model: osim.Model, state: osim.State) -> None:
    """
    Put all muscles into equilibrium before reading outputs.
    """
    model.equilibrateMuscles(state)
    model.realizePosition(state)
    model.realizeVelocity(state)
    model.realizeDynamics(state)


def read_muscle_outputs(
    model: osim.Model,
    state: osim.State,
    actuator_names: Iterable[str],
) -> list[dict]:
    muscles = model.getMuscles()
    outputs: list[dict] = []

    for actuator_name in actuator_names:
        muscle = muscles.get(actuator_name)

        max_iso = float(muscle.getMaxIsometricForce())
        passive_force = float(muscle.getPassiveFiberForce(state))
        passive_multiplier = float(muscle.getPassiveForceMultiplier(state))
        norm_fiber_length = float(muscle.getNormalizedFiberLength(state))
        stiffness = float(muscle.getMuscleStiffness(state))

        normalized_passive_force = passive_force / max_iso if max_iso > 0 else 0.0

        outputs.append(
            {
                "actuator_id": muscle.getName(),
                "passive_fiber_force_n": passive_force,
                "passive_force_multiplier": passive_multiplier,
                "normalized_fiber_length": norm_fiber_length,
                "muscle_stiffness_n_per_m": stiffness,
                "max_isometric_force_n": max_iso,
                "normalized_passive_force": normalized_passive_force,
            }
        )

    return outputs
