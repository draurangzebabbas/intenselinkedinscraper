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

// Enhanced fetch function with retry logic for Apify API calls
async function apifyFetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Apify API error ${response.status}: ${response.statusText}`);
      }
      
      if (i === retries - 1) {
        throw new Error(`Apify API error ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          if (i === retries - 1) {
            throw new Error(`Apify API request timeout. The service may be slow to respond. Please try again.`);
          }
        } else if (error.message.includes('Failed to fetch')) {
          if (i === retries - 1) {
            throw new Error(`Cannot reach Apify API. Please check your internet connection and try again.`);
          }
        } else {
          throw error;
        }
      }
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw new Error('Max retries exceeded for Apify API call');
}

export const createApifyService = (apiKey: string) => ({
  async scrapePostComments(postUrl: string): Promise<string> {
    try {
      const response = await apifyFetchWithRetry(`https://api.apify.com/v2/acts/ZI6ykbLlGS3APaPE8/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          posts: [postUrl]
        }),
      });

      const result: ApifyRunResponse = await response.json();
      
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
      const response = await apifyFetchWithRetry(`https://api.apify.com/v2/acts/2SyF0bVxmgGr8IVCZ/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileUrls: profileUrls
        }),
      });

      const result: ApifyRunResponse = await response.json();
      
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
    const maxWaitTime = 10 * 60 * 1000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.checkRunStatus(runId);
        
        if (status === 'SUCCEEDED') {
          return;
        } else if (status === 'FAILED' || status === 'ABORTED') {
          throw new Error(`Apify run ${status.toLowerCase()}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error checking run status:', error);
        if (Date.now() - startTime >= maxWaitTime - pollInterval) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error('Apify run timed out after 10 minutes');
  },

  async getDatasetItems(datasetId: string): Promise<any[]> {
    try {
      const response = await apifyFetchWithRetry(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
      const response = await apifyFetchWithRetry(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
});