from __future__ import annotations

import argparse
import contextlib
import io
import importlib
import json
import math
import os
import sys
import tempfile
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from collections import OrderedDict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlparse
import xml.etree.ElementTree as ET


REPO_ROOT = Path(__file__).resolve().parent
ACTIVE_MODEL_PATH = REPO_ROOT / "models" / "RajagopalLaiUhlrich2023.osim"
ACTIVE_MODEL_RELATIVE_PATH = "models/RajagopalLaiUhlrich2023.osim"
ACTIVE_MODEL_GEOMETRY_PATH = REPO_ROOT / "models" / "FullBodyModel-4.0" / "Geometry"
ACTIVE_MODEL_GEOMETRY_RELATIVE_PATH = "models/FullBodyModel-4.0/Geometry"
VIEWER_BACKEND_PATH = REPO_ROOT / "tools" / "opensim-viewer-backend"
VIEWER_MODEL_ROUTE = "/api/viewer/model.gltf"
LOWER_BODY_ANALYSIS_CUTOFF = "below the torso"
GLOBAL_OBJECTIVE_WEIGHT = 0.10
SELECTED_WORST_COMPARTMENT_WEIGHT = 0.15
SELECTED_OVERLENGTH_WEIGHT = 0.10
SELECTED_OVERLENGTH_THRESHOLD = 1.0
STANDING_SUPPORT_DISTANCE_WEIGHT = 25.0
STANDING_PENETRATION_WEIGHT = 200.0
STANDING_HEEL_LIFT_WEIGHT = 40.0
STANDING_SUPPORT_MARGIN_M = 0.02
STANDING_GROUND_CLEARANCE_TOLERANCE_M = 0.01
STANDING_TOE_CONTACT_TOLERANCE_M = 0.03
STANDING_HEEL_LIFT_TOLERANCE_M = 0.03
ACTIVE_OPTIMIZER_PHASE = "ACTIVE OPTIMIZER PHASE 2"
ACTIVE_OPTIMIZER_DEBUG = (
    "ACTIVE OPTIMIZER PHASE 2: pelvis_tilt, pelvis_list, pelvis_rotation, "
    "lumbar_extension, hip_flexion_l, knee_angle_l, ankle_angle_l, "
    "hip_flexion_r, knee_angle_r, ankle_angle_r"
)
EVALUATION_ORDER = [
    "load model",
    "apply tightness settings",
    "initialize state",
    "apply pose",
    "equilibrate muscles",
    "realize required stages",
    "read muscle outputs",
    "aggregate group outputs",
    "read segment transforms",
]
STANDING_FOOT_LANDMARK_BODIES = {
    "left_heel": "calcn_l",
    "left_toe": "toes_l",
    "right_heel": "calcn_r",
    "right_toe": "toes_r",
}

ACTIVE_OPTIMIZER_COORDINATES = (
    "pelvis_tilt",
    "pelvis_list",
    "pelvis_rotation",
    "lumbar_extension",
    "hip_flexion_l",
    "knee_angle_l",
    "ankle_angle_l",
    "hip_flexion_r",
    "knee_angle_r",
    "ankle_angle_r",
)
FUTURE_PHASE_3_COORDINATES = ("hip_rotation_l", "hip_rotation_r")
LATER_ONLY_COORDINATES = ("subtalar_angle_l", "subtalar_angle_r")

REGULARIZATION_WEIGHTS = {
    "pelvis_tilt": 2.0,
    "pelvis_list": 2.0,
    "pelvis_rotation": 2.0,
    "lumbar_extension": 1.5,
    "hip_flexion_l": 1.0,
    "knee_angle_l": 0.5,
    "ankle_angle_l": 0.5,
    "hip_flexion_r": 1.0,
    "knee_angle_r": 0.5,
    "ankle_angle_r": 0.5,
}

# Standing-like inner bounds used for the active bilateral, pelvis-aware search.
INNER_OPTIMIZATION_BOUNDS_ACTIVE = {
    "pelvis_tilt": (-math.radians(20.0), math.radians(20.0)),
    "pelvis_list": (-math.radians(12.0), math.radians(12.0)),
    "pelvis_rotation": (-math.radians(12.0), math.radians(12.0)),
    "lumbar_extension": (-math.radians(15.0), math.radians(15.0)),
    "hip_flexion_l": (-math.radians(15.0), math.radians(45.0)),
    "knee_angle_l": (0.0, math.radians(45.0)),
    "ankle_angle_l": (-math.radians(15.0), math.radians(20.0)),
    "hip_flexion_r": (-math.radians(15.0), math.radians(45.0)),
    "knee_angle_r": (0.0, math.radians(45.0)),
    "ankle_angle_r": (-math.radians(15.0), math.radians(20.0)),
}

LOWER_BODY_GROUP_TEMPLATES: "OrderedDict[str, tuple[str, ...]]" = OrderedDict(
    [
        (
            "adductors",
            (
                "addbrev",
                "addlong",
                "addmagDist",
                "addmagIsch",
                "addmagMid",
                "addmagProx",
                "grac",
            ),
        ),
        ("hamstrings", ("bflh", "bfsh", "semimem", "semiten")),
        ("dorsiflexors", ("tibant", "edl", "ehl")),
        ("toe_flexors", ("fdl", "fhl")),
        ("plantarflexors", ("soleus", "gaslat", "gasmed")),
        ("gluteus_maximus", ("glmax1", "glmax2", "glmax3")),
        ("gluteus_medius", ("glmed1", "glmed2", "glmed3")),
        ("gluteus_minimus", ("glmin1", "glmin2", "glmin3")),
        ("hip_flexors", ("iliacus", "psoas", "recfem", "sart", "tfl")),
        ("peroneals", ("perbrev", "perlong")),
        ("deep_rotators", ("piri",)),
        ("posterior_tibialis", ("tibpost",)),
        ("quadriceps", ("vasint", "vaslat", "vasmed")),
    ]
)


@dataclass(frozen=True)
class CoordinateInfo:
    name: str
    default_value: float
    range_min: float
    range_max: float


@dataclass(frozen=True)
class MuscleInfo:
    name: str
    optimal_fiber_length: float
    max_isometric_force: float
    tendon_slack_length: float


@dataclass(frozen=True)
class BodyInfo:
    name: str


@dataclass(frozen=True)
class ForceInfo:
    name: str
    element_type: str


@dataclass(frozen=True)
class ModelManifest:
    model_name: str
    coordinates: dict[str, CoordinateInfo]
    muscles: dict[str, MuscleInfo]
    bodies: dict[str, BodyInfo]
    forces: dict[str, ForceInfo]


@dataclass(frozen=True)
class TightnessDirective:
    targets: list[str]
    severity: float
    max_shortening_fraction: float

    @staticmethod
    def from_mapping(data: Mapping[str, Any]) -> "TightnessDirective":
        targets = data.get("targets") or data.get("muscles") or []
        if not isinstance(targets, list) or not all(isinstance(item, str) for item in targets):
            raise ValueError("Each tightness directive must provide a string list in `targets` or `muscles`.")
        if "max_shortening_fraction" not in data:
            raise ValueError("Each tightness directive must provide `max_shortening_fraction`.")
        severity = float(data.get("severity", 0.0))
        max_shortening_fraction = float(data["max_shortening_fraction"])
        return TightnessDirective(
            targets=targets,
            severity=severity,
            max_shortening_fraction=max_shortening_fraction,
        )


