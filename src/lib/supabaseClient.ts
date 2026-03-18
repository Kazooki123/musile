import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
);