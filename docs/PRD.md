## 1. Project Summary

Build a tablet-first React Native app (MathMuse) to clone Project Chiron’s training mode: students handwrite math solutions line-by-line on a Skia canvas, each line is recognized (OCR → LaTeX), checked for correctness and usefulness, and the app provides targeted hints and brief voice tutoring. MVP scope: (A) Handwriting canvas with line segmentation, (B) OCR-to-LaTeX + step validation via external solver, (C) guidance loop (nudge/hint/voice), (D) Supabase auth and attempt storage.


## 2. Core Goals

- Users can sign in and see a math problem at the top of the screen.
- Users can write their solution line-by-line on a handwriting canvas with undo/erase/color.
- Users get automatic step checks after each line: correctness and usefulness.
- Users receive escalating guidance (nudge → hint → micro-step), optionally via short voice.
- Users’ attempts (problem, lines, outcomes) are saved to the cloud and can be resumed.


## 3. Non-Goals

- Full teacher/guide live-collab app (out of MVP; future epic).
- Assessment mode that checks only on submit (future mode, not in MVP).
- Advanced analytics dashboards; export-only basic logs in MVP.
- Multi-language UI/RTL; MVP is English-only.
- Offline-first sync; MVP requires network connectivity for OCR/solver.


## 4. Tech Stack (Solo-AI Friendly)

- Frontend: React Native 0.82 + TypeScript + Expo Dev Client
  - Rationale: Modern RN baseline, Expo tooling speeds local builds and device testing.
- Canvas & Drawing: `@shopify/react-native-skia`
  - Rationale: High-performance drawing with stylus-quality input and layers.
- State Management: Zustand
  - Rationale: Minimal, ergonomic store with great TS DX.
- Backend & Cloud: Supabase (Auth, Postgres, Storage, Edge Functions)
  - Rationale: BaaS with SQL, Auth, and serverless close to data.
- Handwriting OCR → LaTeX: OpenAI GPT-4o Vision via Supabase Edge Function
  - Rationale: Vision model handles freeform handwriting; server-side to protect keys.
- Math Solver: CameraMath (Upstudy) API via Edge Function
  - Rationale: Purpose-built solver with credits; server-side proxying.
- UI & Styling: NativeWind (Tailwind for RN)
  - Rationale: Fast, consistent utility styling; good RN + Expo docs.
- Voice: OpenAI GPT-4o mini TTS → audio playback with `expo-av`
  - Rationale: Lightweight TTS, high quality; `expo-av` handles playback.

Compatibility notes (verified via Context7 MCP lookups):
- React Native v0.82.0 exists and is stable (`/discord/react-native` shows v0.82.0). Use Expo SDK that pairs with RN 0.82 (run `npx expo doctor` to confirm pairing).
- `@shopify/react-native-skia` supports current RN releases and Expo via dev build (prebuild). No custom config plugin required.
- NativeWind v4+ is compatible with Expo and RN (requires Babel + Tailwind config).
- Supabase JS runs in RN; use Edge Functions for OpenAI/CameraMath to avoid exposing secrets.
- OpenAI Node SDK is not used on-device; we call OpenAI from Edge Functions.


## 5. Feature Breakdown — Vertical Slices

### Feature: Handwriting Canvas (Skia) with Line Segmentation
- User Story: As a student, I want to write my solution step-by-step so I can think out loud in math.
- Acceptance Criteria:
  - Canvas supports pen colors, eraser, and undo.
  - Visible guides (ruled lines) to encourage clear steps.
  - Tapping “Next line” freezes current strokes into a step and clears active layer.
  - Each step captures a raster image (PNG) and an SVG path snapshot for storage.
- Data Model Notes:
  - `attempt_steps` rows store: `png_storage_path`, `vector_json`, `created_at`, `step_index`.
- Edge Cases & Errors:
  - Large strokes → downscale for OCR; cap canvas resolution.
  - Accidental “Next line” → allow one-step undo.
  - Memory spikes on low-end devices → recycle bitmaps after upload.

