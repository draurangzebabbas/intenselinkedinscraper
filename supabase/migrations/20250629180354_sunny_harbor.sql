/*
  # Step 7: Enable Row Level Security

  This migration enables RLS on all tables for security.

  ## What this does:
  - Enables Row Level Security (RLS) on all tables
  - This ensures data access is controlled by policies
  - Required before creating RLS policies
*/

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apify_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stored_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;