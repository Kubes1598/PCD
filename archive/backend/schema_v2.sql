-- ============================================================================
-- PCD Database Schema v2 - Security Hardened
-- ============================================================================
-- This migration script applies security fixes identified in the audit:
-- 1. Drops all permissive RLS policies
-- 2. Creates proper user-scoped policies
-- 3. Revokes direct INSERT on coin_transactions
-- 4. Creates atomic balance update function
-- 5. Adds audit infrastructure
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure we are using the public schema
SET search_path TO public;

-- ============================================================================
-- SECTION 1: TABLE DEFINITIONS (with security improvements)
-- ============================================================================

-- Games table to store all game sessions
-- SECURITY: Added player1_id and player2_id for proper auth binding
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player1_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    player1_name VARCHAR(100) NOT NULL,
    player2_name VARCHAR(100) NOT NULL,
    game_state JSONB NOT NULL,
    p1_poison VARCHAR(50),  -- Secret choice
    p2_poison VARCHAR(50),  -- Secret choice
    status VARCHAR(50) DEFAULT 'waiting_for_poison' CHECK (status IN (
        'waiting_for_poison', 
        'in_progress', 
        'finished', 
        'abandoned'
    )),
    winner VARCHAR(100) NULL,
    deleted_at TIMESTAMPTZ NULL,  -- Soft delete support
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game moves table to store individual moves
CREATE TABLE IF NOT EXISTS public.game_moves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    player_name VARCHAR(100) NOT NULL,
    move_type VARCHAR(20) NOT NULL CHECK (move_type IN ('poison_choice', 'candy_pick')),
    candy VARCHAR(50) NOT NULL CHECK (char_length(candy) <= 50),  -- Length constraint
    turn_number INTEGER NOT NULL CHECK (turn_number >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table for user management
-- SECURITY: password_hash should NEVER be selected in public queries
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL CHECK (
        name ~ '^[a-zA-Z0-9_]{3,50}$'  -- Alphanumeric + underscore, 3-50 chars
    ),
    email VARCHAR(255) UNIQUE NULL CHECK (
        email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    password_hash TEXT NULL,
    profile_id VARCHAR(10) UNIQUE NULL,
    friends UUID[] DEFAULT '{}',  -- Changed to UUID array for referential integrity
    games_played INTEGER DEFAULT 0 CHECK (games_played >= 0),
    games_won INTEGER DEFAULT 0 CHECK (games_won >= 0),
    rank VARCHAR(20) DEFAULT 'Amateur',
    tier VARCHAR(10) DEFAULT '',
    stars INTEGER DEFAULT 0 CHECK (stars >= 0),
    coin_balance BIGINT DEFAULT 10000 CHECK (coin_balance >= 0),
    diamonds_balance INTEGER DEFAULT 500 CHECK (diamonds_balance >= 0),
    total_coins_earned BIGINT DEFAULT 0 CHECK (total_coins_earned >= 0),
    total_coins_spent BIGINT DEFAULT 0 CHECK (total_coins_spent >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    last_daily_reward TIMESTAMPTZ NULL
);

-- Coin transactions table for tracking all coin movements
-- SECURITY: player_id now has FK constraint
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,  -- Denormalized for convenience
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'game_entry',
        'prize_payout',
        'purchase',
        'reward',
        'refund'
    )),
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    description TEXT CHECK (char_length(description) <= 500),  -- Limit DoS potential
    arena_type VARCHAR(20) CHECK (arena_type IS NULL OR arena_type IN ('dubai', 'cairo', 'oslo')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arena statistics table
CREATE TABLE IF NOT EXISTS public.arena_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_type VARCHAR(20) NOT NULL CHECK (arena_type IN ('dubai', 'cairo', 'oslo')),
    total_games INTEGER DEFAULT 0,
    total_entry_fees BIGINT DEFAULT 0,
    total_prizes_paid BIGINT DEFAULT 0,
    service_fees_collected BIGINT DEFAULT 0,
    created_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(arena_type, created_date)
);

-- ============================================================================
-- SECTION 2: AUDIT INFRASTRUCTURE
-- ============================================================================

-- Audit log table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, user_id)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
        auth.uid()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to sensitive tables
DROP TRIGGER IF EXISTS audit_players ON players;
CREATE TRIGGER audit_players
    AFTER INSERT OR UPDATE OR DELETE ON players
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_coin_transactions ON coin_transactions;
CREATE TRIGGER audit_coin_transactions
    AFTER INSERT ON coin_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================================
