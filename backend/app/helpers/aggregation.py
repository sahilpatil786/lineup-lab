from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from itertools import combinations
from typing import Callable, Hashable, Iterable, Optional

from app.dbmodels.models import Game, Player, Possession, Team
from app.helpers.metrics import (
    DERIVED_FIELDS,
    PRIOR_POSSESSIONS,
    derived_metrics,
    rnd,
    safe_div,
    shrink,
    zero_div,
)

COUNTING_FIELDS = (
    'points',
    'shot_attempts',
    'fg2_made',
    'fg2_attempted',
    'fg3_made',
    'fg3_attempted',
    'fg_made',
    'fg_attempted',
    'ft_made',
    'ft_attempted',
    'rebounds_offense',
    'rebounds_defense',
    'rebound_opportunities',
    'assists',
    'steals',
    'turnovers',
    'blocks',
    'offensive_fouls',
    'defensive_fouls',
    'shooting_fouls',
    'shot_attempt_points',
    'ft_potential_points',
    'transition_take_fouls',
)
SIDES = ('offensive', 'defensive')
PCT_FIELDS = ('fg_pct', 'fg2_pct', 'fg3_pct')
CONTEXT_FIELDS = ('possession_share', 'reliability', 'adjusted_net_rating')

SORTABLE_FIELDS = tuple(
    [f'{side}_possessions' for side in SIDES]
    + [f'{side}_{field}' for side in SIDES for field in COUNTING_FIELDS]
    + ['total_possessions']
    + [f'{side}_{field}' for side in SIDES for field in PCT_FIELDS]
    + list(DERIVED_FIELDS)
    + list(CONTEXT_FIELDS)
)

Totals = dict[str, Counter]
KeyFn = Callable[[str, str, str, tuple, dict], Iterable[Hashable]]


@dataclass(frozen=True)
class PossessionFilters:
    game_ids: tuple[str, ...] = ()
    periods: tuple[int, ...] = ()
    date_from: Optional[date] = None
    date_to: Optional[date] = None

    @classmethod
    def build(cls, game_ids=(), periods=(), date_from=None, date_to=None) -> 'PossessionFilters':
        return cls(
            game_ids=tuple(sorted(str(game_id) for game_id in game_ids)),
            periods=tuple(sorted(int(period) for period in periods)),
            date_from=date_from,
            date_to=date_to,
        )


@dataclass(frozen=True)
class Reference:
    teams: dict
    players: dict
    games: dict


@lru_cache(maxsize=1)
def load_reference() -> Reference:
    return Reference(
        teams={str(team.id): team.name for team in Team.objects.all()},
        players={
            str(player.id): {'name': player.name, 'team_id': str(player.team_id)}
            for player in Player.objects.all()
        },
        games={str(game.id): game.date.isoformat() for game in Game.objects.all()},
    )


@lru_cache(maxsize=32)
def load_possessions(filters: PossessionFilters) -> tuple[dict, ...]:
    queryset = Possession.objects.all()
    if filters.game_ids:
        queryset = queryset.filter(game_id__in=filters.game_ids)
    if filters.periods:
        queryset = queryset.filter(period__in=filters.periods)
    if filters.date_from:
        queryset = queryset.filter(game__date__gte=filters.date_from)
    if filters.date_to:
        queryset = queryset.filter(game__date__lte=filters.date_to)

    rows = []
    for row in queryset.values(
        'game_id',
        'offensive_team_id',
        'defensive_team_id',
        'offensive_player_ids',
        'defensive_player_ids',
        'period',
        'seconds',
        *COUNTING_FIELDS,
    ):
        row['game_id'] = str(row['game_id'])
        row['offensive_team_id'] = str(row['offensive_team_id'])
        row['defensive_team_id'] = str(row['defensive_team_id'])
        row['offensive_player_ids'] = tuple(sorted(str(pid) for pid in row['offensive_player_ids']))
        row['defensive_player_ids'] = tuple(sorted(str(pid) for pid in row['defensive_player_ids']))
        rows.append(row)
    return tuple(rows)


