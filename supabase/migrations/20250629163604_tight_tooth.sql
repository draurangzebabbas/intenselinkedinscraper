/*
  # Fix RLS policies for global_linkedin_profiles table

  1. Security Updates
    - Update INSERT policy to allow authenticated users to insert profiles
    - Ensure SELECT and UPDATE policies work correctly for authenticated users
    - Add proper RLS policies for the global profiles sharing model

  2. Changes Made
    - Modified INSERT policy to allow any authenticated user to save profiles to global storage
    - This enables the shared profile model where any user can contribute to the global database
    - Maintains security by requiring authentication
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Authenticated users can insert global profiles" ON global_linkedin_profiles;
DROP POLICY IF EXISTS "Authenticated users can read all global profiles" ON global_linkedin_profiles;
DROP POLICY IF EXISTS "Authenticated users can update global profiles" ON global_linkedin_profiles;

-- Create new RLS policies for global_linkedin_profiles
CREATE POLICY "Allow authenticated users to insert global profiles"
  ON global_linkedin_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read global profiles"
  ON global_linkedin_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update global profiles"
  ON global_linkedin_profiles
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE global_linkedin_profiles ENABLE ROW LEVEL SECURITY;