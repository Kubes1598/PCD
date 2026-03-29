# Docker Setup Guide

This guide covers running PostgreSQL and Redis via Docker for local development and deploying the PCD backend in a container.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

---

## 1. Start PostgreSQL & Redis

```bash
cd /path/to/pcd-game/PCD
docker-compose up -d
```

Verify both services are healthy:

```bash
docker-compose ps
```

You should see:

| Service | Port | Status |
|---------|------|--------|
| `pcd-postgres` | 5432 | healthy |
| `pcd-redis` | 6379 | healthy |

---

## 2. Connect the Rust Backend

Update `backend-rust/.env` to point at the Docker services:

```env
DATABASE_URL=postgres://pcd:pcd_secret@localhost:5432/pcd_game
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=8000
ENVIRONMENT=development
RUST_LOG=pcd_backend=debug,tower_http=debug
```

> If you were previously using a local PostgreSQL (e.g. `postgres://user@localhost:5432/pcd_game`), update the user and password to match the Docker config.

Then start the backend:

```bash
cd backend-rust
cargo run
```

The logs should show:
```
✅ Redis connected
✅ Database connected
🎮 Server listening on http://0.0.0.0:8000
```

---

## 3. Run Database Migrations

The backend runs migrations automatically on startup via `sqlx::migrate!()`. If you need to run them manually:

```bash
cd backend-rust
DATABASE_URL=postgres://pcd:pcd_secret@localhost:5432/pcd_game sqlx migrate run
```

---

## 4. Connect the React Native Frontend

For **physical device testing** (Expo Go), the app needs to reach the backend over the network.

### Option A: Same Wi-Fi (LAN IP)

Find your Mac's IP:

```bash
ipconfig getifaddr en0
```

Create `React-native/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_MAC_IP>:8000
```

### Option B: Tunnel (any network)

```bash
npx localtunnel --port 8000
```

Use the generated URL in `React-native/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-tunnel-url.loca.lt
```

Then restart Expo:

```bash
cd React-native
npx expo start --tunnel --clear
```

---

## 5. Stopping Services

```bash
docker-compose down       # Stop containers (data preserved)
docker-compose down -v    # Stop + delete volumes (fresh start)
```

---

## 6. Production Notes

For production deployment, consider:

1. **Use `POSTGRES_PASSWORD` from environment / secrets manager** — never hardcode in the compose file.
2. **Enable SSL** on PostgreSQL (`sslmode=require` in `DATABASE_URL`).
3. **Set `REDIS_URL` with auth**: `redis://:password@host:6379`.
4. **Containerize the Rust backend** using a multi-stage Dockerfile:

```dockerfile
# Build stage
FROM rust:1.77-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/pcd-backend /usr/local/bin/
CMD ["pcd-backend"]
```

5. **Use Docker networks** instead of `localhost` — containers reference each other by service name (e.g. `postgres://pcd:pcd_secret@postgres:5432/pcd_game`).
