import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { SegmentedComponent, SegmentedOption } from '../../../shared/segmented/segmented.component';
import { ExplorerFilters, LineupsStore } from '../../../state/lineups.store';
import { teamColorVar } from '../../../utils/team-color';

@Component({
  selector: 'app-filter-bar',
  imports: [SegmentedComponent],
  template: `
    <div class="filter-bar">
      <div class="filter-bar__row">
        <!-- 1. Group Size -->
        <app-segmented
          [options]="sizeOptions"
          [value]="filters().size"
          (valueChange)="setSize($event)"
        />

        <!-- 2. Team Chips -->
        <div class="filter-group">
          <span class="filter-group__label t-label">TEAM</span>
          <div class="chips-row">
            @for (team of teams(); track team.team_id) {
              <button
                type="button"
                class="chip"
                [class.is-active]="filters().teams.includes(team.team_id)"
                (click)="toggleTeam(team.team_id)"
              >
                <span
                  class="chip__dot"
                  [style.background]="getTeamColor(team.team_id)"
                ></span>
                <span>{{ team.name }}</span>
              </button>
            }
          </div>
        </div>

        <!-- 3. Opponent Chips -->
        <div class="filter-group">
          <span class="filter-group__label t-label">VS</span>
          <div class="chips-row">
            @for (team of teams(); track team.team_id) {
              <button
                type="button"
                class="chip"
                [class.is-active]="filters().opponents.includes(team.team_id)"
                (click)="toggleOpponent(team.team_id)"
              >
                <span>{{ team.name }}</span>
              </button>
            }
          </div>
        </div>

        <!-- 4. Must Include Players Typeahead -->
        <div class="filter-group filter-group--typeahead" #typeaheadContainer>
          <span class="filter-group__label t-label">MUST INCLUDE</span>
          <div class="typeahead-box">
            @for (pid of filters().players; track pid) {
              <span class="player-tag">
                <span>{{ getPlayerName(pid) }}</span>
                <button type="button" class="player-tag__remove" (click)="removePlayer(pid)">×</button>
              </span>
            }

            <input
              type="text"
              #playerInput
              class="typeahead-input"
              placeholder="Search player..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              (focus)="showSuggestions.set(true)"
              (keydown)="onTypeaheadKeyDown($event)"
            />
          </div>

          @if (showSuggestions() && filteredPlayerSuggestions().length > 0) {
            <div class="suggestions-menu">
              @for (item of filteredPlayerSuggestions(); track item.player_id; let i = $index) {
                <button
                  type="button"
                  class="suggestion-item"
                  [class.is-focused]="highlightedIndex() === i"
                  (click)="addPlayer(item.player_id)"
                >
                  <span class="suggestion-item__name">{{ item.name }}</span>
                  <span class="suggestion-item__team">{{ getTeamName(item.team_id) }}</span>
                </button>
              }
            </div>
          }
        </div>

        <!-- 5. Period Toggles -->
        <div class="filter-group">
          <span class="filter-group__label t-label">QUARTER</span>
          <div class="chips-row">
            @for (q of [1, 2, 3, 4]; track q) {
              <button
                type="button"
                class="chip"
                [class.is-active]="filters().periods.includes(q)"
                (click)="togglePeriod(q)"
              >
                Q{{ q }}
              </button>
            }
          </div>
        </div>

        <!-- 6. Min Possessions -->
        <div class="filter-group filter-group--slider">
          <span class="filter-group__label t-label">MIN POSS: {{ filters().minPoss }}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            [value]="filters().minPoss"
            (input)="onMinPossChange($event)"
          />
        </div>

        <!-- 7. More (Dates) Popover -->
        <div class="filter-group filter-group--more" #morePopoverEl>
          <button
            type="button"
            class="chip chip--more"
            [class.is-active]="filters().dateFrom || filters().dateTo"
            (click)="moreOpen.set(!moreOpen())"
          >
            <span>Dates</span>
            <span class="chip__caret">▼</span>
          </button>

          @if (moreOpen()) {
            <div class="more-popover">
              <div class="date-field">
                <label class="t-label">FROM</label>
                <input
                  type="date"
                  [min]="dateRange().min"
                  [max]="dateRange().max"
                  [value]="filters().dateFrom ?? ''"
                  (change)="onDateFromChange($event)"
                />
              </div>
              <div class="date-field">
                <label class="t-label">TO</label>
                <input
                  type="date"
                  [min]="dateRange().min"
                  [max]="dateRange().max"
                  [value]="filters().dateTo ?? ''"
                  (change)="onDateToChange($event)"
                />
              </div>
              @if (filters().dateFrom || filters().dateTo) {
                <button type="button" class="date-clear-btn" (click)="clearDates()">Clear dates</button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Action Row Right Side -->
      <div class="filter-bar__actions">
        <span class="filter-bar__count t-label">{{ resultCount() }} GROUPS</span>

        @if (!isDefault()) {
          <button type="button" class="filter-bar__reset-btn" (click)="resetFilters()">
            Reset
          </button>
        }

        <button type="button" class="filter-bar__export-btn" (click)="exportCsv.emit()">
          Export CSV
        </button>
      </div>
    </div>
  `,
  styles: [`
    @use '../../../../../vars.scss' as v;

    :host {
      display: block;
      position: sticky;
      top: var(--localnav-h);
      z-index: 20;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
      padding: 14px 0;
    }

    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;

      &__row {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }

      &__actions {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-left: auto;
      }

      &__count {
        color: var(--fg-muted);
      }

      &__reset-btn,
      &__export-btn {
        @include v.label;
        background: transparent;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 6px 12px;
        cursor: pointer;
        color: var(--fg);
        transition: all 0.2s var(--ease-out);

        &:hover {
          background: var(--surface-2);
        }
      }

      &__export-btn {
        border-color: var(--accent);
        color: var(--accent-fg);

        &:hover {
          background: var(--accent);
          color: var(--ink);
        }
      }
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;

      &__label {
        color: var(--fg-muted);
        font-size: 10px;
      }

      &--slider {
        input[type="range"] {
          width: 90px;
          accent-color: var(--accent);
          cursor: pointer;
        }
      }

      &--typeahead,
      &--more {
        position: relative;
      }
    }

    .chips-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .chip {
      @include v.label;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border: 1px solid var(--line);
      border-radius: 2px;
      background: var(--surface-2);
      color: var(--fg-muted);
      cursor: pointer;
      transition: all 0.2s var(--ease-out);

      &:hover {
        color: var(--fg);
      }

      &.is-active {
        background: var(--fg);
        color: var(--surface);
        font-weight: 600;
        border-color: var(--fg);
      }

      &__dot {
        width: 8px;
        height: 8px;
        border-radius: 1px;
      }

      &__caret {
        font-size: 8px;
      }
    }

    .typeahead-box {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 2px 8px;
      min-height: 32px;
      max-width: 280px;

      &:focus-within {
        border-color: var(--accent);
      }
    }

    .typeahead-input {
      font-family: var(--font-display);
      font-size: 13px;
      background: transparent;
      border: none;
      color: var(--fg);
      outline: none;
      min-width: 80px;
      flex: 1;

      &::placeholder {
        color: var(--fg-muted);
      }
    }

    .player-tag {
      @include v.label;
      font-size: 11px;
      background: var(--fg);
      color: var(--surface);
      padding: 2px 6px;
      border-radius: 2px;
      display: flex;
      align-items: center;
      gap: 4px;

      &__remove {
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
        padding: 0;
      }
    }

    .suggestions-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: 240px;
      background: var(--ink);
      color: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      z-index: 50;
      max-height: 220px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .suggestion-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--paper);
      text-align: left;

      &:hover,
      &.is-focused {
        background: rgba(255, 255, 255, 0.1);
      }

      &__name {
        font-family: var(--font-display);
        font-size: 13px;
        font-weight: 600;
      }

      &__team {
        @include v.label;
        font-size: 10px;
        color: var(--fg-muted);
      }
    }

    .more-popover {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      background: var(--ink);
      color: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 200px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }

    .date-field {
      display: flex;
      flex-direction: column;
      gap: 4px;

      label {
        font-size: 10px;
        color: var(--fg-muted);
      }

      input[type="date"] {
        font-family: var(--font-mono);
        font-size: 12px;
        background: var(--ink-2);
        color: var(--fg);
        border: 1px solid var(--line);
        padding: 4px 8px;
        border-radius: 2px;
        outline: none;

        &:focus {
          border-color: var(--accent);
        }
      }
    }

    .date-clear-btn {
      @include v.label;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--fg-muted);
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 2px;

      &:hover {
        color: var(--fg);
        background: var(--ink-2);
      }
    }
  `],
})
export class FilterBarComponent {
  private readonly store = inject(LineupsStore);

