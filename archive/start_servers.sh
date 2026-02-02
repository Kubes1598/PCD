#!/bin/bash

echo "🚀 Starting PCD Game Servers..."

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    pkill -f "uvicorn api:app"
    pkill -f "python3 -m http.server 3001"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend server
echo "📡 Starting backend server on port 8000..."
cd backend
source venv/bin/activate
python -m uvicorn api:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start web app server
echo "🌐 Starting web app server on port 3001..."
cd web-app
python3 -m http.server 3001 &
WEBAPP_PID=$!
cd ..

echo ""
echo "✅ Servers started successfully!"
echo "🎮 Game available at: http://localhost:3001"
echo "📊 Backend API at: http://localhost:8000"
echo "📋 API docs at: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait $BACKEND_PID $WEBAPP_PID 