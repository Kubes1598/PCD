#!/usr/bin/env python3
"""
Simple backend starter script for debugging
"""

import sys
import os
import traceback

def main():
    try:
        print("🚀 Starting PCD Backend Server...")
        print(f"Python version: {sys.version}")
        print(f"Current directory: {os.getcwd()}")
        
        # Test imports
        print("📦 Testing imports...")
        import uvicorn
        print("✅ uvicorn imported successfully")
        
        import api
        print("✅ api module imported successfully")
        
        # Start the server
        print("🌐 Starting uvicorn server on http://127.0.0.1:8000")
        uvicorn.run(
            "api:app",
            host="127.0.0.1",
            port=8000,
            log_level="info",
            access_log=True
        )
        
    except Exception as e:
        print(f"❌ Error starting backend: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main() 