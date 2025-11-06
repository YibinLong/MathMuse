-- Storage policies for 'attempts' bucket
-- Run this in Supabase SQL Editor to fix "row-level security policy" error

-- Allow users to read their own attempt files
create policy "Users can read their own attempt files"
  on storage.objects for select
  using ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Allow users to upload their own attempt files
create policy "Users can insert their own attempt files"
  on storage.objects for insert
  with check ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Allow users to update their own attempt files
create policy "Users can update their own attempt files"
  on storage.objects for update
  using ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Allow users to delete their own attempt files
create policy "Users can delete their own attempt files"
  on storage.objects for delete
  using ( bucket_id = 'attempts' AND (storage.foldername(name))[1] = auth.uid()::text );

