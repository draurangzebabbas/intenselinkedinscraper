/*
  # Step 13: Create Authentication Functions

  This migration creates functions to handle user registration and profile management.

  ## What this does:
  - Creates handle_new_user() function for automatic user profile creation
  - Creates get_or_create_user_profile() function for profile retrieval
  - Both functions use secure search paths to prevent SQL injection
  - Functions handle user metadata extraction safely
*/

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _username text;
  _full_name text;
  _first_name text;
  _last_name text;
BEGIN
  -- Set secure search path to prevent search_path manipulation attacks
  SET search_path = public, pg_temp;
  
  -- Extract values from raw_user_meta_data safely
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    _username := NEW.raw_user_meta_data->>'username';
    _full_name := NEW.raw_user_meta_data->>'full_name';
    _first_name := NEW.raw_user_meta_data->>'first_name';
    _last_name := NEW.raw_user_meta_data->>'last_name';
  END IF;

  -- Determine final username
  IF _username IS NULL OR _username = '' THEN
    _username := split_part(NEW.email, '@', 1) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;

  -- Determine final full_name
  IF _full_name IS NULL OR _full_name = '' THEN
    IF _first_name IS NOT NULL AND _last_name IS NOT NULL THEN
      _full_name := _first_name || ' ' || _last_name;
    ELSE
      _full_name := NULL;
    END IF;
  END IF;

  INSERT INTO public.users (auth_user_id, username, email, full_name)
  VALUES (
    NEW.id,
    _username,
    NEW.email,
    _full_name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_auth_id uuid)
RETURNS public.users AS $$
DECLARE
  user_profile public.users;
BEGIN
  -- Set secure search path to prevent search_path manipulation attacks
  SET search_path = public, pg_temp;
  
  SELECT * INTO user_profile FROM public.users WHERE auth_user_id = user_auth_id;
  
  IF user_profile IS NULL THEN
    -- Get user data from auth.users
    INSERT INTO public.users (auth_user_id, username, email, full_name)
    SELECT 
      id,
      COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
      email,
      COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name' || ' ' || raw_user_meta_data->>'last_name')
    FROM auth.users 
    WHERE id = user_auth_id
    RETURNING * INTO user_profile;
  END IF;
  
  RETURN user_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;