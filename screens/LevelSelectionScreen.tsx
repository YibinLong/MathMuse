import React, { useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LevelSelectionScreenProps } from '../types/navigation';
import { useSessionStore } from '../stores/sessionStore';
import { useProgressStore } from '../stores/progressStore';
import { LevelButton } from '../components/ui/LevelButton';

const COLORS = {
  background: '#FDF8F3',
  primary: '#5B4CDB',
  text: '#2D3047',
  textMuted: '#6B7280',
  white: '#FFFFFF',
};

export default function LevelSelectionScreen({ navigation, route }: LevelSelectionScreenProps) {
  const { categoryId, categoryName, categoryColor } = route.params;
  const session = useSessionStore((s) => s.session);
  const { levels, levelsLoading, levelsError, fetchLevels, clearLevels } = useProgressStore();

  const userId = session?.user?.id;

  useEffect(() => {
    if (userId) {
      fetchLevels(userId, categoryId);
    }
    return () => {
      clearLevels();
    };
  }, [userId, categoryId]);

  const handleLevelPress = (level: (typeof levels)[0]) => {
    if (level.status === 'locked') return;

    navigation.navigate('Problem', {
      categoryId,
      levelNumber: level.levelNumber,
      problemId: level.problemId,
      problemTitle: level.problemTitle,
      problemBody: level.problemBody,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // Render levels in a 2-column grid
  const renderLevelGrid = () => {
    if (levelsLoading) {
      return (
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
            Loading levels...
          </Text>
        </View>
      );
    }

    if (levelsError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text
            style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 16,
              color: '#EF4444',
              textAlign: 'center',
            }}
          >
            {levelsError}
          </Text>
          <Pressable
            onPress={() => userId && fetchLevels(userId, categoryId)}
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
      );
    }

    return (
      <FlatList
        data={levels}
        keyExtractor={(item) => String(item.levelNumber)}
        numColumns={2}
        contentContainerStyle={{
          paddingHorizontal: 40,
          paddingTop: 32,
          paddingBottom: 60,
        }}
        columnWrapperStyle={{
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
        renderItem={({ item }) => (
          <LevelButton
            levelNumber={item.levelNumber}
            status={item.status}
            onPress={() => handleLevelPress(item)}
            style={{ marginHorizontal: 20 }}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'Nunito_400Regular',
                fontSize: 16,
                color: COLORS.textMuted,
                textAlign: 'center',
              }}
            >
              No problems available yet.
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        {/* Back Button */}
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: pressed ? '#E5E7EB' : COLORS.white,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
          })}
        >
          <Text style={{ fontSize: 20 }}>←</Text>
        </Pressable>

        {/* Category Title */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'PlayfairDisplay_700Bold',
              fontSize: 24,
              color: COLORS.text,
            }}
          >
            {categoryName}
          </Text>
          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 14,
              color: COLORS.textMuted,
              marginTop: 2,
            }}
          >
            Select a problem to solve
          </Text>
        </View>

        {/* Category Color Indicator */}
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: categoryColor,
          }}
        />
      </View>

      {/* Difficulty Legend */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <Text
          style={{
            fontFamily: 'Nunito_400Regular',
            fontSize: 13,
            color: COLORS.textMuted,
          }}
        >
          Easy
        </Text>
        <View
          style={{
            flex: 1,
            height: 2,
            marginHorizontal: 12,
            borderRadius: 1,
            backgroundColor: '#E5E7EB',
          }}
        >
          <View
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 1,
              backgroundColor: categoryColor,
            }}
          />
        </View>
        <Text
          style={{
            fontFamily: 'Nunito_400Regular',
            fontSize: 13,
            color: COLORS.textMuted,
          }}
        >
          Hard
        </Text>
      </View>

      {/* Level Grid */}
      {renderLevelGrid()}
    </SafeAreaView>
  );
}
