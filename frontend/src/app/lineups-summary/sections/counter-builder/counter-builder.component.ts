import { Component, computed, inject, signal } from '@angular/core';

import { RevealDirective } from '../../directives/reveal.directive';
import { LineupRecord, MetricKey } from '../../models/lineup.model';
import { SegmentedComponent, SegmentedOption } from '../../shared/segmented/segmented.component';
import { LineupsStore } from '../../state/lineups.store';
import { ScoredLineup, Weight, scoreLineups } from '../../utils/counter-score';
import { METRIC_MAP, formatMetric } from '../../utils/metrics';
import { teamColorVar } from '../../utils/team-color';

interface PresetConfig {
  label: string;
  weights: Record<string, number>;
}

const PRESETS: Record<string, PresetConfig> = {
  glass: {
    label: 'vs. Big glass-crashers',
    weights: {
      defensive_dreb_pct: 3,
      offensive_oreb_pct: 1.5,
      offensive_three_rate: 1.5,
      offensive_efg_pct: 1,
      offensive_tov_pct: 1,
      pace: 0.5,
      defensive_rating: 1,
    },
  },
  stops: {
    label: 'Need stops',
    weights: {
      defensive_rating: 3,
      defensive_efg_pct: 2,
      defensive_tov_pct: 1,
      steal_pct: 1,
      block_pct: 1,
      defensive_dreb_pct: 1,
    },
  },
  buckets: {
    label: 'Need buckets',
    weights: {
      offensive_rating: 3,
      offensive_efg_pct: 2,
      offensive_tov_pct: 1,
      offensive_ft_rate: 1,
    },
  },
  lead: {
    label: 'Protect a lead',
    weights: {
      offensive_tov_pct: 2,
      defensive_rating: 2,
      pace: 1,
      offensive_ft_rate: 1,
      defensive_dreb_pct: 1,
    },
  },
};

// All metrics participating in the Counter Builder union
const PARTICIPATING_KEYS: { key: MetricKey; better: 'high' | 'low' }[] = [
  { key: 'defensive_dreb_pct', better: 'high' },
  { key: 'offensive_oreb_pct', better: 'high' },
  { key: 'offensive_three_rate', better: 'high' },
  { key: 'offensive_efg_pct', better: 'high' },
  { key: 'offensive_tov_pct', better: 'low' },
  { key: 'pace', better: 'high' },
  { key: 'defensive_rating', better: 'low' },
  { key: 'defensive_efg_pct', better: 'low' },
  { key: 'defensive_tov_pct', better: 'high' },
  { key: 'steal_pct', better: 'high' },
  { key: 'block_pct', better: 'high' },
  { key: 'offensive_rating', better: 'high' },
  { key: 'offensive_ft_rate', better: 'high' },
];