  readonly exportCsv = output<void>();

  readonly filters = this.store.explorerFilters;
  readonly meta = this.store.meta;
  readonly explorer = this.store.explorer;

  readonly showSuggestions = signal(false);
  readonly searchQuery = signal('');
  readonly highlightedIndex = signal(0);
  readonly moreOpen = signal(false);

  readonly typeaheadContainer = viewChild<ElementRef<HTMLElement>>('typeaheadContainer');
  readonly morePopoverEl = viewChild<ElementRef<HTMLElement>>('morePopoverEl');

  readonly sizeOptions: SegmentedOption<number>[] = [
    { value: 1, label: 'Solo' },
    { value: 2, label: 'Duos' },
    { value: 3, label: 'Trios' },
    { value: 4, label: 'Fours' },
    { value: 5, label: 'Fives' },
  ];

  readonly teams = computed(() => {
    const m = this.meta();
    return m.status === 'ready' ? m.data.teams : [];
  });

  readonly dateRange = computed(() => {
    const m = this.meta();
    return m.status === 'ready' ? m.data.date_range : { min: null, max: null };
  });

  readonly resultCount = computed(() => {
    const ex = this.explorer();
    if (ex.status !== 'ready') return 0;
    const minP = this.filters().minPoss;
    return ex.data.filter((r) => r.total_possessions >= minP).length;
  });

