import { supabase } from '../lib/supabase';

type TtsArgs = {
  attemptId: string;
  stepId: string;
  text: string;
  voice?: string;
};

export type TtsResponse = { audioUrl: string; storagePath: string };

/**
 * WHY: Wrap Supabase Edge Function invocation so components can request hint audio easily.
 * HOW: Calls `tts-speak`, validates output shape, and returns the signed URL plus storage path.
 */
export async function requestHintSpeech({ attemptId, stepId, text, voice }: TtsArgs): Promise<TtsResponse> {
  const { data, error } = await supabase.functions.invoke('tts-speak', {
    body: { attemptId, stepId, text, voice },
  });
  if (error) {
    const status = (error as any)?.status;
    const message = (error as any)?.message ?? '';
    if (status === 500 && typeof message === 'string' && message.includes('OPENAI_API_KEY')) {
      throw new Error('Hint audio unavailable: set OPENAI_API_KEY in Supabase secrets and redeploy tts-speak.');
    }
    throw new Error(typeof message === 'string' && message.length > 0 ? message : 'TTS request failed');
  }
  if (!data || typeof data.audioUrl !== 'string' || typeof data.storagePath !== 'string') {
    throw new Error('Invalid TTS response');
  }
  return { audioUrl: data.audioUrl, storagePath: data.storagePath };
}

/**
 * WHY: When resuming an attempt we already have audio in storage; this fetches a fresh signed URL.
 */
export async function fetchHintSpeechUrl(storagePath: string): Promise<TtsResponse> {
  const { data, error } = await supabase.functions.invoke('tts-speak', {
    body: { storagePath },
  });
  if (error) {
    const status = (error as any)?.status;
    const message = (error as any)?.message ?? '';
    if (status === 500 && typeof message === 'string' && message.includes('OPENAI_API_KEY')) {
      throw new Error('Hint audio unavailable: set OPENAI_API_KEY in Supabase secrets and redeploy tts-speak.');
    }
    throw new Error(typeof message === 'string' && message.length > 0 ? message : 'TTS request failed');
  }
  if (!data || typeof data.audioUrl !== 'string' || typeof data.storagePath !== 'string') {
    throw new Error('Invalid TTS response');
  }
  return { audioUrl: data.audioUrl, storagePath: data.storagePath };
}


