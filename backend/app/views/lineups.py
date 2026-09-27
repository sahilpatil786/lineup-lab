# -*- coding: utf-8 -*-
import logging

from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from app.helpers.aggregation import SORTABLE_FIELDS
from app.helpers.lineups import InvalidLineup, LineupNotFound, get_lineup_detail, get_lineup_league_summary_stats
from app.helpers.meta import get_meta
from app.helpers.players import get_player_impact

LOGGER = logging.getLogger('django')

LIST_PARAMS = {'team_id', 'opponent_team_id', 'include_players', 'game_id', 'period', 'player_ids'}


def _parse_int_query_param(request, key, default, minimum=None, maximum=None):
    raw_value = request.query_params.get(key, default)
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        value = default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def _query_data(request) -> dict:
    """Accept both ?team_id=a&team_id=b and ?team_id=a,b for list params."""
    data = {}
    for key in request.query_params:
        if key in LIST_PARAMS:
            values = []
            for raw in request.query_params.getlist(key):
                values.extend(part.strip() for part in raw.split(',') if part.strip())
            data[key] = values
        else:
            data[key] = request.query_params.get(key)
    return data


def _uuid_list(**kwargs):
    return serializers.ListField(child=serializers.UUIDField(), required=False, **kwargs)


class PossessionFilterSerializer(serializers.Serializer):
    game_id = _uuid_list()
    period = serializers.ListField(child=serializers.IntegerField(min_value=1, max_value=4), required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs.get('date_from') and attrs.get('date_to') and attrs['date_from'] > attrs['date_to']:
            raise serializers.ValidationError({'date_to': 'Must be on or after date_from.'})
        return attrs

    def possession_filters(self) -> dict:
        data = self.validated_data
        return {
            'game_ids': [str(game_id) for game_id in data.get('game_id', [])],
            'periods': data.get('period', []),
            'date_from': data.get('date_from'),
            'date_to': data.get('date_to'),
        }


class TeamFilterSerializer(PossessionFilterSerializer):
    team_id = _uuid_list()
    opponent_team_id = _uuid_list()

    def team_filters(self) -> dict:
        data = self.validated_data
        return {
            'team_ids': [str(team_id) for team_id in data.get('team_id', [])],
            'opponent_team_ids': [str(team_id) for team_id in data.get('opponent_team_id', [])],
        }


class LineupQuerySerializer(TeamFilterSerializer):
    include_players = _uuid_list()
    min_possessions = serializers.IntegerField(min_value=0, required=False, default=0)
    sort_by = serializers.ChoiceField(choices=SORTABLE_FIELDS, required=False, default='total_possessions')
    order = serializers.ChoiceField(choices=('asc', 'desc'), required=False, default='desc')
    limit = serializers.IntegerField(min_value=1, max_value=1000, required=False)


class LineupDetailQuerySerializer(PossessionFilterSerializer):
    player_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=5)


class PlayerImpactQuerySerializer(TeamFilterSerializer):
    min_partner_possessions = serializers.IntegerField(min_value=0, required=False, default=20)


class LineupsLeagueSummary(APIView):
    logger = LOGGER

    def get(self, request):
        """Return the league-wide lineup summary."""
        lineup_size = _parse_int_query_param(request, 'lineup_size', 5, minimum=1, maximum=5)
        serializer = LineupQuerySerializer(data=_query_data(request))
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        include_players = sorted({str(pid) for pid in data.get('include_players', [])})
        if len(include_players) > lineup_size:
            raise ValidationError(
                {'include_players': f'Cannot include more players than lineup_size ({lineup_size}).'}
            )
        return Response(get_lineup_league_summary_stats(
            lineup_size,
            include_players=include_players,
            min_possessions=data['min_possessions'],
            sort_by=data['sort_by'],
            order=data['order'],
            limit=data.get('limit'),
            **serializer.team_filters(),
            **serializer.possession_filters(),
        ))


class LineupDetail(APIView):
    logger = LOGGER

    def get(self, request):
        serializer = LineupDetailQuerySerializer(data=_query_data(request))
        serializer.is_valid(raise_exception=True)
        player_ids = [str(pid) for pid in serializer.validated_data['player_ids']]
        try:
            return Response(get_lineup_detail(player_ids, **serializer.possession_filters()))
        except InvalidLineup as error:
            raise ValidationError({'player_ids': str(error)})
        except LineupNotFound:
            raise NotFound('These players never shared the floor under the current filters.')


class PlayersImpact(APIView):
    logger = LOGGER

    def get(self, request):
        serializer = PlayerImpactQuerySerializer(data=_query_data(request))
        serializer.is_valid(raise_exception=True)
        return Response(get_player_impact(
            min_partner_possessions=serializer.validated_data['min_partner_possessions'],
            **serializer.team_filters(),
            **serializer.possession_filters(),
        ))


class LeagueMeta(APIView):
    logger = LOGGER

    def get(self, request):
        return Response(get_meta())
