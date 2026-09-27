import { Directive, ElementRef, NgZone, OnDestroy, OnInit, effect, inject, input } from '@angular/core';

@Directive({
  selector: '[appReveal]',
})
export class RevealDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);

  readonly revealDelay = input<number>(0);
  private observer: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const delay = this.revealDelay();
      if (delay > 0) {
        this.host.style.transitionDelay = `${delay}ms`;
      }
    });
  }

  ngOnInit(): void {
    this.host.classList.add('reveal');

    if (typeof IntersectionObserver === 'undefined') {
      this.host.classList.add('is-in');
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.host.classList.add('is-in');
              this.observer?.unobserve(this.host);
              this.observer?.disconnect();
              this.observer = null;
              break;
            }
          }
        },
        {
          threshold: 0.15,
          rootMargin: '0px 0px -10% 0px',
        },
      );
      this.observer.observe(this.host);
    });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
