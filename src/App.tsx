import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { ScrapingForm } from './components/ScrapingForm';
import { DataTable } from './components/DataTable';
import { CommentResults } from './components/CommentResults';
import { ProfileDetailsDisplay } from './components/ProfileDetailsDisplay';
import { LoadingProgress } from './components/LoadingProgress';
import { ProfileResultsTable } from './components/ProfileResultsTable';
import { ApifyKeyManager } from './components/ApifyKeyManager';
import { UserMenu } from './components/UserMenu';
import { UserProfile } from './components/UserProfile';
import { JobsTable } from './components/JobsTable';
import { createApifyService } from './lib/apify';
import { exportData } from './utils/export';
import { 
  supabase, 
  getCurrentUser, 
  getUserProfile, 
  checkProfileExists, 
  upsertProfile,
  getUserProfiles,
  getAllProfiles,
  type User,
  type ApifyKey,
  type LinkedInProfile,
  type ScrapingJob
} from './lib/supabase';
import { Linkedin, Database, Activity, Key, Clock, Loader2 } from 'lucide-react';

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
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // App state
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [commentersData, setCommentersData] = useState<CommentData[]>([]);
  const [profileDetails, setProfileDetails] = useState<any[]>([]);
  const [selectedProfileForDetails, setSelectedProfileForDetails] = useState<any>(null);
  const [scrapingJobs, setScrapingJobs] = useState<ScrapingJob[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles' | 'jobs'>('scraper');
  const [currentView, setCurrentView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list' | 'single-profile-details' | 'user-profile'>('form');
  const [previousView, setPreviousView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list'>('form');
  
  // Performance optimization: Add loading state for profiles tab
  const [isProfilesTabLoading, setIsProfilesTabLoading] = useState(false);
  
  // Scraping state
  const [isScraping, setIsScraping] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [loadingStage, setLoadingStage] = useState<'starting' | 'scraping_comments' | 'extracting_profiles' | 'scraping_profiles' | 'saving_data' | 'completed' | 'error'>('starting');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [scrapingType, setScrapingType] = useState<'post_comments' | 'profile_details' | 'mixed'>('post_comments');

  // Initialize auth listener
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        const profile = await getUserProfile(session.user.id);
        setUserProfile(profile);
        if (profile) {
          await loadUserData(profile.id);
        }
      }
      
      setIsLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const profile = await getUserProfile(session.user.id);
        setUserProfile(profile);
        if (profile) {
          await loadUserData(profile.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
        setProfiles([]);
        setScrapingJobs([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Performance optimization: Load only user's profiles initially
  const loadUserData = async (userId: string) => {
    try {
      // Load user's profiles and jobs initially (not all profiles)
      const [userProfilesData, jobs] = await Promise.all([
        getUserProfiles(userId), // Only fetch user's profiles for faster initial load
        loadScrapingJobs(userId)
      ]);
      
      setProfiles(userProfilesData); // Set to user's profiles only
      setScrapingJobs(jobs);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadScrapingJobs = async (userId: string): Promise<ScrapingJob[]> => {
    const { data, error } = await supabase
      .from('scraping_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error loading scraping jobs:', error);
      return [];
    }
    
    return data || [];
  };

  const updateLoadingProgress = (stage: typeof loadingStage, progress: number = 0, message: string = '') => {
    setLoadingStage(stage);
    setLoadingProgress(progress);
    setLoadingMessage(message);
  };

  const handleKeySelect = (key: ApifyKey) => {
    setSelectedKeyId(key.id);
  };

  const createScrapingJob = async (jobType: ScrapingJob['job_type'], inputUrl: string): Promise<string> => {
    if (!userProfile) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('scraping_jobs')
      .insert({
        user_id: userProfile.id,
        apify_key_id: selectedKeyId || null,
        job_type: jobType,
        input_url: inputUrl,
        status: 'running'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Refresh jobs list
    const updatedJobs = await loadScrapingJobs(userProfile.id);
    setScrapingJobs(updatedJobs);
    
    return data.id;
  };

  const updateScrapingJob = async (jobId: string, status: ScrapingJob['status'], resultsCount?: number, errorMessage?: string) => {
    if (!userProfile) return;
    
    const updateData: any = {
      status,
      ...(resultsCount !== undefined && { results_count: resultsCount }),
      ...(errorMessage && { error_message: errorMessage }),
      ...(status === 'completed' && { completed_at: new Date().toISOString() })
    };

    await supabase
      .from('scraping_jobs')
      .update(updateData)
      .eq('id', jobId);
    
    // Refresh jobs list
    const updatedJobs = await loadScrapingJobs(userProfile.id);
    setScrapingJobs(updatedJobs);
  };

  const handleScrape = async (type: 'post_comments' | 'profile_details' | 'mixed', url: string) => {
    if (!userProfile) {
      alert('Please sign in to start scraping');
      return;
    }

    if (!selectedKeyId) {
      alert('Please select an Apify API key first');
      return;
    }

    // Get the selected API key
    const { data: keyData, error: keyError } = await supabase
      .from('apify_keys')
      .select('api_key')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !keyData) {
      alert('Invalid API key selected');
      return;
    }

    setIsScraping(true);
    setScrapingType(type);
    setLoadingError('');
    updateLoadingProgress('starting', 0, 'Initializing scraping process...');
    
    let jobId: string | null = null;
    
    try {
      // Create scraping job
      jobId = await createScrapingJob(type, url);
      
      const apifyService = createApifyService(keyData.api_key);

      if (type === 'post_comments') {
        updateLoadingProgress('scraping_comments', 25, 'Extracting comments from LinkedIn post...');
        
        const datasetId = await apifyService.scrapePostComments(url);
        
        updateLoadingProgress('saving_data', 75, 'Processing comment data...');
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        setCommentersData(commentsData);
        setCurrentView('comments');
        
        updateLoadingProgress('completed', 100, 'Comments extracted successfully!');
        await updateScrapingJob(jobId, 'completed', commentsData.length);

      } else if (type === 'profile_details') {
        updateLoadingProgress('scraping_profiles', 25, 'Checking existing profiles in database...');
        
        const profileUrls = Array.isArray(url) ? url : [url];
        const profilesData = await getProfilesWithOptimization(profileUrls, apifyService, userProfile.id);
        
        updateLoadingProgress('saving_data', 75, 'Saving profile data...');
        setProfileDetails(profilesData);
        setPreviousView('form');
        setCurrentView('profile-table');
        
        updateLoadingProgress('completed', 100, 'Profile details scraped successfully!');
        await updateScrapingJob(jobId, 'completed', profilesData.length);

      } else if (type === 'mixed') {
        updateLoadingProgress('scraping_comments', 20, 'Extracting comments from LinkedIn post...');
        
        const datasetId = await apifyService.scrapePostComments(url);
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        updateLoadingProgress('extracting_profiles', 40, 'Extracting profile URLs from comments...');
        
        const profileUrls = commentsData
          .map(comment => comment.actor?.linkedinUrl)
          .filter(Boolean)
          .slice(0, 50);
        
        if (profileUrls.length > 0) {
          updateLoadingProgress('scraping_profiles', 60, `Checking and scraping ${profileUrls.length} profiles...`);
          
          const profilesData = await getProfilesWithOptimization(profileUrls, apifyService, userProfile.id);
          
          updateLoadingProgress('saving_data', 85, 'Saving all data...');
          setProfileDetails(profilesData);
          setPreviousView('form');
          setCurrentView('profile-table');
        }

        updateLoadingProgress('completed', 100, 'Mixed scraping completed successfully!');
        await updateScrapingJob(jobId, 'completed', profileUrls.length);
      }

      // Refresh profiles list - only get user's profiles if we're not on the profiles tab
      if (activeTab !== 'profiles') {
        const updatedProfiles = await getUserProfiles(userProfile.id);
        setProfiles(updatedProfiles);
      } else {
        // If we're on profiles tab, refresh all profiles
        const updatedProfiles = await getAllProfiles();
        setProfiles(updatedProfiles);
      }

    } catch (error) {
      console.error('Scraping error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Scraping failed');
      
      if (jobId) {
        await updateScrapingJob(jobId, 'failed', undefined, errorMessage);
      }
      
    } finally {
      setIsScraping(false);
    }
  };

  const getProfilesWithOptimization = async (profileUrls: string[], apifyService: any, userId: string): Promise<any[]> => {
    const results: any[] = [];
    const urlsToScrape: string[] = [];
    let savedCost = 0;
    
    updateLoadingProgress('scraping_profiles', 30, 'Checking database for existing profiles...');
    
    // Check each URL in database first
    for (const url of profileUrls) {
      const existingProfile = await checkProfileExists(url);
      if (existingProfile) {
        results.push(existingProfile.profile_data);
        savedCost++;
      } else {
        urlsToScrape.push(url);
      }
    }
    
    if (urlsToScrape.length > 0) {
      updateLoadingProgress('scraping_profiles', 50, `Scraping ${urlsToScrape.length} new profiles (saved ${savedCost} API calls)...`);
      
      const datasetId = await apifyService.scrapeProfiles(urlsToScrape);
      const newProfilesData = await apifyService.getDatasetItems(datasetId);
      
      updateLoadingProgress('scraping_profiles', 70, 'Saving new profiles to database...');
      
      // Save new profiles to database
      for (const profileData of newProfilesData) {
        if (profileData.linkedinUrl) {
          await upsertProfile(userId, profileData.linkedinUrl, profileData);
          results.push(profileData);
        }
      }
    }
    
    updateLoadingProgress('scraping_profiles', 90, `Completed! Saved ${savedCost} API calls by using cached profiles.`);
    
    return results;
  };

  const handleScrapeSelectedCommenterProfiles = async (profileUrls: string[]) => {
    if (!userProfile || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const { data: keyData, error: keyError } = await supabase
      .from('apify_keys')
      .select('api_key')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !keyData) {
      alert('Invalid API key selected');
      return;
    }
    
    setIsScraping(true);
    setScrapingType('profile_details');
    setLoadingError('');
    updateLoadingProgress('scraping_profiles', 25, `Checking and scraping ${profileUrls.length} selected profiles...`);
    
    let jobId: string | null = null;
    
    try {
      jobId = await createScrapingJob('profile_details', profileUrls.join(','));
      
      const apifyService = createApifyService(keyData.api_key);
      const profilesData = await getProfilesWithOptimization(profileUrls, apifyService, userProfile.id);
      
      updateLoadingProgress('saving_data', 75, 'Processing profile data...');
      setProfileDetails(profilesData);
      setPreviousView('comments');
      setCurrentView('profile-table');
      updateLoadingProgress('completed', 100, 'Selected profiles scraped successfully!');
      
      await updateScrapingJob(jobId, 'completed', profilesData.length);
      
      // Refresh profiles list based on current tab
      if (activeTab === 'profiles') {
        const updatedProfiles = await getAllProfiles();
        setProfiles(updatedProfiles);
      } else {
        const updatedProfiles = await getUserProfiles(userProfile.id);
        setProfiles(updatedProfiles);
      }
      
    } catch (error) {
      console.error('Error scraping selected profiles:', error);
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Failed to scrape selected profiles');
      
      if (jobId) {
        await updateScrapingJob(jobId, 'failed', undefined, errorMessage);
      }
    } finally {
      setIsScraping(false);
    }
  };

  const handleStoreSelectedProfiles = async (profilesToStore: any[], tags: string[]) => {
    if (!userProfile) return;
    
    try {
      for (const profile of profilesToStore) {
        if (profile.linkedinUrl) {
          await upsertProfile(userProfile.id, profile.linkedinUrl, profile, tags);
        }
      }
      
      // Refresh profiles list based on current tab
      if (activeTab === 'profiles') {
        const updatedProfiles = await getAllProfiles();
        setProfiles(updatedProfiles);
      } else {
        const updatedProfiles = await getUserProfiles(userProfile.id);
        setProfiles(updatedProfiles);
      }
      
      alert(`Successfully stored ${profilesToStore.length} profiles${tags.length > 0 ? ` with tags: ${tags.join(', ')}` : ''}`);
      
    } catch (error) {
      console.error('Error storing profiles:', error);
      alert('Error storing profiles. Please try again.');
    }
  };

  const handleUpdateProfile = async (profileUrl: string) => {
    if (!userProfile || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const { data: keyData, error: keyError } = await supabase
      .from('apify_keys')
      .select('api_key')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !keyData) {
      alert('Invalid API key selected');
      return;
    }

    try {
      const apifyService = createApifyService(keyData.api_key);
      const profilesData = await getProfilesWithOptimization([profileUrl], apifyService, userProfile.id);
      
      if (profilesData.length > 0) {
        // Refresh profiles list based on current tab
        if (activeTab === 'profiles') {
          const updatedProfiles = await getAllProfiles();
          setProfiles(updatedProfiles);
        } else {
          const updatedProfiles = await getUserProfiles(userProfile.id);
          setProfiles(updatedProfiles);
        }
        alert('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    }
  };

  const handleUpdateSelectedProfiles = async (profileUrls: string[]) => {
    if (!userProfile || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const { data: keyData, error: keyError } = await supabase
      .from('apify_keys')
      .select('api_key')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !keyData) {
      alert('Invalid API key selected');
      return;
    }

    try {
      const apifyService = createApifyService(keyData.api_key);
      await getProfilesWithOptimization(profileUrls, apifyService, userProfile.id);
      
      // Refresh profiles list based on current tab
      if (activeTab === 'profiles') {
        const updatedProfiles = await getAllProfiles();
        setProfiles(updatedProfiles);
      } else {
        const updatedProfiles = await getUserProfiles(userProfile.id);
        setProfiles(updatedProfiles);
      }
      alert(`Successfully updated ${profileUrls.length} profiles!`);
    } catch (error) {
      console.error('Error updating profiles:', error);
      alert('Error updating profiles. Please try again.');
    }
  };

  const handleDeleteSelectedProfiles = async (profileIds: string[]) => {
    if (!userProfile) return;
    
    try {
      const { error } = await supabase
        .from('linkedin_profiles')
        .delete()
        .in('id', profileIds);
      
      if (error) throw error;
      
      // Refresh profiles list based on current tab
      if (activeTab === 'profiles') {
        const updatedProfiles = await getAllProfiles();
        setProfiles(updatedProfiles);
      } else {
        const updatedProfiles = await getUserProfiles(userProfile.id);
        setProfiles(updatedProfiles);
      }
      
      alert(`Successfully deleted ${profileIds.length} profiles`);
    } catch (error) {
      console.error('Error deleting profiles:', error);
      alert('Error deleting profiles. Please try again.');
    }
  };

  const handleExport = (format: string, selectedOnly: boolean = false) => {
    exportData(profiles, format, 'linkedin_profiles');
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

  // Performance optimization: Load all profiles only when profiles tab is clicked
  const handleTabChange = async (tab: 'scraper' | 'profiles' | 'jobs') => {
    setActiveTab(tab);
    
    if (tab === 'profiles') {
      setCurrentView('profiles-list');
      setIsProfilesTabLoading(true);
      try {
        const allProfilesData = await getAllProfiles();
        setProfiles(allProfilesData);
      } catch (error) {
        console.error('Error loading all profiles:', error);
      } finally {
        setIsProfilesTabLoading(false);
      }
    } else if (tab === 'scraper') {
      setCurrentView('form');
      // Load user's profiles when switching back to scraper
      if (userProfile) {
        try {
          const userProfilesData = await getUserProfiles(userProfile.id);
          setProfiles(userProfilesData);
        } catch (error) {
          console.error('Error loading user profiles:', error);
        }
      }
    } else if (tab === 'jobs') {
      setCurrentView('form'); // Jobs will be shown in the main content
    }
  };

  const handleOpenProfile = () => {
    setCurrentView('user-profile');
  };

  const handleAuthSuccess = () => {
    // Auth state will be handled by the auth listener
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
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
                  <Clock className="w-4 h-4 inline mr-2" />
                  Jobs ({scrapingJobs.length})
                </button>
              </nav>
              
              <UserMenu user={user} onOpenProfile={handleOpenProfile} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'user-profile' ? (
          <UserProfile user={user} onBack={() => setCurrentView('form')} />
        ) : (
          <>
            {/* API Key Management */}
            {(activeTab === 'scraper' && currentView === 'form') && (
              <div className="mb-8">
                <ApifyKeyManager
                  userId={userProfile.id}
                  selectedKeyId={selectedKeyId}
                  onKeySelect={handleKeySelect}
                />
              </div>
            )}

            {activeTab === 'scraper' && (
              <div className="space-y-8">
                {currentView === 'form' && (
                  <>
                    <ScrapingForm 
                      onScrape={handleScrape} 
                      isLoading={isScraping}
                      disabled={!selectedKeyId}
                    />
                    
                    {isScraping && (
                      <LoadingProgress
                        type={scrapingType}
                        stage={loadingStage}
                        progress={loadingProgress}
                        message={loadingMessage}
                        error={loadingError}
                      />
                    )}
                    
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Database className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-gray-900">{profiles.length}</div>
                            <div className="text-sm text-gray-600">Your Profiles</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Activity className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-gray-900">{scrapingJobs.filter(j => j.status === 'completed').length}</div>
                            <div className="text-sm text-gray-600">Completed Jobs</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Linkedin className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-gray-900">{commentersData.length}</div>
                            <div className="text-sm text-gray-600">Last Comments</div>
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
                    isLoading={isScraping}
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
                      onStoreSelectedProfiles={handleStoreSelectedProfiles}
                      showActions={false}
                      showStoreOption={true}
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
                    profiles={selectedProfileForDetails ? [selectedProfileForDetails.profile_data] : []}
                    onBack={handleBackToProfilesList}
                  />
                ) : (
                  // Performance optimization: Show loading indicator while fetching all profiles
                  isProfilesTabLoading ? (
                    <div className="min-h-[400px] flex items-center justify-center bg-white rounded-xl shadow-lg border border-gray-100">
                      <div className="text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                        <div className="text-gray-600 text-lg font-medium">Loading all profiles...</div>
                        <div className="text-gray-500 text-sm mt-2">This may take a moment</div>
                      </div>
                    </div>
                  ) : (
                    <DataTable
                      profiles={profiles}
                      onUpdateProfile={handleUpdateProfile}
                      onUpdateSelectedProfiles={handleUpdateSelectedProfiles}
                      onDeleteSelectedProfiles={handleDeleteSelectedProfiles}
                      onExport={handleExport}
                      onViewDetails={(profile) => handleViewProfileDetails(profile)}
                      isUpdating={false}
                    />
                  )
                )}
              </>
            )}

            {activeTab === 'jobs' && (
              <JobsTable jobs={scrapingJobs} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;