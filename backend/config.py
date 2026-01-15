import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    """Application settings and configuration."""
    
    # Supabase Configuration
    # CRITICAL: Use ANON key for public API (respects RLS)
    # Use SERVICE key ONLY for trusted server-side operations
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_KEY", "")  # Public API key (respects RLS)
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")  # Admin key (bypasses RLS)
    
    # Backward compatibility alias
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # Database Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # API Configuration
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # CORS Configuration
    ALLOWED_ORIGINS: list = os.getenv(
        "ALLOWED_ORIGINS", 
        "http://localhost:3000,http://localhost:19006,*"
    ).split(",")
    
    # Game Configuration
    MAX_GAMES_PER_USER: int = int(os.getenv("MAX_GAMES_PER_USER", "10"))
    GAME_CLEANUP_INTERVAL: int = int(os.getenv("GAME_CLEANUP_INTERVAL", "3600"))  # 1 hour
    GAME_EXPIRY_TIME: int = int(os.getenv("GAME_EXPIRY_TIME", "86400"))  # 24 hours
    
    # Security Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # OAuth Configuration
    # Google OAuth - Get from https://console.cloud.google.com/apis/credentials
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    # Apple Sign-In - Get from https://developer.apple.com/account/resources/identifiers
    APPLE_CLIENT_ID: str = os.getenv("APPLE_CLIENT_ID", "")  # Your app's bundle ID
    APPLE_TEAM_ID: str = os.getenv("APPLE_TEAM_ID", "")
    APPLE_KEY_ID: str = os.getenv("APPLE_KEY_ID", "")
    APPLE_PRIVATE_KEY: str = os.getenv("APPLE_PRIVATE_KEY", "")  # Contents of .p8 file
    
    # OAuth Helper Properties
    @property
    def is_google_configured(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID)
    
    @property
    def is_apple_configured(self) -> bool:
        return bool(self.APPLE_CLIENT_ID and self.APPLE_TEAM_ID and self.APPLE_KEY_ID)

settings = Settings() 