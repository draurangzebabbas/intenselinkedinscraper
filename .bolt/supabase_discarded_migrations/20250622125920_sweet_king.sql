/*
  # Complete Authentication and Database Integration

  1. New Tables
    - `users` - User profiles linked to auth.users
    - `apify_keys` - Multiple API keys per user
    - `linkedin_profiles` - Shared profiles with ownership tracking
    - `scraping_jobs` - Track scraping operations

  2. Security
    - Enable RLS on all tables
    - Users can read all profiles but only modify their own
    - Users can only access their own API keys and jobs

  3. Performance
    - Comprehensive indexes for all common queries
    - Optimized for profile sharing and cost reduction
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint after table creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.users 
    ADD CONSTRAINT users_auth_user_id_fkey 
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create apify_keys table for multiple API keys per user
CREATE TABLE IF NOT EXISTS public.apify_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  key_name text NOT NULL,
  api_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key and unique constraint for apify_keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'apify_keys_user_id_fkey'
  ) THEN
    ALTER TABLE public.apify_keys 
    ADD CONSTRAINT apify_keys_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'apify_keys_user_id_key_name_key'
  ) THEN
    ALTER TABLE public.apify_keys 
    ADD CONSTRAINT apify_keys_user_id_key_name_key 
    UNIQUE(user_id, key_name);
  END IF;
END $$;

-- Create linkedin_profiles table (shared between users but with ownership tracking)
CREATE TABLE IF NOT EXISTS public.linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  tags text[] DEFAULT '{}'::text[]
);

-- Add foreign key constraint for linkedin_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'linkedin_profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.linkedin_profiles 
    ADD CONSTRAINT linkedin_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS public.scraping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  apify_key_id uuid,
  job_type text NOT NULL,
  input_url text NOT NULL,
  status text DEFAULT 'pending',
  results_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Add constraints for scraping_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'scraping_jobs_user_id_fkey'
  ) THEN
    ALTER TABLE public.scraping_jobs 
    ADD CONSTRAINT scraping_jobs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'scraping_jobs_apify_key_id_fkey'
  ) THEN
    ALTER TABLE public.scraping_jobs 
    ADD CONSTRAINT scraping_jobs_apify_key_id_fkey 
    FOREIGN KEY (apify_key_id) REFERENCES public.apify_keys(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'scraping_jobs_job_type_check'
  ) THEN
    ALTER TABLE public.scraping_jobs 
    ADD CONSTRAINT scraping_jobs_job_type_check 
    CHECK (job_type = ANY (ARRAY['post_comments'::text, 'profile_details'::text, 'mixed'::text]));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'scraping_jobs_status_check'
  ) THEN
    ALTER TABLE public.scraping_jobs 
    ADD CONSTRAINT scraping_jobs_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text]));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

CREATE INDEX IF NOT EXISTS idx_apify_keys_user_id ON public.apify_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_apify_keys_active ON public.apify_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id ON public.linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_url ON public.linkedin_profiles(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_updated ON public.linkedin_profiles(last_updated);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_tags ON public.linkedin_profiles USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON public.scraping_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON public.scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON public.scraping_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created_at ON public.scraping_jobs(created_at);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apify_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Create RLS policies for apify_keys table
DROP POLICY IF EXISTS "Users can manage own API keys" ON public.apify_keys;
CREATE POLICY "Users can manage own API keys"
  ON public.apify_keys
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for linkedin_profiles table (shared but with ownership)
DROP POLICY IF EXISTS "Users can read all profiles" ON public.linkedin_profiles;
CREATE POLICY "Users can read all profiles"
  ON public.linkedin_profiles
  FOR SELECT
  TO authenticated
  USING (true); -- All users can read all profiles

DROP POLICY IF EXISTS "Users can insert profiles" ON public.linkedin_profiles;
CREATE POLICY "Users can insert profiles"
  ON public.linkedin_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update profiles they own" ON public.linkedin_profiles;
CREATE POLICY "Users can update profiles they own"
  ON public.linkedin_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete profiles they own" ON public.linkedin_profiles;
CREATE POLICY "Users can delete profiles they own"
  ON public.linkedin_profiles
  FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for scraping_jobs table
DROP POLICY IF EXISTS "Users can manage own scraping jobs" ON public.scraping_jobs;
CREATE POLICY "Users can manage own scraping jobs"
  ON public.scraping_jobs
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, username, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the auth process
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_auth_id uuid)
RETURNS public.users AS $$
DECLARE
  user_profile public.users;
  auth_user_data record;
BEGIN
  -- First try to get existing user profile
  SELECT * INTO user_profile FROM public.users WHERE auth_user_id = user_auth_id;
  
  IF user_profile IS NULL THEN
    -- Get user data from auth.users
    SELECT * INTO auth_user_data FROM auth.users WHERE id = user_auth_id;
    
    IF auth_user_data IS NOT NULL THEN
      INSERT INTO public.users (auth_user_id, username, email, full_name)
      VALUES (
        auth_user_data.id,
        COALESCE(auth_user_data.raw_user_meta_data->>'username', split_part(auth_user_data.email, '@', 1)),
        auth_user_data.email,
        COALESCE(auth_user_data.raw_user_meta_data->>'full_name', auth_user_data.raw_user_meta_data->>'first_name' || ' ' || auth_user_data.raw_user_meta_data->>'last_name')
      )
      RETURNING * INTO user_profile;
    END IF;
  END IF;
  
  RETURN user_profile;
EXCEPTION
  WHEN unique_violation THEN
    -- If there's a race condition, try to get the user again
    SELECT * INTO user_profile FROM public.users WHERE auth_user_id = user_auth_id;
    RETURN user_profile;
  WHEN OTHERS THEN
    RAISE WARNING 'Error in get_or_create_user_profile: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;