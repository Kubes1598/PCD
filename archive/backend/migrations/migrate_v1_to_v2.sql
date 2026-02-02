-- ============================================================================
-- PCD Database Migration Script - From v1 to v2
-- ============================================================================
-- 
-- This script safely migrates an existing database to the secure v2 schema.
-- It should be run in Supabase SQL Editor or via psql.
--
-- IMPORTANT: Run this in a transaction so you can rollback if needed.
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add new columns to existing tables (non-breaking changes)
-- ============================================================================

-- Add player_id columns to games table if they don't exist
ALTER TABLE public.games 
    ADD COLUMN IF NOT EXISTS player1_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS player2_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Add player_id to game_moves if it doesn't exist
ALTER TABLE public.game_moves
    ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.players(id) ON DELETE SET NULL;

-- Add missing columns to players if they don't exist
ALTER TABLE public.players
    ADD COLUMN IF NOT EXISTS rank VARCHAR(20) DEFAULT 'Amateur',
    ADD COLUMN IF NOT EXISTS tier VARCHAR(10) DEFAULT '',
    ADD COLUMN IF NOT EXISTS stars INTEGER DEFAULT 0;

-- Add player_id to coin_transactions if it doesn't exist (optional - migration will populate)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'coin_transactions' AND column_name = 'player_id') THEN
        ALTER TABLE public.coin_transactions 
            ADD COLUMN player_id UUID REFERENCES public.players(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Populate new columns with data from existing columns
-- ============================================================================

-- Populate player_id in games from player names
UPDATE public.games g
SET player1_id = p.id
FROM public.players p
WHERE g.player1_name = p.name AND g.player1_id IS NULL;

UPDATE public.games g
SET player2_id = p.id
FROM public.players p
WHERE g.player2_name = p.name AND g.player2_id IS NULL;

-- Populate player_id in game_moves
UPDATE public.game_moves gm
SET player_id = p.id
FROM public.players p
WHERE gm.player_name = p.name AND gm.player_id IS NULL;

-- Populate player_id in coin_transactions
UPDATE public.coin_transactions ct
SET player_id = p.id
FROM public.players p
WHERE ct.player_name = p.name AND ct.player_id IS NULL;

-- ============================================================================
-- STEP 3: Create audit infrastructure
-- ============================================================================

-- Audit log table
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

-- Indexes for audit queries
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
EXCEPTION WHEN OTHERS THEN
    -- Don't fail the main operation if audit fails
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers
DROP TRIGGER IF EXISTS audit_players ON players;
CREATE TRIGGER audit_players
    AFTER INSERT OR UPDATE OR DELETE ON players
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================================
-- STEP 4: Create atomic balance update function
-- ============================================================================

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

-- ============================================================================
-- STEP 5: Drop old permissive RLS policies
-- ============================================================================

-- Games policies
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;
DROP POLICY IF EXISTS "Players can update their games" ON public.games;

-- Game moves policies
DROP POLICY IF EXISTS "Anyone can view game moves" ON public.game_moves;
DROP POLICY IF EXISTS "Anyone can insert game moves" ON public.game_moves;

-- Players policies
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
DROP POLICY IF EXISTS "Anyone can create players" ON public.players;
DROP POLICY IF EXISTS "Players can update own profile" ON public.players;

-- Coin transactions policies
DROP POLICY IF EXISTS "Players can view own transactions" ON public.coin_transactions;
DROP POLICY IF EXISTS "Anyone can create transactions" ON public.coin_transactions;

-- Arena stats policies
DROP POLICY IF EXISTS "Anyone can view arena stats" ON public.arena_stats;
DROP POLICY IF EXISTS "Anyone can update arena stats" ON public.arena_stats;

-- ============================================================================
-- STEP 6: Create new secure RLS policies
-- ============================================================================

-- GAMES TABLE
CREATE POLICY "Users can view own games" ON public.games
    FOR SELECT USING (
        auth.uid() = player1_id 
        OR auth.uid() = player2_id
        OR status = 'finished'
    );

CREATE POLICY "Authenticated users can create games" ON public.games
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Players can update own games" ON public.games
    FOR UPDATE TO authenticated
    USING (auth.uid() = player1_id OR auth.uid() = player2_id)
    WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Service role full access to games" ON public.games
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- GAME MOVES TABLE
CREATE POLICY "Users can view moves in own games" ON public.game_moves
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games g 
            WHERE g.id = game_moves.game_id 
            AND (g.player1_id = auth.uid() OR g.player2_id = auth.uid())
        )
    );

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

CREATE POLICY "Service role full access to game_moves" ON public.game_moves
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- PLAYERS TABLE
CREATE POLICY "Users can view public player info" ON public.players
    FOR SELECT USING (true);

CREATE POLICY "Users can create own profile" ON public.players
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.players
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role full access to players" ON public.players
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- COIN TRANSACTIONS TABLE (Restricted!)
CREATE POLICY "Users can view own transactions" ON public.coin_transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = player_id);

-- NO INSERT POLICY for authenticated/anon - only via function
CREATE POLICY "Service role can insert transactions" ON public.coin_transactions
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can view all transactions" ON public.coin_transactions
    FOR SELECT TO service_role
    USING (true);

-- ARENA STATS TABLE
CREATE POLICY "Anyone can view arena stats v2" ON public.arena_stats
    FOR SELECT USING (true);

CREATE POLICY "Service role can modify arena stats" ON public.arena_stats
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- AUDIT LOG TABLE (Admin only)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only audit access" ON public.audit_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STEP 7: Create secure views
-- ============================================================================

-- Public player profiles (hides password_hash)
CREATE OR REPLACE VIEW public.player_profiles AS
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

-- Leaderboard view
CREATE OR REPLACE VIEW public.leaderboard AS
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

-- ============================================================================
-- STEP 8: Update permissions
-- ============================================================================

-- Grant execute on atomic function to service_role only
REVOKE EXECUTE ON FUNCTION update_player_balance_atomic FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION update_player_balance_atomic TO service_role;

-- Grant view access
GRANT SELECT ON public.player_profiles TO anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- ============================================================================
-- STEP 9: Add new indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_games_player1_id ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2_id ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_not_deleted ON games(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_game_moves_player_id ON game_moves(player_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_player_id ON coin_transactions(player_id);

-- ============================================================================
-- DONE - Commit the transaction
-- ============================================================================

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
-- Run these queries to verify the migration was successful:
--
-- 1. Check RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- 2. Check policies exist:
--    SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
--
-- 3. Test atomic function:
--    SELECT update_player_balance_atomic(
--        '<player-uuid>'::uuid, 
--        100, 0, 'reward', NULL, NULL, 'Test reward'
--    );
--
-- 4. Verify transaction was blocked for anon:
--    SET ROLE anon;
--    INSERT INTO coin_transactions (...) VALUES (...);  -- Should fail!
--    RESET ROLE;
-- ============================================================================
