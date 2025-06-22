/*
  # Fix Authentication Schema and User Management

  This migration ensures that the authentication system is properly configured
  and that all necessary tables and functions exist for user registration.

  1. Database Setup
    - Verify auth schema exists
    - Ensure auth.users table is properly configured
    - Set up public.users table with proper triggers
    - Configure RLS policies

  2. User Management
    - Create trigger function for new user handling
    - Set up automatic profile creation
    - Ensure proper foreign key relationships

  3. Security
    - Enable RLS on all user-related tables
    - Create appropriate policies for user data access
*/

-- Ensure the auth schema exists (it should be created by Supabase automatically)
-- This is just a safety check
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE EXCEPTION 'Auth schema does not exist. Please check your Supabase project setup.';
  END IF;
END $$;

-- Ensure the public.users table exists and is properly configured
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create or replace the function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, update instead
    UPDATE public.users 
    SET 
      email = NEW.email,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name'),
      avatar_url = NEW.raw_user_meta_data->>'avatar_url',
      updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create RLS policies for users table
DROP POLICY IF EXISTS "Users can view and update their own profile" ON public.users;
CREATE POLICY "Users can view and update their own profile"
  ON public.users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own data
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own data
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON public.users(created_at);

-- Create a function to safely get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_id uuid)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile public.users;
  auth_user auth.users;
BEGIN
  -- First try to get existing profile
  SELECT * INTO user_profile FROM public.users WHERE id = user_id;
  
  IF FOUND THEN
    RETURN user_profile;
  END IF;
  
  -- If no profile exists, get auth user data and create profile
  SELECT * INTO auth_user FROM auth.users WHERE id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found for ID: %', user_id;
  END IF;
  
  -- Create the profile
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    auth_user.id,
    auth_user.email,
    COALESCE(auth_user.raw_user_meta_data->>'full_name', auth_user.raw_user_meta_data->>'first_name' || ' ' || auth_user.raw_user_meta_data->>'last_name'),
    auth_user.raw_user_meta_data->>'avatar_url'
  )
  RETURNING * INTO user_profile;
  
  RETURN user_profile;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile(uuid) TO anon, authenticated;