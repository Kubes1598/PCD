from game_engine import PoisonedCandyDuel
from database import db_service
from managers import ConnectionManager, CityMatchmakingQueue, GameTimerManager

# Shared instances that were previously global in api.py
game_engine = PoisonedCandyDuel()
db_service_instance = db_service
manager = ConnectionManager()
matchmaking_queue = CityMatchmakingQueue(game_engine, db_service_instance)
timer_manager = GameTimerManager(matchmaking_queue, game_engine, db_service_instance)

# Dependency functions for FastAPI
def get_game_engine():
    return game_engine

def get_db_service():
    return db_service_instance

def get_connection_manager():
    return manager

def get_matchmaking_queue():
    return matchmaking_queue

def get_timer_manager():
    return timer_manager
