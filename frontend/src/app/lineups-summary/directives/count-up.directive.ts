import {
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  effect,
  inject,
  input,
} from '@angular/core';

import { easeOut } from '../utils/progress';

@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);

  readonly target = input.required<number>({ alias: 'appCountUp' });
  readonly decimals = input<number>(0);
  readonly signed = input<boolean>(false);
  readonly duration = input<number>(1200);

  private observer: IntersectionObserver | null = null;
  private frameId: number = 0;
  private hasAnimated: boolean = false;
  private readonly reduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      const val = this.target();
      if (this.hasAnimated || this.reduced) {
        this.renderValue(val);
      }
    });
  }

  private format(val: number): string {
    const dec = this.decimals();
    const formatted = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
    if (this.signed()) {
      if (val > 0) return `+${formatted}`;
      if (val < 0) return `−${formatted}`;
    }
    return val < 0 ? `−${formatted}` : formatted;
  }

  private renderValue(val: number): void {
    this.host.textContent = this.format(val);
  }

  ngOnInit(): void {
    if (this.reduced || typeof IntersectionObserver === 'undefined') {
      this.hasAnimated = true;
      this.renderValue(this.target());
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.startAnimation();
              this.observer?.disconnect();
              this.observer = null;
              break;
            }
          }
        },
        { threshold: 0.1 },
      );
      this.observer.observe(this.host);
    });
  }

  private startAnimation(): void {
    const endVal = this.target();
    const dur = this.duration();
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / dur);
      const eased = easeOut(progress);
      const current = eased * endVal;
      this.renderValue(current);

      if (progress < 1) {
        this.frameId = requestAnimationFrame(step);
      } else {
        this.hasAnimated = true;
        this.renderValue(endVal);
      }
    };

    this.frameId = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
  }
}
