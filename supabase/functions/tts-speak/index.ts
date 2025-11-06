export async function handle(req: Request): Promise<Response> {
  try {
    const { text, voice } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 });
    }
    // Mock response per PRD contract
    return new Response(
      JSON.stringify({ audioUrl: 'supabase://storage/attempts/mock/audio_123.mp3' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 });
  }
}


