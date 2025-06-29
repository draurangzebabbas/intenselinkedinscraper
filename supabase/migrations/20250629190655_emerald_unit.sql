/*
  # Fix Authentication Schema

  This migration fixes the authentication schema to properly handle user signup and profile creation.

  ## Changes Made

  1. **User Profile Creation Function**
     - Creates or updates the function that automatically creates a user profile in public.users
     - Links the auth.users record to the public.users record via auth_user_id

  2. **Authentication Trigger**
     - Creates a trigger that automatically runs when a new user signs up
     - Ensures every authenticated user gets a corresponding profile record

  3. **RLS Policies**
     - Ensures proper Row Level Security policies are in place
     - Allows users to manage their own profile data

  4. **Error Handling**
     - Adds proper error handling to prevent signup failures
     - Uses safe operations that won't fail if objects already exist

  ## Security
  - Maintains all existing RLS policies
  - Ensures users can only access their own data
  - Preserves data integrity with proper foreign key constraints
*/

-- Create or replace the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_full_name TEXT;
  username_value TEXT;
BEGIN
  -- Extract email and full name from the new auth user
  user_email := NEW.email;
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name', '');
  
  -- Generate a username from email (part before @)
  username_value := SPLIT_PART(user_email, '@', 1);
  
  -- Make username unique if it already exists
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = username_value) LOOP
    username_value := username_value || '_' || FLOOR(RANDOM() * 1000)::TEXT;
  END LOOP;

  -- Insert the new user profile
  INSERT INTO public.users (
    auth_user_id,
    username,
    email,
    full_name,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    username_value,
    user_email,
    NULLIF(TRIM(user_full_name), ''),
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth signup
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger that fires when a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the users table has proper RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them safely
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create comprehensive RLS policies
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Create a function to get or create user profile (for the application to use)
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_auth_id UUID)
RETURNS public.users AS $$
DECLARE
  user_profile public.users;
  auth_user auth.users;
  username_value TEXT;
BEGIN
  -- First try to get existing profile
  SELECT * INTO user_profile
  FROM public.users
  WHERE auth_user_id = user_auth_id;

  -- If profile exists, return it
  IF FOUND THEN
    RETURN user_profile;
  END IF;

  -- Get the auth user details
  SELECT * INTO auth_user
  FROM auth.users
  WHERE id = user_auth_id;

  -- If auth user doesn't exist, return null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Generate username from email
  username_value := SPLIT_PART(auth_user.email, '@', 1);
  
  -- Make username unique
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = username_value) LOOP
    username_value := username_value || '_' || FLOOR(RANDOM() * 1000)::TEXT;
  END LOOP;

  -- Create the profile
  INSERT INTO public.users (
    auth_user_id,
    username,
    email,
    full_name,
    created_at,
    updated_at
  ) VALUES (
    user_auth_id,
    username_value,
    auth_user.email,
    COALESCE(
      auth_user.raw_user_meta_data->>'full_name',
      auth_user.raw_user_meta_data->>'first_name' || ' ' || auth_user.raw_user_meta_data->>'last_name',
      ''
    ),
    NOW(),
    NOW()
  ) RETURNING * INTO user_profile;

  RETURN user_profile;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile(UUID) TO authenticated;

-- Ensure all existing auth users have profiles (migration safety)
DO $$
DECLARE
  auth_user_record RECORD;
BEGIN
  FOR auth_user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.auth_user_id
    WHERE pu.auth_user_id IS NULL
  LOOP
    PERFORM public.get_or_create_user_profile(auth_user_record.id);
  END LOOP;
END $$;