### Feature: OCR to LaTeX (OpenAI GPT-4o Vision)
- User Story: As a student, I want the app to read my handwritten step so it understands what I wrote.
- Acceptance Criteria:
  - When a step is committed, its PNG is sent to an Edge Function.
  - Function returns LaTeX string and a normalized math representation.
  - UI shows recognized LaTeX inline per step (editable override optional).
- Data Model Notes:
  - `attempt_steps.ocr_latex`, `ocr_confidence`, `ocr_tokens_used`.
- Edge Cases & Errors:
  - Unreadable handwriting → return `uncertain` with suggestions; prompt user to rewrite.
  - Large image → server resizes; client sends ≤2MB PNG.
  - Rate limits → exponential backoff + user-facing message.

### Feature: Step Validation (Correctness & Usefulness)
- User Story: As a student, I want feedback after each line to know if I’m progressing.
- Acceptance Criteria:
  - For each new step, backend compares it vs previous step and target problem.
  - Correctness: algebraic validity (no illegal transformation).
  - Usefulness: step moves solution forward (not tautological or cosmetic).
  - Outcomes: (a) Correct & useful → green check, proceed; (b) Correct but not useful → accept with nudge; (c) Incorrect → mark with hint.
- Data Model Notes:
  - `attempt_steps.validation_status` enum: `correct_useful | correct_not_useful | incorrect | uncertain`.
  - `attempt_steps.validation_reason`, `solver_metadata` JSON.
- Edge Cases & Errors:
  - Ambiguous equivalence → fall back to LLM reasoning + solver verification.
  - Non-equational steps (definitions, diagrams) → allow manual accept with teacher mode (future).

### Feature: Guidance & Hints (Escalation + Voice)
- User Story: As a student, I want tailored hints so I can fix mistakes.
- Acceptance Criteria:
  - Escalation policy: nudge (concept cue) → directional hint → micro next step.
  - Optional TTS playback of the hint (≤5s) using GPT-4o mini TTS.
  - Tips appear on inactivity (e.g., 20s idle) or repeated incorrect steps.
- Data Model Notes:
  - `attempt_steps.hint_level`, `hint_text`, `tts_audio_path` (Storage).
- Edge Cases & Errors:
  - Avoid revealing full solution unless student stalls after N attempts (configurable).
  - TTS failure → text fallback.

### Feature: Auth & Cloud Storage (Supabase)
- User Story: As a student, I want my attempts saved so I can resume later.
- Acceptance Criteria:
  - Email/password auth with magic link support.
  - Attempts stored with steps and outcomes; resumable by user.
  - Storage bucket for step PNGs and optional audios.
- Data Model Notes:
  - Tables: `problems`, `attempts`, `attempt_steps` (see schema below).
  - RLS policies enforce row ownership by `auth.uid()`.
- Edge Cases & Errors:
  - Network drop mid-upload → queued retry.
  - Auth session expiry → refresh via supabase-js.


## 8. .env Setup

Create `.env` in project root (Expo loads `EXPO_PUBLIC_*` at runtime; server-only secrets live in Supabase Edge Function environment):

```
# Expo client (public) – safe values only
EXPO_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
EXPO_PUBLIC_APP_ENV="dev"            # dev|staging|prod
EXPO_PUBLIC_DEBUG="true"             # verbose client logs

# Local dev tooling (optional)
SENTRY_DSN=""
```

Supabase Edge Functions (server) – set in Supabase dashboard per function:

```
OPENAI_API_KEY="sk-..."                 # required for OCR and TTS
CAMERAMATH_API_KEY="cm-..."             # required for math solving
JWT_SECRET="..."                         # if needed for custom signing
APP_BASE_STORAGE_BUCKET="attempts"       # storage bucket name
```

Manual setup required when adding/rotating keys. See Section 11.


## 9. .gitignore

```
# Node / JS
node_modules/
npm-debug.log*
yarn-error.log*
pnpm-lock.yaml

# Expo / React Native
.expo/
.expo-shared/
dist/
build/
ios/
android/

# Env & local config
.env
.env.*
.DS_Store
*.log
.vscode/
.idea/
```


## 10. Debugging & Logging

