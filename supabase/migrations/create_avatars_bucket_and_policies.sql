/*
  # Create avatars storage bucket and RLS policies

  1. New Storage Bucket
    - `avatars` (public)
  2. Security
    - Enable RLS on `avatars` bucket
    - Add policies for authenticated users to:
      - Select their own avatar (path: `user_id/avatar_filename`)
      - Insert their own avatar
      - Update their own avatar
      - Delete their own avatar
*/

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security for the avatars bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view their own avatars
CREATE POLICY "Allow authenticated users to view their own avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy for authenticated users to upload their own avatars
CREATE POLICY "Allow authenticated users to upload their own avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy for authenticated users to update their own avatars
CREATE POLICY "Allow authenticated users to update their own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy for authenticated users to delete their own avatars
CREATE POLICY "Allow authenticated users to delete their own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);