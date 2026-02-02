"""
Security Dependencies

Additional auth-related dependencies for protecting endpoints.
"""

from fastapi import Depends, HTTPException, status
from fastapi.responses import JSONResponse
from utils.security import get_current_user
from error_codes import ErrorCode, get_error_message
import logging

logger = logging.getLogger(__name__)


async def get_non_guest_user(user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that ensures the current user is NOT a guest.
    
    Use this on endpoints that guests shouldn't access:
    - Quests
    - Friends
    - Profile customization (future)
    
    Raises:
        HTTPException: 403 Forbidden if user is a guest
    """
    is_guest = user.get("is_guest", False) or user.get("id", "").startswith("guest_")
    
    if is_guest:
        logger.warning(f"Guest user attempted to access restricted endpoint: {user.get('id', 'unknown')[:12]}...")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "This feature requires a full account. Please sign up to continue!",
                "error_code": "GUEST_NOT_ALLOWED"
            }
        )
    
    return user


async def verify_player_ownership(player_name: str, user: dict = Depends(get_current_user)) -> str:
    """
    Verify that the authenticated user owns the player profile.
    
    Prevents: User A from modifying User B's stats/balance/etc.
    
    Args:
        player_name: The player name from the request
        user: Current authenticated user
        
    Returns:
        player_name if verification passes
        
    Raises:
        HTTPException: 403 if user doesn't own the player
    """
    # Get the user's player name
    user_player_name = user.get("name") or user.get("username")
    
    if not user_player_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "User profile incomplete",
                "error_code": ErrorCode.VALIDATION_ERROR.value
            }
        )
    
    # Verify ownership
    if player_name != user_player_name:
        logger.warning(f"User {user_player_name} attempted to access {player_name}'s data")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You can only access your own player data",
                "error_code": "INSUFFICIENT_PERMISSIONS"
            }
        )
    
    return player_name
