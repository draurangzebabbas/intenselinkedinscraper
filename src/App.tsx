import React, { useState, useEffect } from 'react';
import { ScrapingForm } from './components/ScrapingForm';
import { DataTable } from './components/DataTable';
import { JobsTable } from './components/JobsTable';
import { CommentResults } from './components/CommentResults';
import { ProfileDetailsDisplay } from './components/ProfileDetailsDisplay';
import { supabase } from './lib/supabase';
import { apifyService } from './lib/apify';
import { exportData } from './utils/export';
import { Linkedin, Database, Activity } from 'lucide-react';

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [commentersData, setCommentersData] = useState<CommentData[]>([]);
  const [profileDetails, setProfileDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles' | 'jobs'>('scraper');
  const [currentView, setCurrentView] = useState<'form' | 'comments' | 'profile-details'>('form');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(100);

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Load jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('scraping_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleScrape = async (type: 'post_comments' | 'profile_details' | 'mixed', url: string) => {
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

      // Refresh jobs list
      await loadData();

      if (type === 'post_comments') {
        // Scrape post comments and show them to user
        const datasetId = await apifyService.scrapePostComments(url);
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        setCommentersData(commentsData);
        setCurrentView('comments');

        // Update job status
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            results_count: commentsData.length,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

      } else if (type === 'profile_details') {
        // Scrape single profile and show details
        const profilesData = await getProfilesWithDetails([url]);
        setProfileDetails(profilesData);
        setCurrentView('profile-details');
        
        // Update job status
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            results_count: profilesData.length,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

      } else if (type === 'mixed') {
        // Scrape post comments first
        const datasetId = await apifyService.scrapePostComments(url);
        const commentsData = await apifyService.getDatasetItems(datasetId);
        
        // Extract profile URLs from comments
        const profileUrls = commentsData
          .map(comment => comment.actor?.linkedinUrl)
          .filter(Boolean)
          .slice(0, 50); // Limit to first 50 profiles
        
        if (profileUrls.length > 0) {
          const profilesData = await getProfilesWithDetails(profileUrls);
          setProfileDetails(profilesData);
          setCurrentView('profile-details');
        }

        // Update job status
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            results_count: profileUrls.length,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }

      await loadData();
    } catch (error) {
      console.error('Scraping error:', error);
      
      // Update job status to failed
      const { data: jobs } = await supabase
        .from('scraping_jobs')
        .select('id')
        .eq('input_url', url)
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1);

      if (jobs && jobs.length > 0) {
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobs[0].id);
      }
      
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const getProfilesWithDetails = async (profileUrls: string[]): Promise<any[]> => {
    // Check which profiles already exist in database
    const { data: existingProfiles } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .in('linkedin_url', profileUrls);

    const existingUrlsMap = new Map();
    if (existingProfiles) {
      existingProfiles.forEach(profile => {
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
      for (const profileData of newProfilesData) {
        const linkedinUrl = profileData.linkedinUrl;
        if (linkedinUrl) {
          // Store in database
          await supabase
            .from('linkedin_profiles')
            .insert({
              linkedin_url: linkedinUrl,
              profile_data: profileData,
              last_updated: new Date().toISOString()
            });
          
          // Add to results
          allProfileDetails.push(profileData);
        }
      }
    }

    return allProfileDetails;
  };

  const handleScrapeSelectedCommenterProfiles = async (profileUrls: string[]) => {
    setIsLoading(true);
    
    try {
      const profilesData = await getProfilesWithDetails(profileUrls);
      setProfileDetails(profilesData);
      setCurrentView('profile-details');
    } catch (error) {
      console.error('Error scraping selected profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (profileUrl: string) => {
    setIsUpdating(true);
    
    try {
      // Force update by scraping new data
      const datasetId = await apifyService.scrapeProfiles([profileUrl]);
      const profilesData = await apifyService.getDatasetItems(datasetId);
      
      if (profilesData.length > 0) {
        const profileData = profilesData[0];
        const linkedinUrl = profileData.linkedinUrl;
        
        // Update in database
        await supabase
          .from('linkedin_profiles')
          .update({
            profile_data: profileData,
            last_updated: new Date().toISOString()
          })
          .eq('linkedin_url', linkedinUrl);
      }
      
      await loadData();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExport = (format: string) => {
    exportData(profiles, format, 'linkedin_profiles');
  };

  const handleBackToForm = () => {
    setCurrentView('form');
    setCommentersData([]);
    setProfileDetails([]);
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
            
            <nav className="flex space-x-1">
              <button
                onClick={() => setActiveTab('scraper')}
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
                onClick={() => setActiveTab('profiles')}
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
                onClick={() => setActiveTab('jobs')}
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
              />
            )}

            {currentView === 'profile-details' && (
              <ProfileDetailsDisplay
                profiles={profileDetails}
                onBack={handleBackToForm}
              />
            )}
          </div>
        )}

        {activeTab === 'profiles' && (
          <DataTable
            profiles={profiles}
            onUpdateProfile={handleUpdateProfile}
            onExport={handleExport}
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