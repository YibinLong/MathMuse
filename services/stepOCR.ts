import { supabase } from '../lib/supabase';

type InvokeArgs = {
  attemptId: string;
  stepId: string;
  imageBase64: string;
};

export type OCRResult = { latex: string; confidence: number };

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const INVOKE_TIMEOUT_MS = 55000;

function timeout<T = never>(ms: number, label = 'timeout'): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`OCR ${label}`)), ms));
}

function shouldRetry(error: any): boolean {
  const status: number | undefined = error?.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  // If status not available, conservatively do not retry
  return false;
}

/**
 * WHY: This function calls the Supabase Edge Function that performs OCR
 * 
 * HOW IT WORKS:
 * 1. Send the image (as base64) to the OCR Edge Function on Supabase
 * 2. The Edge Function uses OpenAI GPT-4o Vision to extract LaTeX
 * 3. Returns the LaTeX string and confidence score
 * 4. Has retry logic for transient failures (rate limits, server errors)
 * 5. Has a 55-second timeout to prevent hanging forever
 */
export async function invokeOcrLatex({ attemptId, stepId, imageBase64 }: InvokeArgs): Promise<OCRResult> {
  console.log('[OCR] Starting OCR request for stepId:', stepId);
  let lastErr: any;
  const backoff = [0, 1000, 2000]; // up to 3 tries
  for (let i = 0; i < backoff.length; i++) {
    if (i > 0) {
      console.log(`[OCR] Retry ${i} after ${backoff[i]}ms delay...`);
      await delay(backoff[i]);
    }
    
    console.log(`[OCR] Attempt ${i + 1}/${backoff.length} - Invoking ocr-latex function...`);
    const invokePromise = supabase.functions.invoke('ocr-latex', {
      body: { attemptId, stepId, imageBase64 },
    });
    
    const { data, error } = await Promise.race([
      invokePromise,
      timeout(INVOKE_TIMEOUT_MS, `request timed out after ${INVOKE_TIMEOUT_MS}ms`),
    ]) as { data: any; error: any };
    
    if (error) {
      console.error('[OCR] Error response:', error);
      console.error('[OCR] Error status:', error?.status);
      console.error('[OCR] Error message:', error?.message);
      lastErr = error;
      if (shouldRetry(error)) {
        console.log('[OCR] Error is retryable, will retry...');
        continue;
      }
      console.error('[OCR] Error is not retryable, throwing...');
      throw error;
    }
    
    // Expect { latex, confidence }
    if (!data || typeof data.latex !== 'string' || typeof data.confidence !== 'number') {
      console.error('[OCR] Invalid response format:', data);
      throw new Error('Invalid OCR response - expected { latex: string, confidence: number }');
    }
    
    console.log('[OCR] Success! LaTeX:', data.latex, 'Confidence:', data.confidence);
    return { latex: data.latex, confidence: data.confidence };
  }
  console.error('[OCR] All retries exhausted');
  throw lastErr ?? new Error('OCR failed after all retries');
}


