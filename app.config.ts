import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * WHY: This config loads environment variables from .env file
 * Expo automatically reads .env and makes EXPO_PUBLIC_* vars available via process.env
 * 
 * HOW IT WORKS:
 * 1. Create .env file in project root
 * 2. Add EXPO_PUBLIC_SUPABASE_URL=your-url
 * 3. Add EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key
 * 4. Expo loads these automatically - accessible via process.env.EXPO_PUBLIC_*
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MathMuse',
  slug: 'mathmuse',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'com.mathmuse.app' },
  android: { package: 'com.mathmuse.app' },
  extra: {
    // Make env vars available to the app
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'dev',
    EXPO_PUBLIC_DEBUG: process.env.EXPO_PUBLIC_DEBUG || 'true',
  },
});


