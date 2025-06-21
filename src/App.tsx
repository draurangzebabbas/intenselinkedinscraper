import React, { useState, useEffect } from 'react';
import { ScrapingForm } from './components/ScrapingForm';
import { DataTable } from './components/DataTable';
import { JobsTable } from './components/JobsTable';
import { Auth } from './components/Auth';
import { UserMenu } from './components/UserMenu';
import { supabase, testSupabaseConnection } from './lib/supabase';
import { exportData } from './utils/export';
import { Linkedin, Database, Activity, AlertCircle } from 'lucide-react';

interface Profile {
  id: string;
  linkedin_url: string;
  profile_data: any;
  last_updated: string | null;
  created_at: string | null;
}

interface Job {
  id: string;
  job_type: string;
  input_url: string;
  status: string | null;
  results_count: number | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

function App() {
  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Application state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles' | 'jobs'>('scraper');
  const [connectionError, setConnectionError] = useState<string>('');

  useEffect(() => {
    // Initialize authentication
    initializeAuth();
  }, []);

  useEffect(() => {
    // Load data when user is authenticated
    if (user) {
      initializeApp();
    }
  }, [user]);

  const initializeAuth = async () => {
    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
      } else {
        setUser(session?.user ?? null);
      }

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state changed:', event, session?.user?.email);
          setUser(session?.user ?? null);
          
          if (event === 'SIGNED_OUT') {
            // Clear application state on sign out
            setProfiles([]);
            setJobs([]);
            setActiveTab('scraper');
            setConnectionError('');
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const initializeApp = async () => {
    // Test Supabase connection first
    const connectionTest = await testSupabaseConnection();
    
    if (!connectionTest.success) {
      setConnectionError(connectionTest.error || 'Failed to connect to Supabase');
      return;
    }
    
    // If connection is successful, load data
    await loadData();
  };

  const loadData = async () => {
    try {
      setConnectionError(''); // Clear any previous connection errors
      
      // Load profiles with better error handling
      const { data: profilesData, error: profilesError } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(100);

      if (profilesError) {
        console.error('Profiles error:', profilesError);
        throw new Error(`Failed to load profiles: ${profilesError.message}`);
      }
      setProfiles(profilesData || []);

      // Load jobs with better error handling
      const { data: jobsData, error: jobsError } = await supabase
        .from('scraping_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsError) {
        console.error('Jobs error:', jobsError);
        throw new Error(`Failed to load jobs: ${jobsError.message}`);
      }
      setJobs(jobsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      let errorMessage = 'Unknown error occurred while loading data';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setConnectionError(errorMessage);
    }
  };

  const handleScrape = async (type: 'post_comments' | 'profile_details' | 'mixed', url: string) => {
    // Check connection before starting scraping
    if (connectionError) {
      alert('Cannot start scraping: Database connection error. Please check your Supabase configuration.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('scraping_jobs')
        .insert({
          job_type: type,
          input_url: url,
          status: 'running'
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // For now, just mark as completed since we removed Apify integration
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'completed',
          results_count: 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      await loadData();
      alert('Scraping job created successfully! (Note: Actual scraping functionality requires API setup)');
    } catch (error) {
      console.error('Scraping error:', error);
      alert('Error creating scraping job: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (profileUrl: string) => {
    try {
      // Placeholder for profile update functionality
      alert('Profile update functionality requires API setup');
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const handleUpdateSelectedProfiles = async (profileUrls: string[]) => {
    setIsUpdating(true);
    
    try {
      // Placeholder for bulk update functionality
      alert('Bulk update functionality requires API setup');
    } catch (error) {
      console.error('Error updating selected profiles:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteSelectedProfiles = async (profileIds: string[]) => {
    try {
      const { error } = await supabase
        .from('linkedin_profiles')
        .delete()
        .in('id', profileIds);

      if (error) throw error;
      
      await loadData();
    } catch (error) {
      console.error('Error deleting profiles:', error);
    }
  };

  const handleExport = (format: string, selectedOnly: boolean = false) => {
    exportData(profiles, format, 'linkedin_profiles');
  };

  const handleViewProfileDetails = (profile: any) => {
    alert('Profile details view functionality is temporarily disabled');
  };

  // Handle tab changes and ensure data is loaded
  const handleTabChange = async (tab: 'scraper' | 'profiles' | 'jobs') => {
    setActiveTab(tab);
    
    // Ensure profiles data is fresh when switching to profiles tab
    if (tab === 'profiles') {
      await loadData();
    }
  };

  const handleRetryConnection = async () => {
    setConnectionError('');
    await initializeApp();
  };

  // Show loading screen while checking authentication
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="p-3 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Linkedin className="w-8 h-8 text-blue-600" />
          </div>
          <div className="text-lg font-medium text-gray-900 mb-2">LinkedIn Scraper</div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Show authentication screen if user is not logged in
  if (!user) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  // Show connection error banner if there's a connection issue
  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Connection Error</h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              Unable to connect to the database. This usually means:
            </p>
            
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Supabase environment variables are not configured</li>
              <li>The Supabase URL or API key is incorrect</li>
              <li>Your Supabase project may be paused or inactive</li>
              <li>Network connectivity issues</li>
            </ul>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Error Details:</p>
              <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-auto max-h-40">
                {connectionError}
              </pre>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleRetryConnection}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry Connection
              </button>
              <button
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Open Supabase Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Linkedin className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">LinkedIn Scraper</h1>
            </div>
            
            <div className="flex items-center gap-6">
              <nav className="flex space-x-1">
                <button
                  onClick={() => handleTabChange('scraper')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'scraper'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Activity className="w-4 h-4 inline mr-2" />
                  Scraper
                </button>
                <button
                  onClick={() => handleTabChange('profiles')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'profiles'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Database className="w-4 h-4 inline mr-2" />
                  Profiles ({profiles.length})
                </button>
                <button
                  onClick={() => handleTabChange('jobs')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'jobs'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Activity className="w-4 h-4 inline mr-2" />
                  Jobs ({jobs.length})
                </button>
              </nav>

              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scraper' && (
          <div className="space-y-8">
            <ScrapingForm onScrape={handleScrape} isLoading={isLoading} />
            
            {/* Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Database className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{profiles.length}</div>
                    <div className="text-sm text-gray-600">Total Profiles</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {jobs.filter(j => j.status === 'completed').length}
                    </div>
                    <div className="text-sm text-gray-600">Completed Jobs</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Activity className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {jobs.filter(j => j.status === 'running').length}
                    </div>
                    <div className="text-sm text-gray-600">Running Jobs</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <DataTable
            profiles={profiles}
            onUpdateProfile={handleUpdateProfile}
            onUpdateSelectedProfiles={handleUpdateSelectedProfiles}
            onDeleteSelectedProfiles={handleDeleteSelectedProfiles}
            onExport={handleExport}
            onViewDetails={handleViewProfileDetails}
            isUpdating={isUpdating}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsTable jobs={jobs} />
        )}
      </main>
    </div>
  );
}

export default App;