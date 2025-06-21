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
    
    // Check if environment variables contain placeholder values
    if (supabaseUrl.includes('your_supabase_project_url_here') || supabaseAnonKey.includes('your_supabase_anon_key_here')) {
      throw new Error('Please replace the placeholder values in your .env file with your actual Supabase project URL and API key. You can find these in your Supabase Dashboard > Settings > API.')
    }
    
    // Validate URL format
    try {
      new URL(supabaseUrl);
    } catch {
      throw new Error('VITE_SUPABASE_URL is not a valid URL format. Please check your Supabase project URL.');
    }
    
    // Validate that the URL looks like a Supabase URL
    if (!supabaseUrl.includes('.supabase.co')) {
      throw new Error('VITE_SUPABASE_URL does not appear to be a valid Supabase URL. It should look like: https://your-project-id.supabase.co');
    }
    
    // Validate that the API key looks like a JWT token
    if (!supabaseAnonKey.startsWith('eyJ')) {
      throw new Error('VITE_SUPABASE_ANON_KEY does not appear to be a valid Supabase API key. It should start with "eyJ" and be a JWT token.');
    }
    
    // Test basic connection with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15 seconds
    
    try {
      // First try a simple health check
      console.log('Attempting to connect to Supabase...')
      
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('count', { count: 'exact', head: true })
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('Supabase connection test failed:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // Provide more specific error messages based on error type
        if (error.message.includes('Failed to fetch') || error.code === 'PGRST301') {
          throw new Error(`Network connection failed. This could be due to:

• CORS not configured in your Supabase project
• Invalid Supabase URL: ${supabaseUrl}
• Network connectivity issues
• Supabase project is paused or inactive
• Firewall blocking the connection

Please check:
1. Your Supabase project settings and ensure CORS is configured for http://localhost:5173
2. That your Supabase project is active (not paused)
3. Your network connection
4. The Supabase URL is correct: ${supabaseUrl}`)
        } else if (error.message.includes('Invalid API key') || error.code === '401') {
          throw new Error('Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY in the .env file.')
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
          throw new Error('Database tables not found. Please ensure your Supabase database has been set up with the required tables (linkedin_profiles, scraping_jobs).')
        } else if (error.code === 'PGRST116') {
          throw new Error('Table or schema not found. Please ensure your database migrations have been run and the tables exist.')
        }
        
        throw new Error(`Supabase connection failed: ${error.message}${error.details ? ` (${error.details})` : ''}`)
      }
      
      console.log('Supabase connection successful!')
      console.log('Connection test result:', data)
      return { success: true, count: data }
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          throw new Error(`Connection timeout after 15 seconds. This could indicate:

• Network connectivity issues
• Supabase project is paused or inactive
• Firewall blocking the connection
• Server overload

Please check your network connection and Supabase project status.`)
        }
        
        // Re-throw the error if it's already been processed
        throw fetchError;
      }
      
      throw new Error('Unknown connection error occurred.')
    }
    
  } catch (error) {
    console.error('Supabase connection test error:', error)
    
    // Enhanced error logging for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown connection error' 
    }
  }
}

// Additional utility function to check Supabase service status
export const checkSupabaseStatus = async () => {
  try {
    // Try to reach Supabase status page or a simple endpoint
    const response = await fetch('https://status.supabase.com/api/v2/status.json', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const status = await response.json();
      return { available: true, status };
    }
    
    return { available: false, error: 'Status check failed' };
  } catch (error) {
    console.warn('Could not check Supabase status:', error);
    return { available: false, error: 'Status check unavailable' };
  }
}