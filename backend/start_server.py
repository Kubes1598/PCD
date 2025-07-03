#!/usr/bin/env python3
"""
Simple script to start the PCD game server
"""
import uvicorn
from api import app

if __name__ == "__main__":
    print("🎮 Starting PCD Game Server...")
    print("📍 Server will be available at: http://localhost:8000")
    print("📚 API docs available at: http://localhost:8000/docs")
    print("🔄 Auto-reload enabled for development")
    print("=" * 50)
    
    try:
        uvicorn.run(
            "api:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}") 