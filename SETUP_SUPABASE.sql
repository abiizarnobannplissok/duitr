-- ============================================
-- DUITR - Complete Supabase Setup Script
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Enable Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 2: Create Tables
-- ============================================

-- Wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  balance DECIMAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  color TEXT NOT NULL
);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  category_id SERIAL PRIMARY KEY,
  category_key TEXT UNIQUE,
  en_name TEXT NOT NULL,
  id_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'system')),
  icon TEXT,
  color TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL NOT NULL,
  category_id INTEGER REFERENCES public.categories(category_id),
  description TEXT,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL
);

-- Budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id INTEGER REFERENCES public.categories(category_id),
  amount DECIMAL NOT NULL,
  spent DECIMAL NOT NULL DEFAULT 0,
  period TEXT NOT NULL
);

-- ============================================
-- STEP 3: Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create RLS Policies
-- ============================================

-- Wallets policies
CREATE POLICY "Users can view their own wallets" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own wallets" ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own wallets" ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own wallets" ON public.wallets
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view their own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Budgets policies
CREATE POLICY "Users can view their own budgets" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own budgets" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Anyone can view default categories" ON public.categories
  FOR SELECT USING (user_id IS NULL);
CREATE POLICY "Users can view their own categories" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Insert Default Categories (21 total)
-- ============================================
INSERT INTO categories (category_id, category_key, en_name, id_name, type, icon, color) VALUES 
  -- EXPENSE CATEGORIES (1-12, 19-21)
  (1, 'expense_groceries', 'Groceries', 'Kebutuhan Rumah', 'expense', 'shopping-basket', '#EF4444'),
  (2, 'expense_food', 'Dining', 'Makan di Luar', 'expense', 'utensils', '#F97316'),
  (3, 'expense_transportation', 'Transportation', 'Transportasi', 'expense', 'car', '#F59E0B'),
  (4, 'expense_subscription', 'Subscription', 'Berlangganan', 'expense', 'repeat', '#3B82F6'),
  (5, 'expense_housing', 'Housing', 'Perumahan', 'expense', 'home', '#8B5CF6'),
  (6, 'expense_entertainment', 'Entertainment', 'Hiburan', 'expense', 'film', '#EC4899'),
  (7, 'expense_shopping', 'Shopping', 'Belanja', 'expense', 'shopping-cart', '#F43F5E'),
  (8, 'expense_health', 'Health', 'Kesehatan', 'expense', 'heart-pulse', '#10B981'),
  (9, 'expense_education', 'Education', 'Pendidikan', 'expense', 'graduation-cap', '#06B6D4'),
  (10, 'expense_travel', 'Travel', 'Perjalanan', 'expense', 'plane', '#6366F1'),
  (11, 'expense_personal', 'Personal Care', 'Perawatan Diri', 'expense', 'user', '#A855F7'),
  (12, 'expense_other', 'Other', 'Lainnya', 'expense', 'more-horizontal', '#6B7280'),
  (19, 'expense_donation', 'Donation', 'Donasi', 'expense', 'heart', '#F87171'),
  (20, 'expense_investment', 'Investment', 'Investasi', 'expense', 'trending-up', '#34D399'),
  (21, 'expense_baby', 'Baby Needs', 'Kebutuhan Bayi', 'expense', 'baby', '#FBB6CE'),
  -- INCOME CATEGORIES (13-17)
  (13, 'income_salary', 'Salary', 'Gaji', 'income', 'wallet', '#10B981'),
  (14, 'income_business', 'Business', 'Bisnis', 'income', 'briefcase', '#3B82F6'),
  (15, 'income_investment', 'Investment', 'Investasi', 'income', 'trending-up', '#8B5CF6'),
  (16, 'income_gift', 'Gift', 'Hadiah', 'income', 'gift', '#EC4899'),
  (17, 'income_other', 'Other', 'Lainnya', 'income', 'more-horizontal', '#6B7280'),
  -- SYSTEM CATEGORY (18)
  (18, 'system_transfer', 'Transfer', 'Transfer', 'system', 'arrow-right-left', '#0EA5E9')
ON CONFLICT (category_key) DO NOTHING;

-- Reset sequence to avoid conflicts
SELECT setval('categories_category_id_seq', (SELECT COALESCE(MAX(category_id), 0) + 1 FROM categories));

-- ============================================
-- STEP 6: Create Performance Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON public.wallets (user_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS transactions_wallet_id_idx ON public.transactions (wallet_id);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON public.transactions (date);
CREATE INDEX IF NOT EXISTS transactions_category_id_idx ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON public.transactions (type);
CREATE INDEX IF NOT EXISTS budgets_user_id_idx ON public.budgets (user_id);
CREATE INDEX IF NOT EXISTS budgets_category_id_idx ON public.budgets (category_id);
CREATE INDEX IF NOT EXISTS categories_type_idx ON public.categories (type);
CREATE INDEX IF NOT EXISTS categories_user_id_idx ON public.categories (user_id);

-- ============================================
-- STEP 7: Create Helper Functions
-- ============================================

-- Function to delete all user data (used when changing currency)
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.transactions WHERE user_id = auth.uid();
  DELETE FROM public.budgets WHERE user_id = auth.uid();
  DELETE FROM public.wallets WHERE user_id = auth.uid();
  DELETE FROM public.categories WHERE user_id = auth.uid();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_all_user_data() TO authenticated;

-- Function to get user's currency preference
CREATE OR REPLACE FUNCTION public.get_user_currency()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_currency TEXT;
BEGIN
  SELECT raw_user_meta_data->>'currency' INTO user_currency
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_currency, 'IDR');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_currency() TO authenticated;

-- ============================================
-- STEP 8: Verify Setup
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
  category_count INTEGER;
BEGIN
  -- Check tables exist
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('wallets', 'transactions', 'budgets', 'categories');
  
  IF table_count = 4 THEN
    RAISE NOTICE '✅ All 4 tables created successfully';
  ELSE
    RAISE WARNING '❌ Expected 4 tables, found %', table_count;
  END IF;
  
  -- Check categories
  SELECT COUNT(*) INTO category_count FROM categories WHERE user_id IS NULL;
  
  IF category_count >= 21 THEN
    RAISE NOTICE '✅ All % default categories inserted', category_count;
  ELSE
    RAISE WARNING '❌ Expected 21 categories, found %', category_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 SETUP COMPLETE! Your Supabase database is ready.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Go to Project Settings > API';
  RAISE NOTICE '2. Copy your Project URL and anon key';
  RAISE NOTICE '3. Add them to Vercel environment variables';
END $$;
