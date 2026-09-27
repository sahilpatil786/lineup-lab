import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  LineupDetail,
  LineupQuery,
  LineupRecord,
  MetaResponse,
  PlayerImpact,
  PossessionFilterQuery,
  TeamFilterQuery,
} from '../lineups-summary/models/lineup.model';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class LineupsService extends BaseService {
  constructor(protected override http: HttpClient) {
    super(http);
  }

  private buildQueryParams(queryParams: Record<string, string | number>): HttpParams {
    return Object.entries(queryParams).reduce(
      (params, [key, value]) => params.set(key, String(value)),
      new HttpParams(),
    );
  }

  private buildDisplayedEndpointWithParams(
    endpoint: string,
    queryParams: Record<string, string | number>,
  ): string {
    const queryString = new URLSearchParams(
      Object.entries(queryParams).map(([key, value]) => [key, String(value)]),
    ).toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }

  getLineupsLeagueSummary(lineupSize: number = 5): Observable<{
    endpoint: string;
    apiResponse: unknown;
  }> {
    const endpoint = `${this.baseUrl}/lineups`;
    const queryParams = { lineup_size: lineupSize };
    const params = this.buildQueryParams(queryParams);
    const displayedEndpointWithParams = this.buildDisplayedEndpointWithParams(endpoint, queryParams);

    return this.get(endpoint, params).pipe(
      map((data) => ({
        endpoint: displayedEndpointWithParams,
        apiResponse: data,
      })),
    );
  }

  private toParams(query: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const item of value) params = params.append(key, String(item));
      } else {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  getLineups(query: LineupQuery): Observable<LineupRecord[]> {
    return this.get(`${this.baseUrl}/lineups`, this.toParams(query)).pipe(map((d) => d as LineupRecord[]));
  }

  getLineupDetail(playerIds: string[], filters: PossessionFilterQuery = {}): Observable<LineupDetail> {
    return this.get(`${this.baseUrl}/lineups/detail`, this.toParams({ ...filters, player_ids: playerIds }))
      .pipe(map((d) => d as LineupDetail));
  }

  getPlayerImpact(query: TeamFilterQuery & { min_partner_possessions?: number } = {}): Observable<PlayerImpact[]> {
    return this.get(`${this.baseUrl}/players/impact`, this.toParams(query)).pipe(map((d) => d as PlayerImpact[]));
  }

  getMeta(): Observable<MetaResponse> {
    return this.get(`${this.baseUrl}/meta`).pipe(map((d) => d as MetaResponse));
  }

  getRaw(path: string, queryString: string): Observable<{ endpoint: string; apiResponse: unknown }> {
    const endpoint = `${this.baseUrl}/${path}`;
    const params = new HttpParams({ fromString: queryString.replace(/^\?/, '') });
    const shown = queryString ? `${endpoint}?${queryString.replace(/^\?/, '')}` : endpoint;
    return this.get(endpoint, params).pipe(map((data) => ({ endpoint: shown, apiResponse: data })));
  }
}
