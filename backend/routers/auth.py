from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
import time
from utils.security import (
    hash_password, verify_password, 
    create_access_token, get_current_user
)
from dependencies import get_db_service
import secrets

router = APIRouter(prefix="/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
async def register_user(request: RegisterRequest, db_service=Depends(get_db_service)):
    """Register a new user with email and password."""
    if "@" not in request.email or "." not in request.email:
        return {"success": False, "message": "Invalid email format"}
    
    existing_user = await db_service.get_user_by_email(request.email.lower())
    if existing_user:
        return {"success": False, "message": "Email already registered"}
    
    # Simple check for username - ideally db_service should have get_user_by_username
    # For now we'll assume it's checked or use get_player as proxy
    existing_player = await db_service.get_player(request.username)
    if existing_player:
        return {"success": False, "message": "Username already taken"}
    
    if len(request.password) < 6:
        return {"success": False, "message": "Password must be at least 6 characters"}
    
    user_id = f"U_{secrets.token_hex(8)}"
    user = {
        "email": request.email.lower(),
        "name": request.username,
        "password_hash": hash_password(request.password),
        "coin_balance": 1000,
        "diamonds_balance": 5,
        "games_played": 0,
        "games_won": 0,
        "profile_id": secrets.token_hex(4).upper()
    }
    
    new_user_id = await db_service.create_user(user)
    token = create_access_token(data={"sub": new_user_id})
    user_public = {k: v for k, v in user.items() if k != "password_hash"}
    user_public["id"] = new_user_id
    
    return {
        "success": True,
        "message": "Registration successful",
        "data": {
            "token": token,
            "user": user_public
        }
    }

@router.post("/login")
async def login_user(request: LoginRequest, db_service=Depends(get_db_service)):
    """Login with email and password."""
    user = await db_service.get_user_by_email(request.email.lower())
    
    if not user:
        return {"success": False, "message": "Invalid email or password"}
    
    if not verify_password(request.password, user["password_hash"]):
        return {"success": False, "message": "Invalid email or password"}
    
    token = create_access_token(data={"sub": user["id"]})
    
    user_public = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "token": token,
            "user": user_public
        }
    }

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user data."""
    user_public = {k: v for k, v in user.items() if k != "password_hash"}
    return {
        "success": True,
        "data": {"user": user_public}
    }
