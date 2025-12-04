import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Define the param types for each route
export type RootStackParamList = {
  LearningPath: undefined;
  LevelSelection: {
    categoryId: string;
    categoryName: string;
    categoryColor: string;
  };
  Problem: {
    categoryId: string;
    levelNumber: number;
    problemId: string;
    problemTitle: string;
    problemBody: string;
  };
};

// Screen prop types for each screen
export type LearningPathScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningPath'>;
export type LevelSelectionScreenProps = NativeStackScreenProps<RootStackParamList, 'LevelSelection'>;
export type ProblemScreenProps = NativeStackScreenProps<RootStackParamList, 'Problem'>;

// Category type
export type Category = {
  id: string;
  name: string;
  description: string;
  color: string;
  display_order: number;
};

// Category with progress info
export type CategoryWithProgress = Category & {
  completedCount: number;
  totalCount: number;
};

// Level progress status
export type LevelStatus = 'locked' | 'unlocked' | 'completed';

// Level info for level selection screen
export type LevelInfo = {
  levelNumber: number;
  problemId: string;
  problemTitle: string;
  problemBody: string;
  status: LevelStatus;
};
