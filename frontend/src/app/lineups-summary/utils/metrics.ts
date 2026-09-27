import { MetricKey } from '../models/lineup.model';
import { fmtInt, fmtMinutes, fmtNet, fmtPct, fmtPm, fmtRating } from './format';

export type MetricFormat = 'rating' | 'net' | 'pct' | 'int' | 'minutes' | 'pm' | 'pace';

export interface MetricDef {
  key: MetricKey;
  label: string;
  short: string;
  format: MetricFormat;
  better: 'high' | 'low' | 'none';
  formula: string;
  why: string;
}

export const METRICS: MetricDef[] = [
  {
    key: 'total_possessions',
    label: 'Possessions',
    short: 'POSS',
    format: 'int',
    better: 'none',
    formula: 'off poss + def poss',
    why: 'Total possessions played across both ends.',
  },
  {
    key: 'minutes',
    label: 'Minutes',
    short: 'MIN',
    format: 'minutes',
    better: 'none',
    formula: '(off sec + def sec) / 60',
    why: 'Total floor time across both ends.',
  },
  {
    key: 'offensive_rating',
    label: 'Offensive rating',
    short: 'ORTG',
    format: 'rating',
    better: 'high',
    formula: '100 × off pts / off poss',
    why: 'Points scored per 100 trips.',
  },
  {
    key: 'defensive_rating',
    label: 'Defensive rating',
    short: 'DRTG',
    format: 'rating',
    better: 'low',
    formula: '100 × pts allowed / def poss',
    why: 'Points allowed per 100 trips. Lower is better.',
  },
  {
    key: 'net_rating',
    label: 'Net rating',
    short: 'NET',
    format: 'net',
    better: 'high',
    formula: 'ORtg − DRtg',
    why: 'Points won per 100 possessions. The bottom line.',
  },
  {
    key: 'adjusted_net_rating',
    label: 'Adjusted net',
    short: 'ADJ',
    format: 'net',
    better: 'high',
    formula: '(net·poss + team_net·40) / (poss + 40)',
    why: 'Net rating pulled toward team average until the sample earns it.',
  },
  {
    key: 'plus_minus',
    label: 'Plus / minus',
    short: '+/−',
    format: 'pm',
    better: 'high',
    formula: 'off points − points allowed',
    why: 'Raw point differential on the floor.',
  },
  {
    key: 'pace',
    label: 'Pace',
    short: 'PACE',
    format: 'pace',
    better: 'none',
    formula: '((off poss + def poss) / 2) × 48 / min',
    why: 'Estimated possessions per 48 minutes.',
  },
  {
    key: 'possession_share',
    label: 'Possession share',
    short: 'SHARE',
    format: 'pct',
    better: 'none',
    formula: 'group poss / team poss',
    why: 'Portion of team minutes commanded by this unit.',
  },
  {
    key: 'reliability',
    label: 'Reliability',
    short: 'REL',
    format: 'pct',
    better: 'none',
    formula: 'poss / (poss + 40)',
    why: 'Statistical confidence weight based on sample size.',
  },
  {
    key: 'offensive_efg_pct',
    label: 'Effective FG%',
    short: 'EFG%',
    format: 'pct',
    better: 'high',
    formula: '(FGM + 0.5·3PM) / FGA',
    why: 'Shooting, with threes weighted for the extra point.',
  },
  {
    key: 'defensive_efg_pct',
    label: 'Opponent eFG%',
    short: 'OPP EFG%',
    format: 'pct',
    better: 'low',
    formula: 'opponent eFG%',
    why: 'Opponent shot-making efficiency allowed. Lower is better.',
  },
  {
    key: 'offensive_ts_pct',
    label: 'True shooting %',
    short: 'TS%',
    format: 'pct',
    better: 'high',
    formula: 'PTS / (2·(FGA + 0.44·FTA))',
    why: 'Overall scoring efficiency including free throws.',
  },
  {
    key: 'defensive_ts_pct',
    label: 'Opponent TS%',
    short: 'OPP TS%',
    format: 'pct',
    better: 'low',
    formula: 'opponent TS%',
    why: 'Opponent true shooting efficiency allowed.',
  },
  {
    key: 'offensive_ft_pct',
    label: 'Free throw %',
    short: 'FT%',
    format: 'pct',
    better: 'high',
    formula: 'FTM / FTA',
    why: 'Execution at the charity stripe.',
  },
  {
    key: 'offensive_tov_pct',
    label: 'Turnover %',
    short: 'TOV%',
    format: 'pct',
    better: 'low',
    formula: 'TOV / off poss',
    why: 'Trips that end without a shot. Lower is better.',
  },
  {
    key: 'defensive_tov_pct',
    label: 'Turnovers forced %',
    short: 'FORCED TOV%',
    format: 'pct',
    better: 'high',
    formula: 'opp TOV / def poss',
    why: 'Opponent trips ended by a turnover.',
  },
  {
    key: 'offensive_oreb_pct',
    label: 'Offensive rebound %',
    short: 'OREB%',
    format: 'pct',
    better: 'high',
    formula: 'OREB / off rebound opps',
    why: 'Second chances created per miss.',
  },
  {
    key: 'defensive_dreb_pct',
    label: 'Defensive rebound %',
    short: 'DREB%',
    format: 'pct',
    better: 'high',
    formula: 'DREB / def rebound opps',
    why: 'Share of opponent misses this group ends the possession on.',
  },
  {
    key: 'offensive_ft_rate',
    label: 'Free throw rate',
    short: 'FTR',
    format: 'pct',
    better: 'high',
    formula: 'FTA / FGA',
    why: 'Ability to draw fouls relative to shot volume.',
  },
  {
    key: 'defensive_ft_rate',
    label: 'Opponent FT rate',
    short: 'OPP FTR',
    format: 'pct',
    better: 'low',
    formula: 'opp FTA / opp FGA',
    why: 'Discipline avoiding opponent free throws. Lower is better.',
  },
  {
    key: 'offensive_three_rate',
    label: 'Three-point rate',
    short: '3PA RATE',
    format: 'pct',
    better: 'none',
    formula: '3PA / FGA',
    why: 'How much of the shot diet comes from deep.',
  },
  {
    key: 'defensive_three_rate',
    label: 'Opponent 3PA rate',
    short: 'OPP 3PA RATE',
    format: 'pct',
    better: 'none',
    formula: 'opp 3PA / opp FGA',
    why: 'Share of opponent shots allowed from beyond the arc.',
  },
  {
    key: 'assist_rate',
    label: 'Assist rate',
    short: 'AST%',
    format: 'pct',
    better: 'high',
    formula: 'AST / FGM',
    why: 'Share of made field goals set up by a pass.',
  },
  {
    key: 'steal_pct',
    label: 'Steal %',
    short: 'STL%',
    format: 'pct',
    better: 'high',
    formula: 'steals / def poss',
    why: 'Active hands disrupting opponent possessions.',
  },
  {
    key: 'block_pct',
    label: 'Block %',
    short: 'BLK%',
    format: 'pct',
    better: 'high',
    formula: 'blocks / opp 2PA',
    why: 'Rim protection on two-point attempts.',
  },
  {
    key: 'foul_rate',
    label: 'Foul rate',
    short: 'FOUL/100',
    format: 'rating',
    better: 'low',
    formula: 'def fouls per 100 def poss',
    why: 'Whistles blown against the defense per 100 possessions.',
  },
];

