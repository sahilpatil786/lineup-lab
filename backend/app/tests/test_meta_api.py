from rest_framework.test import APITestCase

from app.tests.fixtures import (
    TEAM_A,
    build_fixture,
)


class TestMetaApi(APITestCase):
    def setUp(self):
        build_fixture()

    def test_meta(self):
        res = self.client.get('/api/v1/meta')
        self.assertEqual(res.status_code, 200)
        data = res.data

        self.assertEqual(data['totals']['possessions'], 4)
        self.assertEqual(data['totals']['five_man_lineups'], 3)
        self.assertEqual(data['totals']['active_players'], 11)

        self.assertEqual(len(data['team_baselines']), 2)
        alpha = next(t for t in data['team_baselines'] if t['team_id'] == TEAM_A)
        self.assertEqual(alpha['net_rating'], -50.0)

        self.assertIsNotNone(data['league_baseline'])
        self.assertEqual(data['league_baseline']['net_rating'], 0.0)
