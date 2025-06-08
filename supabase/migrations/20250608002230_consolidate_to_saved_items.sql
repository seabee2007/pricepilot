/*
  # Consolidate Saved Searches and Saved Items

  1. Problem
    - Having separate "saved searches" and "saved items" is confusing for users
    - Users just want to save things they're interested in
    - Duplicate functionality and UI complexity

  2. Solution
    - Extend saved_items table to support both individual items and search queries
    - Add optional fields for search functionality
    - Migrate any existing saved_searches data
    - Keep all the powerful features from both systems

  3. New Unified Model
    - Individual eBay items: item_id, title, price, image_url, etc. (existing)
    - Search queries: search_query, search_filters fields (new)
    - Both types support price alerts and tracking
    - Flexible design allows for mixed saved content
*/

-- Add search-related fields to saved_items table
ALTER TABLE public.saved_items 
ADD COLUMN IF NOT EXISTS search_query TEXT,
ADD COLUMN IF NOT EXISTS search_filters JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'item' CHECK (item_type IN ('item', 'search'));

-- Update the table to allow fields to be nullable for search entries
ALTER TABLE public.saved_items 
ALTER COLUMN item_id DROP NOT NULL,
ALTER COLUMN title DROP NOT NULL,
ALTER COLUMN price DROP NOT NULL,
ALTER COLUMN currency DROP NOT NULL,
ALTER COLUMN item_url DROP NOT NULL;

-- Add indexes for the new search functionality
CREATE INDEX IF NOT EXISTS idx_saved_items_search_query ON public.saved_items USING gin(to_tsvector('english', search_query)) WHERE search_query IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_items_search_filters ON public.saved_items USING gin(search_filters) WHERE search_filters != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_saved_items_type ON public.saved_items(item_type);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_type ON public.saved_items(user_id, item_type);

-- Migrate any existing saved_searches data to saved_items
INSERT INTO public.saved_items (
  user_id,
  item_type,
  search_query,
  search_filters,
  price_alert_threshold,
  last_checked_price,
  created_at,
  updated_at,
  notes
)
SELECT 
  user_id,
  'search' as item_type,
  query as search_query,
  filters as search_filters,
  price_threshold as price_alert_threshold,
  last_checked_price,
  created_at,
  updated_at,
  'Migrated from saved searches' as notes
FROM public.saved_searches
WHERE NOT EXISTS (
  SELECT 1 FROM public.saved_items si 
  WHERE si.user_id = saved_searches.user_id 
  AND si.search_query = saved_searches.query
  AND si.item_type = 'search'
);

-- Update price_history table to reference saved_items instead of saved_searches
-- First, add the new foreign key column
ALTER TABLE public.price_history 
ADD COLUMN IF NOT EXISTS saved_item_id UUID REFERENCES public.saved_items(id) ON DELETE CASCADE;

-- Update existing price_history records to link to migrated saved_items
UPDATE public.price_history 
SET saved_item_id = (
  SELECT si.id 
  FROM public.saved_items si 
  WHERE si.search_query = price_history.query 
  AND si.item_type = 'search'
  LIMIT 1
)
WHERE saved_item_id IS NULL AND search_id IS NOT NULL;

-- Create a view for backward compatibility with existing code
CREATE OR REPLACE VIEW public.saved_searches_view AS
SELECT 
  id,
  user_id,
  search_query as query,
  search_filters as filters,
  price_alert_threshold as price_threshold,
  last_checked_price,
  created_at,
  updated_at
FROM public.saved_items 
WHERE item_type = 'search';

-- Update RPC functions to work with saved_items
CREATE OR REPLACE FUNCTION public.get_30d_price_history_by_saved_item(p_saved_item_id UUID)
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
  -- Check if saved_item_id exists
  IF NOT EXISTS (SELECT 1 FROM public.saved_items WHERE id = p_saved_item_id) THEN
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
  WHERE ph.saved_item_id = p_saved_item_id
    AND ph.timestamp > (CURRENT_DATE - INTERVAL '30 days')
    AND (ph.min_price IS NOT NULL OR ph.price IS NOT NULL OR ph.avg_price IS NOT NULL)
  GROUP BY date_trunc('day', ph.timestamp)::date
  ORDER BY date_trunc('day', ph.timestamp)::date;
END;
$$;

-- Grant permissions for the new function
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_saved_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_saved_item(UUID) TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.saved_items IS 'Unified table for saved eBay items and search queries. Supports both individual items and saved searches with price alerts.';
COMMENT ON COLUMN public.saved_items.item_type IS 'Type of saved entry: "item" for individual eBay items, "search" for saved search queries';
COMMENT ON COLUMN public.saved_items.search_query IS 'Search query text (for item_type = "search")';
COMMENT ON COLUMN public.saved_items.search_filters IS 'Search filters as JSON (for item_type = "search")';
COMMENT ON FUNCTION public.get_30d_price_history_by_saved_item(UUID) IS 'Returns 30-day aggregated price history for a specific saved item (works for both items and searches)';
