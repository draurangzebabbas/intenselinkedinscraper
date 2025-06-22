import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
}

// Create Supabase client with simplified configuration
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    }
  }
})

// Simple connection test
export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured.')
    }
    
    // Simple query to test connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Connection test error:', error)
      return { 
        success: false, 
        error: `Database connection failed: ${error.message}` 
      }
    }
    
    console.log('Supabase connection successful!')
    return { 
      success: true, 
      message: 'Connection successful'
    }
    
  } catch (error) {
    console.error('Supabase connection test error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown connection error' 
    }
  }
}

// Helper function for safe database operations
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  operationName: string = 'database operation'
): Promise<{ data: T | null; error: any }> => {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    console.error(`${operationName} failed:`, error);
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : `Unknown error during ${operationName}`,
        code: 'UNKNOWN_ERROR'
      }
    };
  }
}

// Database types
export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ApifyKey {
  id: string;
  user_id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinkedInProfile {
  id: string;
  user_id: string;
  linkedin_url: string;
  profile_data: any;
  last_updated: string;
  created_at: string;
}

export interface ScrapingJob {
  id: string;
  user_id: string;
  apify_key_id?: string;
  job_type: 'post_comments' | 'profile_details' | 'mixed';
  input_url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results_count: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}