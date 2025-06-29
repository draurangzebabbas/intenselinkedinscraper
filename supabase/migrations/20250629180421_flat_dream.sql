/*
  # Step 15: Grant Permissions

  This migration grants necessary permissions for the application to function.

  ## What this does:
  - Grants USAGE on public schema to anon and authenticated roles
  - Grants ALL privileges on all tables to anon and authenticated roles
  - Grants ALL privileges on all sequences to anon and authenticated roles
  - Grants ALL privileges on all functions to anon and authenticated roles
  - This ensures the application can access all necessary database objects
*/

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;