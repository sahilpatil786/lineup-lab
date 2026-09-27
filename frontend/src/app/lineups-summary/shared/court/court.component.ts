import { Component, input } from '@angular/core';

export const COURT_SLOTS = [
  { left: 50, top: 72 }, // top of key
  { left: 82, top: 53 }, // right wing
  { left: 18, top: 53 }, // left wing
  { left: 68, top: 26 }, // right block
  { left: 35, top: 21 }, // left block
];

@Component({
  selector: 'app-court',
  template: `
    <svg viewBox="0 0 500 470" [class.is-drawn]="drawn()" [class.is-animated]="animate()" aria-hidden="true">
      <g class="lines">
        <rect x="1" y="1" width="498" height="468" pathLength="1" />
        <rect x="170" y="0" width="160" height="190" pathLength="1" />
        <circle cx="250" cy="190" r="60" pathLength="1" />
        <path d="M30 0 V140 A237.5 237.5 0 0 0 470 140 V0" pathLength="1" />
        <path d="M210 52.5 A40 40 0 0 0 290 52.5" pathLength="1" />
        <line x1="220" y1="40" x2="280" y2="40" pathLength="1" />
        <circle cx="250" cy="52.5" r="7.5" pathLength="1" />
        <path d="M190 470 A60 60 0 0 1 310 470" pathLength="1" />
      </g>
    </svg>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .lines > * {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      opacity: 0.35;
    }

    svg.is-animated .lines > * {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      transition: stroke-dashoffset 1.6s var(--ease-in-out);
    }

    svg.is-animated.is-drawn .lines > * {
      stroke-dashoffset: 0;
    }

    @for $i from 1 through 8 {
      svg.is-animated .lines > *:nth-child(#{$i}) {
        transition-delay: #{$i * 120ms};
      }
    }
  `],
})
export class CourtComponent {
  readonly drawn = input<boolean>(true);
  readonly animate = input<boolean>(false);
}
