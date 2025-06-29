/*
  # Step 8: Create Users Table RLS Policies

  This migration creates Row Level Security policies for the users table.

  ## What this does:
  - Users can read their own profile
  - Users can update their own profile
  - Policies use auth.uid() to match against auth_user_id
*/

-- Create RLS policies for users table
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id);