-- Poisoned Candy Duel Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Games table to store all game sessions
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player1_name VARCHAR(100) NOT NULL,
    player2_name VARCHAR(100) NOT NULL,
    game_state JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'waiting_for_poison' CHECK (status IN (
        'waiting_for_poison', 
        'in_progress', 
        'finished', 
        'abandoned'
    )),
    winner VARCHAR(100) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game moves table to store individual moves (optional for analytics)
CREATE TABLE IF NOT EXISTS game_moves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,
    move_type VARCHAR(20) NOT NULL CHECK (move_type IN ('poison_choice', 'candy_pick')),
    candy VARCHAR(20) NOT NULL,
    turn_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table for user management (optional)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    coin_balance BIGINT DEFAULT 10000,  -- Starting balance of 10,000 coins
    diamonds_balance INTEGER DEFAULT 50,  -- Starting balance of 50 diamonds
    total_coins_earned BIGINT DEFAULT 0,  -- Lifetime coins earned
    total_coins_spent BIGINT DEFAULT 0,   -- Lifetime coins spent
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Coin transactions table for tracking all coin movements
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_name VARCHAR(100) NOT NULL,
    game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'game_entry',      -- Entry fee for arena games
        'prize_payout',    -- Prize money from winning arena games
        'purchase',        -- Buying items/upgrades
        'reward',          -- Daily rewards, achievements, etc.
        'refund'           -- Refunds for cancelled games
    )),
    amount BIGINT NOT NULL,  -- Can be positive (earning) or negative (spending)
    balance_after BIGINT NOT NULL,  -- Player balance after this transaction
    description TEXT,
    arena_type VARCHAR(20),  -- 'dubai', 'cairo', 'oslo' for arena-specific tracking
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arena statistics table for tracking arena-specific data
CREATE TABLE IF NOT EXISTS arena_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_type VARCHAR(20) NOT NULL CHECK (arena_type IN ('dubai', 'cairo', 'oslo')),
    total_games INTEGER DEFAULT 0,
    total_entry_fees BIGINT DEFAULT 0,
    total_prizes_paid BIGINT DEFAULT 0,
    service_fees_collected BIGINT DEFAULT 0,
    created_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(arena_type, created_date)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_name);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_name);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_player ON game_moves(player_name);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_player ON coin_transactions(player_name);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_game_id ON coin_transactions(game_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON coin_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_arena ON coin_transactions(arena_type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_arena_stats_type_date ON arena_stats(arena_type, created_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_games_updated_at 
    BEFORE UPDATE ON games 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read games (for spectating)
CREATE POLICY "Anyone can view games" ON games
    FOR SELECT USING (true);

-- Policy: Anyone can create games
CREATE POLICY "Anyone can create games" ON games
    FOR INSERT WITH CHECK (true);

-- Policy: Players can update their own games
CREATE POLICY "Players can update their games" ON games
    FOR UPDATE USING (
        player1_name = current_setting('request.jwt.claims', true)::json->>'name' OR
        player2_name = current_setting('request.jwt.claims', true)::json->>'name'
    );

-- Policy: Anyone can view game moves
CREATE POLICY "Anyone can view game moves" ON game_moves
    FOR SELECT USING (true);

-- Policy: Anyone can insert game moves
CREATE POLICY "Anyone can insert game moves" ON game_moves
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can view players
CREATE POLICY "Anyone can view players" ON players
    FOR SELECT USING (true);

-- Policy: Anyone can create player profiles
CREATE POLICY "Anyone can create players" ON players
    FOR INSERT WITH CHECK (true);

-- Policy: Players can update their own profile
CREATE POLICY "Players can update own profile" ON players
    FOR UPDATE USING (
        name = current_setting('request.jwt.claims', true)::json->>'name'
    );

-- Policy: Players can view their own coin transactions
CREATE POLICY "Players can view own transactions" ON coin_transactions
    FOR SELECT USING (
        player_name = current_setting('request.jwt.claims', true)::json->>'name'
    );

-- Policy: Anyone can insert coin transactions (for game system)
CREATE POLICY "Anyone can create transactions" ON coin_transactions
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can view arena stats
CREATE POLICY "Anyone can view arena stats" ON arena_stats
    FOR SELECT USING (true);

-- Policy: Anyone can update arena stats (for game system)
CREATE POLICY "Anyone can update arena stats" ON arena_stats
    FOR ALL USING (true);

-- Sample data for testing (optional)
-- INSERT INTO games (id, player1_name, player2_name, game_state, status) VALUES
-- ('550e8400-e29b-41d4-a716-446655440000', 'Alice', 'Bob', '{"turn": 1, "phase": "poison_selection"}', 'waiting_for_poison');

-- View for game statistics
CREATE OR REPLACE VIEW game_stats AS
SELECT 
    COUNT(*) as total_games,
    COUNT(*) FILTER (WHERE status != 'finished') as active_games,
    COUNT(*) FILTER (WHERE status = 'finished') as completed_games,
    COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_games,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) as avg_game_duration_minutes
FROM games;

-- View for player statistics
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.name,
    p.games_played,
    p.games_won,
    ROUND((p.games_won::float / NULLIF(p.games_played, 0)) * 100, 2) as win_percentage,
    p.coin_balance,
    p.diamonds_balance,
    p.total_coins_earned,
    p.total_coins_spent,
    (p.total_coins_earned - p.total_coins_spent) as net_coin_change,
    p.last_active
FROM players p
ORDER BY p.games_won DESC, p.games_played DESC;

-- View for coin transaction summary by player
CREATE OR REPLACE VIEW player_coin_summary AS
SELECT 
    player_name,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
    SUM(amount) as net_change,
    MAX(balance_after) as current_balance,
    MAX(created_at) as last_transaction
FROM coin_transactions
GROUP BY player_name
ORDER BY current_balance DESC;

-- View for arena economics summary
CREATE OR REPLACE VIEW arena_economics AS
SELECT 
    arena_type,
    SUM(total_games) as total_games,
    SUM(total_entry_fees) as total_entry_fees,
    SUM(total_prizes_paid) as total_prizes_paid,
    SUM(service_fees_collected) as total_service_fees,
    ROUND((SUM(service_fees_collected)::float / NULLIF(SUM(total_entry_fees), 0)) * 100, 2) as service_fee_percentage,
    SUM(total_entry_fees) - SUM(total_prizes_paid) - SUM(service_fees_collected) as net_house_edge
FROM arena_stats
GROUP BY arena_type
ORDER BY total_games DESC;

-- View for daily coin flow
CREATE OR REPLACE VIEW daily_coin_flow AS
SELECT 
    DATE(created_at) as transaction_date,
    arena_type,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM coin_transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), arena_type, transaction_type
ORDER BY transaction_date DESC, arena_type, transaction_type; 