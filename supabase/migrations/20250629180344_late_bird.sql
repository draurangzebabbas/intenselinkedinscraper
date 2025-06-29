/*
  # Step 5: Create User Stored Profiles Table

  This migration creates the junction table that links users to global profiles.

  ## What this does:
  - Creates user_stored_profiles table (links users to global profiles)
  - Allows users to "save" profiles to their collection
  - Supports tagging profiles with custom tags
  - Prevents duplicate saves with unique constraint
  - Adds performance indexes including GIN index for tags
*/

-- Create user_stored_profiles table (links users to global profiles with tags)
CREATE TABLE IF NOT EXISTS public.user_stored_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  global_profile_id uuid REFERENCES public.global_linkedin_profiles(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}'::text[],
  stored_at timestamptz DEFAULT now(),
  UNIQUE(user_id, global_profile_id) -- Ensure a user can only store a profile once
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_stored_profiles_user_id ON public.user_stored_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stored_profiles_global_profile_id ON public.user_stored_profiles(global_profile_id);
CREATE INDEX IF NOT EXISTS idx_user_stored_profiles_tags ON public.user_stored_profiles USING GIN (tags);