# Handwriting Math App - API & Architecture Quick Reference

## APIs Used

| API | Purpose | Endpoint | Auth |
|-----|---------|----------|------|
| **MyScript Cloud** | Handwriting → LaTeX | `cloud.myscript.com/api/v4.0/iink` | App Key + HMAC |
| **CameraMath/UpStudy** | Math validation | `api.cameramath.com/v1` | API Key header |
| **ElevenLabs** | Text-to-speech hints | `api.elevenlabs.io/v1` | xi-api-key header |
| **Supabase** | Cloud sync + auth | `nhadlfbxbivlhtkbolve.supabase.co` | Anon Key + JWT |
| **Sentry** | Error tracking | Via DSN | DSN |

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INPUT                               │
│              Stylus/Touch on HandwritingCanvas                   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CANVAS STORE (Zustand)                                          │
│  • Stores strokes (max 500)  • GPU rendering via Skia           │
│  • Pause detection (650ms)   • Broadcasts to peers              │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  MYSCRIPT CLOUD API                                              │
│  • Converts strokes → LaTeX  • 85% confidence threshold         │
│  • 500ms debounce            • Returns LaTeX + MathML           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  VALIDATION STORE → CAMERAMATH API                               │
│  • Check MMKV cache first    • isCorrect + isUseful              │
│  • 30 req/min rate limit     • Error classification              │
│  • Returns feedback + hints  • Caches results locally            │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  HINT STORE                    │  PROGRESS STORE                 │
│  • Progressive escalation      │  • Tracks attempts/steps        │
│  • concept → direction → micro │  • Analytics & stats            │
│  • Auto-hint on 2+ errors      │  • Session management           │
└────────────────────────────────┴─────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  UI FEEDBACK                                                     │
│  • ValidationFeedback component  • HintReveal with TTS           │
│  • Reanimated 3 animations       • Success celebration           │
└─────────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PERSISTENCE & SYNC                                              │
│  • MMKV local storage (20x faster than AsyncStorage)             │
│  • Supabase real-time sync for collaboration                     │
│  • Offline queue with retry                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| Layer | File | Purpose |
|-------|------|---------|
| **Input** | `app/components/HandwritingCanvas.tsx` | Skia canvas, stroke capture |
| **Recognition** | `app/utils/myScriptClient.ts` | MyScript API integration |
| **Validation** | `app/utils/mathValidation.ts` | CameraMath API + logic |
| **State** | `app/stores/canvasStore.ts` | Stroke management |
| **State** | `app/stores/validationStore.ts` | Validation results |
| **State** | `app/stores/hintStore.ts` | Hint escalation |
| **State** | `app/stores/progressStore.ts` | Attempt tracking |
| **Sync** | `app/utils/sync/supabaseClient.ts` | Cloud persistence |

---

## Performance Targets

- **Canvas**: 60+ FPS (Skia GPU), 120 FPS on modern devices
- **Recognition**: ~2s after 650ms pause
- **Validation**: <2s end-to-end (instant if cached)
- **Storage**: MMKV - synchronous, encrypted, 20x faster
