# PCD - Pick Candy Duel: Gameplay Guide

Welcome to the **Pick Candy Duel (PCD)** gameplay guide. This document outlines the user interface, game modes, and mechanics for a premium gaming experience.

## 🏁 The Core Objective
The goal is simple: **Collect candies from your opponent's tray without picking the one they "poisoned."** 

### Win Conditions:
- **Primary Win:** Collect **11 candies**. (Note: If you hit 11 first, your opponent may get a **Final Chance** to tie).
- **Poison Win:** Your opponent picks the candy you marked as **Poison** (Instant Victory).

### 🤝 The Draw (Tie) Logic:
- **The Catch-Up:** If Player A reaches 11 candies, Player B gets a **Final Chance** to also reach 11, provided it is mathematically possible with the remaining safe candies.
- **Result:** If both players end with 11 candies, the match is a **DRAW**.
- **Depletion:** If all safe candies are collected and no one reached 11, the game is a **DRAW**.

---

## 🏠 Main Menu (Home Screen)
The Home Screen is your hub for battle.

### 🎭 Navigation & Profile
- **Menu Button (Top Left):** Opens the side drawer for Profile, Friends, Rewards, and Settings.
- **Profile Icon (Top Right):** Displays your username and avatar. Tapping it takes you to your detailed stats and rank history.
- **Currency Badges:** Displays your current **Coins** (orange) and **Diamonds** (cyan). 
- **Server Status:** A small badge indicates if you are **Online**, **Unstable**, or **Offline**.

### ⚔️ Battle Modes
1.  **World Online Duel (Blue Gradient Card):**
    - **Initial State:** A premium card with a pulsing Globe icon.
    - **Screen 1: Arena Selection Modal:** Choose your battleground (Dubai, Cairo, Oslo) to determine the stakes and the speed (Turn Timer) of the duel.
    - **Screen 2: Matchmaking Search:** Full-screen overlay with real-time queue position and online player counts.
    - **Screen 3: Match Found!:** Success animation and haptic pulse. Transitions automatically to the table.
    - **Screen 4: Poison Selection (The Prep):** Before the duel begins, both players must silently pick their poison candy. 
        *   **Timer:** A 30-second shared "Preparation Timer" is active here.
    - **Game Start:** Once both players set their poison, the **Arena Turn Timer** (30s, 20s, or 10s) officially starts for the first player's turn.
2.  **Local Duel (Pass & Play):**
    - **Look:** A clean card with a "Users" icon.
    - **Play:** Two players on the same device. The screen will prompt "Player 1/2 look away" during the secret poison selection phase.
3.  **VS Computer (AI):**
    - **Look:** A card with a monitor icon.
    - **Play:** Tapping opens a **Difficulty Selection** (Easy, Medium, Hard). Note that higher difficulties require an entry fee but yield potential rewards.

---

## 🎮 The Game Loop
Once a game starts, regardless of mode, it follows these phases:

### Phase 1: Pick Your Poison (Screen 4)
- **Look:** Each player sees the opponent's 4x3 candy tray.
- **Action:** You must tap one candy to "poison" it. This is the candy your opponent must avoid.
- **Secrecy:** In Local Duel, the other player must look away. In Online/AI, this happens simultaneously.
- **Intro:** Once both players have submitted, the game officially "Starts," and the first player's turn timer begins.

### Phase 2: The Duel (Core Gameplay)
- **The Screen Layout:**
    - **Top:** Opponent's name, their collected candy score, and their tray.
    - **Middle:** A "VS" divider with a glowing turn indicator.
    - **Bottom:** Your tray and your collected candy score.
- **Picking Candies:** On your turn, you tap a candy from the **Opponent's Tray** (Top).
    - If it's **Safe**: You collect it, and it's added to your collection. Your turn continues or passes (depending on game settings).
    - If it's **Poison**: The candy turns red, an explosion animation plays, and you **Instantly Lose**.

### Phase 3: Game Over & Results
- **Victory:** Celebration screen showing your rewards (Coins/XP).
- **Defeat:** Shows what the poison candy was and your final score.
- **Final Chance Alert:** If your opponent hits 11, a special "FINAL CHANCE" banner appears, giving you one last turn to find the remaining safe candies and force a draw.
- **Draw:** A "Handshake" icon appears, and stakes are typically returned or split.

### Phase 4: The Clock (Online Only)
- **Timer:** Each turn has a countdown (30s to 10s depending on the City). If the timer hits zero, you automatically forfeit your turn or lose (if repeated).

## 📁 The Side Drawer (Menu)
Accessed by tapping the Menu icon (top left) or swiping from the edge.

- **Shop:** Purchase more Coins and Diamonds.
- **Friends:** Manage your friend list, send gifts, and invite players.
- **Rewards:** Check your quest progress and claim milestone prizes.
- **Notifications:** View match invites and system alerts.
- **Help & Support:** Contact the developers or read the FAQ.
- **Settings:** Adjust sound, haptics, and account security.

---

## 🏆 Rewards & Ranking
- **Global Leaderboard:** Accessed via the "Ranking" button. View top players by wins.
- **Quests:** Daily challenges to earn extra coins and diamonds.
- **Daily Gift:** A claimable reward on the Home Screen that increases if you log in every day (7-day streak cycle).

## 🛠️ UI Aesthetics
- **Color Palette:** Dark Slate (#0F172A) and Indigo (#4F46E5).
- **Glassmorphism:** Semi-transparent panels with subtle borders.
- **Micro-Animations:** Pulsing indicators for active turns and smooth scaling on candy collection.