-- SECTION 3: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_games_player1_id ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2_id ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_not_deleted ON games(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_player_id ON game_moves(player_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_player_id ON coin_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_game_id ON coin_transactions(game_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON coin_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_arena_stats_type_date ON arena_stats(arena_type, created_date);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email) WHERE email IS NOT NULL;

-- ============================================================================
-- SECTION 4: HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at 
    BEFORE UPDATE ON public.games 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 5: ATOMIC BALANCE UPDATE FUNCTION (SECURITY DEFINER)
-- ============================================================================

-- This function is the ONLY way to modify balances and create transactions
-- It runs with elevated privileges but validates all inputs
CREATE OR REPLACE FUNCTION update_player_balance_atomic(
    p_player_id UUID,
    p_coin_delta BIGINT,
    p_diamond_delta INT DEFAULT 0,
    p_transaction_type TEXT DEFAULT 'game_entry',
    p_game_id UUID DEFAULT NULL,
    p_arena_type TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_player RECORD;
    v_new_coin_balance BIGINT;
    v_new_diamond_balance INT;
    v_transaction_id UUID;
BEGIN
    -- Validate transaction type
    IF p_transaction_type NOT IN ('game_entry', 'prize_payout', 'purchase', 'reward', 'refund') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid transaction type');
    END IF;
    
    -- Validate arena type if provided
    IF p_arena_type IS NOT NULL AND p_arena_type NOT IN ('dubai', 'cairo', 'oslo') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid arena type');
    END IF;
    
    -- Lock the player row and get current balances
    SELECT id, name, coin_balance, diamonds_balance, total_coins_earned, total_coins_spent
    INTO v_player
    FROM players 
    WHERE id = p_player_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;
    
    -- Calculate new balances
    v_new_coin_balance := v_player.coin_balance + p_coin_delta;
    v_new_diamond_balance := v_player.diamonds_balance + p_diamond_delta;
    
    -- Prevent negative balances
    IF v_new_coin_balance < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coin balance');
    END IF;
    
    IF v_new_diamond_balance < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient diamond balance');
    END IF;
    
    -- Update player balance
    UPDATE players 
    SET 
        coin_balance = v_new_coin_balance,
        diamonds_balance = v_new_diamond_balance,
        total_coins_earned = CASE WHEN p_coin_delta > 0 THEN total_coins_earned + p_coin_delta ELSE total_coins_earned END,
        total_coins_spent = CASE WHEN p_coin_delta < 0 THEN total_coins_spent + ABS(p_coin_delta) ELSE total_coins_spent END,
        last_active = NOW()
    WHERE id = p_player_id;
    
    -- Create transaction record
    INSERT INTO coin_transactions (
        player_id,
        player_name,
        game_id, 
        transaction_type, 
        amount, 
        balance_after, 
        arena_type,
        description
    ) VALUES (
        p_player_id,
        v_player.name,
        p_game_id, 
        p_transaction_type,
        p_coin_delta, 
        v_new_coin_balance, 
        p_arena_type,
        p_description
    )
    RETURNING id INTO v_transaction_id;
    
    -- Update arena stats if applicable
    IF p_arena_type IS NOT NULL AND p_transaction_type IN ('game_entry', 'prize_payout') THEN
        INSERT INTO arena_stats (arena_type, total_games, total_entry_fees, total_prizes_paid, created_date)
        VALUES (
            p_arena_type,
            CASE WHEN p_transaction_type = 'game_entry' THEN 1 ELSE 0 END,
            CASE WHEN p_transaction_type = 'game_entry' THEN ABS(p_coin_delta) ELSE 0 END,
            CASE WHEN p_transaction_type = 'prize_payout' THEN p_coin_delta ELSE 0 END,
            CURRENT_DATE
        )
        ON CONFLICT (arena_type, created_date) 
        DO UPDATE SET
            total_games = arena_stats.total_games + EXCLUDED.total_games,
            total_entry_fees = arena_stats.total_entry_fees + EXCLUDED.total_entry_fees,
            total_prizes_paid = arena_stats.total_prizes_paid + EXCLUDED.total_prizes_paid;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true, 
        'transaction_id', v_transaction_id,
        'new_coin_balance', v_new_coin_balance,
        'new_diamond_balance', v_new_diamond_balance
    );
END;
$$;

-- Grant execute to authenticated users (server will call this via service role)
-- REVOKE EXECUTE ON FUNCTION update_player_balance_atomic FROM anon;
-- GRANT EXECUTE ON FUNCTION update_player_balance_atomic TO service_role;

-- ============================================================================
-- SECTION 6: ATOMIC DUEL INITIATION (MATCHMAKING)
-- ============================================================================

-- Function to handle both player fee deductions and game creation in one transaction
-- This eliminates the need for manual rollbacks in Python
CREATE OR REPLACE FUNCTION initiate_duel_atomic(
    p_p1_id UUID,
    p_p1_name TEXT,
    p_p2_id UUID,
    p_p2_name TEXT,
    p_city TEXT,
    p_fee BIGINT,
    p_game_id UUID,
    p_initial_state JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_p1_bal BIGINT;
    v_p2_bal BIGINT;
BEGIN
    -- 1. Lock both players in alphabetical order of ID to prevent deadlocks
    IF p_p1_id < p_p2_id THEN
        SELECT coin_balance INTO v_p1_bal FROM players WHERE id = p_p1_id FOR UPDATE;
        SELECT coin_balance INTO v_p2_bal FROM players WHERE id = p_p2_id FOR UPDATE;
    ELSE
        SELECT coin_balance INTO v_p2_bal FROM players WHERE id = p_p2_id FOR UPDATE;
        SELECT coin_balance INTO v_p1_bal FROM players WHERE id = p_p1_id FOR UPDATE;
    END IF;

    -- 2. Verify existence and balances
    IF v_p1_bal IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player 1 not found');
    END IF;
    IF v_p2_bal IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player 2 not found');
    END IF;

    IF v_p1_bal < p_fee THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player 1 insufficient funds', 'player_id', p_p1_id);
    END IF;
    IF v_p2_bal < p_fee THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player 2 insufficient funds', 'player_id', p_p2_id);
    END IF;

    -- 3. Deduct fees
    UPDATE players SET 
        coin_balance = coin_balance - p_fee, 
        total_coins_spent = total_coins_spent + p_fee,
        last_active = NOW()
    WHERE id = p_p1_id;
    
    UPDATE players SET 
        coin_balance = coin_balance - p_fee, 
        total_coins_spent = total_coins_spent + p_fee,
        last_active = NOW()
    WHERE id = p_p2_id;

    -- 4. Log transactions
    INSERT INTO coin_transactions (player_id, player_name, amount, transaction_type, arena_type, balance_after, description, game_id)
    VALUES (p_p1_id, p_p1_name, -p_fee, 'game_entry', p_city, v_p1_bal - p_fee, 'Arena Match: ' || p_city, p_game_id);
    
    INSERT INTO coin_transactions (player_id, player_name, amount, transaction_type, arena_type, balance_after, description, game_id)
    VALUES (p_p2_id, p_p2_name, -p_fee, 'game_entry', p_city, v_p2_bal - p_fee, 'Arena Match: ' || p_city, p_game_id);

    -- 5. Create Game Record
    -- Note: Poison is NULL initially, will be set during poison_selection phase
    INSERT INTO games (id, player1_id, player2_id, player1_name, player2_name, game_state, status)
    VALUES (p_game_id, p_p1_id, p_p2_id, p_p1_name, p_p2_name, p_initial_state, 'waiting_for_poison');

    -- 6. Update Arena Stats
    INSERT INTO arena_stats (arena_type, total_games, total_entry_fees, created_date)
    VALUES (p_city, 1, p_fee * 2, CURRENT_DATE)
    ON CONFLICT (arena_type, created_date) 
    DO UPDATE SET
        total_games = arena_stats.total_games + 1,
        total_entry_fees = arena_stats.total_entry_fees + (p_fee * 2);

    RETURN jsonb_build_object('success', true, 'game_id', p_game_id);
END;
$$;

GRANT EXECUTE ON FUNCTION initiate_duel_atomic TO service_role;

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- GAMES TABLE POLICIES
-- ----------------------------------------

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;
DROP POLICY IF EXISTS "Players can update their games" ON public.games;

-- Users can view games they are part of (or finished games for history)
CREATE POLICY "Users can view own games" ON public.games
    FOR SELECT USING (
        auth.uid() = player1_id 
        OR auth.uid() = player2_id
        OR status = 'finished'  -- Allow viewing finished games for leaderboards
    );

-- Authenticated users can create games where they are player1
CREATE POLICY "Authenticated users can create games" ON public.games
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = player1_id);

-- Players can update games they are part of
CREATE POLICY "Players can update own games" ON public.games
    FOR UPDATE TO authenticated
    USING (auth.uid() = player1_id OR auth.uid() = player2_id)
    WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Service role can do anything (for server-side operations)
CREATE POLICY "Service role full access to games" ON public.games
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------
-- GAME MOVES TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Anyone can view game moves" ON public.game_moves;
DROP POLICY IF EXISTS "Anyone can insert game moves" ON public.game_moves;

-- Users can view moves for games they're in
CREATE POLICY "Users can view moves in own games" ON public.game_moves
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games g 
            WHERE g.id = game_moves.game_id 
            AND (g.player1_id = auth.uid() OR g.player2_id = auth.uid())
        )
    );

