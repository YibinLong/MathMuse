# MathMuse

> AI-powered handwriting math tutor for tablets — write solutions line-by-line, get instant feedback, and learn with guided hints and voice assistance.

## 🎯 What is MathMuse?

MathMuse is a React Native mobile app that reimagines math learning through handwriting. Students write their solutions step-by-step on a digital canvas, and the app provides real-time feedback on correctness and usefulness, escalating from gentle nudges to detailed hints when needed.

**Key Features:**
- ✍️ **Natural Handwriting Canvas** — Powered by Skia for smooth, stylus-quality drawing
- 🔍 **OCR to LaTeX** — Converts handwritten math to LaTeX using GPT-4o Vision
- ✅ **Step Validation** — Checks each line for correctness and whether it moves the solution forward
- 💡 **Smart Guidance** — Escalating hints (nudge → hint → micro-step) with optional voice feedback
- ☁️ **Cloud Persistence** — Resume attempts anytime with Supabase backend

---

## 🛠️ Tech Stack

### Frontend
- **React Native 0.81** + **Expo** — Modern mobile development with dev client
- **TypeScript** — Type-safe development
- **@shopify/react-native-skia** — High-performance canvas for handwriting
- **NativeWind** — Tailwind CSS for React Native styling
- **Zustand** — Minimal state management
- **expo-av** — Audio playback for voice hints

### Backend & AI
- **Supabase** — Authentication, PostgreSQL database, Storage, Edge Functions
- **OpenAI GPT-4o Vision** — Handwriting OCR to LaTeX
- **CameraMath API** — Math step validation and solving
- **OpenAI TTS** — Text-to-speech for voice hints

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Supabase account (for backend)
- API keys: OpenAI, CameraMath (optional for full features)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YibinLong/MathMuse.git
cd MathMuse
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_DEBUG=true
```

4. **Set up Supabase** (if needed)
- Create a Supabase project at [supabase.com](https://supabase.com)
- Run the schema from `supabase/sql/schema.sql`
- Configure storage bucket named `attempts`
- Deploy Edge Functions from `supabase/functions/`

### Running the App

**Start the development server:**
```bash
npm start
```

**For iOS (requires Mac):**
```bash
npm run ios
```

**For Android:**
```bash
npm run android
```

> **Note:** This app uses Skia which requires native modules. You may need to build a development client:
> ```bash
> npx expo prebuild
> npx expo run:ios  # or run:android
> ```

---

## 📁 Project Structure

```
MathMuse/
├── app/                    # Expo Router screens
├── components/             # Reusable UI components
│   └── HandwritingCanvas.tsx
├── services/               # API and business logic
│   ├── stepExport.ts      # Canvas to PNG export
│   └── stepUpload.ts      # Upload steps to storage
├── stores/                 # Zustand state management
│   └── attemptStore.ts    # Attempts and steps state
├── lib/                    # Utilities and configs
│   └── supabase.ts        # Supabase client setup
├── supabase/              # Backend code
│   ├── functions/         # Edge Functions (OCR, validation, TTS)
│   └── sql/              # Database schema
├── screens/               # Screen components
└── assets/               # Images, icons, fonts
```

---

## 🎨 Current Status

MathMuse is under active development. See [TASK_LIST.md](./TASK_LIST.md) for detailed progress.

**Completed:**
- ✅ Project setup and dependencies
- ✅ Skia drawing canvas with pen/eraser/undo
- ✅ Line guides and step segmentation
- ✅ PNG export and vector path capture
- ✅ Step upload to Supabase Storage
- ✅ Supabase client configuration
- ✅ Edge Function scaffolding

**In Progress:**
- 🟦 Dev client build and device testing
- 🟦 OCR integration with OpenAI Vision
- 🟦 Step validation with CameraMath API
- 🟦 User authentication
- 🟦 Hint system and voice feedback

---

## 🧪 Development

### Useful Commands

```bash
# Start dev server
npm start

# Kill running dev servers on common ports
npm run kill:ports

# Type check
npx tsc --noEmit

# Build dev client
npx expo run:ios
npx expo run:android
```

### Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anonymous key
- `EXPO_PUBLIC_APP_ENV` — Environment (dev/staging/prod)
- `EXPO_PUBLIC_DEBUG` — Enable debug logging

For Edge Functions, configure these in Supabase dashboard:
- `OPENAI_API_KEY` — OpenAI API key
- `CAMERAMATH_API_KEY` — CameraMath API key (optional)

---

## 📝 Documentation

- [PRD.md](./PRD.md) — Full product requirements document
- [TASK_LIST.md](./TASK_LIST.md) — Development roadmap and progress tracker

---

## 🤝 Contributing

This is currently a solo development project, but contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

[MIT License](LICENSE) (or specify your license)

---

## 🙏 Acknowledgments

Inspired by Project Chiron's approach to interactive math tutoring. Built with modern React Native tools and AI-powered learning assistance.

