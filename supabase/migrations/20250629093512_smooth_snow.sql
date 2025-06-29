-- Simple migration for storing scraped profiles only
-- This is the only table needed for the offline-first version

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create linkedin_profiles table for central storage
CREATE TABLE IF NOT EXISTS public.linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, -- Simple text ID from local storage
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  tags text[] DEFAULT '{}'::text[]
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id ON public.linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_url ON public.linkedin_profiles(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_updated ON public.linkedin_profiles(last_updated);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_tags ON public.linkedin_profiles USING GIN (tags);

-- Enable RLS (but allow all operations for simplicity)
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for all operations
CREATE POLICY "Allow all operations on profiles"
  ON public.linkedin_profiles
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;