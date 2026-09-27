import { Component, computed, inject, signal } from '@angular/core';

import { LineupRecord, MetricKey } from '../../../models/lineup.model';
import { SegmentedComponent, SegmentedOption } from '../../../shared/segmented/segmented.component';
import { LineupsStore } from '../../../state/lineups.store';
import { fmtNet } from '../../../utils/format';
import {
  EXPLORER_PRESETS,
  METRIC_MAP,
  MetricDef,
  formatMetric,
} from '../../../utils/metrics';
import { percentileRanks } from '../../../utils/percentile';
import { teamColorVar } from '../../../utils/team-color';

@Component({
  selector: 'app-lineup-table',
  imports: [SegmentedComponent],
  template: `
    <div class="table-card">
      <!-- Preset Switcher -->
      <div class="table-card__top">
        <app-segmented
          [options]="presetOptions"
          [value]="filters().preset"
          (valueChange)="setPreset($event)"
        />
        <div class="table-card__showing t-label">
          SHOWING {{ visibleRows().length }} OF {{ sortedRows().length }}
        </div>
      </div>

      <!-- Scrollable Table Container -->
      <div class="table-container">
        @if (sortedRows().length > 0) {
          <table class="lineup-table">
            <thead>
              <tr>
                <th scope="col" class="th-rank">#</th>
                <th scope="col" class="th-lineup">LINEUP</th>
                <th
                  scope="col"
                  class="th-metric th-net"
                  (click)="onHeaderClick('net_rating')"
                  [attr.aria-sort]="getAriaSort('net_rating')"
                  title="Net rating — Points won per 100 possessions"
                >
                  <span class="th-content">
                    <span>NET</span>
                    @if (filters().sortKey === 'net_rating') {
                      <span>{{ filters().sortDir === 'desc' ? '↓' : '↑' }}</span>
                    }
                  </span>
                </th>

                @for (def of currentColumns(); track def.key) {
                  <th
                    scope="col"
                    class="th-metric"
                    (click)="onHeaderClick(def.key)"
                    [attr.aria-sort]="getAriaSort(def.key)"
                    [title]="def.label + ' — ' + def.why"
                  >
                    <span class="th-content">
                      <span>{{ def.short }}</span>
                      @if (filters().sortKey === def.key) {
                        <span>{{ filters().sortDir === 'desc' ? '↓' : '↑' }}</span>
                      }
                    </span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of visibleRows(); track row.lineup_key; let i = $index) {
                <tr
                  class="table-row"
                  [class.is-low-sample]="row.total_possessions < 20"
                  tabindex="0"
                  (click)="openRow(row)"
                  (keydown.enter)="openRow(row)"
                >
                  <!-- Rank -->
                  <td class="td-rank t-label">{{ i + 1 }}</td>

                  <!-- Sticky Lineup Cell -->
                  <td class="td-lineup">
                    <div class="lineup-cell" [style.border-left-color]="getTeamColor(row.team_id)">
                      <div class="lineup-cell__names">
                        {{ formatNames(row) }}
                      </div>
                      <div class="lineup-cell__meta">
                        <span class="t-label">{{ row.team_name }}</span>
                        @if (row.total_possessions < 20) {
                          <span class="low-sample-badge">LOW SAMPLE</span>
                        }
                      </div>
                    </div>
                  </td>

                  <!-- Net Rating Diverging Bar -->
                  <td class="td-net">
                    <div class="net-bar-cell">
                      <div class="net-bar-cell__track">
                        <div
                          class="net-bar-cell__bar"
                          [class.is-pos]="(row.net_rating ?? 0) >= 0"
                          [class.is-neg]="(row.net_rating ?? 0) < 0"
                          [style.width.%]="netBarWidth(row.net_rating)"
                        ></div>
                      </div>
                      <span class="net-bar-cell__val t-num" [class.is-neg]="(row.net_rating ?? 0) < 0">
                        {{ fmtNet(row.net_rating) }}
                      </span>
                    </div>
                  </td>

                  <!-- Preset Columns with Heat Shading -->
                  @for (def of currentColumns(); track def.key) {
                    <td
                      class="td-num t-num"
                      [style.background]="getHeatColor(def, row)"
                    >
                      {{ formatCell(def, row) }}
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>

          @if (hasMore()) {
            <div class="table-card__more-wrap">
              <button type="button" class="table-card__more-btn" (click)="showMore()">
                Show 60 more
              </button>
            </div>
          }
        } @else {
          <div class="empty-state">
            <p>No group matches these filters. Loosen the minimum possessions or remove a player.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @use '../../../../../vars.scss' as v;

    :host {
      display: block;
      width: 100%;
    }

    .table-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      display: flex;
      flex-direction: column;

      &__top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--line);
        flex-wrap: wrap;
        gap: 12px;
      }

      &__showing {
        color: var(--fg-muted);
      }

      &__more-wrap {
        padding: 16px;
        display: flex;
        justify-content: center;
        border-top: 1px solid var(--line);
        background: var(--surface);
      }

      &__more-btn {
        @include v.label;
        background: transparent;
        border: 1px solid var(--line);
        padding: 8px 24px;
        border-radius: var(--radius);
        cursor: pointer;
        color: var(--fg);

        &:hover {
          background: var(--surface-2);
        }
      }
    }

    .table-container {
      max-height: calc(100vh - var(--localnav-h) - 140px);
      overflow: auto;
      position: relative;
    }

    .lineup-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      text-align: left;

      thead th {
        @include v.label;
        font-size: 11px;
        color: var(--fg-muted);
        background: var(--surface);
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        position: sticky;
        top: 0;
        z-index: 10;
        cursor: pointer;
        user-select: none;
        white-space: nowrap;

        &:hover {
          color: var(--fg);
        }
      }

      .th-rank {
        width: 48px;
        text-align: center;
        cursor: default;
      }

      .th-lineup {
        min-width: 280px;
        position: sticky;
        left: 0;
        z-index: 15;
        background: var(--surface);
        box-shadow: 2px 0 6px rgba(0, 0, 0, 0.04);
        cursor: default;
      }

      .th-metric {
        text-align: right;
      }

      .th-net {
        min-width: 140px;
      }

      .th-content {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    }

    .table-row {
      cursor: pointer;
      outline: none;
      transition: background 0.15s;

      &:hover,
      &:focus-visible {
        background: var(--paper-2);

        .td-lineup {
          background: var(--paper-2);
        }
      }

      &.is-low-sample {
        opacity: 0.6;
      }

      td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--line);
        font-size: 13px;
        vertical-align: middle;
      }

      .td-rank {
        text-align: center;
        color: var(--fg-muted);
        font-size: 11px;
      }

      .td-lineup {
        position: sticky;
        left: 0;
        z-index: 5;
        background: var(--surface);
        box-shadow: 2px 0 6px rgba(0, 0, 0, 0.04);
      }

      .td-num {
        text-align: right;
        white-space: nowrap;
      }
    }

    .lineup-cell {
      border-left: 3px solid var(--fg-muted);
      padding-left: 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &__names {
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 600;
        color: var(--fg);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 320px;
      }

      &__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-muted);
        font-size: 10px;
      }
    }

    .low-sample-badge {
      @include v.label;
      font-size: 8px;
      padding: 1px 4px;
      border: 1px solid var(--line);
      border-radius: 2px;
      color: var(--fg-muted);
    }

    .net-bar-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;

      &__track {
        position: relative;
        width: 60px;
        height: 6px;
        background: var(--paper-3);
        border-radius: 1px;
        overflow: hidden;

        &::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 1px;
          background: var(--fg-muted);
        }
      }

      &__bar {
        position: absolute;
        top: 0;
        bottom: 0;

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
        min-width: 44px;
        text-align: right;

        &.is-neg {
          color: var(--neg);
        }
      }
    }

    .empty-state {
      padding: 64px 24px;
      text-align: center;
      color: var(--fg-muted);
      font-size: 16px;
    }
  `],
})
export class LineupTableComponent {
  private readonly store = inject(LineupsStore);

