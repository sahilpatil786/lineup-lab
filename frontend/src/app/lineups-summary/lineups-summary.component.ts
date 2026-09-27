import { Component } from '@angular/core';

import { BuildFiveComponent } from './sections/build-five/build-five.component';
import { CounterBuilderComponent } from './sections/counter-builder/counter-builder.component';
import { ExplorerComponent } from './sections/explorer/explorer.component';
import { HeroComponent } from './sections/hero/hero.component';
import { LeaderComponent } from './sections/leader/leader.component';
import { LocalNavComponent } from './sections/local-nav/local-nav.component';
import { MethodologyComponent } from './sections/methodology/methodology.component';
import { PlayerImpactComponent } from './sections/player-impact/player-impact.component';
import { RatingMapComponent } from './sections/rating-map/rating-map.component';
import { TopRailComponent } from './sections/top-rail/top-rail.component';
import { CompareTrayComponent } from './shared/compare-tray/compare-tray.component';
import { LineupDrawerComponent } from './shared/lineup-drawer/lineup-drawer.component';

@Component({
  selector: 'lineups-summary-component',
  imports: [
    LocalNavComponent,
    HeroComponent,
    LeaderComponent,
    TopRailComponent,
    RatingMapComponent,
    ExplorerComponent,
    BuildFiveComponent,
    PlayerImpactComponent,
    CounterBuilderComponent,
    MethodologyComponent,
    LineupDrawerComponent,
    CompareTrayComponent,
  ],
  templateUrl: './lineups-summary.component.html',
  styleUrl: './lineups-summary.component.scss',
})
export class LineupsSummaryComponent {}
