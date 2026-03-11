-- Audit logs for sensitive events and expanded transaction support

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    email TEXT, -- Identifying email for events (even if user doesn't exist yet)
    event_type TEXT NOT NULL, -- e.g. "LOGIN_FAILED", "LARGE_TRANSFER", "PASSWORD_CHANGE"
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
    metadata JSONB DEFAULT '{}', -- Context like IP, User-Agent, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 2. Add diamond support to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS diamond_amount INTEGER NOT NULL DEFAULT 0;