  readonly fmtNet = fmtNet;

  readonly filters = this.store.explorerFilters;
  readonly explorer = this.store.explorer;
  readonly meta = this.store.meta;

  readonly pageSize = signal(60);

  readonly presetOptions: SegmentedOption<string>[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'offense', label: 'Offense' },
    { value: 'defense', label: 'Defense' },
    { value: 'four', label: 'Four Factors' },
  ];

  readonly currentColumns = computed<MetricDef[]>(() => {
    const p = this.filters().preset;
    const colKeys = EXPLORER_PRESETS[p]?.columns ?? EXPLORER_PRESETS['overview'].columns;
    return colKeys
      .filter((k) => k !== 'net_rating') // Net rating always has its own fixed column
      .map((k) => METRIC_MAP.get(k)!)
      .filter((d): d is MetricDef => !!d);
  });

  readonly sortedRows = computed<LineupRecord[]>(() => {
    const ex = this.explorer();
    if (ex.status !== 'ready') return [];

    const f = this.filters();
    const minP = f.minPoss;
    const key = f.sortKey;
    const dir = f.sortDir;

    const filtered = ex.data.filter((r) => r.total_possessions >= minP);

    const present = filtered.filter((r) => r[key] !== null && r[key] !== undefined);
    const missing = filtered.filter((r) => r[key] === null || r[key] === undefined);

    present.sort((a, b) => {
      const va = a[key] as number;
      const vb = b[key] as number;
      if (va !== vb) {
        return dir === 'desc' ? vb - va : va - vb;
      }
      return b.total_possessions - a.total_possessions;
    });

    return [...present, ...missing];
  });

  readonly visibleRows = computed<LineupRecord[]>(() => {
    const rows = this.sortedRows();
    return rows.slice(0, this.pageSize());
  });

  readonly hasMore = computed(() => {
    return this.visibleRows().length < this.sortedRows().length;
  });

  readonly maxAbsNet = computed(() => {
    const rows = this.sortedRows();
    let maxV = 10;
    for (const r of rows) {
      if (r.net_rating != null) {
        maxV = Math.max(maxV, Math.abs(r.net_rating));
      }
    }
    return maxV;
  });

  // Precomputed percentile ranks per column key for heat shading
  readonly percentilesMap = computed(() => {
    const rows = this.sortedRows();
    const cols = this.currentColumns();
    const map = new Map<MetricKey, (number | null)[]>();

    for (const col of cols) {
      if (col.better !== 'none') {
        const values = rows.map((r) => r[col.key] as number | null);
        map.set(col.key, percentileRanks(values));
      }
    }
    return map;
  });

  setPreset(preset: string): void {
    this.store.explorerFilters.update((prev) => ({
      ...prev,
      preset: preset as 'overview' | 'offense' | 'defense' | 'four',
    }));
  }

  showMore(): void {
    this.pageSize.update((s) => s + 60);
  }

  onHeaderClick(key: MetricKey): void {
    const current = this.filters();
    if (current.sortKey === key) {
      const nextDir = current.sortDir === 'desc' ? 'asc' : 'desc';
      this.store.explorerFilters.update((prev) => ({ ...prev, sortDir: nextDir }));
    } else {
      this.store.explorerFilters.update((prev) => ({ ...prev, sortKey: key, sortDir: 'desc' }));
    }
  }

  getAriaSort(key: MetricKey): string {
    const f = this.filters();
    if (f.sortKey !== key) return 'none';
    return f.sortDir === 'desc' ? 'descending' : 'ascending';
  }

  formatNames(row: LineupRecord): string {
    return row.players.map((p) => p.name).join(' · ');
  }

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--fg-muted)';
  }

  netBarWidth(net: number | null): number {
    if (net == null) return 0;
    const maxV = this.maxAbsNet();
    return Math.min(50, (Math.abs(net) / maxV) * 50);
  }

  formatCell(def: MetricDef, row: LineupRecord): string {
    const val = row[def.key] as number | null | undefined;
    return formatMetric(def, val);
  }

  getHeatColor(def: MetricDef, row: LineupRecord): string {
    if (def.better === 'none') return '';
    const pcts = this.percentilesMap().get(def.key);
    if (!pcts) return '';

    const rowIndex = this.sortedRows().findIndex((r) => r.lineup_key === row.lineup_key);
    if (rowIndex < 0) return '';

    const pct = pcts[rowIndex];
    if (pct == null) return '';

    const score = def.better === 'high' ? pct : 1 - pct;
    const heat = Math.abs(score - 0.5) * 2;
    const colorVar = score >= 0.5 ? 'var(--accent)' : 'var(--neg)';
    return `color-mix(in oklab, ${colorVar} calc(${heat.toFixed(3)} * 24%), transparent)`;
  }

  openRow(row: LineupRecord): void {
    this.store.openGroup(row.player_ids);
  }
}
