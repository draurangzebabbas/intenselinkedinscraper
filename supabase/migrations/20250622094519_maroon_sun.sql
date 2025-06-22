/*
  # Simplified LinkedIn Scraper Database Schema

  1. New Tables
    - `users` - Simple user management without auth
    - `apify_keys` - Store multiple Apify keys per user
    - `linkedin_profiles` - Store scraped LinkedIn profile data
    - `scraping_jobs` - Track scraping operations

  2. Security
    - No RLS policies for simplicity
    - Public access to all tables

  3. Performance
    - Basic indexes for common queries
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.contact_attempts CASCADE;
DROP TABLE IF EXISTS public.export_history CASCADE;
DROP TABLE IF EXISTS public.profile_analytics CASCADE;
DROP TABLE IF EXISTS public.search_queries CASCADE;
DROP TABLE IF EXISTS public.profile_tag_assignments CASCADE;
DROP TABLE IF EXISTS public.profile_tags CASCADE;
DROP TABLE IF EXISTS public.scraping_jobs CASCADE;
DROP TABLE IF EXISTS public.linkedin_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop existing views and materialized views
DROP VIEW IF EXISTS public.profile_search CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.profile_statistics CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_profile_search_vector() CASCADE;
DROP FUNCTION IF EXISTS public.update_profile_analytics() CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_user_profile(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_profile_statistics() CASCADE;
DROP FUNCTION IF EXISTS calculate_profile_completeness(jsonb) CASCADE;

-- Create simple users table
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text UNIQUE NOT NULL,
    email text UNIQUE NOT NULL,
    full_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create apify_keys table for multiple API keys per user
CREATE TABLE public.apify_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    key_name text NOT NULL,
    api_key text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, key_name)
);

-- Create linkedin_profiles table
CREATE TABLE public.linkedin_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    linkedin_url text NOT NULL,
    profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_updated timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, linkedin_url)
);

-- Create scraping_jobs table
CREATE TABLE public.scraping_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    apify_key_id uuid REFERENCES public.apify_keys(id) ON DELETE SET NULL,
    job_type text NOT NULL CHECK (job_type = ANY (ARRAY['post_comments'::text, 'profile_details'::text, 'mixed'::text])),
    input_url text NOT NULL,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])),
    results_count integer DEFAULT 0,
    error_message text,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email);

CREATE INDEX idx_apify_keys_user_id ON public.apify_keys(user_id);
CREATE INDEX idx_apify_keys_active ON public.apify_keys(is_active);

CREATE INDEX idx_linkedin_profiles_user_id ON public.linkedin_profiles(user_id);
CREATE INDEX idx_linkedin_profiles_url ON public.linkedin_profiles(linkedin_url);
CREATE INDEX idx_linkedin_profiles_updated ON public.linkedin_profiles(last_updated);

CREATE INDEX idx_scraping_jobs_user_id ON public.scraping_jobs(user_id);
CREATE INDEX idx_scraping_jobs_status ON public.scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_type ON public.scraping_jobs(job_type);
CREATE INDEX idx_scraping_jobs_created_at ON public.scraping_jobs(created_at);

-- Disable RLS on all tables for simplicity
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.apify_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Insert a default user for testing
INSERT INTO public.users (username, email, full_name) 
VALUES ('demo_user', 'demo@example.com', 'Demo User')
ON CONFLICT (username) DO NOTHING;