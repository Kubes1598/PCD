# PCD Mobile — Frontend PRD

## Product Overview

**Poisoned Candy Duel (PCD)** is a mobile strategy game built with React Native (Expo). Two players each have a tray of 12 emoji candies. Each secretly poisons one candy for the opponent. Players take turns picking candies from the opponent's tray — collect 11 to win, but pick the poisoned one and you lose instantly.

---

## Design System

### Theme: Warm Carton/Brown Aesthetic

| Token | Hex | Role |
|-------|-----|------|
| `primary` | `#8B4513` | Saddle Brown — main actions, buttons |
| `primaryDark` | `#5D2F0A` | Pressed states, shadows |
| `accent` | `#CD853F` | Peru — highlights, badges |
| `carton` | `#D2B48C` | Tan — card backgrounds |
| `brownLight` | `#DEB887` | BurlyWood — surface fills |
| `secondary` | `#DFE0DC` | Sage — secondary elements |
| `success` | `#22C55E` | Green — win, online |
| `warning` | `#F59E0B` | Amber — currency, caution |
| `danger` | `#EF4444` | Red — poison, errors |

**Gradients:**
- Primary: `#8B4513` → `#da6a1a`
- Background: `#F5E6D3` → `#E6D7C3` → `#D7C8B3`
- Carton: `#D2B48C` → `#DEB887` → `#D2B48C`

### Typography
- System fonts, `fontWeight: 'bold'` / `'900'`
- Letter spacing for headings and labels
- All uppercase for section headers and CTAs

### Icons
- `lucide-react-native` throughout

---

## Screens

### 1. AuthScreen (`AuthScreen.tsx`)
- **Login / Signup** tabbed form inside a styled card
- Input fields: email, password, username (signup only)
- Submit CTA with loading state
- Social auth: Google (placeholder) + Guest login
- OAuth status check on mount
- Token refresh flow on 401 response
- Guest-to-full account migration support (`initialCoins`, `initialDiamonds` params)

### 2. HomeScreen (`HomeScreen.tsx`)
Main game hub. Contains:
- **Profile header** — avatar, username, level, coin/diamond balance
- **Game mode selection** — three cards:
  - 🌐 **Online** → city selection (Dubai / Cairo / Oslo)
  - 🤖 **Computer** → difficulty selection (Easy / Medium / Hard)
  - 📱 **Local Player** → direct offline start
- **City selection sub-view** — horizontal carousel of city cards showing entry fee, prize amount, and estimated online count
- **Difficulty selection sub-view** — difficulty cards with fee/reward info
- **Daily reward claim** banner with stage-based progression
- **Matchmaking modal** — search indicator with cancel button
- **Balance check** — warns user if insufficient coins
- **Guest gate** — blocks online mode for guests, prompts signup

### 3. GameScreen (`GameScreen.tsx`)
Multi-phase game view:
1. **Matchmaking/Searching** — spinner + status + cancel
2. **Pre-game** — player vs opponent display
3. **Poison Selection** — each player picks which candy to poison from their own tray
4. **Main Gameplay** — opponent candy grid (pick from), player candy grid (view own), collection panels, turn indicator with timer
5. **Game Result Modal** — win/loss/draw overlay with rewards and rematch

### 4. ProfileScreen (`ProfileScreen.tsx`)
- **Guest view**: prompts signup/login
- **Registered view**: avatar, username, tactical ID, stats grid (wins, games played, win rate, rank), achievements section, logout

### 5. FriendsScreen (`FriendsScreen.tsx`)
- Friends list with search
- Add friend by username or ID
- Online/offline status indicators

### 6. RewardsScreen (`RewardsScreen.tsx`)
- Daily reward stages (5 tiers)
- Reward history
- Currency display

### 7. NotificationsScreen (`NotificationsScreen.tsx`)
- Game invites, friend requests, system messages

### 8. SettingsScreen (`SettingsScreen.tsx`)
- Sound, haptics, notifications toggles
- Account management (change password, delete account)
- App version info

---

## Components

### Layout
| Component | File | Purpose |
|-----------|------|---------|
| `ScreenContainer` | `layout/ScreenContainer.tsx` | SafeArea + gradient background wrapper |

