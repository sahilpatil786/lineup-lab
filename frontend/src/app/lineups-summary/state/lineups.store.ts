import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';

import { LineupsService } from '../../_services/lineups.service';
import {
  LineupQuery,
  LineupRecord,
  Loadable,
  MetaResponse,
  MetricKey,
  PlayerImpact,
} from '../models/lineup.model';

export interface ExplorerFilters {
  size: 1 | 2 | 3 | 4 | 5;
  teams: string[];
  opponents: string[];
  players: string[];
  periods: number[];
  dateFrom: string | null;
  dateTo: string | null;
  minPoss: number;
  sortKey: MetricKey;
  sortDir: 'asc' | 'desc';
  preset: 'overview' | 'offense' | 'defense' | 'four';
}

export const DEFAULT_FILTERS: ExplorerFilters = {
  size: 5,
  teams: [],
  opponents: [],
  players: [],
  periods: [],
  dateFrom: null,
  dateTo: null,
  minPoss: 10,
  sortKey: 'net_rating',
  sortDir: 'desc',
  preset: 'overview',
};

function loadable<T>(source: Observable<T>): Observable<Loadable<T>> {
  return source.pipe(
    map((data) => ({ status: 'ready', data }) as Loadable<T>),
    startWith({ status: 'loading' } as Loadable<T>),
    catchError((err) =>
      of({
        status: 'error',
        message: err?.errorMessages?.join(' · ') ?? 'Request failed',
      } as Loadable<T>),
    ),
  );
}

@Injectable({ providedIn: 'root' })
export class LineupsStore {
  private readonly service = inject(LineupsService);

  readonly meta: Signal<Loadable<MetaResponse>> = toSignal(
    loadable(this.service.getMeta()),
    { initialValue: { status: 'loading' } },
  );

  readonly leagueFive: Signal<Loadable<LineupRecord[]>> = toSignal(
    loadable(
      this.service.getLineups({
        lineup_size: 5,
        sort_by: 'adjusted_net_rating',
        order: 'desc',
      }),
    ),
    { initialValue: { status: 'loading' } },
  );

  readonly playerImpact: Signal<Loadable<PlayerImpact[]>> = toSignal(
    loadable(this.service.getPlayerImpact()),
    { initialValue: { status: 'loading' } },
  );

  readonly explorerFilters: WritableSignal<ExplorerFilters> = signal(DEFAULT_FILTERS);

  readonly explorer: Signal<Loadable<LineupRecord[]>> = toSignal(
    toObservable(this.explorerFilters).pipe(
      debounceTime(150),
      map((f): LineupQuery => ({
        lineup_size: f.size,
        team_id: f.teams.length ? f.teams : undefined,
        opponent_team_id: f.opponents.length ? f.opponents : undefined,
        include_players: f.players.length ? f.players : undefined,
        period: f.periods.length ? f.periods : undefined,
        date_from: f.dateFrom || undefined,
        date_to: f.dateTo || undefined,
      })),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((q) => loadable(this.service.getLineups(q))),
    ),
    { initialValue: { status: 'loading' } },
  );

  readonly selectedGroup: WritableSignal<string[] | null> = signal(null);

  readonly compare: WritableSignal<LineupRecord[]> = signal([]);

  readonly teamIndex = computed(() => {
    const m = this.meta();
    const map = new Map<string, number>();
    if (m.status === 'ready') {
      const sorted = [...m.data.teams].sort((a, b) => a.name.localeCompare(b.name));
      sorted.forEach((team, index) => {
        map.set(team.team_id, index + 1);
      });
    }
    return map;
  });

  openGroup(playerIds: string[]): void {
    this.selectedGroup.set(playerIds);
  }

  closeGroup(): void {
    this.selectedGroup.set(null);
  }

  toggleCompare(record: LineupRecord): void {
    const current = this.compare();
    const idx = current.findIndex((c) => c.lineup_key === record.lineup_key);
    if (idx >= 0) {
      this.compare.set(current.filter((_, i) => i !== idx));
    } else {
      if (current.length >= 3) {
        this.compare.set([...current.slice(1), record]);
      } else {
        this.compare.set([...current, record]);
      }
    }
  }

  clearCompare(): void {
    this.compare.set([]);
  }

  focusExplorer(patch: Partial<ExplorerFilters>): void {
    this.explorerFilters.update((prev) => ({ ...prev, ...patch }));
    const prefersReducedMotion =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('explorer')?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}
