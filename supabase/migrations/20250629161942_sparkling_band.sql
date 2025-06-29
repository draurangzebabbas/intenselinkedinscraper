-- Create global_linkedin_profiles table
-- This table stores the actual scraped LinkedIn profile data.
-- It is unique by linkedin_url and contains the last_updated timestamp for the profile data itself.
CREATE TABLE IF NOT EXISTS public.global_linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create user_stored_profiles table
-- This table links individual users (identified by their local user_id) to the global profiles they have stored.
-- It allows multiple users to reference the same global profile, and stores user-specific tags.
CREATE TABLE IF NOT EXISTS public.user_stored_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, -- This will store the LocalUser.id from the frontend (e.g., crypto.randomUUID())
  global_profile_id uuid REFERENCES public.global_linkedin_profiles(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}'::text[],
  stored_at timestamptz DEFAULT now(),
  UNIQUE(user_id, global_profile_id) -- Ensures a user can only store a specific global profile once
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_linkedin_profiles_url ON public.global_linkedin_profiles(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_global_linkedin_profiles_updated ON public.global_linkedin_profiles(last_updated);

CREATE INDEX IF NOT EXISTS idx_user_stored_profiles_user_id ON public.user_stored_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stored_profiles_global_profile_id ON public.user_stored_profiles(global_profile_id);
CREATE INDEX IF NOT EXISTS idx_user_stored_profiles_tags ON public.user_stored_profiles USING GIN (tags);

-- Enable Row Level Security (RLS) on both new tables
ALTER TABLE public.global_linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stored_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for global_linkedin_profiles
-- These policies are permissive, allowing any authenticated user to read, insert, or update global profiles.
-- This is suitable for a system where all users contribute to and benefit from a shared pool of profile data.
CREATE POLICY "Authenticated users can read all global profiles"
  ON public.global_linkedin_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert global profiles"
  ON public.global_linkedin_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update global profiles"
  ON public.global_linkedin_profiles
  FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for user_stored_profiles
-- These policies ensure that users can only manage (insert, select, update, delete) their own stored profile links.
-- The `user_id` column in this table is expected to match the `LocalUser.id` from the frontend.
-- Note: For a truly robust multi-user system with Supabase's built-in authentication,
-- `auth.uid()` would typically be used in RLS policies instead of relying on a `user_id` column.
-- However, given the current local authentication setup, this approach relies on the frontend
-- to correctly filter data by `user_id`.
CREATE POLICY "Users can select their own stored profiles"
  ON public.user_stored_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub'); -- This will need to be adjusted if not using Supabase Auth JWT

CREATE POLICY "Users can insert their own stored profiles"
  ON public.user_stored_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own stored profiles"
  ON public.user_stored_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own stored profiles"
  ON public.user_stored_profiles
  FOR DELETE
  TO authenticated
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grant necessary permissions to the `anon` and `authenticated` roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;