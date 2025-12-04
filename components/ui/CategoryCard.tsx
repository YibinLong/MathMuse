import React from 'react';
import { View, Text, Pressable, ViewStyle, Dimensions, Image, ImageSourcePropType } from 'react-native';

// Map category names to their images
const CATEGORY_IMAGES: Record<string, ImageSourcePropType> = {
  'Basic Equations': require('../../assets/Basic_Equations.png'),
  'Linear Equations': require('../../assets/Linear_Equations.png'),
  'Quadratic Equations': require('../../assets/Quadratic.png'),
  'Systems of Equations': require('../../assets/System_of_Equations.png'),
  'Inequalities': require('../../assets/Inequality.png'),
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Card width: fit 2 cards with padding (20px sides + 16px gap between)
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 16) / 2;
// Card height: fit 2 rows with gap
const CARD_HEIGHT = (SCREEN_HEIGHT - 280) / 2 - 8; // Account for header, title, and gap

const COLORS = {
  cardBg: '#FFFFFF',
  text: '#2D3047',
  textMuted: '#6B7280',
  border: '#E8E4DF',
  progressBg: '#E5E7EB',
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          marginBottom: 12,
          borderRadius: 20,
          backgroundColor: COLORS.cardBg,
          borderWidth: 1,
          borderColor: COLORS.border,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: pressed ? 0.12 : 0.06,
          shadowRadius: 8,
          elevation: pressed ? 4 : 2,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {/* Subtle color accent at top */}
      <View
        style={{
          height: 5,
          backgroundColor: color,
        }}
      />

      <View
        style={{
          flex: 1,
          padding: 16,
          justifyContent: 'space-between',
        }}
      >
        {/* Top Section - Name and Description */}
        <View>
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
          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 13,
              color: COLORS.textMuted,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>

        {/* Category Image */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {CATEGORY_IMAGES[name] && (
            <Image
              source={CATEGORY_IMAGES[name]}
              style={{
                width: CARD_WIDTH * 0.6,
                height: CARD_WIDTH * 0.6,
              }}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Bottom Section - Progress */}
        <View>
          {/* Progress bar background */}
          <View
            style={{
              height: 6,
              backgroundColor: COLORS.progressBg,
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            {/* Progress bar fill */}
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
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            {completedCount} of {totalCount} complete
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default CategoryCard;
