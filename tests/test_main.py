import math
import unittest

import main


class ManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = main.load_model_manifest()
        cls.summary = main.manifest_summary(cls.manifest)

    def test_active_model_path_is_hardcoded_to_rajagopal_lai_uhlrich_2023(self) -> None:
        self.assertEqual(main.ACTIVE_MODEL_RELATIVE_PATH, "models/RajagopalLaiUhlrich2023.osim")
        self.assertTrue(main.ACTIVE_MODEL_PATH.exists())
        self.assertTrue(main.ACTIVE_MODEL_GEOMETRY_PATH.exists())

    def test_manifest_counts_match_model_file(self) -> None:
        self.assertEqual(
            self.manifest.model_name,
            "RajagopalLaiUhlrich2023",
        )
        self.assertEqual(len(self.manifest.coordinates), 39)
        self.assertEqual(len(self.manifest.bodies), 22)
        self.assertEqual(len(self.manifest.muscles), 80)
        self.assertNotIn("ground", self.manifest.bodies)

    def test_phase_one_coordinates_exist_in_manifest(self) -> None:
        for coordinate_name in main.ACTIVE_OPTIMIZER_COORDINATES:
            self.assertIn(coordinate_name, self.manifest.coordinates)

    def test_lower_body_group_mapping_covers_exactly_the_model_muscles(self) -> None:
        groups = main.build_lower_body_muscle_groups()
        grouped = set(main.lower_body_muscle_names(groups))
        manifest_muscles = set(self.manifest.muscles)
        self.assertEqual(len(groups), 26)
        self.assertEqual(grouped, manifest_muscles)

    def test_inner_bounds_stay_inside_outer_bounds(self) -> None:
        outer = main.outer_hard_bounds_from_manifest(self.manifest)
        for coordinate_name, inner_bounds in main.INNER_OPTIMIZATION_BOUNDS_ACTIVE.items():
            outer_bounds = outer[coordinate_name]
            self.assertGreaterEqual(inner_bounds[0], outer_bounds[0])
            self.assertLessEqual(inner_bounds[1], outer_bounds[1])

    def test_manifest_includes_viewer_metadata(self) -> None:
        viewer = self.summary["viewer"]
        self.assertEqual(viewer["asset_url"], "/api/viewer/model.gltf")
        self.assertEqual(viewer["model_path"], "models/RajagopalLaiUhlrich2023.osim")
        self.assertEqual(viewer["geometry_path"], "models/FullBodyModel-4.0/Geometry")
        self.assertEqual(viewer["body_nodes"]["pelvis"], "Body:/bodyset/pelvis")