def clear_caches() -> None:
    load_possessions.cache_clear()
    load_reference.cache_clear()


def _empty_totals() -> Totals:
    return {'offensive': Counter(), 'defensive': Counter()}


def aggregate(rows: Iterable[dict], key_fn: KeyFn) -> dict[Hashable, Totals]:
    totals: dict[Hashable, Totals] = defaultdict(_empty_totals)
    for row in rows:
        for side, team, opponent, players in (
            ('offensive', row['offensive_team_id'], row['defensive_team_id'], row['offensive_player_ids']),
            ('defensive', row['defensive_team_id'], row['offensive_team_id'], row['defensive_player_ids']),
        ):
            for key in key_fn(side, team, opponent, players, row):
                bucket = totals[key][side]
                bucket['possessions'] += 1
                bucket['seconds'] += row['seconds']
                for field_name in COUNTING_FIELDS:
                    bucket[field_name] += row[field_name]
    return dict(totals)


def lineup_keys(size: int, team_ids=frozenset(), opponent_ids=frozenset(), include=frozenset()) -> KeyFn:
    def key_fn(side, team, opponent, players, row):
        if team_ids and team not in team_ids:
            return ()
        if opponent_ids and opponent not in opponent_ids:
            return ()
        if include and not include.issubset(players):
            return ()
        return [(team, combo) for combo in combinations(players, size) if include.issubset(combo)]

    return key_fn


def team_keys(team_ids=frozenset(), opponent_ids=frozenset()) -> KeyFn:
    def key_fn(side, team, opponent, players, row):
        if team_ids and team not in team_ids:
            return ()
        if opponent_ids and opponent not in opponent_ids:
            return ()
        return [team]

    return key_fn


def base_record(totals: Totals) -> dict:
    off, de = totals['offensive'], totals['defensive']
    record: dict = {}
    for side, counts in (('offensive', off), ('defensive', de)):
        record[f'{side}_possessions'] = counts['possessions']
        for field_name in COUNTING_FIELDS:
            record[f'{side}_{field_name}'] = counts[field_name]
    record['total_possessions'] = off['possessions'] + de['possessions']
    for side, counts in (('offensive', off), ('defensive', de)):
        record[f'{side}_fg_pct'] = rnd(zero_div(counts['fg_made'], counts['fg_attempted']), 4)
        record[f'{side}_fg2_pct'] = rnd(zero_div(counts['fg2_made'], counts['fg2_attempted']), 4)
        record[f'{side}_fg3_pct'] = rnd(zero_div(counts['fg3_made'], counts['fg3_attempted']), 4)
    record.update(derived_metrics(off, de))
    return record


def add_team_context(record: dict, team_record: dict) -> None:
    total = record['total_possessions']
    record['possession_share'] = rnd(safe_div(total, team_record['total_possessions']), 4)
    record['reliability'] = rnd(total / (total + PRIOR_POSSESSIONS), 4)
    record['adjusted_net_rating'] = rnd(shrink(record['net_rating'], total, team_record['net_rating']), 2)


def describe_group(record: dict, team_id: str, player_ids: tuple, ref: Reference) -> None:
    record.update({
        'team_id': team_id,
        'team_name': ref.teams.get(team_id, ''),
        'lineup_key': '_'.join(player_ids),
        'lineup_size': len(player_ids),
        'player_ids': list(player_ids),
        'players': [
            {'player_id': pid, 'name': ref.players.get(pid, {}).get('name', 'Unknown')}
            for pid in player_ids
        ],
    })


def sort_records(records: list[dict], sort_by: str, order: str) -> list[dict]:
    present = [record for record in records if record.get(sort_by) is not None]
    missing = [record for record in records if record.get(sort_by) is None]
    present.sort(key=lambda record: (record[sort_by], record['total_possessions']), reverse=order == 'desc')
    return present + missing