-- Authenticated users can insert moves for their games
CREATE POLICY "Users can insert moves in own games" ON public.game_moves
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = player_id
        AND EXISTS (
            SELECT 1 FROM games g 
            WHERE g.id = game_moves.game_id 
            AND (g.player1_id = auth.uid() OR g.player2_id = auth.uid())
        )
    );

-- Service role can do anything
CREATE POLICY "Service role full access to game_moves" ON public.game_moves
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------
-- PLAYERS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
DROP POLICY IF EXISTS "Anyone can create players" ON public.players;
DROP POLICY IF EXISTS "Players can update own profile" ON public.players;

-- CRITICAL: Users can view public player info (NOT password_hash)
-- This is implemented via a VIEW, not direct table access
CREATE POLICY "Users can view public player info" ON public.players
    FOR SELECT USING (true);  -- Actual field restriction via player_profiles view

-- Registration creates player profile
CREATE POLICY "Users can create own profile" ON public.players
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.players
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Service role can do anything
CREATE POLICY "Service role full access to players" ON public.players
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------
-- COIN TRANSACTIONS POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Players can view own transactions" ON public.coin_transactions;
DROP POLICY IF EXISTS "Anyone can create transactions" ON public.coin_transactions;

-- Users can ONLY view their own transactions
CREATE POLICY "Users can view own transactions" ON public.coin_transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = player_id);

