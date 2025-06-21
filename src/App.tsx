import React, { useState, useEffect } from 'react';
import { ScrapingForm } from './components/ScrapingForm';
import { DataTable } from './components/DataTable';
import { JobsTable } from './components/JobsTable';
import { CommentResults } from './components/CommentResults';
import { ProfileDetailsDisplay } from './components/ProfileDetailsDisplay';
import { LoadingProgress } from './components/LoadingProgress';
import { ProfileResultsTable } from './components/ProfileResultsTable';
import { Auth } from './components/Auth';
import { UserMenu } from './components/UserMenu';
import { UserProfile } from './components/UserProfile';
import { supabase, testSupabaseConnection, simpleConnectionTest, safeSupabaseOperation } from './lib/supabase';
import { apifyService } from './lib/apify';
import { exportData } from './utils/export';
import { processProfileImages } from './utils/imageUtils';
import { Linkedin, Database, Activity, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

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

interface CommentData {
  type: string;
  id: string;
  linkedinUrl: string;
  commentary: string;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    linkedinUrl: string;
    position: string;
    pictureUrl: string;
  };
}

function App() {
  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Application state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [commentersData, setCommentersData] = useState<CommentData[]>([]);
  const [profileDetails, setProfileDetails] = useState<any[]>([]);
  const [selectedProfileForDetails, setSelectedProfileForDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles' | 'jobs'>('scraper');
  const [currentView, setCurrentView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list' | 'single-profile-details' | 'user-profile'>('form');
  const [previousView, setPreviousView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list'>('form');
  const [connectionError, setConnectionError] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Loading progress states
  const [loadingStage, setLoadingStage] = useState<'starting' | 'scraping_comments' | 'extracting_profiles' | 'scraping_profiles' | 'saving_data' | 'completed' | 'error'>('starting');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [scrapingType, setScrapingType] = useState<'post_comments' | 'profile_details' | 'mixed'>('post_comments');

  useEffect(() => {
    // Initialize authentication
    initializeAuth();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Connection restored');
      // Retry connection when coming back online
      if (connectionError) {
        handleRetryConnection();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('Connection lost');
      setConnectionError('No internet connection. Please check your network and try again.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Load data when user is authenticated and online
    if (user && isOnline) {
      initializeApp();
    }
  }, [user, isOnline]);

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
            setCommentersData([]);
            setProfileDetails([]);
            setSelectedProfileForDetails(null);
            setActiveTab('scraper');
            setCurrentView('form');
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
    // Check if we're online first
    if (!isOnline) {
      setConnectionError('No internet connection. Please check your network and try again.');
      return;
    }
    
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
      
      // Load profiles with enhanced error handling
      const profilesResult = await safeSupabaseOperation(
        () => supabase
          .from('linkedin_profiles')
          .select('*')
          .order('last_updated', { ascending: false })
          .limit(100),
        'loading profiles'
      );

      if (profilesResult.error) {
        console.error('Profiles error:', profilesResult.error);
        
        // Handle specific errors
        if (profilesResult.error.code === 'PGRST116' || 
            (profilesResult.error.message && profilesResult.error.message.includes('does not exist'))) {
          // Table doesn't exist - this is OK for initial setup
          console.log('Tables not found - this is normal for initial setup');
          setProfiles([]);
        } else if (profilesResult.error.code === 'NETWORK_ERROR') {
          throw new Error(profilesResult.error.message);
        } else {
          throw new Error(`Failed to load profiles: ${profilesResult.error.message}`);
        }
      } else {
        setProfiles(profilesResult.data || []);
      }

      // Load jobs with enhanced error handling
      const jobsResult = await safeSupabaseOperation(
        () => supabase
          .from('scraping_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        'loading jobs'
      );

      if (jobsResult.error) {
        console.error('Jobs error:', jobsResult.error);
        
        // Handle specific errors
        if (jobsResult.error.code === 'PGRST116' || 
            (jobsResult.error.message && jobsResult.error.message.includes('does not exist'))) {
          // Table doesn't exist - this is OK for initial setup
          console.log('Jobs table not found - this is normal for initial setup');
          setJobs([]);
        } else if (jobsResult.error.code === 'NETWORK_ERROR') {
          throw new Error(jobsResult.error.message);
        } else {
          throw new Error(`Failed to load jobs: ${jobsResult.error.message}`);
        }
      } else {
        setJobs(jobsResult.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      let errorMessage = 'Unknown error occurred while loading data';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setConnectionError(errorMessage);
    }
  };

  const updateLoadingProgress = (stage: typeof loadingStage, progress: number = 0, message: string = '') => {
    setLoadingStage(stage);
    setLoadingProgress(progress);
    setLoadingMessage(message);
  };

  const handleScrape = async (type: 'post_comments' | 'profile_details' | 'mixed', url: string) => {
    // Check connection before starting scraping
    if (!isOnline) {
      alert('Cannot start scraping: No internet connection. Please check your network and try again.');
      return;
    }
    
    if (connectionError) {
      alert('Cannot start scraping: Database connection error. Please check your Supabase configuration.');
      return;
    }

    setIsLoading(true);
    setScrapingType(type);
    setLoadingError('');
    updateLoadingProgress('starting', 0, 'Initializing scraping process...');
    
    try {
      // Create job record with enhanced error handling
      const jobResult = await safeSupabaseOperation(
        () => supabase
          .from('scraping_jobs')
          .insert({
            job_type: type,
            input_url: url,
            status: 'running'
          })
          .select()
          .single(),
        'creating job record'
      );

      if (jobResult.error) {
        throw new Error(`Failed to create job record: ${jobResult.error.message}`);
      }

      const job = jobResult.data;

      // Refresh jobs list
      await loadData();

      if (type === 'post_comments') {
        updateLoadingProgress('scraping_comments', 25, 'Extracting comments from LinkedIn post...');
        
        // Scrape post comments and show them to user
        const datasetId = await apifyService.scrapePostComments(url);
        
        updateLoadingProgress('saving_data', 75, 'Processing comment data...');
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        setCommentersData(commentsData);
        setCurrentView('comments');
        
        updateLoadingProgress('completed', 100, 'Comments extracted successfully!');

        // Update job status
        await safeSupabaseOperation(
          () => supabase
            .from('scraping_jobs')
            .update({
              status: 'completed',
              results_count: commentsData.length,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id),
          'updating job status'
        );

      } else if (type === 'profile_details') {
        updateLoadingProgress('scraping_profiles', 25, 'Gathering detailed profile information...');
        
        // Scrape single profile and show details
        const profilesData = await getProfilesWithDetails([url]);
        
        updateLoadingProgress('saving_data', 75, 'Saving profile data...');
        setProfileDetails(profilesData);
        setPreviousView('form'); // Set previous view to form for single profile scraping
        setCurrentView('profile-table');
        
        updateLoadingProgress('completed', 100, 'Profile details scraped successfully!');
        
        // Update job status
        await safeSupabaseOperation(
          () => supabase
            .from('scraping_jobs')
            .update({
              status: 'completed',
              results_count: profilesData.length,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id),
          'updating job status'
        );

      } else if (type === 'mixed') {
        updateLoadingProgress('scraping_comments', 20, 'Extracting comments from LinkedIn post...');
        
        // Scrape post comments first
        const datasetId = await apifyService.scrapePostComments(url);
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        updateLoadingProgress('extracting_profiles', 40, 'Extracting profile URLs from comments...');
        
        // Extract profile URLs from comments
        const profileUrls = commentsData
          .map(comment => comment.actor?.linkedinUrl)
          .filter(Boolean)
          .slice(0, 50); // Limit to first 50 profiles
        
        if (profileUrls.length > 0) {
          updateLoadingProgress('scraping_profiles', 60, `Scraping ${profileUrls.length} profile details...`);
          
          const profilesData = await getProfilesWithDetails(profileUrls);
          
          updateLoadingProgress('saving_data', 85, 'Saving all data...');
          setProfileDetails(profilesData);
          setPreviousView('form'); // Set previous view to form for mixed scraping
          setCurrentView('profile-table');
        }

        updateLoadingProgress('completed', 100, 'Mixed scraping completed successfully!');

        // Update job status
        await safeSupabaseOperation(
          () => supabase
            .from('scraping_jobs')
            .update({
              status: 'completed',
              results_count: profileUrls.length,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id),
          'updating job status'
        );
      }

      await loadData();
    } catch (error) {
      console.error('Scraping error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more helpful error messages for common issues
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
          errorMessage = 'Network connection failed. Please check your internet connection and try again.';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = 'Request timed out. The service may be slow to respond. Please try again.';
        }
      }
      
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Scraping failed');
      
      // Update job status to failed
      const jobsResult = await safeSupabaseOperation(
        () => supabase
          .from('scraping_jobs')
          .select('id')
          .eq('input_url', url)
          .eq('status', 'running')
          .order('created_at', { ascending: false })
          .limit(1),
        'finding job to update'
      );

      if (jobsResult.data && jobsResult.data.length > 0) {
        await safeSupabaseOperation(
          () => supabase
            .from('scraping_jobs')
            .update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString()
            })
            .eq('id', jobsResult.data[0].id),
          'updating failed job status'
        );
      }
      
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const getProfilesWithDetails = async (profileUrls: string[]): Promise<any[]> => {
    // Check which profiles already exist in database
    const existingProfilesResult = await safeSupabaseOperation(
      () => supabase
        .from('linkedin_profiles')
        .select('*')
        .in('linkedin_url', profileUrls),
      'checking existing profiles'
    );

    const existingUrlsMap = new Map();
    if (existingProfilesResult.data) {
      existingProfilesResult.data.forEach(profile => {
        existingUrlsMap.set(profile.linkedin_url, profile.profile_data);
      });
    }

    const newUrls = profileUrls.filter(url => !existingUrlsMap.has(url));
    const allProfileDetails = [];

    // Add existing profiles from database
    profileUrls.forEach(url => {
      if (existingUrlsMap.has(url)) {
        allProfileDetails.push(existingUrlsMap.get(url));
      }
    });

    // Scrape new profiles if any
    if (newUrls.length > 0) {
      const datasetId = await apifyService.scrapeProfiles(newUrls);
      const newProfilesData = await apifyService.getDatasetItems(datasetId);
      
      // Store new profiles in database and add to results
      for (let i = 0; i < newProfilesData.length; i++) {
        const profileData = newProfilesData[i];
        const linkedinUrl = profileData.linkedinUrl;
        if (linkedinUrl) {
          // Process images to base64
          updateLoadingProgress('saving_data', 80 + (i / newProfilesData.length) * 15, `Converting images for profile ${i + 1}/${newProfilesData.length}...`);
          const processedProfile = await processProfileImages(profileData);
          
          // Store in database using UPSERT to prevent duplicates
          await safeSupabaseOperation(
            () => supabase
              .from('linkedin_profiles')
              .upsert({
                linkedin_url: linkedinUrl,
                profile_data: processedProfile,
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'linkedin_url'
              }),
            'saving profile data'
          );
          
          // Add to results
          allProfileDetails.push(processedProfile);
        }
      }
    }

    return allProfileDetails;
  };

  const handleScrapeSelectedCommenterProfiles = async (profileUrls: string[]) => {
    if (!isOnline) {
      alert('Cannot start scraping: No internet connection. Please check your network and try again.');
      return;
    }
    
    setIsLoading(true);
    setScrapingType('profile_details');
    setLoadingError('');
    updateLoadingProgress('scraping_profiles', 25, `Scraping ${profileUrls.length} selected profiles...`);
    
    try {
      const profilesData = await getProfilesWithDetails(profileUrls);
      updateLoadingProgress('saving_data', 75, 'Processing profile data...');
      setProfileDetails(profilesData);
      setPreviousView('comments'); // Remember we came from comments
      setCurrentView('profile-table');
      updateLoadingProgress('completed', 100, 'Selected profiles scraped successfully!');
      
      // Refresh the main profiles data
      await loadData();
    } catch (error) {
      console.error('Error scraping selected profiles:', error);
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
          errorMessage = 'Network connection failed. Please check your internet connection and try again.';
        }
      }
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Failed to scrape selected profiles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (profileUrl: string) => {
    try {
      // Force update by scraping new data
      const datasetId = await apifyService.scrapeProfiles([profileUrl]);
      const profilesData = await apifyService.getDatasetItems(datasetId);
      
      if (profilesData.length > 0) {
        const profileData = profilesData[0];
        const linkedinUrl = profileData.linkedinUrl;
        
        // Process images to base64
        const processedProfile = await processProfileImages(profileData);
        
        // Update in database using UPSERT to prevent duplicates
        await safeSupabaseOperation(
          () => supabase
            .from('linkedin_profiles')
            .upsert({
              linkedin_url: linkedinUrl,
              profile_data: processedProfile,
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'linkedin_url'
            }),
          'updating profile'
        );
      }
      
      await loadData();
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error; // Re-throw to handle in component
    }
  };

  const handleUpdateSelectedProfiles = async (profileUrls: string[]) => {
    if (!isOnline) {
      alert('Cannot update profiles: No internet connection. Please check your network and try again.');
      return;
    }
    
    setIsUpdating(true);
    
    try {
      // Update profiles in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < profileUrls.length; i += batchSize) {
        const batch = profileUrls.slice(i, i + batchSize);
        
        // Scrape batch
        const datasetId = await apifyService.scrapeProfiles(batch);
        const profilesData = await apifyService.getDatasetItems(datasetId);
        
        // Update each profile in the database
        for (const profileData of profilesData) {
          const linkedinUrl = profileData.linkedinUrl;
          if (linkedinUrl) {
            // Process images to base64
            const processedProfile = await processProfileImages(profileData);
            
            // Update in database using UPSERT to prevent duplicates
            await safeSupabaseOperation(
              () => supabase
                .from('linkedin_profiles')
                .upsert({
                  linkedin_url: linkedinUrl,
                  profile_data: processedProfile,
                  last_updated: new Date().toISOString()
                }, {
                  onConflict: 'linkedin_url'
                }),
              'updating profile in batch'
            );
          }
        }
      }
      
      await loadData();
    } catch (error) {
      console.error('Error updating selected profiles:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteSelectedProfiles = async (profileIds: string[]) => {
    try {
      const deleteResult = await safeSupabaseOperation(
        () => supabase
          .from('linkedin_profiles')
          .delete()
          .in('id', profileIds),
        'deleting profiles'
      );

      if (deleteResult.error) {
        throw new Error(deleteResult.error.message);
      }
      
      await loadData();
    } catch (error) {
      console.error('Error deleting profiles:', error);
    }
  };

  const handleExport = (format: string, selectedOnly: boolean = false) => {
    if (selectedOnly) {
      // Export only selected profiles - this would need to be implemented
      // For now, export all profiles
      exportData(profiles, format, 'linkedin_profiles_selected');
    } else {
      exportData(profiles, format, 'linkedin_profiles');
    }
  };

  const handleExportProfileResults = (format: string) => {
    exportData(profileDetails.map(profile => ({ profile_data: profile })), format, 'profile_results');
  };

  const handleBackToForm = () => {
    setCurrentView('form');
    setCommentersData([]);
    setProfileDetails([]);
    setSelectedProfileForDetails(null);
    setPreviousView('form');
    setLoadingStage('starting');
    setLoadingProgress(0);
    setLoadingMessage('');
    setLoadingError('');
  };

  const handleBackToPrevious = () => {
    if (previousView === 'comments') {
      setCurrentView('comments');
    } else if (previousView === 'profiles-list') {
      setCurrentView('profiles-list');
      setActiveTab('profiles');
    } else if (previousView === 'profile-table') {
      setCurrentView('profile-table');
    } else {
      setCurrentView('form');
    }
  };

  const handleViewProfileDetails = (profile: any) => {
    // Set the previous view based on current context
    if (activeTab === 'profiles') {
      setPreviousView('profiles-list');
      setSelectedProfileForDetails(profile);
      setCurrentView('single-profile-details');
    } else {
      setPreviousView(currentView);
      setProfileDetails([profile]);
      setCurrentView('profile-details');
    }
  };

  const handleBackToProfilesList = () => {
    setCurrentView('profiles-list');
    setSelectedProfileForDetails(null);
  };

  const handleOpenUserProfile = () => {
    setCurrentView('user-profile');
  };

  const handleBackFromUserProfile = () => {
    setCurrentView('form');
    setActiveTab('scraper');
  };

  // Handle tab changes and ensure data is loaded
  const handleTabChange = async (tab: 'scraper' | 'profiles' | 'jobs') => {
    setActiveTab(tab);
    
    // Set appropriate view based on tab
    if (tab === 'profiles') {
      setCurrentView('profiles-list');
      // Ensure profiles data is fresh when switching to profiles tab
      if (isOnline && !connectionError) {
        await loadData();
      }
    } else if (tab === 'scraper') {
      setCurrentView('form');
    } else if (tab === 'jobs') {
      setCurrentView('form'); // Jobs tab doesn't need special view handling
    }
  };

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    setConnectionError('');
    
    try {
      // Check if we're online first
      if (!isOnline) {
        throw new Error('No internet connection. Please check your network and try again.');
      }
      
      // Try simple connection test first
      const simpleTest = await simpleConnectionTest();
      if (simpleTest.success) {
        await initializeApp();
      } else {
        // Try full connection test
        await initializeApp();
      }
    } catch (error) {
      console.error('Retry failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Retry failed');
    } finally {
      setIsRetrying(false);
    }
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

  // Show user profile if that view is active
  if (currentView === 'user-profile') {
    return <UserProfile user={user} onBack={handleBackFromUserProfile} />;
  }

  // Show connection error banner if there's a connection issue
  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              {isOnline ? (
                <AlertCircle className="w-6 h-6 text-red-600" />
              ) : (
                <WifiOff className="w-6 h-6 text-red-600" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isOnline ? 'Connection Issue' : 'No Internet Connection'}
            </h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              {isOnline 
                ? 'There was an issue connecting to the database:'
                : 'You appear to be offline. Please check your internet connection.'
              }
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Error Details:</p>
              <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-auto max-h-40">
                {connectionError}
              </pre>
            </div>
            
            {isOnline && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">This could be due to:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Network connectivity issues</li>
                  <li>Supabase project configuration</li>
                  <li>Database tables not yet created (normal for first setup)</li>
                  <li>Temporary service interruption</li>
                  <li>Firewall or proxy blocking the connection</li>
                </ul>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={handleRetryConnection}
                disabled={isRetrying || !isOnline}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {isOnline ? 'Retry Connection' : 'Check Connection'}
                  </>
                )}
              </button>
              {isOnline && (
                <button
                  onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Open Supabase Dashboard
                </button>
              )}
            </div>
            
            {/* Connection status indicator */}
            <div className="flex items-center justify-center gap-2 text-sm">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">Internet Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span className="text-red-600">No Internet Connection</span>
                </>
              )}
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
              
              {/* Connection status indicator in header */}
              <div className="flex items-center gap-1">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-600" />
                )}
              </div>
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

              <UserMenu user={user} onOpenProfile={handleOpenUserProfile} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scraper' && (
          <div className="space-y-8">
            {currentView === 'form' && (
              <>
                <ScrapingForm onScrape={handleScrape} isLoading={isLoading} />
                
                {/* Loading Progress */}
                {isLoading && (
                  <LoadingProgress
                    type={scrapingType}
                    stage={loadingStage}
                    progress={loadingProgress}
                    message={loadingMessage}
                    error={loadingError}
                  />
                )}
                
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
              </>
            )}

            {currentView === 'comments' && (
              <CommentResults
                comments={commentersData}
                onScrapeSelectedProfiles={handleScrapeSelectedCommenterProfiles}
                isLoading={isLoading}
                onBack={handleBackToForm}
                loadingStage={loadingStage}
                loadingProgress={loadingProgress}
                loadingMessage={loadingMessage}
                loadingError={loadingError}
              />
            )}

            {currentView === 'profile-table' && (
              <div className="space-y-6">
                <ProfileResultsTable
                  profiles={profileDetails}
                  onViewDetails={handleViewProfileDetails}
                  onExport={handleExportProfileResults}
                  showActions={false}
                />
                
                <div className="flex justify-center">
                  <button
                    onClick={handleBackToPrevious}
                    className="px-6 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {previousView === 'comments' ? 'Back to Comments' : 'Back to Scraper'}
                  </button>
                </div>
              </div>
            )}

            {currentView === 'profile-details' && (
              <ProfileDetailsDisplay
                profiles={profileDetails}
                onBack={handleBackToPrevious}
              />
            )}
          </div>
        )}

        {activeTab === 'profiles' && (
          <>
            {currentView === 'single-profile-details' ? (
              <ProfileDetailsDisplay
                profiles={selectedProfileForDetails ? [selectedProfileForDetails] : []}
                onBack={handleBackToProfilesList}
              />
            ) : (
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
          </>
        )}

        {activeTab === 'jobs' && (
          <JobsTable jobs={jobs} />
        )}
      </main>
    </div>
  );
}

export default App;