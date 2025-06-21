/*
  # Create LinkedIn Profiles Database Schema

  1. New Tables
    - `linkedin_profiles`
      - `id` (uuid, primary key)
      - `linkedin_url` (text, unique, not null)
      - `profile_data` (jsonb, stores all profile information)
      - `last_updated` (timestamp, default now)
      - `created_at` (timestamp, default now)
    
    - `scraping_jobs`
      - `id` (uuid, primary key) 
      - `job_type` (text, not null) - 'post_comments', 'profile_details', 'mixed'
      - `input_url` (text, not null)
      - `status` (text, default 'pending') - 'pending', 'running', 'completed', 'failed'
      - `results_count` (integer, default 0)
      - `created_at` (timestamp, default now)
      - `completed_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their data
*/

CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb NOT NULL DEFAULT '{}',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scraping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('post_comments', 'profile_details', 'mixed')),
  input_url text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  results_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on linkedin_profiles"
  ON linkedin_profiles
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on scraping_jobs"
  ON scraping_jobs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_url ON linkedin_profiles(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_updated ON linkedin_profiles(last_updated);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON scraping_jobs(job_type);