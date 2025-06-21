/*
  # Create LinkedIn Scraper Database Tables

  1. New Tables
    - `linkedin_profiles`
      - `id` (uuid, primary key)
      - `linkedin_url` (text, unique)
      - `profile_data` (jsonb)
      - `last_updated` (timestamp)
      - `created_at` (timestamp)
    - `scraping_jobs`
      - `id` (uuid, primary key)
      - `job_type` (text with constraints)
      - `input_url` (text)
      - `status` (text with constraints)
      - `results_count` (integer)
      - `error_message` (text)
      - `created_at` (timestamp)
      - `completed_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated and anonymous users

  3. Performance
    - Add indexes on frequently queried columns
*/

-- Create linkedin_profiles table
CREATE TABLE IF NOT EXISTS public.linkedin_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    linkedin_url text UNIQUE NOT NULL,
    profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_updated timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS public.scraping_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type text NOT NULL CHECK (job_type = ANY (ARRAY['post_comments'::text, 'profile_details'::text, 'mixed'::text])),
    input_url text NOT NULL,
    status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])),
    results_count integer DEFAULT 0,
    error_message text,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_url ON public.linkedin_profiles USING btree (linkedin_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_updated ON public.linkedin_profiles USING btree (last_updated);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON public.scraping_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON public.scraping_jobs USING btree (job_type);

-- Drop existing policies if they exist to avoid conflicts
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'linkedin_profiles' 
        AND policyname = 'Allow all operations on linkedin_profiles'
    ) THEN
        DROP POLICY "Allow all operations on linkedin_profiles" ON public.linkedin_profiles;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scraping_jobs' 
        AND policyname = 'Allow all operations on scraping_jobs'
    ) THEN
        DROP POLICY "Allow all operations on scraping_jobs" ON public.scraping_jobs;
    END IF;
END $$;

-- Create RLS policies to allow all operations for both authenticated and anonymous users
CREATE POLICY "Allow all operations on linkedin_profiles"
    ON public.linkedin_profiles
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on scraping_jobs"
    ON public.scraping_jobs
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);