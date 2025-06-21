import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// Test Supabase connection
export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...')
    console.log('Supabase URL:', supabaseUrl)
    console.log('Supabase Key:', supabaseAnonKey ? 'Set (length: ' + supabaseAnonKey.length + ')' : 'Missing')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.')
    }
    
    // Validate URL format
    try {
      new URL(supabaseUrl);
    } catch {
      throw new Error('VITE_SUPABASE_URL is not a valid URL format. Please check your Supabase project URL.');
    }
    
    // Test basic connection with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('count', { count: 'exact', head: true })
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('Supabase connection test failed:', error)
        
        // Provide more specific error messages
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Network connection failed. This could be due to:\n\n• CORS not configured in your Supabase project\n• Invalid Supabase URL\n• Network connectivity issues\n• Supabase project is paused or inactive\n\nPlease check your Supabase project settings and ensure CORS is configured for http://localhost:5173');
        } else if (error.message.includes('Invalid API key')) {
          throw new Error('Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY in the .env file.');
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
          throw new Error('Database tables not found. Please ensure your Supabase database has been set up with the required tables (linkedin_profiles, scraping_jobs).');
        }
        
        throw new Error(`Supabase connection failed: ${error.message}`);
      }
      
      console.log('Supabase connection successful!')
      return { success: true, count: data }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Connection timeout. Please check your network connection and Supabase project status.');
        }
        throw fetchError;
      }
      throw new Error('Unknown connection error occurred.');
    }
    
  } catch (error) {
    console.error('Supabase connection test error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown connection error' 
    }
  }
}