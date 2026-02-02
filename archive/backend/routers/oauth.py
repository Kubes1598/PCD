"""
OAuth Router - Google & Apple Sign-In

Handles OAuth authentication flows for Google and Apple.
Designed to work once API keys are configured in .env file.

Required Environment Variables:
- GOOGLE_CLIENT_ID: From Google Cloud Console
- APPLE_CLIENT_ID: Your app's bundle ID
- APPLE_TEAM_ID: Your Apple Developer Team ID
- APPLE_KEY_ID: Key ID for Sign in with Apple
- APPLE_PRIVATE_KEY: Contents of the .p8 key file
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
from datetime import timedelta
import secrets
import logging
import httpx

from config import settings
from error_codes import ErrorCode, get_error_message
from utils.security import create_access_token, create_refresh_token
from dependencies import get_db_service

router = APIRouter(prefix="/auth", tags=["OAuth"])
logger = logging.getLogger(__name__)


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class GoogleAuthRequest(BaseModel):
    """Google OAuth token from client."""
    id_token: str = Field(..., min_length=10, description="Google ID token from client SDK")


class AppleAuthRequest(BaseModel):
    """Apple Sign-In credentials from client."""
    identity_token: str = Field(..., min_length=10, description="Apple identity token")
    authorization_code: str = Field(..., min_length=10, description="Apple authorization code")
    user: Optional[dict] = Field(None, description="User info (only on first sign-in)")
    

class GuestAuthRequest(BaseModel):
    """Optional device ID for guest persistence."""
    device_id: Optional[str] = Field(None, max_length=100, description="Device identifier for guest persistence")


# =============================================================================
# OAUTH STATUS ENDPOINT
# =============================================================================

@router.get("/oauth/status")
async def get_oauth_status():
    """
    Check which OAuth providers are configured.
    Frontend uses this to show/hide OAuth buttons.
    """
    return {
        "success": True,
        "data": {
            "google": settings.is_google_configured,
            "apple": settings.is_apple_configured,
            "email": True,  # Always available
            "guest": True,  # Always available
        }
    }


# =============================================================================
# GOOGLE SIGN-IN
# =============================================================================

@router.post("/google")
async def google_auth(request: GoogleAuthRequest, db_service=Depends(get_db_service)):
    """
    Authenticate with Google ID token.
    
    Flow:
    1. Client signs in with Google SDK and gets ID token
    2. Client sends ID token to this endpoint
    3. We verify token with Google's servers
    4. Create/update user and return JWT
    """
    if not settings.is_google_configured:
        logger.warning("Google OAuth attempted but not configured")
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": "Google Sign-In is not configured yet. Please use email or guest login.",
                "error_code": "OAUTH_NOT_CONFIGURED"
            }
        )
    
    try:
        # Verify the Google ID token
        google_user = await verify_google_token(request.id_token)
        
        if not google_user:
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "message": "Invalid Google token",
                    "error_code": ErrorCode.TOKEN_INVALID.value
                }
            )
        
        # Find or create user
        user = await find_or_create_oauth_user(
            db_service=db_service,
            provider="google",
            oauth_id=google_user["sub"],
            email=google_user.get("email"),
            name=google_user.get("name", f"Player_{secrets.token_hex(4)}")
        )
        
        # Generate tokens
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})
        
        logger.info(f"✅ Google sign-in successful for: {user.get('name')}")
        
        return {
            "success": True,
            "message": "Welcome!",
            "data": {
                "token": access_token,
                "refresh_token": refresh_token,
                "user": {k: v for k, v in user.items() if k != "password_hash"}
            }
        }
        
    except Exception as e:
        logger.error(f"Google auth error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


async def verify_google_token(id_token: str) -> Optional[dict]:
    """
    Verify Google ID token with Google's servers.
    
    Returns:
        User info dict with 'sub', 'email', 'name', etc. or None if invalid
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
            )
            
            if response.status_code != 200:
                logger.warning(f"Google token verification failed: {response.status_code}")
                return None
            
            data = response.json()
            
            # Verify the token is for our app
            if data.get("aud") != settings.GOOGLE_CLIENT_ID:
                logger.warning("Google token audience mismatch")
                return None
            
            return data
            
    except Exception as e:
        logger.error(f"Error verifying Google token: {e}")
        return None


# =============================================================================
# APPLE SIGN-IN
# =============================================================================

