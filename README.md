# PCD Game 🍬

A strategic candy collection game where players must avoid poisoned candies while collecting valuable treats.

## 🎮 Game Overview

PCD (Poison Candy Detection) is a turn-based strategy game where:
- Players collect candies from a shared pool
- Each player secretly chooses one candy from their own collection as "poison"
- The goal is to collect the most valuable candies while avoiding your opponent's poison
- Strategic thinking is key - protect your best candies and predict your opponent's choices

## 🏗️ Project Structure

```
PCD/
├── web-app/           # Complete web application
│   ├── index.html     # Main game interface
│   ├── css/           # Styling and themes
│   ├── js/            # Game logic and API
│   └── assets/        # Images and fonts
├── backend/           # FastAPI server
│   ├── api.py         # Game API endpoints
│   ├── database.py    # Database management
│   └── venv/          # Python virtual environment
├── design/            # Design assets and documentation
└── data/              # Game data and fallback database
```

## 🚀 Quick Start

### Option 1: Use the startup script (Recommended)
```bash
./start_servers.sh
```

### Option 2: Manual startup
```bash
# Start backend (Terminal 1)
cd backend
source venv/bin/activate
python -m uvicorn api:app --reload --host 0.0.0.0 --port 8000

# Start web app (Terminal 2)
cd web-app
python3 -m http.server 3001
```

### Access the Game
- 🎮 **Game**: http://localhost:3001
- 📊 **Backend API**: http://localhost:8000
- 📋 **API Documentation**: http://localhost:8000/docs

## 🎯 Features

### Game Modes
- **AI Opponent**: Play against computer with 3 difficulty levels
- **Local Multiplayer**: Pass-and-play on same device
- **Online Multiplayer**: Real-time games with other players

### Game Features
- **Strategic Gameplay**: Version A mechanics (pick poison from own pool)
- **Beautiful UI**: Modern design with animations and sound effects
- **Statistics Tracking**: Win rates, games played, performance metrics
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Offline Support**: Play even without internet connection

### Technical Features
- **Real-time Updates**: WebSocket integration for live gameplay
- **Database Integration**: PostgreSQL with SQLite fallback
- **API Documentation**: Interactive Swagger/OpenAPI docs
- **Mobile Optimized**: Touch-friendly interface with gesture support

## 🛠️ Development

### Backend Requirements
- Python 3.8+
- FastAPI
- PostgreSQL (optional - SQLite fallback included)
- Supabase integration

### Frontend Requirements
- Modern web browser
- No build tools required - pure HTML/CSS/JavaScript

### Installation
```bash
# Clone repository
git clone <repository-url>
cd PCD

# Set up backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run the game
cd ..
./start_servers.sh
```

## 📱 Mobile Support

The web app is fully optimized for mobile devices with:
- Touch-friendly interface
- Responsive breakpoints
- Gesture support
- Offline capabilities
- Performance optimizations

## 🎨 Design

The game features a modern, colorful design with:
- Glassmorphism effects
- Smooth animations
- Custom fonts (Poppins, Bubblegum Sans)
- Candy-themed color palette
- Intuitive user interface

## 🔧 API Endpoints

- `GET /health` - Server health check
- `POST /games` - Create new game
- `GET /games/{game_id}` - Get game state
- `POST /games/{game_id}/poison` - Set poison candy
- `POST /games/{game_id}/pick` - Pick candy from pool
- `GET /games/{game_id}/status` - Check game status

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🎮 How to Play

1. **Setup**: Enter your name and choose game mode
2. **Poison Selection**: Pick one candy from your collection as poison
3. **Gameplay**: Take turns picking candies from the shared pool
4. **Strategy**: Collect valuable candies while avoiding opponent's poison
5. **Winning**: Player with highest total value (excluding poison) wins!

---

Enjoy playing PCD! 🍬✨ 