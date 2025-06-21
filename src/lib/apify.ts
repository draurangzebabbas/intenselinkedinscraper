const APIFY_API_KEY = import.meta.env.VITE_APIFY_API_KEY;
const APIFY_BASE_URL = 'https://api.apify.com/v2';

if (!APIFY_API_KEY) {
  throw new Error('Missing VITE_APIFY_API_KEY environment variable');
}

export interface ApifyRunResponse {
  data: {
    id: string;
    defaultDatasetId: string;
    status: string;
  };
}

export interface LinkedInComment {
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

export interface LinkedInProfile {
  element: {
    id: string;
    publicIdentifier: string;
    firstName: string;
    lastName: string;
    headline: string;
    about: string;
    linkedinUrl: string;
    photo: string;
    location: {
      linkedinText: string;
      countryCode: string;
    };
    connectionsCount: number;
    followerCount: number;
    experience: Array<{
      companyName: string;
      position: string;
      duration: string;
      description: string;
    }>;
    education: Array<{
      title: string;
      degree: string;
      period: string;
    }>;
  };
}

// Enhanced fetch function with retry logic for Apify API calls
async function apifyFetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for Apify calls
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If response is ok, return it
      if (response.ok) {
        return response;
      }
      
      // If it's a client error (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Apify API error ${response.status}: ${response.statusText}`);
      }
      
      // For server errors (5xx), retry
      if (i === retries - 1) {
        throw new Error(`Apify API error ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      if (error instanceof Error) {
        // Don't retry on abort (timeout) or certain network errors on final attempt
        if (error.name === 'AbortError') {
          if (i === retries - 1) {
            throw new Error(`Apify API request timeout. The service may be slow to respond. Please try again.`);
          }
        } else if (error.message.includes('Failed to fetch')) {
          if (i === retries - 1) {
            throw new Error(`Cannot reach Apify API. Please check your internet connection and try again.`);
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
  
  throw new Error('Max retries exceeded for Apify API call');
}

export const apifyService = {
  async scrapePostComments(postUrl: string): Promise<string> {
    try {
      const response = await apifyFetchWithRetry(`${APIFY_BASE_URL}/acts/ZI6ykbLlGS3APaPE8/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${APIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          posts: [postUrl]
        }),
      });

      const result: ApifyRunResponse = await response.json();
      
      // Wait for the run to complete
      await this.waitForRunCompletion(result.data.id);
      
      return result.data.defaultDatasetId;
    } catch (error) {
      console.error('Error scraping post comments:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to scrape post comments: ${error.message}`);
      }
      throw new Error('Failed to scrape post comments: Unknown error');
    }
  },

  async scrapeProfiles(profileUrls: string[]): Promise<string> {
    try {
      const response = await apifyFetchWithRetry(`${APIFY_BASE_URL}/acts/2SyF0bVxmgGr8IVCZ/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${APIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileUrls: profileUrls
        }),
      });

      const result: ApifyRunResponse = await response.json();
      
      // Wait for the run to complete
      await this.waitForRunCompletion(result.data.id);
      
      return result.data.defaultDatasetId;
    } catch (error) {
      console.error('Error scraping profiles:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to scrape profiles: ${error.message}`);
      }
      throw new Error('Failed to scrape profiles: Unknown error');
    }
  },

  async waitForRunCompletion(runId: string): Promise<void> {
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.checkRunStatus(runId);
        
        if (status === 'SUCCEEDED') {
          return;
        } else if (status === 'FAILED' || status === 'ABORTED') {
          throw new Error(`Apify run ${status.toLowerCase()}`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error checking run status:', error);
        // Continue polling unless it's the final attempt
        if (Date.now() - startTime >= maxWaitTime - pollInterval) {
          throw error;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error('Apify run timed out after 10 minutes');
  },

  async getDatasetItems(datasetId: string): Promise<any[]> {
    try {
      const response = await apifyFetchWithRetry(`${APIFY_BASE_URL}/datasets/${datasetId}/items`, {
        headers: {
          'Authorization': `Bearer ${APIFY_API_KEY}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching dataset items:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to fetch dataset items: ${error.message}`);
      }
      throw new Error('Failed to fetch dataset items: Unknown error');
    }
  },

  async checkRunStatus(runId: string): Promise<string> {
    try {
      const response = await apifyFetchWithRetry(`${APIFY_BASE_URL}/actor-runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${APIFY_API_KEY}`,
        },
      });

      const result = await response.json();
      return result.data.status;
    } catch (error) {
      console.error('Error checking run status:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to check run status: ${error.message}`);
      }
      throw new Error('Failed to check run status: Unknown error');
    }
  }
};