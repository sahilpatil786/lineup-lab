import { Component, computed, inject, signal } from '@angular/core';

import { ScrollProgressDirective } from '../../directives/scroll-progress.directive';
import { COURT_SLOTS, CourtComponent } from '../../shared/court/court.component';
import { PlayerPlateComponent } from '../../shared/player-plate/player-plate.component';
import { LineupsStore } from '../../state/lineups.store';
import { fmtNet, fmtRating } from '../../utils/format';
import { easeOut, slice } from '../../utils/progress';
import { teamColorVar } from '../../utils/team-color';

@Component({
  selector: 'app-leader',
  imports: [ScrollProgressDirective, CourtComponent, PlayerPlateComponent],
  template: `
    <section
      class="pin"
      appScrollProgress
      #sp="scrollProgress"
      style="--pin-top: 52px"
    >
      <div class="pin__stage">
        <div class="wrap leader__wrap">
          <div class="section-index">01 — THE LEADER</div>

          @if (leader(); as l) {
            <div class="leader__grid">
              <!-- Left Column: Captions & CTA -->
              <div class="leader__text-col">
                <div class="leader__captions-box">
                  <p class="t-h3 leader__caption" [style.opacity]="caption1Opacity(sp.progress())">
                    One unit stands above the rest.
                  </p>
                  <p class="t-h3 leader__caption" [style.opacity]="caption2Opacity(sp.progress())">
                    {{ l.team_name }}. Five players, {{ l.total_possessions }} possessions together.
                  </p>
                  <p class="t-h3 leader__caption" [style.opacity]="caption3Opacity(sp.progress())">
                    {{ fmtNet(l.net_rating) }} points per 100 possessions better than whoever they faced.
                  </p>
                  <p class="t-h3 leader__caption" [style.opacity]="caption4Opacity(sp.progress())">
                    {{ fmtRating(l.offensive_rating) }} scored. {{ fmtRating(l.defensive_rating) }} allowed. Team average: {{ teamNetSigned() }}.
                  </p>
                </div>

                <div class="leader__meta-note">
                  RANKED BY STABILITY-ADJUSTED NET RATING — SEE METHOD
                </div>

                @if (sp.progress() >= 0.85 || sp.reduced) {
                  <button
                    type="button"
                    class="leader__cta-btn"
                    (click)="openInExplorer(l)"
                  >
                    Open this five in the Explorer →
                  </button>
                }
              </div>

              <!-- Right Column: Court, Players, Stats -->
              <div class="leader__visual-col">
                <div class="leader__court-area">
                  <app-court [drawn]="true" [animate]="false" />

                  <!-- 5 Placed Players -->
                  @for (player of l.players; track player.player_id; let i = $index) {
                    <div
                      class="leader__slot"
                      [style.left.%]="slots[i].left"
                      [style.top.%]="slots[i].top"
                      [style.--t]="playerT(sp.progress(), i, sp.reduced)"
                    >
                      <app-player-plate
                        [name]="player.name"
                        [index]="i + 1"
                        [teamColor]="teamColor()"
                      />
                    </div>
                  }
                </div>

                <!-- Live Stat Reveal Overlay -->
                <div class="leader__stats-reveal" [style.--t]="statT(sp.progress(), sp.reduced)">
                  <div class="leader__net-hero">
                    <span class="leader__net-val t-num">{{ currentNet(sp.progress(), l.net_rating, sp.reduced) }}</span>
                    <span class="leader__net-label t-label">NET RATING</span>
                  </div>

                  <!-- ORTG / DRTG Bars -->
                  <div class="leader__bars" [style.--t]="barsT(sp.progress(), sp.reduced)">
                    <div class="leader__bar-group">
                      <div class="leader__bar-meta">
                        <span class="t-label">ORTG</span>
                        <span class="t-num">{{ fmtRating(l.offensive_rating) }}</span>
                      </div>
                      <div class="leader__bar-track">
                        <div
                          class="leader__bar-fill leader__bar-fill--off"
                          [style.width.%]="barWidth(l.offensive_rating, sp.progress(), sp.reduced)"
                        ></div>
                        @if (teamBaseline(); as tb) {
                          <div
                            class="leader__bar-tick"
                            [style.left.%]="tickLeft(tb.offensive_rating)"
                            title="Team ORTG"
                          >
                            <span class="leader__bar-tick-label">TEAM</span>
                          </div>
                        }
                      </div>
                    </div>

                    <div class="leader__bar-group">
                      <div class="leader__bar-meta">
                        <span class="t-label">DRTG</span>
                        <span class="t-num">{{ fmtRating(l.defensive_rating) }}</span>
                      </div>
                      <div class="leader__bar-track">
                        <div
                          class="leader__bar-fill leader__bar-fill--def"
                          [style.width.%]="barWidth(l.defensive_rating, sp.progress(), sp.reduced)"
                        ></div>
                        @if (teamBaseline(); as tb) {
                          <div
                            class="leader__bar-tick"
                            [style.left.%]="tickLeft(tb.defensive_rating)"
                            title="Team DRTG"
                          >
                            <span class="leader__bar-tick-label">TEAM</span>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          } @else if (loading()) {
            <div class="leader__skeleton"></div>
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
      height: 400vh;

      @include v.down(v.$bp-md) {
        height: 300vh;
      }

      &.is-reduced {
        height: auto;
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

    .leader {
      &__grid {
        flex: 1;
        display: grid;
        grid-template-columns: 5fr 7fr;
        gap: clamp(24px, 4vw, 64px);
        align-items: center;
        padding-bottom: 32px;

        @include v.down(v.$bp-md) {
          grid-template-columns: 1fr;
          gap: 24px;
        }
      }

      &__text-col {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      &__captions-box {
        position: relative;
        min-height: 140px;
      }

      &__caption {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        line-height: 1.25;
        transition: opacity 0.2s var(--ease-out);
      }

      &__meta-note {
        @include v.label;
        color: var(--fg-muted);
        font-size: 11px;
      }

      &__cta-btn {
        @include v.label;
        align-self: flex-start;
        background: transparent;
        border: 1px solid var(--accent-fg);
        color: var(--accent-fg);
        padding: 10px 16px;
        border-radius: var(--radius);
        cursor: pointer;
        transition: all 0.2s var(--ease-out);

        &:hover {
          background: var(--accent-fg);
          color: var(--ink);
        }
      }

      &__visual-col {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }

      &__court-area {
        position: relative;
        width: 100%;
        max-width: 580px;
        aspect-ratio: 500 / 470;
        color: var(--fg);
      }

      &__slot {
        position: absolute;
        transform: translate(-50%, -50%) translateY(calc((1 - var(--t)) * 140px)) scale(calc(0.85 + 0.15 * var(--t)));
        opacity: var(--t);
        pointer-events: none;
        transition: transform 0.1s var(--ease-out), opacity 0.1s var(--ease-out);
      }

      &__stats-reveal {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(11, 13, 16, 0.92);
        backdrop-filter: blur(8px);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 16px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 32px;
        opacity: var(--t);
        transform: scale(calc(0.85 + 0.15 * var(--t)));
        transition: opacity 0.2s, transform 0.2s;

        @include v.down(v.$bp-sm) {
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
        }
      }

      &__net-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      &__net-val {
        font-size: clamp(36px, 4vw, 54px);
        line-height: 1;
        color: var(--accent-fg);
      }

      &__net-label {
        color: var(--fg-muted);
        font-size: 10px;
        margin-top: 4px;
      }

      &__bars {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        opacity: var(--t);
      }

      &__bar-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      &__bar-meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--fg-muted);
      }

      &__bar-track {
        position: relative;
        height: 8px;
        background: var(--ink-3);
        border-radius: 2px;
        overflow: visible;
      }

      &__bar-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.1s;

        &--off {
          background: var(--accent);
        }

        &--def {
          background: var(--fg-muted);
        }
      }

      &__bar-tick {
        position: absolute;
        top: -6px;
        bottom: -6px;
        width: 1px;
        background: var(--highlight);
        pointer-events: none;
      }

      &__bar-tick-label {
        @include v.label;
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        font-size: 8px;
        color: var(--highlight);
      }

      &__skeleton {
        height: 60vh;
        background: var(--surface-2);
        border-radius: var(--radius);
        animation: pulse 1.6s ease-in-out infinite alternate;
      }
    }

    @keyframes pulse {
      from { opacity: 0.4; }
      to { opacity: 0.8; }
    }
  `],
})
export class LeaderComponent {
  private readonly store = inject(LineupsStore);

