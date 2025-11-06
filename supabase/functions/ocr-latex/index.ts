export async function handle(req: Request): Promise<Response> {
  try {
    const { attemptId, stepId, imageUrl, imageBase64 } = await req.json();
    if (!attemptId || !stepId || (!imageUrl && !imageBase64)) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 });
    }
    // Mock response per PRD contract
    return new Response(
      JSON.stringify({ latex: "x^2 + y^2 = 1", confidence: 0.85 }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 });
  }
}


