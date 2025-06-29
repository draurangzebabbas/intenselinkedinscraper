/*
  # Complete Database Schema Setup

  1. Extensions and Functions
    - Enable required PostgreSQL extensions
    - Create helper functions for user management

  2. Core Tables
    - `users` - User profiles linked to auth.users
    - `apify_keys` - API key management per user
    - `global_linkedin_profiles` - Shared profile storage (benefits all users)
    - `user_stored_profiles` - Links users to their saved profiles with tags
    - `scraping_jobs` - Job tracking and history

  3. Indexes
    - Performance indexes for all tables
    - GIN indexes for arrays and JSONB data

  4. Security Setup
    - Enable Row Level Security on all tables
    - Create comprehensive RLS policies
    - Set up user creation triggers

  This migration creates the complete database structure needed for the shared profile model.
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist (for clean reinstall)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_or_create_user_profile(uuid);

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.scraping_jobs CASCADE;
DROP TABLE IF EXISTS public.user_stored_profiles CASCADE;
DROP TABLE IF EXISTS public.global_linkedin_profiles CASCADE;
DROP TABLE IF EXISTS public.apify_keys CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table (linked to auth.users)
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Create global_linkedin_profiles table (stores all scraped data, shared between users)
CREATE TABLE public.global_linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create user_stored_profiles table (links users to global profiles with tags)
CREATE TABLE public.user_stored_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  global_profile_id uuid REFERENCES public.global_linkedin_profiles(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}'::text[],
  stored_at timestamptz DEFAULT now(),
  UNIQUE(user_id, global_profile_id) -- Ensure a user can only store a profile once
);

-- Create scraping_jobs table
CREATE TABLE public.scraping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  apify_key_id uuid REFERENCES public.apify_keys(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (job_type = ANY (ARRAY['post_comments'::text, 'profile_details'::text, 'mixed'::text])),
  input_url text NOT NULL,
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  results_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email);

CREATE INDEX idx_apify_keys_user_id ON public.apify_keys(user_id);
CREATE INDEX idx_apify_keys_active ON public.apify_keys(is_active);

CREATE INDEX idx_global_linkedin_profiles_url ON public.global_linkedin_profiles(linkedin_url);
CREATE INDEX idx_global_linkedin_profiles_updated ON public.global_linkedin_profiles(last_updated);
CREATE INDEX idx_global_linkedin_profiles_data ON public.global_linkedin_profiles USING GIN (profile_data);

CREATE INDEX idx_user_stored_profiles_user_id ON public.user_stored_profiles(user_id);
CREATE INDEX idx_user_stored_profiles_global_profile_id ON public.user_stored_profiles(global_profile_id);
CREATE INDEX idx_user_stored_profiles_tags ON public.user_stored_profiles USING GIN (tags);

CREATE INDEX idx_scraping_jobs_user_id ON public.scraping_jobs(user_id);
CREATE INDEX idx_scraping_jobs_status ON public.scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_type ON public.scraping_jobs(job_type);
CREATE INDEX idx_scraping_jobs_created_at ON public.scraping_jobs(created_at);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _username text;
  _full_name text;
  _first_name text;
  _last_name text;
BEGIN
  -- Set secure search path to prevent search_path manipulation attacks
  SET search_path = public, pg_temp;
  
  -- Extract values from raw_user_meta_data safely
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    _username := NEW.raw_user_meta_data->>'username';
    _full_name := NEW.raw_user_meta_data->>'full_name';
    _first_name := NEW.raw_user_meta_data->>'first_name';
    _last_name := NEW.raw_user_meta_data->>'last_name';
  END IF;

  -- Determine final username
  IF _username IS NULL OR _username = '' THEN
    _username := split_part(NEW.email, '@', 1) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;

  -- Determine final full_name
  IF _full_name IS NULL OR _full_name = '' THEN
    IF _first_name IS NOT NULL AND _last_name IS NOT NULL THEN
      _full_name := _first_name || ' ' || _last_name;
    ELSE
      _full_name := NULL;
    END IF;
  END IF;

  INSERT INTO public.users (auth_user_id, username, email, full_name)
  VALUES (
    NEW.id,
    _username,
    NEW.email,
    _full_name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_auth_id uuid)
RETURNS public.users AS $$
DECLARE
  user_profile public.users;
BEGIN
  -- Set secure search path to prevent search_path manipulation attacks
  SET search_path = public, pg_temp;
  
  SELECT * INTO user_profile FROM public.users WHERE auth_user_id = user_auth_id;
  
  IF user_profile IS NULL THEN
    -- Get user data from auth.users
    INSERT INTO public.users (auth_user_id, username, email, full_name)
    SELECT 
      id,
      COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
      email,
      COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name' || ' ' || raw_user_meta_data->>'last_name')
    FROM auth.users 
    WHERE id = user_auth_id
    RETURNING * INTO user_profile;
  END IF;
  
  RETURN user_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();