  readonly isDefault = computed(() => {
    const f = this.filters();
    return (
      f.size === 5 &&
      f.teams.length === 0 &&
      f.opponents.length === 0 &&
      f.players.length === 0 &&
      f.periods.length === 0 &&
      f.dateFrom === null &&
      f.dateTo === null &&
      f.minPoss === 10
    );
  });

  readonly filteredPlayerSuggestions = computed(() => {
    const m = this.meta();
    if (m.status !== 'ready') return [];

    const q = this.searchQuery().toLowerCase().trim();
    const selTeams = this.filters().teams;
    const currentIncluded = new Set(this.filters().players);

    return m.data.players
      .filter((p) => {
        if (!p.active) return false;
        if (currentIncluded.has(p.player_id)) return false;
        if (selTeams.length > 0 && !selTeams.includes(p.team_id)) return false;
        if (!q) return true;
        return p.name.toLowerCase().includes(q);
      })
      .slice(0, 8);
  });

  getTeamColor(teamId: string): string {
    const m = this.meta();
    return m.status === 'ready' ? teamColorVar(teamId, m.data.teams) : 'var(--fg-muted)';
  }

  getTeamName(teamId: string): string {
    const m = this.meta();
    if (m.status !== 'ready') return '';
    return m.data.teams.find((t) => t.team_id === teamId)?.name ?? '';
  }

  getPlayerName(playerId: string): string {
    const m = this.meta();
    if (m.status !== 'ready') return playerId;
    return m.data.players.find((p) => p.player_id === playerId)?.name ?? playerId;
  }

  setSize(size: number): void {
    const newSize = size as 1 | 2 | 3 | 4 | 5;
    const currentPlayers = this.filters().players;
    if (currentPlayers.length > newSize) {
      this.store.explorerFilters.update((prev) => ({
        ...prev,
        size: newSize,
        players: currentPlayers.slice(0, newSize),
      }));
    } else {
      this.store.explorerFilters.update((prev) => ({ ...prev, size: newSize }));
    }
  }

  toggleTeam(teamId: string): void {
    const current = this.filters().teams;
    const next = current.includes(teamId)
      ? current.filter((id) => id !== teamId)
      : [...current, teamId];
    this.store.explorerFilters.update((prev) => ({ ...prev, teams: next }));
  }

  toggleOpponent(teamId: string): void {
    const current = this.filters().opponents;
    const next = current.includes(teamId)
      ? current.filter((id) => id !== teamId)
      : [...current, teamId];
    this.store.explorerFilters.update((prev) => ({ ...prev, opponents: next }));
  }

  togglePeriod(q: number): void {
    const current = this.filters().periods;
    const next = current.includes(q) ? current.filter((p) => p !== q) : [...current, q];
    this.store.explorerFilters.update((prev) => ({ ...prev, periods: next }));
  }

  onMinPossChange(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.store.explorerFilters.update((prev) => ({ ...prev, minPoss: val }));
  }

  onSearchInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.searchQuery.set(val);
    this.showSuggestions.set(true);
    this.highlightedIndex.set(0);
  }

  addPlayer(playerId: string): void {
    const f = this.filters();
    let newSize = f.size;
    const nextPlayers = [...f.players, playerId];
    if (nextPlayers.length > newSize) {
      newSize = Math.min(5, nextPlayers.length) as 1 | 2 | 3 | 4 | 5;
    }
    this.store.explorerFilters.update((prev) => ({
      ...prev,
      size: newSize,
      players: nextPlayers,
    }));
    this.searchQuery.set('');
    this.showSuggestions.set(false);
  }

  removePlayer(playerId: string): void {
    this.store.explorerFilters.update((prev) => ({
      ...prev,
      players: prev.players.filter((id) => id !== playerId),
    }));
  }

  onTypeaheadKeyDown(e: KeyboardEvent): void {
    const suggestions = this.filteredPlayerSuggestions();
    if (!this.showSuggestions() || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.highlightedIndex.update((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.highlightedIndex.update((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = suggestions[this.highlightedIndex()];
      if (selected) {
        this.addPlayer(selected.player_id);
      }
    } else if (e.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  onDateFromChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value || null;
    this.store.explorerFilters.update((prev) => ({ ...prev, dateFrom: val }));
  }

  onDateToChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value || null;
    this.store.explorerFilters.update((prev) => ({ ...prev, dateTo: val }));
  }

  clearDates(): void {
    this.store.explorerFilters.update((prev) => ({ ...prev, dateFrom: null, dateTo: null }));
  }

  resetFilters(): void {
    this.store.explorerFilters.update((prev) => ({
      ...prev,
      size: 5,
      teams: [],
      opponents: [],
      players: [],
      periods: [],
      dateFrom: null,
      dateTo: null,
      minPoss: 10,
    }));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const typeaheadEl = this.typeaheadContainer()?.nativeElement;
    if (typeaheadEl && !typeaheadEl.contains(target)) {
      this.showSuggestions.set(false);
    }

    const moreEl = this.morePopoverEl()?.nativeElement;
    if (moreEl && !moreEl.contains(target)) {
      this.moreOpen.set(false);
    }
  }
}
