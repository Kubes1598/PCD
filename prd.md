# Poisoned Candy Duel - Product Requirements Document

## Overview

**Poisoned Candy Duel (PCD)** is a real-time multiplayer strategy game where two players compete to collect candies while avoiding the opponent's hidden "poisoned" candy. The game features online matchmaking, AI opponents, and local pass-and-play modes.

---

## Problem-Solving Methodology

### Phase 1: Issue Identification

When an issue is reported, I follow this diagnostic process:

1. **Gather Context**
   - Read user's description carefully
   - Check terminal logs (backend & frontend)
   - Identify error codes/messages
   - Understand expected vs actual behavior

2. **Reproduce the Flow**
   - Trace the user journey through code
   - Identify which files/functions are involved
   - Map the data flow (frontend → API → backend → database)

3. **Isolate the Problem**
   - Is it frontend, backend, or database?
   - Is it a logic error, network issue, or state management bug?
   - Check for race conditions, timing issues, or missing data

### Phase 2: Root Cause Analysis

| Symptom | Diagnostic Approach |
|---------|---------------------|
| 429 Error | Check rate limiter config in `middleware/rate_limit.py` |
| 401 Error | Check auth tokens, RLS policies, service key configuration |
| Modal stuck | Check state management (`matchFound`, `isSearching`) |
| WebSocket issues | Check connection lifecycle in `WebSocketService.ts` |
| Match not found | Check queue logic in `managers.py`, city config matching |

### Phase 3: Solution Implementation

1. **Minimal Change Principle**: Fix only what's broken
2. **Preserve Existing Behavior**: Don't break working features
3. **Add Logging**: Insert debug logs for future troubleshooting
4. **Test the Fix**: Verify via logs or user confirmation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React Native)                  │
├─────────────────────────────────────────────────────────────────┤
│  Screens: HomeScreen, GameScreen, AuthScreen, ProfileScreen    │
│  State: Zustand stores (gameStore, authStore, currencyStore)   │
│  Services: api.ts (HTTP), WebSocketService.ts (WS)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI)                        │
├─────────────────────────────────────────────────────────────────┤
│  Routers: auth.py, game.py, matchmaking.py, players.py         │
│  Core Engine: game_engine.py (game logic)                      │
│  Managers: managers.py (matchmaking, timers, connections)      │
│  Middleware: rate_limit.py, request_tracking.py                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE (Supabase)                      │
├─────────────────────────────────────────────────────────────────┤
│  Tables: players, games, coin_transactions                     │
│  Security: Row-Level Security (RLS) policies                   │
│  Functions: update_player_balance_atomic (SECURITY DEFINER)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Game Logic

### Core Rules

| Rule | Implementation |
|------|----------------|
| Candies per player | 12 unique candies each |
| Poison selection | Each player picks from OWN candy pool |
| Candy picking | Players pick from OPPONENT'S pool |
| Win condition | Collect 11 candies |
| Poison loss | Pick opponent's poison = instant loss |
| Draw condition | Both reach 11 candies simultaneously |
| Timeout | Single timeout = instant forfeit |

### Game Flow

```
1. MATCHMAKING
   └── Both players connect via WebSocket
   └── Join city-specific queue (Dubai, Cairo, Oslo)
   └── Match found → Deduct entry fees → Create game

2. SETUP PHASE
   └── Each player selects poison from their own pool
   └── 30 second timer (server-authoritative)
   └── Timeout → Random poison auto-selected

3. PLAYING PHASE
   └── Player 1 starts
   └── Alternating turns
   └── Pick candy from opponent's pool
   └── Hit poison = immediate loss
   └── Collect 11 = win (or draw if simultaneous)

4. GAME OVER
   └── Winner receives prize
   └── Stats updated
   └── Balance credited
```

---

## Common Issues & Solutions

### Issue: Match Found Modal Stuck

**Symptom**: Modal shows "MATCH FOUND!" but never closes

**Root Cause**: `matchFound` state was `true` but no navigation triggered

**Solution**:
```typescript
// HomeScreen.tsx
useEffect(() => {
    if (matchFound && gameId) {
        const timeout = setTimeout(() => {
            clearMatchFound(); // Clear modal state
            navigation.navigate('Game');
        }, 1500);
        return () => clearTimeout(timeout);
    }
}, [matchFound, gameId]);
```

