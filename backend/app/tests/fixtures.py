import uuid
from datetime import date

from app.dbmodels.models import Game, Player, Possession, Team
from app.helpers.aggregation import COUNTING_FIELDS, clear_caches


def uid(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, name))


TEAM_A, TEAM_B = uid('team-a'), uid('team-b')
GAME_1 = uid('game-1')
A = [uid(f'a{i}') for i in range(1, 7)]   # a1..a6
B = [uid(f'b{i}') for i in range(1, 6)]   # b1..b5
A_FIVE_1 = A[0:5]   # a1..a5
A_FIVE_2 = A[1:6]   # a2..a6


def _possession(pid, off_team, def_team, off_players, def_players, period, seconds, **stats):
    values = {field: 0 for field in COUNTING_FIELDS}
    values.update(stats)
    return Possession(
        id=uid(pid), game_id=GAME_1, offensive_team_id=off_team, defensive_team_id=def_team,
        offensive_player_ids=off_players, defensive_player_ids=def_players,
        period=period, seconds=seconds, **values,
    )


def build_fixture():
    clear_caches()
    Team.objects.bulk_create([Team(id=TEAM_A, name='Alpha'), Team(id=TEAM_B, name='Bravo')])
    Game.objects.create(id=GAME_1, date=date(2025, 10, 22))
    Player.objects.bulk_create(
        [Player(id=p, name=f'A{i + 1}', team_id=TEAM_A) for i, p in enumerate(A)]
        + [Player(id=p, name=f'B{i + 1}', team_id=TEAM_B) for i, p in enumerate(B)]
    )
    Possession.objects.bulk_create([
        # p1: A five-1 scores a 2
        _possession('p1', TEAM_A, TEAM_B, A_FIVE_1, B, 1, 10.0,
                    points=2, fg2_made=1, fg2_attempted=1, fg_made=1, fg_attempted=1,
                    shot_attempts=1, shot_attempt_points=2),
        # p2: B scores a 3 (assisted) against A five-1
        _possession('p2', TEAM_B, TEAM_A, B, A_FIVE_1, 1, 12.0,
                    points=3, fg3_made=1, fg3_attempted=1, fg_made=1, fg_attempted=1,
                    shot_attempts=1, shot_attempt_points=3, assists=1),
        # p3: A five-2 misses a 2, B defensive rebound
        _possession('p3', TEAM_A, TEAM_B, A_FIVE_2, B, 2, 15.0,
                    fg2_attempted=1, fg_attempted=1, shot_attempts=1,
                    rebounds_defense=1, rebound_opportunities=1),
        # p4: B turns it over, A five-2 steal
        _possession('p4', TEAM_B, TEAM_A, B, A_FIVE_2, 2, 8.0, turnovers=1, steals=1),
    ])