  readonly slots = COURT_SLOTS;
  readonly fmtNet = fmtNet;
  readonly fmtRating = fmtRating;

  readonly leagueFive = this.store.leagueFive;
  readonly meta = this.store.meta;

  readonly loading = computed(() => this.leagueFive().status === 'loading');

  readonly leader = computed(() => {
    const l5 = this.leagueFive();
    return l5.status === 'ready' && l5.data.length > 0 ? l5.data[0] : null;
  });

  readonly teamBaseline = computed(() => {
    const m = this.meta();
    const l = this.leader();
    if (m.status !== 'ready' || !l) return null;
    return m.data.team_baselines.find((tb) => tb.team_id === l.team_id) ?? null;
  });

  readonly teamNetSigned = computed(() => {
    const tb = this.teamBaseline();
    return tb ? fmtNet(tb.net_rating) : '—';
  });

  readonly teamColor = computed(() => {
    const l = this.leader();
    const m = this.meta();
    if (!l || m.status !== 'ready') return 'var(--accent-fg)';
    return teamColorVar(l.team_id, m.data.teams);
  });

  playerT(p: number, index: number, reduced: boolean): string {
    if (reduced) return '1';
    const start = 0.08 + index * 0.08;
    const len = 0.08;
    const t = slice(p, start, len);
    return easeOut(t).toFixed(4);
  }

