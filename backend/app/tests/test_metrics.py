from collections import Counter
import unittest

from app.helpers.metrics import (
    DERIVED_FIELDS,
    derived_metrics,
    efg_pct,
    per_100,
    safe_div,
    shrink,
    ts_pct,
    zero_div,
)


class TestMetrics(unittest.TestCase):
    def test_division_helpers(self):
        self.assertIsNone(safe_div(1, 0))
        self.assertEqual(safe_div(4, 2), 2.0)
        self.assertEqual(zero_div(1, 0), 0)
        self.assertEqual(zero_div(4, 2), 2.0)
        self.assertEqual(per_100(3, 2), 150.0)
        self.assertIsNone(per_100(3, 0))

    def test_shooting_metrics(self):
        self.assertEqual(efg_pct(1, 1, 2), 0.75)
        self.assertAlmostEqual(ts_pct(10, 8, 5), 10 / (2 * (8 + 2.2)))

    def test_shrink(self):
        self.assertEqual(shrink(None, 0, -5), -5)
        self.assertEqual(shrink(10, 40, 0), 5)

    def test_derived_metrics_empty(self):
        metrics = derived_metrics(Counter(), Counter())
        self.assertEqual(set(metrics.keys()), set(DERIVED_FIELDS))
        for key, val in metrics.items():
            self.assertTrue(val is None or val == 0, f"{key} was neither None nor 0: {val}")
