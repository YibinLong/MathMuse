import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';

const COLORS = {
  cardBg: '#FFFFFF',
  text: '#2D3047',
  textMuted: '#6B7280',
  border: '#E8E4DF',
};

export type CategoryCardProps = {
  name: string;
  description: string;
  completedCount: number;
  totalCount: number;
  color: string;
  onPress: () => void;
  style?: ViewStyle;
};

export function CategoryCard({
  name,
  description,
  completedCount,
  totalCount,
  color,
  onPress,
  style,
}: CategoryCardProps) {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const remainingCount = totalCount - completedCount;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: COLORS.cardBg,
          borderRadius: 28,
          padding: 20,
          width: 220,
          height: 240,
          marginRight: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: pressed ? 0.15 : 0.08,
          shadowRadius: 8,
          elevation: pressed ? 4 : 3,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {/* Category Name */}
      <Text
        style={{
          fontFamily: 'PlayfairDisplay_700Bold',
          fontSize: 22,
          color: COLORS.text,
          marginBottom: 8,
        }}
        numberOfLines={2}
      >
        {name}
      </Text>

      {/* Description */}
      <Text
        style={{
          fontFamily: 'Nunito_400Regular',
          fontSize: 14,
          color: COLORS.textMuted,
          lineHeight: 20,
          marginBottom: 16,
        }}
        numberOfLines={2}
      >
        {description}
      </Text>

      {/* Progress Section */}
      <View style={{ marginTop: 'auto' }}>
        {/* Progress Pills */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          {/* Completed pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: color + '20',
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 14,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: color,
                marginRight: 6,
              }}
            />
            <Text
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 13,
                color: COLORS.text,
              }}
            >
              {completedCount} sets
            </Text>
          </View>

          {/* Remaining pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FEF3C7',
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 13,
                color: '#B45309',
              }}
            >
              {remainingCount} left
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 6,
            backgroundColor: '#E5E7EB',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              backgroundColor: color,
              borderRadius: 3,
            }}
          />
        </View>

        {/* Progress text */}
        <Text
          style={{
            fontFamily: 'Nunito_400Regular',
            fontSize: 12,
            color: COLORS.textMuted,
            marginTop: 8,
          }}
        >
          {completedCount} of {totalCount} complete
        </Text>
      </View>
    </Pressable>
  );
}

export default CategoryCard;
