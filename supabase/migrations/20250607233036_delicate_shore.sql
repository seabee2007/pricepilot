/*
  # Fix immutable function error in price history indexes

  1. Problem
    - The index with `NOW() - INTERVAL '30 days'` predicate fails because NOW() is not immutable
    - PostgreSQL requires functions in index predicates to be marked IMMUTABLE

  2. Solution
    - Remove the problematic index with NOW() function
    - Create simpler, more effective indexes without time-based predicates
    - Use partial indexes with static conditions where beneficial

  3. Performance
    - Add optimized indexes for common query patterns
    - Ensure RPC functions can use these indexes efficiently
*/

-- Drop the problematic index that uses NOW() function
DROP INDEX IF EXISTS public.idx_price_history_timestamp_recent;

-- Create better indexes without immutable function issues
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp_desc ON public.price_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_search_timestamp ON public.price_history(search_id, timestamp DESC) WHERE search_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_history_query_timestamp_desc ON public.price_history(query, timestamp DESC);

-- Create a composite index for the daily aggregation queries
-- CREATE INDEX IF NOT EXISTS idx_price_history_daily_agg ON public.price_history(
--   date_trunc('day', timestamp), 
--   search_id, 
--   query
-- ) WHERE timestamp > '2024-01-01'::timestamp; -- Use a static date instead of NOW()

-- Add index for price fields to speed up MIN/MAX operations
-- CREATE INDEX IF NOT EXISTS idx_price_history_prices ON public.price_history(
--   COALESCE(min_price, price, avg_price),
--   COALESCE(max_price, price, avg_price),
--   COALESCE(avg_price, price)
-- ) WHERE timestamp > '2024-01-01'::timestamp;

-- Update the RPC functions to be more efficient and handle edge cases better
CREATE OR REPLACE FUNCTION public.get_30d_price_history(p_search_id UUID)
RETURNS TABLE(
  day DATE, 
  low_price NUMERIC, 
  high_price NUMERIC, 
  avg_price NUMERIC,
  data_points BIGINT
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  -- Check if search_id exists
  IF NOT EXISTS (SELECT 1 FROM public.saved_searches WHERE id = p_search_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('day', ph.timestamp)::date AS day,
    MIN(COALESCE(ph.min_price, ph.price, ph.avg_price))::numeric AS low_price,
    MAX(COALESCE(ph.max_price, ph.price, ph.avg_price))::numeric AS high_price,
    AVG(COALESCE(ph.avg_price, ph.price))::numeric AS avg_price,
    COUNT(*)::bigint AS data_points
  FROM public.price_history ph
  WHERE ph.search_id = p_search_id
    AND ph.timestamp > (CURRENT_DATE - INTERVAL '30 days')
    AND (ph.min_price IS NOT NULL OR ph.price IS NOT NULL OR ph.avg_price IS NOT NULL)
  GROUP BY date_trunc('day', ph.timestamp)::date
  ORDER BY date_trunc('day', ph.timestamp)::date;
END;
$$;

-- Update the query-based function as well
CREATE OR REPLACE FUNCTION public.get_30d_price_history_by_query(p_query TEXT)
RETURNS TABLE(
  day DATE, 
  low_price NUMERIC, 
  high_price NUMERIC, 
  avg_price NUMERIC,
  data_points BIGINT
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  -- Validate input
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('day', ph.timestamp)::date AS day,
    MIN(COALESCE(ph.min_price, ph.price, ph.avg_price))::numeric AS low_price,
    MAX(COALESCE(ph.max_price, ph.price, ph.avg_price))::numeric AS high_price,
    AVG(COALESCE(ph.avg_price, ph.price))::numeric AS avg_price,
    COUNT(*)::bigint AS data_points
  FROM public.price_history ph
  WHERE ph.query = p_query
    AND ph.timestamp > (CURRENT_DATE - INTERVAL '30 days')
    AND (ph.min_price IS NOT NULL OR ph.price IS NOT NULL OR ph.avg_price IS NOT NULL)
  GROUP BY date_trunc('day', ph.timestamp)::date
  ORDER BY date_trunc('day', ph.timestamp)::date;
END;
$$;

-- Update the view to be more robust
CREATE OR REPLACE VIEW public.daily_price_summary AS
SELECT
  search_id,
  query,
  date_trunc('day', timestamp)::date AS day,
  MIN(COALESCE(min_price, price, avg_price)) AS low_price,
  MAX(COALESCE(max_price, price, avg_price)) AS high_price,
  AVG(COALESCE(avg_price, price)) AS avg_price,
  COUNT(*) AS data_points,
  MIN(timestamp) AS first_recorded,
  MAX(timestamp) AS last_recorded
FROM public.price_history
WHERE timestamp > (CURRENT_DATE - INTERVAL '30 days')
  AND (min_price IS NOT NULL OR price IS NOT NULL OR avg_price IS NOT NULL)
GROUP BY search_id, query, date_trunc('day', timestamp)::date
ORDER BY search_id, day;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_30d_price_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_query(TEXT) TO authenticated;
GRANT SELECT ON public.daily_price_summary TO authenticated;
GRANT ALL ON public.price_history TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION public.get_30d_price_history(UUID) IS 'Returns 30-day aggregated price history for a specific saved search with improved performance';
COMMENT ON FUNCTION public.get_30d_price_history_by_query(TEXT) IS 'Returns 30-day aggregated price history for a search query with validation';
COMMENT ON VIEW public.daily_price_summary IS 'Daily aggregated price data for the past 30 days with additional metadata';