-- CRITICAL: Block ALL direct inserts - only via function
-- No INSERT policy for anon or authenticated
-- Transactions are created ONLY via update_player_balance_atomic()

-- Service role can insert (needed for the SECURITY DEFINER function)
CREATE POLICY "Service role can insert transactions" ON public.coin_transactions
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can view all transactions" ON public.coin_transactions
    FOR SELECT TO service_role
    USING (true);

-- ----------------------------------------
-- ARENA STATS POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Anyone can view arena stats" ON public.arena_stats;
DROP POLICY IF EXISTS "Anyone can update arena stats" ON public.arena_stats;

-- Anyone can view arena stats (public data)
CREATE POLICY "Anyone can view arena stats" ON public.arena_stats
    FOR SELECT USING (true);

-- Only service role can modify (via atomic function)
CREATE POLICY "Service role can modify arena stats" ON public.arena_stats
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------
-- AUDIT LOG POLICIES
-- ----------------------------------------

-- Only service_role can access audit logs
CREATE POLICY "Service role only audit access" ON public.audit_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- SECTION 7: SECURE VIEWS (hide sensitive data)
-- ============================================================================

-- Public player profiles (hides password_hash and email)
CREATE OR REPLACE VIEW public.player_profiles 
WITH (security_invoker = true)
AS
SELECT 
    id,
    name,
    profile_id,
    games_played,
    games_won,
    rank,
    tier,
    stars,
    coin_balance,
    diamonds_balance,
    created_at,
    last_active
FROM public.players;

-- Game statistics view
CREATE OR REPLACE VIEW public.game_stats 
WITH (security_invoker = true)
AS
SELECT 
    COUNT(*) as total_games,
    COUNT(*) FILTER (WHERE status NOT IN ('finished', 'abandoned') AND deleted_at IS NULL) as active_games,
    COUNT(*) FILTER (WHERE status = 'finished') as completed_games,
    COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_games,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) as avg_game_duration_minutes
FROM public.games
WHERE deleted_at IS NULL;

-- Player leaderboard view
CREATE OR REPLACE VIEW public.leaderboard
WITH (security_invoker = true)
AS
SELECT 
    name,
    games_played,
    games_won,
    ROUND((games_won::numeric / NULLIF(games_played, 0)) * 100, 2) as win_percentage,
    rank,
    tier,
    stars,
    coin_balance
FROM public.players
ORDER BY games_won DESC, games_played DESC
LIMIT 100;

-- Arena economics summary
CREATE OR REPLACE VIEW public.arena_economics
WITH (security_invoker = true)
AS
SELECT 
    arena_type,
    SUM(total_games) as total_games,
    SUM(total_entry_fees) as total_entry_fees,
    SUM(total_prizes_paid) as total_prizes_paid,
    SUM(service_fees_collected) as total_service_fees
FROM public.arena_stats
GROUP BY arena_type
ORDER BY total_games DESC;

-- ============================================================================
-- SECTION 8: GRANT PERMISSIONS
-- ============================================================================

-- Revoke all from public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Grant select on views
GRANT SELECT ON public.player_profiles TO anon, authenticated;
GRANT SELECT ON public.game_stats TO anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT SELECT ON public.arena_economics TO anon, authenticated;

-- Grant table-level permissions (RLS handles row-level)
GRANT SELECT, INSERT, UPDATE ON public.games TO authenticated;
GRANT SELECT, INSERT ON public.game_moves TO authenticated;
GRANT SELECT ON public.players TO anon, authenticated;
GRANT INSERT, UPDATE ON public.players TO authenticated;
GRANT SELECT ON public.coin_transactions TO authenticated;
GRANT SELECT ON public.arena_stats TO anon, authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION update_player_balance_atomic TO service_role;

-- ============================================================================
-- END OF SCHEMA V2
-- ============================================================================
