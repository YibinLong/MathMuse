import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

// Import screens
import LearningPathScreen from '../screens/LearningPathScreen';
import LevelSelectionScreen from '../screens/LevelSelectionScreen';
import ProblemScreen from '../screens/ProblemScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="LearningPath"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FDF8F3' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="LearningPath" component={LearningPathScreen} />
      <Stack.Screen name="LevelSelection" component={LevelSelectionScreen} />
      <Stack.Screen name="Problem" component={ProblemScreen} />
    </Stack.Navigator>
  );
}
