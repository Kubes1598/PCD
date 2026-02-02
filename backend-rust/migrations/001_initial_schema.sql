-- PCD Database Schema
-- Aligned with Rust code expectations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table (Combined User + Player for simplified auth flow in current Rust implementation)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    profile_id TEXT,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    coin_balance INTEGER NOT NULL DEFAULT 1000,
    diamonds_balance INTEGER NOT NULL DEFAULT 5,
    rank TEXT DEFAULT 'bronze',
    tier INTEGER DEFAULT 1,
    stars INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Games history
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player1_id UUID REFERENCES players(id),
    player2_id UUID REFERENCES players(id),
    player1_name TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    winner TEXT, -- Name or ID of winner
    status TEXT NOT NULL DEFAULT 'setup',
    game_state JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_games_won ON players(games_won DESC);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