- Client logging:
  - Use a simple logger wrapper around `console` gated by `EXPO_PUBLIC_DEBUG`.
  - Annotate async flows (OCR request → validation → hint pipeline) with scoped tags.
- Network debugging:
  - Use Expo dev tools network inspector; mirror crucial errors to in-app toasts.
- Crash tracking (optional):
  - Sentry or Expo Crash if enabled via environment; keep off for MVP to reduce setup.
- Note: Electron main/renderer separation does not apply; this is a pure RN + Expo app.


## 11. External Setup Instructions (Manual)

1) Supabase Project
   - What: Create a new project, get `SUPABASE_URL` and `anon key`.
   - Where: Supabase Dashboard → New project.
   - Why: Auth, Postgres, Storage, and Edge Functions backend.

   SQL (run in Supabase SQL editor):
   ```sql
   create table public.problems (
     id uuid primary key default gen_random_uuid(),
     title text not null,
     body text not null,
     created_at timestamptz default now()
   );

   create table public.attempts (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users(id) on delete cascade,
     problem_id uuid references public.problems(id) on delete set null,
     status text default 'in_progress',
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   create table public.attempt_steps (
     id uuid primary key default gen_random_uuid(),
     attempt_id uuid references public.attempts(id) on delete cascade,
     step_index int not null,
     png_storage_path text,
     vector_json jsonb,
     ocr_latex text,
     ocr_confidence numeric,
     validation_status text check (validation_status in ('correct_useful','correct_not_useful','incorrect','uncertain')),
     validation_reason text,
     solver_metadata jsonb,
     hint_level int default 0,
     hint_text text,
     tts_audio_path text,
     created_at timestamptz default now()
   );

   alter table public.attempts enable row level security;
   alter table public.attempt_steps enable row level security;

   create policy "attempts are accessible by owner" on public.attempts
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create policy "steps by attempt owner" on public.attempt_steps
     for all using (
       exists (
         select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()
       )
     ) with check (
       exists (
         select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()
       )
     );
   ```

   Storage:
   - Create bucket `attempts` (public: false). Add policy to allow owners to read/write files with prefix `user_id/` via signed URLs.

2) Supabase Edge Functions
   - What: Create functions `ocr-latex`, `solve-step`, `tts-speak`.
   - Where: Supabase Dashboard → Edge Functions.
   - Why: Protect secrets; centralize AI calls; return only safe data to client.
   - Env vars: set `OPENAI_API_KEY`, `CAMERAMATH_API_KEY`, `APP_BASE_STORAGE_BUCKET`.

   Contracts (request/response):
   - `POST /ocr-latex`: body `{ attemptId, stepId, imageUrl | base64 }` → `{ latex, confidence }`
   - `POST /solve-step`: body `{ prevLatex, currLatex, problem }` → `{ correctness, usefulness, reason, solverMetadata }`
   - `POST /tts-speak`: body `{ text, voice?: string }` → `{ audioUrl }` (stored in `attempts` bucket)

3) OpenAI API
   - What: Generate API key with access to GPT-4o Vision and 4o-mini-tts.
   - Where: OpenAI Platform → API Keys.
   - Why: OCR (vision) and short voice tutoring (tts).

4) CameraMath (Upstudy) API
   - What: Create API key; verify quota/credits.
   - Where: Upstudy/CameraMath developer portal.
   - Why: Validate steps and retrieve solver context.

5) Apple Pencil / Android Stylus Testing (Manual)
   - What: Test on iPad/Android tablet with dev build.
   - Where: Physical device via Expo Dev Client.
   - Why: Ensure latency and stroke fidelity.


## 12. Deployment Plan

Local (Mac):
- Prereqs: Node LTS, Xcode (iOS), Android Studio (Android), `bun` or `npm`.
- Scaffold:
  - `npx create-expo-app@latest mathmuse --template expo-template-blank-typescript`
  - `cd mathmuse`
  - Install deps:
    - `npx expo install react-native-reanimated react-native-gesture-handler`
    - `npx expo install @shopify/react-native-skia`
    - `npm i zustand @supabase/supabase-js nativewind tailwindcss`
    - `npx expo install expo-av expo-file-system`
  - NativeWind config:
    - `npx tailwindcss init` → create `tailwind.config.js` with `content: ["**/*.{js,jsx,ts,tsx}"]` and `plugins: []`.
    - `babel.config.js`: add `plugins: ["nativewind/babel"]`.
  - Expo Dev Client (required for Skia):
    - `npx expo prebuild -p ios -p android`
    - `npx expo run:ios` (or `run:android`)

