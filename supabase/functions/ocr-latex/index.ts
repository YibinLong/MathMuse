import OpenAI from "npm:openai";

type OCRSuccess = { latex: string; confidence: number };
type OCRError = { error: string; message?: string };

function approxBytesFromBase64(b64: string): number {
  // Rough conversion: 3/4 of base64 chars minus padding
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
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

    // Ask model to strictly return JSON with { latex, confidence }
    console.log("[OCR] Calling OpenAI GPT-4o Vision API...");
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a handwriting OCR engine for mathematics. Extract ONLY the LaTeX that represents the handwritten expression/step. Return a compact JSON object with keys: latex (string LaTeX) and confidence (number 0..1). Avoid extra text.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please extract and normalize to valid LaTeX. Return JSON: { \"latex\": string, \"confidence\": number }." },
            { type: "image_url", image_url: { url: imgUrl } },
          ],
        },
      ],
      temperature: 0.0,
    });

    console.log("[OCR] OpenAI API call successful");
    const content = completion.choices?.[0]?.message?.content ?? "";
    console.log("[OCR] Raw response from OpenAI:", content);
    
    let parsed: OCRSuccess | null = null;
    try {
      parsed = JSON.parse(content) as OCRSuccess;
      console.log("[OCR] Successfully parsed JSON response");
    } catch (parseErr) {
      console.error("[OCR] Failed to parse JSON, trying fallback...", parseErr);
      // Fallback: try to extract JSON object via a loose match
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as OCRSuccess;
          console.log("[OCR] Fallback parse succeeded");
        } catch {
          parsed = null;
          console.error("[OCR] Fallback parse also failed");
        }
      }
    }

    if (!parsed || typeof parsed.latex !== "string" || typeof parsed.confidence !== "number") {
      const body: OCRError = { error: "parse_failed", message: "Model did not return expected JSON" };
      return new Response(JSON.stringify(body), { status: 422, headers: { "content-type": "application/json" } });
    }

    // Clamp confidence to [0,1]
    const confidence = Math.max(0, Math.min(1, parsed.confidence));
    const body: OCRSuccess = { latex: parsed.latex.trim(), confidence };
    console.log("[OCR] Returning success response - LaTeX:", body.latex, "Confidence:", body.confidence);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
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

