import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import type { LevelStatus } from '../../types/navigation';

const COLORS = {
  locked: '#D1D5DB',
  lockedText: '#9CA3AF',
  unlocked: '#5B4CDB',
  unlockedBg: '#FFFFFF',
  completed: '#10B981',
  completedBg: '#10B981',
  text: '#2D3047',
  white: '#FFFFFF',
};

export type LevelButtonProps = {
  levelNumber: number;
  status: LevelStatus;
  onPress: () => void;
  style?: ViewStyle;
};

export function LevelButton({ levelNumber, status, onPress, style }: LevelButtonProps) {
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';

  const getBackgroundColor = () => {
    if (isLocked) return COLORS.locked;
    if (isCompleted) return COLORS.completedBg;
    return COLORS.unlockedBg;
  };

  const getBorderColor = () => {
    if (isLocked) return COLORS.locked;
    if (isCompleted) return COLORS.completed;
    return COLORS.unlocked;
  };

  const getTextColor = () => {
    if (isLocked) return COLORS.lockedText;
    if (isCompleted) return COLORS.white;
    return COLORS.unlocked;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isLocked}
      style={({ pressed }) => [
        {
          width: 100,
          height: 100,
          borderRadius: 24,
          backgroundColor: getBackgroundColor(),
          borderWidth: isLocked ? 0 : 3,
          borderColor: getBorderColor(),
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isLocked ? 0 : 0.12,
          shadowRadius: 6,
          elevation: isLocked ? 0 : 3,
          opacity: pressed && !isLocked ? 0.8 : 1,
          transform: [{ scale: pressed && !isLocked ? 0.95 : 1 }],
        },
        style,
      ]}
    >
      {isLocked ? (
        // Lock icon
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 36, color: COLORS.lockedText }}>
            🔒
          </Text>
        </View>
      ) : isCompleted ? (
        // Checkmark for completed
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: 36,
              color: COLORS.white,
            }}
          >
            {levelNumber}
          </Text>
          <Text style={{ fontSize: 18, marginTop: -4 }}>✓</Text>
        </View>
      ) : (
        // Level number for unlocked
        <Text
          style={{
            fontFamily: 'Nunito_800ExtraBold',
            fontSize: 40,
            color: getTextColor(),
          }}
        >
          {levelNumber}
        </Text>
      )}
    </Pressable>
  );
}

export default LevelButton;
