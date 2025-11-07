import { supabase } from '../lib/supabase';
import type { Stroke } from '../stores/attemptStore';

type UploadArgs = {
  userId: string;
  attemptId: string;
  stepIndex: number;
  bytes: Uint8Array;
  vectorJson: Stroke[];
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadStepPng({ userId, attemptId, stepIndex, bytes, vectorJson }: UploadArgs) {
  const path = `${userId}/${attemptId}/${stepIndex}.png`;
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  let lastError: unknown;
  const tries = [0, 1000, 2000, 4000];
  for (let i = 0; i < tries.length; i++) {
    if (i > 0) await delay(tries[i]);
    const { error: upErr } = await supabase.storage
      .from('attempts')
      .upload(path, ab, { contentType: 'image/png', upsert: true });
    if (upErr) {
      lastError = upErr;
      continue;
    }

    const { data: ins, error: insErr } = await supabase.from('attempt_steps').insert({
      attempt_id: attemptId,
      step_index: stepIndex,
      png_storage_path: path,
      vector_json: vectorJson,
    }).select('id').single();
    if (insErr) {
      lastError = insErr;
      // Best-effort: attempt row insert failed but file uploaded; keep retrying insert
      continue;
    }

    return { path, stepId: ins?.id as string };
  }

  throw lastError ?? new Error('Upload failed');
}


