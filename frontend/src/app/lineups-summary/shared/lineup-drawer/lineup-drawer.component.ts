import { A11yModule } from '@angular/cdk/a11y';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { line } from 'd3-shape';
import { scaleLinear, scalePoint } from 'd3-scale';
import { of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { LineupsService } from '../../../_services/lineups.service';
import { LineupDetail, LineupRecord, Loadable } from '../../models/lineup.model';
import { LineupsStore } from '../../state/lineups.store';
import { fmtNet, fmtPct, fmtRating } from '../../utils/format';
import { teamColorVar } from '../../utils/team-color';

@Component({
  selector: 'app-lineup-drawer',
  imports: [A11yModule],
  template: `
    @if (isOpen()) {
      <div class="drawer-backdrop" (click)="close()"></div>

      <div
        class="drawer-panel theme-paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
      >
        <!-- Top Action / Close Bar -->
        <div class="drawer-header">
          <div class="drawer-header__team">
            @if (detail(); as d) {
              @if (d.status === 'ready') {
                <span
                  class="team-dot"
                  [style.background]="getTeamColor(d.data.lineup.team_id)"
                ></span>
                <span class="t-label">{{ d.data.lineup.team_name }}</span>
              }
            }
          </div>
          <button type="button" class="drawer-close-btn" (click)="close()">
            Close ×
          </button>
        </div>

        @if (detail(); as d) {
          @if (d.status === 'loading') {
            <div class="drawer-body drawer-body--loading">
              <div class="drawer-skeleton"></div>
            </div>
          } @else if (d.status === 'error') {
            <div class="drawer-body">
              <div class="drawer-error">
                <span class="t-label">NOTICE</span>
                <p>These players never shared the floor under the current filters.</p>
              </div>
            </div>
          } @else if (d.status === 'ready') {
            <div class="drawer-body">
              <!-- Names List -->
              <h2 id="drawer-title" class="drawer-names">
                @for (p of d.data.lineup.players; track p.player_id) {
                  <span class="drawer-name-item">{{ p.name }}</span>
                }
              </h2>

              <!-- 5 KPI Row -->
              <div class="kpi-row">
                <div class="kpi-cell">
                  <span class="kpi-cell__val t-num" [class.is-neg]="(d.data.lineup.net_rating ?? 0) < 0">
                    {{ fmtNet(d.data.lineup.net_rating) }}
                  </span>
                  <span class="kpi-cell__label t-label">NET</span>
                  <span class="kpi-cell__sub" [class.is-good]="diffNet(d.data) >= 0">
                    vs team {{ fmtNet(diffNet(d.data)) }}
                  </span>
                </div>

                <div class="kpi-cell">
                  <span class="kpi-cell__val t-num">{{ fmtRating(d.data.lineup.offensive_rating) }}</span>
                  <span class="kpi-cell__label t-label">ORTG</span>
                  <span class="kpi-cell__sub" [class.is-good]="diffOrtg(d.data) >= 0">
                    vs team {{ fmtNet(diffOrtg(d.data)) }}
                  </span>
                </div>

                <div class="kpi-cell">
                  <span class="kpi-cell__val t-num">{{ fmtRating(d.data.lineup.defensive_rating) }}</span>
                  <span class="kpi-cell__label t-label">DRTG</span>
                  <span class="kpi-cell__sub" [class.is-good]="diffDrtg(d.data) >= 0">
                    vs team {{ fmtNet(diffDrtg(d.data)) }}
                  </span>
                </div>

                <div class="kpi-cell">
                  <span class="kpi-cell__val t-num">{{ d.data.lineup.total_possessions }}</span>
                  <span class="kpi-cell__label t-label">POSS</span>
                  <span class="kpi-cell__sub">—</span>
                </div>

                <div class="kpi-cell">
                  <span class="kpi-cell__val t-num">{{ d.data.lineup.minutes.toFixed(1) }}</span>
                  <span class="kpi-cell__label t-label">MIN</span>
                  <span class="kpi-cell__sub">—</span>
                </div>
              </div>

              <!-- Four Factors Mirror -->
              <div class="drawer-section">
                <h3 class="section-title t-label">FOUR FACTORS MIRROR</h3>
                <div class="factors-mirror">
                  <div class="mirror-headers">
                    <span class="t-label">OUR OFFENSE</span>
                    <span class="t-label">OPP OFFENSE</span>
                  </div>

                  <!-- eFG% -->
                  <div class="mirror-row">
                    <span class="mirror-val mirror-val--left t-num">{{ fmtPct(d.data.lineup.offensive_efg_pct) }}%</span>
                    <div class="mirror-bars">
                      <div
                        class="mirror-bar mirror-bar--left"
                        [class.is-winner]="(d.data.lineup.offensive_efg_pct ?? 0) >= (d.data.lineup.defensive_efg_pct ?? 0)"
                        [style.width.%]="mirrorWidth(d.data.lineup.offensive_efg_pct)"
                      ></div>
                      <div
                        class="mirror-bar mirror-bar--right"
                        [class.is-winner]="(d.data.lineup.defensive_efg_pct ?? 0) > (d.data.lineup.offensive_efg_pct ?? 0)"
                        [style.width.%]="mirrorWidth(d.data.lineup.defensive_efg_pct)"
                      ></div>
                    </div>
                    <span class="mirror-val mirror-val--right t-num">{{ fmtPct(d.data.lineup.defensive_efg_pct) }}%</span>
                  </div>

                  <!-- TOV% -->
                  <div class="mirror-row">
                    <span class="mirror-val mirror-val--left t-num">{{ fmtPct(d.data.lineup.offensive_tov_pct) }}%</span>
                    <div class="mirror-bars">
                      <div
                        class="mirror-bar mirror-bar--left"
                        [class.is-winner]="(d.data.lineup.offensive_tov_pct ?? 1) <= (d.data.lineup.defensive_tov_pct ?? 0)"
                        [style.width.%]="mirrorWidth(d.data.lineup.offensive_tov_pct)"
                      ></div>
                      <div
                        class="mirror-bar mirror-bar--right"
                        [class.is-winner]="(d.data.lineup.defensive_tov_pct ?? 0) < (d.data.lineup.offensive_tov_pct ?? 1)"
                        [style.width.%]="mirrorWidth(d.data.lineup.defensive_tov_pct)"
                      ></div>
                    </div>
                    <span class="mirror-val mirror-val--right t-num">{{ fmtPct(d.data.lineup.defensive_tov_pct) }}%</span>
                  </div>

                  <!-- REB% -->
                  <div class="mirror-row">
                    <span class="mirror-val mirror-val--left t-num">{{ fmtPct(d.data.lineup.offensive_oreb_pct) }}%</span>
                    <div class="mirror-bars">
                      <div
                        class="mirror-bar mirror-bar--left"
                        [class.is-winner]="(d.data.lineup.offensive_oreb_pct ?? 0) >= (oppOreb(d.data.lineup.defensive_dreb_pct) ?? 0)"
                        [style.width.%]="mirrorWidth(d.data.lineup.offensive_oreb_pct)"
                      ></div>
                      <div
                        class="mirror-bar mirror-bar--right"
                        [class.is-winner]="(oppOreb(d.data.lineup.defensive_dreb_pct) ?? 0) > (d.data.lineup.offensive_oreb_pct ?? 0)"
                        [style.width.%]="mirrorWidth(oppOreb(d.data.lineup.defensive_dreb_pct))"
                      ></div>
                    </div>
                    <span class="mirror-val mirror-val--right t-num">{{ fmtPct(oppOreb(d.data.lineup.defensive_dreb_pct)) }}%</span>
                  </div>

                  <!-- FTr -->
                  <div class="mirror-row">
                    <span class="mirror-val mirror-val--left t-num">{{ fmtPct(d.data.lineup.offensive_ft_rate) }}%</span>
                    <div class="mirror-bars">
                      <div
                        class="mirror-bar mirror-bar--left"
                        [class.is-winner]="(d.data.lineup.offensive_ft_rate ?? 0) >= (d.data.lineup.defensive_ft_rate ?? 0)"
                        [style.width.%]="mirrorWidth(d.data.lineup.offensive_ft_rate)"
                      ></div>
                      <div
                        class="mirror-bar mirror-bar--right"
                        [class.is-winner]="(d.data.lineup.defensive_ft_rate ?? 0) > (d.data.lineup.offensive_ft_rate ?? 0)"
                        [style.width.%]="mirrorWidth(d.data.lineup.defensive_ft_rate)"
                      ></div>
                    </div>
                    <span class="mirror-val mirror-val--right t-num">{{ fmtPct(d.data.lineup.defensive_ft_rate) }}%</span>
                  </div>
                </div>
              </div>

              <!-- By Quarter Diverging Bars -->
              <div class="drawer-section">
                <h3 class="section-title t-label">PERFORMANCE BY QUARTER</h3>
                <div class="quarter-grid">
                  @for (q of [1, 2, 3, 4]; track q) {
                    <div class="quarter-col">
                      @if (getQuarterData(d.data, q); as qd) {
                        <span class="t-num quarter-val" [class.is-neg]="(qd.net_rating ?? 0) < 0">
                          {{ fmtNet(qd.net_rating) }}
                        </span>
                        <div class="quarter-bar-track">
                          <div
                            class="quarter-bar"
                            [class.is-pos]="(qd.net_rating ?? 0) >= 0"
                            [class.is-neg]="(qd.net_rating ?? 0) < 0"
                            [style.height.%]="quarterBarHeight(qd.net_rating)"
                          ></div>
                        </div>
                        <span class="t-label quarter-label">Q{{ q }}</span>
                        <span class="t-label quarter-poss">{{ qd.total_possessions }} POSS</span>
                      } @else {
                        <span class="t-num quarter-val">—</span>
                        <div class="quarter-bar-track"></div>
                        <span class="t-label quarter-label">Q{{ q }}</span>
                        <span class="t-label quarter-poss">0 POSS</span>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Game By Game Sparkline -->
              @if (d.data.splits.by_game.length > 0) {
                <div class="drawer-section">
                  <h3 class="section-title t-label">GAME BY GAME NET RATING</h3>
                  <div class="sparkline-wrapper">
                    <svg viewBox="0 0 460 120" class="sparkline-svg">
                      <line x1="20" x2="440" [attr.y1]="sparkZeroY()" [attr.y2]="sparkZeroY()" class="zero-line" />
                      <path [attr.d]="sparkLinePath()" class="spark-path" />
                      @for (pt of sparkPoints(); track pt.game_id) {
                        <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4" class="spark-dot" />
                        <text [attr.x]="pt.x" [attr.y]="pt.y - 8" class="spark-val t-num" text-anchor="middle">
                          {{ fmtNet(pt.net_rating) }}
                        </text>
                        <text [attr.x]="pt.x" y="112" class="spark-label t-label" text-anchor="middle">
                          {{ formatGameDate(pt.date) }}
                        </text>
                      }
                    </svg>
                  </div>
                </div>
              }

              <!-- By Opponent Table -->
              <div class="drawer-section">
                <h3 class="section-title t-label">VS OPPONENTS</h3>
                <table class="opp-table">
                  <thead>
                    <tr>
                      <th>OPPONENT</th>
                      <th>POSS</th>
                      <th>ORTG</th>
                      <th>DRTG</th>
                      <th>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (opp of d.data.splits.by_opponent; track opp.opponent_team_id) {
                      <tr>
                        <td class="opp-name">{{ opp.opponent_team_name }}</td>
                        <td>{{ opp.total_possessions }}</td>
                        <td>{{ fmtRating(opp.offensive_rating) }}</td>
                        <td>{{ fmtRating(opp.defensive_rating) }}</td>
                        <td class="t-num" [class.is-neg]="(opp.net_rating ?? 0) < 0">
                          {{ fmtNet(opp.net_rating) }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Action Buttons -->
              <div class="drawer-actions">
                <button
                  type="button"
                  class="action-btn action-btn--compare"
                  (click)="toggleCompare(d.data.lineup)"
                >
                  {{ isCompared(d.data.lineup) ? 'Remove from compare' : 'Add to compare' }}
                </button>

                <button
                  type="button"
                  class="action-btn action-btn--filter"
                  (click)="filterToGroup(d.data.lineup)"
                >
                  Filter Explorer to this group →
                </button>
              </div>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    @use '../../../../vars.scss' as v;

    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(11, 13, 16, 0.55);
      z-index: 95;
      backdrop-filter: blur(2px);
    }

    .drawer-panel {
      position: fixed;
      inset: 0 0 0 auto;
      width: min(560px, 100vw);
      background: var(--surface);
      color: var(--fg);
      z-index: 100;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      transform: translateX(0);
      animation: drawerSlide 0.45s var(--ease-out);
    }

    @keyframes drawerSlide {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      background: var(--surface);
      z-index: 10;

      &__team {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .team-dot {
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .drawer-close-btn {
      @include v.label;
      background: transparent;
      border: none;
      color: var(--fg-muted);
      cursor: pointer;
      font-size: 12px;

      &:hover {
        color: var(--fg);
      }
    }

    .drawer-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 32px;

      &--loading {
        min-height: 400px;
      }
    }

    .drawer-skeleton {
      width: 100%;
      height: 300px;
      background: var(--surface-2);
      border-radius: var(--radius);
      animation: pulse 1.6s ease-in-out infinite alternate;
    }

    .drawer-error {
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--fg-muted);
    }

    .drawer-names {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 700;
      line-height: 1.2;
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 16px 0;
    }

    .kpi-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      border-right: 1px solid var(--line);
      padding-right: 8px;

      &:last-child {
        border-right: none;
      }

      &__val {
        font-size: 20px;
        color: var(--accent-fg);

        &.is-neg {
          color: var(--neg);
        }
      }

      &__label {
        font-size: 10px;
        color: var(--fg-muted);
      }

      &__sub {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--neg);

        &.is-good {
          color: var(--accent-fg);
        }
      }
    }

    .drawer-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-title {
      font-size: 10px;
      color: var(--fg-muted);
    }

    .factors-mirror {
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mirror-headers {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: var(--fg-muted);
    }

    .mirror-row {
      display: grid;
      grid-template-columns: 56px 1fr 56px;
      align-items: center;
      gap: 12px;
    }

    .mirror-val {
      font-size: 12px;

      &--left {
        text-align: right;
      }
      &--right {
        text-align: left;
      }
    }

    .mirror-bars {
      position: relative;
      height: 8px;
      background: var(--paper-3);
      border-radius: 2px;
      display: flex;

      &::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 1px;
        background: var(--fg-muted);
        z-index: 2;
      }
    }

    .mirror-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      background: var(--fg-muted);

      &.is-winner {
        background: var(--accent);
      }

      &--left {
        right: 50%;
        border-radius: 1px 0 0 1px;
      }

      &--right {
        left: 50%;
        border-radius: 0 1px 1px 0;
      }
    }

    .quarter-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
    }

    .quarter-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .quarter-val {
      font-size: 13px;
      color: var(--accent-fg);

      &.is-neg {
        color: var(--neg);
      }
    }

    .quarter-bar-track {
      position: relative;
      width: 12px;
      height: 60px;
      background: var(--paper-3);
      border-radius: 2px;

      &::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 1px;
        background: var(--fg-muted);
      }
    }

    .quarter-bar {
      position: absolute;
      left: 0;
      right: 0;

      &.is-pos {
        bottom: 50%;
        background: var(--accent);
        border-radius: 1px 1px 0 0;
      }

      &.is-neg {
        top: 50%;
        background: var(--neg);
        border-radius: 0 0 1px 1px;
      }
    }

    .quarter-label {
      font-size: 11px;
    }

    .quarter-poss {
      font-size: 9px;
      color: var(--fg-muted);
    }

    .sparkline-wrapper {
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 12px 16px;
    }

    .sparkline-svg {
      width: 100%;
      height: 120px;
      display: block;

      .zero-line {
        stroke: var(--fg-muted);
        stroke-dasharray: 2 3;
        stroke-width: 1;
      }

      .spark-path {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2;
      }

      .spark-dot {
        fill: var(--accent);
      }

      .spark-val {
        font-size: 10px;
        fill: var(--fg);
      }

      .spark-label {
        font-size: 9px;
        fill: var(--fg-muted);
      }
    }

    .opp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;

      th {
        @include v.label;
        font-size: 9px;
        color: var(--fg-muted);
        text-align: right;
        padding: 8px 12px;
        border-bottom: 1px solid var(--line);

        &:first-child {
          text-align: left;
        }
      }

      td {
        padding: 8px 12px;
        text-align: right;
        border-bottom: 1px solid var(--line);
        font-family: var(--font-mono);
      }

      tr:last-child td {
        border-bottom: none;
      }

      .opp-name {
        text-align: left;
        font-family: var(--font-display);
        font-weight: 600;
      }

      .is-neg {
        color: var(--neg);
      }
    }

    .drawer-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 16px;
    }

    .action-btn {
      @include v.label;
      padding: 12px;
      border-radius: var(--radius);
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;

      &--compare {
        background: transparent;
        border: 1px solid var(--line);
        color: var(--fg);

        &:hover {
          background: var(--surface-2);
        }
      }

      &--filter {
        background: var(--accent);
        border: 1px solid var(--accent);
        color: var(--ink);

        &:hover {
          background: var(--accent-fg);
        }
      }
    }
  `],
})
export class LineupDrawerComponent {
  private readonly store = inject(LineupsStore);
  private readonly service = inject(LineupsService);

