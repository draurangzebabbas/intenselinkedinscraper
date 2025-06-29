/*
  # Step 12: Create Scraping Jobs Table RLS Policies

  This migration creates Row Level Security policies for the scraping_jobs table.

  ## What this does:
  - Users can manage (read, insert, update, delete) their own scraping jobs
  - Users cannot see other users' scraping jobs
  - Policy checks that user_id matches the authenticated user's profile
*/

-- Create RLS policies for scraping_jobs table
CREATE POLICY "Users can manage own scraping jobs"
  ON public.scraping_jobs
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));