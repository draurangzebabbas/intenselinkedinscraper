-- Simple table creation script (run this in Supabase SQL Editor if migration fails)

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create global_linkedin_profiles table
CREATE TABLE IF NOT EXISTS public.global_linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create user_stored_profiles table
CREATE TABLE IF NOT EXISTS public.user_stored_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  global_profile_id uuid REFERENCES public.global_linkedin_profiles(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}'::text[],
  stored_at timestamptz DEFAULT now(),
  UNIQUE(user_id, global_profile_id)
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stored_profiles ENABLE ROW LEVEL SECURITY;

-- Create basic policies (allow all for now)
CREATE POLICY "Allow all for users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all for global profiles" ON public.global_linkedin_profiles FOR ALL USING (true);
CREATE POLICY "Allow all for user stored profiles" ON public.user_stored_profiles FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;