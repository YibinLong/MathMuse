import { create } from 'zustand';
import type { CategoryWithProgress, LevelInfo, LevelStatus } from '../types/navigation';
import * as progressService from '../services/progressService';

type ProgressState = {
  // Categories with aggregated progress
  categories: CategoryWithProgress[];
  categoriesLoading: boolean;
  categoriesError: string | null;

  // Per-level progress for selected category
  levels: LevelInfo[];
  levelsLoading: boolean;
  levelsError: string | null;

  // Actions
  fetchCategories: (userId: string) => Promise<void>;
  fetchLevels: (userId: string, categoryId: string) => Promise<void>;
  completeLevel: (
    userId: string,
    categoryId: string,
    levelNumber: number,
    problemId: string
  ) => Promise<void>;
  clearLevels: () => void;
};

export const useProgressStore = create<ProgressState>((set, get) => ({
  categories: [],
  categoriesLoading: false,
  categoriesError: null,

  levels: [],
  levelsLoading: false,
  levelsError: null,

  fetchCategories: async (userId: string) => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      const categories = await progressService.fetchCategoriesWithProgress(userId);
      set({ categories, categoriesLoading: false });
    } catch (error: any) {
      set({
        categoriesError: error?.message || 'Failed to fetch categories',
        categoriesLoading: false,
      });
    }
  },

  fetchLevels: async (userId: string, categoryId: string) => {
    set({ levelsLoading: true, levelsError: null });
    try {
      const levels = await progressService.fetchLevelsWithProgress(userId, categoryId);
      set({ levels, levelsLoading: false });
    } catch (error: any) {
      set({
        levelsError: error?.message || 'Failed to fetch levels',
        levelsLoading: false,
      });
    }
  },

  completeLevel: async (
    userId: string,
    categoryId: string,
    levelNumber: number,
    problemId: string
  ) => {
    try {
      await progressService.markLevelComplete(userId, categoryId, levelNumber, problemId);

      // Update local state optimistically
      const { levels, categories } = get();

      // Update levels: mark current as completed, next as unlocked
      const updatedLevels = levels.map((level) => {
        if (level.levelNumber === levelNumber) {
          return { ...level, status: 'completed' as LevelStatus };
        }
        if (level.levelNumber === levelNumber + 1 && level.status === 'locked') {
          return { ...level, status: 'unlocked' as LevelStatus };
        }
        return level;
      });

      // Update category progress count
      const updatedCategories = categories.map((cat) => {
        if (cat.id === categoryId) {
          return { ...cat, completedCount: cat.completedCount + 1 };
        }
        return cat;
      });

      set({ levels: updatedLevels, categories: updatedCategories });
    } catch (error: any) {
      console.error('Failed to complete level:', error);
      throw error;
    }
  },

  clearLevels: () => {
    set({ levels: [], levelsError: null });
  },
}));
