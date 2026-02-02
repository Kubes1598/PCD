-- ============================================================================
-- PCD Database Schema v3 - ROLLBACK SCRIPT
-- ============================================================================
-- 
-- This script reverses all changes made by schema_v3.sql
-- Run this if you need to rollback to v2 schema
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: RESTORE TABLE PERMISSIONS
-- ============================================================================

-- Restore direct SELECT access to players table
GRANT SELECT ON players TO anon, authenticated;

-- ============================================================================
-- SECTION 2: DROP MATERIALIZED VIEWS
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS player_stats_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS arena_economics_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS daily_activity_mv CASCADE;

-- Drop refresh function
DROP FUNCTION IF EXISTS refresh_analytics_views();

-- ============================================================================
-- SECTION 3: DROP INDEXES
-- ============================================================================

-- Drop composite indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_players_leaderboard_composite;
DROP INDEX CONCURRENTLY IF EXISTS idx_coin_transactions_player_history;
DROP INDEX CONCURRENTLY IF EXISTS idx_games_player_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_games_active_by_time;

-- Drop covering indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_players_leaderboard_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_players_name_covering;

-- Drop BRIN indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_coin_transactions_created_brin;
DROP INDEX CONCURRENTLY IF EXISTS idx_games_created_brin;

-- ============================================================================
-- SECTION 4: DROP CONSTRAINTS
-- ============================================================================

-- Drop CHECK constraints
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_player1_id_not_null;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_player2_id_not_null;
ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_winner_is_player;
ALTER TABLE players DROP CONSTRAINT IF EXISTS chk_balance_consistency;
ALTER TABLE players DROP CONSTRAINT IF EXISTS chk_wins_vs_played;

-- ============================================================================
-- SECTION 5: DROP ENUM TYPES
-- ============================================================================

-- Note: Cannot drop if columns are using these types
-- You would need to convert columns back to VARCHAR first

-- DROP TYPE IF EXISTS game_status CASCADE;
-- DROP TYPE IF EXISTS transaction_type CASCADE;
-- DROP TYPE IF EXISTS arena_type CASCADE;

-- ============================================================================
-- SECTION 6: REMOVE COMMENTS
-- ============================================================================

COMMENT ON TABLE coin_transactions IS NULL;

COMMIT;

-- Analyze tables after rollback
ANALYZE players;
ANALYZE games;
ANALYZE coin_transactions;

-- Log rollback completion
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Schema v3 rollback completed';
    RAISE NOTICE 'Database reverted to v2 state';
    RAISE NOTICE '========================================';
END $$;
