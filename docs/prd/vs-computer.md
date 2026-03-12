# VS Computer Mode Implementation & Audit

The VS Computer mode allows players to play offline matches against an AI opponent with three difficulty levels. This document explains the current implementation, identifies logic flaws, and tracks their resolution status.

---

## 🎮 How it Works (User Level)

1.  **Level Selection**: The player chooses from **Easy**, **Medium**, or **Hard**.
2.  **Stakes**: 
    -   **Easy**: Free to play.
    -   **Medium**: 100 coin entry fee → 180 coin prize.
    -   **Hard**: 250 coin entry fee → 450 coin prize.
3.  **Speed**: Timers get faster as difficulty increases.
4.  **Game Logic**: The rules are identical to Online Mode. The AI's poison is managed secretly by the server — the client never sees it.

---

## 🛠️ Technical Implementation (Code Level)

### 1. Game Initialization
-   **Endpoint**: `POST /games/ai?difficulty={level}`
-   **Logic**:
    -   Uses `db.create_ai_match_atomic()` to atomically deduct the entry fee and create a match record in a **single database transaction**.
    -   Spawns a standard `GameSession` in the `GameEngine` with `p2_is_ai = true`.
    -   The AI opponent is assigned a random version-4 UUID (virtual, not in `players` table).
    -   **AI Poison Choice**: Handled **server-side** during the first AI turn via `calculate_best_ai_move()`. The poison is never sent to the client at game creation time.

### 2. Difficulty Configuration

| Difficulty | Turn Timer | Poison Fallibility | Entry Fee | Prize |
| :--- | :--- | :--- | :--- | :--- |
| **Easy** | 30s | 35% chance to hit poison | 0 | 0 |
| **Medium** | 20s | 10% chance to hit poison | 100 | 180 |
| **Hard** | 10s | 0% chance to hit poison | 250 | 450 |

### 3. AI Move Calculation (`game/engine.rs::calculate_best_ai_move`)
The AI logic is an internal synchronous method on `GameEngine`:
-   **Safe Candidates**: Filters candies that are NOT the human's poison.
-   **Fallibility**: A random roll determines if the AI "is clueless" (picks any candy, even poison) or "is smart" (picks from safe candidates). Percentage based on difficulty.
-   **Hard Mode Heuristics**:
    -   Priority 1: Any safe candy that would bring AI to `WIN_THRESHOLD` (instant win).
    -   Priority 2: Blocking logic stub for when the human is close to winning.
    -   Default: Random safe candy (Hard mode is "perfect" — 0% miss rate).

### 4. Server-Authoritative AI Turns (`game/engine.rs::spawn_ai_turn`)
-   When a human player completes a move and the next player is an AI, `spawn_ai_turn()` is called.
-   This spawns a background Tokio task that:
    1.  Waits 800ms to simulate "thinking".
    2.  Calls `calculate_best_ai_move()` (synchronous) to decide the candy.
    3.  Calls `process_move()` (synchronous) to mutate game state.
    4.  Handles timers via a nested `tokio::spawn` to maintain Send safety.
-   This pattern is **Send-safe** because the non-`Send` DashMap guards are confined to synchronous functions that never enter an async state machine.

### 5. Settlement (`routes/game.rs::pick_candy` + `db/postgres.rs::settle_match_result`)
-   When the game ends (via `pick_candy` or timeout), the backend calls `settle_match_result()`.
-   This atomically records the match in `match_ledger` (idempotent), pays the winner, and updates city leaderboards.
-   **AI Winner Check**: If the winner's `is_ai` flag is `true`, the `winner_id` is set to `None`, so no payout transaction is attempted for the virtual AI UUID. The human's fee is simply consumed.

---

## 🐞 Identified Issues & Resolution Status

### ✅ RESOLVED — Critical Bug #1: Payout to Non-Existent Player
**Root Cause**: In `routes/game.rs`, the settlement logic called `execute_transaction` for the winner, including the AI's random UUID which doesn't exist in the `players` table.

**Fix Applied**:
-   Added `is_ai: bool` field to `GamePlayer` struct (`game/types.rs`).
-   Settlement in `pick_candy` now checks `is_ai` flag. If the winner is AI, `winner_id` is set to `None` when calling `settle_match_result()`, skipping the financial payout.
-   AI games are tracked in the `match_ledger` with an `ai_*` city prefix for stats.

