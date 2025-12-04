import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

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
    <View className="flex-1" style={{ backgroundColor: '#f8fafc', paddingHorizontal: 20, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 16, paddingTop: 40 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 22 }}>μ</Text>
        </View>
        <Text style={{ marginTop: 10, fontSize: 24, fontWeight: '800', color: '#111827' }}>MathMuse</Text>
        <Text style={{ marginTop: 6, color: '#6b7280' }}>{isSignUp ? 'Create an account' : 'Sign in to continue'}</Text>
      </View>

      <Card style={{ borderRadius: 18, padding: 16 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ marginBottom: 6, color: '#334155', fontWeight: '600' }}>Email</Text>
          <TextInput
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'white' }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ marginBottom: 6, color: '#334155', fontWeight: '600' }}>Password</Text>
          <TextInput
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'white' }}
          />
        </View>

        <Button
          title={loading ? 'Loading…' : isSignUp ? 'Sign Up' : 'Sign In'}
          onPress={handleAuth}
          disabled={loading}
          size="lg"
          style={{ borderRadius: 12 }}
        />

        <Pressable onPress={() => setIsSignUp(!isSignUp)} disabled={loading} style={{ marginTop: 12 }}>
          <Text style={{ textAlign: 'center', color: '#4f46e5', fontWeight: '600' }}>
            {isSignUp ? 'Already have an account? Sign In' : "Don’t have an account? Sign Up"}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}

