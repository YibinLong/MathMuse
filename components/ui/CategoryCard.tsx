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
          borderRadius: 24,
          padding: 16,
          width: 180,
          height: 200,
          marginRight: 12,
          marginBottom: 12,
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
          fontSize: 18,
          color: COLORS.text,
          marginBottom: 6,
        }}
        numberOfLines={2}
      >
        {name}
      </Text>

      {/* Description */}
      <Text
        style={{
          fontFamily: 'Nunito_400Regular',
          fontSize: 12,
          color: COLORS.textMuted,
          lineHeight: 16,
          marginBottom: 12,
        }}
        numberOfLines={2}
      >
        {description}
      </Text>

      {/* Progress Section */}
      <View style={{ marginTop: 'auto' }}>
        {/* Progress Pills - stacked vertically for compact layout */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          {/* Completed pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: color + '20',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: color,
                marginRight: 5,
              }}
            />
            <Text
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 11,
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
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 11,
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
            height: 5,
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
            fontSize: 11,
            color: COLORS.textMuted,
            marginTop: 6,
          }}
        >
          {completedCount} of {totalCount} complete
        </Text>
      </View>
    </Pressable>
  );
}

export default CategoryCard;
