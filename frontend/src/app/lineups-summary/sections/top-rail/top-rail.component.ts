import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  inject,
  viewChild,
} from '@angular/core';

import { ScrollProgressDirective } from '../../directives/scroll-progress.directive';
import { LineupRecord } from '../../models/lineup.model';
import { LineupsStore } from '../../state/lineups.store';
import { fmtNet, fmtPct } from '../../utils/format';
import { teamColorVar } from '../../utils/team-color';

@Component({
  selector: 'app-top-rail',
  imports: [ScrollProgressDirective],
  template: `
    <section
      class="pin"
      appScrollProgress
      #sp="scrollProgress"
      #pinEl
      style="--pin-top: 52px"
    >
      <div class="pin__stage" #stageEl>
        <div class="wrap top-rail__wrap">
          <div class="section-index">02 — TOP TEN</div>

          <div class="top-rail__layout">
            <!-- Header Block -->
            <div class="top-rail__header">
              <h2 class="t-h2">The top ten.</h2>
              <p class="t-lede">
                Ranked by stability-adjusted net rating, so a four-possession fluke can't top the list.
              </p>
            </div>

            <!-- Horizontal Track -->
            <div class="top-rail__viewport">
              <div class="top-rail__track" #trackEl>
                @for (item of topTen(); track item.lineup_key; let i = $index) {
                  <article
                    class="rail-card"
                    tabindex="0"
                    role="button"
                    (click)="openLineup(item)"
                    (keydown.enter)="openLineup(item)"
                  >
                    <!-- Top Row: Rank & Team -->
                    <div class="rail-card__top">
                      <span class="rail-card__rank">{{ formatRank(i + 1) }}</span>
                      <div class="rail-card__team">
                        <span class="rail-card__team-name">{{ item.team_name }}</span>
                        <span
                          class="rail-card__team-badge"
                          [style.background]="getTeamColor(item.team_id)"
                        ></span>
                      </div>
                    </div>

                    <!-- Names Stacked -->
                    <div class="rail-card__players">
                      @for (p of item.players; track p.player_id) {
                        <span class="rail-card__player-name">{{ p.name }}</span>
                      }
                    </div>

                    <!-- Net Rating Hero -->
                    <div class="rail-card__net-block">
                      <span
                        class="rail-card__net-val t-num"
                        [class.is-neg]="(item.net_rating ?? 0) < 0"
                      >
                        {{ fmtNet(item.net_rating) }}
                      </span>
                      <div class="rail-card__net-meta">
                        <span class="t-label">NET / 100</span>
                        <span class="t-label">{{ item.total_possessions }} POSS</span>
                      </div>
                    </div>

                    <!-- Four Factors Mini Chart -->
                    <div class="rail-card__factors">
                      <!-- eFG% -->
                      <div class="factor-row">
                        <span class="factor-row__label">eFG</span>
                        <div class="factor-row__bars">
                          <div
                            class="factor-row__bar factor-row__bar--off"
                            [style.width.%]="factorWidth(item.offensive_efg_pct, item.defensive_efg_pct, true)"
                            [title]="'Offense: ' + fmtPct(item.offensive_efg_pct) + '%'"
                          ></div>
                          <div
                            class="factor-row__bar factor-row__bar--def"
                            [style.width.%]="factorWidth(item.offensive_efg_pct, item.defensive_efg_pct, false)"
                            [title]="'Opponent: ' + fmtPct(item.defensive_efg_pct) + '%'"
                          ></div>
                        </div>
                      </div>

                      <!-- TOV% -->
                      <div class="factor-row">
                        <span class="factor-row__label">TOV</span>
                        <div class="factor-row__bars">
                          <div
                            class="factor-row__bar factor-row__bar--off"
                            [style.width.%]="factorWidth(item.offensive_tov_pct, item.defensive_tov_pct, true)"
                            [title]="'Offense: ' + fmtPct(item.offensive_tov_pct) + '%'"
                          ></div>
                          <div
                            class="factor-row__bar factor-row__bar--def"
                            [style.width.%]="factorWidth(item.offensive_tov_pct, item.defensive_tov_pct, false)"
                            [title]="'Opponent: ' + fmtPct(item.defensive_tov_pct) + '%'"
                          ></div>
                        </div>
                      </div>

                      <!-- REB% -->
                      <div class="factor-row">
                        <span class="factor-row__label">REB</span>
                        <div class="factor-row__bars">
                          <div
                            class="factor-row__bar factor-row__bar--off"
                            [style.width.%]="rebFactorWidth(item.offensive_oreb_pct, item.defensive_dreb_pct, true)"
                            [title]="'Off OREB: ' + fmtPct(item.offensive_oreb_pct) + '%'"
                          ></div>
                          <div
                            class="factor-row__bar factor-row__bar--def"
                            [style.width.%]="rebFactorWidth(item.offensive_oreb_pct, item.defensive_dreb_pct, false)"
                            [title]="'Opp OREB: ' + fmtPct(oppOreb(item.defensive_dreb_pct)) + '%'"
                          ></div>
                        </div>
                      </div>

                      <!-- FTr -->
                      <div class="factor-row">
                        <span class="factor-row__label">FTr</span>
                        <div class="factor-row__bars">
                          <div
                            class="factor-row__bar factor-row__bar--off"
                            [style.width.%]="factorWidth(item.offensive_ft_rate, item.defensive_ft_rate, true)"
                            [title]="'Offense: ' + fmtPct(item.offensive_ft_rate) + '%'"
                          ></div>
                          <div
                            class="factor-row__bar factor-row__bar--def"
                            [style.width.%]="factorWidth(item.offensive_ft_rate, item.defensive_ft_rate, false)"
                            [title]="'Opponent: ' + fmtPct(item.defensive_ft_rate) + '%'"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </article>
                }
              </div>
            </div>
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
      height: 100%;
      display: flex;
      flex-direction: column;
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

    .pin {
      position: relative;

      &.is-reduced {
        height: auto !important;
      }

      &__stage {
        position: sticky;
        top: var(--localnav-h);
        height: calc(100vh - var(--localnav-h));
        overflow: hidden;
      }
    }

    .pin.is-reduced .pin__stage {
      position: relative;
      height: auto;
      overflow: visible;
      padding-bottom: 64px;
    }

    .top-rail {
      &__layout {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 32px;
        padding-bottom: 40px;
      }

      &__header {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      &__viewport {
        width: 100%;
        overflow: visible;

        @include v.down(v.$bp-md) {
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding-bottom: 16px;
        }
      }

      &__track {
        display: flex;
        gap: 20px;
        transform: translate3d(calc(var(--p) * var(--overflow, 0px) * -1), 0, 0);
        will-change: transform;

        @include v.down(v.$bp-md) {
          transform: none !important;
        }
      }
    }

    .is-reduced .top-rail__viewport {
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: 16px;
    }

    .is-reduced .top-rail__track {
      transform: none !important;
    }

    .rail-card {
      flex: 0 0 340px;
      width: 340px;
      min-height: 440px;
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      outline: none;
      transition: border-color 0.3s var(--ease-out), transform 0.3s var(--ease-out);

      @include v.down(v.$bp-md) {
        scroll-snap-align: start;
      }

      &:hover,
      &:focus-visible {
        border-color: var(--accent-fg);
        transform: translateY(-4px);
      }

      &__top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      &__rank {
        font-family: var(--font-display);
        font-variation-settings: 'wdth' 75;
        font-size: 88px;
        font-weight: 800;
        line-height: 0.8;
        color: transparent;
        -webkit-text-stroke: 1px var(--fg-muted);
        letter-spacing: -0.04em;
      }

      &__team {
        display: flex;
        align-items: center;
        gap: 8px;

        &-name {
          @include v.label;
          font-size: 11px;
          color: var(--fg-muted);
        }

        &-badge {
          width: 10px;
          height: 10px;
          border-radius: 1px;
        }
      }

      &__players {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 16px 0;
      }

      &__player-name {
        font-family: var(--font-display);
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--fg);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &__net-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 0;
        border-top: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
      }

      &__net-val {
        font-size: 48px;
        line-height: 1;
        color: var(--accent-fg);

        &.is-neg {
          color: var(--neg);
        }
      }

      &__net-meta {
        display: flex;
        justify-content: space-between;
        color: var(--fg-muted);
        font-size: 11px;
      }

      &__factors {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
    }

    .factor-row {
      display: flex;
      align-items: center;
      gap: 12px;

      &__label {
        @include v.label;
        font-size: 10px;
        width: 32px;
        color: var(--fg-muted);
      }

      &__bars {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        background: var(--ink-3);
        height: 10px;
        border-radius: 2px;
        padding: 1px;
      }

      &__bar {
        height: 4px;
        border-radius: 1px;

        &--off {
          background: var(--accent-fg);
        }

        &--def {
          background: var(--fg-muted);
        }
      }
    }
  `],
})
export class TopRailComponent implements AfterViewInit, OnDestroy {
  private readonly store = inject(LineupsStore);
  private readonly zone = inject(NgZone);

