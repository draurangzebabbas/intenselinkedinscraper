import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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