Run:
- `npx expo start`
- Connect device via Expo Dev Client; scan QR.

Build (EAS optional later):
- Use Expo Application Services when ready: `eas build -p ios|android` (requires EAS project setup).

Testing:
- Unit tests for stores and pure utils (Jest).
- Integration tests for Edge Functions with local Supabase CLI (optional).


## 🧱 TASK_LIST.md STRUCTURE

Epics → Stories → Tasks

Epic: Handwriting Canvas
- Story: Draw with pen/eraser/undo
  - Task: Implement Skia layer with color/width controls
  - Task: Add guides and step commit flow
- Story: Step image export and upload
  - Task: Rasterize to PNG and upload to Storage

Epic: OCR → LaTeX
- Story: Edge Function `ocr-latex`
  - Task: Accept base64/URL, call GPT-4o Vision, return LaTeX
- Story: Client integration
  - Task: Post step image, display LaTeX and confidence

Epic: Step Validation
- Story: Edge Function `solve-step`
  - Task: Compare prev/curr LaTeX + problem with CameraMath + LLM reasoning
- Story: Client feedback UI
  - Task: Badge statuses and nudge copy

Epic: Guidance & Voice
- Story: Hint escalation policy
  - Task: Define thresholds and templates
- Story: TTS
  - Task: Edge Function `tts-speak` with GPT-4o mini TTS → store audio
  - Task: Play audio via `expo-av`

Epic: Auth & Persistence
- Story: Supabase auth (email/magic)
  - Task: Wire up `supabase-js` client and session store
- Story: Attempts schema & RLS
  - Task: Create tables and policies


## 🧩 SOLO-DEV GUARDRAILS

- Single repo; Expo app + minimal `supabase/` folder for SQL and function specs.
- Secrets only in Supabase Edge Function env; client uses `EXPO_PUBLIC_*` for non-sensitive config.
- Strict TypeScript and ESLint; keep stores and services pure/testable.
- Ship vertical slices end-to-end (canvas → OCR → validation → hint).
- Avoid premature optimization; measure canvas latency on device.


## Appendix: Client Bootstrapping Snippets (for AI assistants)

Install & init Supabase client (client-side, uses anon key):

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
```

Zustand store skeleton:

```ts
// stores/attemptStore.ts
import { create } from 'zustand';

type StepStatus = 'pending' | 'correct_useful' | 'correct_not_useful' | 'incorrect' | 'uncertain';

interface AttemptState {
  attemptId?: string;
  steps: Array<{ id?: string; index: number; latex?: string; status?: StepStatus; reason?: string }>;
  addStep: () => void;
  updateStep: (index: number, patch: Partial<AttemptState['steps'][number]>) => void;
}

export const useAttemptStore = create<AttemptState>((set) => ({
  steps: [],
  addStep: () => set((s) => ({ steps: [...s.steps, { index: s.steps.length }] })),
  updateStep: (index, patch) => set((s) => ({
    steps: s.steps.map((st) => (st.index === index ? { ...st, ...patch } : st))
  }))
}));
```

NativeWind config examples:

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["**/*.{js,jsx,ts,tsx}"]
};
```

```js
// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel']
  };
};
```

Skia install note (Expo): requires dev build
- Run `npx expo prebuild` then `npx expo run:ios` or `run:android`.

Edge Function pseudo-code (OpenAI Vision → LaTeX) outline:

```ts
// supabase/functions/ocr-latex/index.ts (outline only)
import OpenAI from 'openai';

export async function handle(req: Request) {
  const { imageBase64 } = await req.json();
  const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
  // call GPT-4o vision with image; parse LaTeX; return { latex, confidence }
}
```


