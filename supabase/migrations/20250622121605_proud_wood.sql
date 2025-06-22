/*
  # Add tags support to LinkedIn profiles

  1. Changes
    - Add tags column to linkedin_profiles table as text array
    - Create index for tags column for better search performance

  2. Security
    - No RLS changes needed as tables are already public
*/

-- Add tags column to linkedin_profiles table
ALTER TABLE public.linkedin_profiles 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create index for tags column for better search performance
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_tags 
ON public.linkedin_profiles USING GIN (tags);

-- Update existing profiles to have empty tags array if null
UPDATE public.linkedin_profiles 
SET tags = '{}' 
WHERE tags IS NULL;