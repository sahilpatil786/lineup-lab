import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject, signal } from '@angular/core';

@Directive({ selector: '[appScrollProgress]', exportAs: 'scrollProgress' })
export class ScrollProgressDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  readonly progress = signal(0);
  readonly reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private frame = 0;
  private last = -1;

  private readonly schedule = () => {
    if (!this.frame) this.frame = requestAnimationFrame(this.measure);
  };

  private readonly measure = () => {
    this.frame = 0;
    const rect = this.host.getBoundingClientRect();
    const offsetTop = parseFloat(getComputedStyle(this.host).getPropertyValue('--pin-top')) || 0;
    const scrollable = rect.height - (window.innerHeight - offsetTop);
    const raw = scrollable <= 0 ? (rect.top <= offsetTop ? 1 : 0) : (offsetTop - rect.top) / scrollable;
    const p = this.reduced ? 1 : Math.min(1, Math.max(0, raw));
    this.host.style.setProperty('--p', p.toFixed(4));
    if (Math.abs(p - this.last) >= 0.005 || ((p === 0 || p === 1) && p !== this.last)) {
      this.last = p;
      this.zone.run(() => this.progress.set(p));
    }
  };

  ngAfterViewInit(): void {
    if (this.reduced) this.host.classList.add('is-reduced');
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.schedule, { passive: true });
      window.addEventListener('resize', this.schedule, { passive: true });
    });
    this.measure();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.schedule);
    window.removeEventListener('resize', this.schedule);
    cancelAnimationFrame(this.frame);
  }
}
