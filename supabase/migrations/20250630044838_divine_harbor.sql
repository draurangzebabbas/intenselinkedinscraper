/*
  # Fix User Profile Creation Function

  This migration fixes the syntax error in the get_or_create_user_profile function
  that was causing "operator does not exist: text ->> unknown" errors.

  ## Changes Made

  1. **Fix JSON Operator Syntax**
     - Corrects the JSONB extraction syntax in the function
     - Ensures proper handling of user metadata from auth.users

  2. **Improve Error Handling**
     - Better error messages for debugging
     - Safer JSON field extraction

  3. **Username Generation**
     - More robust username generation logic
     - Handles edge cases better
*/

-- Drop and recreate the function with proper syntax
DROP FUNCTION IF EXISTS public.get_or_create_user_profile(uuid);

CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_auth_id UUID)
RETURNS public.users AS $$
DECLARE
  user_profile public.users;
  auth_user auth.users;
  username_value TEXT;
  full_name_value TEXT;
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

  -- Extract full name safely from JSONB
  full_name_value := '';
  IF auth_user.raw_user_meta_data IS NOT NULL THEN
    -- Try to get full_name first
    IF auth_user.raw_user_meta_data ? 'full_name' THEN
      full_name_value := auth_user.raw_user_meta_data->>'full_name';
    ELSIF auth_user.raw_user_meta_data ? 'first_name' AND auth_user.raw_user_meta_data ? 'last_name' THEN
      full_name_value := (auth_user.raw_user_meta_data->>'first_name') || ' ' || (auth_user.raw_user_meta_data->>'last_name');
    ELSIF auth_user.raw_user_meta_data ? 'first_name' THEN
      full_name_value := auth_user.raw_user_meta_data->>'first_name';
    END IF;
  END IF;

  -- Clean up full_name
  full_name_value := TRIM(full_name_value);
  IF full_name_value = '' THEN
    full_name_value := NULL;
  END IF;

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
    full_name_value,
    NOW(),
    NOW()
  ) RETURNING * INTO user_profile;

  RETURN user_profile;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the trigger function with the same syntax corrections
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_full_name TEXT;
  username_value TEXT;
BEGIN
  -- Extract email and full name from the new auth user
  user_email := NEW.email;
  user_full_name := '';
  
  -- Safely extract full name from JSONB
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    IF NEW.raw_user_meta_data ? 'full_name' THEN
      user_full_name := NEW.raw_user_meta_data->>'full_name';
    ELSIF NEW.raw_user_meta_data ? 'first_name' AND NEW.raw_user_meta_data ? 'last_name' THEN
      user_full_name := (NEW.raw_user_meta_data->>'first_name') || ' ' || (NEW.raw_user_meta_data->>'last_name');
    ELSIF NEW.raw_user_meta_data ? 'first_name' THEN
      user_full_name := NEW.raw_user_meta_data->>'first_name';
    END IF;
  END IF;
  
  -- Clean up full name
  user_full_name := TRIM(user_full_name);
  IF user_full_name = '' THEN
    user_full_name := NULL;
  END IF;
  
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
    user_full_name,
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile(UUID) TO authenticated;