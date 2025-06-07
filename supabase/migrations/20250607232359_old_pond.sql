/*
  # Enhanced Price History with 30-day Tracking

  1. Schema Updates
    - Add search_id foreign key to price_history table
    - Add price field to price_history for individual price points
    - Create daily price summary view
    - Create RPC function for 30-day price history

  2. Views and Functions
    - daily_price_summary view for aggregated daily data
    - get_30d_price_history RPC function for frontend consumption
    - Enhanced price tracking capabilities

  3. Indexes
    - Add indexes for better query performance on date ranges
    - Optimize for time-series queries
*/

-- Add search_id foreign key to price_history if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_history' AND column_name = 'search_id'
  ) THEN
    ALTER TABLE public.price_history ADD COLUMN search_id UUID REFERENCES public.saved_searches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add price field for individual price points if it doesn't exist
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
-- CREATE INDEX IF NOT EXISTS idx_price_history_created_at_range ON public.price_history(created_at) WHERE created_at > '2024-01-01'::timestamp;

-- Create daily price summary view
CREATE OR REPLACE VIEW public.daily_price_summary AS
SELECT
  search_id,
  query,
  date_trunc('day', timestamp)::date AS day,
  MIN(COALESCE(price, avg_price)) AS low_price,
  MAX(COALESCE(price, avg_price)) AS high_price,
  AVG(COALESCE(price, avg_price)) AS avg_price,
  COUNT(*) AS data_points
FROM public.price_history
WHERE timestamp > (CURRENT_DATE - INTERVAL '30 days')
  AND search_id IS NOT NULL
GROUP BY search_id, query, day
ORDER BY search_id, day;

-- Create RPC function to get 30-day price history for a specific search
CREATE OR REPLACE FUNCTION public.get_30d_price_history(p_search_id UUID)
RETURNS TABLE(
  day DATE, 
  low_price NUMERIC, 
  high_price NUMERIC, 
  avg_price NUMERIC,
  data_points BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('day', ph.timestamp)::date,
    MIN(COALESCE(ph.price, ph.avg_price)),
    MAX(COALESCE(ph.price, ph.avg_price)),
    AVG(COALESCE(ph.price, ph.avg_price)),
    COUNT(*)
  FROM public.price_history ph
  WHERE ph.search_id = p_search_id
    AND ph.timestamp > (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY date_trunc('day', ph.timestamp)::date
  ORDER BY date_trunc('day', ph.timestamp)::date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create RPC function to get price history for a query (fallback for existing data)
CREATE OR REPLACE FUNCTION public.get_30d_price_history_by_query(p_query TEXT)
RETURNS TABLE(
  day DATE, 
  low_price NUMERIC, 
  high_price NUMERIC, 
  avg_price NUMERIC,
  data_points BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('day', ph.timestamp)::date,
    MIN(COALESCE(ph.price, ph.avg_price)),
    MAX(COALESCE(ph.price, ph.avg_price)),
    AVG(COALESCE(ph.avg_price, ph.price)),
    COUNT(*)
  FROM public.price_history ph
  WHERE ph.query = p_query
    AND ph.timestamp > (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY date_trunc('day', ph.timestamp)::date
  ORDER BY date_trunc('day', ph.timestamp)::date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION public.get_30d_price_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_query(TEXT) TO authenticated;
GRANT SELECT ON public.daily_price_summary TO authenticated;

-- Grant service role permissions for price history management
GRANT ALL ON public.price_history TO service_role;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_query(TEXT) TO service_role;