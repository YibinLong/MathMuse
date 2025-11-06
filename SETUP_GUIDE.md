# 🚀 Quick Setup Guide - Fixing "Next Line" and Authentication

## ✅ What Was Fixed

### Bug Fix #1: Strokes Now Freeze Immediately
**Problem:** When you pressed "Next Line," if the upload failed (no auth), strokes weren't frozen. You could undo everything.

**Solution:** I moved the `commitStepLocal()` call to run **before** any async operations. Now strokes freeze immediately when you press "Next Line," regardless of whether Supabase upload succeeds.

**Code change in `HandwritingCanvas.tsx`:**
```typescript
// OLD: commitStepLocal() only ran if upload succeeded
const { userId, attemptId } = await ensureAttemptId();
const { stepIndex: idx, vectorJson } = commitStepLocal(); // ← could error before this

// NEW: commitStepLocal() runs FIRST, before any async operations
const { stepIndex: idx, vectorJson } = commitStepLocal(); // ← happens immediately
// ... then upload happens ...
```

### Bug Fix #2: Authentication Added
**Problem:** No way to log in, so "No authenticated user" error occurred.

**Solution:** Created an `AuthScreen` component that lets you sign in/sign up with email and password.

---

## 📋 Setup Steps (Do This Now!)

### Step 1: Create `.env` File

In your project root, create a file named `.env` with this content:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_DEBUG=true
```

### Step 2: Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and sign in (or create account)
2. Create a new project (or use existing)
3. Go to **Settings** → **API**
4. Copy **Project URL** → replace `your_supabase_url` in `.env`
5. Copy **anon/public key** → replace `your_supabase_anon_key` in `.env`

### Step 3: Run Database Schema

In your Supabase dashboard:
1. Go to **SQL Editor**
2. Click **New query**
3. Copy and paste the SQL from `supabase/sql/schema.sql`
4. Click **Run**

### Step 4: Create Storage Bucket

In your Supabase dashboard:
1. Go to **Storage**
2. Click **New bucket**
3. Name it: `attempts`
4. Privacy: **Private** (recommended)
5. Click **Create bucket**

### Step 4.5: Add Storage Policies

Go back to **SQL Editor** and run this to allow users to upload their own files:

```sql
-- Storage policies for 'attempts' bucket
create policy "Users can read their own attempt files"
  on storage.objects for select
  using ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );

create policy "Users can insert their own attempt files"
  on storage.objects for insert
  with check ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );

create policy "Users can update their own attempt files"
  on storage.objects for update
  using ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );

create policy "Users can delete their own attempt files"
  on storage.objects for delete
  using ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );
```

**What this does:** These policies allow users to upload/read/update/delete files ONLY in their own folder (path starts with their user_id).

### Step 5: Enable Email Authentication

In your Supabase dashboard:
1. Go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it should be by default)

### Step 6: Restart Your App

```bash
# Stop your current dev server (Ctrl+C)
# Then restart:
npm start
```

### Step 7: Sign Up & Test!

1. When the app loads, you'll see the **login screen**
2. Click "Don't have an account? Sign Up"
3. Enter any email (e.g., `test@test.com`) and password (min 6 chars)
4. Click **Sign Up**
5. Then **Sign In** with those credentials
6. You should now see the HandwritingCanvas!

---

## 🧪 Testing "Next Line" Behavior

Now test the freeze functionality:

1. **Draw some strokes** (let's call them A and B)
2. **Press "Next Line"**
   - ✅ Strokes should freeze (move to committed layer)
   - ✅ You should see: `Saved step 0 → <user_id>/<attempt_id>/0.png`
3. **Draw more strokes** (let's call them C and D)
4. **Press Undo twice**
   - ✅ Should remove D, then C
   - ❌ Should NOT remove A or B (they're frozen!)
5. **Press "Next Line" again**
   - ✅ Current strokes freeze
   - ✅ Step counter increments

---

## 🐛 Troubleshooting

### "Invalid API key" or connection errors
- Make sure you created the `.env` file
- Make sure you copied the correct URL and key from Supabase
- Restart your app after creating `.env`

### "Policy violation" errors
- Make sure you ran the SQL schema (Step 3)
- The schema includes Row Level Security policies that allow users to access their own data

### Still seeing "No authenticated user"
- Make sure you signed up and logged in
- Check the console - you should see a session object if logged in

### Can't see PNGs in storage
- Go to Supabase → **Storage** → **attempts** bucket
- You should see folders like: `<user_id>/<attempt_id>/0.png`

---

## 📚 What Each Piece Does (Beginner Explanation)

### AuthScreen.tsx
- **What**: A login/signup form
- **Why**: Supabase needs to know who you are to save your data securely
- **How**: Uses `supabase.auth.signInWithPassword()` to log you in

### App.tsx Changes
- **What**: Checks if you're logged in when app starts
- **Why**: We only show the canvas if you're authenticated
- **How**: 
  - `getSession()` checks current login status
  - `onAuthStateChange()` listens for login/logout events
  - Shows `AuthScreen` if not logged in, `HandwritingCanvas` if logged in

### HandwritingCanvas.tsx Changes
- **What**: Moved `commitStepLocal()` to run first
- **Why**: So strokes freeze even if upload fails
- **How**: Now executes in this order:
  1. Freeze strokes (commitStepLocal)
  2. Take snapshot
  3. Upload to Supabase
  4. If upload fails, strokes are still frozen!

### attemptStore.ts Changes
- **What**: Added console logs to undo/commit functions
- **Why**: For debugging - shows you what's happening
- **How**: Logs activeStrokes count, committedLayers count, etc.

---

## ✨ Expected Behavior After Setup

1. **App opens** → Login screen appears
2. **You sign in** → HandwritingCanvas appears
3. **You draw** → Strokes appear in real-time
4. **You press "Next Line"** → 
   - Strokes freeze immediately
   - PNG uploads to Supabase
   - Success message appears
   - Active layer clears for next step
5. **You press Undo** → Only removes strokes from current active layer
6. **Frozen strokes** → Cannot be undone (they're committed!)

---

Need help? Check the console logs - they'll show you what's happening at each step!

