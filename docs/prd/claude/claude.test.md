# PCD — Testing PRD

## Overview

Testing strategy for the Poisoned Candy Duel application, covering both the React Native frontend and Rust backend. Tests ensure game logic correctness, API reliability, WebSocket stability, and UI behavioral accuracy.

---

## Current Test Inventory

### Frontend Tests (`React-native/src/__tests__/`)

| File | Coverage | Description |
|------|----------|-------------|
| `authStore.test.ts` | Unit | Auth store state transitions (login, logout, guest) |
| `gameStore.test.ts` | Unit | Game store actions (initGame, setPoison, pickCandy, resetGame) |

### Backend Tests (`backend-rust/tests/`)

| File | Coverage | Description |
|------|----------|-------------|
| `game_engine_test.rs` | Unit | Core game engine logic (create, poison, move, timeout, win) |
| `integration/` | Integration | API endpoint integration tests |

---

## Test Frameworks

| Layer | Framework | Runner |
|-------|-----------|--------|
| Frontend Unit/Integration | Jest + `@testing-library/react-native` | `npx jest` or `npm test` |
| Backend Unit | `#[cfg(test)]` + `tokio::test` | `cargo test` |
| Backend Integration | `axum::test` + `sqlx::test` | `cargo test --test <name>` |
| E2E | Browser subagent + manual | Device/simulator via Expo |

---

## Unit Test Requirements

### Frontend — Zustand Stores

#### `authStore.test.ts`
- [ ] `login()` sets token, user, isGuest=false
- [ ] `register()` creates user and sets token
- [ ] `guestLogin()` sets isGuest=true, generates temp credentials
- [ ] `logout()` clears all auth state
- [ ] `setToken()` updates token without clearing user
- [ ] Token refresh flow updates stored token
- [ ] Error states handled (invalid credentials, network error)

#### `gameStore.test.ts`
- [ ] `initGame('offline')` creates local game with two candy sets (12 each)
- [ ] `initGame('ai', 'easy')` calls API, stores game_id
- [ ] `initGame('online')` → triggers WebSocket search
- [ ] `setPoison(candy)` — stores poison choice, calls API for online/AI
- [ ] `pickCandy(candy)` — adds to collection, removes from opponent tray
- [ ] `pickCandy(poisonedCandy)` — triggers game over (loss)
- [ ] Win condition: collecting 11 candies → game over (win)
- [ ] `resetGame()` clears all game state back to initial
- [ ] `tickTimer()` decrements timer, triggers timeout at 0
- [ ] Turn switching: after pick, `isPlayerTurn` toggles
- [ ] Offline mode: both players alternate poison selection, then take turns
- [ ] AI mode: after player move, AI auto-responds

#### `currencyStore.test.ts`
- [ ] `spendCoins(amount)` deducts correctly
- [ ] `spendCoins(tooMuch)` fails gracefully (returns false)
- [ ] `addCoins(amount)` increases balance
- [ ] `claimDailyReward()` progresses through 5 stages
- [ ] `claimDailyReward()` respects 24h cooldown
- [ ] `setBalances(coins, diamonds)` overrides both values

#### `errorStore.test.ts`
- [ ] `showError(msg)` sets error message
- [ ] Error auto-clears after timeout

### Frontend — Services

#### `api.ts`
- [ ] Request interceptor attaches Bearer token
- [ ] 401 response triggers token refresh
- [ ] Successful refresh retries original request
- [ ] Failed refresh clears auth and redirects
- [ ] Network timeout handled (15s)

#### `WebSocketService.ts`
- [ ] Connects to correct URL with player ID
- [ ] Auto-reconnect on disconnect (exponential backoff)
- [ ] Heartbeat ping/pong keeps connection alive
- [ ] `join_queue` message sent correctly
- [ ] `match_found` message parsed and handled
- [ ] `game_state_update` updates game store
- [ ] `game_over` triggers result modal
- [ ] Clean disconnect on `close()`

### Backend — Game Engine

#### `game_engine_test.rs`
- [ ] `create_game()` returns valid UUID, game in PoisonSelection state
- [ ] `set_poison_choice()` — first player returns false (waiting)
- [ ] `set_poison_choice()` — second player returns true (game starts)
- [ ] `set_poison_choice()` with invalid candy → error
- [ ] `make_move()` — valid pick adds to collection, removes from opponent
- [ ] `make_move()` — wrong turn → error
- [ ] `make_move()` — picking poisoned candy → instant loss
- [ ] Collecting 11 candies → Player1Win or Player2Win
- [ ] `handle_timeout()` — forfeit after timer expires
- [ ] Multiple timeouts (3) → auto-forfeit
- [ ] `get_game()` returns None for nonexistent game
- [ ] `remove_game()` cleans up correctly
- [ ] `active_game_count()` tracks active games
- [ ] Concurrent game creation is thread-safe (DashMap)

