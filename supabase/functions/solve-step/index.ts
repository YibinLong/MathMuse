import OpenAI from "npm:openai";

type ValidationStatus = 'correct_useful' | 'correct_not_useful' | 'incorrect' | 'uncertain';
type SolveSuccess = { status: ValidationStatus; reason: string; solverMetadata?: unknown };
type SolveError = { error: string; message?: string };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function normalizeLatex(s: string | undefined | null): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/\s+/g, '')
    .replace(/\\,/g, '')
    .trim();
}

function latexToPlainExpr(latex: string): string {
  // Very small normalizer for simple algebra: remove spaces, convert \cdot and similar to '*'
  return (latex || '')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\left|\\right/g, '')
    .replace(/\s+/g, '')
    // Make implicit multiplication explicit for simple patterns
    .replace(/(\d)(x)/gi, '$1*$2')   // 2x -> 2*x
    .replace(/(x)(\d)/gi, '$1*$2')   // x2 -> x*2
    .replace(/(\d)\(/g, '$1*(')      // 2( ... ) -> 2*( ... )
    .replace(/\)(\d|x)/gi, ')*$1')   // (...)2 -> (...)*2, (...)x -> (...)*x
    .replace(/(x)\(/gi, '$1*(');     // x( ... ) -> x*( ... )
}

function isSafeExpr(expr: string): boolean {
  // Allow only digits, decimal point, operators, parentheses, and the variable x
  return /^[0-9x+\-*/().^=]*$/.test(expr);
}

function evalExpr(expr: string): number {
  // Replace '^' with '**' for JS exponent
  const js = expr.replace(/\^/g, '**');
  // eslint-disable-next-line no-new-func
  const fn = new Function(`return (${js});`);
  const v = fn();
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('bad_eval');
  return v;
}

function satisfiesEquation(problemLatex: string, currLatex: string): boolean {
  // Handle simple one-variable equations like ax=b and current like x=2 or x=4/2 or x=\frac{4}{2}
  // Accept a numeric expression on the RHS and evaluate it.
  const curr = latexToPlainExpr(currLatex);
  const m = curr.match(/^x=(.+)$/i);
  if (!m) return false;
  const rhsExpr = m[1].trim();
  if (!isSafeExpr(rhsExpr.replace(/x/gi, ''))) return false;
  let xVal: number;
  try {
    xVal = evalExpr(rhsExpr);
  } catch {
    return false;
  }

  const prob = latexToPlainExpr(problemLatex);
  const parts = prob.split('=');
  if (parts.length !== 2) return false;
  const [lhs, rhs] = parts;
  if (!isSafeExpr(lhs) || !isSafeExpr(rhs)) return false;

  const sub = (s: string) => s.replace(/x/gi, `(${xVal})`);
  try {
    const lv = evalExpr(sub(lhs));
    const rv = evalExpr(sub(rhs));
    return Math.abs(lv - rv) < 1e-9;
  } catch {
    return false;
  }
}

function parseNumericX(currLatex: string): number | null {
  const curr = latexToPlainExpr(currLatex);
  const m = curr.match(/^x=(.+)$/i);
  if (!m) return null;
  const rhsExpr = m[1].trim();
  if (!isSafeExpr(rhsExpr.replace(/x/gi, ''))) return null;
  try {
    return evalExpr(rhsExpr);
  } catch {
    return null;
  }
}

async function callCameraMathShowSteps(args: { problem: string }) {
  const apiKey = Deno.env.get('CAMERAMATH_API_KEY');
  if (!apiKey) throw Object.assign(new Error('CAMERAMATH_API_KEY not set'), { status: 500 });

  // Official docs: https://developers.cameramath.com/docs
  // We'll use show-steps to retrieve a step-by-step solution path and compare against the user's step.
  const url = 'https://api.cameramath.com/v1/show-steps';
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Docs show Authorization header is the API key value (no Bearer)
        'authorization': apiKey,
        'accept': 'application/json',
      },
      body: JSON.stringify({ input: args.problem, lang: 'EN' }),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const err: any = new Error('CameraMath error');
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(id);
  }
}

async function llmFallback(args: { prevLatex?: string; currLatex: string; problem: string }): Promise<SolveSuccess> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return { status: 'uncertain', reason: 'LLM fallback unavailable; no OPENAI_API_KEY', solverMetadata: { engine: 'none' } };
  }
  const client = new OpenAI({ apiKey });
  const sys = 'You judge math steps. Classify into one of: correct_useful, correct_not_useful, incorrect, uncertain. Provide a one-sentence reason. Return strict JSON: {"status": string, "reason": string}';
  const user = `Problem: ${args.problem}\nPrevious: ${args.prevLatex ?? '(none)'}\nCurrent: ${args.currLatex}`;
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    temperature: 0,
  });
  const content = completion.choices?.[0]?.message?.content ?? '{}';
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch {}
  const status: ValidationStatus = ['correct_useful','correct_not_useful','incorrect','uncertain'].includes(parsed?.status) ? parsed.status : 'uncertain';
  return { status, reason: typeof parsed?.reason === 'string' ? parsed.reason : 'Uncertain classification', solverMetadata: { engine: 'openai', model: 'gpt-4o-mini' } };
}

