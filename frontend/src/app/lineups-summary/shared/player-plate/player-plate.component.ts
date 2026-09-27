import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-player-plate',
  template: `
    <span class="plate" [style.border-left-color]="teamColor()">
      @if (index() != null) {
        <span class="plate__idx">{{ formattedIndex() }}</span>
      }
      <span class="plate__name">{{ name() }}</span>
    </span>
  `,
  styles: [`
    @use '../../../../vars.scss' as v;

    :host {
      display: inline-block;
    }

    .plate {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-left: 3px solid var(--fg-muted);
      padding: 8px 12px;
      border-radius: var(--radius);
      white-space: nowrap;
      user-select: none;

      &__idx {
        @include v.label;
        color: var(--fg-muted);
      }

      &__name {
        font-family: var(--font-display);
        font-variation-settings: 'wdth' 80;
        font-weight: 700;
        font-size: 15px;
        text-transform: uppercase;
        color: var(--fg);
        letter-spacing: 0.01em;
      }
    }
  `],
})
export class PlayerPlateComponent {
  readonly name = input.required<string>();
  readonly index = input<number | null>(null);
  readonly teamColor = input<string>('var(--fg-muted)');

  readonly formattedIndex = computed(() => {
    const idx = this.index();
    if (idx == null) return '';
    return idx < 10 ? `0${idx}` : `${idx}`;
  });
}
