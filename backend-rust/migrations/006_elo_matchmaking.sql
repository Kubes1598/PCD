-- Migration 006: ELO-based Matchmaking System
-- Adds elo_rating column for skill-based player matching

-- Add ELO rating column (default 1000 = baseline for new players)
ALTER TABLE players ADD COLUMN IF NOT EXISTS elo_rating INT DEFAULT 1000;

-- Index for fast ELO lookups during matchmaking
CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo_rating);

-- Index for reconnect recovery: find active matches by player
CREATE INDEX IF NOT EXISTS idx_matches_active_p1 ON matches(p1_id) WHERE status IN ('MATCHED', 'READY', 'STARTED');
CREATE INDEX IF NOT EXISTS idx_matches_active_p2 ON matches(p2_id) WHERE status IN ('MATCHED', 'READY', 'STARTED');
