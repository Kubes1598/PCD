-- Migration: 005_high_assurance_online_mode
-- Implements Transactional Outbox, Immutable Match Ledger, and Persistent Match States

-- 1. Match Ledger (Immutable Source of Truth for Economy & Stats)
CREATE TABLE IF NOT EXISTS match_ledger (
    match_id UUID PRIMARY KEY,
    p1_id UUID NOT NULL REFERENCES players(id),
    p2_id UUID NOT NULL REFERENCES players(id),
    winner_id UUID REFERENCES players(id), -- NULL for draw
    entry_fee INT NOT NULL,
    prize INT NOT NULL,
    result_type VARCHAR(20) NOT NULL, -- 'p1_win', 'p2_win', 'draw', 'timeout', 'canceled'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Transactional Outbox (Reliable WebSocket Event Delivery)
CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    target_player_id UUID REFERENCES players(id), -- NULL if broadcast is needed (though usually scoped)
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 3. Persistent Matches (Survival across server restarts)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY,
    p1_id UUID NOT NULL REFERENCES players(id),
    p2_id UUID NOT NULL REFERENCES players(id),
    city VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'MATCHED', 'READY', 'STARTED', 'FINISHED', 'CANCELED'
    p1_poison VARCHAR(20),
    p2_poison VARCHAR(20),
    final_result VARCHAR(20),
    game_data JSONB, -- Serialized GameSession state
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_matches_active ON matches(status) WHERE status IN ('MATCHED', 'READY', 'STARTED');
CREATE INDEX IF NOT EXISTS idx_match_ledger_p1 ON match_ledger(p1_id);
CREATE INDEX IF NOT EXISTS idx_match_ledger_p2 ON match_ledger(p2_id);

-- Add unique constraint to transactions to ensure idempotency when settling
-- reference_id is already unique in the schema definitions, ensuring repeat settlements fail.
