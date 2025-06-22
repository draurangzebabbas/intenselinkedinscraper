import React, { useState } from 'react';
import { ScrapingForm } from './components/ScrapingForm';
import { DataTable } from './components/DataTable';
import { CommentResults } from './components/CommentResults';
import { ProfileDetailsDisplay } from './components/ProfileDetailsDisplay';
import { LoadingProgress } from './components/LoadingProgress';
import { ProfileResultsTable } from './components/ProfileResultsTable';
import { createApifyService } from './lib/apify';
import { exportData } from './utils/export';
import { Linkedin, Database, Activity } from 'lucide-react';

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

interface ApifyKey {
  id: string;
  name: string;
  key: string;
}

function App() {
  // Simple state management - no complex database operations
  const [profiles, setProfiles] = useState<any[]>([]);
  const [commentersData, setCommentersData] = useState<CommentData[]>([]);
  const [profileDetails, setProfileDetails] = useState<any[]>([]);
  const [selectedProfileForDetails, setSelectedProfileForDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles'>('scraper');
  const [currentView, setCurrentView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list' | 'single-profile-details'>('form');
  const [previousView, setPreviousView] = useState<'form' | 'comments' | 'profile-details' | 'profile-table' | 'profiles-list'>('form');
  
  // Simple API key management
  const [apifyKeys, setApifyKeys] = useState<ApifyKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  
  // Loading progress states
  const [loadingStage, setLoadingStage] = useState<'starting' | 'scraping_comments' | 'extracting_profiles' | 'scraping_profiles' | 'saving_data' | 'completed' | 'error'>('starting');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [scrapingType, setScrapingType] = useState<'post_comments' | 'profile_details' | 'mixed'>('post_comments');

  const updateLoadingProgress = (stage: typeof loadingStage, progress: number = 0, message: string = '') => {
    setLoadingStage(stage);
    setLoadingProgress(progress);
    setLoadingMessage(message);
  };

  const addApifyKey = () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    
    const newKey: ApifyKey = {
      id: Date.now().toString(),
      name: newKeyName.trim(),
      key: newKeyValue.trim()
    };
    
    setApifyKeys(prev => [...prev, newKey]);
    if (!selectedKeyId) {
      setSelectedKeyId(newKey.id);
    }
    
    setNewKeyName('');
    setNewKeyValue('');
    setShowKeyForm(false);
  };

  const removeApifyKey = (keyId: string) => {
    setApifyKeys(prev => prev.filter(k => k.id !== keyId));
    if (selectedKeyId === keyId) {
      const remaining = apifyKeys.filter(k => k.id !== keyId);
      setSelectedKeyId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const getSelectedKey = () => {
    return apifyKeys.find(k => k.id === selectedKeyId);
  };

  const handleScrape = async (type: 'post_comments' | 'profile_details' | 'mixed', url: string) => {
    const selectedKey = getSelectedKey();
    if (!selectedKey) {
      alert('Please add and select an Apify API key first');
      return;
    }

    setIsLoading(true);
    setScrapingType(type);
    setLoadingError('');
    updateLoadingProgress('starting', 0, 'Initializing scraping process...');
    
    try {
      const apifyService = createApifyService(selectedKey.key);

      if (type === 'post_comments') {
        updateLoadingProgress('scraping_comments', 25, 'Extracting comments from LinkedIn post...');
        
        const datasetId = await apifyService.scrapePostComments(url);
        
        updateLoadingProgress('saving_data', 75, 'Processing comment data...');
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        setCommentersData(commentsData);
        setCurrentView('comments');
        
        updateLoadingProgress('completed', 100, 'Comments extracted successfully!');

      } else if (type === 'profile_details') {
        updateLoadingProgress('scraping_profiles', 25, 'Gathering detailed profile information...');
        
        const profilesData = await getProfilesWithDetails([url], apifyService);
        
        updateLoadingProgress('saving_data', 75, 'Saving profile data...');
        setProfileDetails(profilesData);
        setPreviousView('form');
        setCurrentView('profile-table');
        
        updateLoadingProgress('completed', 100, 'Profile details scraped successfully!');

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
          updateLoadingProgress('scraping_profiles', 60, `Scraping ${profileUrls.length} profile details...`);
          
          const profilesData = await getProfilesWithDetails(profileUrls, apifyService);
          
          updateLoadingProgress('saving_data', 85, 'Saving all data...');
          setProfileDetails(profilesData);
          setPreviousView('form');
          setCurrentView('profile-table');
        }

        updateLoadingProgress('completed', 100, 'Mixed scraping completed successfully!');
      }

    } catch (error) {
      console.error('Scraping error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
          errorMessage = 'Network connection failed. Please check your internet connection and try again.';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = 'Request timed out. The service may be slow to respond. Please try again.';
        }
      }
      
      setLoadingError(errorMessage);
      updateLoadingProgress('error', 0, 'Scraping failed');
      
    } finally {
      setIsLoading(false);
    }
  };

  const getProfilesWithDetails = async (profileUrls: string[], apifyService: any): Promise<any[]> => {
    const datasetId = await apifyService.scrapeProfiles(profileUrls);
    const profilesData = await apifyService.getDatasetItems(datasetId);
    
    // Store profiles in local state
    const newProfiles = profilesData.map((profile: any) => ({
      id: Date.now().toString() + Math.random(),
      linkedin_url: profile.linkedinUrl,
      profile_data: profile,
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));
    
    setProfiles(prev => [...prev, ...newProfiles]);
    
    return profilesData;
  };

  const handleScrapeSelectedCommenterProfiles = async (profileUrls: string[]) => {
    const selectedKey = getSelectedKey();
    if (!selectedKey) {
      alert('Please select an Apify API key first');
      return;
    }
    
    setIsLoading(true);
    setScrapingType('profile_details');
    setLoadingError('');
    updateLoadingProgress('scraping_profiles', 25, `Scraping ${profileUrls.length} selected profiles...`);
    
    try {
      const apifyService = createApifyService(selectedKey.key);
      const profilesData = await getProfilesWithDetails(profileUrls, apifyService);
      updateLoadingProgress('saving_data', 75, 'Processing profile data...');
      setProfileDetails(profilesData);
      setPreviousView('comments');
      setCurrentView('profile-table');
      updateLoadingProgress('completed', 100, 'Selected profiles scraped successfully!');
      
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
    // Simple update - just refresh the profile
    console.log('Update profile:', profileUrl);
  };

  const handleUpdateSelectedProfiles = async (profileUrls: string[]) => {
    console.log('Update selected profiles:', profileUrls);
  };

  const handleDeleteSelectedProfiles = async (profileIds: string[]) => {
    setProfiles(prev => prev.filter(p => !profileIds.includes(p.id)));
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

  const handleTabChange = async (tab: 'scraper' | 'profiles') => {
    setActiveTab(tab);
    
    if (tab === 'profiles') {
      setCurrentView('profiles-list');
    } else if (tab === 'scraper') {
      setCurrentView('form');
    }
  };

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
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* API Key Management */}
        <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Apify API Keys</h3>
            <button
              onClick={() => setShowKeyForm(!showKeyForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Key
            </button>
          </div>

          {showKeyForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Key Name (e.g., Main Key)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="password"
                  placeholder="Apify API Key"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addApifyKey}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowKeyForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {apifyKeys.map(key => (
              <div
                key={key.id}
                className={`p-3 border rounded-lg flex items-center justify-between ${
                  selectedKeyId === key.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={selectedKeyId === key.id}
                    onChange={() => setSelectedKeyId(key.id)}
                    className="text-blue-600"
                  />
                  <div>
                    <div className="font-medium">{key.name}</div>
                    <div className="text-sm text-gray-500 font-mono">
                      {'•'.repeat(20)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeApifyKey(key.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {apifyKeys.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No API keys found. Add your first Apify API key to get started.</p>
            </div>
          )}
        </div>

        {activeTab === 'scraper' && (
          <div className="space-y-8">
            {currentView === 'form' && (
              <>
                <ScrapingForm 
                  onScrape={handleScrape} 
                  isLoading={isLoading}
                  disabled={!selectedKeyId}
                />
                
                {isLoading && (
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
                        <div className="text-sm text-gray-600">Stored Profiles</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Activity className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{apifyKeys.length}</div>
                        <div className="text-sm text-gray-600">API Keys</div>
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
                isUpdating={false}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;