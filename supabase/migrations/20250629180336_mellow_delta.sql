/*
  # Step 3: Create Apify Keys Table

  This migration creates the table for storing user API keys.

  ## What this does:
  - Creates apify_keys table for multiple API keys per user
  - Links to users table via user_id
  - Stores key name and encrypted API key
  - Adds unique constraint on user_id + key_name
  - Adds performance indexes
*/

-- Create apify_keys table for multiple API keys per user
CREATE TABLE IF NOT EXISTS public.apify_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  api_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_apify_keys_user_id ON public.apify_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_apify_keys_active ON public.apify_keys(is_active);