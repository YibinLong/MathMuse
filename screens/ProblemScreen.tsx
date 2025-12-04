import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProblemScreenProps } from '../types/navigation';
import HandwritingCanvas from '../components/HandwritingCanvas';
import { useSessionStore } from '../stores/sessionStore';
import { useProgressStore } from '../stores/progressStore';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  background: '#FFFFFF',
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
    if (!userId) return;
    try {
      await completeLevel(userId, categoryId, levelNumber, problemId);
      setIsCompleted(true);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to complete level:', error);
    }
  };

  // Parse problem body for multi-line equations (for display in header)
  const equationLines = problemBody.split('\n').filter(line => line.trim());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      {/* Header - Clean Chiron-style */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
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

        {/* Equation Display - Centered */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          {equationLines.map((line, index) => (
            <Text
              key={index}
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 16,
                color: COLORS.text,
                textAlign: 'center',
              }}
            >
              {line}
            </Text>
          ))}
        </View>

        {/* Settings Gear */}
        <Pressable
          onPress={() => {/* TODO: Settings modal */}}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? '#F3F4F6' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons name="settings-outline" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      {/* Question Prompt */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text
          style={{
            fontFamily: 'Nunito_400Regular',
            fontSize: 15,
            color: COLORS.textMuted,
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          {problemTitle}
        </Text>
      </View>

      {/* Handwriting Canvas */}
      <View style={{ flex: 1 }}>
        <HandwritingCanvas
          problemBody={problemBody}
          onSolved={() => setIsCompleted(true)}
        />
      </View>
    </SafeAreaView>
  );
}
