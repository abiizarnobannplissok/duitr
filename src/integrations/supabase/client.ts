// Supabase Client - Re-export from main supabase lib to ensure single client instance
// This prevents session mismatch issues caused by multiple Supabase client instances
import { supabase } from '@/lib/supabase';

// Re-export the single supabase instance
export { supabase };
