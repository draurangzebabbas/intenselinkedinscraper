/*
  # Fix RLS Policies for Anonymous Access

  1. Changes Made
    - Drop existing restrictive RLS policies on both tables
    - Create new permissive policies allowing public (anonymous) access
    - Remove JWT-based user filtering that doesn't work with local auth

  2. Security Impact
    - WARNING: This makes the database publicly accessible
    - Any user with the Supabase URL and anon key can read/write data
    - Frontend is now solely responsible for data filtering by user_id
    - Recommended only for development or single-tenant applications

  3. Tables Affected
    - global_linkedin_profiles: Now allows public read/insert/update
    - user_stored_profiles: Now allows public read/insert/update/delete

  4. Important Notes
    - This is a temporary solution for the current local auth setup
    - For production, consider implementing proper Supabase authentication
    - The frontend must handle all user-specific data filtering
*/

-- Drop existing policies for global_linkedin_profiles
DROP POLICY IF EXISTS "Allow authenticated users to read global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "Authenticated users can read all global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert global profiles" ON public.global_linkedin_profiles;
DROP POLICY IF EXISTS "Authenticated users can update global profiles" ON public.global_linkedin_profiles;

-- Recreate policies for global_linkedin_profiles to allow public (anonymous) access
CREATE POLICY "Allow public users to read all global profiles"
  ON public.global_linkedin_profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public users to insert global profiles"
  ON public.global_linkedin_profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public users to update global profiles"
  ON public.global_linkedin_profiles
  FOR UPDATE
  TO public
  USING (true);

-- Drop existing policies for user_stored_profiles
DROP POLICY IF EXISTS "Users can select their own stored profiles" ON public.user_stored_profiles;
DROP POLICY IF EXISTS "Users can insert their own stored profiles" ON public.user_stored_profiles;
DROP POLICY IF EXISTS "Users can update their own stored profiles" ON public.user_stored_profiles;
DROP POLICY IF EXISTS "Users can delete their own stored profiles" ON public.user_stored_profiles;

-- Recreate policies for user_stored_profiles to allow public (anonymous) access
-- WARNING: This makes user-specific data publicly writable/readable.
-- The frontend will be solely responsible for filtering data by user_id.
CREATE POLICY "Allow public users to select user stored profiles"
  ON public.user_stored_profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public users to insert user stored profiles"
  ON public.user_stored_profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public users to update user stored profiles"
  ON public.user_stored_profiles
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow public users to delete user stored profiles"
  ON public.user_stored_profiles
  FOR DELETE
  TO public
  USING (true);