@dataclass(frozen=True)
class EvaluationRequest:
    pose: dict[str, float] = field(default_factory=dict)
    tightness: list[TightnessDirective] = field(default_factory=list)
    selected_groups: list[str] = field(default_factory=list)
    include_upper_body_debug_metrics: bool = False

    @staticmethod
    def from_mapping(data: Mapping[str, Any]) -> "EvaluationRequest":
        pose = {str(key): float(value) for key, value in dict(data.get("pose", {})).items()}
        tightness = [TightnessDirective.from_mapping(item) for item in data.get("tightness", [])]
        selected_groups = [str(item) for item in data.get("selected_groups", [])]
        return EvaluationRequest(
            pose=pose,
            tightness=tightness,
            selected_groups=selected_groups,
            include_upper_body_debug_metrics=bool(data.get("include_upper_body_debug_metrics", False)),
        )


@dataclass(frozen=True)
class OptimizationRequest:
    tightness: list[TightnessDirective] = field(default_factory=list)
    selected_groups: list[str] = field(default_factory=list)
    seed_pose: dict[str, float] = field(default_factory=dict)
    include_upper_body_debug_metrics: bool = False
    max_iterations: int = 32
    initial_step_rad: float = math.radians(5.0)
    tolerance_rad: float = math.radians(0.25)

    @staticmethod
    def from_mapping(data: Mapping[str, Any]) -> "OptimizationRequest":
        tightness = [TightnessDirective.from_mapping(item) for item in data.get("tightness", [])]
        selected_groups = [str(item) for item in data.get("selected_groups", [])]
        seed_pose = {str(key): float(value) for key, value in dict(data.get("seed_pose", {})).items()}
        return OptimizationRequest(
            tightness=tightness,
            selected_groups=selected_groups,
            seed_pose=seed_pose,
            include_upper_body_debug_metrics=bool(data.get("include_upper_body_debug_metrics", False)),
            max_iterations=int(data.get("max_iterations", 32)),
            initial_step_rad=float(data.get("initial_step_rad", math.radians(5.0))),
            tolerance_rad=float(data.get("tolerance_rad", math.radians(0.25))),
        )


@dataclass(frozen=True)
class MuscleMetric:
    passive_fiber_force: float
    passive_force_multiplier: float
    normalized_fiber_length: float
    muscle_stiffness: float
    max_isometric_force: float
    normalized_passive_force: float


@dataclass(frozen=True)
class GroupMetric:
    weighted_normalized_passive_force: float
    worst_compartment_normalized_passive_force: float
    mean_normalized_fiber_length: float


@dataclass(frozen=True)
class StandingMetric:
    gravity_vector_m_s2: list[float]
    gravity_magnitude_m_s2: float
    center_of_mass_m: list[float]
    projected_center_of_mass_m: list[float]
    foot_landmarks_m: dict[str, list[float]]
    projected_foot_landmarks_m: dict[str, list[float]]
    support_polygon_m: list[list[float]]
    support_distance_outside_m: float
    heel_penetration_m: float
    toe_penetration_m: float
    heel_lift_m: float


class OpenSimRuntimeUnavailable(RuntimeError):
    pass


class ViewerAssetUnavailable(RuntimeError):
    pass


@contextlib.contextmanager
def suppress_native_output():
    stdout_fd = os.dup(1)
    stderr_fd = os.dup(2)
    devnull_fd = os.open(os.devnull, os.O_WRONLY)
    try:
        os.dup2(devnull_fd, 1)
        os.dup2(devnull_fd, 2)
        yield
    finally:
        os.dup2(stdout_fd, 1)
        os.dup2(stderr_fd, 2)
        os.close(devnull_fd)
        os.close(stdout_fd)
        os.close(stderr_fd)


def load_model_manifest(model_path: Path = ACTIVE_MODEL_PATH) -> ModelManifest:
    if not model_path.exists():
        raise FileNotFoundError(f"Active model file not found: {model_path}")

    root = ET.parse(model_path).getroot()
    model_element = root.find("./Model")
    if model_element is None:
        raise ValueError(f"OpenSim model element missing from {model_path}")

    coordinates: dict[str, CoordinateInfo] = {}
    for element in root.findall(".//Coordinate"):
        coordinate = CoordinateInfo(
            name=element.attrib["name"],
            default_value=float((element.findtext("default_value") or "0").strip()),
            range_min=float((element.findtext("range") or "0 0").split()[0]),
            range_max=float((element.findtext("range") or "0 0").split()[1]),
        )
        coordinates[coordinate.name] = coordinate

    muscles: dict[str, MuscleInfo] = {}
    for element in root.findall(".//ForceSet/objects/Millard2012EquilibriumMuscle"):
        muscle = MuscleInfo(
            name=element.attrib["name"],
            optimal_fiber_length=float((element.findtext("optimal_fiber_length") or "0").strip()),
            max_isometric_force=float((element.findtext("max_isometric_force") or "0").strip()),
            tendon_slack_length=float((element.findtext("tendon_slack_length") or "0").strip()),
        )
        muscles[muscle.name] = muscle

    bodies: dict[str, BodyInfo] = {}
    for element in root.findall(".//BodySet/objects/Body"):
        if element.attrib["name"] == "ground":
            continue
        body = BodyInfo(name=element.attrib["name"])
        bodies[body.name] = body

    forces: dict[str, ForceInfo] = {}
    for element in root.findall(".//ForceSet/objects/*"):
        force = ForceInfo(name=element.attrib["name"], element_type=element.tag)
        forces[force.name] = force

    return ModelManifest(
        model_name=model_element.attrib["name"],
        coordinates=coordinates,
        muscles=muscles,
        bodies=bodies,
        forces=forces,
    )


def build_lower_body_muscle_groups() -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for side in ("r", "l"):
        for group_name, prefixes in LOWER_BODY_GROUP_TEMPLATES.items():
            groups[f"{group_name}_{side}"] = [f"{prefix}_{side}" for prefix in prefixes]
    return groups


def lower_body_muscle_names(groups: Mapping[str, Sequence[str]] | None = None) -> list[str]:
    resolved_groups = groups or build_lower_body_muscle_groups()
    names = sorted({muscle for members in resolved_groups.values() for muscle in members})
    return names


def _humanize_identifier(identifier: str) -> str:
    parts = identifier.replace(".", " ").replace("_", " ").split()
    return " ".join(part.capitalize() for part in parts)


