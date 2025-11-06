import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Canvas, Circle } from '@shopify/react-native-skia';

export default function App() {
  useEffect(() => {
    if (
      process.env.EXPO_PUBLIC_SUPABASE_URL &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ) {
      (async () => {
        const res = await supabase.from('problems').select('*').limit(1);
        if (res.error) {
          console.warn('Supabase probe error:', res.error);
        } else {
          console.log('Supabase probe:', res);
        }
      })();
    }
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-blue-500 text-lg font-semibold">MathMuse</Text>
      <Canvas style={{ width: 220, height: 220 }}>
        <Circle cx={110} cy={110} r={64} color="red" />
      </Canvas>
      <StatusBar style="auto" />
    </View>
  );
}
