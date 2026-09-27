from __future__ import annotations

from collections import defaultdict

from app.helpers.aggregation import (
    SIDES,
    PossessionFilters,
    aggregate,
    base_record,
    lineup_keys,
    load_possessions,
    load_reference,
    team_keys,
)

ON_OFF_FIELDS = (
    'offensive_rating',
    'defensive_rating',
    'net_rating',
    'plus_minus',
    'total_possessions',
    'minutes',
    'offensive_efg_pct',
    'defensive_efg_pct',
    'offensive_tov_pct',
    'defensive_tov_pct',
    'offensive_oreb_pct',
    'defensive_dreb_pct',
)


def _slice(record: dict) -> dict:
    return {key: record[key] for key in ON_OFF_FIELDS}


def _diff(a, b):
    return None if a is None or b is None else round(a - b, 2)


def get_player_impact(
    *,
    team_ids=(),
    opponent_team_ids=(),
    game_ids=(),
    periods=(),
    date_from=None,
    date_to=None,
    min_partner_possessions: int = 20,
) -> list[dict]:
    rows = load_possessions(PossessionFilters.build(game_ids, periods, date_from, date_to))
    teams = frozenset(team_ids)
    opponents = frozenset(opponent_team_ids)
    singles = aggregate(rows, lineup_keys(1, teams, opponents))
    pairs = aggregate(rows, lineup_keys(2, teams, opponents))
    team_totals = aggregate(rows, team_keys(teams, opponents))
    ref = load_reference()

    def player_name(pid):
        return ref.players.get(pid, {}).get('name', 'Unknown')

    partners = defaultdict(list)
    for (_team_id, (a, b)), totals in pairs.items():
        record = base_record(totals)
        if record['total_possessions'] < min_partner_possessions or record['net_rating'] is None:
            continue
        for player_id, partner_id in ((a, b), (b, a)):
            partners[player_id].append({
                'player_id': partner_id,
                'name': player_name(partner_id),
                'net_rating': record['net_rating'],
                'total_possessions': record['total_possessions'],
            })

    results = []
    for (team_id, (player_id,)), on_totals in singles.items():
        team = team_totals[team_id]
        off_totals = {side: team[side] - on_totals[side] for side in SIDES}
        on = base_record(on_totals)
        off = base_record(off_totals)
        player_partners = partners.get(player_id, [])
        results.append({
            'player_id': player_id,
            'name': player_name(player_id),
            'team_id': team_id,
            'team_name': ref.teams.get(team_id, ''),
            'on': _slice(on),
            'off': _slice(off),
            'on_off_net_diff': _diff(on['net_rating'], off['net_rating']),
            'on_off_offensive_diff': _diff(on['offensive_rating'], off['offensive_rating']),
            'on_off_defensive_diff': _diff(off['defensive_rating'], on['defensive_rating']),
            'best_partner': max(player_partners, key=lambda p: p['net_rating'], default=None),
            'worst_partner': min(player_partners, key=lambda p: p['net_rating'], default=None),
        })

    results.sort(key=lambda r: (r['on_off_net_diff'] is None, -(r['on_off_net_diff'] or 0)))
    return results