@router.post("/apple")
async def apple_auth(request: AppleAuthRequest, db_service=Depends(get_db_service)):
    """
    Authenticate with Apple Sign-In.
    
    Flow:
    1. Client signs in with Apple SDK
    2. Client sends identity token + authorization code
    3. We verify token with Apple's servers
    4. Create/update user and return JWT
    
    Note: Apple only sends user info on FIRST sign-in. After that,
    we must use the stored user data.
    """
    if not settings.is_apple_configured:
        logger.warning("Apple OAuth attempted but not configured")
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": "Apple Sign-In is not configured yet. Please use email or guest login.",
                "error_code": "OAUTH_NOT_CONFIGURED"
            }
        )
    
    try:
        # Verify the Apple identity token
        apple_user = await verify_apple_token(request.identity_token)
        
        if not apple_user:
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "message": "Invalid Apple token",
                    "error_code": ErrorCode.TOKEN_INVALID.value
                }
            )
        
        # Get name from request.user (only available on first sign-in)
        name = None
        if request.user:
            first = request.user.get("name", {}).get("firstName", "")
            last = request.user.get("name", {}).get("lastName", "")
            name = f"{first} {last}".strip() or None
        
        # Find or create user
        user = await find_or_create_oauth_user(
            db_service=db_service,
            provider="apple",
            oauth_id=apple_user["sub"],
            email=apple_user.get("email"),
            name=name or f"Player_{secrets.token_hex(4)}"
        )
        
        # Generate tokens
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})
        
        logger.info(f"✅ Apple sign-in successful for: {user.get('name')}")
        
        return {
            "success": True,
            "message": "Welcome!",
            "data": {
                "token": access_token,
                "refresh_token": refresh_token,
                "user": {k: v for k, v in user.items() if k != "password_hash"}
            }
        }
        
    except Exception as e:
        logger.error(f"Apple auth error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


async def verify_apple_token(identity_token: str) -> Optional[dict]:
    """
    Verify Apple identity token using Apple's public keys.
    
    Returns:
        User info dict with 'sub', 'email', etc. or None if invalid
    """
    try:
        import jwt
        from jwt import PyJWKClient
        
        # Fetch Apple's public keys
        jwks_client = PyJWKClient("https://appleid.apple.com/auth/keys")
        signing_key = jwks_client.get_signing_key_from_jwt(identity_token)
        
        # Decode and verify
        data = jwt.decode(
            identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer="https://appleid.apple.com"
        )
        
        return data
        
    except Exception as e:
        logger.error(f"Error verifying Apple token: {e}")
        return None


# =============================================================================
# GUEST LOGIN
# =============================================================================

@router.post("/guest")
async def guest_login(request: GuestAuthRequest = None, db_service=Depends(get_db_service)):
    """
    Create or restore a guest session.
    
    **Persistence Strategy**:
    - If device_id provided: Restore existing guest session OR create new one
    - If no device_id: Create ephemeral guest session (lost on app close)
    
    Guest users can:
    - Play online matches
    - See leaderboards
    - Play vs AI
    - **Maintain progress if device_id is provided**
    
    Guest users CANNOT:
    - See or claim quests
    - Add friends
    - Recover session without device_id
    """
    try:
        device_id = request.device_id if request else None
        
        # Try to restore existing guest session by device_id
        existing_guest = None
        if device_id:
            # Look up guest by device_id in database
            # For now, we'll use a simple device_id → guest mapping
            # In production, store in `players` table with auth_provider='guest' and oauth_id=device_id
            try:
                existing_guest = await db_service.get_guest_by_device_id(device_id)
            except Exception as e:
                logger.debug(f"No existing guest found for device: {device_id[:8]}...")
        
        if existing_guest:
            # Restore existing guest session
            logger.info(f"✅ Guest session restored: {existing_guest.get('name')} (device: {device_id[:8]}...)")
            
            # Generate fresh token for restored session
            access_token = create_access_token(
                data={"sub": existing_guest["id"], "is_guest": True},
                expires_delta=timedelta(hours=24)
            )
            
            return {
                "success": True,
                "message": "Welcome back, Guest! Your progress has been saved.",
                "data": {
                    "token": access_token,
                    "refresh_token": None,
                    "user": {k: v for k, v in existing_guest.items() if k != "password_hash"}
                }
            }
        
        # Create NEW guest session
        guest_suffix = secrets.token_hex(4).upper()
        guest_name = f"Guest_{guest_suffix}"
        user_id = f"guest_{secrets.token_hex(12)}"
        
        # Create guest user object
        guest_user = {
            "id": user_id,
            "name": guest_name,
            "email": None,
            "is_guest": True,
            "auth_provider": "guest",
            "oauth_id": device_id,  # Store device_id for persistence
            "coin_balance": 1000,  # Starting coins for guests
            "diamonds_balance": 0,
            "games_played": 0,
            "games_won": 0,
            "profile_id": guest_suffix
        }
        
        # Persist guest to database if device_id provided
        if device_id:
            try:
                await db_service.create_user(guest_user)
                logger.info(f"✅ Persistent guest created: {guest_name} (device: {device_id[:8]}...)")
            except Exception as e:
                logger.warning(f"Could not persist guest user: {e}")
                # Continue anyway - guest will just be ephemeral
        else:
            logger.info(f"✅ Ephemeral guest session created: {guest_name}")
        
        # Generate token
        access_token = create_access_token(
            data={"sub": user_id, "is_guest": True},
            expires_delta=timedelta(hours=24)
        )
        
        return {
            "success": True,
            "message": "Welcome, Guest! Sign up to save your progress permanently.",
            "data": {
                "token": access_token,
                "refresh_token": None,
                "user": guest_user
            }
        }
        
    except Exception as e:
        logger.error(f"Guest login error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def find_or_create_oauth_user(
    db_service,
    provider: str,
    oauth_id: str,
    email: Optional[str],
    name: str
) -> dict:
    """
    Find existing user by OAuth ID or create new one.
    
    Args:
        db_service: Database service instance
        provider: OAuth provider name ('google', 'apple')
        oauth_id: Unique ID from the provider
        email: User's email (may be None for Apple)
        name: Display name
        
    Returns:
        User dict
    """
    # Try to find by email first (linking accounts)
    if email:
        existing = await db_service.get_user_by_email(email)
        if existing:
            # Update with OAuth info if not already set
            if not existing.get("oauth_id"):
                # Would update in production
                pass
            return existing
    
    # Create new OAuth user
    user_id = f"U_{secrets.token_hex(12)}"
    user = {
        "id": user_id,
        "name": name,
        "email": email,
        "auth_provider": provider,
        "oauth_id": oauth_id,
        "coin_balance": 1000,
        "diamonds_balance": 5,
        "games_played": 0,
        "games_won": 0,
        "profile_id": secrets.token_hex(4).upper()
    }
    
    try:
        await db_service.create_user(user)
    except Exception as e:
        logger.warning(f"Could not persist OAuth user (may already exist): {e}")
    
    return user
