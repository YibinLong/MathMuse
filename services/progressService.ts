import { supabase } from '../lib/supabase';
import type { Category, CategoryWithProgress, LevelInfo, LevelStatus } from '../types/navigation';

/**
 * Fetch all categories with user's progress (completed count per category)
 */
export async function fetchCategoriesWithProgress(userId: string): Promise<CategoryWithProgress[]> {
  // Fetch all categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (catError) throw catError;
  if (!categories) return [];

  // Fetch user's progress (completed levels per category)
  const { data: progress, error: progError } = await supabase
    .from('user_progress')
    .select('category_id, status')
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (progError) throw progError;

  // Count completed per category
  const completedMap = new Map<string, number>();
  (progress || []).forEach((p) => {
    const count = completedMap.get(p.category_id) || 0;
    completedMap.set(p.category_id, count + 1);
  });

  // Combine categories with progress
  return categories.map((cat: Category) => ({
    ...cat,
    completedCount: completedMap.get(cat.id) || 0,
    totalCount: 10, // Each category has 10 levels
  }));
}

/**
 * Fetch all levels for a category with user's progress status
 */
export async function fetchLevelsWithProgress(
  userId: string,
  categoryId: string
): Promise<LevelInfo[]> {
  // Fetch problems linked to this category
  const { data: categoryProblems, error: cpError } = await supabase
    .from('category_problems')
    .select(`
      level_number,
      problem_id,
      problems (
        id,
        title,
        body
      )
    `)
    .eq('category_id', categoryId)
    .order('level_number', { ascending: true });

  if (cpError) throw cpError;
  if (!categoryProblems) return [];

  // Fetch user's progress for this category
  const { data: progress, error: progError } = await supabase
    .from('user_progress')
    .select('level_number, status')
    .eq('user_id', userId)
    .eq('category_id', categoryId);

  if (progError) throw progError;

  // Create a map of level -> status
  const progressMap = new Map<number, LevelStatus>();
  (progress || []).forEach((p) => {
    progressMap.set(p.level_number, p.status as LevelStatus);
  });

  // Build level info array
  const levels: LevelInfo[] = categoryProblems.map((cp: any) => {
    const problem = cp.problems;
    const levelNumber = cp.level_number;

    // Determine status
    let status: LevelStatus = progressMap.get(levelNumber) || 'locked';

    // Level 1 is always at least unlocked
    if (levelNumber === 1 && status === 'locked') {
      status = 'unlocked';
    }

    // If previous level is completed, this one should be unlocked (if not already completed)
    if (levelNumber > 1 && status === 'locked') {
      const prevStatus = progressMap.get(levelNumber - 1);
      if (prevStatus === 'completed') {
        status = 'unlocked';
      }
    }

    return {
      levelNumber,
      problemId: problem?.id || cp.problem_id,
      problemTitle: problem?.title || `Problem ${levelNumber}`,
      problemBody: problem?.body || '',
      status,
    };
  });

  return levels;
}

/**
 * Initialize user progress for a category (ensure level 1 is unlocked)
 */
export async function initializeCategoryProgress(
  userId: string,
  categoryId: string,
  problemId: string
): Promise<void> {
  // Check if user already has progress for level 1
  const { data: existing } = await supabase
    .from('user_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('level_number', 1)
    .single();

  if (existing) return; // Already initialized

  // Create progress entry for level 1 as unlocked
  const { error } = await supabase.from('user_progress').insert({
    user_id: userId,
    category_id: categoryId,
    problem_id: problemId,
    level_number: 1,
    status: 'unlocked',
  });

  if (error) throw error;
}

/**
 * Mark a level as complete and unlock the next level
 */
export async function markLevelComplete(
  userId: string,
  categoryId: string,
  levelNumber: number,
  problemId: string
): Promise<void> {
  // Update or insert current level as completed
  const { error: completeError } = await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      category_id: categoryId,
      problem_id: problemId,
      level_number: levelNumber,
      status: 'completed',
      completed_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,category_id,level_number',
    }
  );

  if (completeError) throw completeError;

  // If not the last level, unlock the next one
  if (levelNumber < 10) {
    // Get the problem ID for the next level
    const { data: nextLevel, error: nextError } = await supabase
      .from('category_problems')
      .select('problem_id')
      .eq('category_id', categoryId)
      .eq('level_number', levelNumber + 1)
      .single();

    if (nextError) {
      console.warn('Could not find next level:', nextError);
      return;
    }

    // Create unlocked entry for next level (if not exists)
    const { error: unlockError } = await supabase.from('user_progress').upsert(
      {
        user_id: userId,
        category_id: categoryId,
        problem_id: nextLevel.problem_id,
        level_number: levelNumber + 1,
        status: 'unlocked',
      },
      {
        onConflict: 'user_id,category_id,level_number',
        ignoreDuplicates: true,
      }
    );

    if (unlockError) {
      console.warn('Could not unlock next level:', unlockError);
    }
  }
}
