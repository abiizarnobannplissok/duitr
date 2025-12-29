// Supabase Client - Hardcoded for personal use
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Hardcoded credentials (personal use only)
const SUPABASE_URL = "https://uinqxiwkjqmjeknzftmf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpbnF4aXdranFtamVrbnpmdG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjQyNjUsImV4cCI6MjA4MDg0MDI2NX0.kYmJ6HRLhB7A8Oil4SoMd0b7A7Bw8KuOOMeQguSmM8c";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
