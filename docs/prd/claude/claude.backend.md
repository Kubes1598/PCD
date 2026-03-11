# PCD Backend — Backend PRD

## System Overview

High-performance Rust backend for the Poisoned Candy Duel (PCD) mobile game. Built with **Axum** + **Tokio** async runtime. Serves as the authoritative game server — all game state, transactions, and matchmaking are server-controlled.

**Stack:** Rust, Axum, Tokio, SQLx (PostgreSQL/Supabase), Redis (optional), DashMap, JSON Web Tokens

---

## Architecture

```
main.rs
├── config.rs          — Environment config (DATABASE_URL, JWT_SECRET, PORT, REDIS_URL)
├── lib.rs             — AppState, create_app(), router assembly, shutdown_signal
├── error.rs           — AppError enum, error responses
├── db/
│   ├── postgres.rs    — SQLx PostgreSQL queries
│   ├── redis.rs       — Optional Redis caching client
│   └── models.rs      — Database row models (Player, Transaction, GameRecord)
├── game/
│   ├── engine.rs      — GameEngine (DashMap-based in-memory game store)
│   ├── state.rs       — GameSession struct + helpers
│   └── types.rs       — GameState, GameResult, GamePlayer, MoveResult enums
├── middleware/
│   └── auth.rs        — JWT validation, AuthUser extractor
├── routes/
│   ├── auth.rs        — Register, login, guest, OAuth, refresh, me
│   ├── game.rs        — Create game, AI game, get/delete game, poison, pick candy
│   ├── matchmaking.rs — WebSocket handler, join/leave queue, stats
│   ├── users.rs       — Player stats, profile, friends, quests, balance, leaderboard
│   ├── ai.rs          — AI move computation
│   ├── config.rs      — Runtime config endpoint
│   └── oauth.rs       — Google/Apple OAuth flows
└── ws/
    ├── connection.rs  — ConnectionManager (active WebSocket connections)
    ├── matchmaking.rs — CityMatchmakingQueue (per-city queues)
    └── timer.rs       — GameTimerManager (turn + poison timers)
```

---

## AppState

Shared state cloned across all handlers:

```rust
struct AppState {
    db: Database,                                    // PostgreSQL pool
    redis: Option<RedisClient>,                      // Optional Redis
    config: Config,                                  // Env vars
    game_engine: GameEngine,                         // In-memory game store
    connection_manager: ConnectionManager,            // Active WebSocket connections
    matchmaking_queue: Arc<CityMatchmakingQueue>,    // Per-city matchmaking queues
    timer_manager: Arc<GameTimerManager>,             // Turn/poison timers
}
```

---

## API Routes

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register with email/password/username |
| POST | `/auth/login` | No | Login, returns JWT + refresh token |
| POST | `/auth/guest` | No | Create anonymous guest account |
| POST | `/auth/refresh` | No | Refresh expired JWT |
| GET | `/auth/me` | Yes | Get current user profile |
| POST | `/auth/logout` | Yes | Invalidate session |
| POST | `/auth/google` | No | Google OAuth login |
| POST | `/auth/apple` | No | Apple OAuth login |
| GET | `/auth/oauth-status` | No | Check which OAuth providers are enabled |

### Games (`/games`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/games` | Yes | Create online game (used by matchmaking) |
| POST | `/games/ai?difficulty=X` | Yes | Create AI game (easy/medium/hard) |
| GET | `/games/:id` | No | Get game state (filtered by viewer) |
| DELETE | `/games/:id` | Yes | Delete/abandon game |
| POST | `/games/:id/poison` | No | Set poison choice for a player |
| POST | `/games/:id/move` | No | Pick a candy from opponent's tray |

### Matchmaking (`/matchmaking`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/matchmaking/ws/:player_id` | No | WebSocket upgrade (matchmaking connection) |
| POST | `/matchmaking/join` | No | Join queue (REST pre-verify) |
| POST | `/matchmaking/leave/:player_id` | No | Leave matchmaking queue |
| GET | `/matchmaking/stats` | No | Queue statistics per city |
| GET | `/matchmaking/status` | No | Overall matchmaking status |

### Users (`/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/leaderboard` | No | Top 100 players by wins |
| GET | `/users/profile/:profile_id` | No | Get profile by ID or UUID |
| GET | `/users/:name/stats` | No | Get player stats by name |
| GET | `/users/:name/friends` | No | Get friends (stub) |
| GET | `/users/:name/quests` | No | Get quests (stub) |
| POST | `/users/balance` | No | Get coin/diamond balance |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/db` | Database connectivity check |
| GET | `/config` | Runtime game configuration |

---

## Game Engine (`game/engine.rs`)

### GameEngine

In-memory game state manager using `DashMap<Uuid, GameSession>`.

| Method | Description |
|--------|-------------|
| `new()` | Initialize empty engine |
| `set_timer_manager()` | Link timer manager |
| `set_db()` | Link database |
| `set_stakes()` | Set entry fee and prize for a game |
| `create_game()` | Create session with configurable turn/poison timers |
| `set_poison_choice()` | Set one player's poison. Returns `true` if both set → game starts |
| `make_move()` | Pick candy. Handles: turn validation, poison check, win condition (11 candies), turn switching, timer resets |
| `handle_timeout()` | Forfeit game on timer expiry |
| `get_game()` | Retrieve game state |
| `remove_game()` | Clean up finished game |

### GameSession (`game/state.rs`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Uuid` | Game ID |
| `player1` / `player2` | `GamePlayer` | Player state (owned candies, collected, poison choice) |
| `state` | `GameState` | Setup → PoisonSelection → Playing → Finished |
| `result` | `GameResult` | Ongoing / Player1Win / Player2Win / Draw |
| `current_turn` | `u32` | Turn counter |
| `is_player1_turn` | `bool` | Whose turn |
| `entry_fee` / `prize` | `i32` | Stakes |
| `turn_timer_secs` | `u32` | Per-turn time limit |
| `poison_timer_secs` | `u32` | Poison phase time limit |

