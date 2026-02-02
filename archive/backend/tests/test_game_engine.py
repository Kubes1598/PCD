import pytest
import time
from game_engine import PoisonedCandyDuel, GameState, GameResult
from game_config import WIN_THRESHOLD

@pytest.fixture
def engine():
    return PoisonedCandyDuel()

def test_setup_errors_comprehensive(engine):
    gid = engine.create_game("A", "B")
    p1id = engine.games[gid].player1.id
    c1 = list(engine.games[gid].player1.owned_candies)
    # GID mismatch
    assert engine.set_poison_choice("bad", p1id, c1[0]) is False
    # PID mismatch
    assert engine.set_poison_choice(gid, "bad", c1[0]) is False
    # Candy mismatch
    assert engine.set_poison_choice(gid, p1id, "no") is False
    # State mismatch
    engine.games[gid].state = GameState.FINISHED
    assert engine.set_poison_choice(gid, p1id, c1[0]) is False
    engine.games[gid].state = GameState.SETUP
    # Success
    assert engine.set_poison_choice(gid, p1id, c1[0]) is True
    # Duplicate
    assert engine.set_poison_choice(gid, p1id, c1[0]) is False

def test_math_win_and_logic(engine):
    gid = engine.create_game("M1", "M2")
    g = engine.games[gid]
    p1id, p2id = g.player1.id, g.player2.id
    c1, c2 = list(g.player1.owned_candies), list(g.player2.owned_candies)
    engine.set_poison_choice(gid, p1id, c1[0])
    engine.set_poison_choice(gid, p2id, c2[0])
    
    # Hit Math Win P1 (Line 321)
    g.player1.collected_candies = c2[1:11] # 10
    g.player2.collected_candies = c1[1:2]  # 1
    g.current_turn = 13 # P1 turn
    # P1 picks safe candy 11
    res = engine.make_move(gid, p1id, c2[11])
    assert res.get("result") == "player1_win"

    # Hit Math Win P2 (Line 324)
    gid2 = engine.create_game("M3", "M4")
    g2 = engine.games[gid2]
    engine.set_poison_choice(gid2, g2.player1.id, list(g2.player1.owned_candies)[0])
    engine.set_poison_choice(gid2, g2.player2.id, list(g2.player2.owned_candies)[0])
    g2.player2.collected_candies = list(g2.player1.owned_candies)[1:11]
    g2.player1.collected_candies = ["X"]
    g2.current_turn = 14 # P2 turn
    res2 = engine.make_move(gid2, g2.player2.id, list(g2.player1.owned_candies)[11])
    assert res2.get("result") == "player2_win"

def test_draw_condition_final(engine):
    # DRAW check (Line 287)
    gid = engine.create_game("D1", "D2")
    gd = engine.games[gid]
    engine.set_poison_choice(gid, gd.player1.id, list(gd.player1.owned_candies)[0])
    engine.set_poison_choice(gid, gd.player2.id, list(gd.player2.owned_candies)[0])
    gd.player1.collected_candies = ["C"] * (WIN_THRESHOLD - 1)
    gd.player2.collected_candies = ["X"] * WIN_THRESHOLD
    gd.player2.owned_candies.add("SAFE")
    gd.current_turn = 1 # P1 turn
    res = engine.make_move(gid, gd.player1.id, "SAFE")
    assert res.get("result") == "draw"

def test_api_coverage_final(engine):
    gid = engine.create_game("A1", "A2")
    # update_game_state branches
    assert engine.update_game_state("no", {}) is False
    engine.update_game_state(gid, {"player1": {"candy_confirmed": True}, "status": "ok"})
    engine.update_game_state(gid, {"player1": {"candy_confirmed": False}, "status": "no"})
    assert engine.get_game_state(gid)["status"] == "no"
    assert engine.get_game_state("none") is None

def test_load_and_indexing_fixed(engine):
    data = {
        "id": "L1",
        "game_state": {
            "state": "playing", "current_turn": 1, "result": "ongoing",
            "player1": {"id": "P1", "name": "A", "owned_candies": ["A"], "collected_candies": [], "poison_choice": "A"},
            "player2": {"id": "P2", "name": "B", "owned_candies": ["B"], "collected_candies": [], "poison_choice": "B"},
        }
    }
    assert engine.load_game_from_data(data) is True
    # Check both players' games lists
    assert "L1" in engine.get_player_games("P1")[0]["game_id"]
    assert len(engine.get_player_games("P2")) == 1
    
    engine.games["L1"].last_updated = 0
    assert engine.cleanup_old_games() >= 1

def test_helpers_final(engine):
    e = PoisonedCandyDuel()
    gid = e.create_game("X", "Y")
    g = e.games[gid]
    g.player1.poison_choice = "P"
    from game_engine import GameResult
    assert e._check_game_end(g, g.player1, "not") == GameResult.ONGOING
    assert e._check_game_end(g, g.player2, "P") == GameResult.PLAYER1_WIN
    g.player1.collected_candies = ["X"] * WIN_THRESHOLD
    g.player2.collected_candies = ["Y"] * WIN_THRESHOLD
    assert e._check_game_end(g, g.player1, "not") == GameResult.DRAW
