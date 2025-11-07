# 🚀 MathMuse Setup Guide

Complete guide to set up MathMuse from scratch and fix the OCR issue.

---

## 📋 Prerequisites

1. Node.js 18+ installed
2. Expo CLI (`npm install -g expo-cli`)
3. A Supabase account ([supabase.com](https://supabase.com))
4. An OpenAI account ([platform.openai.com](https://platform.openai.com))

---

## 🔧 Step-by-Step Setup

### **Step 1: Create a Supabase Project**

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `MathMuse` (or whatever you like)
   - **Database Password**: Create a strong password (save it somewhere safe!)
   - **Region**: Choose closest to you
4. Click **"Create new project"** and wait ~2 minutes

---

### **Step 2: Get Your Supabase Credentials**

1. In your Supabase project, click **Settings** (⚙️ icon) in the left sidebar
2. Click **"API"**
3. You'll see two important values:
   - **Project URL** (example: `https://abcdefgh.supabase.co`)
   - **Project API keys** → Copy the **`anon`** **`public`** key (starts with `eyJ...`)

**Keep these handy - you'll need them next!**

---

### **Step 3: Create Your `.env` File**

1. In your MathMuse project folder, **copy** the `.env.example` file:
   ```bash
   cp .env.example .env
   ```

2. **Open** the new `.env` file and replace the placeholder values:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   EXPO_PUBLIC_APP_ENV=dev
   EXPO_PUBLIC_DEBUG=true
   ```

3. **Save** the file

---

### **Step 4: Set Up the Supabase Database**

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/sql/schema.sql` in your project
4. **Copy all the SQL code** from that file
5. **Paste** it into the Supabase SQL Editor
6. Click **"Run"** (or press `Ctrl/Cmd + Enter`)

This creates the necessary tables: `problems`, `attempts`, and `attempt_steps`.

---

### **Step 5: Set Up Supabase Storage**

1. In your Supabase dashboard, click **"Storage"** in the left sidebar
2. Click **"Create a new bucket"**
3. Fill in:
   - **Name**: `attempts`
   - **Public**: Leave it **OFF** (private bucket)
4. Click **"Create bucket"**

---

### **Step 6: Get Your OpenAI API Key**

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in (or create an account)
3. Click **"Create new secret key"**
4. Give it a name like `MathMuse OCR`
5. **Copy the key** (starts with `sk-...`) - you won't be able to see it again!

**⚠️ IMPORTANT:** You need to add credits to your OpenAI account for the API to work:
- Go to [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)
- Add at least $5-10 to start

---

### **Step 7: Configure OpenAI Key in Supabase (CRITICAL!)**

**This is where most people get stuck!** The OpenAI key needs to be on the **server** (Supabase Edge Functions), **NOT** in your `.env` file.

#### **Option A: Via Supabase Dashboard (Easier)**
1. In your Supabase dashboard, click **"Edge Functions"** in the left sidebar
2. Click **"Settings"** or **"Manage secrets"**
3. Add a new secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-...` (paste your OpenAI key)
4. Click **"Save"**

#### **Option B: Via Supabase CLI**
```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-id

# Set the secret
supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here
```

---

### **Step 8: Deploy Edge Functions**

The OCR code lives in a "serverless function" that runs on Supabase's servers. You need to deploy it:

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project** (get project-ref from Settings → General):
   ```bash
   supabase link --project-ref your-project-id
   ```

4. **Deploy the OCR function**:
   ```bash
   supabase functions deploy ocr-latex
   ```

   You should see:
   ```
   ✓ Function deployed successfully
   ```

---

### **Step 9: Install Dependencies**

Make sure all packages are installed:

```bash
npm install
```

---

### **Step 10: Start the App**

1. **Start the Expo dev server**:
   ```bash
   npm start
   ```

2. **Run on iOS** (Mac only):
   ```bash
   npm run ios
   ```

3. **Or run on Android**:
   ```bash
   npm run android
   ```

---

## ✅ Testing the OCR

1. **Sign up** in the app (create an account)
2. **Draw something** on the canvas (write a simple equation like `2 + 2 = 4`)
3. **Click "Next Line"**
4. **Wait ~5-10 seconds**
5. You should see:
   - OCR panel at the bottom showing the LaTeX
   - Confidence score
   - Option to edit the result

---

## 🐛 Troubleshooting

### **OCR still not working?**

**Check the console logs:**
```bash
# In your terminal where Expo is running, you'll see logs
# Look for:
[commit] invoking OCR…
```

**Common issues:**

1. **"OPENAI_API_KEY not set"**
   - ❌ You forgot Step 7 - add the key to Supabase secrets
   - Run: `supabase secrets set OPENAI_API_KEY=sk-...`

2. **"Invalid API key"**
   - ❌ Your OpenAI key is wrong or expired
   - Check your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

3. **"Insufficient credits"**
   - ❌ Your OpenAI account has no credits
   - Add credits at [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)

4. **OCR times out (no response after 60 seconds)**
   - ❌ Edge function not deployed
   - Run: `supabase functions deploy ocr-latex`

5. **"Missing Supabase credentials"**
   - ❌ Your `.env` file is missing or wrong
   - Check Step 3 - make sure `.env` exists and has correct values
   - **Restart the dev server** after changing `.env`

---

## 📚 What Each File Does

### **Client-Side (Your App)**
- `.env` → Stores Supabase URL and anon key (client credentials)
- `lib/supabase.ts` → Creates Supabase client for your app
- `services/stepOCR.ts` → Calls the OCR Edge Function
- `components/HandwritingCanvas.tsx` → Main drawing UI

### **Server-Side (Supabase)**
- `supabase/functions/ocr-latex/index.ts` → The OCR Edge Function (runs on Supabase servers)
- `OPENAI_API_KEY` in Supabase secrets → Used by the Edge Function to call OpenAI

---

## 🎯 Summary: Where Each Key Goes

| Key | Where It Goes | Why |
|-----|---------------|-----|
| **Supabase URL** | `.env` file → `EXPO_PUBLIC_SUPABASE_URL` | Tells your app where your Supabase backend is |
| **Supabase Anon Key** | `.env` file → `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Lets your app authenticate with Supabase (public, safe to use in app) |
| **OpenAI API Key** | Supabase Dashboard → Edge Functions → Secrets | Used by server-side OCR function to call OpenAI (NEVER put in `.env`!) |

---

## 🔐 Security Notes

1. ✅ **SAFE in `.env`**: Supabase URL and Anon Key (these are public)
2. ❌ **NEVER in `.env`**: OpenAI API Key (this costs money - keep it server-side only!)
3. ✅ **Gitignored**: `.env` is already in `.gitignore` - it won't be committed to Git

---

## 📞 Need Help?

If you're still stuck:
1. Check the **console logs** for error messages
2. Verify each step above carefully
3. Make sure you **restarted the dev server** after changing `.env`

Good luck! 🚀
