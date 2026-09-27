import { A11yModule } from '@angular/cdk/a11y';
import { Component, HostListener, computed, inject, signal } from '@angular/core';

import { LineupRecord, MetricKey } from '../../models/lineup.model';
import { LineupsStore } from '../../state/lineups.store';
import { EXPLORER_PRESETS, METRIC_MAP, MetricDef, formatMetric } from '../../utils/metrics';
import { teamColorVar } from '../../utils/team-color';

interface CompareGroup {
  name: string;
  metrics: MetricDef[];
}

@Component({
  selector: 'app-compare-tray',
  imports: [A11yModule],
  template: `
    @if (compareList().length > 0) {
      <!-- Bottom Fixed Floating Tray -->
      <div class="compare-tray">
        <div class="compare-tray__chips">
          @for (item of compareList(); track item.lineup_key) {
            <div class="tray-chip">
              <span
                class="tray-chip__dot"
                [style.background]="getTeamColor(item.team_id)"
              ></span>
              <span class="tray-chip__name">{{ formatShortName(item) }}</span>
              <button
                type="button"
                class="tray-chip__remove"
                (click)="removeLineup(item)"
              >
                ×
              </button>
            </div>
          }
        </div>

        <div class="compare-tray__actions">
          <button
            type="button"
            class="compare-open-btn"
            (click)="overlayOpen.set(true)"
          >
            Compare ({{ compareList().length }})
          </button>
          <button
            type="button"
            class="compare-clear-btn"
            (click)="clearAll()"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Full-Screen Compare Overlay Modal -->
      @if (overlayOpen()) {
        <div
          class="compare-overlay theme-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Lineup comparison"
          cdkTrapFocus
          cdkTrapFocusAutoCapture
        >
          <!-- Header Bar -->
          <div class="compare-overlay__header">
            <h2 class="t-h3">Lineup Comparison</h2>
            <button
              type="button"
              class="overlay-close-btn"
              (click)="overlayOpen.set(false)"
            >
              Close ×
            </button>
          </div>

          <!-- Comparison Table Content -->
          <div class="compare-overlay__content">
            <div class="table-scroll-container">
              <table class="compare-table">
                <!-- Column Headers: Lineups -->
                <thead>
                  <tr>
                    <th class="th-metric-header">METRIC</th>
                    @for (lineup of compareList(); track lineup.lineup_key) {
                      <th class="th-lineup-col">
                        <div class="lineup-col-header">
                          <div class="lineup-col-team">
                            <span
                              class="team-dot"
                              [style.background]="getTeamColor(lineup.team_id)"
                            ></span>
                            <span class="t-label">{{ lineup.team_name }}</span>
                          </div>
                          <div class="lineup-col-names">
                            @for (p of lineup.players; track p.player_id) {
                              <span>{{ p.name }}</span>
                            }
                          </div>
                          <div class="lineup-col-poss t-label">
                            {{ lineup.total_possessions }} POSS
                          </div>
                        </div>
                      </th>
                    }
                  </tr>
                </thead>

                <tbody>
                  @for (group of metricGroups(); track group.name) {
                    <!-- Group Header Row -->
                    <tr class="group-header-row">
                      <td [attr.colspan]="compareList().length + 1" class="group-title t-label">
                        {{ group.name }}
                      </td>
                    </tr>

                    <!-- Metric Rows -->
                    @for (def of group.metrics; track def.key) {
                      <tr class="metric-row">
                        <td class="td-metric-label">
                          <span class="metric-name">{{ def.label }}</span>
                          <span class="metric-short t-label">({{ def.short }})</span>
                        </td>

                        @for (lineup of compareList(); track lineup.lineup_key) {
                          <td
                            class="td-metric-val t-num"
                            [class.is-best]="isBestValue(def, lineup)"
                            [class.is-worst]="isWorstValue(def, lineup)"
                          >
                            {{ formatVal(def, lineup) }}
                          </td>
                        }
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    @use '../../../../vars.scss' as v;

    .compare-tray {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ink);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 90;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      animation: traySlideUp 0.3s var(--ease-out);

      @include v.down(v.$bp-sm) {
        width: calc(100% - 32px);
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
    }

    @keyframes traySlideUp {
      from {
        transform: translate(-50%, 100%);
        opacity: 0;
      }
      to {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }

    .compare-tray__chips {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .tray-chip {
      @include v.label;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-radius: 2px;
      padding: 4px 8px;
      font-size: 11px;
      color: var(--fg);

      &__dot {
        width: 6px;
        height: 6px;
        border-radius: 1px;
      }

      &__remove {
        background: transparent;
        border: none;
        color: var(--fg-muted);
        cursor: pointer;
        font-size: 13px;
        padding: 0 2px;

        &:hover {
          color: var(--fg);
        }
      }
    }

    .compare-tray__actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .compare-open-btn {
      @include v.label;
      background: var(--accent);
      border: none;
      color: var(--ink);
      padding: 8px 14px;
      border-radius: var(--radius);
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;

      &:hover {
        background: var(--accent-fg);
      }
    }

    .compare-clear-btn {
      @include v.label;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--fg-muted);
      padding: 7px 12px;
      border-radius: var(--radius);
      cursor: pointer;

      &:hover {
        color: var(--fg);
      }
    }

    .compare-overlay {
      position: fixed;
      inset: 0;
      background: var(--surface);
      color: var(--fg);
      z-index: 105;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      &__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 32px;
        border-bottom: 1px solid var(--line);
        background: var(--surface);
      }

      &__content {
        flex: 1;
        overflow-y: auto;
        padding: 24px 32px;
      }
    }

    .overlay-close-btn {
      @include v.label;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--fg);
      padding: 8px 16px;
      border-radius: var(--radius);
      cursor: pointer;

      &:hover {
        background: var(--surface-2);
      }
    }

    .table-scroll-container {
      overflow-x: auto;
    }

    .compare-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      th, td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--line);
      }

      .th-metric-header {
        @include v.label;
        font-size: 11px;
        color: var(--fg-muted);
        position: sticky;
        left: 0;
        background: var(--surface);
        z-index: 10;
        width: 260px;
        min-width: 200px;
      }

      .th-lineup-col {
        min-width: 220px;
        vertical-align: top;
      }
    }

    .lineup-col-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .lineup-col-team {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .team-dot {
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .lineup-col-names {
      display: flex;
      flex-direction: column;
      font-family: var(--font-display);
      font-size: 14px;
      font-weight: 700;
      line-height: 1.3;
    }

    .lineup-col-poss {
      color: var(--fg-muted);
      font-size: 10px;
    }

    .group-header-row td {
      background: var(--surface-2);
      padding: 10px 16px;
      font-size: 11px;
      color: var(--fg-muted);
      letter-spacing: 0.1em;
      border-top: 2px solid var(--line);
    }

    .metric-row {
      &:hover {
        background: var(--surface-2);
      }
    }

    .td-metric-label {
      position: sticky;
      left: 0;
      background: inherit;
      z-index: 5;
      display: flex;
      align-items: baseline;
      gap: 6px;

      .metric-name {
        font-weight: 600;
        font-size: 14px;
      }

      .metric-short {
        color: var(--fg-muted);
        font-size: 10px;
      }
    }

    .td-metric-val {
      font-size: 15px;

      &.is-best {
        font-weight: 700;
        border-bottom: 2px solid var(--accent);
        color: var(--accent-fg);
      }

      &.is-worst {
        color: var(--fg-muted);
      }
    }
  `],
})
export class CompareTrayComponent {
  private readonly store = inject(LineupsStore);

