from __future__ import annotations

from typing import Any

from app.helpers.aggregation import (
    PossessionFilters,
    add_team_context,
    aggregate,
    base_record,
    describe_group,
    lineup_keys,
    load_possessions,
    load_reference,
    sort_records,
    team_keys,
)

LineupRecord = dict[str, Any]


class InvalidLineup(ValueError):
    pass


class LineupNotFound(Exception):
    pass


def _normalize_lineup_size(lineup_size: Any) -> int:
    try:
        normalized_lineup_size = int(lineup_size)
    except (TypeError, ValueError):
        return 5
    return max(1, min(5, normalized_lineup_size))


def get_lineup_league_summary_stats(
    lineup_size: int = 5,
    *,
    team_ids=(),
    opponent_team_ids=(),
    include_players=(),
    game_ids=(),
    periods=(),
    date_from=None,
    date_to=None,
    min_possessions: int = 0,
    sort_by: str = 'total_possessions',
    order: str = 'desc',
    limit: int | None = None,
) -> list[LineupRecord]:
    """Return lineup summaries across the entire league."""
    size = _normalize_lineup_size(lineup_size)
    rows = load_possessions(PossessionFilters.build(game_ids, periods, date_from, date_to))
    teams = frozenset(team_ids)
    opponents = frozenset(opponent_team_ids)

    groups = aggregate(rows, lineup_keys(size, teams, opponents, frozenset(include_players)))
    team_records = {
        team_id: base_record(totals)
        for team_id, totals in aggregate(rows, team_keys(teams, opponents)).items()
    }
    ref = load_reference()

    records = []
    for (team_id, player_ids), totals in groups.items():
        record = base_record(totals)
        if record['total_possessions'] < min_possessions:
            continue
        add_team_context(record, team_records[team_id])
        describe_group(record, team_id, player_ids, ref)
        records.append(record)

    records = sort_records(records, sort_by, order)
    return records[:limit] if limit else records


def get_lineup_detail(player_ids, *, game_ids=(), periods=(), date_from=None, date_to=None) -> dict:
    ref = load_reference()
    group = tuple(sorted(set(str(pid) for pid in player_ids)))
    unknown = [pid for pid in group if pid not in ref.players]
    if unknown:
        raise InvalidLineup(f'Unknown player ids: {", ".join(unknown)}')
    team_ids = {ref.players[pid]['team_id'] for pid in group}
    if len(team_ids) != 1:
        raise InvalidLineup('All players must belong to the same team.')
    team_id = team_ids.pop()
    members = frozenset(group)
    rows = load_possessions(PossessionFilters.build(game_ids, periods, date_from, date_to))

    def on_floor(team, players):
        return team == team_id and members.issubset(players)

    overall = aggregate(rows, lambda side, team, opp, players, row: ['all'] if on_floor(team, players) else ())
    if 'all' not in overall:
        raise LineupNotFound()

    team_totals = aggregate(rows, lambda side, team, opp, players, row: ['team'] if team == team_id else ())
    league_totals = aggregate(rows, lambda *args: ['league'])
    by_period = aggregate(rows, lambda side, team, opp, players, row: [row['period']] if on_floor(team, players) else ())
    by_opponent = aggregate(rows, lambda side, team, opp, players, row: [opp] if on_floor(team, players) else ())
    by_game = aggregate(
        rows, lambda side, team, opp, players, row: [(row['game_id'], opp)] if on_floor(team, players) else ()
    )

    team_record = base_record(team_totals['team'])
    lineup = base_record(overall['all'])
    add_team_context(lineup, team_record)
    describe_group(lineup, team_id, group, ref)

    return {
        'lineup': lineup,
        'team_baseline': {'team_id': team_id, 'team_name': ref.teams.get(team_id, ''), **team_record},
        'league_baseline': base_record(league_totals['league']),
        'splits': {
            'by_period': [
                {'period': period, **base_record(totals)} for period, totals in sorted(by_period.items())
            ],
            'by_opponent': sorted(
                [
                    {'opponent_team_id': opp, 'opponent_team_name': ref.teams.get(opp, ''), **base_record(totals)}
                    for opp, totals in by_opponent.items()
                ],
                key=lambda record: record['opponent_team_name'],
            ),
            'by_game': sorted(
                [
                    {
                        'game_id': game_id,
                        'date': ref.games.get(game_id, ''),
                        'opponent_team_id': opp,
                        'opponent_team_name': ref.teams.get(opp, ''),
                        **base_record(totals),
                    }
                    for (game_id, opp), totals in by_game.items()
                ],
                key=lambda record: record['date'],
            ),
        },
    }
