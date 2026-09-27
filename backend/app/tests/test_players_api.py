from rest_framework.test import APITestCase

from app.tests.fixtures import (
    A,
    build_fixture,
)


class TestPlayersApi(APITestCase):
    def setUp(self):
        build_fixture()

    def test_players_impact(self):
        res = self.client.get('/api/v1/players/impact', {'min_partner_possessions': 0})
        self.assertEqual(res.status_code, 200)
        players = res.data

        # Response sorted desc by on_off_net_diff
        diffs = [p['on_off_net_diff'] for p in players if p['on_off_net_diff'] is not None]
        self.assertEqual(diffs, sorted(diffs, reverse=True))

        by_id = {p['player_id']: p for p in players}
        self.assertEqual(by_id[A[0]]['on_off_net_diff'], -100.0)
        self.assertEqual(by_id[A[5]]['on_off_net_diff'], 100.0)

        # With min_partner_possessions=0, a1's best_partner exists and has net_rating == -100
        best_p = by_id[A[0]]['best_partner']
        self.assertIsNotNone(best_p)
        self.assertEqual(best_p['net_rating'], -100.0)