@Component({
  selector: 'app-counter-builder',
  imports: [RevealDirective, SegmentedComponent],
  template: `
    <section class="counter-builder" appReveal>
      <div class="wrap">
        <div class="section-index">07 — THE COUNTER</div>

        <div class="counter-builder__header">
          <div>
            <h2 class="t-h2">Build the counter.</h2>
            <p class="t-lede">
              Pick a problem. Weight what matters. The ranking shows its work.
            </p>
          </div>

          <!-- Preset Switcher -->
          <div class="preset-switcher">
            <app-segmented
              [options]="presetOptions()"
              [value]="selectedPreset()"
              (valueChange)="onPresetChange($event)"
            />
          </div>
        </div>

        <div class="counter-builder__grid">
          <!-- Left: Weight Sliders Panel -->
          <div class="weights-panel">
            <div class="weights-header">
              <span class="t-label">METRIC WEIGHTS (0.0 — 3.0)</span>
              <button type="button" class="reset-weights-btn" (click)="resetToDefaultPreset()">Reset</button>
            </div>

            <div class="weights-list">
              @for (item of participatingMetrics(); track item.key) {
                <div class="weight-control">
                  <div class="weight-control__label">
                    <span class="weight-name">{{ item.def.label }}</span>
                    <span class="weight-val t-num">{{ getWeight(item.key) }}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.5"
                    [value]="getWeight(item.key)"
                    (input)="onWeightSlider(item.key, $event)"
                  />
                </div>
              }
            </div>

            <!-- Additional Filters -->
            <div class="panel-filters">
              <div class="filter-row">
                <span class="t-label">MIN POSS: {{ minPoss() }}</span>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  [value]="minPoss()"
                  (input)="onMinPossInput($event)"
                />
              </div>

              <div class="team-filter-chips">
                @for (team of teams(); track team.team_id) {
                  <button
                    type="button"
                    class="chip"
                    [class.is-active]="isTeamSelected(team.team_id)"
                    (click)="toggleTeam(team.team_id)"
                  >
                    <span>{{ team.name }}</span>
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Right: Output Ranked Top 10 with Contribution Bars -->
          <div class="ranked-results">
            @if (scoredLineups().length > 0) {
              <!-- Auto Sentence for #1 -->
              @if (topAutoSentence(); as sent) {
                <div class="auto-sentence">
                  <span class="t-label auto-sentence__badge">TOP MATCH</span>
                  <p class="auto-sentence__text">{{ sent }}</p>
                </div>
              }

              <div class="ranked-list">
                @for (item of scoredLineups().slice(0, 10); track item.record.lineup_key; let i = $index) {
                  <div
                    class="ranked-item"
                    (click)="openDrawer(item.record)"
                    tabindex="0"
                    (keydown.enter)="openDrawer(item.record)"
                  >
                    <!-- Top Info: Rank, Names, Team, Score -->
                    <div class="ranked-item__info">
                      <div class="ranked-item__rank t-num">#{{ i + 1 }}</div>
                      <div class="ranked-item__main">
                        <span class="ranked-item__names">{{ formatNames(item.record) }}</span>
                        <div class="ranked-item__meta">
                          <span
                            class="team-dot"
                            [style.background]="getTeamColor(item.record.team_id)"
                          ></span>
                          <span class="t-label">{{ item.record.team_name }}</span>
                          <span class="t-label">· {{ item.record.total_possessions }} POSS</span>
                        </div>
                      </div>
                      <div class="ranked-item__score">
                        <span class="score-val t-num">{{ formatScore(item.score) }}</span>
                        <span class="t-label score-label">SCORE</span>
                      </div>
                    </div>

                    <!-- Stacked Contribution Bar (100% width = 100 score points) -->
                    <div class="contrib-bar-track">
                      @for (part of item.parts; track part.key; let pIdx = $index) {
                        @if (part.value > 0) {
                          <div
                            class="contrib-segment"
                            [style.width.%]="part.value * 100"
                            [style.opacity]="segmentOpacity(pIdx)"
                            [title]="segmentTooltip(part, item.record)"
                          ></div>
                        }
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">
                <p>No units match the minimum possessions criteria.</p>
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    @use '../../../../vars.scss' as v;

    :host {
      display: block;
      background: var(--surface);
      color: var(--fg);
    }

    .wrap {
      max-width: var(--maxw);
      margin: 0 auto;
      padding: 0 var(--gutter);
    }

    .section-index {
      @include v.label;
      color: var(--fg-muted);
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 24px 0 16px 0;
      border-top: 1px solid var(--line);
    }

    .counter-builder {
      padding-bottom: 80px;

      &__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 24px;
        margin-bottom: 32px;

        @include v.down(v.$bp-md) {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      &__grid {
        display: grid;
        grid-template-columns: 4fr 8fr;
        gap: 32px;
        align-items: start;

        @include v.down(v.$bp-md) {
          grid-template-columns: 1fr;
        }
      }
    }

    .weights-panel {
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .weights-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--fg-muted);
      font-size: 11px;
    }

    .reset-weights-btn {
      @include v.label;
      background: transparent;
      border: none;
      color: var(--accent-fg);
      cursor: pointer;
      font-size: 11px;

      &:hover {
        text-decoration: underline;
      }
    }

    .weights-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 440px;
      overflow-y: auto;
      padding-right: 6px;
    }

    .weight-control {
      display: flex;
      flex-direction: column;
      gap: 4px;

      &__label {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--fg);
      }

      .weight-val {
        color: var(--accent-fg);
      }

      input[type="range"] {
        accent-color: var(--accent);
        cursor: pointer;
      }
    }

    .panel-filters {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }

    .filter-row {
      display: flex;
      justify-content: space-between;
      align-items: center;

      input[type="range"] {
        width: 100px;
        accent-color: var(--accent);
        cursor: pointer;
      }
    }

    .team-filter-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .chip {
      @include v.label;
      font-size: 10px;
      padding: 4px 8px;
      border: 1px solid var(--line);
      border-radius: 2px;
      background: var(--ink-3);
      color: var(--fg-muted);
      cursor: pointer;

      &.is-active {
        background: var(--fg);
        color: var(--surface);
      }
    }

    .auto-sentence {
      background: rgba(0, 122, 193, 0.1);
      border: 1px solid var(--accent);
      border-radius: var(--radius);
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 6px;

      &__badge {
        color: var(--accent-fg);
        font-size: 10px;
      }

      &__text {
        font-family: var(--font-display);
        font-size: 16px;
        color: var(--fg);
        line-height: 1.4;
      }
    }

    .ranked-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ranked-item {
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px 20px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 12px;
      outline: none;
      transition: border-color 0.2s, transform 0.2s;

      &:hover,
      &:focus-visible {
        border-color: var(--accent-fg);
        transform: translateY(-2px);
      }

      &__info {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      &__rank {
        font-size: 20px;
        color: var(--fg-muted);
        width: 32px;
      }

      &__main {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      &__names {
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 600;
        color: var(--fg);
      }

      &__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-muted);
        font-size: 11px;
      }

      .team-dot {
        width: 8px;
        height: 8px;
        border-radius: 1px;
      }

      &__score {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .score-val {
        font-size: 24px;
        color: var(--accent-fg);
        line-height: 1;
      }

      .score-label {
        font-size: 9px;
        color: var(--fg-muted);
        margin-top: 2px;
      }
    }

    .contrib-bar-track {
      width: 100%;
      height: 8px;
      background: var(--ink-3);
      border-radius: 2px;
      display: flex;
      overflow: hidden;
    }

    .contrib-segment {
      height: 100%;
      background: var(--accent-fg);
      transition: width 0.3s;
    }

    .empty-state {
      padding: 48px;
      text-align: center;
      color: var(--fg-muted);
    }
  `],
})
export class CounterBuilderComponent {
  private readonly store = inject(LineupsStore);

