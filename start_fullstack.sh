#!/bin/bash

# PCD Game Fullstack Startup Script
# Runs both backend (FastAPI) and frontend (HTTP server) with proper configuration

echo "🚀 Starting PCD Game Fullstack Application..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo -e "${RED}❌ Backend directory not found!${NC}"
    exit 1
fi

# Check if web-app directory exists
if [ ! -d "web-app" ]; then
    echo -e "${RED}❌ Web-app directory not found!${NC}"
    exit 1
fi

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}🔄 Killing processes on port $port...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Check and kill existing processes
if check_port 8000; then
    echo -e "${YELLOW}⚠️  Port 8000 is in use${NC}"
    kill_port 8000
fi

if check_port 3002; then
    echo -e "${YELLOW}⚠️  Port 3002 is in use${NC}"
    kill_port 3002
fi

# Start Backend Server
echo -e "${BLUE}🔧 Starting Backend Server (FastAPI)...${NC}"
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${BLUE}🔌 Activating virtual environment...${NC}"
source venv/bin/activate

# Install/upgrade dependencies
echo -e "${BLUE}📚 Installing/upgrading dependencies...${NC}"
pip install --upgrade pip
pip install fastapi uvicorn python-dotenv supabase pydantic

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚙️  Creating .env file with default configuration...${NC}"
    cat > .env << EOL
# Supabase Configuration (Replace with your actual values)
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# Database Configuration
DATABASE_URL=sqlite:///./data/fallback.db

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3002,http://127.0.0.1:3002,*

# Game Configuration
MAX_GAMES_PER_USER=10
GAME_CLEANUP_INTERVAL=3600
GAME_EXPIRY_TIME=86400
EOL
    echo -e "${YELLOW}⚠️  Please update .env file with your Supabase credentials${NC}"
fi

# Start FastAPI server in background
echo -e "${GREEN}🚀 Starting FastAPI server on http://localhost:8000${NC}"
uvicorn api:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to start
echo -e "${BLUE}⏳ Waiting for backend to start...${NC}"
sleep 5

# Check if backend started successfully
if check_port 8000; then
    echo -e "${GREEN}✅ Backend server started successfully!${NC}"
else
    echo -e "${RED}❌ Failed to start backend server${NC}"
    exit 1
fi

# Go back to root directory
cd ..

# Start Frontend Server
echo -e "${BLUE}🌐 Starting Frontend Server (HTTP)...${NC}"

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}❌ Python not found!${NC}"
    kill $BACKEND_PID
    exit 1
fi

# Start HTTP server for frontend
echo -e "${GREEN}🚀 Starting Frontend server on http://localhost:3002${NC}"
cd web-app
$PYTHON_CMD -m http.server 3002 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

# Check if frontend started successfully
if check_port 3002; then
    echo -e "${GREEN}✅ Frontend server started successfully!${NC}"
else
    echo -e "${RED}❌ Failed to start frontend server${NC}"
    kill $BACKEND_PID
    exit 1
fi

# Go back to root
cd ..

echo ""
echo -e "${GREEN}🎉 PCD Game Fullstack Application Started Successfully!${NC}"
echo "================================================"
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:3002/pcd-complete-frontend.html"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:8000"
echo -e "${BLUE}📚 API Docs:${NC} http://localhost:8000/docs"
echo -e "${BLUE}🔍 Health Check:${NC} http://localhost:8000/health"
echo ""
echo -e "${YELLOW}🎮 Game Features:${NC}"
echo "  • 11 Interactive Pages (JSON-based)"
echo "  • Real-time WebSocket Gaming"
echo "  • Version A Game Mechanics"
echo "  • Supabase Database Integration"
echo "  • Debug Navigation (Press 1-9, 0, Escape)"
echo ""
echo -e "${YELLOW}💡 Quick Start:${NC}"
echo "  1. Open frontend URL in your browser"
echo "  2. Enter your player name when prompted"
echo "  3. Start playing online, offline, or with friends!"
echo ""
echo -e "${RED}🛑 To stop servers:${NC} Press Ctrl+C or run: ./stop_servers.sh"
echo ""

# Create stop script
cat > stop_servers.sh << 'EOL'
#!/bin/bash
echo "🛑 Stopping PCD Game servers..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
echo "✅ Servers stopped successfully!"
EOL
chmod +x stop_servers.sh

# Wait for user interruption
trap 'echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT

# Keep script running
echo -e "${BLUE}⏳ Servers running... Press Ctrl+C to stop${NC}"
wait 