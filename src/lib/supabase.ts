import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Strict check for Vercel runtime
if (typeof window === 'undefined') {
  if (!supabaseUrl) console.error("SERVER-SIDE ERROR: NEXT_PUBLIC_SUPABASE_URL is undefined");
}

export const supabase = createClient(
  supabaseUrl || '[https://placeholder-to-prevent-crash.supabase.co](https://placeholder-to-prevent-crash.supabase.co)',
  supabaseAnonKey || 'placeholder-key'
);