---

## Integration Test Requirements

### Backend API Integration

#### Auth Endpoints
- [ ] `POST /auth/register` — creates user, returns JWT
- [ ] `POST /auth/register` — duplicate email → 409
- [ ] `POST /auth/login` — valid credentials → JWT
- [ ] `POST /auth/login` — invalid password → 401
- [ ] `POST /auth/guest` — creates guest, returns JWT
- [ ] `POST /auth/refresh` — valid refresh token → new JWT
- [ ] `GET /auth/me` — with valid JWT → user profile
- [ ] `GET /auth/me` — no token → 401

#### Game Endpoints
- [ ] `POST /games/ai?difficulty=easy` — creates game, returns game state
- [ ] `POST /games/ai?difficulty=hard` — higher fees deducted
- [ ] `GET /games/:id` — returns game state
- [ ] `GET /games/:id` — invalid ID → 404
- [ ] `POST /games/:id/poison` — sets poison, returns updated state
- [ ] `POST /games/:id/move` — picks candy, returns move result
- [ ] `POST /games/:id/move` — pick poison → game over response
- [ ] `DELETE /games/:id` — removes game

#### User Endpoints
- [ ] `GET /users/leaderboard` — returns sorted entries
- [ ] `GET /users/:name/stats` — returns player stats
- [ ] `POST /users/balance` — returns coin/diamond balance
- [ ] `GET /users/profile/:id` — returns profile

#### Health
- [ ] `GET /health` → `{ status: "healthy" }`
- [ ] `GET /health/db` → confirms DB connection

### WebSocket Integration

- [ ] WS connects with valid UUID
- [ ] `join_queue` response includes position and city stats
- [ ] Two players in same city → `match_found` received by both
- [ ] Entry fees deducted atomically on match
- [ ] Insufficient balance → `match_error` sent to both
- [ ] Player disconnect → removed from queue
- [ ] Reconnect after disconnect maintains session

---

## End-to-End Test Scenarios

### E2E-1: Guest → AI Game → Completion
1. Open app → Guest login
2. Select Computer mode → Easy difficulty
3. Poison selection phase → select candy
4. Play turns until win/loss
5. Result modal shows → tap Home
6. Verify balance unchanged (free mode)

### E2E-2: Register → Online Match → Completion
1. Open app → Register new account
2. Verify initial balance (1000 coins, 5 diamonds)
3. Select Online → Dubai (500 coin entry)
4. Wait for match (second client needed)
5. Both players set poison
6. Alternate turns → complete game
7. Winner receives 900 coins, loser gets nothing
8. Verify balance updates

### E2E-3: Offline (Local) Mode
1. Open app → Select Local Player
2. Player 1 sets poison → hand off device
3. Player 2 sets poison → hand off device
4. Alternate turns on shared device
5. Game completes → result shown
6. No API calls made (verify no network)

### E2E-4: Daily Reward Claim
1. Open app → Home screen
2. Tap daily reward banner
3. Verify Stage 1 reward (100 coins) added
4. Verify claim banner shows cooldown
5. Next day: Stage 2 reward (200 coins)

### E2E-5: Auth Recovery
1. Login → get JWT
2. Wait for token expiry (or mock)
3. Make API request → 401
4. Verify auto-refresh → request retried successfully
5. If refresh fails → redirected to auth screen

---

## Test Commands

```bash
# Frontend unit tests
cd React-native && npm test

# Single frontend test file
cd React-native && npx jest src/__tests__/gameStore.test.ts

# Backend unit tests
cd backend-rust && cargo test

# Backend specific test
cd backend-rust && cargo test --test game_engine_test

# Backend integration tests
cd backend-rust && cargo test --test integration

# All tests with output
cd backend-rust && cargo test -- --nocapture
```

---

## Test Data & Fixtures

### Candy Pool
30 emojis: 🍬🍭🍫🧁🍰🎂🍪🍩🍯🍮🧊🍓🍒🍑🥭🍍🥝🍇🫐🍉🍊🍋🍌🍈🍎🍏🥥🥕🌽🥜

### Game Constants
- Win threshold: 11
- Candies per player: 12 (4×3 grid)
- Cities: Dubai (500/900/30s), Cairo (1000/1800/20s), Oslo (5000/9000/10s)
- AI: Easy (0/0/30s), Medium (100/180/20s), Hard (250/450/10s)
- Initial balance: 1000 coins, 5 diamonds

### Test Users
- Use UUIDs for player IDs in backend tests
- Use mock auth tokens for API integration tests
- Guest accounts for frontend tests (no DB dependency)
