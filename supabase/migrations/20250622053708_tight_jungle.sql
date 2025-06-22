/*
  # Enhanced LinkedIn Scraper Database Schema

  1. Schema Enhancements
    - Add user association to profiles and jobs
    - Add profile tags and categories
    - Add search and analytics tables
    - Add data quality and validation tracking
    - Add export history tracking

  2. New Tables
    - `profile_tags` - For categorizing profiles
    - `search_queries` - Track search patterns
    - `export_history` - Track data exports
    - `profile_analytics` - Store computed metrics

  3. Enhanced Existing Tables
    - Add user_id to existing tables for multi-user support
    - Add data quality fields
    - Add search optimization fields

  4. Performance Improvements
    - Additional indexes for search and filtering
    - Full-text search capabilities
    - Materialized views for analytics
*/

-- Add user association columns to existing tables (optional for multi-user support)
DO $$
BEGIN
    -- Add user_id to linkedin_profiles if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'linkedin_profiles' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add user_id to scraping_jobs if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scraping_jobs' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.scraping_jobs 
        ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add data quality and search optimization fields
DO $$
BEGIN
    -- Add data quality score to profiles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'linkedin_profiles' AND column_name = 'data_quality_score'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN data_quality_score integer DEFAULT 0 CHECK (data_quality_score >= 0 AND data_quality_score <= 100);
    END IF;

    -- Add search vector for full-text search
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'linkedin_profiles' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN search_vector tsvector;
    END IF;

    -- Add profile status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'linkedin_profiles' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted', 'pending_review'));
    END IF;

    -- Add tags array
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'linkedin_profiles' AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN tags text[] DEFAULT '{}';
    END IF;

    -- Add notes field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'linkedin_profiles' AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN notes text;
    END IF;
END $$;

-- Create profile_tags table for better tag management
CREATE TABLE IF NOT EXISTS public.profile_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    color text DEFAULT '#3B82F6',
    description text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create profile_tag_assignments junction table
CREATE TABLE IF NOT EXISTS public.profile_tag_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.linkedin_profiles(id) ON DELETE CASCADE,
    tag_id uuid REFERENCES public.profile_tags(id) ON DELETE CASCADE,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at timestamptz DEFAULT now(),
    UNIQUE(profile_id, tag_id)
);

-- Create search_queries table to track search patterns
CREATE TABLE IF NOT EXISTS public.search_queries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    query_text text NOT NULL,
    filters jsonb DEFAULT '{}',
    results_count integer DEFAULT 0,
    execution_time_ms integer,
    created_at timestamptz DEFAULT now()
);

-- Create export_history table
CREATE TABLE IF NOT EXISTS public.export_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    export_type text NOT NULL CHECK (export_type IN ('csv', 'json', 'xlsx', 'pdf')),
    profile_count integer NOT NULL DEFAULT 0,
    filters_applied jsonb DEFAULT '{}',
    file_size_bytes bigint,
    download_url text,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Create profile_analytics table for computed metrics
CREATE TABLE IF NOT EXISTS public.profile_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.linkedin_profiles(id) ON DELETE CASCADE,
    connections_growth integer DEFAULT 0,
    followers_growth integer DEFAULT 0,
    profile_completeness_score integer DEFAULT 0 CHECK (profile_completeness_score >= 0 AND profile_completeness_score <= 100),
    engagement_score integer DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
    last_activity_date timestamptz,
    computed_at timestamptz DEFAULT now(),
    UNIQUE(profile_id)
);

