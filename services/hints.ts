/**
 * WHY: Centralize the logic for escalating guidance hints so the component stays readable.
 *
 * HOW IT WORKS:
 * 1. We track how many non-progress steps (incorrect or correct-but-not-useful) happened in a row.
 * 2. That count maps to a hint level: 1 = gentle nudge, 2 = directional hint, 3+ = micro-step guidance.
 * 3. Each level has friendly copy tailored to the validation status so students know what to fix.
 */
import type { ValidationStatus } from './stepValidate';

export type HintComputationInput = {
  status: ValidationStatus;
  consecutiveNonProgress: number;
};

export type HintResult =
  | { level: number; text: string; status: ValidationStatus }
  | null;

const HINT_COPY: Record<ValidationStatus, [string, string, string]> = {
  correct_useful: [
    '',
    '',
    '',
  ],
  correct_not_useful: [
    'This step is right, but it doesn’t move you forward yet. Try applying the result to the next part of the equation.',
    'Look at what the solver expects next: can you isolate a variable, combine like terms, or simplify a fraction?',
    'Write out the exact transformation you need. For example, if the goal is to isolate x, divide both sides by the coefficient in front of x.',
  ],
  incorrect: [
    'Something changed incorrectly. Re-check the algebra for this line and compare it to the previous one.',
    'Focus on the operation you just attempted. Did you apply it to both sides? Try rewriting the previous line and carefully redo the move.',
    'Walk through the fix step-by-step: copy the previous line, highlight the term you want to move, and perform the inverse operation on both sides.',
  ],
  uncertain: [
    'Hard to judge this step. Rewrite it clearly or add more detail so the system can follow your work.',
    'Clarify the transformation. Spell out the operation (e.g., “subtract 2 from both sides”) to make the logic explicit.',
    'Detail the move explicitly: rewrite the previous line and show the exact algebraic manipulation you intend.',
  ],
};

export function computeHint({
  status,
  consecutiveNonProgress,
}: HintComputationInput): HintResult {
  if (status === 'correct_useful') {
    return null;
  }

  const cappedLevel = Math.min(consecutiveNonProgress, 3);
  const copySlices = HINT_COPY[status] ?? HINT_COPY.uncertain;
  const textIndex = cappedLevel - 1;
  const text =
    cappedLevel > 0 && copySlices[textIndex] ? copySlices[textIndex] : '';

  if (!text) {
    return null;
  }

  return {
    level: cappedLevel,
    text,
    status,
  };
}


