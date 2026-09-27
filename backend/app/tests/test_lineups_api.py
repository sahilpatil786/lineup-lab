import json
from pathlib import Path
from rest_framework.test import APITestCase

from app.tests.fixtures import (
    A,
    A_FIVE_1,
    A_FIVE_2,
    B,
    TEAM_A,
    TEAM_B,
    build_fixture,
)

SAMPLE_PATH = Path(__file__).resolve().parent.parent / 'helpers' / 'sample_summary_data' / 'sample_summary_data.json'


class TestLineupsApi(APITestCase):
    def setUp(self):
        build_fixture()

    def get(self, params=None):
        return self.client.get('/api/v1/lineups', params or {})

    def test_sample_key_parity(self):
        with open(SAMPLE_PATH) as f:
            sample = json.load(f)
        sample_keys = set(sample[0].keys())

        response = self.get({'lineup_size': 5})
        self.assertEqual(response.status_code, 200)
        records = response.data
        self.assertGreater(len(records), 0)
        for record in records:
            missing_keys = sample_keys - set(record.keys())
            self.assertEqual(missing_keys, set(), f"Record missing keys: {missing_keys}")

    def test_group_counts(self):
        res5 = self.get({'lineup_size': 5})
        self.assertEqual(res5.status_code, 200)
        self.assertEqual(len(res5.data), 3)

        res1 = self.get({'lineup_size': 1})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(len(res1.data), 11)

        res4 = self.get({'lineup_size': 4})
        self.assertEqual(res4.status_code, 200)
        self.assertEqual(len(res4.data), 14)

    def test_hand_values(self):
        res5 = self.get({'lineup_size': 5})
        by_key = {r['lineup_key']: r for r in res5.data}

        k_a1 = '_'.join(sorted(A_FIVE_1))
        k_a2 = '_'.join(sorted(A_FIVE_2))
        k_b = '_'.join(sorted(B))

        # A five-1
        r_a1 = by_key[k_a1]
        self.assertEqual(r_a1['offensive_possessions'], 1)
        self.assertEqual(r_a1['offensive_points'], 2)
        self.assertEqual(r_a1['defensive_possessions'], 1)
        self.assertEqual(r_a1['defensive_points'], 3)
        self.assertEqual(r_a1['offensive_rating'], 200.0)
        self.assertEqual(r_a1['defensive_rating'], 300.0)
        self.assertEqual(r_a1['net_rating'], -100.0)
        self.assertEqual(r_a1['plus_minus'], -1)

        # A five-2
        r_a2 = by_key[k_a2]
        self.assertEqual(r_a2['offensive_possessions'], 1)
        self.assertEqual(r_a2['offensive_points'], 0)
        self.assertEqual(r_a2['defensive_possessions'], 1)
        self.assertEqual(r_a2['defensive_points'], 0)
        self.assertEqual(r_a2['offensive_rating'], 0.0)
        self.assertEqual(r_a2['defensive_rating'], 0.0)
        self.assertEqual(r_a2['net_rating'], 0.0)
        self.assertEqual(r_a2['plus_minus'], 0)
        self.assertEqual(r_a2['steal_pct'], 1.0)
        self.assertEqual(r_a2['offensive_oreb_pct'], 0.0)
        self.assertEqual(r_a2['offensive_efg_pct'], 0.0)
        self.assertEqual(r_a2['adjusted_net_rating'], -47.62)

        # B five
        r_b = by_key[k_b]
        self.assertEqual(r_b['offensive_possessions'], 2)
        self.assertEqual(r_b['offensive_points'], 3)
        self.assertEqual(r_b['defensive_possessions'], 2)
        self.assertEqual(r_b['defensive_points'], 2)
        self.assertEqual(r_b['offensive_rating'], 150.0)
        self.assertEqual(r_b['defensive_rating'], 100.0)
        self.assertEqual(r_b['net_rating'], 50.0)
        self.assertEqual(r_b['plus_minus'], 1)
        self.assertEqual(r_b['defensive_dreb_pct'], 1.0)
        self.assertEqual(r_b['offensive_tov_pct'], 0.5)

        # a2 alone
        res1 = self.get({'lineup_size': 1, 'include_players': A[1]})
        r_solo_a2 = next(r for r in res1.data if r['lineup_key'] == A[1])
        self.assertEqual(r_solo_a2['offensive_possessions'], 2)
        self.assertEqual(r_solo_a2['offensive_points'], 2)
        self.assertEqual(r_solo_a2['defensive_possessions'], 2)
        self.assertEqual(r_solo_a2['defensive_points'], 3)
        self.assertEqual(r_solo_a2['offensive_rating'], 100.0)
        self.assertEqual(r_solo_a2['defensive_rating'], 150.0)
        self.assertEqual(r_solo_a2['net_rating'], -50.0)
        self.assertEqual(r_solo_a2['plus_minus'], -1)

    def test_conservation(self):
        res = self.get({'lineup_size': 5})
        total_off_pts = sum(r['offensive_points'] for r in res.data)
        total_off_poss = sum(r['offensive_possessions'] for r in res.data)
        self.assertEqual(total_off_pts, 5)
        self.assertEqual(total_off_poss, 4)

    def test_filters(self):
        k_a1 = '_'.join(sorted(A_FIVE_1))
        k_a2 = '_'.join(sorted(A_FIVE_2))
        k_b = '_'.join(sorted(B))

        # period=1
        res = self.get({'lineup_size': 5, 'period': 1})
        keys = {r['lineup_key'] for r in res.data}
        self.assertEqual(keys, {k_a1, k_b})
        self.assertNotIn(k_a2, keys)

        # team_id=TEAM_B
        res = self.get({'lineup_size': 5, 'team_id': TEAM_B})
        keys = {r['lineup_key'] for r in res.data}
        self.assertEqual(keys, {k_b})

        # opponent_team_id=TEAM_A
        res = self.get({'lineup_size': 5, 'opponent_team_id': TEAM_A})
        keys = {r['lineup_key'] for r in res.data}
        self.assertEqual(keys, {k_b})

        # include_players=A[0]
        res = self.get({'lineup_size': 5, 'include_players': A[0]})
        keys = {r['lineup_key'] for r in res.data}
        self.assertEqual(keys, {k_a1})

        # min_possessions=3
        res = self.get({'lineup_size': 5, 'min_possessions': 3})
        keys = {r['lineup_key'] for r in res.data}
        self.assertEqual(keys, {k_b})

        # comma form period=1,2 equals repeated form period=1&period=2
        res_comma = self.client.get('/api/v1/lineups?period=1,2')
        res_repeated = self.client.get('/api/v1/lineups?period=1&period=2')
        self.assertEqual(res_comma.data, res_repeated.data)

    def test_sorting(self):
        k_a1 = '_'.join(sorted(A_FIVE_1))
        k_a2 = '_'.join(sorted(A_FIVE_2))
        k_b = '_'.join(sorted(B))

        res_desc = self.get({'lineup_size': 5, 'sort_by': 'net_rating', 'order': 'desc'})
        keys_desc = [r['lineup_key'] for r in res_desc.data]
        self.assertEqual(keys_desc, [k_b, k_a2, k_a1])

        res_asc = self.get({'lineup_size': 5, 'sort_by': 'net_rating', 'order': 'asc'})
        keys_asc = [r['lineup_key'] for r in res_asc.data]
        self.assertEqual(keys_asc, [k_a1, k_a2, k_b])

    def test_validation(self):
        # team_id=not-a-uuid -> 400
        res = self.get({'team_id': 'not-a-uuid'})
        self.assertEqual(res.status_code, 400)

        # sort_by=bogus -> 400
        res = self.get({'sort_by': 'bogus'})
        self.assertEqual(res.status_code, 400)

        # period=7 -> 400
        res = self.get({'period': 7})
        self.assertEqual(res.status_code, 400)

        # date_from=2025-10-25&date_to=2025-10-20 -> 400
        res = self.get({'date_from': '2025-10-25', 'date_to': '2025-10-20'})
        self.assertEqual(res.status_code, 400)

        # lineup_size=2&include_players=A[0],A[1],A[2] -> 400
        res = self.get({'lineup_size': 2, 'include_players': f'{A[0]},{A[1]},{A[2]}'})
        self.assertEqual(res.status_code, 400)

    def test_clamp(self):
        # lineup_size=9 -> 200 with 5-man records
        res9 = self.get({'lineup_size': 9})
        self.assertEqual(res9.status_code, 200)
        self.assertEqual(len(res9.data), 3)

        # lineup_size=abc -> 5-man records
        res_abc = self.get({'lineup_size': 'abc'})
        self.assertEqual(res_abc.status_code, 200)
        self.assertEqual(len(res_abc.data), 3)

    def test_detail(self):
        # player_ids=<a1..a5>
        res = self.client.get('/api/v1/lineups/detail', {'player_ids': ','.join(A_FIVE_1)})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['lineup']['net_rating'], -100.0)
        self.assertEqual(len(res.data['splits']['by_period']), 1)
        self.assertEqual(res.data['splits']['by_period'][0]['period'], 1)

        # Mixed teams
        res_mixed = self.client.get('/api/v1/lineups/detail', {'player_ids': f'{A[0]},{B[0]}'})
        self.assertEqual(res_mixed.status_code, 400)

        # Never together
        res_never = self.client.get('/api/v1/lineups/detail', {'player_ids': f'{A[0]},{A[5]}'})
        self.assertEqual(res_never.status_code, 404)
