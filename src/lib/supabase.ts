import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced error checking for environment variables
if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL is missing from environment variables');
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please check your .env file.');
}

if (!supabaseAnonKey) {
  console.error('VITE_SUPABASE_ANON_KEY is missing from environment variables');
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please check your .env file.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  console.error('Invalid VITE_SUPABASE_URL format:', supabaseUrl);
  throw new Error('Invalid VITE_SUPABASE_URL format. Please check your .env file.');
}

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
  // Add retry configuration for network issues
  db: {
    schema: 'public',
  },
});

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('scraping_jobs').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Network error during Supabase connection test:', error);
    return false;
  }
};

export type Database = {
  public: {
    Tables: {
      linkedin_profiles: {
        Row: {
          id: string;
          linkedin_url: string;
          profile_data: any;
          last_updated: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          linkedin_url: string;
          profile_data?: any;
          last_updated?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          linkedin_url?: string;
          profile_data?: any;
          last_updated?: string | null;
          created_at?: string | null;
        };
      };
      scraping_jobs: {
        Row: {
          id: string;
          job_type: string;
          input_url: string;
          status: string | null;
          results_count: number | null;
          error_message: string | null;
          created_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          job_type: string;
          input_url: string;
          status?: string | null;
          results_count?: number | null;
          error_message?: string | null;
          created_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          job_type?: string;
          input_url?: string;
          status?: string | null;
          results_count?: number | null;
          error_message?: string | null;
          created_at?: string | null;
          completed_at?: string | null;
        };
      };
    };
  };
};