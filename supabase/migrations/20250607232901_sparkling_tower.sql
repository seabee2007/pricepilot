/*
  # Fix 30-day price history RPC functions

  1. Database Schema Updates
    - Add missing columns to price_history table safely
    - Create proper indexes for time-series queries
    - Set up RPC functions for 30-day price aggregation

  2. RPC Functions
    - get_30d_price_history(search_id) - for specific saved searches
    - get_30d_price_history_by_query(query) - for general queries
    - Both return daily aggregated price data

  3. Security
    - Grant proper permissions to authenticated users
    - Ensure service role can manage price history
*/

-- Add search_id foreign key to price_history if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_history' AND column_name = 'search_id'
  ) THEN
    ALTER TABLE public.price_history ADD COLUMN search_id UUID REFERENCES public.saved_searches(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_price_history_search_id ON public.price_history(search_id);
  END IF;
END $$;

-- Add individual price field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_history' AND column_name = 'price'
  ) THEN
    ALTER TABLE public.price_history ADD COLUMN price DECIMAL(10,2);
  END IF;
END $$;

-- Add min_price and max_price for daily ranges if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_history' AND column_name = 'min_price'
  ) THEN
    ALTER TABLE public.price_history ADD COLUMN min_price DECIMAL(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_history' AND column_name = 'max_price'
  ) THEN
    ALTER TABLE public.price_history ADD COLUMN max_price DECIMAL(10,2);
  END IF;
END $$;

-- Create indexes for better performance on time-series queries
CREATE INDEX IF NOT EXISTS idx_price_history_search_id_timestamp ON public.price_history(search_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_query_timestamp ON public.price_history(query, timestamp DESC);
-- CREATE INDEX IF NOT EXISTS idx_price_history_timestamp_recent ON public.price_history(timestamp) WHERE timestamp > NOW() - INTERVAL '30 days';

-- Drop existing functions if they exist to recreate them properly
DROP FUNCTION IF EXISTS public.get_30d_price_history(UUID);
DROP FUNCTION IF EXISTS public.get_30d_price_history_by_query(TEXT);

-- Create RPC function to get 30-day price history for a specific search
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
  RETURN QUERY
  SELECT
    date_trunc('day', ph.timestamp)::date AS day,
    MIN(COALESCE(ph.min_price, ph.price, ph.avg_price)) AS low_price,
    MAX(COALESCE(ph.max_price, ph.price, ph.avg_price)) AS high_price,
    AVG(COALESCE(ph.avg_price, ph.price)) AS avg_price,
    COUNT(*) AS data_points
  FROM public.price_history ph
  WHERE ph.search_id = p_search_id
    AND ph.timestamp > (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY date_trunc('day', ph.timestamp)::date
  ORDER BY date_trunc('day', ph.timestamp)::date;
END;
$$;

-- Create RPC function to get price history for a query (fallback for existing data)
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
  RETURN QUERY
  SELECT
    date_trunc('day', ph.timestamp)::date AS day,
    MIN(COALESCE(ph.min_price, ph.price, ph.avg_price)) AS low_price,
    MAX(COALESCE(ph.max_price, ph.price, ph.avg_price)) AS high_price,
    AVG(COALESCE(ph.avg_price, ph.price)) AS avg_price,
    COUNT(*) AS data_points
  FROM public.price_history ph
  WHERE ph.query = p_query
    AND ph.timestamp > (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY date_trunc('day', ph.timestamp)::date
  ORDER BY date_trunc('day', ph.timestamp)::date;
END;
$$;

-- Create a view for easy access to daily price summaries
CREATE OR REPLACE VIEW public.daily_price_summary AS
SELECT
  search_id,
  query,
  date_trunc('day', timestamp)::date AS day,
  MIN(COALESCE(min_price, price, avg_price)) AS low_price,
  MAX(COALESCE(max_price, price, avg_price)) AS high_price,
  AVG(COALESCE(avg_price, price)) AS avg_price,
  COUNT(*) AS data_points
FROM public.price_history
WHERE timestamp > (CURRENT_DATE - INTERVAL '30 days')
GROUP BY search_id, query, day
ORDER BY search_id, day;

-- Grant permissions for the new functions and view
GRANT EXECUTE ON FUNCTION public.get_30d_price_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_query(TEXT) TO authenticated;
GRANT SELECT ON public.daily_price_summary TO authenticated;

-- Grant service role permissions for price history management
GRANT ALL ON public.price_history TO service_role;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_query(TEXT) TO service_role;
GRANT SELECT ON public.daily_price_summary TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_30d_price_history(UUID) IS 'Returns 30-day aggregated price history for a specific saved search';
COMMENT ON FUNCTION public.get_30d_price_history_by_query(TEXT) IS 'Returns 30-day aggregated price history for a search query (fallback)';
COMMENT ON VIEW public.daily_price_summary IS 'Daily aggregated price data for the past 30 days';