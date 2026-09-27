import { Component, computed, inject, signal } from '@angular/core';

import { RevealDirective } from '../../directives/reveal.directive';
import { PlayerImpact } from '../../models/lineup.model';
import { SegmentedComponent, SegmentedOption } from '../../shared/segmented/segmented.component';
import { LineupsStore } from '../../state/lineups.store';
import { fmtNet, fmtPct, fmtPm, fmtRating } from '../../utils/format';
import { teamColorVar } from '../../utils/team-color';

@Component({
  selector: 'app-player-impact',
  imports: [RevealDirective, SegmentedComponent],
  host: { class: 'theme-paper' },
  template: `
    <section class="player-impact" appReveal>
      <div class="wrap">
        <div class="section-index">06 — PLAYER IMPACT</div>

        <div class="player-impact__header">
          <div>
            <h2 class="t-h2">Who moves the needle.</h2>
            <p class="t-lede">
              Team net rating with each player on the floor, minus the same number with them off it.
            </p>
          </div>

          <!-- Controls -->
          <div class="player-impact__controls">
            <!-- Team Filter Chips -->
            <div class="chips-row">
              @for (team of teams(); track team.team_id) {
                <button
                  type="button"
                  class="chip"
                  [class.is-active]="isTeamSelected(team.team_id)"
                  (click)="toggleTeam(team.team_id)"
                >
                  <span
                    class="chip__dot"
                    [style.background]="getTeamColor(team.team_id)"
                  ></span>
                  <span>{{ team.name }}</span>
                </button>
              }
            </div>

            <!-- Sort Segmented -->
            <app-segmented
              [options]="sortOptions"
              [value]="sortMode()"
              (valueChange)="setSortMode($event)"
            />

            <!-- Min On-Court Possessions Slider -->
            <div class="slider-box">
              <span class="t-label">MIN ON POSS: {{ minPoss() }}</span>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                [value]="minPoss()"
                (input)="onMinPossInput($event)"
              />
            </div>
          </div>
        </div>

        <!-- Impact List -->
        <div class="impact-list">
          @for (p of filteredPlayers(); track p.player_id; let i = $index) {
            <div
              class="impact-card"
              [class.is-expanded]="expandedId() === p.player_id"
              [style.--i]="i"
              appReveal
              [revealDelay]="i * 20"
            >
              <!-- Main Row Grid -->
              <div
                class="impact-row"
                tabindex="0"
                role="button"
                [attr.aria-expanded]="expandedId() === p.player_id"
                (click)="toggleExpand(p.player_id)"
                (keydown.enter)="toggleExpand(p.player_id)"
              >
                <div class="impact-row__name">
                  <span class="t-num impact-row__idx">{{ i + 1 }}</span>
                  <span class="player-name">{{ p.name }}</span>
                </div>

                <div class="impact-row__team">
                  <span
                    class="team-dot"
                    [style.background]="getTeamColor(p.team_id)"
                  ></span>
                  <span class="t-label">{{ p.team_name }}</span>
                </div>

                <!-- Diverging Bar -->
                <div class="impact-row__bar-track">
                  <div class="bar-center-line"></div>
                  <div
                    class="bar-fill"
                    [class.is-pos]="(getMetricValue(p) ?? 0) >= 0"
                    [class.is-neg]="(getMetricValue(p) ?? 0) < 0"
                    [style.width.%]="barWidth(p)"
                  ></div>
                </div>

                <div class="impact-row__val t-num" [class.is-neg]="(getMetricValue(p) ?? 0) < 0">
                  {{ formatMetricValue(p) }}
                </div>
              </div>

              <!-- Expanded Details (Inline Grid Transition) -->
              <div class="impact-expand-wrapper">
                <div class="impact-details">
                  <div class="details-content">
                    <!-- On vs Off Mini Table -->
                    <table class="mini-on-off-table">
                      <thead>
                        <tr>
                          <th>STAT</th>
                          <th>ON</th>
                          <th>OFF</th>
                          <th>Δ DIFF</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td class="stat-name">ORTG</td>
                          <td>{{ fmtRating(p.on.offensive_rating) }}</td>
                          <td>{{ fmtRating(p.off.offensive_rating) }}</td>
                          <td [class.diff-good]="(p.on_off_offensive_diff ?? 0) >= 0" [class.diff-bad]="(p.on_off_offensive_diff ?? 0) < 0">
                            {{ fmtNet(p.on_off_offensive_diff) }}
                          </td>
                        </tr>
                        <tr>
                          <td class="stat-name">DRTG</td>
                          <td>{{ fmtRating(p.on.defensive_rating) }}</td>
                          <td>{{ fmtRating(p.off.defensive_rating) }}</td>
                          <td [class.diff-good]="(p.on_off_defensive_diff ?? 0) >= 0" [class.diff-bad]="(p.on_off_defensive_diff ?? 0) < 0">
                            {{ fmtNet(p.on_off_defensive_diff) }}
                          </td>
                        </tr>
                        <tr class="highlight-stat-row">
                          <td class="stat-name">NET</td>
                          <td>{{ fmtNet(p.on.net_rating) }}</td>
                          <td>{{ fmtNet(p.off.net_rating) }}</td>
                          <td [class.diff-good]="(p.on_off_net_diff ?? 0) >= 0" [class.diff-bad]="(p.on_off_net_diff ?? 0) < 0">
                            {{ fmtNet(p.on_off_net_diff) }}
                          </td>
                        </tr>
                        <tr>
                          <td class="stat-name">EFG%</td>
                          <td>{{ fmtPct(p.on.offensive_efg_pct) }}%</td>
                          <td>{{ fmtPct(p.off.offensive_efg_pct) }}%</td>
                          <td>{{ calcDiffPct(p.on.offensive_efg_pct, p.off.offensive_efg_pct) }}</td>
                        </tr>
                        <tr>
                          <td class="stat-name">TOV%</td>
                          <td>{{ fmtPct(p.on.offensive_tov_pct) }}%</td>
                          <td>{{ fmtPct(p.off.offensive_tov_pct) }}%</td>
                          <td>{{ calcDiffPct(p.off.offensive_tov_pct, p.on.offensive_tov_pct) }}</td>
                        </tr>
                        <tr>
                          <td class="stat-name">OREB%</td>
                          <td>{{ fmtPct(p.on.offensive_oreb_pct) }}%</td>
                          <td>{{ fmtPct(p.off.offensive_oreb_pct) }}%</td>
                          <td>{{ calcDiffPct(p.on.offensive_oreb_pct, p.off.offensive_oreb_pct) }}</td>
                        </tr>
                        <tr>
                          <td class="stat-name">DREB%</td>
                          <td>{{ fmtPct(p.on.defensive_dreb_pct) }}%</td>
                          <td>{{ fmtPct(p.off.defensive_dreb_pct) }}%</td>
                          <td>{{ calcDiffPct(p.on.defensive_dreb_pct, p.off.defensive_dreb_pct) }}</td>
                        </tr>
                        <tr>
                          <td class="stat-name">POSS</td>
                          <td>{{ p.on.total_possessions }}</td>
                          <td>{{ p.off.total_possessions }}</td>
                          <td>—</td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Partners & Links -->
                    <div class="details-sidebar">
                      @if (p.best_partner; as bp) {
                        <div class="partner-box">
                          <span class="t-label partner-box__title">BEST PARTNER</span>
                          <span class="partner-box__name">{{ bp.name }}</span>
                          <span class="partner-box__stat t-num">
                            {{ fmtNet(bp.net_rating) }} net in {{ bp.total_possessions }} poss
                          </span>
                        </div>
                      }

                      @if (p.worst_partner; as wp) {
                        <div class="partner-box">
                          <span class="t-label partner-box__title">TOUGHEST PAIRING</span>
                          <span class="partner-box__name">{{ wp.name }}</span>
                          <span class="partner-box__stat t-num">
                            {{ fmtNet(wp.net_rating) }} net in {{ wp.total_possessions }} poss
                          </span>
                        </div>
                      }

                      <button
                        type="button"
                        class="see-lineups-btn"
                        (click)="focusPlayerInExplorer(p)"
                      >
                        See their lineups →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
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

    .player-impact {
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

      &__controls {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
    }

    .chips-row {
      display: flex;
      gap: 6px;
    }

    .chip {
      @include v.label;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--line);
      border-radius: 2px;
      background: var(--surface-2);
      color: var(--fg-muted);
      cursor: pointer;
      transition: all 0.2s;

      &.is-active {
        background: var(--fg);
        color: var(--surface);
        font-weight: 600;
        border-color: var(--fg);
      }

      &__dot {
        width: 8px;
        height: 8px;
        border-radius: 1px;
      }
    }

    .slider-box {
      display: flex;
      flex-direction: column;
      gap: 4px;

      input[type="range"] {
        width: 100px;
        accent-color: var(--accent);
        cursor: pointer;
      }
    }

    .impact-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .impact-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
      transition: border-color 0.2s, background 0.2s;

      &:hover {
        border-color: var(--fg-muted);
      }

      &.is-expanded {
        border-color: var(--accent-fg);
        background: var(--surface-2);
      }
    }

    .impact-row {
      display: grid;
      grid-template-columns: 240px 140px 1fr 90px;
      align-items: center;
      gap: 20px;
      padding: 14px 20px;
      cursor: pointer;
      outline: none;

      @include v.down(v.$bp-md) {
        grid-template-columns: 180px 1fr 70px;
      }

      @include v.down(v.$bp-sm) {
        grid-template-columns: 1fr 80px;
        gap: 12px;
      }

      &__name {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }

      &__idx {
        font-size: 13px;
        color: var(--fg-muted);
        width: 20px;
      }

      .player-name {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--fg);
      }

      &__team {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-muted);

        @include v.down(v.$bp-sm) {
          display: none;
        }
      }

      .team-dot {
        width: 8px;
        height: 8px;
        border-radius: 1px;
      }

      &__bar-track {
        position: relative;
        height: 8px;
        background: var(--paper-3);
        border-radius: 2px;
        overflow: hidden;

        @include v.down(v.$bp-sm) {
          display: none;
        }
      }

      .bar-center-line {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 1px;
        background: var(--fg-muted);
        z-index: 2;
      }

      .bar-fill {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 1px;
        transition: width 0.9s var(--ease-out);

        &.is-pos {
          left: 50%;
          background: var(--accent);
        }

        &.is-neg {
          right: 50%;
          background: var(--neg);
        }
      }

      &__val {
        text-align: right;
        font-size: 17px;
        color: var(--accent-fg);

        &.is-neg {
          color: var(--neg);
        }
      }
    }

    .impact-expand-wrapper {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.35s var(--ease-out);

      .is-expanded & {
        grid-template-rows: 1fr;
      }
    }

    .impact-details {
      overflow: hidden;
    }

    .details-content {
      padding: 16px 20px 24px 20px;
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 32px;

      @include v.down(v.$bp-md) {
        grid-template-columns: 1fr;
      }
    }

    .mini-on-off-table {
      width: 100%;
      border-collapse: collapse;

      th {
        @include v.label;
        font-size: 10px;
        color: var(--fg-muted);
        text-align: right;
        padding: 6px 12px;
        border-bottom: 1px solid var(--line);

        &:first-child {
          text-align: left;
        }
      }

      td {
        font-family: var(--font-mono);
        font-size: 12px;
        text-align: right;
        padding: 6px 12px;
        border-bottom: 1px solid var(--line);
      }

      .stat-name {
        @include v.label;
        font-size: 11px;
        color: var(--fg);
        text-align: left;
      }

      .highlight-stat-row td {
        font-weight: 700;
        background: rgba(0, 0, 0, 0.03);
      }

      .diff-good {
        color: var(--accent-fg);
      }

      .diff-bad {
        color: var(--neg);
      }
    }

    .details-sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
      justify-content: center;
    }

    .partner-box {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      &__title {
        font-size: 9px;
        color: var(--fg-muted);
      }

      &__name {
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 600;
        color: var(--fg);
      }

      &__stat {
        font-size: 11px;
        color: var(--fg-muted);
      }
    }

    .see-lineups-btn {
      @include v.label;
      background: transparent;
      border: 1px solid var(--accent);
      color: var(--accent-fg);
      padding: 8px 16px;
      border-radius: var(--radius);
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;

      &:hover {
        background: var(--accent);
        color: var(--ink);
      }
    }
  `],
})
export class PlayerImpactComponent {
  private readonly store = inject(LineupsStore);

