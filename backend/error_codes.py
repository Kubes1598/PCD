"""
Centralized Error Codes - Production Ready

All error codes and user-friendly messages are defined here.
NEVER expose internal error details to the client.
"""

from enum import Enum


class ErrorCode(str, Enum):
    """Enumeration of all error codes used in the API."""
    
    # Authentication Errors (1xxx)
    INVALID_CREDENTIALS = "AUTH_1001"
    TOKEN_EXPIRED = "AUTH_1002"
    TOKEN_INVALID = "AUTH_1003"
    EMAIL_ALREADY_EXISTS = "AUTH_1004"
    USERNAME_TAKEN = "AUTH_1005"
    WEAK_PASSWORD = "AUTH_1006"
    INVALID_EMAIL = "AUTH_1007"
    NOT_AUTHENTICATED = "AUTH_1008"
    
    # Game Errors (2xxx)
    GAME_NOT_FOUND = "GAME_2001"
    NOT_YOUR_TURN = "GAME_2002"
    INVALID_CANDY = "GAME_2003"
    GAME_ALREADY_FINISHED = "GAME_2004"
    POISON_ALREADY_SET = "GAME_2005"
    INVALID_GAME_STATE = "GAME_2006"
    PLAYER_NOT_IN_GAME = "GAME_2007"
    CANDY_NOT_AVAILABLE = "GAME_2008"
    
    # Matchmaking Errors (3xxx)
    INSUFFICIENT_BALANCE = "MATCH_3001"
    ALREADY_IN_QUEUE = "MATCH_3002"
    INVALID_CITY = "MATCH_3003"
    MATCHMAKING_TIMEOUT = "MATCH_3004"
    NOT_IN_QUEUE = "MATCH_3005"
    
    # Rate Limiting (4xxx)
    RATE_LIMIT_EXCEEDED = "RATE_4001"
    TOO_MANY_REQUESTS = "RATE_4002"
    
    # Validation Errors (42xx)
    VALIDATION_ERROR = "VALID_4200"
    INVALID_INPUT = "VALID_4201"
    MISSING_FIELD = "VALID_4202"
    
    # Server Errors (5xxx)
    INTERNAL_ERROR = "SERVER_5001"
    DATABASE_ERROR = "SERVER_5002"
    REDIS_ERROR = "SERVER_5003"
    SERVICE_UNAVAILABLE = "SERVER_5004"


# User-friendly messages (NEVER expose internal details)
ERROR_MESSAGES = {
    # Auth
    ErrorCode.INVALID_CREDENTIALS: "Invalid email or password. Please try again.",
    ErrorCode.TOKEN_EXPIRED: "Your session has expired. Please log in again.",
    ErrorCode.TOKEN_INVALID: "Invalid authentication. Please log in again.",
    ErrorCode.EMAIL_ALREADY_EXISTS: "This email is already registered.",
    ErrorCode.USERNAME_TAKEN: "This username is already taken. Try another one!",
    ErrorCode.WEAK_PASSWORD: "Password must be at least 8 characters with uppercase, lowercase, and numbers.",
    ErrorCode.INVALID_EMAIL: "Please enter a valid email address.",
    ErrorCode.NOT_AUTHENTICATED: "Please log in to continue.",
    
    # Game
    ErrorCode.GAME_NOT_FOUND: "Game not found. It may have ended or expired.",
    ErrorCode.NOT_YOUR_TURN: "It's not your turn yet!",
    ErrorCode.INVALID_CANDY: "Invalid candy selection. Please pick a valid candy.",
    ErrorCode.GAME_ALREADY_FINISHED: "This game has already ended.",
    ErrorCode.POISON_ALREADY_SET: "You've already set your poison candy.",
    ErrorCode.INVALID_GAME_STATE: "Invalid game state for this action.",
    ErrorCode.PLAYER_NOT_IN_GAME: "You are not a player in this game.",
    ErrorCode.CANDY_NOT_AVAILABLE: "This candy is not available to pick.",
    
    # Matchmaking
    ErrorCode.INSUFFICIENT_BALANCE: "Not enough coins to enter this arena.",
    ErrorCode.ALREADY_IN_QUEUE: "You're already searching for a match!",
    ErrorCode.INVALID_CITY: "Invalid arena selected.",
    ErrorCode.MATCHMAKING_TIMEOUT: "Couldn't find a match. Try again!",
    ErrorCode.NOT_IN_QUEUE: "You're not in the matchmaking queue.",
    
    # Rate Limiting
    ErrorCode.RATE_LIMIT_EXCEEDED: "Too many requests. Please slow down!",
    ErrorCode.TOO_MANY_REQUESTS: "You're doing that too fast. Take a breather!",
    
    # Validation
    ErrorCode.VALIDATION_ERROR: "Invalid input. Please check your data.",
    ErrorCode.INVALID_INPUT: "The provided input is invalid.",
    ErrorCode.MISSING_FIELD: "A required field is missing.",
    
    # Server
    ErrorCode.INTERNAL_ERROR: "Something went wrong. Our team has been notified!",
    ErrorCode.DATABASE_ERROR: "We're having trouble saving your data. Please try again.",
    ErrorCode.REDIS_ERROR: "Temporary service issue. Please try again.",
    ErrorCode.SERVICE_UNAVAILABLE: "Service temporarily unavailable. Please try again later.",
}


def get_error_message(code: ErrorCode) -> str:
    """Get user-friendly message for an error code."""
    return ERROR_MESSAGES.get(code, ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR])
