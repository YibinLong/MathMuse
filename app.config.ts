import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MathMuse',
  slug: 'mathmuse',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'com.mathmuse.app' },
  android: { package: 'com.mathmuse.app' },
});


