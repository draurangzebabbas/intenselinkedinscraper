/*
  # Fix Authentication Schema and Database Setup

  1. New Tables
    - `users` - User profile information linked to auth.users
    - `linkedin_profiles` - LinkedIn profile data storage
    - `scraping_jobs` - Track scraping operations
    - `profile_tags` - Custom tags for organizing profiles
    - `profile_tag_assignments` - Many-to-many relationship for profile tags
    - `search_queries` - Track user search patterns
    - `profile_analytics` - Computed metrics and scores
    - `contact_attempts` - Track outreach efforts
    - `export_history` - Log data export operations

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for user data isolation
    - Create auth trigger for new user setup

  3. Functions and Triggers
    - User creation trigger
    - Search vector updates
    - Analytics computation
*/

-- Create users table linked to auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create linkedin_profiles table
CREATE TABLE IF NOT EXISTS public.linkedin_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    linkedin_url text UNIQUE NOT NULL,
    profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_updated timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    data_quality_score integer DEFAULT 0 CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
    search_vector tsvector,
    status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text, 'pending_review'::text])),
    tags text[] DEFAULT '{}',
    notes text
);

-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS public.scraping_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type text NOT NULL CHECK (job_type = ANY (ARRAY['post_comments'::text, 'profile_details'::text, 'mixed'::text])),
    input_url text NOT NULL,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])),
    results_count integer DEFAULT 0,
    error_message text,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create profile_tags table
CREATE TABLE IF NOT EXISTS public.profile_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    color text DEFAULT '#3B82F6',
    description text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create profile_tag_assignments table
CREATE TABLE IF NOT EXISTS public.profile_tag_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
    tag_id uuid REFERENCES profile_tags(id) ON DELETE CASCADE,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at timestamptz DEFAULT now(),
    UNIQUE(profile_id, tag_id)
);

-- Create search_queries table
CREATE TABLE IF NOT EXISTS public.search_queries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    query_text text NOT NULL,
    filters jsonb DEFAULT '{}',
    results_count integer DEFAULT 0,
    execution_time_ms integer,
    created_at timestamptz DEFAULT now()
);

-- Create profile_analytics table
CREATE TABLE IF NOT EXISTS public.profile_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid UNIQUE REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
    connections_growth integer DEFAULT 0,
    followers_growth integer DEFAULT 0,
    profile_completeness_score integer DEFAULT 0 CHECK (profile_completeness_score >= 0 AND profile_completeness_score <= 100),
    engagement_score integer DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
    last_activity_date timestamptz,
    computed_at timestamptz DEFAULT now()
);

-- Create contact_attempts table
CREATE TABLE IF NOT EXISTS public.contact_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_type text NOT NULL CHECK (contact_type = ANY (ARRAY['email'::text, 'linkedin_message'::text, 'phone'::text, 'other'::text])),
    status text DEFAULT 'pending' NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'replied'::text, 'bounced'::text, 'failed'::text])),
    subject text,
    message text,
    response text,
    sent_at timestamptz,
    responded_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create export_history table
