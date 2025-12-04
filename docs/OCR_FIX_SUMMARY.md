# 🔧 OCR Issue - Fix Summary

## 🎯 What Was Wrong

The OCR wasn't working because:

1. **Missing `.env` file** - Your app didn't have Supabase credentials configured
2. **Missing OpenAI API key on server** - The Edge Function needs this to call OpenAI
3. **Environment variables not being loaded** - The `app.config.ts` wasn't passing env vars to the app
4. **Missing dependency** - `expo-constants` package wasn't installed

---

## ✅ What I Fixed

### **1. Updated `app.config.ts`**
- **WHY**: Now loads environment variables from `.env` file
- **WHAT CHANGED**: Added `extra` section to pass `EXPO_PUBLIC_*` variables to the app

### **2. Updated `lib/supabase.ts`**
- **WHY**: Now properly reads Supabase credentials from the config
- **WHAT CHANGED**: Uses `Constants.expoConfig.extra` to access env vars
- **ADDED**: Clear error messages if credentials are Rmissing

### **3. Updated `components/HandwritingCanvas.tsx`**
- **WHY**: Debug mode now works properly
- **WHAT CHANGED**: Uses `Constants` to read debug flag

### **4. Updated `services/stepOCR.ts`**
- **WHY**: Better error logging to help diagnose issues
- **WHAT CHANGED**: Added detailed console logs at each step
- **FIXED**: Removed invalid `responseType` parameter

### **5. Updated `supabase/functions/ocr-latex/index.ts`**
- **WHY**: Better error logging on the server side
- **WHAT CHANGED**: Added detailed console logs
- **ADDED**: Clear error message if `OPENAI_API_KEY` is missing

### **6. Updated `package.json`**
- **WHY**: Added missing dependency
- **WHAT CHANGED**: Added `expo-constants` ~18.0.0

### **7. Created Documentation**
- **SETUP_GUIDE.md** - Complete step-by-step setup guide
- **API_KEYS_GUIDE.md** - Quick reference for API keys
- **.env.example** - Template for your `.env` file

---

## 📋 What YOU Need to Do Now

