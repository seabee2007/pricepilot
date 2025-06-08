-- Create vehicle value cache table for RapidAPI results
CREATE TABLE IF NOT EXISTS public.vehicle_value_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  value_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vehicle_cache_key ON public.vehicle_value_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_vehicle_cache_make_model_year ON public.vehicle_value_cache(make, model, year);
CREATE INDEX IF NOT EXISTS idx_vehicle_cache_created_at ON public.vehicle_value_cache(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vehicle_value_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - vehicle value cache is public read-only data
DROP POLICY IF EXISTS "Anyone can view vehicle cache" ON public.vehicle_value_cache;
DROP POLICY IF EXISTS "Service role can manage vehicle cache" ON public.vehicle_value_cache;

CREATE POLICY "Anyone can view vehicle cache" ON public.vehicle_value_cache
  FOR SELECT USING (true);

-- Service role can manage all vehicle cache (for Edge Functions and admin tasks)
CREATE POLICY "Service role can manage vehicle cache" ON public.vehicle_value_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON public.vehicle_value_cache TO authenticated;
GRANT SELECT ON public.vehicle_value_cache TO anon;
GRANT ALL ON public.vehicle_value_cache TO service_role;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_vehicle_cache_updated_at ON public.vehicle_value_cache;
CREATE TRIGGER update_vehicle_cache_updated_at
  BEFORE UPDATE ON public.vehicle_value_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add vehicle value lookup function
CREATE OR REPLACE FUNCTION public.get_vehicle_value_history(
    p_make TEXT,
    p_model TEXT,
    p_year INTEGER,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    day DATE,
    avg_value DECIMAL(10,2),
    data_points INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(ph.timestamp) as price_date,
        ROUND(AVG(ph.avg_price), 2)::DECIMAL(10,2) as avg_value,
        COUNT(*)::INTEGER as data_points
    FROM price_history ph
    WHERE ph.query ILIKE '%' || p_make || '%' || p_model || '%' || p_year || '%'
        AND ph.data_source = 'rapidapi_vehicle_pricing'
        AND ph.timestamp >= NOW() - INTERVAL '1 day' * p_days
        AND ph.avg_price > 0
    GROUP BY DATE(ph.timestamp)
    ORDER BY DATE(ph.timestamp);
END;
$$;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION public.get_vehicle_value_history(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_value_history(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- Comments
COMMENT ON TABLE public.vehicle_value_cache IS 'Cache table for RapidAPI vehicle pricing results to reduce API calls';
COMMENT ON FUNCTION public.get_vehicle_value_history(TEXT, TEXT, INTEGER, INTEGER) IS 'Returns historical vehicle value data for charting'; 