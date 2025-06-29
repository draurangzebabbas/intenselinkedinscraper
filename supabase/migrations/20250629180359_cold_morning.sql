/*
  # Step 9: Create Apify Keys Table RLS Policies

  This migration creates Row Level Security policies for the apify_keys table.

  ## What this does:
  - Users can manage (read, insert, update, delete) their own API keys
  - Policy checks that user_id matches the authenticated user's profile
*/

-- Create RLS policies for apify_keys table
CREATE POLICY "Users can manage own API keys"
  ON public.apify_keys
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));