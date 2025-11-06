import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import HandwritingCanvas from './components/HandwritingCanvas';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-white">
        <View className="items-center py-2">
          <Text className="text-blue-500 text-lg font-semibold">MathMuse</Text>
        </View>
        <HandwritingCanvas />
        <StatusBar style="auto" />
      </View>
    </GestureHandlerRootView>
  );
}
