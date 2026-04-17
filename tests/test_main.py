import math
import unittest

import main


class ManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = main.load_model_manifest()

    def test_active_model_path_is_hardcoded_to_rajagopal(self) -> None:
        self.assertEqual(main.ACTIVE_MODEL_RELATIVE_PATH, "models/RajagopalLaiUhlrich2023.osim")
        self.assertTrue(main.ACTIVE_MODEL_PATH.exists())

    def test_manifest_counts_match_model_file(self) -> None:
        self.assertEqual(self.manifest.model_name, "RajagopalLaiUhlrich2023")
        self.assertEqual(len(self.manifest.coordinates), 39)
        self.assertEqual(len(self.manifest.bodies), 22)
        self.assertEqual(len(self.manifest.muscles), 80)

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
        for coordinate_name, inner_bounds in main.INNER_OPTIMIZATION_BOUNDS_PHASE_1.items():
            outer_bounds = outer[coordinate_name]
            self.assertGreaterEqual(inner_bounds[0], outer_bounds[0])
            self.assertLessEqual(inner_bounds[1], outer_bounds[1])


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
            "lumbar_extension": 0.0,
            "hip_flexion_r": 0.0,
            "knee_angle_r": 0.0,
            "ankle_angle_r": 0.0,
        }
        pose = {
            "pelvis_tilt": math.radians(10.0),
            "lumbar_extension": 0.0,
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

        selected_term = 0.2**2
        global_term = 0.2**2 + 0.1**2
        regularization = (
            2.0 * math.radians(10.0) ** 2
            + 1.0 * math.radians(5.0) ** 2
            + 0.5 * math.radians(2.0) ** 2
            + 0.5 * math.radians(-3.0) ** 2
        )

        self.assertAlmostEqual(result["selected_term"], selected_term)
        self.assertAlmostEqual(result["global_term"], global_term)
        self.assertAlmostEqual(result["regularization_term"], regularization)
        self.assertAlmostEqual(
            result["total"],
            selected_term + main.GLOBAL_OBJECTIVE_WEIGHT * global_term + regularization,
        )


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
