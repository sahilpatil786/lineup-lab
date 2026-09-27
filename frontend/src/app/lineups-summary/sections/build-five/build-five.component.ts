import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { LineupsService } from '../../../_services/lineups.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { LineupRecord, PlayerRef } from '../../models/lineup.model';
import { COURT_SLOTS, CourtComponent } from '../../shared/court/court.component';
import { PlayerPlateComponent } from '../../shared/player-plate/player-plate.component';
import { SegmentedComponent, SegmentedOption } from '../../shared/segmented/segmented.component';
import { LineupsStore } from '../../state/lineups.store';
import { fmtNet, fmtPct, fmtRating } from '../../utils/format';
import { teamColorVar } from '../../utils/team-color';

@Component({
  selector: 'app-build-five',
  imports: [
    RevealDirective,
    CourtComponent,
    PlayerPlateComponent,
    SegmentedComponent,
  ],
  template: `
    <section class="build-five" appReveal>
      <div class="wrap">
        <div class="section-index">05 — BUILD A FIVE</div>

        <div class="build-five__header">
          <h2 class="t-h2">Build a five.</h2>
          <p class="t-lede">
            Select a team, pick up to five players, and explore how they perform as a unit or discover optimal lineups built around this core.
          </p>
        </div>

        <!-- Team Selector -->
        <div class="build-five__team-select">
          <app-segmented
            [options]="teamOptions()"
            [value]="selectedTeamId()"
            (valueChange)="onTeamChange($event)"
          />
        </div>

        <div class="build-five__grid">
          <!-- Left: Roster List (4 cols) -->
          <div class="build-five__roster">
            <div class="roster-header">
              <span class="t-label">AVAILABLE PLAYERS</span>
              <span class="t-label">{{ selectedPlayers().length }} / 5 SELECTED</span>
            </div>

            <div class="roster-list">
              @for (player of teamRoster(); track player.player_id) {
                <button
                  type="button"
                  class="roster-btn"
                  [class.is-selected]="isPlayerSelected(player.player_id)"
                  (click)="togglePlayer(player)"
                >
                  <span
                    class="roster-btn__dot"
                    [style.background]="teamColor()"
                  ></span>
                  <span class="roster-btn__name">{{ player.name }}</span>
                  @if (isPlayerSelected(player.player_id)) {
                    <span class="roster-btn__check">✓</span>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Center: Court & Placed Players (5 cols) -->
          <div class="build-five__court-col">
            <div class="court-wrapper">
              <app-court [drawn]="true" [animate]="false" />

              <!-- Slot Targets / Placed Plates -->
              @for (slot of slots; track $index; let i = $index) {
                <div
                  class="slot-target"
                  [style.left.%]="slot.left"
                  [style.top.%]="slot.top"
                >
                  @if (selectedPlayers()[i]; as p) {
                    <div class="placed-player" (click)="removePlayer(p.player_id)">
                      <app-player-plate
                        [name]="p.name"
                        [index]="i + 1"
                        [teamColor]="teamColor()"
                      />
                      <span class="placed-player__hint">Click to remove</span>
                    </div>
                  } @else {
                    <div class="empty-slot" (click)="rosterFocus()">
                      <span class="empty-slot__circle">0{{ i + 1 }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            @if (selectedPlayers().length > 0) {
              <div class="court-actions">
                <button type="button" class="clear-btn" (click)="clearAll()">
                  Clear selection
                </button>
              </div>
            }
          </div>

          <!-- Right: Analysis & Results (3 cols) -->
          <div class="build-five__results">
            @if (selectedPlayers().length === 0) {
              <div class="results-empty">
                <span class="t-label">NO PLAYERS SELECTED</span>
                <p>Put players on the floor. See what happened when they actually shared it.</p>
              </div>
            } @else if (loadingExact()) {
              <div class="results-loading">
                <div class="results-skeleton"></div>
              </div>
            } @else {
              <!-- Exact Group Results -->
              @if (exactRecord(); as r) {
                <div class="exact-card">
                  <span class="t-label exact-card__kicker">
                    {{ r.total_possessions }} POSSESSIONS TOGETHER
                  </span>
                  <div class="exact-card__net">
                    <span
                      class="exact-card__net-val t-num"
                      [class.is-neg]="(r.net_rating ?? 0) < 0"
                    >
                      {{ fmtNet(r.net_rating) }}
                    </span>
                    <span class="t-label exact-card__net-label">NET RATING</span>
                  </div>

                  <div class="exact-stats">
                    <div class="stat-line">
                      <span class="t-label">ORTG</span>
                      <span class="t-num">{{ fmtRating(r.offensive_rating) }}</span>
                      <span class="diff-tag" [class.is-pos]="diffOrtg(r) >= 0">
                        vs team {{ fmtNet(diffOrtg(r)) }}
                      </span>
                    </div>

                    <div class="stat-line">
                      <span class="t-label">DRTG</span>
                      <span class="t-num">{{ fmtRating(r.defensive_rating) }}</span>
                      <span class="diff-tag" [class.is-pos]="diffDrtg(r) >= 0">
                        vs team {{ fmtNet(diffDrtg(r)) }}
                      </span>
                    </div>

                    <div class="stat-line">
                      <span class="t-label">EFG%</span>
                      <span class="t-num">{{ fmtPct(r.offensive_efg_pct) }}%</span>
                      <span class="diff-tag" [class.is-pos]="diffEfg(r) >= 0">
                        vs team {{ fmtNet(diffEfg(r)) }}
                      </span>
                    </div>

                    <div class="stat-line">
                      <span class="t-label">TOV%</span>
                      <span class="t-num">{{ fmtPct(r.offensive_tov_pct) }}%</span>
                    </div>

                    <div class="stat-line">
                      <span class="t-label">DREB%</span>
                      <span class="t-num">{{ fmtPct(r.defensive_dreb_pct) }}%</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="full-breakdown-btn"
                    (click)="openDrawer(r)"
                  >
                    Full breakdown →
                  </button>
                </div>
              } @else {
                <!-- Never Shared Floor -->
                <div class="never-card">
                  <span class="t-label never-card__kicker">NO MINUTES TOGETHER</span>
                  <p class="never-card__msg">These players never shared the floor.</p>

                  @if (closestUnits().length > 0) {
                    <div class="closest-section">
                      <span class="t-label closest-title">CLOSEST UNITS THAT DID:</span>
                      @for (c of closestUnits(); track c.record.lineup_key) {
                        <div class="closest-item" (click)="openDrawer(c.record)">
                          <div class="closest-item__names">
                            {{ formatNames(c.record) }}
                          </div>
                          <div class="closest-item__meta">
                            <span class="closest-tag">{{ c.overlap }} of {{ selectedPlayers().length }} match</span>
                            <span class="t-num">{{ c.record.total_possessions }} poss</span>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Best Fives with this Core (when n < 5) -->
              @if (selectedPlayers().length < 5 && bestFives().length > 0) {
                <div class="best-fives-section">
                  <span class="t-label best-fives-title">BEST FIVES WITH THIS CORE</span>
                  <div class="best-fives-list">
                    @for (item of bestFives(); track item.lineup_key) {
                      <div class="best-five-item" (click)="openDrawer(item)">
                        <div class="best-five-item__names">
                          {{ formatNames(item) }}
                        </div>
                        <div class="best-five-item__meta">
                          <span class="t-num" [class.is-neg]="(item.net_rating ?? 0) < 0">
                            {{ fmtNet(item.net_rating) }}
                          </span>
                          <span class="t-label">{{ item.total_possessions }} POSS</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
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

    .build-five {
      padding-bottom: 80px;

      &__header {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
      }

      &__team-select {
        margin-bottom: 32px;
      }

      &__grid {
        display: grid;
        grid-template-columns: 4fr 5fr 3fr;
        gap: 32px;
        align-items: start;

        @include v.down(v.$bp-md) {
          grid-template-columns: 1fr;
        }
      }

      &__roster {
        background: var(--ink-2);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      &__court-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      &__results {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
    }

    .roster-header {
      display: flex;
      justify-content: space-between;
      color: var(--fg-muted);
      font-size: 11px;
    }

    .roster-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 480px;
      overflow-y: auto;
    }

    .roster-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--ink-3);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      color: var(--fg);
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;

      &:hover {
        border-color: var(--fg-muted);
      }

      &.is-selected {
        border-color: var(--accent-fg);
        background: rgba(0, 122, 193, 0.15);
      }

      &__dot {
        width: 8px;
        height: 8px;
        border-radius: 1px;
      }

      &__name {
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 600;
        flex: 1;
      }

      &__check {
        color: var(--accent-fg);
        font-weight: 700;
      }
    }

    .court-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 500 / 470;
      max-width: 480px;
    }

    .slot-target {
      position: absolute;
      transform: translate(-50%, -50%);
      z-index: 5;
    }

    .empty-slot {
      width: 56px;
      height: 56px;
      border: 1px dashed var(--line);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color 0.2s;

      &:hover {
        border-color: var(--accent-fg);
      }

      &__circle {
        @include v.label;
        color: var(--fg-muted);
        font-size: 11px;
      }
    }

    .placed-player {
      position: relative;
      cursor: pointer;

      &:hover .placed-player__hint {
        opacity: 1;
      }

      &__hint {
        @include v.label;
        position: absolute;
        bottom: -18px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        color: var(--neg);
        opacity: 0;
        transition: opacity 0.2s;
        white-space: nowrap;
      }
    }

    .court-actions {
      display: flex;
      justify-content: center;
    }

    .clear-btn {
      @include v.label;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--fg-muted);
      padding: 6px 16px;
      border-radius: var(--radius);
      cursor: pointer;

      &:hover {
        color: var(--fg);
        background: var(--ink-2);
      }
    }

    .results-empty {
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 32px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 12px;
      color: var(--fg-muted);

      p {
        font-size: 14px;
        line-height: 1.4;
      }
    }

    .exact-card,
    .never-card {
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      &__kicker {
        color: var(--fg-muted);
        font-size: 10px;
      }

      &__net {
        display: flex;
        flex-direction: column;
        border-bottom: 1px solid var(--line);
        padding-bottom: 12px;

        &-val {
          font-size: 40px;
          line-height: 1;
          color: var(--accent-fg);

          &.is-neg {
            color: var(--neg);
          }
        }

        &-label {
          color: var(--fg-muted);
          font-size: 10px;
          margin-top: 4px;
        }
      }
    }

    .exact-stats {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stat-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;

      .diff-tag {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--neg);

        &.is-pos {
          color: var(--accent-fg);
        }
      }
    }

    .full-breakdown-btn {
      @include v.label;
      background: transparent;
      border: 1px solid var(--accent);
      color: var(--accent-fg);
      padding: 8px 12px;
      border-radius: var(--radius);
      cursor: pointer;
      text-align: center;
      margin-top: 8px;
      transition: all 0.2s;

      &:hover {
        background: var(--accent);
        color: var(--ink);
      }
    }

    .closest-section,
    .best-fives-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }

    .closest-title,
    .best-fives-title {
      font-size: 10px;
      color: var(--fg-muted);
    }

    .closest-item,
    .best-five-item {
      background: var(--ink-3);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: border-color 0.2s;

      &:hover {
        border-color: var(--accent-fg);
      }

      &__names {
        font-family: var(--font-display);
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &__meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: var(--fg-muted);

        .is-neg {
          color: var(--neg);
        }
      }
    }

    .closest-tag {
      @include v.label;
      font-size: 9px;
      color: var(--highlight);
    }
  `],
})
export class BuildFiveComponent {
  private readonly store = inject(LineupsStore);
  private readonly service = inject(LineupsService);

  readonly slots = COURT_SLOTS;
  readonly fmtNet = fmtNet;
  readonly fmtRating = fmtRating;
  readonly fmtPct = fmtPct;

  readonly meta = this.store.meta;
  readonly leagueFive = this.store.leagueFive;

  readonly selectedTeamId = signal<string>('');
  readonly selectedPlayers = signal<PlayerRef[]>([]);

  readonly loadingExact = signal(false);
  readonly exactRecord = signal<LineupRecord | null>(null);
  readonly bestFives = signal<LineupRecord[]>([]);

  constructor() {
    // Set default team from leader or first team
    effect(() => {
      const l5 = this.leagueFive();
      if (!this.selectedTeamId() && l5.status === 'ready' && l5.data.length > 0) {
        this.selectedTeamId.set(l5.data[0].team_id);
      } else if (!this.selectedTeamId()) {
        const m = this.meta();
        if (m.status === 'ready' && m.data.teams.length > 0) {
          this.selectedTeamId.set(m.data.teams[0].team_id);
        }
      }
    });

    // Run query when players change
    effect(() => {
      const players = this.selectedPlayers();
      const n = players.length;
      if (n === 0) {
        this.exactRecord.set(null);
        this.bestFives.set([]);
        return;
      }

      const pids = players.map((p) => p.player_id);
      this.loadingExact.set(true);

      // Request A: Exact group
      this.service.getLineups({ lineup_size: n, include_players: pids }).subscribe({
        next: (recs) => {
          this.exactRecord.set(recs.length > 0 ? recs[0] : null);
          this.loadingExact.set(false);
        },
        error: () => {
          this.exactRecord.set(null);
          this.loadingExact.set(false);
        },
      });

      // Request B: Best fives with this core (when n < 5)
      if (n < 5) {
        this.service
          .getLineups({
            lineup_size: 5,
            include_players: pids,
            sort_by: 'net_rating',
            order: 'desc',
            min_possessions: 5,
            limit: 3,
          })
          .subscribe({
            next: (recs) => this.bestFives.set(recs),
            error: () => this.bestFives.set([]),
          });
      } else {
        this.bestFives.set([]);
      }
    });
  }

  readonly teamOptions = computed<SegmentedOption<string>[]>(() => {
    const m = this.meta();
    return m.status === 'ready'
      ? m.data.teams.map((t) => ({ value: t.team_id, label: t.name }))
      : [];
  });

  readonly teamRoster = computed(() => {
    const m = this.meta();
    const tid = this.selectedTeamId();
    if (m.status !== 'ready' || !tid) return [];
    return m.data.players.filter((p) => p.team_id === tid && p.active);
  });

  readonly teamColor = computed(() => {
    const m = this.meta();
    const tid = this.selectedTeamId();
    return m.status === 'ready' ? teamColorVar(tid, m.data.teams) : 'var(--accent-fg)';
  });

  readonly teamBaseline = computed(() => {
    const m = this.meta();
    const tid = this.selectedTeamId();
    if (m.status !== 'ready' || !tid) return null;
    return m.data.team_baselines.find((tb) => tb.team_id === tid) ?? null;
  });

  readonly closestUnits = computed(() => {
    const l5 = this.leagueFive();
    const selIds = new Set(this.selectedPlayers().map((p) => p.player_id));
    const tid = this.selectedTeamId();
    if (l5.status !== 'ready' || selIds.size === 0) return [];

    return l5.data
      .filter((r) => r.team_id === tid)
      .map((r) => {
        const overlap = r.player_ids.filter((id) => selIds.has(id)).length;
        return { record: r, overlap };
      })
      .filter((item) => item.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || b.record.total_possessions - a.record.total_possessions)
      .slice(0, 3);
  });