  readonly fmtNet = fmtNet;
  readonly fmtRating = fmtRating;
  readonly fmtPct = fmtPct;

  readonly selectedGroup = this.store.selectedGroup;
  readonly meta = this.store.meta;
  readonly compare = this.store.compare;

  readonly isOpen = computed(() => this.selectedGroup() !== null);

  readonly detail: import('@angular/core').Signal<Loadable<LineupDetail>> = toSignal(
    toObservable(this.selectedGroup).pipe(
      switchMap((pids) => {
        if (!pids || pids.length === 0) {
          return of({ status: 'loading' } as Loadable<LineupDetail>);
        }
        return this.service.getLineupDetail(pids).pipe(
          map((data) => ({ status: 'ready', data }) as Loadable<LineupDetail>),
          startWith({ status: 'loading' } as Loadable<LineupDetail>),
          catchError((err) =>
            of({
              status: 'error',
              message: err?.errorMessages?.join(' · ') ?? 'Lineup detail not found',
            } as Loadable<LineupDetail>),
          ),
        );
      }),
    ),
    { initialValue: { status: 'loading' } as Loadable<LineupDetail> },
  );

  constructor() {
    effect(() => {
      const open = this.isOpen();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = open ? 'hidden' : '';
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      this.close();
    }
  }

  close(): void {
    this.store.closeGroup();
  }

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--accent)';
  }

  diffNet(d: LineupDetail): number {
    return (d.lineup.net_rating ?? 0) - (d.team_baseline.net_rating ?? 0);
  }

  diffOrtg(d: LineupDetail): number {
    return (d.lineup.offensive_rating ?? 0) - (d.team_baseline.offensive_rating ?? 0);
  }

  diffDrtg(d: LineupDetail): number {
    return (d.team_baseline.defensive_rating ?? 0) - (d.lineup.defensive_rating ?? 0);
  }

  oppOreb(defDreb: number | null): number | null {
    return defDreb != null ? 1 - defDreb : null;
  }

  mirrorWidth(val: number | null): number {
    if (val == null) return 0;
    return Math.min(50, (val / 0.8) * 50);
  }

  getQuarterData(d: LineupDetail, q: number) {
    return d.splits.by_period.find((p) => p.period === q) ?? null;
  }

  quarterBarHeight(net: number | null): number {
    if (net == null) return 0;
    const maxV = 40;
    return Math.min(50, (Math.abs(net) / maxV) * 50);
  }

  formatGameDate(iso: string): string {
    const parts = iso.split('-');
    if (parts.length < 3) return iso;
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${months[m - 1] ?? ''} ${d}`;
  }

  readonly sparkPoints = computed(() => {
    const d = this.detail();
    if (!d || d.status !== 'ready' || d.data.splits.by_game.length === 0) return [];

    const games = d.data.splits.by_game;
    const xSc = scalePoint()
      .domain(games.map((g: { game_id: string }) => g.game_id))
      .range([40, 420]);

    let minNet = -20;
    let maxNet = 20;
    for (const g of games) {
      if (g.net_rating != null) {
        minNet = Math.min(minNet, g.net_rating);
        maxNet = Math.max(maxNet, g.net_rating);
      }
    }
    const pad = Math.max(5, (maxNet - minNet) * 0.15);
    const ySc = scaleLinear()
      .domain([minNet - pad, maxNet + pad])
      .range([90, 20]);

    return games.map((g: { game_id: string; date: string; net_rating: number | null }) => ({
      game_id: g.game_id,
      date: g.date,
      net_rating: g.net_rating,
      x: xSc(g.game_id) ?? 40,
      y: ySc(g.net_rating ?? 0),
    }));
  });

  readonly sparkZeroY = computed(() => {
    const pts = this.sparkPoints();
    if (pts.length === 0) return 60;
    const d = this.detail();
    if (!d || d.status !== 'ready') return 60;

    const games = d.data.splits.by_game;
    let minNet = -20;
    let maxNet = 20;
    for (const g of games) {
      if (g.net_rating != null) {
        minNet = Math.min(minNet, g.net_rating);
        maxNet = Math.max(maxNet, g.net_rating);
      }
    }
    const pad = Math.max(5, (maxNet - minNet) * 0.15);
    const ySc = scaleLinear()
      .domain([minNet - pad, maxNet + pad])
      .range([90, 20]);
    return ySc(0);
  });

  readonly sparkLinePath = computed(() => {
    const pts = this.sparkPoints();
    if (pts.length === 0) return '';
    const lineGen = line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y);
    return lineGen(pts) ?? '';
  });

  isCompared(lineup: LineupRecord): boolean {
    return this.compare().some((c) => c.lineup_key === lineup.lineup_key);
  }

  toggleCompare(lineup: LineupRecord): void {
    this.store.toggleCompare(lineup);
  }

  filterToGroup(lineup: LineupRecord): void {
    this.store.focusExplorer({
      size: lineup.player_ids.length as 1 | 2 | 3 | 4 | 5,
      players: lineup.player_ids,
      teams: [lineup.team_id],
    });
    this.close();
  }
}
