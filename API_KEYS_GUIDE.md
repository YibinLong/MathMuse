# 🔑 API Keys - Quick Reference

## Where to Put Each API Key

### ✅ IN YOUR `.env` FILE (Client-Side)

**Location:** `/Users/yibin/Documents/WORKZONE/VSCODE/GAUNTLET_AI/4_Week/MathMuse/.env`

**Copy the `.env.example` file and fill it in:**

```bash
# Copy the example file
cp .env.example .env
```

**Your `.env` file should look EXACTLY like this:**

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-actual-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI...
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_DEBUG=true
```

**Where to get these:**
1. Go to [supabase.com](https://supabase.com)
2. Open your project (or create one)
3. Click **Settings** ⚙️ → **API**
4. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

### ✅ IN SUPABASE DASHBOARD (Server-Side)

**⚠️ CRITICAL: OpenAI API key goes on the SERVER, NOT in your .env file!**

#### **How to Add OpenAI Key to Supabase:**

**Method 1: Via Dashboard (Easiest)**
1. Go to your Supabase project dashboard
2. Click **Edge Functions** in the left sidebar
3. Click **Settings** or **Manage secrets**
4. Add a new secret:
   - **Secret name**: `OPENAI_API_KEY`
   - **Secret value**: `sk-proj-...` (your OpenAI key)
5. Click **Save**

**Method 2: Via CLI**
```bash
# Login to Supabase
supabase login

# Link your project (get project-ref from Supabase dashboard → Settings → General)
supabase link --project-ref your-project-id

# Set the secret
supabase secrets set OPENAI_API_KEY=sk-proj-your-actual-key-here
```

**Where to get OpenAI key:**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-proj-...`)
4. **Add credits** to your OpenAI account at [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)

---

## 📋 Complete Checklist

### Step 1: Create `.env` file
- [ ] Copy `.env.example` to `.env`
- [ ] Add `EXPO_PUBLIC_SUPABASE_URL` (from Supabase dashboard)
- [ ] Add `EXPO_PUBLIC_SUPABASE_ANON_KEY` (from Supabase dashboard)

### Step 2: Configure Supabase
- [ ] Create Supabase project (if not done)
- [ ] Run SQL schema from `supabase/sql/schema.sql`
- [ ] Create storage bucket named `attempts`

### Step 3: Configure OpenAI in Supabase
- [ ] Get OpenAI API key from platform.openai.com
- [ ] Add `OPENAI_API_KEY` secret in Supabase Edge Functions
- [ ] Add credits to OpenAI account ($5-10 minimum)

### Step 4: Deploy Edge Functions
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-id

# Deploy OCR function
supabase functions deploy ocr-latex
```

### Step 5: Install Dependencies & Run
```bash
# Install packages
npm install

# Start the app
npm start

# Run on device
npm run ios    # for iOS
npm run android  # for Android
```

---

## 🐛 Quick Troubleshooting

### "Missing Supabase credentials"
- ❌ Check: `.env` file exists and has correct values
- ✅ Fix: Create `.env` file and add Supabase URL and anon key
- ⚠️ **Important:** Restart the dev server after creating/editing `.env`

### "OPENAI_API_KEY not set"
- ❌ Check: OpenAI key is in Supabase secrets (NOT in `.env`)
- ✅ Fix: Add `OPENAI_API_KEY` to Supabase Edge Functions secrets

### OCR times out (no response)
- ❌ Check: Edge function deployed
- ✅ Fix: Run `supabase functions deploy ocr-latex`

### "Insufficient credits"
- ❌ Check: OpenAI account has credits
- ✅ Fix: Add credits at [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)

---

## 🎯 Summary Table

| API Key | Location | Why |
|---------|----------|-----|
| **Supabase URL** | `.env` file | Tells app where backend is |
| **Supabase Anon Key** | `.env` file | Authenticates app with backend (public, safe) |
| **OpenAI API Key** | Supabase Edge Functions Secrets | Used by server to call OpenAI (private, costs $) |

---

## ⚠️ Security Rules

✅ **SAFE to put in .env:**
- Supabase URL
- Supabase Anon Key

❌ **NEVER put in .env:**
- OpenAI API Key (costs money!)
- Supabase Service Role Key (if you have one)
- Database passwords

💡 **Why?**
- The `.env` file is bundled into your app
- Anyone can extract it from the app binary
- OpenAI keys cost money - keep them server-side only!
- Supabase anon key is designed to be public (protected by RLS)

---

## 🔄 After Changing Keys

**If you change `.env`:**
1. Stop the dev server (Ctrl+C)
2. Run `npm start` again

**If you change Supabase secrets:**
1. No need to restart your app
2. Changes take effect immediately

---

## ✅ Verify Setup

**1. Check .env file exists:**
```bash
cat .env
# Should show your EXPO_PUBLIC_* vars
```

**2. Check Supabase secrets:**
```bash
supabase secrets list
# Should show OPENAI_API_KEY
```

**3. Check Edge Function deployed:**
```bash
supabase functions list
# Should show ocr-latex
```

---

Need more help? See the full [SETUP_GUIDE.md](./SETUP_GUIDE.md)

