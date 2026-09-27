import { LineupRecord, MetricKey } from '../models/lineup.model';
import { percentileRanks } from './percentile';

export interface Weight {
  key: MetricKey;
  weight: number;
  better: 'high' | 'low';
}

export interface ScoredLineup {
  record: LineupRecord;
  score: number;
  parts: { key: MetricKey; value: number }[];
}

export function scoreLineups(records: LineupRecord[], weights: Weight[]): ScoredLineup[] {
  const active = weights.filter((w) => w.weight > 0);
  const total = active.reduce((s, w) => s + w.weight, 0) || 1;
  const ranks = new Map(active.map((w) => [w.key, percentileRanks(records.map((r) => r[w.key] as number | null))]));
  return records
    .map((record, i) => {
      const parts = active.map((w) => {
        const pct = ranks.get(w.key)![i] ?? 0.5;
        const oriented = w.better === 'high' ? pct : 1 - pct;
        return { key: w.key, value: (oriented * w.weight) / total };
      });
      return { record, parts, score: parts.reduce((s, p) => s + p.value, 0) };
    })
    .sort((a, b) => b.score - a.score);
}
