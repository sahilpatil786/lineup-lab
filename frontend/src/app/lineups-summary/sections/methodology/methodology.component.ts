import { Component, computed, inject } from '@angular/core';

import { RevealDirective } from '../../directives/reveal.directive';
import { LineupsStore } from '../../state/lineups.store';
import { METRICS } from '../../utils/metrics';

@Component({
  selector: 'app-methodology',
  imports: [RevealDirective],
  host: { class: 'theme-paper' },
  template: `
    <section class="methodology" appReveal>
      <div class="wrap">
        <div class="section-index">08 — METHOD</div>

        <div class="methodology__grid">
          <!-- Left Column: Narrative -->
          <div class="methodology__narrative">
            <h2 class="t-h2">How the numbers work.</h2>

            <div class="methodology__text">
              <p>
                Every possession is recorded from the offense's side. When a group is on offense, the row counts toward what it produced; on defense, toward what it allowed.
              </p>
              <p>
                Smaller groups are built from the same possessions: a five-man possession counts once for each duo, trio, or four-man combination inside it.
              </p>
              <p>
                Adjusted net rating blends a group's net rating with its team's, weighted by 40 possessions. It keeps tiny samples from dominating rankings; raw numbers are always shown next to it.
              </p>
            </div>

            <div class="methodology__footer-line t-label">
              {{ footerDataSummary() }}
            </div>
          </div>

          <!-- Right Column: Glossary Table -->
          <div class="methodology__glossary">
            <table class="glossary-table">
              <thead>
                <tr>
                  <th scope="col">CODE</th>
                  <th scope="col">METRIC</th>
                  <th scope="col">FORMULA</th>
                  <th scope="col">AIM</th>
                </tr>
              </thead>
              <tbody>
                @for (m of metrics; track m.key) {
                  <tr>
                    <td class="t-label code-cell">{{ m.short }}</td>
                    <td class="metric-name">{{ m.label }}</td>
                    <td class="formula-cell">{{ m.formula }}</td>
                    <td class="aim-cell" [class.aim-high]="m.better === 'high'" [class.aim-low]="m.better === 'low'">
                      {{ aimSymbol(m.better) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
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

    .methodology {
      padding-bottom: 96px;

      &__grid {
        display: grid;
        grid-template-columns: 5fr 7fr;
        gap: clamp(32px, 5vw, 72px);
        align-items: start;

        @include v.down(v.$bp-md) {
          grid-template-columns: 1fr;
        }
      }

      &__narrative {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      &__text {
        display: flex;
        flex-direction: column;
        gap: 16px;
        font-size: 16px;
        line-height: 1.6;
        color: var(--fg-muted);

        p {
          max-width: 52ch;
        }
      }

      &__footer-line {
        color: var(--fg-muted);
        font-size: 11px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--line);
      }

      &__glossary {
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow-x: auto;
      }
    }

    .glossary-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;

      th {
        @include v.label;
        font-size: 10px;
        color: var(--fg-muted);
        padding: 10px 14px;
        border-bottom: 1px solid var(--line);
        background: var(--surface-2);
      }

      td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--line);
        vertical-align: middle;
      }

      tr:last-child td {
        border-bottom: none;
      }

      .code-cell {
        color: var(--fg);
        white-space: nowrap;
      }

      .metric-name {
        font-weight: 600;
        white-space: nowrap;
      }

      .formula-cell {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--fg-muted);
      }

      .aim-cell {
        text-align: center;
        font-weight: 700;
        font-family: var(--font-mono);

        &.aim-high {
          color: var(--accent-fg);
        }

        &.aim-low {
          color: var(--neg);
        }
      }
    }
  `],
})
export class MethodologyComponent {
  private readonly store = inject(LineupsStore);

  readonly metrics = METRICS;
  readonly meta = this.store.meta;

  readonly footerDataSummary = computed(() => {
    const m = this.meta();
    if (m.status !== 'ready') return 'DATA: 1,348 POSSESSIONS · 7 GAMES · 3 TEAMS';
    const t = m.data.totals;
    return `DATA: ${t.possessions.toLocaleString('en-US')} POSSESSIONS · ${t.games} GAMES · ${t.teams} TEAMS`;
  });

  aimSymbol(better: 'high' | 'low' | 'none'): string {
    if (better === 'high') return '↑';
    if (better === 'low') return '↓';
    return '—';
  }
}
