/*
  # Step 14: Create Authentication Trigger

  This migration creates the trigger that automatically creates user profiles on signup.

  ## What this does:
  - Creates trigger on auth.users table
  - Automatically calls handle_new_user() when a new user signs up
  - Ensures every authenticated user has a corresponding profile in public.users
  - Uses DO block to check if trigger already exists
*/

-- Trigger to automatically create user profile on signup
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;