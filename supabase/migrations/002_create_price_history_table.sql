-- Create price_history table for PricePilot price tracking
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  avg_price DECIMAL(10,2) NOT NULL,
  item_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_price_history_query ON public.price_history(query);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON public.price_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_query_timestamp ON public.price_history(query, timestamp DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - price history is public read-only data
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view price history" ON public.price_history;
DROP POLICY IF EXISTS "Service role can manage price history" ON public.price_history;
DROP POLICY IF EXISTS "Authenticated users can insert price history" ON public.price_history;

CREATE POLICY "Anyone can view price history" ON public.price_history
  FOR SELECT USING (true);

-- Allow authenticated users to insert price history data
CREATE POLICY "Authenticated users can insert price history" ON public.price_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Service role can manage all price history (for Edge Functions and admin tasks)
CREATE POLICY "Service role can manage price history" ON public.price_history
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON public.price_history TO authenticated;
GRANT SELECT ON public.price_history TO anon;
GRANT INSERT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role; 