  readonly leagueFive = this.store.leagueFive;
  readonly meta = this.store.meta;

  readonly selectedPreset = signal<string>('glass');
  readonly currentWeights = signal<Record<string, number>>({ ...PRESETS['glass'].weights });
  readonly minPoss = signal(20);
  readonly selectedTeams = signal<string[]>([]);

  readonly participatingMetrics = computed(() => {
    return PARTICIPATING_KEYS.map((item) => ({
      key: item.key,
      better: item.better,
      def: METRIC_MAP.get(item.key)!,
    }));
  });

  readonly presetOptions = computed<SegmentedOption<string>[]>(() => {
    const list: SegmentedOption<string>[] = Object.entries(PRESETS).map(([k, p]) => ({
      value: k,
      label: p.label,
    }));
    if (this.selectedPreset() === 'custom') {
      list.push({ value: 'custom', label: 'Custom' });
    }
    return list;
  });

  readonly teams = computed(() => {
    const m = this.meta();
    return m.status === 'ready' ? m.data.teams : [];
  });

  isTeamSelected(teamId: string): boolean {
    const sel = this.selectedTeams();
    return sel.length === 0 || sel.includes(teamId);
  }

  toggleTeam(teamId: string): void {
    const all = this.teams().map((t) => t.team_id);
    const current = this.selectedTeams().length === 0 ? all : [...this.selectedTeams()];

    if (current.includes(teamId)) {
      if (current.length === 1) return;
      this.selectedTeams.set(current.filter((id) => id !== teamId));
    } else {
      const next = [...current, teamId];
      this.selectedTeams.set(next.length === all.length ? [] : next);
    }
  }

  getWeight(key: string): number {
    return this.currentWeights()[key] ?? 0;
  }

  onPresetChange(key: string): void {
    if (PRESETS[key]) {
      this.selectedPreset.set(key);
      this.currentWeights.set({ ...PRESETS[key].weights });
    }
  }

  resetToDefaultPreset(): void {
    this.onPresetChange('glass');
  }

  onWeightSlider(key: MetricKey, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.selectedPreset.set('custom');
    this.currentWeights.update((prev) => ({ ...prev, [key]: val }));
  }

  onMinPossInput(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.minPoss.set(val);
  }

  readonly scoredLineups = computed<ScoredLineup[]>(() => {
    const l5 = this.leagueFive();
    if (l5.status !== 'ready') return [];

    const minP = this.minPoss();
    const selTeams = this.selectedTeams();
    const records = l5.data.filter((r) => {
      if (r.total_possessions < minP) return false;
      if (selTeams.length > 0 && !selTeams.includes(r.team_id)) return false;
      return true;
    });

    const weightsObj = this.currentWeights();
    const weights: Weight[] = PARTICIPATING_KEYS.map((item) => ({
      key: item.key,
      better: item.better,
      weight: weightsObj[item.key] ?? 0,
    }));

    return scoreLineups(records, weights);
  });

  readonly topAutoSentence = computed<string | null>(() => {
    const scored = this.scoredLineups();
    if (scored.length === 0) return null;

    const top = scored[0];
    const sortedParts = [...top.parts].sort((a, b) => b.value - a.value);
    if (sortedParts.length < 2 || sortedParts[0].value <= 0) return null;

    const def1 = METRIC_MAP.get(sortedParts[0].key);
    const def2 = METRIC_MAP.get(sortedParts[1].key);

    const l1 = def1 ? def1.label.toLowerCase() : String(sortedParts[0].key);
    const l2 = def2 ? def2.label.toLowerCase() : String(sortedParts[1].key);

    return `Ranks first on the strength of ${l1} and ${l2}.`;
  });

  formatNames(record: LineupRecord): string {
    return record.players.map((p) => p.name).join(' · ');
  }

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--accent-fg)';
  }

  formatScore(score: number): string {
    return (score * 100).toFixed(1);
  }

  segmentOpacity(idx: number): number {
    const opacities = [1, 0.7, 0.45];
    return opacities[idx % 3];
  }

  segmentTooltip(part: { key: MetricKey; value: number }, record: LineupRecord): string {
    const def = METRIC_MAP.get(part.key);
    if (!def) return '';
    const formatted = formatMetric(def, record[def.key] as number);
    return `${def.label}: ${formatted}`;
  }

  openDrawer(record: LineupRecord): void {
    this.store.openGroup(record.player_ids);
  }
}
