import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  }
})

// Database types
export interface User {
  id: string;
  auth_user_id: string;
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

export interface ScrapingJob {
  id: string;
  user_id: string;
  apify_key_id?: string;
  job_type: 'post_comments' | 'profile_details' | 'mixed';
  input_url: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  results_count: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface LinkedInProfile {
  id: string;
  linkedin_url: string;
  profile_data: any;
  last_updated: string;
  created_at: string;
}

// Helper functions
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getUserProfile = async (authUserId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
};

export const getOrCreateUserProfile = async (authUserId: string): Promise<User | null> => {
  try {
    // First try to get existing profile
    let userProfile = await getUserProfile(authUserId);
    
    if (!userProfile) {
      // If no profile exists, call the database function to create one
      const { data, error } = await supabase.rpc('get_or_create_user_profile', {
        user_auth_id: authUserId
      });

      if (error) {
        console.error('Error creating user profile:', error);
        return null;
      }

      userProfile = data;
    }

    return userProfile;
  } catch (error) {
    console.error('Error in getOrCreateUserProfile:', error);
    return null;
  }
};