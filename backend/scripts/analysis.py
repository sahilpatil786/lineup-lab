#!/usr/bin/env python
import os
import sys

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from app.helpers.aggregation import (
    PossessionFilters,
    aggregate,
    base_record,
    describe_group,
    load_possessions,
    load_reference,
)
from app.helpers.lineups import get_lineup_league_summary_stats
from app.helpers.meta import get_meta
from app.helpers.metrics import rnd, safe_div
from app.helpers.players import get_player_impact


def fmt_p(players):
    return ' · '.join(p['name'] for p in players)


def percentile_ranks(values):
    cleaned = [v for v in values if v is not None]
    sorted_v = sorted(cleaned)
    n = len(sorted_v)
    result = []
    for v in values:
        if v is None or n < 2:
            result.append(0.5)
            continue
        lo = 0
        hi = n
        while lo < hi:
            mid = (lo + hi) // 2
            if sorted_v[mid] < v:
                lo = mid + 1
            else:
                hi = mid
        eq = lo
        while eq < n and sorted_v[eq] == v:
            eq += 1
        result.append(((lo + eq - 1) / 2) / (n - 1))
    return result


def main():
    print('=' * 80)
    print('OKC LINEUP LAB — COMPREHENSIVE DATA ANALYSIS')
    print('=' * 80)

    meta = get_meta()
    ref = load_reference()
    league_base = meta['league_baseline']
    team_bases = {tb['team_id']: tb for tb in meta['team_baselines']}

    # -------------------------------------------------------------------------
    # Q1 — BEST 5-MAN LINEUP
    # -------------------------------------------------------------------------
    print('\n' + '=' * 80)
    print('QUESTION 1: BEST 5-MAN LINEUP')
    print('=' * 80)

    for min_p in [0, 20, 40]:
        lineups = get_lineup_league_summary_stats(5, min_possessions=min_p, sort_by='net_rating', order='desc')
        print(f'\n--- Top 10 by Net Rating (Min Possessions = {min_p}) ---')
        print(f"{'#':<3} {'Team':<16} {'Net':<8} {'ORtg':<8} {'DRtg':<8} {'Poss':<6} {'Players'}")
        print('-' * 80)
        for i, r in enumerate(lineups[:10], 1):
            print(f"{i:<3} {r['team_name']:<16} {r['net_rating']:<8} {r['offensive_rating']:<8} {r['defensive_rating']:<8} {r['total_possessions']:<6} {fmt_p(r['players'])}")

    # Top by plus_minus
    lineups_pm = get_lineup_league_summary_stats(5, min_possessions=10, sort_by='plus_minus', order='desc')
    print('\n--- Top 10 by Plus/Minus (+/-) ---')
    print(f"{'#':<3} {'Team':<16} {'+/-':<8} {'Net':<8} {'Poss':<6} {'Players'}")
    print('-' * 80)
    for i, r in enumerate(lineups_pm[:10], 1):
        print(f"{i:<3} {r['team_name']:<16} {r['plus_minus']:<8} {r['net_rating']:<8} {r['total_possessions']:<6} {fmt_p(r['players'])}")

    # Top by adjusted_net_rating
    lineups_adj = get_lineup_league_summary_stats(5, min_possessions=10, sort_by='adjusted_net_rating', order='desc')
    print('\n--- Top 10 by Stability-Adjusted Net Rating ---')
    print(f"{'#':<3} {'Team':<16} {'AdjNet':<8} {'Net':<8} {'Poss':<6} {'Players'}")
    print('-' * 80)
    for i, r in enumerate(lineups_adj[:10], 1):
        print(f"{i:<3} {r['team_name']:<16} {r['adjusted_net_rating']:<8} {r['net_rating']:<8} {r['total_possessions']:<6} {fmt_p(r['players'])}")

    # Top candidate breakdown
    top_cand = lineups_adj[0]
    tb = team_bases[top_cand['team_id']]
    print(f"\n--- Top Candidate Profile: {top_cand['team_name']} ---")
    print(f"Players: {fmt_p(top_cand['players'])}")
    print(f"Possessions: {top_cand['total_possessions']}, Net: {top_cand['net_rating']}, AdjNet: {top_cand['adjusted_net_rating']}, +/-: {top_cand['plus_minus']}")
    print(f"{'Metric':<20} {'Lineup':<12} {'Team Avg':<12} {'League Avg':<12}")
    print('-' * 56)
    print(f"{'Offensive Rating':<20} {top_cand['offensive_rating']:<12} {tb['offensive_rating']:<12} {league_base['offensive_rating']:<12}")
    print(f"{'Defensive Rating':<20} {top_cand['defensive_rating']:<12} {tb['defensive_rating']:<12} {league_base['defensive_rating']:<12}")
    print(f"{'eFG%':<20} {top_cand['offensive_efg_pct']:<12} {tb['offensive_efg_pct']:<12} {league_base['offensive_efg_pct']:<12}")
    print(f"{'TOV%':<20} {top_cand['offensive_tov_pct']:<12} {tb['offensive_tov_pct']:<12} {league_base['offensive_tov_pct']:<12}")
    print(f"{'OREB%':<20} {top_cand['offensive_oreb_pct']:<12} {tb['offensive_oreb_pct']:<12} {league_base['offensive_oreb_pct']:<12}")
    print(f"{'DREB%':<20} {top_cand['defensive_dreb_pct']:<12} {tb['defensive_dreb_pct']:<12} {league_base['defensive_dreb_pct']:<12}")
    print(f"{'FT Rate':<20} {top_cand['offensive_ft_rate']:<12} {tb['offensive_ft_rate']:<12} {league_base['offensive_ft_rate']:<12}")

    # -------------------------------------------------------------------------
    # Q2 — BEST PLAYER
    # -------------------------------------------------------------------------
    print('\n' + '=' * 80)
    print('QUESTION 2: BEST PLAYER IMPACT')
    print('=' * 80)

    impacts = get_player_impact(min_partner_possessions=20)
    qualified = [p for p in impacts if p['on']['total_possessions'] >= 40]

    print('\n--- Top 10 Players by On/Off Net Rating Differential (Min On Poss = 40) ---')
    print(f"{'#':<3} {'Player':<20} {'Team':<16} {'On/Off Net':<12} {'On Net':<10} {'Off Net':<10} {'On Poss':<8} {'+/-':<6}")
    print('-' * 85)
    for i, p in enumerate(qualified[:10], 1):
        print(f"{i:<3} {p['name']:<20} {p['team_name']:<16} {p['on_off_net_diff']:<12} {p['on']['net_rating']:<10} {p['off']['net_rating']:<10} {p['on']['total_possessions']:<8} {p['on']['plus_minus']:<6}")

    print('\n--- Offensive vs Defensive Impact Split ---')
    print(f"{'#':<3} {'Player':<20} {'On/Off Offense':<16} {'On/Off Defense':<16} {'Best Partner'}")
    print('-' * 80)
    for i, p in enumerate(qualified[:10], 1):
        bp = f"{p['best_partner']['name']} ({p['best_partner']['net_rating']})" if p['best_partner'] else '—'
        print(f"{i:<3} {p['name']:<20} {p['on_off_offensive_diff']:<16} {p['on_off_defensive_diff']:<16} {bp}")

    top_player = qualified[0]
    print(f"\n--- Partner Consistency for Top Candidate: {top_player['name']} ({top_player['team_name']}) ---")
    duos = get_lineup_league_summary_stats(2, include_players=[top_player['player_id']], min_possessions=10, sort_by='net_rating', order='desc')
    print(f"{'Partner':<20} {'Net Rating':<12} {'ORtg':<10} {'DRtg':<10} {'Poss':<6}")
    print('-' * 60)
    for d in duos:
        partner_name = [pl['name'] for pl in d['players'] if pl['player_id'] != top_player['player_id']][0]
        print(f"{partner_name:<20} {d['net_rating']:<12} {d['offensive_rating']:<10} {d['defensive_rating']:<10} {d['total_possessions']:<6}")

    # -------------------------------------------------------------------------
    # Q3 — COUNTERING BIG, GLASS-CRASHING LINEUPS
    # -------------------------------------------------------------------------
    print('\n' + '=' * 80)
    print('QUESTION 3: COUNTERING BIG, GLASS-CRASHING UNITS')
    print('=' * 80)

    rows = load_possessions(PossessionFilters())
    all_5s = get_lineup_league_summary_stats(5, min_possessions=0)

    # 1. Glass crashers: offensive_rebound_opportunities >= 8 and top quartile of offensive_oreb_pct
    cands_reb = [r for r in all_5s if (r.get('offensive_rebound_opportunities') or 0) >= 8 and r.get('offensive_oreb_pct') is not None]
    cands_reb.sort(key=lambda r: r['offensive_oreb_pct'], reverse=True)
    q75_idx = max(1, len(cands_reb) // 4)
    q75_thresh = cands_reb[q75_idx]['offensive_oreb_pct']
    glass_crashers = [r for r in cands_reb if r['offensive_oreb_pct'] >= q75_thresh]

    print(f"\n--- Glass-Crashing Units (Top quartile OREB%, Min 8 Rebound Opps, Threshold = {q75_thresh:.3f}) ---")
    print(f"{'Team':<16} {'OREB%':<10} {'OREB/Opp':<10} {'Poss':<6} {'Players'}")
    print('-' * 80)
    for gc in glass_crashers:
        print(f"{gc['team_name']:<16} {gc['offensive_oreb_pct']:<10} {gc['offensive_rebounds_offense']}/{gc['offensive_rebound_opportunities']:<8} {gc['total_possessions']:<6} {fmt_p(gc['players'])}")

    gc_keys = {(gc['team_id'], tuple(sorted(gc['player_ids']))) for gc in glass_crashers}

    # 2. Possessions against glass crashers
    def against_gc_keys(side, team, opponent, players, row):
        opp_tuple = row['defensive_player_ids'] if side == 'offensive' else row['offensive_player_ids']
        if (opponent, opp_tuple) in gc_keys:
            return [(team, players)]
        return ()

    head_to_head = aggregate(rows, against_gc_keys)
    h2h_records = []
    for (team_id, player_ids), totals in head_to_head.items():
        rec = base_record(totals)
        if rec['total_possessions'] >= 6:
            describe_group(rec, team_id, player_ids, ref)
            opp_oreb_allowed = rnd(safe_div(rec['defensive_rebounds_offense'], rec['defensive_rebound_opportunities']), 4)
            rec['opp_oreb_allowed'] = opp_oreb_allowed
            h2h_records.append(rec)

    h2h_records.sort(key=lambda r: (r['defensive_dreb_pct'] is not None, r['defensive_dreb_pct'] or 0), reverse=True)

    print('\n--- Direct Head-to-Head Performance Against Glass Crashers (Min 6 Poss vs them) ---')
    print(f"{'#':<3} {'Team':<16} {'DREB%':<10} {'Opp OREB%':<12} {'Net':<8} {'Poss vs GC':<10} {'Players'}")
    print('-' * 85)
    for i, r in enumerate(h2h_records, 1):
        print(f"{i:<3} {r['team_name']:<16} {r['defensive_dreb_pct']:<10} {r['opp_oreb_allowed']:<12} {r['net_rating']:<8} {r['total_possessions']:<10} {fmt_p(r['players'])}")

    # 3. Composite score using Counter Builder preset weights
    weights = {
        'defensive_dreb_pct': (3.0, 'high'),
        'offensive_oreb_pct': (1.5, 'high'),
        'offensive_three_rate': (1.5, 'high'),
        'offensive_efg_pct': (1.0, 'high'),
        'offensive_tov_pct': (1.0, 'low'),
        'pace': (0.5, 'high'),
        'defensive_rating': (1.0, 'low'),
    }

    qual_5s = [r for r in all_5s if r['total_possessions'] >= 20]
    total_w = sum(w for w, _ in weights.values())

    metric_ranks = {}
    for k, (w, better) in weights.items():
        vals = [r.get(k) for r in qual_5s]
        ranks = percentile_ranks(vals)
        metric_ranks[k] = ranks

    scored_cands = []
    for i, r in enumerate(qual_5s):
        score = 0
        comp_parts = {}
        for k, (w, better) in weights.items():
            pct = metric_ranks[k][i]
            oriented = pct if better == 'high' else 1 - pct
            part_val = (oriented * w) / total_w
            score += part_val
            comp_parts[k] = oriented
        scored_cands.append({'record': r, 'score': score * 100, 'parts': comp_parts})

    scored_cands.sort(key=lambda x: x['score'], reverse=True)

    print('\n--- Counter Builder Composite Top 10 (Preset: vs. Big glass-crashers, Min 20 Poss) ---')
    print(f"{'#':<3} {'Team':<16} {'Score':<8} {'DREB%':<8} {'OREB%':<8} {'3PA Rate':<10} {'Net':<8} {'Poss':<6} {'Players'}")
    print('-' * 95)
    for i, sc in enumerate(scored_cands[:10], 1):
        r = sc['record']
        print(f"{i:<3} {r['team_name']:<16} {sc['score']:<8.1f} {r['defensive_dreb_pct']:<8} {r['offensive_oreb_pct']:<8} {r['offensive_three_rate']:<10} {r['net_rating']:<8} {r['total_possessions']:<6} {fmt_p(r['players'])}")

    # 4. Cross reference
    top_composite_keys = {tuple(sorted(sc['record']['player_ids'])) for sc in scored_cands[:5]}
    h2h_keys = {tuple(sorted(r['player_ids'])) for r in h2h_records}
    overlap = top_composite_keys.intersection(h2h_keys)

    print('\n--- Optimal Counter Match: Lineups Excelling in Both Matchups & Composite Model ---')
    for sc in scored_cands:
        pids = tuple(sorted(sc['record']['player_ids']))
        if pids in overlap:
            h2h_match = next(h for h in h2h_records if tuple(sorted(h['player_ids'])) == pids)
            print(f"Team: {sc['record']['team_name']}")
            print(f"Players: {fmt_p(sc['record']['players'])}")
            print(f"Composite Score: {sc['score']:.1f} (Rank #{[s['record']['lineup_key'] for s in scored_cands].index(sc['record']['lineup_key']) + 1})")
            print(f"Head-to-Head vs Glass Crashers: DREB% = {h2h_match['defensive_dreb_pct']}, Net = {h2h_match['net_rating']}, Poss = {h2h_match['total_possessions']}")
            print(f"Season Overall: Net = {sc['record']['net_rating']}, Total Poss = {sc['record']['total_possessions']}")
            break


if __name__ == '__main__':
    main()
