## MathMuse — Task List

**Status Legend:** ⬜ Not Started | 🟦 In Progress | ✅ Done | ❌ Blocked

---

## PHASE 1: PROJECT SETUP

### Epic 1.1: Initialize Project & Environment

**Story:** Set up Expo RN app, TypeScript, UI and drawing foundations

- ⬜ **Task 1.1.1:** Initialize Expo React Native project with TypeScript (`create-expo-app`)
- ⬜ **Task 1.1.2:** Install core RN deps (`reanimated`, `gesture-handler`)
- ⬜ **Task 1.1.3:** Install Skia (`@shopify/react-native-skia`) and Expo modules (`expo-av`, `expo-file-system`)
- ⬜ **Task 1.1.4:** Install libraries (`zustand`, `@supabase/supabase-js`, `nativewind`, `tailwindcss`)
- ⬜ **Task 1.1.5:** Configure NativeWind (`tailwind.config.js`, `babel.config.js` plugin)
- ⬜ **Task 1.1.6:** Configure `app.json/app.config` basics (name, icon, splash, permissions)
- ⬜ **Task 1.1.7:** Create project structure (`/app`, `/components`, `/stores`, `/lib`, `/services`, `/screens`)
- ⬜ **Task 1.1.8:** Add `.gitignore` entries from PRD
- ⬜ **Task 1.1.9:** Add `.env` sample with `EXPO_PUBLIC_*` keys from PRD
- ⬜ **Task 1.1.10:** Validate RN/Expo pairing (`npx expo doctor`) and run dev server

**Acceptance:** App compiles and runs on device/simulator, Tailwind works, Skia ready for dev build.

### Epic 1.2: Dev Client & Skia Enablement

**Story:** Enable native prebuild to use Skia and test on device

- ⬜ **Task 1.2.1:** Prebuild native projects (`npx expo prebuild -p ios -p android`)
- ⬜ **Task 1.2.2:** Build and run Dev Client (`npx expo run:ios` or `run:android`)
- ⬜ **Task 1.2.3:** Verify Skia canvas renders on device

**Acceptance:** Skia canvas renders a basic line on a physical device.

### Epic 1.3: Supabase Project & Environment

**Story:** Create Supabase backend, schema, RLS, and storage

- ⬜ **Task 1.3.1:** Create Supabase project, obtain URL and anon key
- ⬜ **Task 1.3.2:** Execute SQL to create `problems`, `attempts`, `attempt_steps` tables
- ⬜ **Task 1.3.3:** Enable RLS on `attempts` and `attempt_steps` with policies from PRD
- ⬜ **Task 1.3.4:** Create private bucket `attempts`; add policy for `user_id/` prefixes via signed URLs
- ⬜ **Task 1.3.5:** Seed a few sample `problems` rows for testing
- ⬜ **Task 1.3.6:** Create `lib/supabase.ts` client using `EXPO_PUBLIC_*` envs

**Acceptance:** Can read/write attempts/steps as the authenticated user; storage upload works via signed URL.

### Epic 1.4: Edge Functions Scaffolding

**Story:** Stub functions and environment for AI calls

- ⬜ **Task 1.4.1:** Scaffold Supabase Edge Functions folder (`supabase/functions/*`)
- ⬜ **Task 1.4.2:** Create function stubs: `ocr-latex`, `solve-step`, `tts-speak`
- ⬜ **Task 1.4.3:** Configure server env vars: `OPENAI_API_KEY`, `CAMERAMATH_API_KEY`, `APP_BASE_STORAGE_BUCKET`
- ⬜ **Task 1.4.4:** Add minimal request/response validation and logging

**Acceptance:** Functions deploy and respond to a simple test request in Supabase dashboard.

---

## PHASE 2: HANDWRITING CANVAS (VERTICAL SLICE)

### Epic 2.1: Skia Drawing Layer

**Story:** Students can draw with pen/eraser, undo, and line guides

- ⬜ **Task 2.1.1:** Implement Skia canvas component with pen color/width controls
- ⬜ **Task 2.1.2:** Add eraser mode and undo last stroke
- ⬜ **Task 2.1.3:** Render ruled line guides to encourage line-by-line writing
- ⬜ **Task 2.1.4:** Add “Next line” action to freeze current strokes and clear active layer
- ⬜ **Task 2.1.5:** Capture vector path data (JSON) for each committed step
- ⬜ **Task 2.1.6:** Limit max resolution and downscale large strokes to control memory/size
- ⬜ **Task 2.1.7:** Measure render latency on device; basic perf instrumentation

