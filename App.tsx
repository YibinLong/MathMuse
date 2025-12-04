import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import AuthScreen from './screens/AuthScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './lib/supabase';
import { useEffect } from 'react';
import { useSessionStore } from './stores/sessionStore';
import RootNavigator from './navigation/RootNavigator';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';

/**
 * Main App Component
 *
 * FLOW:
 * 1. App starts → Load fonts → Check if user is logged in
 * 2. If logged in → Show Learning Path (via RootNavigator)
 * 3. If NOT logged in → Show AuthScreen
 * 4. Listen for auth changes (login/logout) and update UI accordingly
 */
export default function App() {
  const session = useSessionStore((s) => s.session);
  const initialized = useSessionStore((s) => s.initialized);
  const setSession = useSessionStore((s) => s.setSession);
  const initializeFn = useSessionStore((s) => s.initialize);

  // Load fonts at the app level so all screens can use them
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    // Run once on mount
    initializeFn().catch((err) => {
      console.warn('Failed to initialize session:', err);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // intentionally empty

  // Show loading spinner while fonts load or checking auth
  if (!fontsLoaded || !initialized) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FDF8F3',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#5B4CDB" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        {session ? (
          // User is logged in → Show main app navigation
          <>
            <RootNavigator />
            <StatusBar style="auto" />
          </>
        ) : (
          // User is NOT logged in → Show auth screen
          <AuthScreen
            onAuthSuccess={() => {
              // onAuthSuccess is called after successful login
              // The session will auto-update via onAuthStateChange listener
            }}
          />
        )}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