class ObjectiveTests(unittest.TestCase):
    def test_objective_terms_follow_project_formula(self) -> None:
        group_metrics = {
            "hamstrings_r": main.GroupMetric(
                weighted_normalized_passive_force=0.2,
                worst_compartment_normalized_passive_force=0.3,
                mean_normalized_fiber_length=1.1,
            ),
            "hamstrings_l": main.GroupMetric(
                weighted_normalized_passive_force=0.1,
                worst_compartment_normalized_passive_force=0.1,
                mean_normalized_fiber_length=1.0,
            ),
        }
        defaults = {
            "pelvis_tilt": 0.0,
            "pelvis_list": 0.0,
            "pelvis_rotation": 0.0,
            "lumbar_extension": 0.0,
            "hip_flexion_l": 0.0,
            "knee_angle_l": 0.0,
            "ankle_angle_l": 0.0,
            "hip_flexion_r": 0.0,
            "knee_angle_r": 0.0,
            "ankle_angle_r": 0.0,
        }
        pose = {
            "pelvis_tilt": math.radians(10.0),
            "pelvis_list": math.radians(4.0),
            "pelvis_rotation": math.radians(-6.0),
            "lumbar_extension": 0.0,
            "hip_flexion_l": math.radians(-4.0),
            "knee_angle_l": math.radians(3.0),
            "ankle_angle_l": math.radians(2.0),
            "hip_flexion_r": math.radians(5.0),
            "knee_angle_r": math.radians(2.0),
            "ankle_angle_r": math.radians(-3.0),
        }

        result = main.compute_objective_terms(
            group_metrics=group_metrics,
            pose=pose,
            coordinate_defaults=defaults,
            selected_groups=["hamstrings_r"],
        )

        selected_passive_term = 0.2**2
        selected_worst_compartment_term = 0.3**2
        selected_overlength_term = (1.1 - 1.0) ** 2
        selected_term = (
            selected_passive_term
            + main.SELECTED_WORST_COMPARTMENT_WEIGHT * selected_worst_compartment_term
            + main.SELECTED_OVERLENGTH_WEIGHT * selected_overlength_term
        )
        global_term = 0.2**2 + 0.1**2
        regularization = (
            2.0 * math.radians(10.0) ** 2
            + 2.0 * math.radians(4.0) ** 2
            + 2.0 * math.radians(-6.0) ** 2
            + 1.0 * math.radians(-4.0) ** 2
            + 0.5 * math.radians(3.0) ** 2
            + 0.5 * math.radians(2.0) ** 2
            + 1.0 * math.radians(5.0) ** 2
            + 0.5 * math.radians(2.0) ** 2
            + 0.5 * math.radians(-3.0) ** 2
        )

        self.assertAlmostEqual(result["selected_passive_term"], selected_passive_term)
        self.assertAlmostEqual(
            result["selected_worst_compartment_term"],
            selected_worst_compartment_term,
        )
        self.assertAlmostEqual(result["selected_overlength_term"], selected_overlength_term)
        self.assertAlmostEqual(result["selected_term"], selected_term)
        self.assertAlmostEqual(result["global_term"], global_term)
        self.assertAlmostEqual(result["regularization_term"], regularization)
        self.assertAlmostEqual(result["standing_term"], 0.0)
        self.assertAlmostEqual(
            result["total"],
            selected_term + main.GLOBAL_OBJECTIVE_WEIGHT * global_term + regularization,
        )

    def test_standing_term_penalizes_support_and_foot_clearance(self) -> None:
        standing = main.StandingMetric(
            gravity_vector_m_s2=[0.0, -9.81, 0.0],
            gravity_magnitude_m_s2=9.81,
            center_of_mass_m=[0.0, 1.0, 0.0],
            projected_center_of_mass_m=[0.0, 0.0, 0.0],
            foot_landmarks_m={},
            projected_foot_landmarks_m={},
            support_polygon_m=[],
            support_distance_outside_m=0.08,
            heel_penetration_m=0.01,
            toe_penetration_m=0.02,
            heel_lift_m=0.04,
        )

        result = main.compute_objective_terms(
            group_metrics={},
            pose={name: 0.0 for name in main.REGULARIZATION_WEIGHTS},
            coordinate_defaults={name: 0.0 for name in main.REGULARIZATION_WEIGHTS},
            selected_groups=[],
            standing_metrics=standing,
        )

        support_term = main.STANDING_SUPPORT_DISTANCE_WEIGHT * (0.08 - main.STANDING_SUPPORT_MARGIN_M) ** 2
        penetration_term = main.STANDING_PENETRATION_WEIGHT * (0.01**2 + 0.02**2)
        heel_lift_term = main.STANDING_HEEL_LIFT_WEIGHT * (0.04**2)

        self.assertAlmostEqual(result["standing_support_term"], support_term)
        self.assertAlmostEqual(result["standing_penetration_term"], penetration_term)
        self.assertAlmostEqual(result["standing_heel_lift_term"], heel_lift_term)
        self.assertAlmostEqual(result["standing_term"], support_term + penetration_term + heel_lift_term)
        self.assertAlmostEqual(result["total"], support_term + penetration_term + heel_lift_term)


class RequestParsingTests(unittest.TestCase):
    def test_tightness_directive_requires_explicit_alpha(self) -> None:
        with self.assertRaises(ValueError):
            main.TightnessDirective.from_mapping({"targets": ["hamstrings_r"], "severity": 0.5})

    def test_tightness_directive_accepts_group_targets(self) -> None:
        directive = main.TightnessDirective.from_mapping(
            {
                "targets": ["hamstrings_r"],
                "severity": 0.5,
                "max_shortening_fraction": 0.25,
            }
        )
        evaluator = main.OpenSimEvaluator(main.load_model_manifest())
        resolved = evaluator._resolve_tightness_targets(directive.targets)
        self.assertEqual(
            resolved,
            ["bflh_r", "bfsh_r", "semimem_r", "semiten_r"],
        )


if __name__ == "__main__":
    unittest.main()
