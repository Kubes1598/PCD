# PCD Backend (Rust)

High-performance Rust backend for Poisoned Candy Duel game.

## Quick Start

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgres://user:pass@localhost:5432/pcd_game
# JWT_SECRET=your-secret-key

# Build and run
cargo run

# Or build release version
cargo build --release
./target/release/pcd-backend
```

## Project Structure

```
backend-rust/
├── Cargo.toml              # Dependencies
├── .env.example            # Environment template
├── src/
│   ├── main.rs             # Entry point
│   ├── config.rs           # Configuration
│   ├── error.rs            # Error handling
│   ├── db/                 # Database layer
│   │   ├── postgres.rs     # PostgreSQL client
│   │   ├── redis.rs        # Redis client
│   │   └── models.rs       # Data models
│   ├── game/               # Game logic
│   │   ├── engine.rs       # PoisonedCandyDuel
│   │   ├── state.rs        # GameSession
│   │   └── types.rs        # Enums, constants
│   ├── routes/             # HTTP handlers
│   │   ├── auth.rs         # Login/register
│   │   ├── oauth.rs        # Google/Apple
│   │   ├── game.rs         # Game CRUD
│   │   ├── users.rs        # Profiles
│   │   ├── ai.rs           # AI opponent
│   │   └── matchmaking.rs  # WebSocket
│   ├── middleware/         # Axum layers
│   │   ├── auth.rs         # JWT validation
│   │   ├── rate_limit.rs   # Rate limiting
│   │   └── security.rs     # Security headers
│   └── ws/                 # Real-time
│       ├── connection.rs   # ConnectionManager
│       ├── matchmaking.rs  # CityMatchmakingQueue
│       └── timer.rs        # GameTimerManager
└── tests/
    ├── unit/               # Unit tests
    └── integration/        # API tests
```

## API Endpoints

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `GET /auth/me` - Current user

### OAuth
- `GET /oauth/google/callback` - Google Sign-In
- `GET /oauth/apple/callback` - Apple Sign-In
- `GET /oauth/guest` - Guest login

### Games
- `POST /games` - Create game
- `GET /games/:id` - Get game state
- `DELETE /games/:id` - Delete game
- `POST /games/:id/poison` - Set poison
- `POST /games/:id/move` - Pick candy

### Users
- `GET /users/:id` - Get profile
- `GET /users/leaderboard` - Rankings

### AI
- `POST /ai/move` - Get AI move

### WebSocket
- `GET /ws/matchmaking/:player_id` - Matchmaking

## Testing

```bash
# Run unit tests
cargo test --lib

# Run integration tests (requires running server)
cargo test --test '*' -- --ignored

# Run with coverage
cargo tarpaulin --out Html
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_SECRET` | JWT signing key | Yes |
| `REDIS_URL` | Redis connection | No |
| `PORT` | Server port (default: 8000) | No |
| `ENVIRONMENT` | development/production | No |
| `RUST_LOG` | Log level | No |

## Performance

Expected benchmarks vs Python:

| Metric | Python | Rust |
|--------|--------|------|
| Request latency | 15-50ms | 1-5ms |
| Memory usage | 300MB | 30MB |
| WebSocket connections | 1,000 | 100,000+ |
| Binary size | N/A | ~15MB |
