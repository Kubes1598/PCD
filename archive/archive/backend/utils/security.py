"""
Security Utilities - Production Ready

Handles password hashing, JWT tokens, and authentication.
Uses bcrypt for password hashing and HMAC-SHA256 for JWT.
"""

from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
import logging

logger = logging.getLogger(__name__)

# JWT Bearer token extraction
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """
    Hash password using Bcrypt with automatic salt.
    
    Uses bcrypt directly (instead of passlib) for Python 3.13 compatibility.
    """
    try:
        # Bcrypt has a 72-byte limit - truncate longer passwords
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # Generate salt and hash
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    except Exception as e:
        logger.error(f"Error hashing password: {e}")
        raise e


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password against Bcrypt hash.
    Uses constant-time comparison to prevent timing attacks.
    """
    try:
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        hashed_bytes = hashed.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.warning(f"Password verification error: {e}")
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generate a JWT access token.
    
    Args:
        data: Payload to encode (should include 'sub' for user ID)
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),  # Issued at
        "type": "access"  # Token type for refresh token support
    })
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generate a JWT refresh token.
    
    Refresh tokens have longer expiration (30 days by default) and are used
    to obtain new access tokens without re-authentication.
    
    Args:
        data: Payload to encode (should include 'sub' for user ID)
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT refresh token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Refresh tokens last 30 days
        expire = datetime.utcnow() + timedelta(days=30)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"  # Mark as refresh token
    })
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_refresh_token(token: str) -> Optional[dict]:
    """
    Decode and validate a refresh token.
    
    Returns:
        Decoded payload if valid refresh token, None otherwise
    """
    payload = decode_token(token)
    if not payload:
        return None
    
    # Verify it's a refresh token
    if payload.get("type") != "refresh":
        logger.warning("Invalid token type - expected refresh token")
        return None
    
    return payload


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.
    
    Returns:
        Decoded payload if valid, None otherwise
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.warning(f"Token decode error: {e}")
        return None


async def get_user_from_token(token: str, db_service: Any) -> Optional[dict]:
    """
    Decode JWT and return user data from DB.
    
    Args:
        token: JWT token string
        db_service: Database service instance
        
    Returns:
        User dict if valid, None otherwise
    """
    payload = decode_token(token)
    if not payload:
        return None
    
    user_id: str = payload.get("sub")
    if not user_id:
        return None
    
    try:
        return await db_service.get_user_by_id(user_id)
    except Exception as e:
        logger.error(f"Error fetching user from token: {e}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Dependency to get current user from JWT token.
    
    Handles both regular users (looked up in DB) and guest users (data in token).
    
    Raises:
        HTTPException: 401 if not authenticated or token invalid
    """
    from error_codes import ErrorCode, get_error_message
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=get_error_message(ErrorCode.NOT_AUTHENTICATED),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    # Decode token first
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=get_error_message(ErrorCode.TOKEN_INVALID),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check expiration
    exp = payload.get("exp")
    if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=get_error_message(ErrorCode.TOKEN_EXPIRED),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=get_error_message(ErrorCode.TOKEN_INVALID),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if this is a guest token (guest users aren't stored in DB)
    if payload.get("is_guest"):
        # Return guest user data from the token itself
        return {
            "id": user_id,
            "is_guest": True,
            "name": f"Guest_{user_id.split('_')[-1][:8].upper()}" if '_' in user_id else "Guest",
            "coin_balance": 1000,
            "diamonds_balance": 0,
            "games_played": 0,
            "games_won": 0,
        }
    
    # Regular user - get from database
    from dependencies import get_db_service
    db_service = get_db_service()
    
    try:
        user = await db_service.get_user_by_id(user_id)
    except Exception as e:
        logger.error(f"Error fetching user in auth: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=get_error_message(ErrorCode.TOKEN_INVALID),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Optional[dict]:
    """
    Optional authentication - returns user if valid token, None otherwise.
    Useful for endpoints that work for both guests and authenticated users.
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
