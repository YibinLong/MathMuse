import React, { useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LearningPathScreenProps } from '../types/navigation';
import { useSessionStore } from '../stores/sessionStore';
import { useProgressStore } from '../stores/progressStore';
import { CategoryCard } from '../components/ui/CategoryCard';
import { Button } from '../components/ui/Button';

const COLORS = {
  background: '#FDF8F3',
  primary: '#5B4CDB',
  text: '#2D3047',
  textMuted: '#6B7280',
  white: '#FFFFFF',
};

// Group categories into pairs for 2-row layout
function groupIntoPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = [items[i]];
    if (i + 1 < items.length) {
      pair.push(items[i + 1]);
    }
    pairs.push(pair);
  }
  return pairs;
}

export default function LearningPathScreen({ navigation }: LearningPathScreenProps) {
  const session = useSessionStore((s) => s.session);
  const signOut = useSessionStore((s) => s.signOut);
  const { categories, categoriesLoading, categoriesError, fetchCategories } = useProgressStore();

  const userId = session?.user?.id;

  useEffect(() => {
    if (userId) {
      fetchCategories(userId);
    }
  }, [userId]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Sign out failed', error?.message ?? 'Please try again.');
    }
  };

  const handleCategoryPress = (category: (typeof categories)[0]) => {
    navigation.navigate('LevelSelection', {
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: COLORS.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 20 }}>μ</Text>
          </View>
          <View>
            <Text
              style={{
                fontFamily: 'PlayfairDisplay_700Bold',
                fontSize: 24,
                color: COLORS.text,
              }}
            >
              MathMuse
            </Text>
            {session?.user?.email && (
              <Text
                style={{
                  fontFamily: 'Nunito_400Regular',
                  fontSize: 13,
                  color: COLORS.textMuted,
                }}
              >
                {session.user.email}
              </Text>
            )}
          </View>
        </View>
        <Button
          title="Sign out"
          variant="outline"
          size="sm"
          onPress={handleSignOut}
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* Page Title */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
        <Text
          style={{
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 32,
            color: COLORS.text,
          }}
        >
          Learning Path
        </Text>
        <Text
          style={{
            fontFamily: 'Nunito_400Regular',
            fontSize: 16,
            color: COLORS.textMuted,
            marginTop: 4,
          }}
        >
          Choose a topic to practice
        </Text>
      </View>

      {/* Categories List */}
      {categoriesLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 14,
              color: COLORS.textMuted,
              marginTop: 12,
            }}
          >
            Loading categories...
          </Text>
        </View>
      ) : categoriesError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text
            style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 16,
              color: '#EF4444',
              textAlign: 'center',
            }}
          >
            {categoriesError}
          </Text>
          <Pressable
            onPress={() => userId && fetchCategories(userId)}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: COLORS.primary,
              borderRadius: 20,
            }}
          >
            <Text
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 14,
                color: COLORS.white,
              }}
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : categories.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 16,
              color: COLORS.textMuted,
              textAlign: 'center',
            }}
          >
            No categories available yet.{'\n'}Check back soon!
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupIntoPairs(categories)}
          keyExtractor={(_, index) => `pair-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 20,
          }}
          renderItem={({ item: pair }) => (
            <View style={{ marginRight: 16 }}>
              {pair.map((category) => (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  description={category.description}
                  completedCount={category.completedCount}
                  totalCount={category.totalCount}
                  color={category.color}
                  onPress={() => handleCategoryPress(category)}
                />
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
