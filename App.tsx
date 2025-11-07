import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Pressable, Alert } from 'react-native';
import HandwritingCanvas from './components/HandwritingCanvas';
import AuthScreen from './screens/AuthScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from './lib/supabase';
import { useEffect, useState } from 'react';
import { useSessionStore } from './stores/sessionStore';

/**
 * Main App Component
 * 
 * WHY: We need to check if the user is authenticated before showing the canvas
 * 
 * FLOW:
 * 1. App starts → Check if user is logged in (session exists)
 * 2. If logged in → Show HandwritingCanvas
 * 3. If NOT logged in → Show AuthScreen
 * 4. Listen for auth changes (login/logout) and update UI accordingly
 */
export default function App() {
  // Select each piece individually to avoid returning a new object each render
  const session = useSessionStore((s) => s.session);
  const initialized = useSessionStore((s) => s.initialized);
  const setSession = useSessionStore((s) => s.setSession);
  const signOutFn = useSessionStore((s) => s.signOut);
  const initializeFn = useSessionStore((s) => s.initialize);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Run once on mount
    initializeFn().catch((err) => {
      console.warn('Failed to initialize session:', err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // intentionally empty

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOutFn();
    } catch (error: any) {
      Alert.alert('Sign out failed', error?.message ?? 'Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  // Show loading spinner while checking auth
  if (!initialized) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-600">Loading...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {session ? (
        // User is logged in → Show main app
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-2">
            <View>
              <Text className="text-blue-500 text-lg font-semibold">MathMuse</Text>
              {session?.user?.email && (
                <Text className="text-gray-500 text-xs">{session.user.email}</Text>
              )}
            </View>
            <Pressable
              onPress={handleSignOut}
              disabled={signingOut}
              className="px-3 py-1 rounded-md"
              style={{ backgroundColor: signingOut ? '#cbd5f5' : '#e2e8f0' }}
            >
              <Text style={{ color: '#1f2937', fontWeight: '600' }}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Text>
            </Pressable>
          </View>
          <HandwritingCanvas />
          <StatusBar style="auto" />
        </View>
      ) : (
        // User is NOT logged in → Show auth screen
        <AuthScreen onAuthSuccess={() => {
          // onAuthSuccess is called after successful login
          // The session will auto-update via onAuthStateChange listener
        }} />
      )}
    </GestureHandlerRootView>
  );
}
