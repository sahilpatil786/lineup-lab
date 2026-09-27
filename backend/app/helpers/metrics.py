from __future__ import annotations

from collections import Counter
from typing import Optional

PRIOR_POSSESSIONS = 40

DERIVED_FIELDS = (
    'offensive_rating',
    'defensive_rating',
    'net_rating',
    'plus_minus',
    'minutes',
    'pace',
    'offensive_efg_pct',
    'defensive_efg_pct',
    'offensive_ts_pct',
    'defensive_ts_pct',
    'offensive_ft_pct',
    'offensive_tov_pct',
    'defensive_tov_pct',
    'offensive_oreb_pct',
    'defensive_dreb_pct',
    'offensive_ft_rate',
    'defensive_ft_rate',
    'offensive_three_rate',
    'defensive_three_rate',
    'assist_rate',
    'steal_pct',
    'block_pct',
    'foul_rate',
)


def safe_div(numerator: float, denominator: float) -> Optional[float]:
    if not denominator:
        return None
    return numerator / denominator


def zero_div(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0
    return numerator / denominator


def per_100(value: float, possessions: float) -> Optional[float]:
    rate = safe_div(value, possessions)
    return None if rate is None else rate * 100


def efg_pct(fg_made: int, fg3_made: int, fg_attempted: int) -> Optional[float]:
    return safe_div(fg_made + 0.5 * fg3_made, fg_attempted)


def ts_pct(points: int, fg_attempted: int, ft_attempted: int) -> Optional[float]:
    return safe_div(points, 2 * (fg_attempted + 0.44 * ft_attempted))


def shrink(value: Optional[float], weight: float, prior: Optional[float], prior_weight: float = PRIOR_POSSESSIONS) -> Optional[float]:
    if value is None:
        return prior
    if prior is None:
        return value
    return (value * weight + prior * prior_weight) / (weight + prior_weight)


def rnd(value: Optional[float], digits: int) -> Optional[float]:
    return None if value is None else round(value, digits)


def derived_metrics(off: Counter, de: Counter) -> dict:
    offensive_rating = per_100(off['points'], off['possessions'])
    defensive_rating = per_100(de['points'], de['possessions'])
    net_rating = None
    if offensive_rating is not None and defensive_rating is not None:
        net_rating = offensive_rating - defensive_rating
    minutes = (off['seconds'] + de['seconds']) / 60

    return {
        'offensive_rating': rnd(offensive_rating, 2),
        'defensive_rating': rnd(defensive_rating, 2),
        'net_rating': rnd(net_rating, 2),
        'plus_minus': off['points'] - de['points'],
        'minutes': rnd(minutes, 2),
        'pace': rnd(safe_div((off['possessions'] + de['possessions']) / 2 * 48, minutes), 2),
        'offensive_efg_pct': rnd(efg_pct(off['fg_made'], off['fg3_made'], off['fg_attempted']), 4),
        'defensive_efg_pct': rnd(efg_pct(de['fg_made'], de['fg3_made'], de['fg_attempted']), 4),
        'offensive_ts_pct': rnd(ts_pct(off['points'], off['fg_attempted'], off['ft_attempted']), 4),
        'defensive_ts_pct': rnd(ts_pct(de['points'], de['fg_attempted'], de['ft_attempted']), 4),
        'offensive_ft_pct': rnd(safe_div(off['ft_made'], off['ft_attempted']), 4),
        'offensive_tov_pct': rnd(safe_div(off['turnovers'], off['possessions']), 4),
        'defensive_tov_pct': rnd(safe_div(de['turnovers'], de['possessions']), 4),
        'offensive_oreb_pct': rnd(safe_div(off['rebounds_offense'], off['rebound_opportunities']), 4),
        'defensive_dreb_pct': rnd(safe_div(de['rebounds_defense'], de['rebound_opportunities']), 4),
        'offensive_ft_rate': rnd(safe_div(off['ft_attempted'], off['fg_attempted']), 4),
        'defensive_ft_rate': rnd(safe_div(de['ft_attempted'], de['fg_attempted']), 4),
        'offensive_three_rate': rnd(safe_div(off['fg3_attempted'], off['fg_attempted']), 4),
        'defensive_three_rate': rnd(safe_div(de['fg3_attempted'], de['fg_attempted']), 4),
        'assist_rate': rnd(safe_div(off['assists'], off['fg_made']), 4),
        'steal_pct': rnd(safe_div(de['steals'], de['possessions']), 4),
        'block_pct': rnd(safe_div(de['blocks'], de['fg2_attempted']), 4),
        'foul_rate': rnd(per_100(de['defensive_fouls'], de['possessions']), 2),
    }
