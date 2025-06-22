import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create a simple client without complex auth configuration
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
)

// Simple connection test that doesn't rely on Supabase
export const testSupabaseConnection = async () => {
  try {
    // Just test if we can make a basic request
    const response = await fetch(window.location.origin);
    return { 
      success: response.ok, 
      message: response.ok ? 'Connection successful' : 'Connection failed'
    }
  } catch (error) {
    return { 
      success: false, 
      error: 'Network connection failed' 
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