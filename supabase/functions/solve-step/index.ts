export async function handle(req: Request): Promise<Response> {
  try {
    const { prevLatex, currLatex, problem } = await req.json();
    if (!currLatex || !problem) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 });
    }
    // Mock response per PRD contract
    return new Response(
      JSON.stringify({
        correctness: 'correct_useful',
        usefulness: true,
        reason: 'Isolated variable correctly',
        solverMetadata: { engine: 'mock' }
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 });
  }
}


