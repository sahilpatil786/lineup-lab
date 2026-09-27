export const COUNTING_FIELDS = [
  'points', 'shot_attempts', 'fg2_made', 'fg2_attempted', 'fg3_made', 'fg3_attempted',
  'fg_made', 'fg_attempted', 'ft_made', 'ft_attempted', 'rebounds_offense', 'rebounds_defense',
  'rebound_opportunities', 'assists', 'steals', 'turnovers', 'blocks', 'offensive_fouls',
  'defensive_fouls', 'shooting_fouls', 'shot_attempt_points', 'ft_potential_points', 'transition_take_fouls',
] as const;

export type Side = 'offensive' | 'defensive';
export type CountingField = (typeof COUNTING_FIELDS)[number];

type SideCounts = { [K in `${Side}_${CountingField}` | `${Side}_possessions`]: number };
type SidePcts = { [K in `${Side}_${'fg_pct' | 'fg2_pct' | 'fg3_pct'}`]: number };

export interface DerivedMetrics {
  offensive_rating: number | null;
  defensive_rating: number | null;
  net_rating: number | null;
  plus_minus: number;
  minutes: number;
  pace: number | null;
  offensive_efg_pct: number | null;
  defensive_efg_pct: number | null;
  offensive_ts_pct: number | null;
  defensive_ts_pct: number | null;
  offensive_ft_pct: number | null;
  offensive_tov_pct: number | null;
  defensive_tov_pct: number | null;
  offensive_oreb_pct: number | null;
  defensive_dreb_pct: number | null;
  offensive_ft_rate: number | null;
  defensive_ft_rate: number | null;
  offensive_three_rate: number | null;
  defensive_three_rate: number | null;
  assist_rate: number | null;
  steal_pct: number | null;
  block_pct: number | null;
  foul_rate: number | null;
}

export type BaseRecord = SideCounts & SidePcts & DerivedMetrics & { total_possessions: number };

export interface PlayerRef { player_id: string; name: string; }

export interface LineupRecord extends BaseRecord {
  possession_share: number | null;
  reliability: number;
  adjusted_net_rating: number | null;
  team_id: string;
  team_name: string;
  lineup_key: string;
  lineup_size: number;
  player_ids: string[];
  players: PlayerRef[];
}

export type MetricKey = {
  [K in keyof LineupRecord]: LineupRecord[K] extends number | null ? K : never;
}[keyof LineupRecord];

export interface TeamBaseline extends BaseRecord { team_id: string; team_name: string; }

export interface LineupDetail {
  lineup: LineupRecord;
  team_baseline: TeamBaseline;
  league_baseline: BaseRecord;
  splits: {
    by_period: (BaseRecord & { period: number })[];
    by_opponent: (BaseRecord & { opponent_team_id: string; opponent_team_name: string })[];
    by_game: (BaseRecord & { game_id: string; date: string; opponent_team_id: string; opponent_team_name: string })[];
  };
}

export interface OnOffSlice {
  offensive_rating: number | null;
  defensive_rating: number | null;
  net_rating: number | null;
  plus_minus: number;
  total_possessions: number;
  minutes: number;
  offensive_efg_pct: number | null;
  defensive_efg_pct: number | null;
  offensive_tov_pct: number | null;
  defensive_tov_pct: number | null;
  offensive_oreb_pct: number | null;
  defensive_dreb_pct: number | null;
}

export interface Partner { player_id: string; name: string; net_rating: number; total_possessions: number; }

export interface PlayerImpact {
  player_id: string;
  name: string;
  team_id: string;
  team_name: string;
  on: OnOffSlice;
  off: OnOffSlice;
  on_off_net_diff: number | null;
  on_off_offensive_diff: number | null;
  on_off_defensive_diff: number | null;
  best_partner: Partner | null;
  worst_partner: Partner | null;
}

export interface MetaResponse {
  teams: { team_id: string; name: string }[];
  players: { player_id: string; name: string; team_id: string; active: boolean }[];
  games: { game_id: string; date: string; team_ids: string[]; team_names: string[] }[];
  date_range: { min: string | null; max: string | null };
  periods: number[];
  totals: { possessions: number; games: number; teams: number; active_players: number; five_man_lineups: number };
  team_baselines: TeamBaseline[];
  league_baseline: BaseRecord | null;
}

export interface PossessionFilterQuery { game_id?: string[]; period?: number[]; date_from?: string; date_to?: string; }
export interface TeamFilterQuery extends PossessionFilterQuery { team_id?: string[]; opponent_team_id?: string[]; }
export interface LineupQuery extends TeamFilterQuery {
  lineup_size?: number;
  include_players?: string[];
  min_possessions?: number;
  sort_by?: MetricKey;
  order?: 'asc' | 'desc';
  limit?: number;
}

export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };
