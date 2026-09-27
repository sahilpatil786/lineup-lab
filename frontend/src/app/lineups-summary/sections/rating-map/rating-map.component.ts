import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { extent, max } from 'd3-array';
import { scaleLinear, scaleSqrt } from 'd3-scale';

import { RevealDirective } from '../../directives/reveal.directive';
import { LineupRecord } from '../../models/lineup.model';
import { LineupsStore } from '../../state/lineups.store';
import { fmtNet, fmtRating } from '../../utils/format';
import { teamColorVar } from '../../utils/team-color';

interface PointItem {
  record: LineupRecord;
  x: number;
  y: number;
  r: number;
  rank: number | null;
  color: string;
}

@Component({
  selector: 'app-rating-map',
  imports: [RevealDirective],
  host: { class: 'theme-paper' },
  template: `
    <section class="rating-map" appReveal>
      <div class="wrap">
        <div class="section-index">03 — THE MAP</div>

        <div class="rating-map__header">
          <div>
            <h2 class="t-h2">Where every five lives.</h2>
            <p class="t-lede">
              Right is better offense. Up is better defense. Size is how much they played.
            </p>
          </div>

          <!-- Controls -->
          <div class="rating-map__controls">
            <!-- Team Multi-Select Chips -->
            <div class="rating-map__teams">
              @for (team of teams(); track team.team_id) {
                <button
                  type="button"
                  class="team-chip"
                  [class.is-active]="isTeamSelected(team.team_id)"
                  (click)="toggleTeam(team.team_id)"
                >
                  <span
                    class="team-chip__dot"
                    [style.background]="getTeamColor(team.team_id)"
                  ></span>
                  <span>{{ team.name }}</span>
                </button>
              }
            </div>

            <!-- Min Poss Slider -->
            <div class="rating-map__slider-wrap">
              <label class="t-label">MIN POSS: {{ minPoss() }}</label>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                [value]="minPoss()"
                (input)="onMinPossInput($event)"
              />
            </div>

            <!-- Reset Zoom Button -->
            @if (isZoomed()) {
              <button
                type="button"
                class="rating-map__reset-btn"
                (click)="resetZoom()"
              >
                Reset zoom
              </button>
            }
          </div>
        </div>

        <!-- Chart Container -->
        <div
          class="rating-map__chart-container"
          #containerEl
          tabindex="0"
          role="region"
          aria-label="Scatter plot of five-man lineups; use left and right arrows to move between lineups"
          (keydown)="onKeyNav($event)"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp($event)"
          (dblclick)="resetZoom()"
        >
          <svg
            class="rating-map__svg"
            [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
            [attr.width]="width()"
            [attr.height]="height()"
          >
            <!-- Grid Lines & Ticks -->
            <g class="grid">
              @for (tick of xTicks(); track tick.val) {
                <line
                  [attr.x1]="tick.pos"
                  [attr.x2]="tick.pos"
                  [attr.y1]="margins.top"
                  [attr.y2]="height() - margins.bottom"
                  class="grid__line"
                />
                <text
                  [attr.x]="tick.pos"
                  [attr.y]="height() - margins.bottom + 20"
                  class="grid__label"
                  text-anchor="middle"
                >
                  {{ tick.val }}
                </text>
              }

              @for (tick of yTicks(); track tick.val) {
                <line
                  [attr.x1]="margins.left"
                  [attr.x2]="width() - margins.right"
                  [attr.y1]="tick.pos"
                  [attr.y2]="tick.pos"
                  class="grid__line"
                />
                <text
                  [attr.x]="margins.left - 12"
                  [attr.y]="tick.pos + 4"
                  class="grid__label"
                  text-anchor="end"
                >
                  {{ tick.val }}
                </text>
              }
            </g>

            <!-- Axis Titles -->
            <text
              [attr.x]="width() - margins.right"
              [attr.y]="height() - margins.bottom + 40"
              class="axis-title"
              text-anchor="end"
            >
              OFFENSIVE RATING →
            </text>
            <text
              [attr.x]="margins.left"
              [attr.y]="margins.top - 8"
              class="axis-title"
              text-anchor="start"
            >
              ↑ BETTER DEFENSE (DRTG)
            </text>

            <!-- League Average Crosshairs -->
            @if (leagueCrosshair(); as ch) {
              <g class="crosshair">
                <line
                  [attr.x1]="ch.x"
                  [attr.x2]="ch.x"
                  [attr.y1]="margins.top"
                  [attr.y2]="height() - margins.bottom"
                  class="crosshair__line"
                />
                <line
                  [attr.x1]="margins.left"
                  [attr.x2]="width() - margins.right"
                  [attr.y1]="ch.y"
                  [attr.y2]="ch.y"
                  class="crosshair__line"
                />
                <text
                  [attr.x]="ch.x + 6"
                  [attr.y]="margins.top + 16"
                  class="crosshair__label"
                >
                  LEAGUE AVG
                </text>
              </g>
            }

            <!-- Quadrant Labels -->
            <text [attr.x]="width() - margins.right - 8" [attr.y]="margins.top + 20" class="quad-label" text-anchor="end">TWO-WAY</text>
            <text [attr.x]="width() - margins.right - 8" [attr.y]="height() - margins.bottom - 16" class="quad-label" text-anchor="end">OUTSCORE THEM</text>
            <text [attr.x]="margins.left + 8" [attr.y]="margins.top + 20" class="quad-label" text-anchor="start">GRIND IT OUT</text>
            <text [attr.x]="margins.left + 8" [attr.y]="height() - margins.bottom - 16" class="quad-label" text-anchor="start">UNDERWATER</text>

            <!-- Scatter Points -->
            <g class="points">
              @for (p of points(); track p.record.lineup_key; let i = $index) {
                <g
                  class="scatter-point"
                  [class.is-hovered]="hoveredKey() === p.record.lineup_key"
                  [class.is-dimmed]="hoveredKey() && hoveredKey() !== p.record.lineup_key"
                  [style.transform]="'translate(' + p.x + 'px, ' + p.y + 'px)'"
                  [style.--i]="i"
                  (click)="onPointClick(p.record, $event)"
                >
                  <circle
                    [attr.r]="p.r"
                    [attr.fill]="p.color"
                    class="scatter-point__circle"
                  />
                  @if (p.rank != null) {
                    <text
                      [attr.x]="p.r + 4"
                      [attr.y]="4"
                      class="scatter-point__rank"
                    >
                      #{{ p.rank }}
                    </text>
                  }
                </g>
              }
            </g>

            <!-- Zoom Drag Box -->
            @if (dragBox(); as b) {
              <rect
                [attr.x]="b.x"
                [attr.y]="b.y"
                [attr.width]="b.w"
                [attr.height]="b.h"
                class="zoom-drag-rect"
              />
            }
          </svg>

          <!-- Lower-Third Tooltip -->
          @if (activeTooltip(); as tip) {
            <div
              class="map-tooltip"
              [style.left.px]="tip.screenX"
              [style.top.px]="tip.screenY"
              [style.border-left-color]="tip.color"
              [class.is-flipped-x]="tip.flipX"
              [class.is-flipped-y]="tip.flipY"
            >
              <div class="map-tooltip__team">{{ tip.record.team_name }}</div>
              <div class="map-tooltip__names">
                @for (p of tip.record.players; track p.player_id) {
                  <span>{{ p.name }}</span>
                }
              </div>
              <div class="map-tooltip__stats">
                <span>ORTG {{ fmtRating(tip.record.offensive_rating) }}</span>
                <span>DRTG {{ fmtRating(tip.record.defensive_rating) }}</span>
                <span class="map-tooltip__net">NET {{ fmtNet(tip.record.net_rating) }}</span>
                <span>POSS {{ tip.record.total_possessions }}</span>
              </div>
            </div>
          }

          <!-- Screen Reader Accessible Table -->
          <table class="visually-hidden">
            <caption>Five-man lineups plotted by offensive and defensive ratings</caption>
            <thead>
              <tr>
                <th scope="col">Lineup</th>
                <th scope="col">Team</th>
                <th scope="col">Offensive Rating</th>
                <th scope="col">Defensive Rating</th>
                <th scope="col">Net Rating</th>
                <th scope="col">Possessions</th>
              </tr>
            </thead>
            <tbody>
              @for (p of points(); track p.record.lineup_key) {
                <tr>
                  <td>{{ playerList(p.record) }}</td>
                  <td>{{ p.record.team_name }}</td>
                  <td>{{ p.record.offensive_rating }}</td>
                  <td>{{ p.record.defensive_rating }}</td>
                  <td>{{ p.record.net_rating }}</td>
                  <td>{{ p.record.total_possessions }}</td>
                </tr>
              }
            </tbody>
          </table>
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

    .rating-map {
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
        gap: 20px;
        flex-wrap: wrap;
      }

      &__teams {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      &__slider-wrap {
        display: flex;
        flex-direction: column;
        gap: 4px;

        input[type="range"] {
          accent-color: var(--accent);
          cursor: pointer;
        }
      }

      &__reset-btn {
        @include v.label;
        background: transparent;
        border: 1px solid var(--line);
        padding: 6px 12px;
        border-radius: var(--radius);
        cursor: pointer;
        color: var(--fg);

        &:hover {
          background: var(--surface-2);
        }
      }

      &__chart-container {
        position: relative;
        width: 100%;
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
        outline: none;
        cursor: crosshair;

        &:focus-visible {
          outline: 2px solid var(--highlight);
        }
      }

      &__svg {
        display: block;
        width: 100%;
      }
    }

    .team-chip {
      @include v.label;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border: 1px solid var(--line);
      border-radius: 2px;
      background: var(--surface);
      color: var(--fg-muted);
      cursor: pointer;
      transition: all 0.2s var(--ease-out);

      &.is-active {
        background: var(--fg);
        color: var(--surface);
        font-weight: 600;
      }

      &__dot {
        width: 8px;
        height: 8px;
        border-radius: 1px;
      }
    }

    .grid {
      &__line {
        stroke: var(--line);
        stroke-width: 1px;
      }

      &__label {
        font-family: var(--font-mono);
        font-size: 11px;
        fill: var(--fg-muted);
      }
    }

    .axis-title {
      @include v.label;
      font-size: 11px;
      fill: var(--fg-muted);
    }

    .crosshair {
      &__line {
        stroke: var(--fg-muted);
        stroke-width: 1px;
        stroke-dasharray: 3 4;
      }

      &__label {
        font-family: var(--font-mono);
        font-size: 10px;
        fill: var(--fg-muted);
      }
    }

    .quad-label {
      @include v.label;
      font-size: 12px;
      fill: var(--fg-muted);
      opacity: 0.5;
    }

    .scatter-point {
      cursor: pointer;
      transition: transform 0.6s var(--ease-out), opacity 0.2s;

      &__circle {
        fill-opacity: 0.75;
        stroke: var(--surface);
        stroke-width: 1px;
        transition: r 0.2s, stroke-width 0.2s, fill-opacity 0.2s;
      }

      &__rank {
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 600;
        fill: var(--fg);
        pointer-events: none;
      }

      &.is-hovered {
        z-index: 10;
        .scatter-point__circle {
          fill-opacity: 1;
          stroke: var(--fg);
          stroke-width: 2.5px;
        }
      }

      &.is-dimmed {
        opacity: 0.25;
      }
    }

    .zoom-drag-rect {
      fill: rgba(0, 122, 193, 0.15);
      stroke: var(--accent);
      stroke-width: 1px;
      stroke-dasharray: 3 3;
    }

    .map-tooltip {
      position: absolute;
      background: var(--ink);
      color: var(--paper);
      border: 1px solid var(--line);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius);
      padding: 12px 16px;
      pointer-events: none;
      z-index: 20;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      gap: 6px;
      transform: translate(16px, 16px);
      max-width: 280px;

      &.is-flipped-x {
        transform: translate(-100%, 16px) translate(-16px, 0);
      }

      &.is-flipped-y {
        transform: translate(16px, -100%) translate(0, -16px);
      }

      &.is-flipped-x.is-flipped-y {
        transform: translate(-100%, -100%) translate(-16px, -16px);
      }

      &__team {
        @include v.label;
        font-size: 10px;
        color: var(--fg-muted);
      }

      &__names {
        font-family: var(--font-display);
        font-size: 13px;
        font-weight: 600;
        line-height: 1.3;
        display: flex;
        flex-direction: column;
      }

      &__stats {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--fg-muted);
        display: flex;
        gap: 12px;
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px solid var(--line);
      }

      &__net {
        color: var(--accent-fg);
        font-weight: 600;
      }
    }
  `],
})
export class RatingMapComponent implements AfterViewInit, OnDestroy {
  private readonly store = inject(LineupsStore);
  private readonly zone = inject(NgZone);

  readonly fmtNet = fmtNet;
  readonly fmtRating = fmtRating;

  readonly leagueFive = this.store.leagueFive;
  readonly meta = this.store.meta;

  readonly containerEl = viewChild<ElementRef<HTMLElement>>('containerEl');
  private resizeObserver: ResizeObserver | null = null;

  readonly width = signal(1000);
  readonly height = signal(600);

  readonly margins = { top: 24, right: 24, bottom: 48, left: 56 };

  readonly selectedTeams = signal<string[]>([]);
  readonly minPoss = signal(15);
  readonly hoveredKey = signal<string | null>(null);

  // Custom Zoom Domains
  readonly customXDomain = signal<[number, number] | null>(null);
  readonly customYDomain = signal<[number, number] | null>(null);

  // Drag Box
  readonly dragStart = signal<{ x: number; y: number } | null>(null);
  readonly dragBox = signal<{ x: number; y: number; w: number; h: number } | null>(null);

  readonly isZoomed = computed(() => this.customXDomain() !== null || this.customYDomain() !== null);

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
      if (current.length === 1) return; // Keep at least one
      this.selectedTeams.set(current.filter((id) => id !== teamId));
    } else {
      const next = [...current, teamId];
      this.selectedTeams.set(next.length === all.length ? [] : next);
    }
  }

  onMinPossInput(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.minPoss.set(val);
  }

  resetZoom(): void {
    this.customXDomain.set(null);
    this.customYDomain.set(null);
  }

  readonly visibleLineups = computed(() => {
    const l5 = this.leagueFive();
    if (l5.status !== 'ready') return [];

    const sel = this.selectedTeams();
    const minP = this.minPoss();

    return l5.data.filter((r) => {
      if (r.offensive_rating == null || r.defensive_rating == null) return false;
      if (r.total_possessions < minP) return false;
      if (sel.length > 0 && !sel.includes(r.team_id)) return false;
      return true;
    });
  });

  // Scales & Domains
  readonly xDomain = computed<[number, number]>(() => {
    const custom = this.customXDomain();
    if (custom) return custom;

    const data = this.visibleLineups();
    const m = this.meta();
    const leagueOrtg = m.status === 'ready' && m.data.league_baseline ? m.data.league_baseline.offensive_rating : 110;

    let [xMin, xMax] = extent(data, (d) => d.offensive_rating ?? 110) as [number, number];
    if (xMin == null || xMax == null || xMin === xMax) {
      xMin = (leagueOrtg ?? 110) - 20;
      xMax = (leagueOrtg ?? 110) + 20;
    }

    if (leagueOrtg != null) {
      xMin = Math.min(xMin, leagueOrtg);
      xMax = Math.max(xMax, leagueOrtg);
    }

    const pad = (xMax - xMin) * 0.08 || 10;
    return [xMin - pad, xMax + pad];
  });

  readonly yDomain = computed<[number, number]>(() => {
    const custom = this.customYDomain();
    if (custom) return custom;

    const data = this.visibleLineups();
    const m = this.meta();
    const leagueDrtg = m.status === 'ready' && m.data.league_baseline ? m.data.league_baseline.defensive_rating : 110;

    let [yMin, yMax] = extent(data, (d) => d.defensive_rating ?? 110) as [number, number];
    if (yMin == null || yMax == null || yMin === yMax) {
      yMin = (leagueDrtg ?? 110) - 20;
      yMax = (leagueDrtg ?? 110) + 20;
    }

    if (leagueDrtg != null) {
      yMin = Math.min(yMin, leagueDrtg);
      yMax = Math.max(yMax, leagueDrtg);
    }

    const pad = (yMax - yMin) * 0.08 || 10;
    return [yMin - pad, yMax + pad];
  });

  readonly xScale = computed(() => {
    return scaleLinear()
      .domain(this.xDomain())
      .range([this.margins.left, this.width() - this.margins.right]);
  });

  readonly yScale = computed(() => {
    // Note: lower DRtg at top = better defense, so domain [yMin, yMax] maps to [margins.top, height - margins.bottom]
    return scaleLinear()
      .domain(this.yDomain())
      .range([this.margins.top, this.height() - this.margins.bottom]);
  });

  readonly rScale = computed(() => {
    const maxP = max(this.visibleLineups(), (d) => d.total_possessions) || 60;
    return scaleSqrt().domain([0, maxP]).range([4, 20]);
  });

  readonly points = computed<PointItem[]>(() => {
    const list = this.visibleLineups();
    const xs = this.xScale();
    const ys = this.yScale();
    const rs = this.rScale();
    const m = this.meta();
    const teams = m.status === 'ready' ? m.data.teams : [];

    // Sort by adjusted net rating to assign top 10 badges
    const sorted = [...list].sort((a, b) => (b.adjusted_net_rating ?? 0) - (a.adjusted_net_rating ?? 0));
    const top10Keys = new Set(sorted.slice(0, 10).map((r) => r.lineup_key));

    return list.map((record) => {
      const rankIdx = sorted.findIndex((s) => s.lineup_key === record.lineup_key);
      return {
        record,
        x: xs(record.offensive_rating ?? 110),
        y: ys(record.defensive_rating ?? 110),
        r: rs(record.total_possessions),
        rank: rankIdx >= 0 && rankIdx < 10 ? rankIdx + 1 : null,
        color: teamColorVar(record.team_id, teams),
      };
    });
  });

  readonly xTicks = computed(() => {
    const xs = this.xScale();
    return xs.ticks(5).map((val) => ({ val, pos: xs(val) }));
  });

  readonly yTicks = computed(() => {
    const ys = this.yScale();
    return ys.ticks(5).map((val) => ({ val, pos: ys(val) }));
  });

  readonly leagueCrosshair = computed(() => {
    const m = this.meta();
    if (m.status !== 'ready' || !m.data.league_baseline) return null;
    const ortg = m.data.league_baseline.offensive_rating;
    const drtg = m.data.league_baseline.defensive_rating;
    if (ortg == null || drtg == null) return null;
    return {
      x: this.xScale()(ortg),
      y: this.yScale()(drtg),
    };
  });

  readonly activeTooltip = computed(() => {
    const key = this.hoveredKey();
    if (!key) return null;
    const p = this.points().find((item) => item.record.lineup_key === key);
    if (!p) return null;

    const w = this.width();
    const h = this.height();

    return {
      record: p.record,
      screenX: p.x,
      screenY: p.y,
      color: p.color,
      flipX: p.x > w - 300,
      flipY: p.y > h - 180,
    };
  });

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--fg-muted)';
  }

  playerList(record: LineupRecord): string {
    return record.players.map((p) => p.name).join(' · ');
  }

  onPointClick(record: LineupRecord, event: MouseEvent): void {
    event.stopPropagation();
    this.store.openGroup(record.player_ids);
  }

  onPointerDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).tagName === 'circle') return;
    const rect = this.containerEl()?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.dragStart.set({ x, y });
  }

  onPointerMove(e: PointerEvent): void {
    const start = this.dragStart();
    const rect = this.containerEl()?.nativeElement.getBoundingClientRect();
    if (!rect) return;

    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    if (start) {
      const x = Math.min(start.x, curX);
      const y = Math.min(start.y, curY);
      const w = Math.abs(curX - start.x);
      const h = Math.abs(curY - start.y);
      this.dragBox.set({ x, y, w, h });
      return;
    }

    // Nearest point hit test within 24px
    const pts = this.points();
    let closestKey: string | null = null;
    let closestDist = 24;

    for (const p of pts) {
      const dist = Math.hypot(p.x - curX, p.y - curY);
      if (dist < closestDist) {
        closestDist = dist;
        closestKey = p.record.lineup_key;
      }
    }
    this.hoveredKey.set(closestKey);
  }

  onPointerUp(e: PointerEvent): void {
    const start = this.dragStart();
    const box = this.dragBox();
    this.dragStart.set(null);
    this.dragBox.set(null);

    if (start && box && box.w > 12 && box.h > 12) {
      const xs = this.xScale();
      const ys = this.yScale();

      const x1 = xs.invert(box.x);
      const x2 = xs.invert(box.x + box.w);
      const y1 = ys.invert(box.y);
      const y2 = ys.invert(box.y + box.h);

      this.customXDomain.set([Math.min(x1, x2), Math.max(x1, x2)]);
      this.customYDomain.set([Math.min(y1, y2), Math.max(y1, y2)]);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isZoomed()) {
      this.resetZoom();
    }
  }

  onKeyNav(e: KeyboardEvent): void {
    const pts = [...this.points()].sort((a, b) => (b.record.net_rating ?? 0) - (a.record.net_rating ?? 0));
    if (pts.length === 0) return;

    const currentKey = this.hoveredKey();
    const curIdx = pts.findIndex((p) => p.record.lineup_key === currentKey);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (curIdx + 1) % pts.length;
      this.hoveredKey.set(pts[next].record.lineup_key);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (curIdx - 1 + pts.length) % pts.length;
      this.hoveredKey.set(pts[prev].record.lineup_key);
    } else if (e.key === 'Enter' && currentKey) {
      const active = pts.find((p) => p.record.lineup_key === currentKey);
      if (active) {
        this.store.openGroup(active.record.player_ids);
      }
    }
  }

  ngAfterViewInit(): void {
    this.updateDimensions();

    if (typeof ResizeObserver !== 'undefined') {
      const el = this.containerEl()?.nativeElement;
      if (el) {
        this.zone.runOutsideAngular(() => {
          this.resizeObserver = new ResizeObserver(() => {
            this.updateDimensions();
          });
          this.resizeObserver.observe(el);
        });
      }
    }
  }

  private updateDimensions(): void {
    const el = this.containerEl()?.nativeElement;
    if (!el) return;
    const w = el.clientWidth || 1000;
    const isMobile = window.innerWidth < 900;
    const h = isMobile ? Math.min(640, w * 0.9) : Math.min(640, Math.max(400, w * 0.58));
    this.width.set(w);
    this.height.set(h);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
