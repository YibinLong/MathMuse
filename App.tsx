import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import HandwritingCanvas from './components/HandwritingCanvas';
import AuthScreen from './screens/AuthScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from './lib/supabase';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current auth session on app start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Cleanup listener on unmount
    return () => subscription.unsubscribe();
  }, []);

  // Show loading spinner while checking auth
  if (loading) {
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
          <View className="items-center py-2">
            <Text className="text-blue-500 text-lg font-semibold">MathMuse</Text>
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
