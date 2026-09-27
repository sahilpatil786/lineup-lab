import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { RevealDirective } from '../../directives/reveal.directive';
import { LineupRecord, MetricKey } from '../../models/lineup.model';
import { ExplorerFilters, LineupsStore } from '../../state/lineups.store';
import { METRICS } from '../../utils/metrics';
import { FilterBarComponent } from './filter-bar/filter-bar.component';
import { LineupTableComponent } from './lineup-table/lineup-table.component';

@Component({
  selector: 'app-explorer',
  imports: [RevealDirective, FilterBarComponent, LineupTableComponent],
  host: { class: 'theme-paper' },
  template: `
    <section class="explorer" appReveal>
      <div class="wrap">
        <div class="section-index">04 — EXPLORER</div>

        <div class="explorer__header">
          <h2 class="t-h2">The Explorer.</h2>
          <p class="t-lede">
            Slice the league any way you want. Every filter lives in the URL, so any view can be shared.
          </p>
        </div>

        <app-filter-bar (exportCsv)="onExportCsv()" />

        <div class="explorer__table-wrap">
          <app-lineup-table />
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

    .explorer {
      padding-bottom: 80px;

      &__header {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
      }

      &__table-wrap {
        margin-top: 24px;
      }
    }
  `],
})
export class ExplorerComponent {
  private readonly store = inject(LineupsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private lastSerializedQuery = '';

  constructor() {
    this.readUrlParams();

    // Effect to sync store filters to URL queryParams
    effect(() => {
      const f = this.store.explorerFilters();
      const queryParams: Record<string, string | number | null> = {};

      if (f.size !== 5) queryParams['size'] = f.size;
      if (f.teams.length > 0) queryParams['team'] = f.teams.join(',');
      if (f.opponents.length > 0) queryParams['opp'] = f.opponents.join(',');
      if (f.players.length > 0) queryParams['players'] = f.players.join(',');
      if (f.periods.length > 0) queryParams['period'] = f.periods.join(',');
      if (f.dateFrom) queryParams['from'] = f.dateFrom;
      if (f.dateTo) queryParams['to'] = f.dateTo;
      if (f.minPoss !== 10) queryParams['min'] = f.minPoss;
      if (f.sortKey !== 'net_rating') queryParams['sort'] = f.sortKey;
      if (f.sortDir !== 'desc') queryParams['dir'] = f.sortDir;
      if (f.preset !== 'overview') queryParams['view'] = f.preset;

      const serialized = JSON.stringify(queryParams);
      if (serialized !== this.lastSerializedQuery) {
        this.lastSerializedQuery = serialized;
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams,
          replaceUrl: true,
        });
      }
    });
  }

  private readUrlParams(): void {
    const q = this.route.snapshot.queryParamMap;
    if (q.keys.length === 0) return;

    const patch: Partial<ExplorerFilters> = {};

    const rawSize = q.get('size');
    if (rawSize && [1, 2, 3, 4, 5].includes(Number(rawSize))) {
      patch.size = Number(rawSize) as 1 | 2 | 3 | 4 | 5;
    }

    const rawTeam = q.get('team');
    if (rawTeam) patch.teams = rawTeam.split(',').filter(Boolean);

    const rawOpp = q.get('opp');
    if (rawOpp) patch.opponents = rawOpp.split(',').filter(Boolean);

    const rawPlayers = q.get('players');
    if (rawPlayers) patch.players = rawPlayers.split(',').filter(Boolean);

    const rawPeriod = q.get('period');
    if (rawPeriod) patch.periods = rawPeriod.split(',').map(Number).filter((n) => !isNaN(n));

    const rawFrom = q.get('from');
    if (rawFrom) patch.dateFrom = rawFrom;

    const rawTo = q.get('to');
    if (rawTo) patch.dateTo = rawTo;

    const rawMin = q.get('min');
    if (rawMin && !isNaN(Number(rawMin))) patch.minPoss = Number(rawMin);

    const rawSort = q.get('sort');
    if (rawSort) patch.sortKey = rawSort as MetricKey;

    const rawDir = q.get('dir');
    if (rawDir === 'asc' || rawDir === 'desc') patch.sortDir = rawDir;

    const rawView = q.get('view');
    if (rawView && ['overview', 'offense', 'defense', 'four'].includes(rawView)) {
      patch.preset = rawView as 'overview' | 'offense' | 'defense' | 'four';
    }

    if (Object.keys(patch).length > 0) {
      this.store.explorerFilters.update((prev) => ({ ...prev, ...patch }));
    }
  }

  onExportCsv(): void {
    const ex = this.store.explorer();
    if (ex.status !== 'ready') return;

    const f = this.store.explorerFilters();
    const rows = ex.data.filter((r) => r.total_possessions >= f.minPoss);

    // Sort rows matching current table sort
    const key = f.sortKey;
    const dir = f.sortDir;
    const sorted = [...rows].sort((a, b) => {
      const va = a[key] as number;
      const vb = b[key] as number;
      if (va !== vb) {
        return dir === 'desc' ? vb - va : va - vb;
      }
      return b.total_possessions - a.total_possessions;
    });

    const headers = ['Team', 'Players', 'Lineup Size', ...METRICS.map((m) => m.label)];

    const escapeCsv = (val: unknown) => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines: string[] = [headers.map(escapeCsv).join(',')];

    for (const r of sorted) {
      const line = [
        escapeCsv(r.team_name),
        escapeCsv(r.players.map((p) => p.name).join(' / ')),
        escapeCsv(r.lineup_size),
        ...METRICS.map((m) => escapeCsv(r[m.key])),
      ];
      csvLines.push(line.join(','));
    }

    const csvBlob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lineups-${f.size}-man.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
