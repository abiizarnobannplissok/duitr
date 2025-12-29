-- Migration: Create pinjaman_items and want_to_buy_items tables
-- Description: Creates missing tables for loan tracking and wishlist features
-- Date: 2025-12-29

-- ============================================
-- Table: want_to_buy_items (Wishlist)
-- ============================================
CREATE TABLE IF NOT EXISTS public.want_to_buy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(20,2) NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  estimated_date DATE NOT NULL,
  icon TEXT,
  is_purchased BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user_id (foreign key optimization)
CREATE INDEX IF NOT EXISTS idx_want_to_buy_items_user_id 
ON public.want_to_buy_items(user_id);

-- Enable RLS
ALTER TABLE public.want_to_buy_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for want_to_buy_items
CREATE POLICY "Users can view their own want to buy items" 
ON public.want_to_buy_items FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own want to buy items" 
ON public.want_to_buy_items FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own want to buy items" 
ON public.want_to_buy_items FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own want to buy items" 
ON public.want_to_buy_items FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================
-- Table: pinjaman_items (Loans)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pinjaman_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  icon TEXT,
  is_settled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user_id (foreign key optimization)
CREATE INDEX IF NOT EXISTS idx_pinjaman_items_user_id 
ON public.pinjaman_items(user_id);

-- Enable RLS
ALTER TABLE public.pinjaman_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pinjaman_items
CREATE POLICY "Users can view their own loan items" 
ON public.pinjaman_items FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loan items" 
ON public.pinjaman_items FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loan items" 
ON public.pinjaman_items FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own loan items" 
ON public.pinjaman_items FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE public.want_to_buy_items IS 'User wishlist items - things they want to buy';
COMMENT ON TABLE public.pinjaman_items IS 'User loan tracking - money lent or borrowed';

COMMENT ON INDEX idx_want_to_buy_items_user_id IS 'Index to support foreign key constraint and RLS policy for want_to_buy_items';
COMMENT ON INDEX idx_pinjaman_items_user_id IS 'Index to support foreign key constraint and RLS policy for pinjaman_items';
