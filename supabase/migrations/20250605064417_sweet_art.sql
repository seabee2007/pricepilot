/*
  # Initial Schema Setup for PricePilot

  1. New Tables
    - `saved_searches` - Stores user's saved searches with price thresholds
    - `price_history` - Tracks average price history for search queries

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own saved searches
    - Add policy for anyone to read price history
*/

-- Create saved_searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  query text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  price_threshold numeric NOT NULL,
  last_checked_price numeric DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  avg_price numeric NOT NULL
);

-- Enable Row Level Security
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_searches
CREATE POLICY "Users can read their own saved searches"
  ON saved_searches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved searches"
  ON saved_searches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved searches"
  ON saved_searches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches"
  ON saved_searches
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policy for price_history (public read, service role write)
CREATE POLICY "Anyone can read price history"
  ON price_history
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can insert price history"
  ON price_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS price_history_query_idx ON price_history(query);
CREATE INDEX IF NOT EXISTS price_history_timestamp_idx ON price_history(timestamp);