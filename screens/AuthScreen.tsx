import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display';

// Warm, kid-friendly color palette
const COLORS = {
  background: '#FDF8F3',      // Warm cream
  primary: '#5B4CDB',         // Friendly purple
  primaryDark: '#4338CA',     // Darker purple for pressed states
  text: '#2D3047',            // Dark navy for readability
  textMuted: '#6B7280',       // Muted gray
  inputBg: '#FFFFFF',
  inputBorder: '#E8E4DF',
  cardBg: '#FFFFFF',
  accent: '#F59E0B',          // Warm amber accent
};

export default function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    PlayfairDisplay_700Bold_Italic,
  });

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Oops!', 'Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Welcome!', 'Account created! Please check your email, then sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (error: any) {
      Alert.alert('Oops!', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // Show simple loading state while fonts load
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textMuted }}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: COLORS.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo & Title */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Text style={{
            fontFamily: 'PlayfairDisplay_700Bold_Italic',
            fontSize: 48,
            color: COLORS.primary,
            letterSpacing: -1,
          }}>
            MathMuse
          </Text>
          <Text style={{
            fontFamily: 'Nunito_400Regular',
            fontSize: 18,
            color: COLORS.textMuted,
            marginTop: 8,
          }}>
            Where handwriting meets math
          </Text>
        </View>

        {/* Auth Form */}
        <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }}>
          {/* Email Input */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 14,
              color: COLORS.text,
              marginBottom: 8,
              marginLeft: 4,
            }}>
              Email
            </Text>
            <TextInput
              placeholder="your@email.com"
              placeholderTextColor="#A0A0A0"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              style={{
                fontFamily: 'Nunito_400Regular',
                fontSize: 16,
                backgroundColor: COLORS.inputBg,
                borderWidth: 2,
                borderColor: COLORS.inputBorder,
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 16,
                color: COLORS.text,
              }}
            />
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 14,
              color: COLORS.text,
              marginBottom: 8,
              marginLeft: 4,
            }}>
              Password
            </Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#A0A0A0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              style={{
                fontFamily: 'Nunito_400Regular',
                fontSize: 16,
                backgroundColor: COLORS.inputBg,
                borderWidth: 2,
                borderColor: COLORS.inputBorder,
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 16,
                color: COLORS.text,
              }}
            />
          </View>

          {/* Sign In / Sign Up Button */}
          <Pressable
            onPress={handleAuth}
            disabled={loading}
            style={({ pressed }) => ({
              backgroundColor: pressed ? COLORS.primaryDark : COLORS.primary,
              borderRadius: 50,
              paddingVertical: 18,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.7 : 1,
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            })}
          >
            <Text style={{
              fontFamily: 'Nunito_700Bold',
              fontSize: 18,
              color: '#FFFFFF',
            }}>
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
          </Pressable>

          {/* Toggle Sign Up / Sign In */}
          <Pressable
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
            style={{ marginTop: 24, paddingVertical: 8 }}
          >
            <Text style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 15,
              color: COLORS.primary,
              textAlign: 'center',
            }}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </Pressable>
        </View>

        {/* Fun footer for kids */}
        <View style={{ marginTop: 48, alignItems: 'center' }}>
          <Text style={{
            fontFamily: 'Nunito_400Regular',
            fontSize: 14,
            color: COLORS.textMuted,
            textAlign: 'center',
          }}>
            Write math, solve problems, have fun!
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
