-- =====================================================
-- COMPLETE SUPABASE SCHEMA FOR PRICEPILOT
-- Includes all tables, functions, and 30-day price history
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SAVED SEARCHES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}' NOT NULL,
  price_threshold DECIMAL(10,2) NOT NULL,
  last_checked_price DECIMAL(10,2) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for saved_searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at ON public.saved_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_query ON public.saved_searches USING gin(to_tsvector('english', query));
CREATE INDEX IF NOT EXISTS idx_saved_searches_filters ON public.saved_searches USING gin(filters);

-- Enable RLS for saved_searches
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_searches
CREATE POLICY "Users can view own saved searches" ON public.saved_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved searches" ON public.saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches" ON public.saved_searches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches" ON public.saved_searches
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 2. ENHANCED PRICE HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  avg_price DECIMAL(10,2) NOT NULL,
  item_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Enhanced fields for 30-day tracking
  search_id UUID REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  price DECIMAL(10,2), -- Individual price point
  min_price DECIMAL(10,2), -- Daily minimum price
  max_price DECIMAL(10,2) -- Daily maximum price
);

-- Optimized indexes for price_history (no immutable function issues)
CREATE INDEX IF NOT EXISTS idx_price_history_query ON public.price_history(query);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp_desc ON public.price_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_search_id ON public.price_history(search_id) WHERE search_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_history_search_timestamp ON public.price_history(search_id, timestamp DESC) WHERE search_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_history_query_timestamp_desc ON public.price_history(query, timestamp DESC);

-- Composite index for daily aggregation queries
CREATE INDEX IF NOT EXISTS idx_price_history_daily_agg ON public.price_history(
  date_trunc('day', timestamp), 
  search_id, 
  query
) WHERE timestamp > '2024-01-01'::timestamp;

-- Index for price fields to speed up MIN/MAX operations
CREATE INDEX IF NOT EXISTS idx_price_history_prices ON public.price_history(
  COALESCE(min_price, price, avg_price),
  COALESCE(max_price, price, avg_price),
  COALESCE(avg_price, price)
) WHERE timestamp > '2024-01-01'::timestamp;

-- Enable RLS for price_history
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for price_history
CREATE POLICY "Anyone can view price history" ON public.price_history
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage price history" ON public.price_history
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 3. PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  preferred_location TEXT,
  notification_preferences JSONB DEFAULT '{"email_alerts": true, "price_drops": true}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- 4. SAVED ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.saved_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  image_url TEXT,
  item_url TEXT NOT NULL,
  condition TEXT,
  seller_username TEXT,
  seller_feedback_score INTEGER,
  seller_feedback_percentage TEXT,
  shipping_cost DECIMAL(10,2),
  shipping_currency TEXT DEFAULT 'USD',
  buying_options TEXT[],
  notes TEXT,
  price_alert_threshold DECIMAL(10,2),
  last_checked_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for saved_items
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON public.saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_item_id ON public.saved_items(item_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_created_at ON public.saved_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_items_price_alert ON public.saved_items(price_alert_threshold) WHERE price_alert_threshold IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_items_user_item ON public.saved_items(user_id, item_id);

-- Enable RLS for saved_items
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_items
CREATE POLICY "Users can view own saved items" ON public.saved_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved items" ON public.saved_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved items" ON public.saved_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved items" ON public.saved_items
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. STRIPE INTEGRATION TABLES
-- =====================================================

-- Stripe Customers
CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null unique,
  customer_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer data"
    ON stripe_customers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

-- Stripe Subscription Status Enum
CREATE TYPE stripe_subscription_status AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);

-- Stripe Subscriptions
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint primary key generated always as identity,
  customer_id text unique not null,
  subscription_id text default null,
  price_id text default null,
  current_period_start bigint default null,
  current_period_end bigint default null,
  cancel_at_period_end boolean default false,
  payment_method_brand text default null,
  payment_method_last4 text default null,
  status stripe_subscription_status not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription data"
    ON stripe_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- Stripe Order Status Enum
CREATE TYPE stripe_order_status AS ENUM (
    'pending',
    'completed',
    'canceled'
);

-- Stripe Orders
CREATE TABLE IF NOT EXISTS stripe_orders (
    id bigint primary key generated always as identity,
    checkout_session_id text not null,
    payment_intent_id text not null,
    customer_id text not null,
    amount_subtotal bigint not null,
    amount_total bigint not null,
    currency text not null,
    payment_status text not null,
    status stripe_order_status not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order data"
    ON stripe_orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- =====================================================
-- 6. UTILITY FUNCTIONS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- =====================================================
-- 7. 30-DAY PRICE HISTORY FUNCTIONS
-- =====================================================

-- RPC function to get 30-day price history for a specific search
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

-- RPC function to get price history for a query (fallback for existing data)
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

-- =====================================================
-- 8. VIEWS
-- =====================================================

-- Daily price summary view
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

-- View for user subscriptions
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
    c.customer_id,
    s.subscription_id,
    s.status as subscription_status,
    s.price_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.payment_method_brand,
    s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND s.deleted_at IS NULL;

-- View for user orders
CREATE VIEW stripe_user_orders WITH (security_invoker) AS
SELECT
    c.customer_id,
    o.id as order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status as order_status,
    o.created_at as order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND o.deleted_at IS NULL;

-- =====================================================
-- 9. TRIGGERS
-- =====================================================

-- Trigger to automatically update updated_at for saved_searches
CREATE TRIGGER set_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to automatically update updated_at for profiles
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to automatically update updated_at for saved_items
CREATE TRIGGER set_saved_items_updated_at
  BEFORE UPDATE ON public.saved_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to create profile automatically when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 10. PERMISSIONS
-- =====================================================

-- Grant permissions for authenticated users
GRANT ALL ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_items TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.price_history TO authenticated;
GRANT SELECT ON public.daily_price_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_query(TEXT) TO authenticated;
GRANT SELECT ON stripe_user_subscriptions TO authenticated;

-- Grant permissions for service role
GRANT ALL ON public.saved_searches TO service_role;
GRANT ALL ON public.saved_items TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.price_history TO service_role;
GRANT SELECT ON public.daily_price_summary TO service_role;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_30d_price_history_by_query(TEXT) TO service_role;

-- Grant permissions for anonymous users (price history is public)
GRANT SELECT ON public.price_history TO anon;

-- =====================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION public.get_30d_price_history(UUID) IS 'Returns 30-day aggregated price history for a specific saved search with improved performance';
COMMENT ON FUNCTION public.get_30d_price_history_by_query(TEXT) IS 'Returns 30-day aggregated price history for a search query with validation';
COMMENT ON VIEW public.daily_price_summary IS 'Daily aggregated price data for the past 30 days with additional metadata';
COMMENT ON FUNCTION public.handle_updated_at() IS 'Automatically updates updated_at timestamp on row updates';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile when user signs up';

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================