### Win Conditions
- Collect **11 out of 12** candies → win
- Pick **poisoned candy** → instant loss
- **Timer timeout** → forfeit
- **3 consecutive timeouts** → auto-forfeit

---

## WebSocket System (`ws/`)

### ConnectionManager
- Maps `player_id → mpsc::Sender` for message delivery
- Methods: `add_connection`, `remove_connection`, `send_message`, `broadcast_to_city`, `get_online_count`

### CityMatchmakingQueue
- Per-city queues: Dubai, Cairo, Oslo (each with fee/prize config)
- Players join with name + ID
- `try_match()` pairs two players, creates game via `GameEngine`
- Broadcasts `city_stats_update` to remaining players

### WebSocket Message Types (Client → Server)

| Type | Payload | Description |
|------|---------|-------------|
| `join_queue` | `{ city, player_name }` | Join city matchmaking |
| `leave_queue` | `{ city }` | Leave queue |
| `set_poison` | `{ game_id, candy }` | Set poison during game |
| `make_move` | `{ game_id, candy }` | Pick candy during game |
| `ping` | none | Heartbeat |

### WebSocket Message Types (Server → Client)

| Type | Payload | Description |
|------|---------|-------------|
| `connected` | `{ player_id }` | Connection confirmed |
| `queue_joined` | `{ city, position, waiting }` | Joined queue confirmation |
| `city_stats_update` | `{ city, players_online, waiting, fee, prize }` | Live queue stats |
| `match_found` | `{ game_id, your_role, opponent, game_state, city }` | Matched! |
| `match_error` | `{ message }` | Payment failed / error |
| `game_state_update` | `{ game_id, game_state }` | State change broadcast |
| `match_poison` | `{ game_id }` | Poison phase notification |
| `game_over` | `{ game_id, result, winner, reward }` | Game finished |
| `pong` | none | Heartbeat response |

### GameTimerManager (`ws/timer.rs`)
- Manages per-game timers: poison phase + turn timers
- `start_poison_timer(game_id)` → fires after `poison_timer_secs`
- `start_turn_timer(game_id)` → fires after `turn_timer_secs`
- On timeout: calls `GameEngine::handle_timeout`, broadcasts result, settles rewards in DB
- Cancels old timer on new turn

---

## Matchmaking Worker (in `main.rs`)

Background `tokio::spawn` loop running every 1 second:
1. Check each city's queue count
2. If ≥ 2 players: `try_match()` → creates game
3. `execute_matchmaking_entry()` → atomic entry fee deduction for both players
4. On payment failure: notify both players, clean up game
5. On success: set stakes, notify both players with `match_found`, broadcast updated stats

---

## Database (`db/postgres.rs`)

### Key Queries

| Method | Description |
|--------|-------------|
| `connect()` | Create SQLx connection pool |
| `health_check()` | `SELECT 1` |
| `create_player()` | Insert new player with hashed password |
| `get_player()` / `get_player_by_name()` / `get_player_by_email()` | Lookups |
| `create_game_record()` | Persist game to database |
| `execute_matchmaking_entry(p1, p2, fee, game_id)` | **Atomic** entry fee deduction for both players in a transaction |
| `execute_transaction(player_id, amount, type, ref)` | Single idempotent transaction (entry_fee / reward / refund) |
| `get_leaderboard(limit)` | Top N players by wins |

### Schema (key tables)

- **players**: id, name, email, password_hash, coin_balance, diamonds_balance, games_played, games_won, rank, tier, stars, profile_id, device_id, is_guest, elo_rating, xp
- **transactions**: id, player_id, amount, type (entry_fee/reward/refund), reference_id, created_at
- **game_records**: id, player1_id, player2_id, winner_id, game_mode, stakes, result, created_at

---

## Middleware

### Auth (`middleware/auth.rs`)
- JWT validation using `jsonwebtoken` crate
- Extracts `AuthUser { user_id: Uuid }` from Bearer token
- Applied to protected routes via Axum layer

### Rate Limiting
- Tower-based rate limiting middleware
- Configurable per-route

### CORS
- Configured in `create_app()` for cross-origin requests from mobile app

---

## Configuration (`config.rs`)

```
DATABASE_URL     — PostgreSQL connection string (Supabase)
REDIS_URL        — Optional Redis URL
JWT_SECRET       — JWT signing secret
PORT             — Server port (default: 8000)
RUST_LOG         — Log level (default: pcd_backend=debug,tower_http=debug)
```

---

## AI System (`routes/ai.rs`)

Three difficulty levels affect:
- **Turn timer**: Easy 30s, Medium 20s, Hard 10s
- **Entry fee**: Easy 0, Medium 100, Hard 250
- **Prize**: Easy 0, Medium 180, Hard 450
- **AI decision logic**: Random (easy) → weighted (medium) → strategic (hard)

AI poison choice and moves are computed server-side. The AI's poison choice is hidden from the response.
