import OpenAI from "npm:openai";

type OCRSuccess = { latex: string; confidence: number };
type OCRError = { error: string; message?: string };

function approxBytesFromBase64(b64: string): number {
  // Rough conversion: 3/4 of base64 chars minus padding
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

async function transcribeExactJSON(opts: { client: OpenAI; model: string; imgUrl: string }): Promise<OCRSuccess | null> {
  const { client, model, imgUrl } = opts;
  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a handwriting OCR transcriber for math. TRANSCRIBE EXACTLY what is written into LaTeX. Do NOT solve, correct, simplify, infer missing parts, normalize results, or fix mistakes. Preserve the writer's actual intent even if it is wrong. Never change digits or symbols to make an equation correct. If unsure, output your best guess and reflect uncertainty in the confidence value. Return ONLY JSON: { \"latex\": string, \"confidence\": number }.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe exactly to LaTeX. Do not solve/correct. Return JSON: { \"latex\": string, \"confidence\": number }." },
            { type: "image_url", image_url: { url: imgUrl } },
          ],
        },
      ],
      temperature: 0.0,
    });
    const content = completion.choices?.[0]?.message?.content ?? "";
    let parsed: OCRSuccess | null = null;
    try {
      parsed = JSON.parse(content) as OCRSuccess;
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as OCRSuccess;
        } catch {
          parsed = null;
        }
      }
    }
    if (!parsed || typeof parsed.latex !== "string" || typeof parsed.confidence !== "number") {
      return null;
    }
    const confidence = Math.max(0, Math.min(1, parsed.confidence));
    return { latex: parsed.latex.trim(), confidence };
  } catch {
    return null;
  }
}

async function handle(req: Request): Promise<Response> {
  console.log("[OCR Edge Function] Request received");
  try {
    const { attemptId, stepId, imageUrl, imageBase64, dryRun } = await req.json();
    console.log("[OCR] attemptId:", attemptId, "stepId:", stepId, "dryRun:", dryRun);
    
    if (dryRun === true) {
      console.log("[OCR] Dry run mode - returning mock data");
      const body: OCRSuccess = { latex: "x+1=2", confidence: 1 };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (!attemptId || !stepId || (!imageUrl && !imageBase64)) {
      console.error("[OCR] Missing required fields");
      const body: OCRError = { error: "invalid_request", message: "Missing attemptId, stepId, or image payload" };
      return new Response(JSON.stringify(body), { status: 400, headers: { "content-type": "application/json" } });
    }

    // Guardrail: enforce size limit (~2.5MB)
    if (imageBase64) {
      const size = approxBytesFromBase64(imageBase64);
      if (size > 2_621_440) { // 2.5MB
        const body: OCRError = { error: "payload_too_large", message: "Base64 image exceeds 2.5MB" };
        return new Response(JSON.stringify(body), { status: 413, headers: { "content-type": "application/json" } });
      }
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("[OCR] CRITICAL: OPENAI_API_KEY environment variable is not set!");
      console.error("[OCR] You need to set this in Supabase Edge Functions settings");
      console.error("[OCR] Run: supabase secrets set OPENAI_API_KEY=sk-your-key-here");
      const body: OCRError = { error: "server_misconfigured", message: "OPENAI_API_KEY not set" };
      return new Response(JSON.stringify(body), { status: 500, headers: { "content-type": "application/json" } });
    }
    console.log("[OCR] OpenAI API key found, initializing client...");
    const client = new OpenAI({ apiKey });

    // Build image reference
    const imgUrl = imageBase64
      ? `data:image/png;base64,${imageBase64}`
      : (typeof imageUrl === "string" ? imageUrl : "");

    // Primary attempt with fallback model
    console.log("[OCR] Calling OpenAI Vision API...");
    let result = await transcribeExactJSON({ client, model: "gpt-4o", imgUrl });
    if (!result) {
      console.warn("[OCR] Primary model failed to return valid JSON; trying gpt-4o-mini…");
      result = await transcribeExactJSON({ client, model: "gpt-4o-mini", imgUrl });
    }
    if (!result) {
      const body: OCRError = { error: "parse_failed", message: "Model did not return expected JSON after retries" };
      return new Response(JSON.stringify(body), { status: 422, headers: { "content-type": "application/json" } });
    }
    console.log("[OCR] Returning success response - LaTeX:", result.latex, "Confidence:", result.confidence);
    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    console.error("[OCR] Exception caught:", e);
    console.error("[OCR] Error name:", e?.name);
    console.error("[OCR] Error message:", e?.message);
    console.error("[OCR] Error stack:", e?.stack);
    const status = typeof e?.status === "number" ? e.status : 500;
    const body: OCRError = { error: "server_error", message: typeof e?.message === "string" ? e.message : "Unexpected error" };
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }
}

// Supabase Edge Functions require a default export that serves HTTP requests
Deno.serve(handle);

