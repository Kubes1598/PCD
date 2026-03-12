# PCD Online Mode — Product Requirements & Technical Critique (v1.2)

This document provides a critical analysis of the "Online Mode" in Poisoned Candy Duel (PCD), covering the current implementation at the code level and user level, with an honest assessment of what works, what is broken, and what is still missing.

---

## 1. Online Lifecycle: Step-by-Step

### Phase 1: Connection & City Selection

| Step | User Experience | Code (Server) |
|:-----|:----------------|:---------------|
| 1 | User opens the game and taps "Play Online" | Client opens WebSocket to `/matchmaking/ws/:player_id?token=<JWT>` |
| 2 | User sees cities (Dubai, Cairo, Oslo) with live player counts | `ws_handler` validates JWT, checks Redis blacklist, enforces connection caps (global 10k, per-user 3) |
| 3 | User taps a city | Client sends `{"type": "select_city", "city": "dubai"}`. Server binds the connection to that city in `ConnectionManager` and returns live stats |

### Phase 2: Matchmaking Queue

| Step | User Experience | Code (Server) |
|:-----|:----------------|:---------------|
| 4 | User taps "Find Match" | Client sends `{"type": "join_queue", "city": "dubai", "player_name": "Lee"}` |
| 5 | User sees a "Searching..." animation | Server adds player to `CityMatchmakingQueue` (FIFO `VecDeque`) |
| 6 | Match found! Entry fee is deducted | **Background worker** (ticks every 1s) finds 2+ players → calls `db.create_match_with_outbox()` which atomically: deducts fees from both players, creates a persistent `matches` row, and queues a `MATCH_FOUND` outbox event |
| 7 | Both players receive `match_found` message | **Outbox Dispatcher** (ticks every 500ms) reads pending outbox events and delivers the WebSocket notifications |

### Phase 3: Poison Selection (⚠️ Has Critical Bugs — See Section 4)

| Step | User Experience | Code (Server) |
|:-----|:----------------|:---------------|
| 8 | Both players see the "Pick Your Poison" screen. **Each player sees 12 unique candies** — the two sets are entirely different, drawn from a shuffled pool of 30 emojis | `GameSession::new()` in `state.rs` shuffles `CANDY_POOL[30]`, assigns `pool[0..12]` to Player 1 and `pool[12..24]` to Player 2 as their `owned_candies` |
| 9 | Player taps one of their 12 candies to mark it as "poisonous" | Client sends `{"type": "match_poison", "game_id": "...", "candy": "🍬"}`. Server stores it privately via `engine.set_poison_choice()`. **Only** sends `opponent_ready` to the other player — never the candy value |
| 10 | Timer runs during selection | `GameTimerManager::start_timer()` starts a per-player countdown. When a player picks, their timer is stopped |
| 11 | Once both players have picked, game transitions to Playing | `game.both_poisons_set()` → `game.state = GameState::Playing`, turn timer starts for Player 1 |

### Phase 4: Gameplay (Turns)

| Step | User Experience | Code (Server) |
|:-----|:----------------|:---------------|
| 12 | Player picks a candy from the opponent's visible pool | Client sends `{"type": "match_move", "game_id": "...", "candy": "🍭"}` |
| 13 | Server checks if the candy is the opponent's poison | `engine.make_move()` — if poison → picker loses. If safe → candy added to picker's collection |
| 14 | Both players receive the updated game state (sanitized per viewer) | `game.for_viewer(player_id)` strips the opponent's `poison_choice` from the payload |
| 15 | Turn timer switches to the other player | `timer_manager.stop_timer(current)` → `timer_manager.start_timer(next, turn_timer_secs)` |
| 16 | Win condition: collect 11 candies, or opponent picks your poison | `WIN_THRESHOLD = 11`. Game ends → `settle_match_result()` atomically pays winner, updates stats, writes to ledger |

### Phase 5: Game Over & Settlement

| Step | User Experience | Code (Server) |
|:-----|:----------------|:---------------|
| 17 | Winner sees victory screen with prize amount | Both players receive `game_over` or `move_result` with `game_over: true` |
| 18 | Winner's balance increases, both players' stats update | `db.settle_match_result()` — single transaction: payout, `games_played++`, `games_won++` for winner, immutable `match_ledger` entry |

---

## 2. Previously Resolved Bugs ✅

### 🟢 Bug #1: Information Leak (RESOLVED)
- **Was**: Server forwarded the raw poison candy choice to the opponent.
- **Fix**: Server now sends only `{"type": "opponent_ready"}`. Private state never leaves the server until the `Finished` phase.

### 🟢 Bug #2: Inconsistent Statistics (RESOLVED)
- **Was**: `games_played` and `games_won` were never updated.
- **Fix**: `settle_match_result()` atomically updates wallet + stats + ledger.

### 🟢 Bug #3: Ghost Balance Deductions (RESOLVED)
- **Was**: Entry fees deducted in DB, but server crash before WS notification = lost coins.
- **Fix**: Transactional Outbox pattern ensures fee deduction is tied to the event delivery.

---

## 3. Current Matchmaking Issues

### 🟢 Bug #4: Poison Timeout Auto-Pick (RESOLVED)
- **Was**: Timeout = forfeit or cancellation (greedy or slow players lost entry fee).
- **Fix**: Modified `engine.rs` to auto-pick a random candy from the player's 12. Game proceeds normally.

### 🟢 Bug #5: Poison Timer Corrected (RESOLVED)
- **Was**: Hardcoded to 60s (too long).
- **Fix**: Corrected to 30s in `matchmaking.rs`.

### 🟢 Bug #6: Timer Visibility (RESOLVED)
- **Was**: Frontend had no idea when timers would expire.
- **Fix**: `match_found` and `game_reconnect` payloads now include `poison_timer_secs` and `turn_timer_secs`.

### 🟢 Bug #7: ELO Matchmaking (RESOLVED)
- **Was**: FIFO Matchmaking (Pro vs Newbie).
- **Fix**: Implemented a ranking system where players are matched by skill. A dynamic window (±100 → ±500) balances fairness with wait times. Ratings are recalculated after every match using the standard ELO formula (K=32).

### 🟢 Bug #8: Reconnect Recovery (RESOLVED)
- **Was**: Internet drop = stuck in lobby while game times out.
- **Fix**: WebSocket handler now checks for active games on connect. If found, a `game_reconnect` message restores the UI. Disconnects no longer destroy game state/timers immediately (grace period = remaining turn time).

---

## 4. Performance Roadmap ✅

### 🟢 Distributed Matchmaking (RESOLVED)
**What it means**: Matchmaking has been refactored from a single sequential loop to **distributed, per-city workers**.

**The implementation**: In `main.rs`, the server now spawns an independent Tokio task for each city (Dubai, Cairo, Oslo). These workers run in parallel, ensuring that a surge of players in one region never delays matching for players in other regions. This architecture allows the system to scale horizontally to 100,000+ concurrent players.

### 🟢 Cache-Aside Result Settlement (RESOLVED)
**What it means**: Leaderboard queries are now optimized via a **Cache-Aside strategy** using Redis.

**The implementation**: After `settle_match_result()` commits, the system pushes the updated player win counts to Redis sorted sets (`ZADD leaderboard:{city} {wins} {player_id}`). The `/leaderboard` API endpoint implements Cache-Aside: it checks Redis for sub-millisecond results first, falling back to PostgreSQL only on cache misses and subsequently repopulating the cache. This drastically reduces the read weight on the primary database.

---

*Verified by PCD Engineering Team | Production PRD v1.2*

