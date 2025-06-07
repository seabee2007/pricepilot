/*
  # Create saved_items table for individual item saving

  1. New Tables
    - `saved_items` - Stores individual eBay items that users save
      - Links to users via `user_id`
      - Stores complete item information for offline viewing
      - Includes price alert functionality
      - Tracks price changes over time

  2. Security
    - Enable RLS on saved_items table
    - Add policies for users to manage their own saved items
    - Users can only see/modify their own saved items

  3. Features
    - Save individual eBay items with full details
    - Set price alerts for saved items
    - Track price changes over time
    - Add personal notes to saved items
*/

-- Create saved_items table
CREATE TABLE IF NOT EXISTS public.saved_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT NOT NULL, -- eBay item ID
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
  buying_options TEXT[], -- Array of buying options like ['FIXED_PRICE', 'AUCTION']
  notes TEXT, -- User's personal notes about the item
  price_alert_threshold DECIMAL(10,2), -- Alert when price drops below this
  last_checked_price DECIMAL(10,2), -- Last known price for tracking changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON public.saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_item_id ON public.saved_items(item_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_created_at ON public.saved_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_items_price_alert ON public.saved_items(price_alert_threshold) WHERE price_alert_threshold IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_items_user_item ON public.saved_items(user_id, item_id); -- For checking if item is already saved

-- Enable Row Level Security (RLS)
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own saved items" ON public.saved_items;
DROP POLICY IF EXISTS "Users can insert own saved items" ON public.saved_items;
DROP POLICY IF EXISTS "Users can update own saved items" ON public.saved_items;
DROP POLICY IF EXISTS "Users can delete own saved items" ON public.saved_items;

-- Users can only see their own saved items
CREATE POLICY "Users can view own saved items" ON public.saved_items
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own saved items
CREATE POLICY "Users can insert own saved items" ON public.saved_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own saved items
CREATE POLICY "Users can update own saved items" ON public.saved_items
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own saved items
CREATE POLICY "Users can delete own saved items" ON public.saved_items
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_saved_items_updated_at ON public.saved_items;
CREATE TRIGGER set_saved_items_updated_at
  BEFORE UPDATE ON public.saved_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.saved_items TO authenticated;
GRANT ALL ON public.saved_items TO service_role;