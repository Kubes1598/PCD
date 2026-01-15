"""
Pydantic Schemas - Production Ready Validation

All request/response schemas with strict validation.
Centralizes validation logic to prevent injection and ensure data integrity.
"""

from pydantic import BaseModel, Field, EmailStr, validator, root_validator
from typing import Optional, List, Dict, Any, Set
import re


# =============================================================================
# AUTHENTICATION SCHEMAS
# =============================================================================

class RegisterRequest(BaseModel):
    """Registration request with strong validation."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    username: str = Field(..., min_length=3, max_length=20)
    initial_coins: Optional[int] = Field(None, ge=0)
    initial_diamonds: Optional[int] = Field(None, ge=0)
    
    @validator('password')
    def password_strength(cls, v):
        """Enforce password complexity."""
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        # Check for common weak patterns
        weak_patterns = ['password', '12345678', 'qwerty', 'letmein']
        if v.lower() in weak_patterns:
            raise ValueError('Password is too common. Please choose a stronger one.')
        return v
    
    @validator('username')
    def username_valid(cls, v):
        """Username validation - alphanumeric and underscores only."""
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', v):
            raise ValueError('Username must start with a letter and contain only letters, numbers, and underscores')
        # Check for reserved names
        reserved = ['admin', 'system', 'moderator', 'support', 'help', 'ai', 'computer', 'opponent']
        if v.lower() in reserved:
            raise ValueError('This username is reserved')
        return v


class LoginRequest(BaseModel):
    """Login request."""
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    """Token response for auth endpoints."""
    token: str
    user: Dict[str, Any]


# =============================================================================
# GAME SCHEMAS
# =============================================================================

class CreateGameRequest(BaseModel):
    """Create a new game."""
    player1_name: str = Field(..., min_length=1, max_length=50)
    player2_name: str = Field(..., min_length=1, max_length=50)
    
    @validator('player1_name', 'player2_name')
    def sanitize_name(cls, v):
        """Sanitize player names."""
        # Remove any potentially dangerous characters
        sanitized = re.sub(r'[<>"\';]', '', v.strip())
        if not sanitized:
            raise ValueError('Invalid player name')
        return sanitized


class SetPoisonRequest(BaseModel):
    """Set poison candy choice."""
    player_id: str = Field(..., min_length=1, max_length=100)
    poison_candy: str = Field(..., min_length=1, max_length=50)
    
    @validator('poison_candy')
    def validate_candy_id(cls, v):
        """Validate candy ID format."""
        # Allow alphanumeric, underscores, hyphens
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid candy format')
        return v


class PickCandyRequest(BaseModel):
    """Pick a candy from opponent's pool."""
    player: str = Field(..., min_length=1, max_length=100)
    candy_choice: str = Field(..., min_length=1, max_length=50)
    
    @validator('candy_choice')
    def validate_candy_id(cls, v):
        """Validate candy ID format."""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid candy format')
        return v


class CandySelectionRequest(BaseModel):
    """Candy selection confirmation."""
    player_id: str = Field(..., min_length=1, max_length=100)
    candy_id: str = Field(..., min_length=1, max_length=50)
    game_id: str = Field(..., min_length=1, max_length=100)


class GameStartRequest(BaseModel):
    """Signal game start."""
    game_id: str = Field(..., min_length=1, max_length=100)
    player_id: str = Field(..., min_length=1, max_length=100)


# =============================================================================
# MATCHMAKING SCHEMAS
# =============================================================================

VALID_CITIES = {'dubai', 'cairo', 'oslo'}


class JoinMatchmakingRequest(BaseModel):
    """Join matchmaking queue."""
    player_name: str = Field(..., min_length=1, max_length=50)
    city: str = Field(..., min_length=1, max_length=20)
    
    @validator('city')
    def validate_city(cls, v):
        """Validate city is one of the allowed values."""
        city_lower = v.lower().strip()
        if city_lower not in VALID_CITIES:
            raise ValueError(f'Invalid city. Valid options: {", ".join(VALID_CITIES)}')
        return city_lower
    
    @validator('player_name')
    def sanitize_name(cls, v):
        """Sanitize player name."""
        sanitized = re.sub(r'[<>"\';]', '', v.strip())
        if not sanitized:
            raise ValueError('Invalid player name')
        return sanitized


# =============================================================================
# WEBSOCKET MESSAGE SCHEMAS
# =============================================================================

class WSMessageBase(BaseModel):
    """Base WebSocket message."""
    type: str = Field(..., min_length=1, max_length=50)
    
    @validator('type')
    def validate_type(cls, v):
        """Validate message type format."""
        if not re.match(r'^[a-z_]+$', v):
            raise ValueError('Invalid message type format')
        return v


class WSJoinQueueMessage(WSMessageBase):
    """Join matchmaking queue via WebSocket."""
    player_name: str = Field(..., min_length=1, max_length=50)
    city: str = Field(..., min_length=1, max_length=20)
    
    @validator('city')
    def validate_city(cls, v):
        city_lower = v.lower().strip()
        if city_lower not in VALID_CITIES:
            raise ValueError(f'Invalid city')
        return city_lower


class WSMoveMessage(WSMessageBase):
    """Game move via WebSocket."""
    target_id: str = Field(..., min_length=1, max_length=100)
    move: Optional[str] = Field(None, max_length=50)
    candy: Optional[str] = Field(None, max_length=50)
    
    @validator('move', 'candy')
    def validate_candy(cls, v):
        if v is not None and not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid candy format')
        return v


class WSPoisonMessage(WSMessageBase):
    """Poison selection via WebSocket."""
    target_id: str = Field(..., min_length=1, max_length=100)
    candy: str = Field(..., min_length=1, max_length=50)
    
    @validator('candy')
    def validate_candy(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid candy format')
        return v


# =============================================================================
# PLAYER SCHEMAS
# =============================================================================

class PlayerBalanceRequest(BaseModel):
    """Get player balance."""
    player_name: str = Field(..., min_length=1, max_length=50)


class PlayerStatsRequest(BaseModel):
    """Update player stats."""
    player_name: str = Field(..., min_length=1, max_length=50)
    won: bool


class AddFriendRequest(BaseModel):
    """Add a friend by profile ID."""
    player_name: str = Field(..., min_length=1, max_length=50)
    friend_profile_id: str = Field(..., min_length=1, max_length=20)
    
    @validator('friend_profile_id')
    def validate_profile_id(cls, v):
        """Profile ID should be alphanumeric."""
        if not re.match(r'^[A-Za-z0-9]+$', v):
            raise ValueError('Invalid profile ID format')
        return v.upper()


class ClaimQuestRequest(BaseModel):
    """Claim a quest reward."""
    player_name: str = Field(..., min_length=1, max_length=50)
    quest_id: str = Field(..., min_length=1, max_length=50)


# =============================================================================
# AI SCHEMAS
# =============================================================================

class AIMoveRequest(BaseModel):
    """Request AI move calculation."""
    player_candies: List[str] = Field(..., min_items=1, max_items=20)
    opponent_collection: List[str] = Field(default_factory=list, max_items=20)
    player_poison: str = Field(..., min_length=1, max_length=50)
    difficulty: str = Field(..., pattern=r'^(easy|medium|hard)$')
    
    @validator('player_candies', 'opponent_collection', each_item=True)
    def validate_candy_items(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid candy format')
        return v


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    message: str
    error_code: str
    details: Optional[Dict[str, Any]] = None


class SuccessResponse(BaseModel):
    """Standard success response."""
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None


class GameResponse(BaseModel):
    """Game-related response."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