  readonly fmtNet = fmtNet;
  readonly fmtPct = fmtPct;

  readonly leagueFive = this.store.leagueFive;
  readonly meta = this.store.meta;

  readonly pinEl = viewChild<ElementRef<HTMLElement>>('pinEl');
  readonly stageEl = viewChild<ElementRef<HTMLElement>>('stageEl');
  readonly trackEl = viewChild<ElementRef<HTMLElement>>('trackEl');

  private resizeObserver: ResizeObserver | null = null;

  readonly topTen = computed(() => {
    const l5 = this.leagueFive();
    return l5.status === 'ready' ? l5.data.slice(0, 10) : [];
  });

  formatRank(rank: number): string {
    return rank < 10 ? `0${rank}` : `${rank}`;
  }

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--accent)';
  }

  oppOreb(defDrebPct: number | null): number | null {
    return defDrebPct != null ? 1 - defDrebPct : null;
  }

  factorWidth(off: number | null, def: number | null, isOff: boolean): number {
    const val = isOff ? off : def;
    if (val == null) return 0;
    const maxVal = Math.max(off ?? 0, def ?? 0, 0.6);
    return Math.min(100, Math.max(0, (val / maxVal) * 100));
  }

  rebFactorWidth(offOreb: number | null, defDreb: number | null, isOff: boolean): number {
    const oppOreb = defDreb != null ? 1 - defDreb : null;
    return this.factorWidth(offOreb, oppOreb, isOff);
  }

  openLineup(record: LineupRecord): void {
    this.store.openGroup(record.player_ids);
  }

  ngAfterViewInit(): void {
    this.updateTrackLayout();

    if (typeof ResizeObserver !== 'undefined') {
      const track = this.trackEl()?.nativeElement;
      if (track) {
        this.zone.runOutsideAngular(() => {
          this.resizeObserver = new ResizeObserver(() => {
            this.updateTrackLayout();
          });
          this.resizeObserver.observe(track);
        });
      }
    }
  }

  private updateTrackLayout(): void {
    const pin = this.pinEl()?.nativeElement;
    const stage = this.stageEl()?.nativeElement;
    const track = this.trackEl()?.nativeElement;

    if (!pin || !stage || !track) return;

    const gutter = 48;
    const overflow = Math.max(0, track.scrollWidth - stage.clientWidth + gutter);
    pin.style.height = `calc(100vh + ${overflow}px)`;
    pin.style.setProperty('--overflow', `${overflow}px`);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
