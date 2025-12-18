# MathMuse - Project Explanation Guide

> Use this document to understand and explain your project in technical interviews.

---

## What is MathMuse? (The Elevator Pitch)

**MathMuse** is a mobile app that helps students practice math by writing solutions by hand. Students draw their work step-by-step, and AI checks if each step is correct, giving hints when they're stuck.

**In one sentence:** "It's like having a math tutor in your pocket that watches you solve problems and helps when you make mistakes."

---

## The Big Picture (Architecture Overview)

```
┌─────────────────────────────────────────────────┐
│           MOBILE APP (React Native/Expo)        │
│  • Drawing canvas for handwriting               │
│  • Screens for navigation                       │
│  • State management with Zustand                │
└─────────────────────────────────────────────────┘
                        │
                        │ HTTPS (API calls)
                        ▼
┌─────────────────────────────────────────────────┐
│              BACKEND (Supabase)                 │
│  • Database (PostgreSQL)                        │
│  • Authentication (login/signup)                │
│  • File Storage (images, audio)                 │
│  • Edge Functions (AI processing)               │
└─────────────────────────────────────────────────┘
                        │
                        │ API calls
                        ▼
┌─────────────────────────────────────────────────┐
│            EXTERNAL AI SERVICES                 │
│  • OpenAI GPT-4o (handwriting → text)           │
│  • CameraMath API (math validation)             │
│  • OpenAI TTS (voice hints)                     │
└─────────────────────────────────────────────────┘
```

---

## Technologies Used (and Why)

### Frontend

| Technology | What It Is | Why We Use It |
|------------|-----------|---------------|
| **React Native** | Framework for building mobile apps with JavaScript | Write once, run on iOS AND Android |
| **Expo** | Tools that make React Native easier | Faster development, easier deployment |
| **Skia Canvas** | High-performance drawing library | Smooth 60fps handwriting - feels like real paper |
| **Zustand** | State management library | Simple way to share data between components |
| **NativeWind** | Tailwind CSS for React Native | Quick, consistent styling |
| **TypeScript** | JavaScript with types | Catches bugs before they happen |

### Backend

| Technology | What It Is | Why We Use It |
|------------|-----------|---------------|
| **Supabase** | Backend-as-a-service (like Firebase) | Database, auth, storage, serverless functions - all in one |
| **PostgreSQL** | Database | Stores users, problems, progress, attempts |
| **Edge Functions** | Serverless code (runs on Supabase) | Keeps API keys secret, handles AI calls |
| **OpenAI API** | AI for image-to-text and voice | Converts handwriting to math, generates voice hints |

---

## How the App Works (User Flow)

### Step 1: User Logs In
```
User opens app → AuthScreen → Supabase Auth → Session stored locally
```

### Step 2: User Picks a Problem
```
LearningPathScreen → Pick category (e.g., "Linear Equations")
       ↓
LevelSelectionScreen → Pick level (1-10)
       ↓
ProblemScreen → Shows the math problem to solve
```

### Step 3: User Solves the Problem (The Magic Part)
```
1. User draws a line of work on the canvas
2. Taps "Next Line" button
3. App takes a screenshot of their handwriting
4. Screenshot sent to backend for processing:

   [Handwriting Image]
         ↓
   OCR (GPT-4o Vision) → Converts to LaTeX: "2x + 3 = 7"
         ↓
   Validator (CameraMath) → Is this step correct?
         ↓
   If wrong: Generate hint → Optional: Voice hint
         ↓
   Show result to user (green = correct, red = wrong)
```

---

## The Three Main "Brains" (Edge Functions)

### 1. OCR Function (`ocr-latex`)
**Job:** Turn handwriting into text

```
Input:  [Image of "2x + 3 = 7" written by hand]
Output: { latex: "2x + 3 = 7", confidence: 0.95 }
```

**How it works:**
- Sends image to OpenAI GPT-4o Vision
- GPT reads the handwriting and returns LaTeX
- Has retry logic if it fails

### 2. Validation Function (`solve-step`)
**Job:** Check if the math step is correct

```
Input:  { prevLatex: "2x + 6 = 12", currLatex: "2x = 6", problem: "2x + 6 = 12" }
Output: { status: "correct_useful", reason: "Correctly subtracted 6 from both sides" }
```

**Possible statuses:**
- `correct_useful` - Right answer, good step!
- `correct_not_useful` - Right but doesn't help solve it
- `incorrect` - Math error
- `uncertain` - Can't tell (bad handwriting)

### 3. Voice Function (`tts-speak`)
**Job:** Convert hint text to audio