### **Step 1: Create `.env` file** ⚠️ REQUIRED

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Get your Supabase credentials:**
   - Go to [supabase.com](https://supabase.com)
   - Open your project (or create one if you haven't)
   - Click **Settings** ⚙️ → **API**
   - Copy these values:
     - **Project URL** (example: `https://abcdefgh.supabase.co`)
     - **anon public key** (starts with `eyJ...`)

3. **Edit `.env` file** and paste your values:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   EXPO_PUBLIC_APP_ENV=dev
   EXPO_PUBLIC_DEBUG=true
   ```

---

### **Step 2: Set Up OpenAI API Key in Supabase** ⚠️ REQUIRED

**Important:** The OpenAI key goes **on the server** (Supabase), **NOT** in your `.env` file!

1. **Get OpenAI API key:**
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Click **"Create new secret key"**
   - Copy the key (starts with `sk-proj-...`)
   - **Add credits** ($5-10 minimum) at [billing page](https://platform.openai.com/settings/organization/billing)

2. **Add it to Supabase:**
   
   **Option A: Via Dashboard (Easier)**
   - In Supabase dashboard, click **Edge Functions**
   - Click **Settings** or **Manage secrets**
   - Add new secret:
     - Name: `OPENAI_API_KEY`
     - Value: `sk-proj-your-key-here`
   - Click **Save**

   **Option B: Via CLI**
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here
   ```

---

### **Step 3: Deploy Edge Functions** ⚠️ REQUIRED

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (get project-ref from Supabase dashboard → Settings → General)
supabase link --project-ref your-project-id

# Deploy the OCR function
supabase functions deploy ocr-latex
```

---

### **Step 4: Install Dependencies**

```bash
npm install
```

---

### **Step 5: Start the App**

```bash
# Restart the dev server (important after changing .env!)
npm start

# Then run on your device
npm run ios    # for iOS
# or
npm run android  # for Android
```

---

## 🧪 Testing the OCR

1. Open the app
2. Sign up / Log in
3. Draw something simple (like `2 + 2 = 4`)
4. Click **"Next Line"**
5. Watch the console logs - you should see:
   ```
   [OCR] Starting OCR request for stepId: ...
   [OCR] Attempt 1/3 - Invoking ocr-latex function...
   [OCR] Success! LaTeX: 2 + 2 = 4 Confidence: 0.95
   ```
6. The OCR panel at the bottom should show the LaTeX result

---

## 🐛 Troubleshooting

### **Console shows: "Missing Supabase credentials"**
- ❌ You didn't create the `.env` file
- ✅ **Fix:** Go to Step 1 above

### **Console shows: "OPENAI_API_KEY not set"**
- ❌ You didn't add the OpenAI key to Supabase secrets
- ✅ **Fix:** Go to Step 2 above

### **OCR times out after 55 seconds**
- ❌ Edge function not deployed
- ✅ **Fix:** Go to Step 3 above and deploy the function

### **"Insufficient credits" error**
- ❌ Your OpenAI account has no credits
- ✅ **Fix:** Add credits at [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)

### **Still not working?**

Check the **complete logs** in your terminal where you ran `npm start`. Look for:
- `[OCR]` tags - these show the client-side OCR flow
- Edge Function logs - these show what's happening on the server

You can also check Edge Function logs in Supabase:
- Go to your Supabase dashboard
- Click **Edge Functions**
- Click **ocr-latex**
- Click **Logs** tab

---

## 📚 Reference Documents

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Full step-by-step setup guide
- **[API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md)** - Quick reference for where to put each API key
- **.env.example** - Template for your `.env` file

---

## 🎯 Quick Checklist

Before running the app, make sure you have:

- [ ] Created `.env` file with Supabase URL and anon key
- [ ] Created Supabase project
- [ ] Run the database schema (`supabase/sql/schema.sql`)
- [ ] Created `attempts` storage bucket in Supabase
- [ ] Got OpenAI API key
- [ ] Added OpenAI key to Supabase Edge Functions secrets
- [ ] Added credits to OpenAI account
- [ ] Deployed `ocr-latex` Edge Function
- [ ] Installed dependencies (`npm install`)
- [ ] Restarted dev server

---

## 💡 Understanding the Flow

**When you click "Next Line":**

1. **Client** (your app):
   - Saves the drawing as PNG
   - Uploads PNG to Supabase Storage
   - Converts PNG to base64
   - Calls `invokeOcrLatex()` in `services/stepOCR.ts`

2. **`services/stepOCR.ts`**:
   - Calls the Supabase Edge Function `ocr-latex`
   - Sends the base64 image
   - Waits for response (with timeout and retries)

3. **Edge Function** (`supabase/functions/ocr-latex/index.ts`):
   - Runs on Supabase's servers (Deno runtime)
   - Gets `OPENAI_API_KEY` from environment
   - Calls OpenAI GPT-4o Vision API
   - Parses the LaTeX response
   - Returns `{ latex, confidence }` to the client

4. **Client** receives result:
   - Displays LaTeX in the OCR panel
   - Shows confidence score
   - Allows editing if needed
   - Saves to database

**Key Point:** The OpenAI API call happens **on the server** (Edge Function), not in your app. This keeps your API key safe and prevents users from extracting it.

---

## 🔐 Security Notes

✅ **SAFE in `.env` (public, built into app):**
- Supabase URL
- Supabase Anon Key

❌ **NEVER in `.env` (costs money!):**
- OpenAI API Key ← Goes in Supabase Edge Functions secrets
- Supabase Service Role Key (if you have one)

The `.env` file is already in `.gitignore` - it won't be committed to Git.

---

Good luck! 🚀 If you follow these steps carefully, your OCR should work perfectly.


