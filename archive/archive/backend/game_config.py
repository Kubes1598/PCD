"""
Game Configuration - Single Source of Truth

This file centralizes all game constants for the backend.
The frontend should fetch these values from /api/config.
"""

# Win Condition
WIN_THRESHOLD = 11  # Collect 11 candies to win
CANDY_COUNT = 12    # Each player has 12 candies (4x3 grid)

# City/Arena Configuration
CITY_CONFIG = {
    "Dubai": {
        "entry_fee": 500,
        "prize_amount": 900,
        "turn_timer": 30,
        "difficulty": "easy",
        "entryFee": 500,
        "prizeAmount": 900,
        "turnTimer": 30,
    },
    "Cairo": {
        "entry_fee": 1000,
        "prize_amount": 1800,
        "turn_timer": 20,
        "difficulty": "medium",
        "entryFee": 1000,
        "prizeAmount": 1800,
        "turnTimer": 20,
    },
    "Oslo": {
        "entry_fee": 5000,
        "prize_amount": 9000,
        "turn_timer": 10,
        "difficulty": "hard",
        "entryFee": 5000,
        "prizeAmount": 9000,
        "turnTimer": 10,
    },
}

# AI Mode Configuration
AI_CONFIG = {
    "easy": {"entry_fee": 0, "prize_amount": 0, "turn_timer": 30},
    "medium": {"entry_fee": 100, "prize_amount": 180, "turn_timer": 20},
    "hard": {"entry_fee": 250, "prize_amount": 450, "turn_timer": 10},
}

# Initial Player Balances
INITIAL_BALANCE = {
    "coins": 1000,
    "diamonds": 5,
}

# Daily Reward Stages
DAILY_REWARDS = [
    {"coins": 100, "diamonds": 0},
    {"coins": 200, "diamonds": 0},
    {"coins": 500, "diamonds": 0},
    {"coins": 1000, "diamonds": 0},
    {"coins": 0, "diamonds": 5},
]

# Ranking Thresholds
RANK_THRESHOLDS = {
    "Pro": 10,
    "WorldClass": 40,
    "Legendary": 100,
    "Champion": 200,
}
