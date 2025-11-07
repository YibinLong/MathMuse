import { supabase } from '../lib/supabase';

export type ValidationStatus = 'correct_useful' | 'correct_not_useful' | 'incorrect' | 'uncertain';
export type ValidationResult = { status: ValidationStatus; reason: string; solverMetadata?: any };

type InvokeArgs = {
  prevLatex?: string;
  currLatex: string;
  problem: string;
};

const INVOKE_TIMEOUT_MS = 20000;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shouldRetry(error: any): boolean {
  const status: number | undefined = error?.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  return false;
}

function timeout<T = never>(ms: number, label = 'timeout'): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(label), { status: 408 })), ms));
}

/**
 * WHY: Calls Supabase Edge Function `solve-step` to validate a math step.
 * HOW: Sends prev/curr LaTeX and the problem text; retries on 429/5xx with backoff; 20s timeout.
 */
export async function invokeSolveStep({ prevLatex, currLatex, problem }: InvokeArgs): Promise<ValidationResult> {
  let lastErr: any;
  const backoff = [0, 800, 1600];
  for (let i = 0; i < backoff.length; i++) {
    if (i > 0) await delay(backoff[i]);
    const invokePromise = supabase.functions.invoke('solve-step', {
      body: { prevLatex, currLatex, problem },
    });
    const { data, error } = await Promise.race([
      invokePromise,
      timeout(INVOKE_TIMEOUT_MS, `Validation request timed out after ${INVOKE_TIMEOUT_MS}ms`),
    ]) as { data: any; error: any };

    if (error) {
      lastErr = error;
      if (shouldRetry(error)) continue;
      throw error;
    }

    // Expect { status, reason, solverMetadata? }
    if (!data || typeof data.status !== 'string' || typeof data.reason !== 'string') {
      throw new Error('Invalid validation response - expected { status: string, reason: string }');
    }
    return data as ValidationResult;
  }
  throw lastErr ?? new Error('Validation failed after retries');
}