  onTeamChange(teamId: string): void {
    if (teamId !== this.selectedTeamId()) {
      this.selectedTeamId.set(teamId);
      this.selectedPlayers.set([]);
    }
  }

  isPlayerSelected(playerId: string): boolean {
    return this.selectedPlayers().some((p) => p.player_id === playerId);
  }

  togglePlayer(player: PlayerRef): void {
    const current = this.selectedPlayers();
    if (this.isPlayerSelected(player.player_id)) {
      this.selectedPlayers.set(current.filter((p) => p.player_id !== player.player_id));
    } else {
      if (current.length < 5) {
        this.selectedPlayers.set([...current, player]);
      }
    }
  }

  removePlayer(playerId: string): void {
    this.selectedPlayers.set(this.selectedPlayers().filter((p) => p.player_id !== playerId));
  }

  clearAll(): void {
    this.selectedPlayers.set([]);
  }

  rosterFocus(): void {
    // Focus or scroll to roster
  }

  formatNames(record: LineupRecord): string {
    return record.players.map((p) => p.name).join(' · ');
  }

  diffOrtg(r: LineupRecord): number {
    const tb = this.teamBaseline();
    if (!tb || r.offensive_rating == null || tb.offensive_rating == null) return 0;
    return Math.round((r.offensive_rating - tb.offensive_rating) * 10) / 10;
  }

  diffDrtg(r: LineupRecord): number {
    const tb = this.teamBaseline();
    // Lower DRTG is better, so defense diff = team - lineup (positive is good)
    if (!tb || r.defensive_rating == null || tb.defensive_rating == null) return 0;
    return Math.round((tb.defensive_rating - r.defensive_rating) * 10) / 10;
  }

  diffEfg(r: LineupRecord): number {
    const tb = this.teamBaseline();
    if (!tb || r.offensive_efg_pct == null || tb.offensive_efg_pct == null) return 0;
    return Math.round((r.offensive_efg_pct - tb.offensive_efg_pct) * 1000) / 10;
  }

  openDrawer(record: LineupRecord): void {
    this.store.openGroup(record.player_ids);
  }
}