def build_lower_body_muscle_catalog(
    manifest: ModelManifest,
    groups: Mapping[str, Sequence[str]] | None = None,
) -> list[dict[str, Any]]:
    resolved_groups = groups or build_lower_body_muscle_groups()
    exact_muscles = lower_body_muscle_names(resolved_groups)
    group_lookup: dict[str, list[str]] = {}
    for group_name, members in resolved_groups.items():
        for muscle_name in members:
            group_lookup.setdefault(muscle_name, []).append(group_name)

    base_names = sorted({muscle_name[:-2] for muscle_name in exact_muscles})
    catalog: list[dict[str, Any]] = []
    for base_name in base_names:
        left_name = f"{base_name}_l"
        right_name = f"{base_name}_r"
        exact_targets = [name for name in (left_name, right_name) if name in manifest.muscles]
        catalog.append(
            {
                "base_name": base_name,
                "label": _humanize_identifier(base_name),
                "sides": {
                    "left": left_name if left_name in manifest.muscles else None,
                    "right": right_name if right_name in manifest.muscles else None,
                },
                "groups": sorted(
                    {
                        group_name
                        for exact_name in exact_targets
                        for group_name in group_lookup.get(exact_name, [])
                    }
                ),
            }
        )
    return catalog


def outer_hard_bounds_from_manifest(manifest: ModelManifest) -> dict[str, tuple[float, float]]:
    return {
        name: (coordinate.range_min, coordinate.range_max)
        for name, coordinate in manifest.coordinates.items()
    }


def validate_project_configuration(manifest: ModelManifest) -> dict[str, Any]:
    groups = build_lower_body_muscle_groups()
    covered = lower_body_muscle_names(groups)
    lower_body_manifest_muscles = sorted(name for name in manifest.muscles if name.endswith(("_r", "_l")))

    group_only = sorted(set(covered) - set(lower_body_manifest_muscles))
    manifest_only = sorted(set(lower_body_manifest_muscles) - set(covered))

    for coordinate_name, (inner_min, inner_max) in INNER_OPTIMIZATION_BOUNDS_ACTIVE.items():
        coordinate = manifest.coordinates[coordinate_name]
        if inner_min < coordinate.range_min or inner_max > coordinate.range_max:
            raise ValueError(
                f"Inner optimization bounds for {coordinate_name} exceed model safety bounds: "
                f"{(inner_min, inner_max)} vs {(coordinate.range_min, coordinate.range_max)}"
            )

    active_coordinate_missing = [
        name for name in ACTIVE_OPTIMIZER_COORDINATES if name not in manifest.coordinates
    ]
    if active_coordinate_missing:
        raise ValueError(
            f"Active optimizer coordinates missing from model: {active_coordinate_missing}"
        )

    return {
        "model_path": ACTIVE_MODEL_RELATIVE_PATH,
        "model_name": manifest.model_name,
        "coordinate_count": len(manifest.coordinates),
        "body_count": len(manifest.bodies),
        "muscle_count": len(manifest.muscles),
        "force_count": len(manifest.forces),
        "lower_body_group_count": len(groups),
        "lower_body_muscle_count": len(covered),
        "group_only_muscles": group_only,
        "manifest_only_muscles": manifest_only,
        "active_optimizer_phase": ACTIVE_OPTIMIZER_PHASE,
        "active_optimizer_debug": ACTIVE_OPTIMIZER_DEBUG,
    }


def get_opensim_module():
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            import pyopensim as opensim
    except ModuleNotFoundError as exc:
        raise OpenSimRuntimeUnavailable(
            "pyopensim is not installed. Run `uv sync --cache-dir /tmp/uv-cache` first."
        ) from exc

    if not hasattr(opensim, "Model"):
        raise OpenSimRuntimeUnavailable(
            "pyopensim is installed but OpenSim native classes are unavailable. "
            "The current environment is missing a shared library dependency such as libopenblas.so.0."
        )

    logger = getattr(opensim, "Logger", None)
    if logger is not None and hasattr(logger, "setLevelString"):
        logger.setLevelString("error")
    return opensim


def runtime_status() -> dict[str, Any]:
    try:
        opensim = get_opensim_module()
    except OpenSimRuntimeUnavailable as exc:
        return {"available": False, "error": str(exc)}

    return {
        "available": True,
        "module_version": getattr(opensim, "__version__", "unknown"),
        "opensim_version": getattr(opensim, "__opensim_version__", "unknown"),
    }


def _prepare_opensim_compat_module(opensim: Any) -> Any:
    alias_sources = (
        getattr(opensim, "simbody", None),
        getattr(opensim, "common", None),
        getattr(opensim, "simulation", None),
        getattr(opensim, "actuators", None),
        getattr(opensim, "tools", None),
    )
    required_aliases = (
        "ArrayDecorativeGeometry",
        "CoordinateAxis",
        "DecorativeGeometry",
        "DecorativeGeometryImplementation",
        "Mat33",
        "ModelVisualizer",
        "PolygonalMesh",
        "Quaternion",
        "StatesTrajectory",
        "TimeSeriesTable",
        "TimeSeriesTableVec3",
        "UnitVec3",
    )
    for alias in required_aliases:
        if hasattr(opensim, alias):
            continue
        for source in alias_sources:
            if source is not None and hasattr(source, alias):
                setattr(opensim, alias, getattr(source, alias))
                break
    return opensim


_viewer_asset_cache: dict[str, Any] = {}
_viewer_asset_lock = threading.Lock()


def _viewer_body_node_map(manifest: ModelManifest) -> dict[str, str]:
    return {body_name: f"Body:/bodyset/{body_name}" for body_name in manifest.bodies}


def viewer_runtime_status() -> dict[str, Any]:
    if not VIEWER_BACKEND_PATH.exists():
        return {
            "available": False,
            "error": f"Viewer backend not found at {VIEWER_BACKEND_PATH}.",
        }

    try:
        import pygltflib  # noqa: F401
    except ModuleNotFoundError as exc:
        return {
            "available": False,
            "error": "pygltflib is not installed. Run `uv sync --cache-dir /tmp/uv-cache` first.",
        }

    try:
        status = runtime_status()
        if not status["available"]:
            return {
                "available": False,
                "error": status["error"],
            }
    except Exception as exc:  # pragma: no cover - defensive status path
        return {
            "available": False,
            "error": str(exc),
        }

    return {
        "available": True,
        "model_path": ACTIVE_MODEL_RELATIVE_PATH,
        "geometry_path": ACTIVE_MODEL_GEOMETRY_RELATIVE_PATH,
    }


def _load_viewer_backend_converter() -> tuple[Any, Any]:
    status = viewer_runtime_status()
    if not status["available"]:
        raise ViewerAssetUnavailable(status["error"])

    compat_opensim = _prepare_opensim_compat_module(get_opensim_module())
    sys.modules["opensim"] = compat_opensim
    viewer_backend_import_path = str(VIEWER_BACKEND_PATH)
    if viewer_backend_import_path not in sys.path:
        sys.path.insert(0, viewer_backend_import_path)

    try:
        options_module = importlib.import_module("osimViewerOptions")
        converters_module = importlib.import_module("osimConverters.convertOsim2Gltf")
    except ModuleNotFoundError as exc:
        raise ViewerAssetUnavailable(str(exc)) from exc

    return converters_module.convertOsim2Gltf, options_module


