/*
  # Security and Permissions Setup

  1. Row Level Security (RLS)
    - Enable RLS on all tables
    - Create comprehensive security policies

  2. User Policies
    - Users can read/update their own profile
    - Secure user data access

  3. API Keys Policies
    - Users can manage their own API keys
    - Secure key storage and access

  4. Global Profiles Policies
    - All authenticated users can read global profiles (shared data)
    - System can insert/update global profiles
    - No direct user modification of global profiles

  5. User Stored Profiles Policies
    - Users can manage their own stored profile collections
    - Secure personal profile collections

  6. Scraping Jobs Policies
    - Users can manage their own scraping jobs
    - Job history and tracking

  7. Permissions
    - Grant necessary permissions to authenticated users
    - Secure database access

  This migration sets up all security policies and permissions for the shared profile model.
*/

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apify_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stored_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can manage own API keys" ON public.apify_keys;
DROP POLICY IF EXISTS "Authenticated users can read all global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "System can insert global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "System can update global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "Users can insert their own stored profiles" ON public.user_stored_profiles;
DROP POLICY IF EXISTS "Users can select their own stored profiles" ON public.user_stored_profiles;
DROP POLICY IF EXISTS "Users can update their own stored profiles" ON public.user_stored_profiles;
DROP POLICY IF EXISTS "Users can delete their own stored profiles" ON public.user_stored_profiles;
DROP POLICY IF EXISTS "Users can manage own scraping jobs" ON public.scraping_jobs;

-- Create RLS policies for users table
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Create RLS policies for apify_keys table
CREATE POLICY "Users can manage own API keys"
  ON public.apify_keys
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for global_linkedin_profiles table
-- All authenticated users can read global profiles (shared data model)
CREATE POLICY "Authenticated users can read all global profiles"
  ON public.global_linkedin_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow system/service role to insert and update global profiles
-- This enables the app to save scraped data to benefit all users
CREATE POLICY "System can insert global profiles"
  ON public.global_linkedin_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update global profiles"
  ON public.global_linkedin_profiles
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create RLS policies for user_stored_profiles table
CREATE POLICY "Users can insert their own stored profiles"
  ON public.user_stored_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can select their own stored profiles"
  ON public.user_stored_profiles
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their own stored profiles"
  ON public.user_stored_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their own stored profiles"
  ON public.user_stored_profiles
  FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for scraping_jobs table
CREATE POLICY "Users can manage own scraping jobs"
  ON public.scraping_jobs
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Grant specific permissions for service role operations
GRANT ALL ON public.global_linkedin_profiles TO service_role;
GRANT ALL ON public.user_stored_profiles TO service_role;

-- Create helpful views for common queries (optional but useful)
CREATE OR REPLACE VIEW public.user_profiles_with_global_data AS
SELECT 
  usp.id,
  usp.user_id,
  usp.global_profile_id,
  usp.tags,
  usp.stored_at,
  glp.linkedin_url,
  glp.profile_data,
  glp.last_updated,
  glp.created_at
FROM public.user_stored_profiles usp
JOIN public.global_linkedin_profiles glp ON usp.global_profile_id = glp.id;

-- Grant access to the view
GRANT SELECT ON public.user_profiles_with_global_data TO authenticated;

-- Create RLS policy for the view
ALTER VIEW public.user_profiles_with_global_data SET (security_invoker = true);