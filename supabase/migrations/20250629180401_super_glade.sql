/*
  # Step 10: Create Global Profiles Table RLS Policies

  This migration creates Row Level Security policies for the global_linkedin_profiles table.

  ## What this does:
  - All authenticated users can read global profiles (shared data)
  - Only system/service roles can insert/update global profiles
  - This allows profile data to be shared between users while maintaining security
*/

-- Create RLS policies for global_linkedin_profiles table
CREATE POLICY "Authenticated users can read all global profiles"
  ON public.global_linkedin_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: Insert/Update policies for global profiles are handled by service roles
-- or specific functions, not by regular authenticated users directly