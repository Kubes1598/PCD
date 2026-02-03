-- ============================================================================
-- Schema v3 - Data Cleanup Script
-- ============================================================================
-- Run THIS FIRST before schema_v3.sql
-- This cleans up NULL values that would violate the new constraints
-- ============================================================================

-- STEP 1: Check how many problematic rows exist
DO $$
DECLARE
    null_player1_count INTEGER;
    null_player2_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_player1_count FROM games WHERE player1_id IS NULL;
    SELECT COUNT(*) INTO null_player2_count FROM games WHERE player2_id IS NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Data Cleanup Analysis';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Games with NULL player1_id: %', null_player1_count;
    RAISE NOTICE 'Games with NULL player2_id: %', null_player2_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- OPTION A: DELETE incomplete games (Recommended if these are test/orphan data)
-- ============================================================================

-- Delete games where player IDs are NULL (likely incomplete/orphan games)
DELETE FROM games 
WHERE player1_id IS NULL OR player2_id IS NULL;

-- Log deletion
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % incomplete games with NULL player IDs', deleted_count;
END $$;

-- ============================================================================
-- OPTION B: Update with placeholder (Alternative - if you want to keep records)
-- Uncomment below if you prefer to keep the games with a placeholder
-- ============================================================================

-- UPDATE games 
-- SET player1_id = COALESCE(player1_id, 'unknown_player')
-- WHERE player1_id IS NULL;

-- UPDATE games 
-- SET player2_id = COALESCE(player2_id, 'unknown_player')
-- WHERE player2_id IS NULL;

-- ============================================================================
-- STEP 2: Verify cleanup was successful
-- ============================================================================

DO $$
DECLARE
    remaining_null_p1 INTEGER;
    remaining_null_p2 INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_null_p1 FROM games WHERE player1_id IS NULL;
    SELECT COUNT(*) INTO remaining_null_p2 FROM games WHERE player2_id IS NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Cleanup Verification';
    RAISE NOTICE '========================================';
    
    IF remaining_null_p1 = 0 AND remaining_null_p2 = 0 THEN
        RAISE NOTICE '✅ SUCCESS: No NULL player IDs remaining';
        RAISE NOTICE 'You can now run schema_v3.sql safely!';
    ELSE
        RAISE NOTICE '⚠️ WARNING: Still have NULL values:';
        RAISE NOTICE '   - NULL player1_id: %', remaining_null_p1;
        RAISE NOTICE '   - NULL player2_id: %', remaining_null_p2;
        RAISE NOTICE 'Please investigate before running schema_v3.sql';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 3: Also check for other potential constraint violations
-- ============================================================================

-- Check for games where winner is not a player (data integrity check)
DO $$
DECLARE
    invalid_winner_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_winner_count 
    FROM games 
    WHERE winner IS NOT NULL 
      AND winner != player1_name 
      AND winner != player2_name;
    
    IF invalid_winner_count > 0 THEN
        RAISE NOTICE '⚠️ Found % games where winner is not player1 or player2', invalid_winner_count;
        RAISE NOTICE 'These will need to be fixed before schema_v3.sql';
    ELSE
        RAISE NOTICE '✅ All winners are valid players';
    END IF;
END $$;

-- Check players table for potential balance constraint violations
-- (Only if you have total_coins_earned and total_coins_spent columns)
DO $$
BEGIN
    -- Check if columns exist first
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'total_coins_earned'
    ) THEN
        -- Check for balance inconsistencies
        PERFORM 1 FROM players 
        WHERE coin_balance != 10000 + COALESCE(total_coins_earned, 0) - COALESCE(total_coins_spent, 0)
        LIMIT 1;
        
        IF FOUND THEN
            RAISE NOTICE '⚠️ Some players have balance inconsistencies';
            RAISE NOTICE 'The balance constraint in schema_v3 may fail';
            RAISE NOTICE 'Consider removing or adjusting chk_balance_consistency';
        ELSE
            RAISE NOTICE '✅ Player balances are consistent';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ total_coins_earned/spent columns not found - skipping balance check';
    END IF;
END $$;

-- ============================================================================
-- DONE - Now run schema_v3.sql
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Data cleanup complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEP: Run schema_v3.sql';
    RAISE NOTICE '========================================';
END $$;
