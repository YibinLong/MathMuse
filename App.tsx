import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Pressable, Alert } from 'react-native';
import HandwritingCanvas from './components/HandwritingCanvas';
import AuthScreen from './screens/AuthScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from './lib/supabase';
import { useEffect, useState } from 'react';
import { useSessionStore } from './stores/sessionStore';
import { Button } from './components/ui/Button';

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
        <View style={{ flex: 1, backgroundColor: 'white', paddingTop: 40 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: '#e5e7eb',
              backgroundColor: 'white',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#4f46e5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 18 }}>μ</Text>
              </View>
              <View>
                <Text style={{ color: '#111827', fontSize: 18, fontWeight: '800' }}>MathMuse</Text>
                {session?.user?.email && (
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>{session.user.email}</Text>
                )}
              </View>
            </View>
            <Button
              title={signingOut ? 'Signing out…' : 'Sign out'}
              variant="outline"
              size="md"
              disabled={signingOut}
              onPress={handleSignOut}
              style={{ borderRadius: 12 }}
            />
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
