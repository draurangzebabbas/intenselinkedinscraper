import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { ScrapingForm } from './components/ScrapingForm';
import { CommentResults } from './components/CommentResults';
import { ProfileDetailsDisplay } from './components/ProfileDetailsDisplay';
import { LoadingProgress } from './components/LoadingProgress';
import { ProfileResultsTable } from './components/ProfileResultsTable';
import { ApifyKeyManager } from './components/ApifyKeyManager';
import { JobsTable } from './components/JobsTable';
import { DataTable } from './components/DataTable';
import { UserMenu } from './components/UserMenu';
import { UserProfile } from './components/UserProfile';
import { createApifyService } from './lib/apify';
import { SupabaseProfilesService } from './lib/supabaseProfiles';
import { supabase, getCurrentUser, getOrCreateUserProfile, type User, type ApifyKey, type ScrapingJob } from './lib/supabase';
import { exportData } from './utils/export';
import { 
  Linkedin, Database, Activity, Clock, Loader2, AlertCircle, 
  User as UserIcon, MessageCircle
} from 'lucide-react';

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
  const [profiles, setProfiles] = useState<any[]>([]);
  const [commentersData, setCommentersData] = useState<CommentData[]>([]);
  const [profileDetails, setProfileDetails] = useState<any[]>([]);
  const [selectedProfileForDetails, setSelectedProfileForDetails] = useState<any>(null);
  const [scrapingJobs, setScrapingJobs] = useState<ScrapingJob[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles' | 'jobs' | 'profile'>('scraper');
  const [currentView, setCurrentView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list' | 'single-profile-details' | 'user-profile'>('form');
  const [previousView, setPreviousView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list'>('form');
  
  // Scraping state
  const [isScraping, setIsScraping] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [loadingStage, setLoadingStage] = useState<'starting' | 'scraping_comments' | 'extracting_profiles' | 'scraping_profiles' | 'saving_data' | 'completed' | 'error'>('starting');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [scrapingType, setScrapingType] = useState<'post_comments' | 'profile_details' | 'mixed'>('post_comments');

  // Initialize app and auth listener
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setUserProfile(null);
        setProfiles([]);
        setScrapingJobs([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUserId: string) => {
    try {
      const profile = await getOrCreateUserProfile(authUserId);
      if (profile) {
        setUserProfile(profile);
        await loadUserData(profile.id);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      console.log('📊 Loading data for user:', userId);
      
      // Load user's stored profiles from Supabase
      const userProfiles = await SupabaseProfilesService.getUserProfiles(userId);
      console.log('🌐 Supabase profiles for user:', userProfiles.length);
      setProfiles(userProfiles);
      
      // Load scraping jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('scraping_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error('Error loading jobs:', jobsError);
      } else {
        setScrapingJobs(jobs || []);
      }
      
      console.log(`✅ Loaded ${userProfiles.length} profiles and ${jobs?.length || 0} jobs for user ${userId}`);
    } catch (error) {
      console.error('❌ Error loading user data:', error);
    }
  };

  const updateLoadingProgress = (stage: typeof loadingStage, progress: number = 0, message: string = '') => {
    setLoadingStage(stage);
    setLoadingProgress(progress);
    setLoadingMessage(message);
  };

  const handleKeySelect = (key: ApifyKey) => {
    console.log('🔑 API key selected:', key.key_name);
    setSelectedKeyId(key.id);
  };

  const handleAuthSuccess = () => {
    // Auth state will be handled by the auth listener
    console.log('Auth success - user will be loaded by auth listener');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleOpenProfile = () => {
    setActiveTab('profile');
    setCurrentView('user-profile');
  };

  const handleFeedback = () => {
    // You can replace this URL with your Google Form link
    window.open('https://forms.google.com/your-form-link', '_blank');
  };

  const handleScrape = async (type: 'post_comments' | 'profile_details' | 'mixed', url: string) => {
    if (!userProfile) {
      alert('Please sign in first');
      return;
    }

    if (!selectedKeyId) {
      alert('Please select an Apify API key first');
      return;
    }

    // Get the selected API key
    const { data: selectedKey, error: keyError } = await supabase
      .from('apify_keys')
      .select('*')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !selectedKey) {
      alert('Invalid API key selected');
      return;
    }

    setIsScraping(true);
    setScrapingType(type);
    setLoadingError('');
    updateLoadingProgress('starting', 0, 'Initializing scraping process...');
    
    // Create job in database
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        user_id: userProfile.id,
        apify_key_id: selectedKeyId,
        job_type: type,
        input_url: url,
        status: 'running'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      setIsScraping(false);
      return;
    }

    setScrapingJobs(prev => [job, ...prev]);
    
    try {
      const apifyService = createApifyService(selectedKey.api_key);

      if (type === 'post_comments') {
        updateLoadingProgress('scraping_comments', 25, 'Extracting comments from LinkedIn post...');
        
        const datasetId = await apifyService.scrapePostComments(url);
        
        updateLoadingProgress('saving_data', 75, 'Processing comment data...');
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        setCommentersData(commentsData);
        setCurrentView('comments');
        
        updateLoadingProgress('completed', 100, 'Comments extracted successfully!');
        
        // Update job
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            results_count: commentsData.length,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

      } else if (type === 'profile_details') {
        updateLoadingProgress('scraping_profiles', 25, 'Checking existing profiles...');
        
        const profileUrls = url.split('\n')
          .map(u => u.trim())
          .filter(u => u.length > 0);
        
        const profilesData = await getProfilesWithOptimization(profileUrls, apifyService);
        
        updateLoadingProgress('saving_data', 75, 'Saving profile data...');
        setProfileDetails(profilesData);
        setPreviousView('form');
        setCurrentView('profile-table');
        
        updateLoadingProgress('completed', 100, 'Profile details scraped successfully!');
        
        // Update job
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            results_count: profilesData.length,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

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
          
          const profilesData = await getProfilesWithOptimization(profileUrls, apifyService);
          
          updateLoadingProgress('saving_data', 85, 'Saving all data...');
          setProfileDetails(profilesData);
          setPreviousView('form');
          setCurrentView('profile-table');
        }

        updateLoadingProgress('completed', 100, 'Mixed scraping completed successfully!');
        
        // Update job
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            results_count: profileUrls.length,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }

      // Reload jobs to show updated status
      await loadUserData(userProfile.id);

    } catch (error) {
      console.error('❌ Scraping error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Scraping failed');
      
      // Update job with error
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
      
      // Reload jobs to show updated status
      await loadUserData(userProfile.id);
      
    } finally {
      setIsScraping(false);
    }
  };

  const getProfilesWithOptimization = async (profileUrls: string[], apifyService: any): Promise<any[]> => {
    const results: any[] = [];
    const urlsToScrape: string[] = [];
    let savedCost = 0;
    
    updateLoadingProgress('scraping_profiles', 30, 'Checking global database for existing profiles...');
    
    // Check each URL in global database first
    for (const url of profileUrls) {
      try {
        const existingProfile = await SupabaseProfilesService.checkProfileExists(url);
        if (existingProfile) {
          results.push(existingProfile.profile_data);
          savedCost++;
        } else {
          urlsToScrape.push(url);
        }
      } catch (error) {
        console.error('❌ Error checking profile existence for', url, ':', error);
        urlsToScrape.push(url);
      }
    }
    
    if (urlsToScrape.length > 0) {
      updateLoadingProgress('scraping_profiles', 50, `Scraping ${urlsToScrape.length} new profiles (saved ${savedCost} API calls)...`);
      
      const datasetId = await apifyService.scrapeProfiles(urlsToScrape);
      const newProfilesData = await apifyService.getDatasetItems(datasetId);
      
      updateLoadingProgress('scraping_profiles', 70, 'Saving new profiles to global database...');
      
      // Save new profiles to global database
      for (const profileData of newProfilesData) {
        if (profileData.linkedinUrl) {
          try {
            await SupabaseProfilesService.saveProfile(profileData, userProfile!.id);
            results.push(profileData);
          } catch (saveError) {
            console.error('❌ Error saving profile:', profileData.linkedinUrl, saveError);
            results.push(profileData);
          }
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

    const { data: selectedKey, error: keyError } = await supabase
      .from('apify_keys')
      .select('*')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !selectedKey) {
      alert('Invalid API key selected');
      return;
    }
    
    setIsScraping(true);
    setScrapingType('profile_details');
    setLoadingError('');
    updateLoadingProgress('scraping_profiles', 25, `Checking and scraping ${profileUrls.length} selected profiles...`);
    
    // Create job in database
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        user_id: userProfile.id,
        apify_key_id: selectedKeyId,
        job_type: 'profile_details',
        input_url: profileUrls.join(','),
        status: 'running'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      setIsScraping(false);
      return;
    }

    setScrapingJobs(prev => [job, ...prev]);
    
    try {
      const apifyService = createApifyService(selectedKey.api_key);
      const profilesData = await getProfilesWithOptimization(profileUrls, apifyService);
      
      updateLoadingProgress('saving_data', 75, 'Processing profile data...');
      setProfileDetails(profilesData);
      setPreviousView('comments');
      setCurrentView('profile-table');
      updateLoadingProgress('completed', 100, 'Selected profiles scraped successfully!');
      
      // Update job
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'completed',
          results_count: profilesData.length,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
      
      // Reload jobs
      await loadUserData(userProfile.id);
      
    } catch (error) {
      console.error('❌ Error scraping selected profiles:', error);
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Failed to scrape selected profiles');
      
      // Update job with error
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      await loadUserData(userProfile.id);
    } finally {
      setIsScraping(false);
    }
  };

  const handleStoreSelectedProfiles = async (profilesToStore: any[], tags: string[]) => {
    if (!userProfile) return;
    
    try {
      console.log('💾 Storing', profilesToStore.length, 'profiles with tags:', tags, 'for user:', userProfile.id);
      
      for (const profile of profilesToStore) {
        if (profile.linkedinUrl) {
          await SupabaseProfilesService.saveProfile(profile, userProfile.id, tags);
        }
      }
      
      // Refresh user's stored profiles
      await loadUserData(userProfile.id);
      
      alert(`Successfully stored ${profilesToStore.length} profiles${tags.length > 0 ? ` with tags: ${tags.join(', ')}` : ''}`);
      
    } catch (error) {
      console.error('❌ Error storing profiles:', error);
      alert('Error storing profiles. Please try again.');
    }
  };

  const handleUpdateProfile = async (profileUrl: string) => {
    if (!userProfile || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const { data: selectedKey, error: keyError } = await supabase
      .from('apify_keys')
      .select('*')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !selectedKey) {
      alert('Invalid API key selected');
      return;
    }

    try {
      const apifyService = createApifyService(selectedKey.api_key);
      
      // Scrape fresh data
      const datasetId = await apifyService.scrapeProfiles([profileUrl]);
      const profilesData = await apifyService.getDatasetItems(datasetId);
      
      if (profilesData.length > 0) {
        // Update in global database
        await SupabaseProfilesService.updateProfile(profilesData[0], profileUrl);
        
        // Refresh user's profiles
        await loadUserData(userProfile.id);
        alert('Profile updated successfully!');
      }
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    }
  };

  const handleUpdateSelectedProfiles = async (profileUrls: string[]) => {
    if (!userProfile || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const { data: selectedKey, error: keyError } = await supabase
      .from('apify_keys')
      .select('*')
      .eq('id', selectedKeyId)
      .single();

    if (keyError || !selectedKey) {
      alert('Invalid API key selected');
      return;
    }

    try {
      const apifyService = createApifyService(selectedKey.api_key);
      
      // Scrape fresh data for all profiles
      const datasetId = await apifyService.scrapeProfiles(profileUrls);
      const profilesData = await apifyService.getDatasetItems(datasetId);
      
      // Update each profile in global database
      for (const profileData of profilesData) {
        if (profileData.linkedinUrl) {
          await SupabaseProfilesService.updateProfile(profileData, profileData.linkedinUrl);
        }
      }
      
      // Refresh user's profiles
      await loadUserData(userProfile.id);
      alert(`Successfully updated ${profileUrls.length} profiles!`);
    } catch (error) {
      console.error('❌ Error updating profiles:', error);
      alert('Error updating profiles. Please try again.');
    }
  };

  const handleDeleteSelectedProfiles = async (profileIds: string[]) => {
    if (!userProfile) return;
    
    try {
      // Remove from user's stored profiles
      await SupabaseProfilesService.deleteProfiles(profileIds, userProfile.id);
      
      // Refresh user's profiles
      await loadUserData(userProfile.id);
      
      alert(`Successfully removed ${profileIds.length} profiles from your collection`);
    } catch (error) {
      console.error('❌ Error deleting profiles:', error);
      alert('Error removing profiles. Please try again.');
    }
  };

  const handleTabChange = async (tab: 'scraper' | 'profiles' | 'jobs' | 'profile') => {
    setActiveTab(tab);
    
    if (tab === 'profiles') {
      setCurrentView('profiles-list');
      if (userProfile) {
        await loadUserData(userProfile.id);
      }
    } else if (tab === 'scraper') {
      setCurrentView('form');
    } else if (tab === 'jobs') {
      setCurrentView('form');
    } else if (tab === 'profile') {
      setCurrentView('user-profile');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (userProfile) {
        await loadUserData(userProfile.id);
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
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

  const handleBackToMain = () => {
    setActiveTab('scraper');
    setCurrentView('form');
  };

  const isScrapingDisabled = () => {
    return !selectedKeyId || !userProfile;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg font-medium">Loading Application...</div>
        </div>
      </div>
    );
  }

  if (!user) {
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
              {currentView !== 'user-profile' && (
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
                    My Profiles ({profiles.length})
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
                  <button
                    onClick={handleFeedback}
                    className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 inline mr-2" />
                    Feedback
                  </button>
                </nav>
              )}
              
              {/* User Menu */}
              <UserMenu user={user} onOpenProfile={handleOpenProfile} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'user-profile' ? (
          <UserProfile user={user} onBack={handleBackToMain} />
        ) : (
          <>
            {/* API Key Management */}
            {(activeTab === 'scraper' && currentView === 'form' && userProfile) && (
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
                      disabled={isScrapingDisabled()}
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
                            <div className="text-sm text-gray-600">My Profiles</div>
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
                  <DataTable
                    profiles={profiles}
                    onUpdateProfile={handleUpdateProfile}
                    onUpdateSelectedProfiles={handleUpdateSelectedProfiles}
                    onDeleteSelectedProfiles={handleDeleteSelectedProfiles}
                    onExport={handleExport}
                    onViewDetails={(profile) => handleViewProfileDetails(profile)}
                    isUpdating={false}
                  />
                )}
              </>
            )}

            {activeTab === 'jobs' && (
              <JobsTable 
                jobs={scrapingJobs} 
                onCancelJob={handleCancelJob}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;