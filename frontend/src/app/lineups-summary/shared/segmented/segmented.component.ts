import {
  AfterViewInit,
  Component,
  ElementRef,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  viewChildren,
} from '@angular/core';

export interface SegmentedOption<T = unknown> {
  value: T;
  label: string;
}

@Component({
  selector: 'app-segmented',
  template: `
    <div
      class="segmented"
      role="radiogroup"
      (keydown)="onKeyDown($event)"
      tabindex="0"
    >
      <div class="segmented__indicator" [style.transform]="indicatorTransform()" [style.width.px]="indicatorWidth()"></div>
      @for (opt of options(); track opt.value; let i = $index) {
        <button
          #optBtn
          type="button"
          role="radio"
          class="segmented__btn"
          [attr.aria-checked]="opt.value === value()"
          [class.is-active]="opt.value === value()"
          (click)="select(opt.value)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styles: [`
    @use '../../../../vars.scss' as v;

    :host {
      display: inline-block;
    }

    .segmented {
      position: relative;
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 2px;
      background: var(--surface-2);
      outline: none;

      &:focus-visible {
        outline: 2px solid var(--highlight);
        outline-offset: 2px;
      }

      &__indicator {
        position: absolute;
        top: 2px;
        bottom: 2px;
        left: 0;
        background: var(--fg);
        border-radius: calc(var(--radius) - 1px);
        transition: transform 0.35s var(--ease-out), width 0.35s var(--ease-out);
        pointer-events: none;
        z-index: 1;
      }

      &__btn {
        @include v.label;
        position: relative;
        z-index: 2;
        background: transparent;
        border: none;
        padding: 6px 12px;
        color: var(--fg-muted);
        cursor: pointer;
        transition: color 0.25s var(--ease-out);
        white-space: nowrap;

        &:hover {
          color: var(--fg);
        }

        &.is-active {
          color: var(--surface);
          font-weight: 600;
        }
      }
    }
  `],
})
export class SegmentedComponent<T> implements AfterViewInit, OnChanges {
  private readonly elementRef = inject(ElementRef);
  readonly options = input.required<SegmentedOption<T>[]>();
  readonly value = input<T>();
  readonly valueChange = output<T>();

  readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('optBtn');

  indicatorLeft = 0;
  indicatorWidthVal = 0;

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['options']) {
      setTimeout(() => this.updateIndicator(), 0);
    }
  }

  select(val: T): void {
    this.valueChange.emit(val);
    setTimeout(() => this.updateIndicator(), 0);
  }

  updateIndicator(): void {
    const btns = this.buttons();
    const opts = this.options();
    const currentVal = this.value();
    const activeIdx = opts.findIndex((o) => o.value === currentVal);

    if (activeIdx >= 0 && btns[activeIdx]) {
      const btnEl = btns[activeIdx].nativeElement;
      this.indicatorLeft = btnEl.offsetLeft;
      this.indicatorWidthVal = btnEl.offsetWidth;
    } else {
      this.indicatorWidthVal = 0;
    }
  }

  indicatorTransform(): string {
    return `translateX(${this.indicatorLeft}px)`;
  }

  indicatorWidth(): number {
    return this.indicatorWidthVal;
  }

  onKeyDown(event: KeyboardEvent): void {
    const opts = this.options();
    const currentVal = this.value();
    const currentIndex = opts.findIndex((o) => o.value === currentVal);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % opts.length;
      this.select(opts[nextIndex].value);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + opts.length) % opts.length;
      this.select(opts[prevIndex].value);
    }
  }
}
