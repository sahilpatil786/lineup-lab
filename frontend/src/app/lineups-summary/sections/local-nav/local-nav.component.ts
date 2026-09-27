import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';

interface NavItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-local-nav',
  template: `
    <header class="local-nav" [class.is-visible]="isVisible()">
      <div class="local-nav__wrap">
        <div class="local-nav__brand" (click)="scrollTo('top')">Lineup Lab</div>

        <!-- Desktop Links -->
        <nav class="local-nav__links" aria-label="Sections">
          @for (item of items; track item.id) {
            <a
              href="javascript:void(0)"
              class="local-nav__link"
              [class.is-active]="activeId() === item.id"
              (click)="scrollTo(item.id)"
            >
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- Mobile Dropdown Toggle -->
        <div class="local-nav__mobile">
          <button
            type="button"
            class="local-nav__mobile-btn"
            (click)="toggleMenu()"
            [attr.aria-expanded]="menuOpen()"
          >
            <span>{{ activeLabel() }}</span>
            <span class="local-nav__caret" [class.is-open]="menuOpen()">▼</span>
          </button>

          @if (menuOpen()) {
            <div class="local-nav__menu">
              @for (item of items; track item.id) {
                <button
                  type="button"
                  class="local-nav__menu-item"
                  [class.is-active]="activeId() === item.id"
                  (click)="scrollTo(item.id); closeMenu()"
                >
                  {{ item.label }}
                </button>
              }
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    @use '../../../../vars.scss' as v;

    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 50;
      height: var(--localnav-h);
    }

    .local-nav {
      height: var(--localnav-h);
      background: var(--ink);
      border-bottom: 1px solid var(--line);
      transform: translateY(-100%);
      transition: transform 0.35s var(--ease-out);

      &.is-visible {
        transform: translateY(0);
      }

      &__wrap {
        max-width: var(--maxw);
        height: 100%;
        margin: 0 auto;
        padding: 0 var(--gutter);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      &__brand {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--fg);
        cursor: pointer;
        user-select: none;
      }

      &__links {
        display: flex;
        align-items: center;
        gap: 20px;

        @include v.down(v.$bp-md) {
          display: none;
        }
      }

      &__link {
        @include v.label;
        color: var(--fg-muted);
        text-decoration: none;
        padding: 16px 0;
        border-bottom: 2px solid transparent;
        transition: color 0.2s var(--ease-out), border-color 0.2s var(--ease-out);

        &:hover {
          color: var(--fg);
        }

        &.is-active {
          color: var(--fg);
          border-color: var(--accent-fg);
        }
      }

      &__mobile {
        display: none;
        position: relative;

        @include v.down(v.$bp-md) {
          display: block;
        }
      }

      &__mobile-btn {
        @include v.label;
        background: var(--ink-2);
        color: var(--fg);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 6px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      &__caret {
        font-size: 8px;
        transition: transform 0.2s;

        &.is-open {
          transform: rotate(180deg);
        }
      }

      &__menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        background: var(--ink-2);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 6px 0;
        min-width: 140px;
        z-index: 60;
        display: flex;
        flex-direction: column;
      }

      &__menu-item {
        @include v.label;
        text-align: left;
        background: transparent;
        border: none;
        padding: 8px 16px;
        color: var(--fg-muted);
        cursor: pointer;

        &:hover,
        &.is-active {
          color: var(--fg);
          background: rgba(255, 255, 255, 0.05);
        }

        &.is-active {
          color: var(--accent-fg);
        }
      }
    }
  `],
})
export class LocalNavComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  readonly items: NavItem[] = [
    { id: 'leader', label: 'Leader' },
    { id: 'top-ten', label: 'Top 10' },
    { id: 'map', label: 'Map' },
    { id: 'explorer', label: 'Explorer' },
    { id: 'build', label: 'Build' },
    { id: 'impact', label: 'Impact' },
    { id: 'counter', label: 'Counter' },
    { id: 'method', label: 'Method' },
  ];

  readonly isVisible = signal(false);
  readonly activeId = signal<string>('leader');
  readonly menuOpen = signal(false);

  private heroObserver: IntersectionObserver | null = null;
  private sectionObserver: IntersectionObserver | null = null;

  activeLabel(): string {
    const item = this.items.find((i) => i.id === this.activeId());
    return item ? item.label : 'Menu';
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    const reduced =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.isVisible.set(true);
      return;
    }

    this.zone.runOutsideAngular(() => {
      // Hero observer: hides nav while hero is in view
      const heroEl = document.getElementById('top');
      if (heroEl) {
        this.heroObserver = new IntersectionObserver(
          ([entry]) => {
            this.zone.run(() => this.isVisible.set(!entry.isIntersecting));
          },
          { threshold: 0.1 },
        );
        this.heroObserver.observe(heroEl);
      } else {
        this.zone.run(() => this.isVisible.set(true));
      }

      // Section tracking observer
      this.sectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const id = entry.target.id;
              if (id) {
                this.zone.run(() => this.activeId.set(id));
              }
            }
          }
        },
        { rootMargin: '-45% 0px -50% 0px' },
      );

      this.items.forEach((item) => {
        const el = document.getElementById(item.id);
        if (el && this.sectionObserver) {
          this.sectionObserver.observe(el);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.heroObserver?.disconnect();
    this.sectionObserver?.disconnect();
  }
}
