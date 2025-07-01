#!/bin/bash

echo "🚀 Starting PCD Mobile Game (Integrated Frontend + Backend)"
echo "========================================================"

# Kill any existing processes on our ports
echo "🔄 Cleaning up existing processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3003 | xargs kill -9 2>/dev/null || true

# Start backend in background
echo "🔧 Starting Backend Server..."
cd backend
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
pip install -q fastapi uvicorn python-dotenv supabase pydantic
uvicorn api:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 3

# Start frontend in background
echo "🌐 Starting Frontend Server..."
cd web-app
python3 -m http.server 3003 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 2

echo ""
echo "🎉 PCD Mobile Game Ready!"
echo "========================================================"
echo "📱 PLAY NOW: http://localhost:3003/pcd-game.html"
echo "========================================================"
echo ""
echo "🎮 Game Features:"
echo "  • Mobile-optimized touch interface"
echo "  • Real-time backend integration"
echo "  • 10 candies per player (3x4 grid)"
echo "  • Click-to-remove gameplay"
echo "  • Version A game mechanics"
echo ""
echo "💡 Instructions:"
echo "  1. Click the link above"
echo "  2. Enter your player name"
echo "  3. Choose Dubai, Cairo, or Oslo"
echo "  4. Pick candies from opponent's pool"
echo "  5. Avoid the poison!"
echo ""
echo "🛑 Press Ctrl+C to stop both servers"
echo ""

# Create trap to kill both processes on exit
trap 'echo ""; echo "🛑 Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT

# Keep script running
wait 