-- Create contact_attempts table for tracking outreach
CREATE TABLE IF NOT EXISTS public.contact_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.linkedin_profiles(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_type text NOT NULL CHECK (contact_type IN ('email', 'linkedin_message', 'phone', 'other')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed')),
    subject text,
    message text,
    response text,
    sent_at timestamptz,
    responded_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.profile_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables
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

CREATE POLICY "Users can access their own export history"
    ON public.export_history
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

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id ON public.linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_status ON public.linkedin_profiles(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_data_quality ON public.linkedin_profiles(data_quality_score);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_tags ON public.linkedin_profiles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_search_vector ON public.linkedin_profiles USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON public.scraping_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created_at ON public.scraping_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_profile_tag_assignments_profile_id ON public.profile_tag_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_tag_assignments_tag_id ON public.profile_tag_assignments(tag_id);

CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON public.search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON public.search_queries(created_at);

CREATE INDEX IF NOT EXISTS idx_export_history_user_id ON public.export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_created_at ON public.export_history(created_at);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_profile_id ON public.contact_attempts(profile_id);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_user_id ON public.contact_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_status ON public.contact_attempts(status);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_profile_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.profile_data->>'fullName', '') || ' ' ||
        COALESCE(NEW.profile_data->>'firstName', '') || ' ' ||
        COALESCE(NEW.profile_data->>'lastName', '') || ' ' ||
        COALESCE(NEW.profile_data->>'headline', '') || ' ' ||
        COALESCE(NEW.profile_data->>'companyName', '') || ' ' ||
        COALESCE(NEW.profile_data->>'jobTitle', '') || ' ' ||
        COALESCE(NEW.profile_data->>'addressWithCountry', '') || ' ' ||
        COALESCE(array_to_string(NEW.tags, ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS trigger_update_profile_search_vector ON public.linkedin_profiles;
CREATE TRIGGER trigger_update_profile_search_vector
    BEFORE INSERT OR UPDATE ON public.linkedin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_search_vector();

-- Create function to calculate profile completeness score
CREATE OR REPLACE FUNCTION calculate_profile_completeness(profile_data jsonb)
RETURNS integer AS $$
DECLARE
    score integer := 0;
    max_score integer := 100;
    field_weight integer := 10;
BEGIN
    -- Basic info (40 points)
    IF profile_data->>'fullName' IS NOT NULL AND profile_data->>'fullName' != '' THEN
        score := score + field_weight;
    END IF;
    IF profile_data->>'headline' IS NOT NULL AND profile_data->>'headline' != '' THEN
        score := score + field_weight;
    END IF;
    IF profile_data->>'about' IS NOT NULL AND profile_data->>'about' != '' THEN
        score := score + field_weight;
    END IF;
    IF profile_data->>'profilePic' IS NOT NULL AND profile_data->>'profilePic' != '' THEN
        score := score + field_weight;
    END IF;
    
    -- Contact info (20 points)
    IF profile_data->>'email' IS NOT NULL AND profile_data->>'email' != '' THEN
        score := score + field_weight;
    END IF;
    IF profile_data->>'mobileNumber' IS NOT NULL AND profile_data->>'mobileNumber' != '' THEN
        score := score + field_weight;
    END IF;
    
    -- Professional info (30 points)
    IF profile_data->>'jobTitle' IS NOT NULL AND profile_data->>'jobTitle' != '' THEN
        score := score + field_weight;
    END IF;
    IF profile_data->>'companyName' IS NOT NULL AND profile_data->>'companyName' != '' THEN
        score := score + field_weight;
    END IF;
    IF profile_data->'experiences' IS NOT NULL AND jsonb_array_length(profile_data->'experiences') > 0 THEN
        score := score + field_weight;
    END IF;
    
    -- Additional info (10 points)
    IF profile_data->'skills' IS NOT NULL AND jsonb_array_length(profile_data->'skills') > 0 THEN
        score := score + field_weight;
    END IF;
    
    RETURN LEAST(score, max_score);
END;
$$ LANGUAGE plpgsql;

-- Create function to update profile analytics
CREATE OR REPLACE FUNCTION update_profile_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profile_analytics (
        profile_id,
        profile_completeness_score,
        computed_at
    ) VALUES (
        NEW.id,
        calculate_profile_completeness(NEW.profile_data),
        now()
    )
    ON CONFLICT (profile_id) 
    DO UPDATE SET
        profile_completeness_score = calculate_profile_completeness(NEW.profile_data),
        computed_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update analytics
DROP TRIGGER IF EXISTS trigger_update_profile_analytics ON public.linkedin_profiles;
CREATE TRIGGER trigger_update_profile_analytics
    AFTER INSERT OR UPDATE ON public.linkedin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_analytics();

-- Create materialized view for profile statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.profile_statistics AS
SELECT 
    COUNT(*) as total_profiles,
    COUNT(*) FILTER (WHERE status = 'active') as active_profiles,
    COUNT(*) FILTER (WHERE status = 'archived') as archived_profiles,
    AVG(data_quality_score) as avg_data_quality,
    COUNT(*) FILTER (WHERE profile_data->>'email' IS NOT NULL AND profile_data->>'email' != '') as profiles_with_email,
    COUNT(*) FILTER (WHERE profile_data->>'mobileNumber' IS NOT NULL AND profile_data->>'mobileNumber' != '') as profiles_with_phone,
    COUNT(*) FILTER (WHERE last_updated > now() - interval '30 days') as recently_updated,
    DATE_TRUNC('day', now()) as computed_at
FROM public.linkedin_profiles;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_statistics_computed_at 
ON public.profile_statistics(computed_at);

-- Create function to refresh statistics
CREATE OR REPLACE FUNCTION refresh_profile_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.profile_statistics;
END;
$$ LANGUAGE plpgsql;

-- Update existing profiles to populate new fields
UPDATE public.linkedin_profiles 
SET 
    data_quality_score = calculate_profile_completeness(profile_data),
    search_vector = to_tsvector('english', 
        COALESCE(profile_data->>'fullName', '') || ' ' ||
        COALESCE(profile_data->>'firstName', '') || ' ' ||
        COALESCE(profile_data->>'lastName', '') || ' ' ||
        COALESCE(profile_data->>'headline', '') || ' ' ||
        COALESCE(profile_data->>'companyName', '') || ' ' ||
        COALESCE(profile_data->>'jobTitle', '') || ' ' ||
        COALESCE(profile_data->>'addressWithCountry', '')
    )
WHERE data_quality_score IS NULL OR search_vector IS NULL;

-- Refresh the materialized view
SELECT refresh_profile_statistics();