#!/bin/bash

# Poisoned Candy Duel - Fullstack Start Script (Rust + Web)

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Poisoned Candy Duel Fullstack...${NC}"

# Check for .env file
if [ ! -f "backend-rust/.env" ]; then
    echo -e "${RED}⚠️ No .env file found in backend-rust/. Trying to copy from .env.example...${NC}"
    cp backend-rust/.env.example backend-rust/.env
fi

# Function to kill background tasks on exit
cleanup() {
    echo -e "\n${RED}🛑 Stopping all services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# 1. Start Rust Backend
echo -e "${GREEN}🦀 Starting Rust Backend...${NC}"
cd backend-rust
cargo run --bin pcd-backend &
BACKEND_PID=$!
cd ..

# 2. Wait for backend to be ready
echo -e "${BLUE}⏳ Waiting for backend to be ready on port 8000...${NC}"
until curl -s http://localhost:8000/health > /dev/null; do
  sleep 1
done
echo -e "${GREEN}✅ Backend is healthy!${NC}"

# 3. Start Frontend (Static Server)
echo -e "${GREEN}🌐 Starting Web Frontend...${NC}"
cd web-app
# Using npx http-server as a simple way to serve static files
npx -y http-server -p 3000 . &
FRONTEND_PID=$!
cd ..

echo -e "${BLUE}--------------------------------------------------${NC}"
echo -e "${GREEN}🎮 Game is now running!${NC}"
echo -e "${BLUE}🔗 Frontend: ${NC} http://localhost:3000"
echo -e "${BLUE}🔗 API:      ${NC} http://localhost:8000"
echo -e "${BLUE}--------------------------------------------------${NC}"
echo -e "Press Ctrl+C to stop all services"

# Keep script running
wait
