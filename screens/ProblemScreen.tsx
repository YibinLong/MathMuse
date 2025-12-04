import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProblemScreenProps } from '../types/navigation';
import HandwritingCanvas from '../components/HandwritingCanvas';
import { useSessionStore } from '../stores/sessionStore';
import { useProgressStore } from '../stores/progressStore';

const COLORS = {
  background: '#FDF8F3',
  primary: '#5B4CDB',
  text: '#2D3047',
  textMuted: '#6B7280',
  white: '#FFFFFF',
  cardBg: '#FFFFFF',
};

export default function ProblemScreen({ navigation, route }: ProblemScreenProps) {
  const { categoryId, levelNumber, problemId, problemTitle, problemBody } = route.params;
  const session = useSessionStore((s) => s.session);
  const completeLevel = useProgressStore((s) => s.completeLevel);

  const userId = session?.user?.id;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleComplete = async () => {
    if (!userId) return;
    try {
      await completeLevel(userId, categoryId, levelNumber, problemId);
      // Navigate back to level selection
      navigation.goBack();
    } catch (error) {
      console.error('Failed to complete level:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          backgroundColor: COLORS.white,
        }}
      >
        {/* Back Button */}
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: pressed ? '#E5E7EB' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          })}
        >
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>

        {/* Problem Title */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Nunito_700Bold',
              fontSize: 16,
              color: COLORS.text,
            }}
          >
            Problem {levelNumber}
          </Text>
          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 13,
              color: COLORS.textMuted,
            }}
          >
            {problemTitle}
          </Text>
        </View>

        {/* Complete Button (temporary - for testing) */}
        <Pressable
          onPress={handleComplete}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: pressed ? '#059669' : '#10B981',
          })}
        >
          <Text
            style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 14,
              color: COLORS.white,
            }}
          >
            Complete
          </Text>
        </Pressable>
      </View>

      {/* Problem Statement */}
      <View
        style={{
          backgroundColor: COLORS.cardBg,
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 8,
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <Text
          style={{
            fontFamily: 'Nunito_600SemiBold',
            fontSize: 13,
            color: COLORS.primary,
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Solve
        </Text>
        <Text
          style={{
            fontFamily: 'Nunito_700Bold',
            fontSize: 24,
            color: COLORS.text,
            lineHeight: 32,
          }}
        >
          {problemBody}
        </Text>
      </View>

      {/* Handwriting Canvas */}
      <View style={{ flex: 1 }}>
        <HandwritingCanvas />
      </View>
    </SafeAreaView>
  );
}
