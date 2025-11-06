-- MathMuse schema per PRD.md Section 11
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

-- Storage policies for 'attempts' bucket
-- Allow users to upload/read/update their own files (path starts with user_id)
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


