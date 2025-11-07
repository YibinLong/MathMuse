import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

/**
 * WHY: This creates the Supabase client for your app to talk to the backend
 * 
 * HOW IT WORKS:
 * 1. We read the Supabase URL and anon key from app.config.ts (which loads from .env)
 * 2. These credentials let the app authenticate and make requests to your Supabase backend
 * 3. The anon key is safe to use in the app - it's public and protected by Row Level Security (RLS)
 */

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Error checking: warn if credentials are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials! Check your .env file');
  console.error('You need to create a .env file with:');
  console.error('  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