**Files Changed**: `game/types.rs`, `game/state.rs`, `game/engine.rs`, `routes/game.rs`, `db/postgres.rs`

### ✅ RESOLVED — Critical Bug #2: Information Leak in Move Request
**Root Cause**: The `AIMoveRequest` struct required the client to send `player_poison` to the server, meaning the frontend knew the human player's poison.

**Fix Applied**:
-   AI moves are now fully **server-authoritative**. The `calculate_best_ai_move()` function runs entirely on the backend and accesses the `GameSession` directly.
-   The client never sends or receives any poison information for AI games. The `AIMoveRequest` struct is no longer used for AI move execution.
-   AI poison selection at game creation was removed from `create_ai_game`. The poison is now implicitly available to the server from the `GameSession`.

**Files Changed**: `routes/game.rs` (removed client-driven AI poison logic), `game/engine.rs` (added `calculate_best_ai_move`)

### ✅ RESOLVED — Critical Bug #3: Passive AI (Dumb Backend)
**Root Cause**: The backend did NOT automatically execute the AI turn. The client had to detect the AI's turn, call `/ai/move`, then `/games/{id}/pick`.

**Fix Applied**:
-   `spawn_ai_turn()` in `game/engine.rs` automatically triggers after any human move that results in it being the AI's turn.
-   The same trigger is present in `set_poison_choice()` for the rare case where the AI goes first after poison selection.
-   **Architecture**: `spawn_ai_turn` → `tokio::spawn` → 800ms delay → `calculate_best_ai_move` (sync) → `process_move` (sync) → timer management via nested spawn.
-   This pattern avoids the Rust `Send` safety issue that occurs when `DashMap`'s non-`Send` `RefMut` guard enters an async state machine.

**Files Changed**: `game/engine.rs` (added `spawn_ai_turn`, `process_move`, `calculate_best_ai_move`)

### ✅ RESOLVED — Bug #4: Lack of Strategic Depth (Hard Mode)
**Root Cause**: AI move logic was purely reactive (avoiding poison).

**Fix Applied**:
-   Difficulty-based **fallibility** now works correctly:
    -   Easy: 35% miss chance (AI picks random candy including poison).
    -   Medium: 10% miss chance.
    -   Hard: 0% miss chance (never picks poison if it can avoid it).
-   Hard mode includes a **win-check heuristic**: if AI is one candy away from `WIN_THRESHOLD`, it prioritizes safe candies to secure the win.
-   Blocking logic stub added: tracks when the human is close to winning for future advanced strategy.

**Files Changed**: `game/engine.rs` (`calculate_best_ai_move`)

### ✅ RESOLVED — Bug #5: Transactional Consistency
**Root Cause**: AI games used ad-hoc `execute_transaction` calls. If the server crashed between fee deduction and game creation, the player lost coins with no game.

**Fix Applied**:
-   New `db.create_ai_match_atomic()` method in `db/postgres.rs` wraps fee deduction and match record creation in a **single database transaction**.
-   If the fee deduction fails (insufficient funds), the entire transaction is rolled back — no orphaned charges.
-   Game settlement uses the existing `settle_match_result()` method, which is idempotent (checks `match_ledger` before writing).
-   `create_ai_game` in `routes/game.rs` now calls `create_ai_match_atomic()` before creating the in-memory game session.

**Files Changed**: `db/postgres.rs` (added `create_ai_match_atomic`), `routes/game.rs` (updated `create_ai_game`)

---

## 📋 Future Improvements

1.  **Advanced Hard Mode Strategy**: Implement full greedy/blocking heuristics — e.g., track which candies the human needs and deprioritize leaving them available.
2.  **AI Game Stats**: Add dedicated `vs_computer_wins`, `vs_computer_losses` columns to the player profile, separate from PvP stats.
3.  **Adaptive Difficulty**: Adjust AI fallibility dynamically based on the player's win streak against the computer.
4.  **WebSocket Notifications for AI Moves**: Push real-time AI move results to the client over WebSocket, so the frontend can animate the AI's pick. Currently the client must poll the game state.
5.  **Replay System**: Record AI game moves for post-game review.