def _generate_viewer_gltf_bytes() -> bytes:
    convert_osim_to_gltf, viewer_options_module = _load_viewer_backend_converter()
    options = viewer_options_module.osimViewerOptions()
    options.setShowMuscles(False)
    with suppress_native_output():
        gltf = convert_osim_to_gltf(
            str(ACTIVE_MODEL_PATH),
            str(ACTIVE_MODEL_GEOMETRY_PATH),
            [],
            options,
        )

    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "viewer-model.gltf"
        gltf.save(str(output_path))
        return output_path.read_bytes()


def get_viewer_asset(manifest: ModelManifest | None = None) -> dict[str, Any]:
    resolved_manifest = manifest or load_model_manifest()
    with _viewer_asset_lock:
        cached_bytes = _viewer_asset_cache.get("gltf_bytes")
        if cached_bytes is None:
            cached_bytes = _generate_viewer_gltf_bytes()
            _viewer_asset_cache["gltf_bytes"] = cached_bytes

    return {
        "bytes": cached_bytes,
        "content_type": "model/gltf+json; charset=utf-8",
        "model_url": VIEWER_MODEL_ROUTE,
        "body_nodes": _viewer_body_node_map(resolved_manifest),
    }


def _get_set_item_by_name(component_set: Any, name: str) -> Any:
    index = component_set.getIndex(name)
    if index < 0:
        raise KeyError(f"Component `{name}` not present in the active model.")
    return component_set.get(index)


def _vec3_to_list(vec3: Any) -> list[float]:
    return [float(vec3.get(index)) for index in range(3)]


def _rotation_to_matrix(rotation: Any) -> list[list[float]]:
    return [[float(rotation.get(row, column)) for column in range(3)] for row in range(3)]