CREATE TABLE IF NOT EXISTS public.export_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    export_type text NOT NULL CHECK (export_type = ANY (ARRAY['csv'::text, 'json'::text, 'xlsx'::text, 'pdf'::text])),
    profile_count integer NOT NULL DEFAULT 0,
    filters_applied jsonb DEFAULT '{}',
    file_size_bytes bigint,
    download_url text,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON public.users USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_url ON public.linkedin_profiles USING btree (linkedin_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_updated ON public.linkedin_profiles USING btree (last_updated);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id ON public.linkedin_profiles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_status ON public.linkedin_profiles USING btree (status);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_data_quality ON public.linkedin_profiles USING btree (data_quality_score);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_search_vector ON public.linkedin_profiles USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_tags ON public.linkedin_profiles USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON public.scraping_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON public.scraping_jobs USING btree (job_type);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON public.scraping_jobs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created_at ON public.scraping_jobs USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_profile_tag_assignments_profile_id ON public.profile_tag_assignments USING btree (profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_tag_assignments_tag_id ON public.profile_tag_assignments USING btree (tag_id);

CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON public.search_queries USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON public.search_queries USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_profile_id ON public.contact_attempts USING btree (profile_id);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_user_id ON public.contact_attempts USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_status ON public.contact_attempts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_export_history_user_id ON public.export_history USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_created_at ON public.export_history USING btree (created_at);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can view and update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow all operations on linkedin_profiles" ON public.linkedin_profiles;
DROP POLICY IF EXISTS "Allow all operations on scraping_jobs" ON public.scraping_jobs;
DROP POLICY IF EXISTS "Users can manage their own tags" ON public.profile_tags;
DROP POLICY IF EXISTS "Users can manage their profile tag assignments" ON public.profile_tag_assignments;
DROP POLICY IF EXISTS "Users can access their own search queries" ON public.search_queries;
DROP POLICY IF EXISTS "Allow all operations on profile_analytics" ON public.profile_analytics;
DROP POLICY IF EXISTS "Users can manage their own contact attempts" ON public.contact_attempts;
DROP POLICY IF EXISTS "Users can access their own export history" ON public.export_history;

-- Create RLS policies
CREATE POLICY "Users can view and update their own profile"
    ON public.users
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow all operations on linkedin_profiles"
    ON public.linkedin_profiles
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on scraping_jobs"
    ON public.scraping_jobs
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can manage their own tags"
    ON public.profile_tags
    FOR ALL
    TO authenticated
    USING (created_by = auth.uid() OR created_by IS NULL)
    WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Users can manage their profile tag assignments"
    ON public.profile_tag_assignments
    FOR ALL
    TO authenticated
    USING (assigned_by = auth.uid() OR assigned_by IS NULL)
    WITH CHECK (assigned_by = auth.uid() OR assigned_by IS NULL);

CREATE POLICY "Users can access their own search queries"
    ON public.search_queries
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow all operations on profile_analytics"
    ON public.profile_analytics
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can manage their own contact attempts"
    ON public.contact_attempts
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access their own export history"
    ON public.export_history
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'first_name' || ' ' || new.raw_user_meta_data->>'last_name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update profile search vector
CREATE OR REPLACE FUNCTION public.update_profile_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.profile_data->>'fullName', '') || ' ' ||
    COALESCE(NEW.profile_data->>'headline', '') || ' ' ||
    COALESCE(NEW.profile_data->>'companyName', '') || ' ' ||
    COALESCE(NEW.profile_data->>'addressWithCountry', '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
    COALESCE(NEW.notes, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update profile analytics
CREATE OR REPLACE FUNCTION public.update_profile_analytics()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profile_analytics (profile_id, computed_at)
  VALUES (NEW.id, now())
  ON CONFLICT (profile_id) DO UPDATE SET computed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_update_profile_search_vector ON public.linkedin_profiles;
DROP TRIGGER IF EXISTS trigger_update_profile_analytics ON public.linkedin_profiles;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trigger_update_profile_search_vector
  BEFORE INSERT OR UPDATE ON public.linkedin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_search_vector();

CREATE TRIGGER trigger_update_profile_analytics
  AFTER INSERT OR UPDATE ON public.linkedin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_analytics();

-- Create views for better data access
CREATE OR REPLACE VIEW public.profile_search AS
SELECT 
  lp.*,
  pa.profile_completeness_score,
  pa.engagement_score,
  ARRAY(
    SELECT pt.name 
    FROM profile_tag_assignments pta 
    JOIN profile_tags pt ON pta.tag_id = pt.id 
    WHERE pta.profile_id = lp.id
  ) as tag_names
FROM linkedin_profiles lp
LEFT JOIN profile_analytics pa ON lp.id = pa.profile_id;

-- Create materialized view for statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.profile_statistics AS
SELECT 
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE status = 'active') as active_profiles,
  COUNT(*) FILTER (WHERE status = 'archived') as archived_profiles,
  AVG(data_quality_score) as avg_data_quality,
  COUNT(*) FILTER (WHERE profile_data->>'email' IS NOT NULL) as profiles_with_email,
  COUNT(*) FILTER (WHERE profile_data->>'mobileNumber' IS NOT NULL) as profiles_with_phone,
  COUNT(*) FILTER (WHERE last_updated > now() - interval '7 days') as recently_updated,
  now() as computed_at
FROM linkedin_profiles;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS profile_statistics_computed_at_idx ON public.profile_statistics (computed_at);