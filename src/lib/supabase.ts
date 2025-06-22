import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
}

// Enhanced fetch function with retry logic and timeout
async function fetchWithRetry(url: string | URL | Request, options: RequestInit & { timeout?: number } = {}, retries = 3): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;
  
  for (let i = 0; i < retries; i++) {
    let timeoutId: NodeJS.Timeout | undefined;
    
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If response is ok, return it
      if (response.ok) {
        return response;
      }
      
      // If it's a client error (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // For server errors (5xx), retry
      if (i === retries - 1) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (error instanceof Error) {
        // Don't retry on abort (timeout) or certain network errors on final attempt
        if (error.name === 'AbortError') {
          if (i === retries - 1) {
            throw new Error(`Request timeout after ${timeout}ms. Please check your internet connection and try again.`);
          }
        } else if (error.message.includes('Failed to fetch')) {
          if (i === retries - 1) {
            throw new Error(`Network connection failed. Please check your internet connection and ensure ${supabaseUrl} is accessible.`);
          }
        } else {
          // For other errors, throw immediately
          throw error;
        }
      }
      
      // Wait before retrying (exponential backoff)
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Create Supabase client with enhanced configuration for better connectivity
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
    fetch: (url, options = {}) => {
      // Enhanced fetch with retry logic and better error handling
      return fetchWithRetry(url, {
        ...options,
        timeout: 30000, // 30 second timeout
      });
    }
  }
})

// Test Supabase connection with improved error handling and retry logic
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
    
    console.log('Attempting to connect to Supabase...')
    
    // Try multiple connection approaches with better error handling
    try {
      // First, try a simple health check using the REST API with retry logic
      const healthResponse = await fetchWithRetry(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        timeout: 15000 // 15 second timeout for health check
      });
      
      console.log('Health check passed, testing database access...')
      
      // Now try to access the database through Supabase client
      const { data, error, count } = await supabase
        .from('linkedin_profiles')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('Database access error:', error)
        
        // Handle specific error cases
        if (error.code === 'PGRST116') {
          // Table doesn't exist - this is actually OK for initial setup
          console.log('Tables not found - this is normal for initial setup')
          return { 
            success: true, 
            message: 'Connection successful but tables need to be created',
            needsMigration: true 
          }
        } else if (error.message.includes('permission denied') || error.code === '42501') {
          throw new Error('Permission denied. Please check your Row Level Security (RLS) policies in Supabase.')
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log('Tables not found - this is normal for initial setup')
          return { 
            success: true, 
            message: 'Connection successful but tables need to be created',
            needsMigration: true 
          }
        }
        
        throw new Error(`Database error: ${error.message}`)
      }
      
      console.log('Supabase connection successful!')
      return { 
        success: true, 
        count: count || 0,
        message: 'Connection successful'
      }
      
    } catch (fetchError) {
      console.error('Connection error:', fetchError)
      
      if (fetchError instanceof Error) {
        // Provide more specific error messages based on the error type
        if (fetchError.message.includes('timeout')) {
          throw new Error(`Connection timeout. Your Supabase project might be slow to respond or there may be network issues. Please try again or check your internet connection.`)
        } else if (fetchError.message.includes('Network connection failed')) {
          throw new Error(`Cannot reach Supabase servers. Please check:

• Your internet connection
• Whether ${supabaseUrl} is accessible in your browser
• If you're behind a firewall or proxy that might block the connection
• If your Supabase project is active and not paused

You can test by visiting: ${supabaseUrl}`)
        } else if (fetchError.message.includes('Failed to fetch')) {
          throw new Error(`Network request failed. This could be due to:

• Internet connectivity issues
• CORS configuration problems
• Firewall or proxy blocking the connection
• Supabase service temporarily unavailable

Your Supabase URL: ${supabaseUrl}

Please try:
1. Refresh the page and try again
2. Check if your Supabase project is active in the dashboard
3. Verify your internet connection
4. Try accessing your Supabase project directly: ${supabaseUrl}`)
        }
        
        throw fetchError;
      }
      
      throw new Error('Unknown connection error occurred.')
    }
    
  } catch (error) {
    console.error('Supabase connection test error:', error)
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown connection error' 
    }
  }
}

// Simplified connection test that bypasses some checks
export const simpleConnectionTest = async () => {
  try {
    // Use a simple auth session check with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const { data, error } = await supabase.auth.getSession()
    
    clearTimeout(timeoutId);
    
    if (error && !error.message.includes('session')) {
      throw error
    }
    
    return { success: true, message: 'Basic connection successful' }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { 
        success: false, 
        error: 'Connection timeout. Please check your internet connection and try again.' 
      }
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}

// Helper function to safely execute Supabase operations with retry logic
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  operationName: string = 'database operation'
): Promise<{ data: T | null; error: any }> => {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    console.error(`${operationName} failed:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('timeout')) {
        return {
          data: null,
          error: {
            message: `Network error during ${operationName}. Please check your internet connection and try again.`,
            code: 'NETWORK_ERROR'
          }
        };
      }
    }
    
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : `Unknown error during ${operationName}`,
        code: 'UNKNOWN_ERROR'
      }
    };
  }
}