**Acceptance:** User can draw, undo, and commit a line as a step with guides visible.

### Epic 2.2: Step Export & Local Handling

**Story:** Export each committed step to PNG and prepare upload payload

- ⬜ **Task 2.2.1:** Rasterize committed layer to PNG (≤ 2MB target)
- ⬜ **Task 2.2.2:** Store temporary PNG locally for retry flow
- ⬜ **Task 2.2.3:** Free/recycle bitmaps after export to avoid memory spikes

**Acceptance:** Each committed step results in a local PNG file and vector JSON snapshot.

### Epic 2.3: Upload & Step Persistence

**Story:** Upload PNG to Storage and create `attempt_steps` row

- ⬜ **Task 2.3.1:** Upload PNG to `attempts/<user_id>/<attempt_id>/<step_index>.png`
- ⬜ **Task 2.3.2:** Create `attempt_steps` row with `png_storage_path`, `vector_json`, `step_index`
- ⬜ **Task 2.3.3:** Add queued retry and user-facing error states for upload failures

**Acceptance:** After tapping “Next line,” a step row exists and its PNG is in Storage.

---

## PHASE 3: OCR → LaTeX

### Epic 3.1: Edge Function `ocr-latex`

**Story:** Convert step PNG to LaTeX on the server using GPT-4o Vision

- ⬜ **Task 3.1.1:** Implement `POST /ocr-latex` accepting base64/URL with auth checks
- ⬜ **Task 3.1.2:** Call OpenAI Vision, parse/normalize LaTeX, compute confidence
- ⬜ **Task 3.1.3:** Enforce input size guardrails; structured error responses; basic rate limiting/backoff cues
- ⬜ **Task 3.1.4:** Return `{ latex, confidence }` per PRD contract

**Acceptance:** Given a valid PNG, function returns plausible LaTeX and confidence.

### Epic 3.2: Client Integration for OCR

**Story:** Display recognized LaTeX and store on the step

- ⬜ **Task 3.2.1:** After step upload, call `ocr-latex`; show LaTeX inline with confidence
- ⬜ **Task 3.2.2:** Allow optional manual LaTeX edit/override
- ⬜ **Task 3.2.3:** Update `attempt_steps` with `ocr_latex`, `ocr_confidence`
- ⬜ **Task 3.2.4:** Handle `uncertain` cases; prompt user to rewrite if needed

**Acceptance:** Recognized LaTeX appears under the step; DB reflects OCR fields.

---

## PHASE 4: STEP VALIDATION (CORRECTNESS & USEFULNESS)

### Epic 4.1: Edge Function `solve-step`

**Story:** Compare previous and current LaTeX with the problem and assess

- ⬜ **Task 4.1.1:** Implement `POST /solve-step` with `{ prevLatex, currLatex, problem }`
- ⬜ **Task 4.1.2:** Integrate CameraMath API; capture `solverMetadata`
- ⬜ **Task 4.1.3:** Add LLM reasoning fallback for ambiguous cases
- ⬜ **Task 4.1.4:** Map outcomes to `validation_status` and `validation_reason`

**Acceptance:** Function returns one of `correct_useful | correct_not_useful | incorrect | uncertain` with reason.

### Epic 4.2: Client Feedback & Nudge UI

**Story:** Provide clear per-step feedback and guidance entry points

- ⬜ **Task 4.2.1:** Render badges for step status (green check, warning, error)
- ⬜ **Task 4.2.2:** Show short nudge copy for `correct_not_useful` and `incorrect`
- ⬜ **Task 4.2.3:** Surface `uncertain` state with actionable rewrite prompt

**Acceptance:** Users see immediate, comprehensible feedback for each committed step.

---

## PHASE 5: GUIDANCE & VOICE

### Epic 5.1: Hint Escalation Policy

**Story:** Escalate guidance from nudge → hint → micro-step

- ⬜ **Task 5.1.1:** Define thresholds (e.g., N incorrect steps, 20s idle) to trigger hints
- ⬜ **Task 5.1.2:** Author hint templates per status/context
- ⬜ **Task 5.1.3:** Persist `hint_level` and `hint_text` on `attempt_steps`

**Acceptance:** Repeated mistakes or idle time produce appropriate hints with stored metadata.

### Epic 5.2: TTS via Edge Function `tts-speak`

**Story:** Optional short voice playback of hints

