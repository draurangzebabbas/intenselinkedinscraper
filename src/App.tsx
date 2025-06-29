import React, { useState, useEffect } from 'react';
import { LocalAuth } from './components/LocalAuth';
import { ScrapingForm } from './components/ScrapingForm';
import { CommentResults } from './components/CommentResults';
import { ProfileDetailsDisplay } from './components/ProfileDetailsDisplay';
import { LoadingProgress } from './components/LoadingProgress';
import { ProfileResultsTable } from './components/ProfileResultsTable';
import { LocalApifyKeyManager } from './components/LocalApifyKeyManager';
import { LocalJobsTable } from './components/LocalJobsTable';
import { DataTable } from './components/DataTable';
import { StorageManager } from './components/StorageManager';
import { createApifyService } from './lib/apify';
import { SupabaseProfilesService } from './lib/supabaseProfiles';
import { LocalStorageService, type LocalUser, type LocalApifyKey, type LocalJob } from './lib/localStorage';
import { exportData } from './utils/export';
import { 
  Linkedin, Database, Activity, Clock, Loader2, AlertCircle, 
  User, LogOut, ChevronDown, HardDrive
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
  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // App state
  const [profiles, setProfiles] = useState<any[]>([]);
  const [commentersData, setCommentersData] = useState<CommentData[]>([]);
  const [profileDetails, setProfileDetails] = useState<any[]>([]);
  const [selectedProfileForDetails, setSelectedProfileForDetails] = useState<any>(null);
  const [scrapingJobs, setScrapingJobs] = useState<LocalJob[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles' | 'jobs' | 'storage'>('scraper');
  const [currentView, setCurrentView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list' | 'single-profile-details' | 'storage'>('form');
  const [previousView, setPreviousView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list'>('form');
  
  // Scraping state
  const [isScraping, setIsScraping] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [loadingStage, setLoadingStage] = useState<'starting' | 'scraping_comments' | 'extracting_profiles' | 'scraping_profiles' | 'saving_data' | 'completed' | 'error'>('starting');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [scrapingType, setScrapingType] = useState<'post_comments' | 'profile_details' | 'mixed'>('post_comments');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Initialize app
  useEffect(() => {
    const initApp = () => {
      const user = LocalStorageService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        loadUserData(user.id);
      }
      setIsLoading(false);
    };

    initApp();
  }, []);

  const loadUserData = async (userId: string) => {
    const jobs = LocalStorageService.getJobs(userId);
    setScrapingJobs(jobs);
    
    // FIXED: Load only user's locally stored profiles (not all Supabase profiles)
    try {
      console.log('📊 Loading data for user:', userId);
      
      // Get user's local profiles only
      const localProfiles = LocalStorageService.getUserProfiles(userId);
      console.log('📱 Local profiles for user:', localProfiles.length);
      
      setProfiles(localProfiles);
      
      console.log(`✅ Loaded ${localProfiles.length} profiles for user ${userId}`);
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      // Fallback to local profiles only
      const localProfiles = LocalStorageService.getUserProfiles(userId);
      setProfiles(localProfiles);
      console.log('⚠️ Fallback: Using local profiles only:', localProfiles.length);
    }
  };

  const updateLoadingProgress = (stage: typeof loadingStage, progress: number = 0, message: string = '') => {
    setLoadingStage(stage);
    setLoadingProgress(progress);
    setLoadingMessage(message);
  };

  const handleKeySelect = (key: LocalApifyKey) => {
    console.log('🔑 API key selected:', key.keyName);
    setSelectedKeyId(key.id);
  };

  const handleAuthSuccess = (user: LocalUser) => {
    setCurrentUser(user);
    loadUserData(user.id);
  };

  const handleLogout = () => {
    LocalStorageService.logout();
    setCurrentUser(null);
    setProfiles([]);
    setScrapingJobs([]);
    setShowUserMenu(false);
  };

  const handleScrape = async (type: 'post_comments' | 'profile_details' | 'mixed', url: string) => {
    if (!currentUser) {
      alert('Please select a user first');
      return;
    }

    if (!selectedKeyId) {
      alert('Please select an Apify API key first');
      return;
    }

    // Get the selected API key
    const keys = LocalStorageService.getApifyKeys(currentUser.id);
    const selectedKey = keys.find(k => k.id === selectedKeyId);

    if (!selectedKey) {
      alert('Invalid API key selected');
      return;
    }

    setIsScraping(true);
    setScrapingType(type);
    setLoadingError('');
    updateLoadingProgress('starting', 0, 'Initializing scraping process...');
    
    // Create local job
    const job = LocalStorageService.createJob(currentUser.id, type, url);
    setScrapingJobs(prev => [job, ...prev]);
    
    try {
      const apifyService = createApifyService(selectedKey.apiKey);

      if (type === 'post_comments') {
        updateLoadingProgress('scraping_comments', 25, 'Extracting comments from LinkedIn post...');
        
        const datasetId = await apifyService.scrapePostComments(url);
        
        updateLoadingProgress('saving_data', 75, 'Processing comment data...');
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        setCommentersData(commentsData);
        setCurrentView('comments');
        
        updateLoadingProgress('completed', 100, 'Comments extracted successfully!');
        
        // Update job
        const completedJob: LocalJob = {
          ...job,
          status: 'completed',
          resultsCount: commentsData.length,
          completedAt: new Date().toISOString()
        };
        LocalStorageService.saveJob(completedJob);
        setScrapingJobs(prev => prev.map(j => j.id === job.id ? completedJob : j));

      } else if (type === 'profile_details') {
        updateLoadingProgress('scraping_profiles', 25, 'Checking existing profiles...');
        
        // Parse profile URLs properly - split by newlines and filter empty strings
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
        const completedJob: LocalJob = {
          ...job,
          status: 'completed',
          resultsCount: profilesData.length,
          completedAt: new Date().toISOString()
        };
        LocalStorageService.saveJob(completedJob);
        setScrapingJobs(prev => prev.map(j => j.id === job.id ? completedJob : j));

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
        const completedJob: LocalJob = {
          ...job,
          status: 'completed',
          resultsCount: profileUrls.length,
          completedAt: new Date().toISOString()
        };
        LocalStorageService.saveJob(completedJob);
        setScrapingJobs(prev => prev.map(j => j.id === job.id ? completedJob : j));
      }

    } catch (error) {
      console.error('❌ Scraping error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Scraping failed');
      
      // Update job with error
      const failedJob: LocalJob = {
        ...job,
        status: 'failed',
        errorMessage,
        completedAt: new Date().toISOString()
      };
      LocalStorageService.saveJob(failedJob);
      setScrapingJobs(prev => prev.map(j => j.id === job.id ? failedJob : j));
      
    } finally {
      setIsScraping(false);
    }
  };

  const getProfilesWithOptimization = async (profileUrls: string[], apifyService: any): Promise<any[]> => {
    const results: any[] = [];
    const urlsToScrape: string[] = [];
    let savedCost = 0;
    
    updateLoadingProgress('scraping_profiles', 30, 'Checking for existing profiles...');
    
    // FIXED: Check each URL in Supabase for this specific user
    for (const url of profileUrls) {
      try {
        const existingProfile = await SupabaseProfilesService.checkProfileExists(url, currentUser!.id);
        if (existingProfile) {
          results.push(existingProfile.profile_data);
          savedCost++;
        } else {
          urlsToScrape.push(url);
        }
      } catch (error) {
        console.error('❌ Error checking profile existence for', url, ':', error);
        // If there's an error checking, add to scrape list to be safe
        urlsToScrape.push(url);
      }
    }
    
    if (urlsToScrape.length > 0) {
      updateLoadingProgress('scraping_profiles', 50, `Scraping ${urlsToScrape.length} new profiles (saved ${savedCost} API calls)...`);
      
      const datasetId = await apifyService.scrapeProfiles(urlsToScrape);
      const newProfilesData = await apifyService.getDatasetItems(datasetId);
      
      updateLoadingProgress('scraping_profiles', 70, 'Saving new profiles to database...');
      
      // FIXED: Save new profiles to Supabase only (don't add to local storage automatically)
      for (const profileData of newProfilesData) {
        if (profileData.linkedinUrl) {
          try {
            // Save to Supabase (central storage) for this user
            await SupabaseProfilesService.saveProfile(profileData, currentUser!.id);
            
            // DO NOT automatically add to local storage here
            // Only add to local storage when user explicitly stores profiles
            
            results.push(profileData);
          } catch (saveError) {
            console.error('❌ Error saving profile:', profileData.linkedinUrl, saveError);
            results.push(profileData); // Still include in results for display
          }
        }
      }
    }
    
    updateLoadingProgress('scraping_profiles', 90, `Completed! Saved ${savedCost} API calls by using cached profiles.`);
    
    // DO NOT update local profiles cache here
    // Local profiles should only be updated when user explicitly stores profiles
    
    return results;
  };

  const handleScrapeSelectedCommenterProfiles = async (profileUrls: string[]) => {
    if (!currentUser || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const keys = LocalStorageService.getApifyKeys(currentUser.id);
    const selectedKey = keys.find(k => k.id === selectedKeyId);

    if (!selectedKey) {
      alert('Invalid API key selected');
      return;
    }
    
    setIsScraping(true);
    setScrapingType('profile_details');
    setLoadingError('');
    updateLoadingProgress('scraping_profiles', 25, `Checking and scraping ${profileUrls.length} selected profiles...`);
    
    // Create local job
    const job = LocalStorageService.createJob(currentUser.id, 'profile_details', profileUrls.join(','));
    setScrapingJobs(prev => [job, ...prev]);
    
    try {
      const apifyService = createApifyService(selectedKey.apiKey);
      const profilesData = await getProfilesWithOptimization(profileUrls, apifyService);
      
      updateLoadingProgress('saving_data', 75, 'Processing profile data...');
      setProfileDetails(profilesData);
      setPreviousView('comments');
      setCurrentView('profile-table');
      updateLoadingProgress('completed', 100, 'Selected profiles scraped successfully!');
      
      // Update job
      const completedJob: LocalJob = {
        ...job,
        status: 'completed',
        resultsCount: profilesData.length,
        completedAt: new Date().toISOString()
      };
      LocalStorageService.saveJob(completedJob);
      setScrapingJobs(prev => prev.map(j => j.id === job.id ? completedJob : j));
      
    } catch (error) {
      console.error('❌ Error scraping selected profiles:', error);
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Failed to scrape selected profiles');
      
      // Update job with error
      const failedJob: LocalJob = {
        ...job,
        status: 'failed',
        errorMessage,
        completedAt: new Date().toISOString()
      };
      LocalStorageService.saveJob(failedJob);
      setScrapingJobs(prev => prev.map(j => j.id === job.id ? failedJob : j));
    } finally {
      setIsScraping(false);
    }
  };

  const handleStoreSelectedProfiles = async (profilesToStore: any[], tags: string[]) => {
    if (!currentUser) return;
    
    try {
      console.log('💾 Storing', profilesToStore.length, 'profiles with tags:', tags, 'for user:', currentUser.id);
      
      for (const profile of profilesToStore) {
        if (profile.linkedinUrl) {
          // FIXED: Save to Supabase and capture the returned profile object
          const savedProfile = await SupabaseProfilesService.saveProfile(profile, currentUser.id);
          
          if (savedProfile) {
            // FIXED: Save the complete profile object (with id) to user-specific local storage
            LocalStorageService.addUserProfile(currentUser.id, {
              id: savedProfile.id, // Include the unique id from Supabase
              linkedin_url: savedProfile.linkedin_url,
              profile_data: savedProfile.profile_data,
              tags: tags.length > 0 ? tags : savedProfile.tags,
              last_updated: savedProfile.last_updated
            });
          }
        }
      }
      
      // Update local profiles for this user
      const updatedProfiles = LocalStorageService.getUserProfiles(currentUser.id);
      setProfiles(updatedProfiles);
      
      alert(`Successfully stored ${profilesToStore.length} profiles${tags.length > 0 ? ` with tags: ${tags.join(', ')}` : ''}`);
      
    } catch (error) {
      console.error('❌ Error storing profiles:', error);
      alert('Error storing profiles. Please try again.');
    }
  };

  const handleUpdateProfile = async (profileUrl: string) => {
    if (!currentUser || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const keys = LocalStorageService.getApifyKeys(currentUser.id);
    const selectedKey = keys.find(k => k.id === selectedKeyId);

    if (!selectedKey) {
      alert('Invalid API key selected');
      return;
    }

    try {
      const apifyService = createApifyService(selectedKey.apiKey);
      const profilesData = await getProfilesWithOptimization([profileUrl], apifyService);
      
      if (profilesData.length > 0) {
        // Refresh profiles list for this user
        await loadUserData(currentUser.id);
        alert('Profile updated successfully!');
      }
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    }
  };

  const handleUpdateSelectedProfiles = async (profileUrls: string[]) => {
    if (!currentUser || !selectedKeyId) {
      alert('Please ensure you are signed in and have selected an API key');
      return;
    }

    const keys = LocalStorageService.getApifyKeys(currentUser.id);
    const selectedKey = keys.find(k => k.id === selectedKeyId);

    if (!selectedKey) {
      alert('Invalid API key selected');
      return;
    }

    try {
      const apifyService = createApifyService(selectedKey.apiKey);
      await getProfilesWithOptimization(profileUrls, apifyService);
      
      // Refresh profiles list for this user
      await loadUserData(currentUser.id);
      alert(`Successfully updated ${profileUrls.length} profiles!`);
    } catch (error) {
      console.error('❌ Error updating profiles:', error);
      alert('Error updating profiles. Please try again.');
    }
  };

  const handleDeleteSelectedProfiles = async (profileIds: string[]) => {
    if (!currentUser) return;
    
    try {
      // Remove from user-specific local storage
      const currentProfiles = LocalStorageService.getUserProfiles(currentUser.id);
      const filteredProfiles = currentProfiles.filter(p => !profileIds.includes(p.id));
      LocalStorageService.saveUserProfiles(currentUser.id, filteredProfiles);
      
      // Also try to remove from Supabase (for this user only)
      try {
        await SupabaseProfilesService.deleteProfiles(profileIds, currentUser.id);
      } catch (supabaseError) {
        console.warn('⚠️ Could not delete from Supabase, but removed from local storage:', supabaseError);
      }
      
      // Update state
      setProfiles(filteredProfiles);
      
      alert(`Successfully deleted ${profileIds.length} profiles`);
    } catch (error) {
      console.error('❌ Error deleting profiles:', error);
      alert('Error deleting profiles. Please try again.');
    }
  };

  const handleTabChange = async (tab: 'scraper' | 'profiles' | 'jobs' | 'storage') => {
    setActiveTab(tab);
    
    if (tab === 'profiles') {
      setCurrentView('profiles-list');
      // Load user-specific profiles for profiles tab
      if (currentUser) {
        const userProfiles = LocalStorageService.getUserProfiles(currentUser.id);
        setProfiles(userProfiles);
        console.log('📱 Profiles tab: Loaded', userProfiles.length, 'profiles for user', currentUser.id);
      }
    } else if (tab === 'scraper') {
      setCurrentView('form');
      // Load user-specific profiles cache for scraper tab
      if (currentUser) {
        const userProfiles = LocalStorageService.getUserProfiles(currentUser.id);
        setProfiles(userProfiles);
      }
    } else if (tab === 'jobs') {
      setCurrentView('form');
    } else if (tab === 'storage') {
      setCurrentView('storage');
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

  const isScrapingDisabled = () => {
    return !selectedKeyId;
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

  if (!currentUser) {
    return <LocalAuth onAuthSuccess={handleAuthSuccess} />;
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
                  onClick={() => handleTabChange('storage')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'storage'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <HardDrive className="w-4 h-4 inline mr-2" />
                  Storage
                </button>
              </nav>
              
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {currentUser.fullName ? currentUser.fullName.split(' ').map(n => n[0]).join('').toUpperCase() : currentUser.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium text-gray-900">{currentUser.fullName || currentUser.username}</div>
                    <div className="text-xs text-gray-500">{currentUser.email}</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                          {currentUser.fullName ? currentUser.fullName.split(' ').map(n => n[0]).join('').toUpperCase() : currentUser.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {currentUser.fullName || currentUser.username}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{currentUser.email}</div>
                          <div className="text-xs text-blue-600 truncate">User ID: {currentUser.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Switch User
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'storage' ? (
          <StorageManager />
        ) : (
          <>
            {/* API Key Management */}
            {(activeTab === 'scraper' && currentView === 'form') && (
              <div className="mb-8">
                <LocalApifyKeyManager
                  userId={currentUser.id}
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
              <LocalJobsTable 
                jobs={scrapingJobs} 
                onCancelJob={(jobId) => {
                  // Refresh jobs after cancellation
                  const updatedJobs = LocalStorageService.getJobs(currentUser.id);
                  setScrapingJobs(updatedJobs);
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;