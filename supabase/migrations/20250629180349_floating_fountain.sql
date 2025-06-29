/*
  # Step 6: Create Scraping Jobs Table

  This migration creates the table for tracking scraping operations.

  ## What this does:
  - Creates scraping_jobs table for job tracking
  - Links to users and apify_keys tables
  - Tracks job status, results, and errors
  - Supports different job types (post_comments, profile_details, mixed)
  - Adds performance indexes
*/

-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS public.scraping_jobs (
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
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON public.scraping_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON public.scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON public.scraping_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created_at ON public.scraping_jobs(created_at);