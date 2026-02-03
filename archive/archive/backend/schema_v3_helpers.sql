-- ============================================================================
-- Schema v3 - Helper Functions for Verification
-- ============================================================================
-- Run this in Supabase SQL Editor to enable proper verification
-- ============================================================================

-- Function to check if an index exists
CREATE OR REPLACE FUNCTION check_index_exists(index_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND indexname = index_name
    );
END;
$$;

-- Function to check if a materialized view exists
CREATE OR REPLACE FUNCTION check_matview_exists(view_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' AND matviewname = view_name
    );
END;
$$;

-- Function to list all schema v3 indexes
CREATE OR REPLACE FUNCTION list_v3_indexes()
RETURNS TABLE(indexname TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT pg_indexes.indexname::TEXT
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND pg_indexes.indexname LIKE 'idx_%';
END;
$$;

-- Function to list all materialized views
CREATE OR REPLACE FUNCTION list_matviews()
RETURNS TABLE(matviewname TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT pg_matviews.matviewname::TEXT
    FROM pg_matviews 
    WHERE schemaname = 'public';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_index_exists TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION check_matview_exists TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION list_v3_indexes TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION list_matviews TO authenticated, anon, service_role;

-- Test the functions
DO $$
BEGIN
    RAISE NOTICE 'Helper functions created successfully!';
    RAISE NOTICE 'You can now run the verification script.';
END $$;