def _dot3(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(float(left) * float(right) for left, right in zip(a, b))


def _cross3(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [
        float(a[1]) * float(b[2]) - float(a[2]) * float(b[1]),
        float(a[2]) * float(b[0]) - float(a[0]) * float(b[2]),
        float(a[0]) * float(b[1]) - float(a[1]) * float(b[0]),
    ]


def _scale3(vec: Sequence[float], scalar: float) -> list[float]:
    return [float(component) * scalar for component in vec]


def _sub3(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [float(left) - float(right) for left, right in zip(a, b)]


def _norm3(vec: Sequence[float]) -> float:
    return math.sqrt(_dot3(vec, vec))


def _normalize3(vec: Sequence[float]) -> list[float]:
    magnitude = _norm3(vec)
    if magnitude <= 1e-12:
        raise ValueError("Cannot normalize a near-zero vector.")
    return [float(component) / magnitude for component in vec]


def _project_point_to_plane(point: Sequence[float], normal: Sequence[float]) -> tuple[list[float], float]:
    signed_height = _dot3(point, normal)
    return _sub3(point, _scale3(normal, signed_height)), signed_height


def _ground_plane_basis(up_vector: Sequence[float]) -> tuple[list[float], list[float]]:
    reference = [1.0, 0.0, 0.0] if abs(float(up_vector[0])) < 0.9 else [0.0, 0.0, 1.0]
    tangent_u = _normalize3(_cross3(reference, up_vector))
    tangent_v = _normalize3(_cross3(up_vector, tangent_u))
    return tangent_u, tangent_v


def _to_plane_coordinates(
    point: Sequence[float],
    tangent_u: Sequence[float],
    tangent_v: Sequence[float],
) -> tuple[float, float]:
    return (_dot3(point, tangent_u), _dot3(point, tangent_v))


def _point_key_2d(point: Sequence[float]) -> tuple[float, float]:
    return (round(float(point[0]), 12), round(float(point[1]), 12))


def _cross2(origin: Sequence[float], a: Sequence[float], b: Sequence[float]) -> float:
    return (float(a[0]) - float(origin[0])) * (float(b[1]) - float(origin[1])) - (
        float(a[1]) - float(origin[1])
    ) * (float(b[0]) - float(origin[0]))


def _convex_hull_2d(points: Sequence[Sequence[float]]) -> list[tuple[float, float]]:
    unique_points = sorted({_point_key_2d(point) for point in points})
    if len(unique_points) <= 1:
        return unique_points

    lower: list[tuple[float, float]] = []
    for point in unique_points:
        while len(lower) >= 2 and _cross2(lower[-2], lower[-1], point) <= 0.0:
            lower.pop()
        lower.append(point)

    upper: list[tuple[float, float]] = []
    for point in reversed(unique_points):
        while len(upper) >= 2 and _cross2(upper[-2], upper[-1], point) <= 0.0:
            upper.pop()
        upper.append(point)

    return lower[:-1] + upper[:-1]


def _distance_point_to_segment_2d(
    point: Sequence[float],
    start: Sequence[float],
    end: Sequence[float],
) -> float:
    segment = (float(end[0]) - float(start[0]), float(end[1]) - float(start[1]))
    segment_length_sq = segment[0] ** 2 + segment[1] ** 2
    if segment_length_sq <= 1e-12:
        return math.dist(point, start)
    projection = (
        ((float(point[0]) - float(start[0])) * segment[0])
        + ((float(point[1]) - float(start[1])) * segment[1])
    ) / segment_length_sq
    clamped = min(max(projection, 0.0), 1.0)
    closest = (
        float(start[0]) + clamped * segment[0],
        float(start[1]) + clamped * segment[1],
    )
    return math.dist(point, closest)


def _point_inside_convex_polygon_2d(point: Sequence[float], polygon: Sequence[Sequence[float]]) -> bool:
    if len(polygon) < 3:
        return False
    sign = 0
    for index, start in enumerate(polygon):
        end = polygon[(index + 1) % len(polygon)]
        cross = _cross2(start, end, point)
        if abs(cross) <= 1e-12:
            continue
        current_sign = 1 if cross > 0.0 else -1
        if sign == 0:
            sign = current_sign
            continue
        if current_sign != sign:
            return False
    return True


def _distance_outside_support_polygon_2d(
    point: Sequence[float],
    polygon: Sequence[Sequence[float]],
) -> float:
    if len(polygon) < 3 or _point_inside_convex_polygon_2d(point, polygon):
        return 0.0
    return min(
        _distance_point_to_segment_2d(point, polygon[index], polygon[(index + 1) % len(polygon)])
        for index in range(len(polygon))
    )


def _resolve_pose_coordinate_names(manifest: ModelManifest, pose: Mapping[str, float]) -> dict[str, float]:
    resolved = {}
    hard_bounds = outer_hard_bounds_from_manifest(manifest)
    for coordinate_name, value in pose.items():
        if coordinate_name not in manifest.coordinates:
            raise KeyError(f"Unknown coordinate `{coordinate_name}` in pose.")
        lower, upper = hard_bounds[coordinate_name]
        if value < lower or value > upper:
            raise ValueError(
                f"Pose value for `{coordinate_name}`={value} exceeds hard safety bounds {(lower, upper)}."
            )
        resolved[coordinate_name] = float(value)
    return resolved


def _normalize_severity(value: float) -> float:
    if value < 0.0 or value > 1.0:
        raise ValueError(f"Tightness severity must stay on [0, 1], received {value}.")
    return value


def _resolve_selected_groups(
    selected_groups: Sequence[str],
    available_groups: Mapping[str, Sequence[str]],
) -> list[str]:
    if not selected_groups:
        return list(available_groups.keys())

    missing = [group for group in selected_groups if group not in available_groups]
    if missing:
        raise KeyError(f"Unknown muscle group(s): {missing}")
    return list(selected_groups)


def compute_objective_terms(
    group_metrics: Mapping[str, GroupMetric],
    pose: Mapping[str, float],
    coordinate_defaults: Mapping[str, float],
    selected_groups: Sequence[str],
    standing_metrics: StandingMetric | None = None,
) -> dict[str, float]:
    selected_passive_term = sum(
        group_metrics[group].weighted_normalized_passive_force**2 for group in selected_groups
    )
    selected_worst_compartment_term = sum(
        group_metrics[group].worst_compartment_normalized_passive_force**2 for group in selected_groups
    )
    selected_overlength_term = sum(
        max(0.0, group_metrics[group].mean_normalized_fiber_length - SELECTED_OVERLENGTH_THRESHOLD) ** 2
        for group in selected_groups
    )
    selected_term = (
        selected_passive_term
        + SELECTED_WORST_COMPARTMENT_WEIGHT * selected_worst_compartment_term
        + SELECTED_OVERLENGTH_WEIGHT * selected_overlength_term
    )
    global_term = sum(metric.weighted_normalized_passive_force ** 2 for metric in group_metrics.values())
    regularization_term = 0.0
    for coordinate_name, weight in REGULARIZATION_WEIGHTS.items():
        coordinate_value = float(pose.get(coordinate_name, coordinate_defaults[coordinate_name]))
        delta = coordinate_value - coordinate_defaults[coordinate_name]
        regularization_term += weight * (delta**2)

    standing_support_term = 0.0
    standing_penetration_term = 0.0
    standing_heel_lift_term = 0.0
    if standing_metrics is not None and standing_metrics.gravity_magnitude_m_s2 > 0.0:
        support_distance = max(
            0.0,
            standing_metrics.support_distance_outside_m - STANDING_SUPPORT_MARGIN_M,
        )
        standing_support_term = STANDING_SUPPORT_DISTANCE_WEIGHT * (support_distance**2)
        standing_penetration_term = STANDING_PENETRATION_WEIGHT * (
            standing_metrics.heel_penetration_m**2 + standing_metrics.toe_penetration_m**2
        )
        standing_heel_lift_term = STANDING_HEEL_LIFT_WEIGHT * (standing_metrics.heel_lift_m**2)

    standing_term = standing_support_term + standing_penetration_term + standing_heel_lift_term
    total = selected_term + GLOBAL_OBJECTIVE_WEIGHT * global_term + regularization_term + standing_term
    return {
        "selected_passive_term": selected_passive_term,
        "selected_worst_compartment_term": selected_worst_compartment_term,
        "selected_overlength_term": selected_overlength_term,
        "selected_term": selected_term,
        "global_term": global_term,
        "regularization_term": regularization_term,
        "standing_support_term": standing_support_term,
        "standing_penetration_term": standing_penetration_term,
        "standing_heel_lift_term": standing_heel_lift_term,
        "standing_term": standing_term,
        "total": total,
    }


class OpenSimEvaluator:
    def __init__(self, manifest: ModelManifest | None = None) -> None:
        self.manifest = manifest or load_model_manifest()
        self.lower_body_muscle_groups = build_lower_body_muscle_groups()
        self.lower_body_muscles = lower_body_muscle_names(self.lower_body_muscle_groups)
        self.coordinate_defaults = {
            name: coordinate.default_value for name, coordinate in self.manifest.coordinates.items()
        }

    def _resolve_tightness_targets(self, targets: Sequence[str]) -> list[str]:
        resolved: list[str] = []
        for target in targets:
            if target in self.lower_body_muscle_groups:
                resolved.extend(self.lower_body_muscle_groups[target])
                continue
            if target in self.manifest.muscles:
                resolved.append(target)
                continue
            raise KeyError(f"Unknown tightness target `{target}`. Use a lower-body group or a muscle name.")
        return sorted(set(resolved))

    def _build_runtime_model(self) -> tuple[Any, Any]:
        opensim = get_opensim_module()
        with suppress_native_output():
            model = opensim.Model(str(ACTIVE_MODEL_PATH))
        return opensim, model

    def _apply_tightness_settings(self, model: Any, directives: Sequence[TightnessDirective]) -> dict[str, dict[str, float]]:
        if not directives:
            return {}

        muscle_set = model.updMuscles()
        changes: dict[str, dict[str, float]] = {}
        for directive in directives:
            severity = _normalize_severity(directive.severity)
            if directive.max_shortening_fraction < 0.0 or directive.max_shortening_fraction > 1.0:
                raise ValueError(
                    "Each tightness directive must keep `max_shortening_fraction` on [0, 1]."
                )
            for muscle_name in self._resolve_tightness_targets(directive.targets):
                baseline = self.manifest.muscles[muscle_name]
                new_length = baseline.optimal_fiber_length * (
                    1.0 - severity * directive.max_shortening_fraction
                )
                muscle = _get_set_item_by_name(muscle_set, muscle_name)
                muscle.setOptimalFiberLength(new_length)
                changes[muscle_name] = {
                    "baseline_optimal_fiber_length": baseline.optimal_fiber_length,
                    "severity": severity,
                    "max_shortening_fraction": directive.max_shortening_fraction,
                    "new_optimal_fiber_length": new_length,
                }
        return changes

    def _apply_pose(self, model: Any, state: Any, pose: Mapping[str, float]) -> dict[str, float]:
        resolved_pose = _resolve_pose_coordinate_names(self.manifest, pose)
        coordinate_set = model.updCoordinateSet()
        for coordinate_name, value in resolved_pose.items():
            coordinate = _get_set_item_by_name(coordinate_set, coordinate_name)
            coordinate.setValue(state, value, False)
        return resolved_pose

    def _read_lower_body_muscle_outputs(self, model: Any, state: Any) -> dict[str, MuscleMetric]:
        muscle_metrics: dict[str, MuscleMetric] = {}
        muscle_set = model.getMuscles()
        for muscle_name in self.lower_body_muscles:
            muscle = _get_set_item_by_name(muscle_set, muscle_name)
            passive_fiber_force = float(muscle.getPassiveFiberForce(state))
            passive_force_multiplier = float(muscle.getPassiveForceMultiplier(state))
            normalized_fiber_length = float(muscle.getNormalizedFiberLength(state))
            muscle_stiffness = float(muscle.getFiberStiffness(state))
            max_isometric_force = float(muscle.getMaxIsometricForce())
            normalized_passive_force = max(0.0, passive_fiber_force) / max_isometric_force
            muscle_metrics[muscle_name] = MuscleMetric(
                passive_fiber_force=passive_fiber_force,
                passive_force_multiplier=passive_force_multiplier,
                normalized_fiber_length=normalized_fiber_length,
                muscle_stiffness=muscle_stiffness,
                max_isometric_force=max_isometric_force,
                normalized_passive_force=normalized_passive_force,
            )
        return muscle_metrics

    def _read_upper_body_debug_muscle_outputs(self, model: Any, state: Any) -> dict[str, MuscleMetric]:
        upper_body: dict[str, MuscleMetric] = {}
        muscle_set = model.getMuscles()
        for index in range(muscle_set.getSize()):
            muscle = muscle_set.get(index)
            muscle_name = muscle.getName()
            if muscle_name in self.lower_body_muscles:
                continue
            passive_fiber_force = float(muscle.getPassiveFiberForce(state))
            passive_force_multiplier = float(muscle.getPassiveForceMultiplier(state))
            normalized_fiber_length = float(muscle.getNormalizedFiberLength(state))
            muscle_stiffness = float(muscle.getFiberStiffness(state))
            max_isometric_force = float(muscle.getMaxIsometricForce())
            normalized_passive_force = max(0.0, passive_fiber_force) / max_isometric_force
            upper_body[muscle_name] = MuscleMetric(
                passive_fiber_force=passive_fiber_force,
                passive_force_multiplier=passive_force_multiplier,
                normalized_fiber_length=normalized_fiber_length,
                muscle_stiffness=muscle_stiffness,
                max_isometric_force=max_isometric_force,
                normalized_passive_force=normalized_passive_force,
            )
        return upper_body

    def _aggregate_group_outputs(
        self,
        muscle_metrics: Mapping[str, MuscleMetric],
    ) -> dict[str, GroupMetric]:
        group_metrics: dict[str, GroupMetric] = {}
        for group_name, muscles in self.lower_body_muscle_groups.items():
            metrics = [muscle_metrics[muscle_name] for muscle_name in muscles]
            total_force_capacity = sum(metric.max_isometric_force for metric in metrics)
            weighted_normalized_passive_force = (
                sum(metric.normalized_passive_force * metric.max_isometric_force for metric in metrics)
                / total_force_capacity
            )
            group_metrics[group_name] = GroupMetric(
                weighted_normalized_passive_force=weighted_normalized_passive_force,
                worst_compartment_normalized_passive_force=max(
                    metric.normalized_passive_force for metric in metrics
                ),
                mean_normalized_fiber_length=sum(
                    metric.normalized_fiber_length for metric in metrics
                )
                / len(metrics),
            )
        return group_metrics

    def _read_segment_transforms(self, model: Any, state: Any) -> dict[str, dict[str, list[float] | list[list[float]]]]:
        transforms: dict[str, dict[str, list[float] | list[list[float]]]] = {}
        body_set = model.getBodySet()
        for body_name in self.manifest.bodies:
            body = _get_set_item_by_name(body_set, body_name)
            transform = body.getTransformInGround(state)
            transforms[body_name] = {
                "translation_m": _vec3_to_list(transform.p()),
                "rotation_matrix_3x3": _rotation_to_matrix(transform.R()),
            }
        return transforms

    def _evaluate_standing_metrics(
        self,
        model: Any,
        state: Any,
        transforms: Mapping[str, Mapping[str, list[float] | list[list[float]]]],
    ) -> StandingMetric:
        gravity_vector = _vec3_to_list(model.getGravity())
        gravity_magnitude = _norm3(gravity_vector)
        if gravity_magnitude <= 1e-12:
            zero_landmarks = {
                landmark_name: [0.0, 0.0, 0.0] for landmark_name in STANDING_FOOT_LANDMARK_BODIES
            }
            return StandingMetric(
                gravity_vector_m_s2=gravity_vector,
                gravity_magnitude_m_s2=0.0,
                center_of_mass_m=[0.0, 0.0, 0.0],
                projected_center_of_mass_m=[0.0, 0.0, 0.0],
                foot_landmarks_m=zero_landmarks,
                projected_foot_landmarks_m=zero_landmarks,
                support_polygon_m=[],
                support_distance_outside_m=0.0,
                heel_penetration_m=0.0,
                toe_penetration_m=0.0,
                heel_lift_m=0.0,
            )

        up_vector = _normalize3([-component for component in gravity_vector])
        tangent_u, tangent_v = _ground_plane_basis(up_vector)
        center_of_mass = _vec3_to_list(model.calcMassCenterPosition(state))
        projected_center_of_mass, _ = _project_point_to_plane(center_of_mass, up_vector)
        center_of_mass_plane = _to_plane_coordinates(projected_center_of_mass, tangent_u, tangent_v)

        foot_landmarks: dict[str, list[float]] = {}
        projected_foot_landmarks: dict[str, list[float]] = {}
        support_points_2d: list[tuple[float, float]] = []
        support_point_lookup: dict[tuple[float, float], list[float]] = {}
        landmark_heights: dict[str, float] = {}
        for landmark_name, body_name in STANDING_FOOT_LANDMARK_BODIES.items():
            transform = transforms[body_name]
            landmark = [float(component) for component in transform["translation_m"]]
            projected_landmark, signed_height = _project_point_to_plane(landmark, up_vector)
            plane_point = _to_plane_coordinates(projected_landmark, tangent_u, tangent_v)
            foot_landmarks[landmark_name] = landmark
            projected_foot_landmarks[landmark_name] = projected_landmark
            support_points_2d.append(plane_point)
            support_point_lookup[_point_key_2d(plane_point)] = projected_landmark
            landmark_heights[landmark_name] = signed_height

        support_polygon_2d = _convex_hull_2d(support_points_2d)
        support_polygon = [
            support_point_lookup[_point_key_2d(point)]
            for point in support_polygon_2d
            if _point_key_2d(point) in support_point_lookup
        ]
        support_distance_outside = _distance_outside_support_polygon_2d(
            center_of_mass_plane,
            support_polygon_2d,
        )
        heel_penetration = sum(
            max(0.0, -landmark_heights[landmark_name] - STANDING_GROUND_CLEARANCE_TOLERANCE_M)
            for landmark_name in ("left_heel", "right_heel")
        )
        toe_penetration = sum(
            max(0.0, -landmark_heights[landmark_name] - STANDING_GROUND_CLEARANCE_TOLERANCE_M)
            for landmark_name in ("left_toe", "right_toe")
        )
        heel_lift = 0.0
        for side in ("left", "right"):
            toe_height = landmark_heights[f"{side}_toe"]
            heel_height = landmark_heights[f"{side}_heel"]
            if toe_height <= STANDING_TOE_CONTACT_TOLERANCE_M:
                heel_lift += max(0.0, heel_height - STANDING_HEEL_LIFT_TOLERANCE_M)

        return StandingMetric(
            gravity_vector_m_s2=gravity_vector,
            gravity_magnitude_m_s2=gravity_magnitude,
            center_of_mass_m=center_of_mass,
            projected_center_of_mass_m=projected_center_of_mass,
            foot_landmarks_m=foot_landmarks,
            projected_foot_landmarks_m=projected_foot_landmarks,
            support_polygon_m=support_polygon,
            support_distance_outside_m=support_distance_outside,
            heel_penetration_m=heel_penetration,
            toe_penetration_m=toe_penetration,
            heel_lift_m=heel_lift,
        )

    def evaluate_static_pose(self, request: EvaluationRequest) -> dict[str, Any]:
        selected_groups = _resolve_selected_groups(request.selected_groups, self.lower_body_muscle_groups)

        opensim, model = self._build_runtime_model()
        applied_tightness = self._apply_tightness_settings(model, request.tightness)
        state = model.initSystem()
        applied_pose = self._apply_pose(model, state, request.pose)
        model.equilibrateMuscles(state)
        model.realizePosition(state)
        model.realizeVelocity(state)
        model.realizeDynamics(state)
        lower_body_muscle_metrics = self._read_lower_body_muscle_outputs(model, state)
        group_metrics = self._aggregate_group_outputs(lower_body_muscle_metrics)
        transforms = self._read_segment_transforms(model, state)
        standing_metrics = self._evaluate_standing_metrics(model, state, transforms)
        debug: dict[str, Any] = {}
        if request.include_upper_body_debug_metrics:
            debug["upper_body_muscle_metrics"] = {
                name: asdict(metric)
                for name, metric in self._read_upper_body_debug_muscle_outputs(model, state).items()
            }
            debug["upper_body_debug_note"] = (
                "The active FullBodyModel primarily models the upper body with torque actuators, "
                "so this debug payload is expected to be empty for muscle metrics."
            )

        objective = compute_objective_terms(
            group_metrics=group_metrics,
            pose={**self.coordinate_defaults, **applied_pose},
            coordinate_defaults=self.coordinate_defaults,
            selected_groups=selected_groups,
            standing_metrics=standing_metrics,
        )

        return {
            "metadata": {
                "active_model_path": ACTIVE_MODEL_RELATIVE_PATH,
                "model_name": self.manifest.model_name,
                "analysis_scope": LOWER_BODY_ANALYSIS_CUTOFF,
                "full_body_transform_count": len(transforms),
                "active_optimizer_phase": ACTIVE_OPTIMIZER_PHASE,
                "active_optimizer_debug": ACTIVE_OPTIMIZER_DEBUG,
                "selected_groups": selected_groups,
                "evaluation_order": EVALUATION_ORDER,
                "runtime": runtime_status(),
            },
            "tightness": applied_tightness,
            "pose_rad": {**self.coordinate_defaults, **applied_pose},
            "per_actuator": {name: asdict(metric) for name, metric in lower_body_muscle_metrics.items()},
            "per_group": {name: asdict(metric) for name, metric in group_metrics.items()},
            "objective": objective,
            "standing": asdict(standing_metrics),
            "segment_transforms": transforms,
            "debug": debug,
        }


class ActivePhaseOptimizer:
    def __init__(self, evaluator: OpenSimEvaluator) -> None:
        self.evaluator = evaluator
        self.bounds = INNER_OPTIMIZATION_BOUNDS_ACTIVE

    def _clamp(self, coordinate_name: str, value: float) -> float:
        lower, upper = self.bounds[coordinate_name]
        return min(max(value, lower), upper)

    def _baseline_pose(self, seed_pose: Mapping[str, float]) -> dict[str, float]:
        pose = {
            coordinate_name: self.evaluator.coordinate_defaults[coordinate_name]
            for coordinate_name in ACTIVE_OPTIMIZER_COORDINATES
        }
        pose.update({name: float(value) for name, value in seed_pose.items() if name in pose})
        for coordinate_name, value in list(pose.items()):
            pose[coordinate_name] = self._clamp(coordinate_name, value)
        return pose

    def optimize(self, request: OptimizationRequest) -> dict[str, Any]:
        selected_groups = _resolve_selected_groups(request.selected_groups, self.evaluator.lower_body_muscle_groups)
        current_pose = self._baseline_pose(request.seed_pose)
        best_result = self.evaluator.evaluate_static_pose(
            EvaluationRequest(
                pose=current_pose,
                tightness=request.tightness,
                selected_groups=selected_groups,
                include_upper_body_debug_metrics=request.include_upper_body_debug_metrics,
            )
        )
        best_value = float(best_result["objective"]["total"])
        step = float(request.initial_step_rad)
        iteration = 0
        trace = [
            {
                "iteration": iteration,
                "step_rad": step,
                "objective_total": best_value,
                "pose_rad": dict(current_pose),
            }
        ]

        while iteration < request.max_iterations and step >= request.tolerance_rad:
            improved = False
            for coordinate_name in ACTIVE_OPTIMIZER_COORDINATES:
                for direction in (-1.0, 1.0):
                    candidate_pose = dict(current_pose)
                    candidate_pose[coordinate_name] = self._clamp(
                        coordinate_name,
                        candidate_pose[coordinate_name] + direction * step,
                    )
                    candidate_result = self.evaluator.evaluate_static_pose(
                        EvaluationRequest(
                            pose=candidate_pose,
                            tightness=request.tightness,
                            selected_groups=selected_groups,
                            include_upper_body_debug_metrics=request.include_upper_body_debug_metrics,
                        )
                    )
                    candidate_value = float(candidate_result["objective"]["total"])
                    if candidate_value + 1e-12 < best_value:
                        best_value = candidate_value
                        best_result = candidate_result
                        current_pose = candidate_pose
                        improved = True
            iteration += 1
            trace.append(
                {
                    "iteration": iteration,
                    "step_rad": step,
                    "objective_total": best_value,
                    "pose_rad": dict(current_pose),
                }
            )
            if not improved:
                step *= 0.5

        best_result["optimizer"] = {
            "phase": ACTIVE_OPTIMIZER_PHASE,
            "active_coordinates": list(ACTIVE_OPTIMIZER_COORDINATES),
            "future_phase_3_coordinates": list(FUTURE_PHASE_3_COORDINATES),
            "later_only_coordinates": list(LATER_ONLY_COORDINATES),
            "bounds_rad": {
                coordinate_name: list(bounds) for coordinate_name, bounds in self.bounds.items()
            },
            "iterations": iteration,
            "final_step_rad": step,
            "trace": trace,
        }
        best_result["optimized_pose_rad"] = dict(current_pose)
        return best_result


def manifest_summary(manifest: ModelManifest | None = None) -> dict[str, Any]:
    resolved_manifest = manifest or load_model_manifest()
    configuration = validate_project_configuration(resolved_manifest)
    lower_body_groups = build_lower_body_muscle_groups()
    return {
        "configuration": configuration,
        "runtime": runtime_status(),
        "coordinates": {
            name: asdict(coordinate) for name, coordinate in resolved_manifest.coordinates.items()
        },
        "bodies": list(resolved_manifest.bodies.keys()),
        "lower_body_muscles": lower_body_muscle_names(lower_body_groups),
        "lower_body_muscle_catalog": build_lower_body_muscle_catalog(
            resolved_manifest,
            lower_body_groups,
        ),
        "lower_body_groups": lower_body_groups,
        "inner_optimization_bounds_active_rad": {
            name: list(bounds) for name, bounds in INNER_OPTIMIZATION_BOUNDS_ACTIVE.items()
        },
        "outer_hard_bounds_rad": {
            name: list(bounds) for name, bounds in outer_hard_bounds_from_manifest(resolved_manifest).items()
        },
        "upper_body_debug_force_entries": {
            name: info.element_type
            for name, info in resolved_manifest.forces.items()
            if not name.endswith(("_r", "_l")) or name.startswith(("arm_", "elbow_", "wrist_", "pro_sup_"))
        },
        "viewer": {
            "asset_url": VIEWER_MODEL_ROUTE,
            "body_nodes": _viewer_body_node_map(resolved_manifest),
            "model_path": ACTIVE_MODEL_RELATIVE_PATH,
            "geometry_path": ACTIVE_MODEL_GEOMETRY_RELATIVE_PATH,
            "runtime": viewer_runtime_status(),
        },
    }


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def _print_json(payload: Mapping[str, Any]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def _load_json_bytes(rfile: Any, content_length: int) -> dict[str, Any]:
    raw = rfile.read(content_length)
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def build_api_payload(
    *,
    mode: str,
    message: str,
    payload: Mapping[str, Any],
    running: bool = False,
) -> dict[str, Any]:
    response = dict(payload)
    status = dict(response.get("status", {}))
    status.update(
        {
            "mode": mode,
            "message": message,
            "running": running,
            "phase": ACTIVE_OPTIMIZER_PHASE if mode == "optimize" else "evaluate",
        }
    )
    response["status"] = status
    return response


def serve_api(host: str, port: int) -> int:
    manifest = load_model_manifest()
    validate_project_configuration(manifest)
    evaluator = OpenSimEvaluator(manifest)
    optimizer = ActivePhaseOptimizer(evaluator)
    manifest_payload = manifest_summary(manifest)

    class MusculoMoveApiHandler(BaseHTTPRequestHandler):
        server_version = "MusculoMoveAPI/0.1"

        def log_message(self, format: str, *args: Any) -> None:
            return

        def _send_json(self, payload: Mapping[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
            data = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            self.wfile.write(data)

        def _send_bytes(
            self,
            payload: bytes,
            *,
            content_type: str,
            status: HTTPStatus = HTTPStatus.OK,
        ) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            self.wfile.write(payload)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self._send_json({"ok": True}, HTTPStatus.NO_CONTENT)

        def do_GET(self) -> None:  # noqa: N802
            route = urlparse(self.path).path
            try:
                if route in ("/health", "/api/health"):
                    self._send_json({"ok": True, "runtime": runtime_status()})
                    return
                if route in ("/manifest", "/api/manifest"):
                    self._send_json(manifest_payload)
                    return
                if route in (VIEWER_MODEL_ROUTE, VIEWER_MODEL_ROUTE.removeprefix("/api")):
                    asset = get_viewer_asset(manifest)
                    self._send_bytes(asset["bytes"], content_type=asset["content_type"])
                    return
                self._send_json(
                    {"error": f"Unknown route `{route}`."},
                    HTTPStatus.NOT_FOUND,
                )
            except (OpenSimRuntimeUnavailable, ViewerAssetUnavailable) as exc:
                self._send_json(
                    {
                        "error": str(exc),
                        "runtime": runtime_status(),
                        "viewer_runtime": viewer_runtime_status(),
                    },
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )

        def do_POST(self) -> None:  # noqa: N802
            route = urlparse(self.path).path
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                data = _load_json_bytes(self.rfile, content_length)
                if route in ("/evaluate", "/api/evaluate"):
                    request = EvaluationRequest.from_mapping(data)
                    payload = evaluator.evaluate_static_pose(request)
                    self._send_json(
                        build_api_payload(
                            mode="evaluate",
                            message="Static pose evaluated.",
                            payload=payload,
                        )
                    )
                    return
                if route in ("/optimize", "/api/optimize"):
                    request = OptimizationRequest.from_mapping(data)
                    payload = optimizer.optimize(request)
                    self._send_json(
                        build_api_payload(
                            mode="optimize",
                            message="Phase-2 bilateral passive optimization complete.",
                            payload=payload,
                        )
                    )
                    return
                self._send_json(
                    {"error": f"Unknown route `{route}`."},
                    HTTPStatus.NOT_FOUND,
                )
            except (OpenSimRuntimeUnavailable, ViewerAssetUnavailable) as exc:
                self._send_json(
                    {
                        "error": str(exc),
                        "runtime": runtime_status(),
                        "viewer_runtime": viewer_runtime_status(),
                    },
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
            except Exception as exc:
                self._send_json(
                    {"error": str(exc)},
                    HTTPStatus.BAD_REQUEST,
                )

    server = ThreadingHTTPServer((host, port), MusculoMoveApiHandler)
    print(f"MusculoMove API listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "MusculoMove static-pose backend wired directly to "
            f"{ACTIVE_MODEL_RELATIVE_PATH}."
        )
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("manifest", help="Print model metadata and project configuration.")

    evaluate = subparsers.add_parser("evaluate", help="Evaluate a static pose request from JSON.")
    evaluate.add_argument("--request", required=True, type=Path, help="Path to an evaluation JSON file.")

    optimize = subparsers.add_parser(
        "optimize",
        help="Run the active bilateral passive optimizer from JSON.",
    )
    optimize.add_argument("--request", required=True, type=Path, help="Path to an optimization JSON file.")

    serve = subparsers.add_parser("serve", help="Run a small HTTP API for the frontend.")
    serve.add_argument("--host", default="127.0.0.1", help="Bind host. Defaults to 127.0.0.1.")
    serve.add_argument("--port", default=8000, type=int, help="Bind port. Defaults to 8000.")

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        manifest = load_model_manifest()
        validate_project_configuration(manifest)

        if args.command == "manifest":
            _print_json(manifest_summary(manifest))
            return 0

        evaluator = OpenSimEvaluator(manifest)
        if args.command == "serve":
            return serve_api(args.host, args.port)

        if args.command == "evaluate":
            request = EvaluationRequest.from_mapping(_read_json(args.request))
            _print_json(evaluator.evaluate_static_pose(request))
            return 0

        if args.command == "optimize":
            request = OptimizationRequest.from_mapping(_read_json(args.request))
            optimizer = ActivePhaseOptimizer(evaluator)
            _print_json(optimizer.optimize(request))
            return 0
    except OpenSimRuntimeUnavailable as exc:
        _print_json(
            {
                "error": str(exc),
                "active_model_path": ACTIVE_MODEL_RELATIVE_PATH,
                "runtime": runtime_status(),
            }
        )
        return 2
    except Exception as exc:  # pragma: no cover - CLI guardrail
        _print_json({"error": str(exc), "active_model_path": ACTIVE_MODEL_RELATIVE_PATH})
        return 1

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
