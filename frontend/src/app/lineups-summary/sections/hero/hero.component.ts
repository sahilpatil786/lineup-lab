import { Component, computed, inject } from '@angular/core';

import { CountUpDirective } from '../../directives/count-up.directive';
import { CourtComponent } from '../../shared/court/court.component';
import { LineupsStore } from '../../state/lineups.store';

@Component({
  selector: 'app-hero',
  imports: [CourtComponent, CountUpDirective],
  template: `
    <section class="hero">
      <div class="hero__court-bg">
        <app-court [drawn]="courtDrawn()" [animate]="true" />
      </div>

      <div class="wrap hero__content">
        <div class="hero__kicker">{{ kickerText() }}</div>

        <h1 class="t-display hero__title">
          <span class="hero__title-line hero__title-line--1">Which five</span>
          <span class="hero__title-line hero__title-line--2">wins the minutes?</span>
        </h1>

        <p class="t-lede hero__lede">
          Every possession, every combination of players on the floor, measured at both ends.
        </p>

        @if (totals(); as tot) {
          <div class="hero__stats">
            <div class="hero__stat">
              <span class="t-num hero__stat-num" [appCountUp]="tot.possessions">0</span>
              <span class="t-label hero__stat-label">Possessions</span>
            </div>
            <div class="hero__stat-divider"></div>
            <div class="hero__stat">
              <span class="t-num hero__stat-num" [appCountUp]="tot.five_man_lineups">0</span>
              <span class="t-label hero__stat-label">Five-man units</span>
            </div>
            <div class="hero__stat-divider"></div>
            <div class="hero__stat">
              <span class="t-num hero__stat-num" [appCountUp]="tot.active_players">0</span>
              <span class="t-label hero__stat-label">Players</span>
            </div>
            <div class="hero__stat-divider"></div>
            <div class="hero__stat">
              <span class="t-num hero__stat-num" [appCountUp]="tot.games">0</span>
              <span class="t-label hero__stat-label">Games</span>
            </div>
          </div>
        } @else {
          <div class="hero__stats hero__stats--skeleton">
            <div class="hero__stat-skeleton"></div>
            <div class="hero__stat-skeleton"></div>
            <div class="hero__stat-skeleton"></div>
            <div class="hero__stat-skeleton"></div>
          </div>
        }

        <div class="hero__scroll-cue" (click)="scrollDown()">
          <span class="t-label hero__scroll-label">SCROLL</span>
          <div class="hero__scroll-track">
            <div class="hero__scroll-bar"></div>
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

    .hero {
      position: relative;
      min-height: calc(100vh - 56px);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-bottom: 48px;
      overflow: hidden;

      &__court-bg {
        position: absolute;
        top: 5%;
        right: -5%;
        width: 60%;
        height: 85%;
        color: var(--fg);
        pointer-events: none;
        z-index: 1;

        @include v.down(v.$bp-md) {
          position: relative;
          top: 0;
          right: 0;
          width: 75vw;
          height: 35vh;
          margin: 20px auto 10px auto;
        }
      }

      &__content {
        position: relative;
        z-index: 2;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      &__kicker {
        @include v.label;
        color: var(--fg-muted);
        animation: heroFadeUp 0.8s var(--ease-out) both;
      }

      &__title {
        display: flex;
        flex-direction: column;

        &-line--1 {
          animation: heroFadeUp 0.8s var(--ease-out) 0.12s both;
        }

        &-line--2 {
          color: var(--accent-fg);
          animation: heroFadeUp 0.8s var(--ease-out) 0.24s both;
        }
      }

      &__lede {
        animation: heroFadeUp 0.8s var(--ease-out) 0.36s both;
      }

      &__stats {
        display: flex;
        align-items: center;
        gap: 32px;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--line);
        animation: heroFadeUp 0.8s var(--ease-out) 0.48s both;

        @include v.down(v.$bp-md) {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        &--skeleton {
          height: 80px;
        }
      }

      &__stat {
        display: flex;
        flex-direction: column;
        gap: 4px;

        &-num {
          font-size: clamp(36px, 4vw, 56px);
          line-height: 1;
        }

        &-label {
          color: var(--fg-muted);
        }

        &-divider {
          width: 1px;
          height: 48px;
          background: var(--line);

          @include v.down(v.$bp-md) {
            display: none;
          }
        }

        &-skeleton {
          width: 120px;
          height: 56px;
          background: var(--surface-2);
          border-radius: var(--radius);
          animation: pulse 1.6s ease-in-out infinite alternate;
        }
      }

      &__scroll-cue {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        align-self: center;
        cursor: pointer;
        user-select: none;
      }

      &__scroll-label {
        font-size: 10px;
        color: var(--fg-muted);
        letter-spacing: 0.15em;
      }

      &__scroll-track {
        position: relative;
        width: 1px;
        height: 48px;
        background: var(--line);
        overflow: hidden;
      }

      &__scroll-bar {
        position: absolute;
        width: 1px;
        height: 16px;
        background: var(--fg);
        animation: scrollDrop 2s var(--ease-in-out) infinite;
      }
    }

    @keyframes heroFadeUp {
      from {
        opacity: 0;
        transform: translateY(32px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    @keyframes scrollDrop {
      0% {
        top: -16px;
        opacity: 0;
      }
      30% {
        opacity: 1;
      }
      70% {
        opacity: 1;
      }
      100% {
        top: 48px;
        opacity: 0;
      }
    }

    @keyframes pulse {
      from { opacity: 0.4; }
      to { opacity: 0.8; }
    }
  `],
})
export class HeroComponent {
  private readonly store = inject(LineupsStore);

  readonly meta = this.store.meta;

  readonly totals = computed(() => {
    const m = this.meta();
    return m.status === 'ready' ? m.data.totals : null;
  });

  readonly courtDrawn = computed(() => {
    return this.meta().status === 'ready';
  });

  readonly kickerText = computed(() => {
    const m = this.meta();
    if (m.status !== 'ready') return 'OKC LINEUP LAB · OCT 22–28, 2025';
    const games = m.data.totals.games;
    const minD = m.data.date_range.min ? this.formatDateShort(m.data.date_range.min) : 'OCT 22';
    const maxD = m.data.date_range.max ? this.formatDateShort(m.data.date_range.max) : 'OCT 28';
    return `OKC LINEUP LAB · ${games} GAMES · ${minD}–${maxD}, 2025`;
  });

  private formatDateShort(iso: string): string {
    const parts = iso.split('-');
    if (parts.length < 3) return iso;
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${months[m - 1] ?? ''} ${d}`;
  }

  scrollDown(): void {
    const leaderEl = document.getElementById('leader');
    if (leaderEl) {
      leaderEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