```
Input:  { text: "Try subtracting 3 from both sides" }
Output: { audioUrl: "https://..." } (MP3 file)
```

---

## State Management (How Data Flows)

The app uses **Zustand** stores to manage state. Think of stores like shared "boxes" that hold data.

### Session Store (`sessionStore.ts`)
**Holds:** Who is logged in
```javascript
{
  session: { user_id: "abc123", email: "student@email.com" },
  isLoading: false
}
```

### Progress Store (`progressStore.ts`)
**Holds:** What categories/levels are complete
```javascript
{
  categories: [
    { id: "1", name: "Basic Equations", completedLevels: 5, totalLevels: 10 }
  ],
  levels: [
    { levelNumber: 1, status: "completed" },
    { levelNumber: 2, status: "unlocked" },
    { levelNumber: 3, status: "locked" }
  ]
}
```

### Attempt Store (`attemptStore.ts`)
**Holds:** Current drawing canvas state
```javascript
{
  activeStrokes: [...],      // What you're currently drawing
  committedLayers: [[...]],  // Previous "frozen" lines
  currentColor: "#000000",
  strokeWidth: 3
}
```

---

## Database Structure (Simplified)

```
┌──────────────────────────────────────────────────────────────┐
│                         USERS                                 │
│  (handled by Supabase Auth - you don't see this table)       │
└──────────────────────────────────────────────────────────────┘
         │
         │ user_id
         ▼
┌──────────────────────────────────────────────────────────────┐
│                      user_progress                            │
│  user_id | category_id | level_number | status               │
│  --------|-------------|--------------|--------              │
│  abc123  | cat1        | 1            | completed            │
│  abc123  | cat1        | 2            | unlocked             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       categories                              │
│  id   | name              | description                      │
│  -----|-------------------|---------------------------       │
│  cat1 | Basic Equations   | Simple one-step equations        │
│  cat2 | Linear Equations  | Multi-step equations             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                        problems                               │
│  id    | title        | body                                 │
│  ------|--------------|------------------------              │
│  prob1 | Solve for x  | 2x + 3 = 7                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    attempt_steps                              │
│  id | attempt_id | step_index | ocr_latex | validation_status│
│  ---|------------|------------|-----------|------------------|
│  s1 | att1       | 0          | 2x = 4    | correct_useful   │
│  s2 | att1       | 1          | x = 2     | correct_useful   │
└──────────────────────────────────────────────────────────────┘
```

---

## Security: Row Level Security (RLS)

**What is RLS?** Database rules that automatically filter data by user.

**Why it matters:** Users can ONLY see their own data. Even if someone hacks the frontend, they can't access other users' attempts.

```sql
-- Example: Users can only read their own progress
CREATE POLICY "Users read own progress"
ON user_progress
FOR SELECT
USING (auth.uid() = user_id);
```

**Interview explanation:** "I used Supabase's Row Level Security so the database itself enforces that users can only access their own data. This is more secure than checking permissions in code."

---

## Key Design Decisions (Good Interview Talking Points)

### 1. Why Skia for the Canvas?
**Answer:** "Standard React Native views can't handle smooth drawing. Skia is a GPU-accelerated graphics library that gives us 60fps performance, which feels natural like writing on paper."

### 2. Why Supabase instead of building a custom backend?
**Answer:** "Supabase gives us auth, database, file storage, and serverless functions all in one. For a prototype, this let me focus on the product instead of DevOps."

### 3. Why Edge Functions for AI calls?
**Answer:** "API keys for OpenAI and CameraMath need to stay secret. If I put them in the mobile app, anyone could extract them. Edge Functions run on the server, so keys are never exposed."

### 4. Why store both PNG and vector data?
**Answer:** "PNG is sent to AI for OCR - it's what the handwriting looks like. Vector data (the stroke coordinates) is smaller and lets us replay or edit the drawing. Best of both worlds."

### 5. Why hint escalation?
**Answer:** "Good tutoring starts with gentle nudges before giving answers. Level 1 is 'check your algebra', level 2 is 'look at this term', level 3 gives the actual step. This teaches problem-solving, not just answers."

---

## The Canvas Component (HandwritingCanvas.tsx)

This is the most complex component. Here's what it does:

```
┌────────────────────────────────────────────────┐
│                SKIA CANVAS                     │
│  ┌──────────────────────────────────────────┐  │
│  │                                          │  │
│  │    [User's handwriting appears here]     │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [Line 1: ✓ green]  [Line 2: ✗ red]  [Line 3] │
│                                                │
│  [Color picker]  [Size picker]  [Eraser]      │
│                                                │
│  [Undo]                    [Next Line →]      │
└────────────────────────────────────────────────┘
```

