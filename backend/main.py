from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional

import opensim as osim

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "models" / "lower_limb.osim"


class AnalyzeRequest(BaseModel):
    # coordinate_name
    pose: Dict[str, float]
    selected_muscles: List[str]
    tightness: Optional[Dict[str, float]] = None  # muscle_name


@app.get("/health")
def health():
    return {"ok": True, "opensim": osim.GetVersionAndDate()}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    if not MODEL_PATH.exists():
        return {"error": f"Model not found at {MODEL_PATH}. Put a .osim file there."}

    # Load model fresh per request
    model = osim.Model(str(MODEL_PATH))

    if req.tightness:
        muscles = model.getMuscles()
        for mname, t in req.tightness.items():
            if not muscles.contains(mname):
                continue
            m = muscles.get(mname)

            base = m.get_tendon_slack_length()
            m.set_tendon_slack_length(base * (1.0 - 0.05 * float(t)))

    state = model.initSystem()

    # Set pose coordinates
    coords = model.getCoordinateSet()
    for cname, val in req.pose.items():
        if coords.contains(cname):
            coords.get(cname).setValue(state, float(val))

    model.realizePosition(state)
    model.equilibrateMuscles(state)
    model.realizeDynamics(state)

    moment_arm_coords = [
        c
        for c in ["ankle_angle_r", "subtalar_angle_r", "knee_angle_r"]
        if coords.contains(c)
    ]

    # Collect metrics
    muscles = model.getMuscles()
    out = {}
    for mname in req.selected_muscles:
        if not muscles.contains(mname):
            out[mname] = {"error": "muscle not found in model"}
            continue

        m = muscles.get(mname)
        metrics = {
            "length_mtu": m.getLength(state),
            "passive_fiber_force": m.getPassiveFiberForce(state),
            "moment_arms": {},
        }

        gp = m.getGeometryPath()
        for cname in moment_arm_coords:
            coord = coords.get(cname)
            metrics["moment_arms"][cname] = gp.computeMomentArm(state, coord)

        out[mname] = metrics

    return {
        "model_path": str(MODEL_PATH),
        "pose_applied": req.pose,
        "moment_arm_coords": moment_arm_coords,
        "muscles": out,
    }
