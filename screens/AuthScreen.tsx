import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Simple authentication screen for email/password login
 * 
 * WHY: Users need to be authenticated to save their work to Supabase
 * This screen handles:
 * 1. Login with email/password
 * 2. Sign up for new users
 * 3. Basic error handling
 */
export default function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  /**
   * Handle login or sign up
   * 
   * WHY: We use Supabase's auth.signInWithPassword() for login
   * and auth.signUp() for new account creation.
   * 
   * After successful auth, we call onAuthSuccess() which will
   * show the main app (HandwritingCanvas).
   */
  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Create new account
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        Alert.alert('Success', 'Account created! Please log in.');
        setIsSignUp(false);
      } else {
        // Login to existing account
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white justify-center px-8">
      {/* App Title */}
      <Text className="text-3xl font-bold text-center mb-8 text-blue-600">
        MathMuse
      </Text>
      <Text className="text-center mb-6 text-gray-600">
        {isSignUp ? 'Create an account' : 'Sign in to continue'}
      </Text>

      {/* Email Input */}
      <View className="mb-4">
        <Text className="mb-2 text-gray-700">Email</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3"
          placeholder="your@email.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
      </View>

      {/* Password Input */}
      <View className="mb-6">
        <Text className="mb-2 text-gray-700">Password</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
      </View>

      {/* Submit Button */}
      <Pressable
        className={`rounded-lg py-4 mb-4 ${loading ? 'bg-gray-400' : 'bg-blue-600'}`}
        onPress={handleAuth}
        disabled={loading}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </Text>
      </Pressable>

      {/* Toggle between Sign In / Sign Up */}
      <Pressable onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
        <Text className="text-center text-blue-600">
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </Text>
      </Pressable>

      {/* Dev Helper Text */}
      <View className="mt-8 p-4 bg-yellow-50 rounded-lg">
        <Text className="text-sm text-gray-600 text-center">
          💡 For testing: Use any email and password (min 6 chars)
        </Text>
      </View>
    </View>
  );
}