- ⬜ **Task 5.2.1:** Implement `POST /tts-speak` using OpenAI 4o-mini-tts
- ⬜ **Task 5.2.2:** Store audio in Storage; return `audioUrl`; persist `tts_audio_path`
- ⬜ **Task 5.2.3:** Play audio in app via `expo-av`; add text fallback on failure

**Acceptance:** Tapping play on a hint speaks ≤5s audio reliably.

---

## PHASE 6: AUTH & PERSISTENCE

### Epic 6.1: Supabase Auth (Email + Magic Link)

**Story:** Users can sign up/in and maintain a session

- ⬜ **Task 6.1.1:** Wire `supabase-js` client and session store (Zustand)
- ⬜ **Task 6.1.2:** Build sign-in/sign-up UI with email/password and magic link
- ⬜ **Task 6.1.3:** Gate app screens by auth state; session refresh handling

**Acceptance:** Authenticated users can access problems and attempts; sessions persist across app restarts.

### Epic 6.2: Attempts Lifecycle & Resume

**Story:** Create, resume, and complete attempts with steps persisted

- ⬜ **Task 6.2.1:** `Start Attempt` flow linking to a `problem`
- ⬜ **Task 6.2.2:** Load existing attempts and resume with prior steps
- ⬜ **Task 6.2.3:** Mark attempt `status` complete; set `updated_at`
- ⬜ **Task 6.2.4:** Ensure RLS compliance on all reads/writes by `auth.uid()`

**Acceptance:** Attempts and steps are fully owned by users and resumable.

---

## PHASE 7: UX, LOGGING, TESTING, DEPLOYMENT

### Epic 7.1: Problem Viewer & Session UI

**Story:** Show the problem at top and step list below

- ⬜ **Task 7.1.1:** Problem header with title/body
- ⬜ **Task 7.1.2:** Step list UI showing LaTeX, status, and actions (play, rewrite)
- ⬜ **Task 7.1.3:** Controls for pen, eraser, color, undo, Next line

**Acceptance:** The core training screen aligns with PRD layout and flows.

### Epic 7.2: Debugging & Logging

**Story:** Simple logger and network visibility for solo-dev

- ⬜ **Task 7.2.1:** Implement logger gated by `EXPO_PUBLIC_DEBUG`
- ⬜ **Task 7.2.2:** Tag logs across OCR → validation → hint flows
- ⬜ **Task 7.2.3:** Mirror critical errors to in-app toasts

**Acceptance:** Developer can trace flows and see surfaced errors in-app.

### Epic 7.3: Testing

**Story:** Unit tests for stores/utils; optional function tests

- ⬜ **Task 7.3.1:** Configure Jest; add tests for Zustand stores and pure utils
- ⬜ **Task 7.3.2:** Add mock tests for `ocr-latex` and `solve-step` (local stubs or CLI)

**Acceptance:** Core logic has test coverage; CI can run tests locally.

### Epic 7.4: Build, Profiles, and Releases

**Story:** Validate environments and prepare for EAS builds

- ⬜ **Task 7.4.1:** Validate `EXPO_PUBLIC_APP_ENV` (dev|staging|prod) config
- ⬜ **Task 7.4.2:** Document secrets placement (client vs Edge Functions)
- ⬜ **Task 7.4.3:** Configure EAS project; produce a dev client build for iOS/Android
- ⬜ **Task 7.4.4:** Prepare release build checklist and smoke tests

**Acceptance:** Signed dev client builds exist; release checklist defined.

---

## PHASE 8: POLISH & FUTURE

### Epic 8.1: Performance & Reliability Polishing

**Story:** Smooth drawing and robust network flows

- ⬜ **Task 8.1.1:** Optimize Skia redraws; batch state updates
- ⬜ **Task 8.1.2:** Exponential backoff on OCR/validation; user messaging
- ⬜ **Task 8.1.3:** Memory hygiene on low-end devices; image recycling

**Acceptance:** Stable performance on target tablets; graceful network degradation.

---

## Appendix: Mapping to PRD

- **Canvas & Line Segmentation:** Phase 2 (2.1–2.3)
- **OCR to LaTeX:** Phase 3 (3.1–3.2)
- **Step Validation:** Phase 4 (4.1–4.2)
- **Guidance & Voice:** Phase 5 (5.1–5.2)
- **Auth & Cloud:** Phase 6 (6.1–6.2)
- **Debugging/Deployment:** Phase 7 (7.2, 7.4)