  readonly fmtNet = fmtNet;
  readonly fmtRating = fmtRating;
  readonly fmtPct = fmtPct;
  readonly fmtPm = fmtPm;

  readonly playerImpact = this.store.playerImpact;
  readonly meta = this.store.meta;

  readonly selectedTeams = signal<string[]>([]);
  readonly sortMode = signal<'diff' | 'on_net' | 'pm'>('diff');
  readonly minPoss = signal(40);
  readonly expandedId = signal<string | null>(null);

  readonly sortOptions: SegmentedOption<string>[] = [
    { value: 'diff', label: 'On / off' },
    { value: 'on_net', label: 'On-court net' },
    { value: 'pm', label: '+/−' },
  ];

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

  setSortMode(mode: string): void {
    this.sortMode.set(mode as 'diff' | 'on_net' | 'pm');
  }

  onMinPossInput(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.minPoss.set(val);
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  readonly filteredPlayers = computed<PlayerImpact[]>(() => {
    const pi = this.playerImpact();
    if (pi.status !== 'ready') return [];

    const sel = this.selectedTeams();
    const minP = this.minPoss();
    const mode = this.sortMode();

    const list = pi.data.filter((p) => {
      if (p.on.total_possessions < minP) return false;
      if (sel.length > 0 && !sel.includes(p.team_id)) return false;
      return true;
    });

    list.sort((a, b) => {
      if (mode === 'diff') {
        const da = a.on_off_net_diff ?? -999;
        const db = b.on_off_net_diff ?? -999;
        return db - da;
      } else if (mode === 'on_net') {
        const na = a.on.net_rating ?? -999;
        const nb = b.on.net_rating ?? -999;
        return nb - na;
      } else {
        return b.on.plus_minus - a.on.plus_minus;
      }
    });

    return list;
  });

  readonly maxAbsMetric = computed(() => {
    const list = this.filteredPlayers();
    let maxV = 10;
    for (const p of list) {
      const v = Math.abs(this.getMetricValue(p) ?? 0);
      maxV = Math.max(maxV, v);
    }
    return maxV;
  });

  getMetricValue(p: PlayerImpact): number | null {
    const m = this.sortMode();
    if (m === 'diff') return p.on_off_net_diff;
    if (m === 'on_net') return p.on.net_rating;
    return p.on.plus_minus;
  }

  formatMetricValue(p: PlayerImpact): string {
    const m = this.sortMode();
    if (m === 'diff') return fmtNet(p.on_off_net_diff);
    if (m === 'on_net') return fmtNet(p.on.net_rating);
    return fmtPm(p.on.plus_minus);
  }

  barWidth(p: PlayerImpact): number {
    const val = this.getMetricValue(p);
    if (val == null) return 0;
    const maxV = this.maxAbsMetric();
    return Math.min(50, (Math.abs(val) / maxV) * 50);
  }

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--fg-muted)';
  }

  calcDiffPct(onVal: number | null, offVal: number | null): string {
    if (onVal == null || offVal == null) return '—';
    const diff = (onVal - offVal) * 100;
    return fmtNet(diff) + '%';
  }

  focusPlayerInExplorer(p: PlayerImpact): void {
    this.store.focusExplorer({
      size: 5,
      players: [p.player_id],
      teams: [p.team_id],
    });
  }
}
