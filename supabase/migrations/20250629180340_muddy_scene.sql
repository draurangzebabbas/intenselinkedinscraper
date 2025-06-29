/*
  # Step 4: Create Global LinkedIn Profiles Table

  This migration creates the global profiles table that stores all scraped LinkedIn data.

  ## What this does:
  - Creates global_linkedin_profiles table (shared between all users)
  - Stores profile data as JSONB for flexibility
  - Uses linkedin_url as unique identifier
  - Tracks when profiles were last updated
  - Adds performance indexes
*/

-- Create global_linkedin_profiles table (stores all scraped data)
CREATE TABLE IF NOT EXISTS public.global_linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_linkedin_profiles_url ON public.global_linkedin_profiles(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_global_linkedin_profiles_updated ON public.global_linkedin_profiles(last_updated);