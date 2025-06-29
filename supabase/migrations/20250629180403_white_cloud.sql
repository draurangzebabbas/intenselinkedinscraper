/*
  # Step 11: Create User Stored Profiles Table RLS Policies

  This migration creates Row Level Security policies for the user_stored_profiles table.

  ## What this does:
  - Users can manage (insert, select, update, delete) their own stored profiles
  - This controls which global profiles a user has "saved" to their collection
  - Users cannot see other users' saved profiles
*/

-- Create RLS policies for user_stored_profiles table
CREATE POLICY "Users can insert their own stored profiles"
  ON public.user_stored_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can select their own stored profiles"
  ON public.user_stored_profiles
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their own stored profiles"
  ON public.user_stored_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their own stored profiles"
  ON public.user_stored_profiles
  FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));