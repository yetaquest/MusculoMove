from __future__ import annotations

import opensim as osim


SEGMENT_NAMES = [
    "pelvis",
    "femur_r",
    "tibia_r",
    "talus_r",
    "calcn_r",
    "toes_r",
]


def simtk_vec3_to_list(v) -> list[float]:
    return [float(v.get(i)) for i in range(3)]


def simtk_rotation_to_matrix_list(rot) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(3):
        row = []
        for j in range(3):
            row.append(float(rot.get(i, j)))
        out.append(row)
    return out


def read_segment_transforms(
    model: osim.Model,
    state: osim.State,
    segment_names: list[str] | None = None,
) -> list[dict]:
    """
    Return world transforms for key lower-body segments.

    Each row contains:
      - segment_id
      - translation_m: [x, y, z]
      - rotation_matrix: 3x3 world rotation matrix
    """
    model.realizePosition(state)

    bodyset = model.getBodySet()
    names = segment_names or SEGMENT_NAMES
    rows: list[dict] = []

    for name in names:
        body = bodyset.get(name)
        transform = body.getTransformInGround(state)

        p = transform.p()
        R = transform.R()

        rows.append(
            {
                "segment_id": name,
                "translation_m": simtk_vec3_to_list(p),
                "rotation_matrix": simtk_rotation_to_matrix_list(R),
            }
        )

    return rows
