from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import opensim as osim


APP_ROOT = Path(__file__).resolve().parents[1]  # .../backend/app
OSIM_PATH = APP_ROOT / "data" / "models" / "Arnoldetal2010_2Legs_Default_v2.1.osim"


@dataclass
class LoadedModel:
    model_id: str
    spec: dict[str, Any]
    model: osim.Model


def build_model(model_id: str = "lower_limb_v1") -> LoadedModel:
    if not OSIM_PATH.exists():
        raise FileNotFoundError(f"OpenSim model file not found: {OSIM_PATH}")

    spec: dict[str, Any] = {
        "model_id": "lower_limb_v1",
        "display_name": "Lower Limb Compensation Sandbox v1",
        "osim_file": str(OSIM_PATH.resolve()),
        "coordinate_map": {
            "pelvis_tilt": "pelvis_tilt",
            "lumbar_extension": "lumbar_extension",
            "hip_flexion_r": "hip_flexion_r",
            "hip_adduction_r": "hip_adduction_r",
            "hip_rotation_r": "hip_rotation_r",
            "knee_angle_r": "knee_angle_r",
            "ankle_angle_r": "ankle_angle_r",
            "subtalar_angle_r": "subtalar_angle_r",
        },
        "muscle_groups": {
            "iliopsoas": {
                "display_name": "Iliopsoas",
                "actuators": ["iliacus_r", "psoas_r"],
            },
            "rectus_femoris": {
                "display_name": "Rectus femoris",
                "actuators": ["recfem_r"],
            },
            "hamstrings_medial": {
                "display_name": "Hamstrings (medial)",
                "actuators": ["semimem_r", "semiten_r"],
            },
            "hamstrings_lateral": {
                "display_name": "Hamstrings (lateral)",
                "actuators": ["bflh_r", "bfsh_r"],
            },
            "gluteus_maximus": {
                "display_name": "Gluteus maximus",
                "actuators": ["glmax1_r", "glmax2_r", "glmax3_r"],
            },
            "gluteus_medius": {
                "display_name": "Gluteus medius",
                "actuators": ["glmed1_r", "glmed2_r", "glmed3_r"],
            },
            "tensor_fasciae_latae": {
                "display_name": "Tensor fasciae latae",
                "actuators": ["tfl_r"],
            },
            "adductors": {
                "display_name": "Adductors",
                "actuators": [
                    "addlong_r",
                    "addbrev_r",
                    "addmagProx_r",
                    "addmagMid_r",
                    "addmagDist_r",
                    "addmagIsch_r",
                    "grac_r",
                ],
            },
            "gastrocnemius": {
                "display_name": "Gastrocnemius",
                "actuators": ["gasmed_r", "gaslat_r"],
            },
            "soleus": {
                "display_name": "Soleus",
                "actuators": ["soleus_r"],
            },
            "tibialis_posterior": {
                "display_name": "Tibialis posterior",
                "actuators": ["tibpost_r"],
            },
            "peroneals": {
                "display_name": "Peroneals",
                "actuators": ["perbrev_r", "perlong_r", "pertert_r"],
            },
        },
        "baseline_pose_deg": {
            "pelvis_tilt": 0.0,
            "lumbar_extension": 0.0,
            "hip_flexion_r": 0.0,
            "hip_adduction_r": 0.0,
            "hip_rotation_r": 0.0,
            "knee_angle_r": 5.0,
            "ankle_angle_r": 0.0,
            "subtalar_angle_r": 0.0,
        },
        "optimizer_bounds_deg": {
            "pelvis_tilt": [-15.0, 15.0],
            "lumbar_extension": [-15.0, 15.0],
            "hip_flexion_r": [-20.0, 50.0],
            "hip_adduction_r": [-15.0, 10.0],
            "hip_rotation_r": [-20.0, 20.0],
            "knee_angle_r": [0.0, 35.0],
            "ankle_angle_r": [-20.0, 15.0],
            "subtalar_angle_r": [-10.0, 10.0],
        },
    }

    model = osim.Model(str(OSIM_PATH.resolve()))

    return LoadedModel(
        model_id=spec["model_id"],
        spec=spec,
        model=model,
    )
