/*
  # Fix Price History RLS Policy

  1. Problem
    - Current RLS policy only allows service_role to insert price history data
    - Frontend authenticated users cannot save price history, getting 403 Forbidden
    - This prevents the price tracking functionality from working

  2. Solution
    - Add policy to allow authenticated users to insert price history data
    - Maintain read access for everyone
    - Keep service_role management capabilities

  3. Security
    - Authenticated users can only insert, not update/delete existing data
    - Service role maintains full control for admin operations
    - Read access remains public for charts and displays
*/

-- Drop and recreate the policies to fix the issue
DROP POLICY IF EXISTS "Anyone can view price history" ON public.price_history;
DROP POLICY IF EXISTS "Service role can manage price history" ON public.price_history;
DROP POLICY IF EXISTS "Authenticated users can insert price history" ON public.price_history;

-- Allow anyone to read price history data (for charts and displays)
CREATE POLICY "Anyone can view price history" ON public.price_history
  FOR SELECT USING (true);

-- Allow authenticated users to insert new price history data
CREATE POLICY "Authenticated users can insert price history" ON public.price_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Service role can manage all price history (for Edge Functions and admin tasks)
CREATE POLICY "Service role can manage price history" ON public.price_history
  FOR ALL USING (auth.role() = 'service_role');

-- Grant the necessary permissions
GRANT SELECT ON public.price_history TO authenticated;
GRANT SELECT ON public.price_history TO anon;
GRANT INSERT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;

-- Add helpful comment
COMMENT ON TABLE public.price_history IS 'Stores eBay price history data. Authenticated users can insert, everyone can read, service role has full access.';
