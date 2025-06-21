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

export const apifyService = {
  async scrapePostComments(postUrl: string): Promise<string> {
    const response = await fetch(`${APIFY_BASE_URL}/acts/ZI6ykbLlGS3APaPE8/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        posts: [postUrl]
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start post comments scraping: ${response.statusText}`);
    }

    const result: ApifyRunResponse = await response.json();
    
    // Wait for the run to complete
    await this.waitForRunCompletion(result.data.id);
    
    return result.data.defaultDatasetId;
  },

  async scrapeProfiles(profileUrls: string[]): Promise<string> {
    const response = await fetch(`${APIFY_BASE_URL}/acts/2SyF0bVxmgGr8IVCZ/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileUrls: profileUrls
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start profile scraping: ${response.statusText}`);
    }

    const result: ApifyRunResponse = await response.json();
    
    // Wait for the run to complete
    await this.waitForRunCompletion(result.data.id);
    
    return result.data.defaultDatasetId;
  },

  async waitForRunCompletion(runId: string): Promise<void> {
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.checkRunStatus(runId);
      
      if (status === 'SUCCEEDED') {
        return;
      } else if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(`Apify run ${status.toLowerCase()}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Apify run timed out');
  },

  async getDatasetItems(datasetId: string): Promise<any[]> {
    const response = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items`, {
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dataset items: ${response.statusText}`);
    }

    return response.json();
  },

  async checkRunStatus(runId: string): Promise<string> {
    const response = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}`, {
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check run status: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data.status;
  }
};