# PCD Game 🍬 (Poisoned Candy Duel)

A strategic candy collection game where players must avoid poisoned candies while collecting valuable treats.

## 🎮 Game Overview

PCD is a turn-based strategy game where:
- Players have 12 candies in their tray.
- Each player secretly poisons one candy for their opponent.
- Players take turns picking candies from the opponent's tray.
- The goal is to collect **11 candies** to win, while avoiding the poison.
- Picking the poisoned candy results in an instant loss.

---

## 🏗️ Project Structure

```
PCD/
├── React-native/      # Mobile application (Expo)
├── backend-rust/      # High-performance Rust backend (Axum)
├── web-app/           # Legacy web application (Static HTML/JS)
├── docs/              # Documentation & PRDs
│   ├── prd/           # Product Requirements Documents
│   │   └── claude/    # Latest PRDs (Frontend, Backend, Test)
│   └── resources/     # External references (PostgreSQL doc, etc.)
├── scripts/           # Automation & startup scripts
├── archive/           # Deprecated/Legacy code and scripts
└── data/              # Game data and persistent storage
```

---

## 🚀 Quick Start

### 1. Start everything with one script
```bash
./scripts/start_fullstack.sh
```

### 2. Manual Startup

#### Backend (Rust)
```bash
cd backend-rust
cargo run --bin pcd-backend
```

#### Web Frontend
```bash
cd web-app
npx http-server -p 3000
```

#### Mobile Frontend (React Native)
```bash
cd React-native
npx expo start
```

---

## 📋 Documentation

Detailed requirements and technical specifications can be found in [docs/prd/claude/](docs/prd/claude/):
- [Frontend PRD](docs/prd/claude/claude.frontend.md)
- [Backend PRD](docs/prd/claude/claude.backend.md)
- [Testing PRD](docs/prd/claude/claude.test.md)

General project principles are in [docs/instruction.md](docs/instruction.md).

---

## 🎯 Features

### Game Modes
- 🌐 **Online Arena**: Real-time matchmaking via WebSockets.
- 🤖 **Neural Duel**: Challenge AI cores (Easy, Medium, Hard).
- 📱 **Local Duel**: Pass-and-play on a single device.

### Technical Stack
- **Frontend**: React Native (Expo) with Zustand for state management.
- **Backend**: Rust (Axum, Tokio) with SQLx (PostgreSQL/Supabase).
- **Real-time**: Custom WebSocket protocol for matchmaking and gameplay sync.
- **Design**: "Warm Carton" aesthetic with smooth animations.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Enjoy playing PCD! 🍬✨
 