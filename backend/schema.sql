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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_name);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_name);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_player ON game_moves(player_name);

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
    p.last_active
FROM players p
ORDER BY p.games_won DESC, p.games_played DESC; 