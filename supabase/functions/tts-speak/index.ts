import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js";

type SpeakSuccess = { audioUrl: string; storagePath: string };
type SpeakError = { error: string; message?: string };

const DEFAULT_VOICE = "alloy";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handle(req: Request): Promise<Response> {
  try {
    const { text, voice, attemptId, stepId, dryRun, storagePath } = await req.json();
    if (dryRun === true) {
      const body: SpeakSuccess = {
        audioUrl: "https://example.com/mock-tts.mp3",
        storagePath: "mock/path/audio.mp3",
      };
      return jsonResponse(body, 200);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      const body: SpeakError = { error: "server_misconfigured", message: "OPENAI_API_KEY not set" };
      return jsonResponse(body, 500);
    }
    const bucket = Deno.env.get("APP_BASE_STORAGE_BUCKET") ?? "attempts";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      const body: SpeakError = { error: "server_misconfigured", message: "Supabase credentials not set" };
      return jsonResponse(body, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    if ((!text || typeof text !== "string") && typeof storagePath === "string" && storagePath.length > 0) {
      const { data: signed, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60);
      if (signedError || !signed?.signedUrl) {
        const body: SpeakError = { error: "signed_url_failure", message: signedError?.message ?? "No signed URL" };
        return jsonResponse(body, 500);
      }
      const body: SpeakSuccess = {
        audioUrl: signed.signedUrl,
        storagePath,
      };
      return jsonResponse(body, 200);
    }

    if (!text || typeof text !== "string") {
      const body: SpeakError = { error: "invalid_request", message: "Missing text" };
      return jsonResponse(body, 400);
    }
    if (text.length > 480) {
      const body: SpeakError = { error: "text_too_long", message: "Text must be 480 characters or fewer" };
      return jsonResponse(body, 400);
    }

    const client = new OpenAI({ apiKey });
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: typeof voice === "string" && voice.length > 0 ? voice : DEFAULT_VOICE,
      input: text,
      response_format: "mp3",
    });
    const audioArrayBuffer = await speech.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);

    const storagePathSegments = [
      "tts",
      attemptId ?? "unknown-attempt",
      stepId ?? `step-${Date.now()}`,
    ];
    const storagePath = `${storagePathSegments.join("/")}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (uploadError) {
      const body: SpeakError = { error: "upload_failed", message: uploadError.message };
      return jsonResponse(body, 500);
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60); // 1 hour
    if (signedError || !signed?.signedUrl) {
      const body: SpeakError = { error: "signed_url_failure", message: signedError?.message ?? "No signed URL" };
      return jsonResponse(body, 500);
    }

    const body: SpeakSuccess = {
      audioUrl: signed.signedUrl,
      storagePath,
    };
    return jsonResponse(body, 200);
  } catch (e: any) {
    const body: SpeakError = { error: "bad_json", message: typeof e?.message === "string" ? e.message : "Invalid JSON body" };
    return jsonResponse(body, 400);
  }
}

Deno.serve(handle);
