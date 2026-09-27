from __future__ import annotations

from collections import defaultdict

from app.helpers.aggregation import PossessionFilters, aggregate, base_record, load_possessions, load_reference, team_keys


def get_meta() -> dict:
    ref = load_reference()
    rows = load_possessions(PossessionFilters())
    team_totals = aggregate(rows, team_keys())
    league_totals = aggregate(rows, lambda *args: ['league'])

    active = set()
    five_man = set()
    game_teams = defaultdict(set)
    for row in rows:
        active.update(row['offensive_player_ids'])
        active.update(row['defensive_player_ids'])
        five_man.add((row['offensive_team_id'], row['offensive_player_ids']))
        five_man.add((row['defensive_team_id'], row['defensive_player_ids']))
        game_teams[row['game_id']].update((row['offensive_team_id'], row['defensive_team_id']))

    dates = sorted(ref.games.values())
    return {
        'teams': sorted(
            [{'team_id': team_id, 'name': name} for team_id, name in ref.teams.items()],
            key=lambda team: team['name'],
        ),
        'players': sorted(
            [
                {'player_id': pid, 'name': player['name'], 'team_id': player['team_id'], 'active': pid in active}
                for pid, player in ref.players.items()
            ],
            key=lambda player: player['name'],
        ),
        'games': sorted(
            [
                {
                    'game_id': game_id,
                    'date': game_date,
                    'team_ids': sorted(game_teams.get(game_id, set())),
                    'team_names': sorted(ref.teams.get(t, '') for t in game_teams.get(game_id, set())),
                }
                for game_id, game_date in ref.games.items()
            ],
            key=lambda game: game['date'],
        ),
        'date_range': {'min': dates[0] if dates else None, 'max': dates[-1] if dates else None},
        'periods': sorted({row['period'] for row in rows}),
        'totals': {
            'possessions': len(rows),
            'games': len(ref.games),
            'teams': len(ref.teams),
            'active_players': len(active),
            'five_man_lineups': len(five_man),
        },
        'team_baselines': sorted(
            [
                {'team_id': team_id, 'team_name': ref.teams.get(team_id, ''), **base_record(totals)}
                for team_id, totals in team_totals.items()
            ],
            key=lambda record: record['team_name'],
        ),
        'league_baseline': base_record(league_totals['league']) if 'league' in league_totals else None,
    }
