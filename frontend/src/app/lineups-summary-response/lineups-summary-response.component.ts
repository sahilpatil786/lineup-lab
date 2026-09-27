import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LineupsService } from '../_services/lineups.service';
import { SegmentedComponent, SegmentedOption } from '../lineups-summary/shared/segmented/segmented.component';

interface PresetQuery {
  label: string;
  path: string;
  query: string;
}

@Component({
  selector: 'lineups-summary-response-component',
  imports: [FormsModule, SegmentedComponent],
  templateUrl: './lineups-summary-response.component.html',
  styleUrl: './lineups-summary-response.component.scss',
})
export class LineupsSummaryResponseComponent implements OnInit {
  private readonly lineupsService = inject(LineupsService);

  readonly endpointOptions: SegmentedOption<string>[] = [
    { value: 'lineups', label: 'lineups' },
    { value: 'lineups/detail', label: 'lineups/detail' },
    { value: 'players/impact', label: 'players/impact' },
    { value: 'meta', label: 'meta' },
  ];

  readonly currentPath = signal<string>('lineups');
  readonly queryString = signal<string>('lineup_size=5&sort_by=net_rating&order=desc&min_possessions=20');

  readonly presets: PresetQuery[] = [
    {
      label: 'Top fives by net',
      path: 'lineups',
      query: 'lineup_size=5&sort_by=net_rating&order=desc&min_possessions=20',
    },
    {
      label: 'Best duos (min 50 poss)',
      path: 'lineups',
      query: 'lineup_size=2&min_possessions=50&sort_by=net_rating',
    },
    {
      label: 'Fourth-quarter fives',
      path: 'lineups',
      query: 'lineup_size=5&period=4',
    },
    {
      label: 'Invalid param (400)',
      path: 'lineups',
      query: 'team_id=nope',
    },
  ];

  readonly loading = signal(false);
  readonly statusText = signal('');
  readonly displayedEndpoint = signal('');
  readonly jsonResponse = signal('');

  private sampleDetailPlayerIds = '';

  ngOnInit(): void {
    // Prefill detail ids with top lineup
    this.lineupsService.getLineups({ lineup_size: 5, limit: 1 }).subscribe({
      next: (recs) => {
        if (recs.length > 0) {
          this.sampleDetailPlayerIds = recs[0].player_ids.join(',');
        }
      },
    });

    this.sendRequest();
  }

  onPathChange(path: string): void {
    this.currentPath.set(path);
    if (path === 'lineups') {
      this.queryString.set('lineup_size=5&sort_by=net_rating&order=desc&min_possessions=20');
    } else if (path === 'lineups/detail') {
      const pids = this.sampleDetailPlayerIds || '00000000-0000-0000-0000-000000000000';
      this.queryString.set(`player_ids=${pids}`);
    } else if (path === 'players/impact') {
      this.queryString.set('min_partner_possessions=20');
    } else if (path === 'meta') {
      this.queryString.set('');
    }
    this.sendRequest();
  }

  applyPreset(p: PresetQuery): void {
    this.currentPath.set(p.path);
    this.queryString.set(p.query);
    this.sendRequest();
  }

  sendRequest(): void {
    const path = this.currentPath();
    const query = this.queryString();
    this.loading.set(true);

    const startTime = performance.now();

    this.lineupsService.getRaw(path, query).subscribe({
      next: (res) => {
        const elapsed = Math.round(performance.now() - startTime);
        this.displayedEndpoint.set(res.endpoint);
        const data = res.apiResponse;
        const count = Array.isArray(data) ? `${data.length} records` : '1 record';
        this.statusText.set(`200 OK · ${count} · ${elapsed} ms`);
        this.jsonResponse.set(JSON.stringify(data, null, 2));
        this.loading.set(false);
      },
      error: (err) => {
        const elapsed = Math.round(performance.now() - startTime);
        this.displayedEndpoint.set(`${this.lineupsService['baseUrl']}/${path}?${query}`);
        const status = err.status || 400;
        this.statusText.set(`${status} Error · ${elapsed} ms`);
        const errPayload = err.response?.error ?? err.errorMessages ?? err;
        this.jsonResponse.set(JSON.stringify(errPayload, null, 2));
        this.loading.set(false);
      },
    });
  }
}