### Issue: 429 Rate Limit Errors

**Symptom**: `AxiosError: Request failed with status code 429`

**Root Cause**: AI endpoint rate limit too low (20/min)

**Solution**:
```python
# middleware/rate_limit.py
PATH_LIMITS = {
    "/ai": {"limit": 120, "window": 60},  # Increased from 20
}
```

### Issue: City Config Mismatch

**Symptom**: `startSearching` silently fails

**Root Cause**: Backend returned lowercase keys (`dubai`) but frontend expected capitalized (`Dubai`)

**Solution**:
```python
# game_config.py - Use capitalized keys
CITY_CONFIG = {
    "Dubai": {...},
    "Cairo": {...},
    "Oslo": {...},
}
```

### Issue: Guest Player Creation Failed

**Symptom**: `row violates row-level security policy`

**Root Cause**: Missing `SUPABASE_SERVICE_KEY` in `.env`

**Solution**: Add service key and use admin client for privileged operations:
```python
# database.py
self.supabase_admin = create_client(url, service_key)
```

### Issue: Timer Starts Before UI Ready

**Symptom**: Timer counts down while modal is showing

**Root Cause**: Backend started timers immediately after match

**Solution**:
```python
# managers.py
await asyncio.sleep(3)  # Wait for UI transition
await self.timer_manager.start_timer(...)
```

---

## Key Files Reference

### Frontend

| File | Purpose |
|------|---------|
| `src/store/gameStore.ts` | Central game state management |
| `src/store/authStore.ts` | Authentication state |
| `src/services/api.ts` | HTTP API client |
| `src/services/WebSocketService.ts` | Real-time communication |
| `src/screens/HomeScreen.tsx` | Main menu & matchmaking |
| `src/screens/GameScreen.tsx` | Game UI |
| `src/config/gameConfig.ts` | Frontend game constants |

### Backend

| File | Purpose |
|------|---------|
| `api.py` | FastAPI application entry |
| `game_engine.py` | Core game logic |
| `managers.py` | Matchmaking queue, timers, connections |
| `database.py` | Supabase database interface |
| `routers/matchmaking.py` | WebSocket matchmaking endpoint |
| `routers/game.py` | Game REST endpoints |
| `middleware/rate_limit.py` | Request rate limiting |
| `game_config.py` | Backend game constants |

---

## Configuration

### Environment Variables (.env)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_KEY=eyJxxx  # REQUIRED for admin operations

# Security
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Redis (optional, falls back to in-memory)
REDIS_URL=redis://localhost:6379/0
```

### City Configuration

| City | Entry Fee | Prize | Turn Timer |
|------|-----------|-------|------------|
| Dubai | 500 | 900 | 30s |
| Cairo | 1000 | 1800 | 20s |
| Oslo | 5000 | 9000 | 10s |

---

## Debugging Checklist

When troubleshooting, check in this order:

1. **Backend Terminal**
   - Error messages
   - HTTP status codes
   - WebSocket connect/disconnect logs

2. **Expo/Metro Terminal**
   - JavaScript errors
   - Console logs
   - Network errors

3. **State Management**
   - `matchFound`, `isSearching`, `gameId` values
   - WebSocket connection state

4. **Database**
   - RLS policy violations
   - Missing columns
   - Constraint errors

5. **Configuration**
   - `.env` values loaded correctly
   - City config key casing
   - Rate limit settings

---

## Testing Protocol

### Local Testing

1. Start backend: `uvicorn api:app --reload`
2. Start frontend: `npx expo start`
3. Connect 2 devices via Expo Go

### Online Mode Test

1. Both devices select same city (Dubai)
2. Verify WebSocket connects
3. Verify "MATCH FOUND!" appears
4. Verify auto-navigation to Game
5. Verify timer starts on Game screen
6. Complete a full game cycle

### AI Mode Test

1. Select VS Computer → Choose difficulty
2. Verify no 429 errors
3. Complete a game
4. Verify win/loss recorded

---

## Version History

| Date | Changes |
|------|---------|
| 2026-01-15 | Backend security overhaul, dual-client architecture |
| 2026-01-15 | Fixed matchmaking UI flow, rate limits |
| 2026-01-15 | Added clearMatchFound action, timer delay |
