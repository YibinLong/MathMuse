import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProblemScreenProps } from '../types/navigation';
import HandwritingCanvas from '../components/HandwritingCanvas';
import { useSessionStore } from '../stores/sessionStore';
import { useProgressStore } from '../stores/progressStore';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  background: '#FDF8F3',
  primary: '#0EA5E9',
  text: '#1F2937',
  textMuted: '#6B7280',
  white: '#FFFFFF',
};

export default function ProblemScreen({ navigation, route }: ProblemScreenProps) {
  const { categoryId, levelNumber, problemId, problemTitle, problemBody } = route.params;
  const session = useSessionStore((s) => s.session);
  const completeLevel = useProgressStore((s) => s.completeLevel);
  const [isCompleted, setIsCompleted] = useState(false);

  const userId = session?.user?.id;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleComplete = async () => {
    if (!userId || isCompleted) return;
    try {
      await completeLevel(userId, categoryId, levelNumber, problemId);
      setIsCompleted(true);
      // User stays on screen - can leave when ready via success overlay
    } catch (error) {
      console.error('Failed to complete level:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      {/* Header - Minimal */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        {/* Back Button */}
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? '#F3F4F6' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>

        {/* Problem Title - Centered */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 14,
              color: COLORS.textMuted,
              textAlign: 'center',
            }}
          >
            {problemTitle}
          </Text>
        </View>

        {/* Spacer for symmetry */}
        <View style={{ width: 40 }} />
      </View>

      {/* Handwriting Canvas */}
      <View style={{ flex: 1 }}>
        <HandwritingCanvas
          problemBody={problemBody}
          onSolved={handleComplete}
        />
      </View>

      {/* Success Overlay - Shows when problem is solved */}
      {isCompleted && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingVertical: 20,
            paddingBottom: 40,
            backgroundColor: '#DCFCE7',
            borderTopWidth: 1,
            borderTopColor: '#86EFAC',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#166534' }}>
                Problem Solved!
              </Text>
              <Text style={{ fontSize: 13, color: '#15803D' }}>
                Great work! Ready for the next challenge?
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleBack}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: '#16A34A',
              borderRadius: 24,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
              Continue
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