export const METRIC_MAP = new Map<MetricKey, MetricDef>(
  METRICS.map((m) => [m.key, m]),
);

export const EXPLORER_PRESETS: Record<string, { label: string; columns: MetricKey[] }> = {
  overview: {
    label: 'Overview',
    columns: [
      'total_possessions',
      'minutes',
      'offensive_rating',
      'defensive_rating',
      'net_rating',
      'adjusted_net_rating',
      'plus_minus',
      'possession_share',
    ],
  },
  offense: {
    label: 'Offense',
    columns: [
      'offensive_rating',
      'offensive_efg_pct',
      'offensive_ts_pct',
      'offensive_tov_pct',
      'offensive_oreb_pct',
      'offensive_ft_rate',
      'offensive_three_rate',
      'assist_rate',
    ],
  },
  defense: {
    label: 'Defense',
    columns: [
      'defensive_rating',
      'defensive_efg_pct',
      'defensive_tov_pct',
      'defensive_dreb_pct',
      'defensive_ft_rate',
      'steal_pct',
      'block_pct',
      'foul_rate',
    ],
  },
  four: {
    label: 'Four Factors',
    columns: [
      'offensive_efg_pct',
      'offensive_tov_pct',
      'offensive_oreb_pct',
      'offensive_ft_rate',
      'defensive_efg_pct',
      'defensive_tov_pct',
      'defensive_dreb_pct',
      'defensive_ft_rate',
    ],
  },
};

export function formatMetric(def: MetricDef, value: number | null | undefined): string {
  switch (def.format) {
    case 'rating':
    case 'pace':
      return fmtRating(value);
    case 'net':
      return fmtNet(value);
    case 'pm':
      return fmtPm(value);
    case 'pct':
      return fmtPct(value);
    case 'int':
      return fmtInt(value);
    case 'minutes':
      return fmtMinutes(value);
    default:
      return value != null ? String(value) : '—';
  }
}