export async function handle(req: Request): Promise<Response> {
  try {
    const { prevLatex, currLatex, problem, dryRun } = await req.json();
    if (dryRun === true) {
      const mock: SolveSuccess = { status: 'correct_useful', reason: 'Dry run mock response', solverMetadata: { engine: 'mock' } };
      return jsonResponse(mock, 200);
    }
    if (!currLatex || !problem) {
      const body: SolveError = { error: 'invalid_request', message: 'Missing currLatex or problem' };
      return jsonResponse(body, 400);
    }

    // Short-circuit for numeric solutions: if the current step directly satisfies the equation, treat as correct_useful.
    // If it is a numeric solution that does NOT satisfy, return incorrect with a clear reason.
    try {
      const numeric = parseNumericX(currLatex);
      if (numeric !== null && satisfiesEquation(problem, currLatex)) {
        const body: SolveSuccess = {
          status: 'correct_useful',
          reason: 'This step satisfies the original equation.',
          solverMetadata: { engine: 'direct_check' }
        };
        return jsonResponse(body, 200);
      } else if (numeric !== null) {
        const body: SolveSuccess = {
          status: 'incorrect',
          reason: `The solution x=${numeric} does not satisfy the equation.`,
          solverMetadata: { engine: 'direct_check' }
        };
        return jsonResponse(body, 200);
      }
    } catch {
      // ignore and continue
    }

    // Try CameraMath (show-steps) first with small retry on 429/5xx
    let cmErr: any = null;
    const backoff = [0, 500, 1000];
    for (let i = 0; i < backoff.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, backoff[i]));
      try {
        const cm = await callCameraMathShowSteps({ problem });
        // Response per docs: { data: { solutions: [ { solving_steps: [ { latex?: string, description? } ] } ] } }
        const steps: string[] = (cm?.data?.solutions?.[0]?.solving_steps || [])
          .map((st: any) => normalizeLatex(st?.latex))
          .filter((s: string) => s.length > 0);

        const currN = normalizeLatex(currLatex);
        const prevN = normalizeLatex(prevLatex);
        const probN = normalizeLatex(problem);
        const prevIsProblem = !!prevN && prevN === probN;
        const currIdx = steps.findIndex((s) => s === currN);
        const prevIdx = prevN ? steps.findIndex((s) => s === prevN) : -1;

        let status: ValidationStatus = 'uncertain';
        let reason = 'Could not match step to solver path.';
        if (currIdx >= 0 && prevIdx >= 0) {
          if (currIdx > prevIdx) {
            status = 'correct_useful';
            reason = `Matches solver step ${currIdx + 1} after previous step ${prevIdx + 1}.`;
          } else if (currIdx === prevIdx) {
            status = 'correct_not_useful';
            reason = `Matches the same solver step ${currIdx + 1} (no progress).`;
          } else {
            status = 'incorrect';
            reason = `Appears earlier (step ${currIdx + 1}) than previous step ${prevIdx + 1}.`;
          }
        } else if (currIdx >= 0 && prevIdx < 0) {
          status = 'correct_useful';
          reason = `Matches solver step ${currIdx + 1}.`;
        } else if (currIdx < 0 && prevIdx >= 0) {
          status = 'uncertain';
          reason = prevIsProblem
            ? 'First step after the problem; this line did not match the solver path.'
            : 'Previous step matched solver path, current did not.';
        }

        const body: SolveSuccess = { status, reason, solverMetadata: { engine: 'cameramath', stepsMatched: { currIdx, prevIdx }, raw: cm } };
        return jsonResponse(body, 200);
      } catch (e: any) {
        cmErr = e;
        const statusCode = typeof e?.status === 'number' ? e.status : 0;
        if (!(statusCode === 429 || statusCode >= 500)) break;
      }
    }

    // Fallback to LLM classification
    const llm = await llmFallback({ prevLatex, currLatex, problem });
    // Include CameraMath error in metadata if present
    llm.solverMetadata = { ...(llm.solverMetadata || {}), cameramath_error: cmErr ? { status: cmErr.status, payload: cmErr.payload } : undefined };
    return jsonResponse(llm, 200);
  } catch (e: any) {
    const body: SolveError = { error: 'bad_json', message: 'Invalid JSON body' };
    return jsonResponse(body, 400);
  }
}

// Serve HTTP requests (Supabase Edge Functions)
Deno.serve(handle);