  statT(p: number, reduced: boolean): string {
    if (reduced) return '1';
    return easeOut(slice(p, 0.48, 0.2)).toFixed(4);
  }

  barsT(p: number, reduced: boolean): string {
    if (reduced) return '1';
    return easeOut(slice(p, 0.68, 0.2)).toFixed(4);
  }

  caption1Opacity(p: number): number {
    return p < 0.12 ? 1 : 0;
  }

  caption2Opacity(p: number): number {
    return p >= 0.12 && p < 0.48 ? 1 : 0;
  }

  caption3Opacity(p: number): number {
    return p >= 0.48 && p < 0.68 ? 1 : 0;
  }

  caption4Opacity(p: number): number {
    return p >= 0.68 ? 1 : 0;
  }

  currentNet(p: number, target: number | null, reduced: boolean): string {
    if (target == null) return '—';
    if (reduced || p >= 0.68) return fmtNet(target);
    if (p < 0.48) return '0.0';
    const t = easeOut(slice(p, 0.48, 0.2));
    const curr = t * target;
    return fmtNet(curr);
  }

  barWidth(val: number | null, p: number, reduced: boolean): number {
    if (val == null) return 0;
    const maxVal = 140;
    const t = reduced ? 1 : easeOut(slice(p, 0.68, 0.2));
    return Math.min(100, Math.max(0, (t * val / maxVal) * 100));
  }

  tickLeft(val: number | null): number {
    if (val == null) return 50;
    return Math.min(100, Math.max(0, (val / 140) * 100));
  }

  openInExplorer(leader: any): void {
    this.store.focusExplorer({
      size: 5,
      players: leader.player_ids,
      teams: [leader.team_id],
    });
  }
}