**Key features:**
1. **Multi-layer drawing** - Each "line" of work is a separate layer
2. **Undo** - Only affects current (unfrozen) layer
3. **Visual feedback** - Previous lines show green/red based on correctness
4. **Tool controls** - Pen color, stroke width, eraser mode

---

## API Call Flow (Step Submission)

When user taps "Next Line":

```javascript
// 1. Capture canvas as PNG
const pngBytes = await snapshotCanvasToPng(canvas);

// 2. Upload to Supabase Storage
await uploadStepPng(userId, attemptId, stepIndex, pngBytes);

// 3. Call OCR to convert handwriting → LaTeX
const { latex } = await invokeOcrLatex(attemptId, stepId, imageBase64);

// 4. Validate the step
const { status, reason } = await invokeSolveStep(prevLatex, latex, problem);

// 5. If wrong, generate and show hint
if (status !== 'correct_useful') {
  const hint = computeHint(status, consecutiveErrors);
  showHint(hint);

  // 6. Optional: Play voice hint
  if (voiceEnabled) {
    const { audioUrl } = await requestHintSpeech(hint.text);
    playAudio(audioUrl);
  }
}
```

---

## Error Handling & Resilience

The app has multiple layers of error handling:

### 1. Retry Logic
```javascript
// OCR has 3 retries with exponential backoff
// Attempt 1: immediate
// Attempt 2: wait 1 second
// Attempt 3: wait 2 seconds
```

### 2. Fallback Chains
```
OCR:        GPT-4o → GPT-4o-mini (if main model fails)
Validation: Direct algebra check → CameraMath → LLM fallback
```

### 3. Timeouts
```
OCR:        55 seconds (images take time to process)
Validation: 20 seconds
```

**Interview explanation:** "External APIs can fail, so I built in retries with exponential backoff and fallback options. If the main OCR fails, we try a simpler model."

---

## File Structure (Key Files)

```
MathMuse/
├── App.tsx                      # Entry point, auth check
├── lib/
│   └── supabase.ts              # Supabase client setup
├── screens/
│   ├── AuthScreen.tsx           # Login/signup
│   ├── LearningPathScreen.tsx   # Category selection
│   ├── LevelSelectionScreen.tsx # Level grid
│   └── ProblemScreen.tsx        # Problem + canvas
├── components/
│   ├── HandwritingCanvas.tsx    # THE BIG ONE - all drawing logic
│   └── ui/                      # Reusable UI components
├── stores/
│   ├── sessionStore.ts          # Auth state
│   ├── progressStore.ts         # User progress
│   └── attemptStore.ts          # Canvas state
├── services/
│   ├── stepOCR.ts               # OCR API calls
│   ├── stepValidate.ts          # Validation API calls
│   ├── hints.ts                 # Hint text generation
│   └── progressService.ts       # Database queries
└── supabase/
    └── functions/
        ├── ocr-latex/           # Handwriting → LaTeX
        ├── solve-step/          # Math validation
        └── tts-speak/           # Text → Voice
```

---

## Common Interview Questions & Answers

### Q: "Walk me through the architecture"
**A:** "It's a React Native mobile app with a Supabase backend. The app has a drawing canvas where students write math. When they submit a line, we send the image to an Edge Function that calls OpenAI to convert it to text, then validates it against the problem. Results come back to show if they're correct, with hints if not."

### Q: "What was the hardest part?"
**A:** "The canvas component. Getting smooth drawing performance required using Skia instead of regular React Native views. Managing multiple layers of work (frozen vs. active strokes) and syncing that with the validation state was tricky."

### Q: "How do you handle security?"
**A:** "Two main things: 1) All AI API keys live in Edge Functions, never in the client. 2) Supabase Row Level Security ensures users can only access their own data at the database level."

### Q: "What would you improve?"
**A:** "Offline support would be great - cache problems locally and sync when back online. Also, the OCR sometimes struggles with messy handwriting, so adding a 'manual entry' fallback would help."

### Q: "How does state management work?"
**A:** "I use Zustand stores - think of them as shared data containers. One for auth state, one for user progress, one for canvas strokes. Components subscribe to just the data they need, so updates are efficient."

---

## Quick Reference: Tech Stack Summary

**Frontend:** React Native + Expo + TypeScript + Skia + Zustand + NativeWind

**Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)

**AI:** OpenAI GPT-4o Vision (OCR) + CameraMath (math validation) + OpenAI TTS (voice)

**Key Patterns:** Edge Functions for secrets, RLS for security, retry logic for resilience, hint escalation for pedagogy
