-- Add transactions table for idempotency and auditing
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    game_id UUID,
    reference_id TEXT UNIQUE, -- Ensures idempotency (e.g., "gameId_pId_entry")
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id);