  readonly compareList = this.store.compare;
  readonly meta = this.store.meta;

  readonly overlayOpen = signal(false);

  readonly metricGroups = computed<CompareGroup[]>(() => {
    const presets = EXPLORER_PRESETS;
    const groups: CompareGroup[] = [
      {
        name: 'OVERVIEW',
        metrics: presets['overview'].columns
          .map((k) => METRIC_MAP.get(k)!)
          .filter(Boolean),
      },
      {
        name: 'OFFENSE',
        metrics: presets['offense'].columns
          .map((k) => METRIC_MAP.get(k)!)
          .filter(Boolean),
      },
      {
        name: 'DEFENSE',
        metrics: presets['defense'].columns
          .map((k) => METRIC_MAP.get(k)!)
          .filter(Boolean),
      },
    ];
    return groups;
  });

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.overlayOpen()) {
      this.overlayOpen.set(false);
    }
  }

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--accent)';
  }

  formatShortName(item: LineupRecord): string {
    if (item.players.length === 0) return 'Lineup';
    const first = item.players[0].name.split(' ')[0];
    const rest = item.players.length - 1;
    return rest > 0 ? `${first} +${rest}` : first;
  }

  removeLineup(item: LineupRecord): void {
    this.store.toggleCompare(item);
  }

  clearAll(): void {
    this.store.clearCompare();
  }

  formatVal(def: MetricDef, lineup: LineupRecord): string {
    return formatMetric(def, lineup[def.key] as number);
  }

  isBestValue(def: MetricDef, lineup: LineupRecord): boolean {
    if (def.better === 'none') return false;
    const list = this.compareList();
    if (list.length < 2) return false;

    const val = lineup[def.key] as number | null;
    if (val == null) return false;

    const values = list
      .map((l) => l[def.key] as number | null)
      .filter((v): v is number => v != null);

    if (values.length < 2) return false;

    const bestVal = def.better === 'high' ? Math.max(...values) : Math.min(...values);
    return val === bestVal;
  }

  isWorstValue(def: MetricDef, lineup: LineupRecord): boolean {
    if (def.better === 'none') return false;
    const list = this.compareList();
    if (list.length < 2) return false;

    const val = lineup[def.key] as number | null;
    if (val == null) return false;

    const values = list
      .map((l) => l[def.key] as number | null)
      .filter((v): v is number => v != null);

    if (values.length < 2) return false;

    const worstVal = def.better === 'high' ? Math.min(...values) : Math.max(...values);
    return val === worstVal;
  }
}
