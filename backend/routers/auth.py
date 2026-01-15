"""
Authentication Router - Production Ready

Handles user registration, login, and token management.
Uses proper validation and never exposes internal errors.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import JSONResponse
from schemas import RegisterRequest, LoginRequest, SuccessResponse
from error_codes import ErrorCode, get_error_message
from utils.security import (
    hash_password, verify_password, 
    create_access_token, create_refresh_token, verify_refresh_token,
    get_current_user
)
from dependencies import get_db_service
import secrets
import logging

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=SuccessResponse)
async def register_user(request: RegisterRequest, db_service=Depends(get_db_service)):
    """
    Register a new user with email and password.
    
    Validation is handled by Pydantic schema:
    - Email: Valid format required
    - Password: Min 8 chars, uppercase, lowercase, digit
    - Username: 3-20 chars, alphanumeric + underscore, starts with letter
    """
    try:
        # Check for existing email
        existing_user = await db_service.get_user_by_email(request.email.lower())
        if existing_user:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": get_error_message(ErrorCode.EMAIL_ALREADY_EXISTS),
                    "error_code": ErrorCode.EMAIL_ALREADY_EXISTS.value
                }
            )
        
        # Check for existing username
        existing_player = await db_service.get_player(request.username)
        if existing_player:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": get_error_message(ErrorCode.USERNAME_TAKEN),
                    "error_code": ErrorCode.USERNAME_TAKEN.value
                }
            )
        
        # Create user with proper UUID (Supabase requires UUID format)
        import uuid
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": request.email.lower(),
            "name": request.username,
            "username": request.username, # Compatibility with frontend
            "password_hash": hash_password(request.password),
            "coin_balance": request.initial_coins if request.initial_coins is not None else 1000,
            "diamonds_balance": request.initial_diamonds if request.initial_diamonds is not None else 5,
            "games_played": 0,
            "games_won": 0,
            "profile_id": secrets.token_hex(4).upper()
        }
        
        new_user_id = await db_service.create_user(user)
        
        # Generate both access and refresh tokens
        access_token = create_access_token(data={"sub": new_user_id})
        refresh_token = create_refresh_token(data={"sub": new_user_id})
        
        # Never return password_hash
        user_public = {k: v for k, v in user.items() if k != "password_hash"}
        
        logger.info(f"✅ New user registered: {request.username}")
        
        return {
            "success": True,
            "message": "Welcome aboard! Your account is ready.",
            "data": {
                "token": access_token,
                "refresh_token": refresh_token,
                "user": user_public
            }
        }
        
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.post("/login", response_model=SuccessResponse)
async def login_user(request: LoginRequest, db_service=Depends(get_db_service)):
    """Login with email and password."""
    try:
        user = await db_service.get_user_by_email(request.email.lower())
        
        # Use constant-time comparison to prevent timing attacks
        if not user or not verify_password(request.password, user.get("password_hash", "")):
            # Log failed attempt (for monitoring)
            logger.warning(f"Failed login attempt for email: {request.email[:3]}***")
            
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "message": get_error_message(ErrorCode.INVALID_CREDENTIALS),
                    "error_code": ErrorCode.INVALID_CREDENTIALS.value
                }
            )
        
        # Generate both access and refresh tokens
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})
        user_public = {k: v for k, v in user.items() if k != "password_hash"}
        if "name" in user_public and "username" not in user_public:
            user_public["username"] = user_public["name"]
        
        logger.info(f"✅ User logged in: {user.get('name')}")
        
        return {
            "success": True,
            "message": "Welcome back!",
            "data": {
                "token": access_token,
                "refresh_token": refresh_token,
                "user": user_public
            }
        }
        
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.post("/logout")
async def logout_user(user: dict = Depends(get_current_user)):
    """
    Logout and invalidate token.
    
    Note: For simple implementation, client discards token.
    For stronger security, token could be added to Redis blacklist.
    """
    logger.info(f"User logged out: {user.get('name', 'unknown')}")
    return {"success": True, "message": "Logged out successfully"}


@router.post("/refresh", response_model=SuccessResponse)
async def refresh_access_token(
    refresh_token: str = Body(..., embed=True),
    db_service=Depends(get_db_service)
):
    """
    Exchange a valid refresh token for a new access token.
    
    This endpoint allows clients to get a new access token without
    re-authenticating with email/password when their access token expires.
    
    Request body:
        refresh_token: The refresh token received during login/register
        
    Returns:
        New access token (refresh token remains valid until its expiration)
    """
    try:
        # Verify the refresh token
        payload = verify_refresh_token(refresh_token)
        
        if not payload:
            logger.warning("Invalid refresh token attempted")
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "message": "Invalid or expired refresh token",
                    "error_code": ErrorCode.TOKEN_INVALID.value
                }
            )
        
        user_id = payload.get("sub")
        if not user_id:
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "message": "Invalid refresh token",
                    "error_code": ErrorCode.TOKEN_INVALID.value
                }
            )
        
        # Verify user still exists
        user = await db_service.get_user_by_id(user_id)
        if not user:
            logger.warning(f"Refresh token for non-existent user: {user_id[:8]}...")
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "message": "User not found",
                    "error_code": ErrorCode.TOKEN_INVALID.value
                }
            )
        
        # Generate new access token
        new_access_token = create_access_token(data={"sub": user_id})
        
        logger.info(f"✅ Token refreshed for user: {user.get('name')}")
        
        return {
            "success": True,
            "message": "Token refreshed successfully",
            "data": {
                "token": new_access_token,
                "token_type": "bearer"
            }
        }
        
    except Exception as e:
        logger.error(f"Token refresh error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.get("/me", response_model=SuccessResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user data."""
    user_public = {k: v for k, v in user.items() if k != "password_hash"}
    if "name" in user_public and "username" not in user_public:
        user_public["username"] = user_public["name"]
    return {
        "success": True,
        "message": "User data retrieved",
        "data": {"user": user_public}
    }