### Game
| Component | File | Purpose |
|-----------|------|---------|
| `CandyGrid` | `game/CandyGrid.tsx` | 4×3 grid of selectable candy items |
| `CandyItem` | `game/CandyItem.tsx` | Individual candy with press, collected, poison states |
| `CollectionPanel` | `game/CollectionPanel.tsx` | Displays collected candies per player |
| `TurnIndicator` | `game/TurnIndicator.tsx` | Timer bar + whose turn label |
| `GameResultModal` | `game/GameResultModal.tsx` | Win/loss/draw modal with reward + rematch |

### Common
| Component | File | Purpose |
|-----------|------|---------|
| `BrandSplashScreen` | `common/BrandSplashScreen.tsx` | App launch splash |
| `ErrorBoundary` | `common/ErrorBoundary.tsx` | React error boundary |
| `GlobalErrorToast` | `common/GlobalErrorToast.tsx` | Toast-style error overlay |

---

## State Management (Zustand)

### `authStore.ts`
- `user`, `token`, `refreshToken`, `isGuest`
- `login()`, `register()`, `guestLogin()`, `logout()`
- `setToken()` for refresh flow

### `gameStore.ts` (largest store — 31KB)
- Game session state: `gameId`, `gameMode`, `difficulty`, `selectedCity`
- Player state: `playerCandies`, `opponentCandies`, `playerCollection`, `opponentCollection`
- Turn management: `isPlayerTurn`, `currentTurn`, `turnTimeRemaining`
- Poison phase: `isSettingPoisonFor`, `selectedPoison`
- Matchmaking: `isSearching`, `queuePosition`, `matchmakingStatus`
- WebSocket message handlers for online mode
- AI move logic for computer mode
- Timer tick logic
- Key actions: `initGame()`, `startSearching()`, `stopSearching()`, `setPoison()`, `pickCandy()`, `resetGame()`

### `currencyStore.ts`
- `coins`, `diamonds`
- `addCoins()`, `spendCoins()`, `setBalances()`
- `claimDailyReward()` with stage progression
- Daily reward cooldown tracking

### `errorStore.ts`
- Global error state for toast display

---

## Services

### `api.ts` — HTTP Client
- Axios-based client pointing to `http://{DEV_MACHINE_IP}:8000`
- Token interceptor (auto-attach JWT)
- 401 → token refresh → retry flow
- Methods for: auth, games, matchmaking, users, config, friends, leaderboard

### `WebSocketService.ts` — Matchmaking WS
- Connects to `ws://{host}/matchmaking/ws/{playerId}`
- Auto-reconnect with exponential backoff
- Heartbeat ping/pong
- Message types: `connected`, `join_queue`, `queue_joined`, `match_found`, `city_stats_update`, `game_state_update`, `match_poison`, `game_over`

### `FeedbackService.ts` — Haptics
- Haptic feedback triggers: selection, success, error

### `candyPool.ts` — Emoji Pool
- 30 candy emojis, random selection of 12 per game

### `timerSync.ts` — Timer Synchronization
- Server-client timer reconciliation

---

## Navigation (React Navigation)

- **Stack**: Auth → App
- **Drawer**: Home, Profile, Friends, Rewards, Notifications, Settings, Leaderboard, Quests
- **Game**: Full-screen modal from Home

---

## Configuration

### `gameConfig.ts` — Game Constants
```
WIN_THRESHOLD = 11 (candies to win)
CANDY_COUNT = 12 (per player)

Cities: Dubai (500/900), Cairo (1000/1800), Oslo (5000/9000)
AI: Easy (free), Medium (100/180), Hard (250/450)
Initial balance: 1000 coins, 5 diamonds
Daily rewards: 5 stages (100→200→500→1000 coins, then 5 diamonds)
```

---

## Key Data Flows

### Online Match Flow
1. User selects city → `startSearching(city)`
2. WebSocket connects → sends `join_queue`
3. Server matches two players → sends `match_found` with `game_id`
4. Both players enter poison selection phase
5. Player sets poison → `POST /games/{id}/poison`
6. Game starts → turns alternate via WebSocket
7. Moves sent via `POST /games/{id}/move`
8. Game over → `game_over` WebSocket message with rewards

### AI Game Flow
1. User selects difficulty
2. `POST /games/ai?difficulty=X` — creates game, AI auto-poisons
3. Player sets poison → `POST /games/{id}/poison`
4. Turns alternate, AI moves computed server-side
5. Game over → rewards calculated

### Offline (Local) Flow
1. Entirely client-side, no API calls
2. Two players alternate on one device
3. Screen handoff between poison selection and turns
