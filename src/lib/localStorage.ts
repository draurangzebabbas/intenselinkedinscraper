// Local storage service for user data and app state
export interface LocalUser {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  createdAt: string;
  profileImage?: string;
}

export interface LocalApifyKey {
  id: string;
  userId: string;
  keyName: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
}

export interface LocalJob {
  id: string;
  userId: string;
  jobType: 'post_comments' | 'profile_details' | 'mixed';
  inputUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultsCount: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export class LocalStorageService {
  private static readonly USERS_KEY = 'linkedin_scraper_users';
  private static readonly CURRENT_USER_KEY = 'linkedin_scraper_current_user';
  private static readonly APIFY_KEYS_KEY = 'linkedin_scraper_apify_keys';
  private static readonly JOBS_KEY = 'linkedin_scraper_jobs';
  private static readonly PROFILES_KEY = 'linkedin_scraper_profiles';

  // User management
  static getUsers(): LocalUser[] {
    const users = localStorage.getItem(this.USERS_KEY);
    return users ? JSON.parse(users) : [];
  }

  static saveUser(user: LocalUser): void {
    const users = this.getUsers();
    const existingIndex = users.findIndex(u => u.id === user.id);
    
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  static getCurrentUser(): LocalUser | null {
    const userId = localStorage.getItem(this.CURRENT_USER_KEY);
    if (!userId) return null;
    
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  }

  static setCurrentUser(userId: string): void {
    localStorage.setItem(this.CURRENT_USER_KEY, userId);
  }

  static createUser(userData: Omit<LocalUser, 'id' | 'createdAt'>): LocalUser {
    const user: LocalUser = {
      ...userData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    
    this.saveUser(user);
    this.setCurrentUser(user.id);
    return user;
  }

  static logout(): void {
    localStorage.removeItem(this.CURRENT_USER_KEY);
  }

  // API Keys management
  static getApifyKeys(userId: string): LocalApifyKey[] {
    const keys = localStorage.getItem(this.APIFY_KEYS_KEY);
    const allKeys: LocalApifyKey[] = keys ? JSON.parse(keys) : [];
    return allKeys.filter(k => k.userId === userId);
  }

  static saveApifyKey(key: LocalApifyKey): void {
    const keys = localStorage.getItem(this.APIFY_KEYS_KEY);
    const allKeys: LocalApifyKey[] = keys ? JSON.parse(keys) : [];
    
    const existingIndex = allKeys.findIndex(k => k.id === key.id);
    if (existingIndex >= 0) {
      allKeys[existingIndex] = key;
    } else {
      allKeys.push(key);
    }
    
    localStorage.setItem(this.APIFY_KEYS_KEY, JSON.stringify(allKeys));
  }

  static createApifyKey(userId: string, keyName: string, apiKey: string): LocalApifyKey {
    const key: LocalApifyKey = {
      id: crypto.randomUUID(),
      userId,
      keyName,
      apiKey,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    this.saveApifyKey(key);
    return key;
  }

  static deleteApifyKey(keyId: string): void {
    const keys = localStorage.getItem(this.APIFY_KEYS_KEY);
    const allKeys: LocalApifyKey[] = keys ? JSON.parse(keys) : [];
    const filteredKeys = allKeys.filter(k => k.id !== keyId);
    localStorage.setItem(this.APIFY_KEYS_KEY, JSON.stringify(filteredKeys));
  }

  // Jobs management
  static getJobs(userId: string): LocalJob[] {
    const jobs = localStorage.getItem(this.JOBS_KEY);
    const allJobs: LocalJob[] = jobs ? JSON.parse(jobs) : [];
    return allJobs.filter(j => j.userId === userId).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static saveJob(job: LocalJob): void {
    const jobs = localStorage.getItem(this.JOBS_KEY);
    const allJobs: LocalJob[] = jobs ? JSON.parse(jobs) : [];
    
    const existingIndex = allJobs.findIndex(j => j.id === job.id);
    if (existingIndex >= 0) {
      allJobs[existingIndex] = job;
    } else {
      allJobs.push(job);
    }
    
    localStorage.setItem(this.JOBS_KEY, JSON.stringify(allJobs));
  }

  static createJob(userId: string, jobType: LocalJob['jobType'], inputUrl: string): LocalJob {
    const job: LocalJob = {
      id: crypto.randomUUID(),
      userId,
      jobType,
      inputUrl,
      status: 'pending',
      resultsCount: 0,
      createdAt: new Date().toISOString()
    };
    
    this.saveJob(job);
    return job;
  }

  // Local profiles cache (for quick access)
  static getLocalProfiles(): any[] {
    const profiles = localStorage.getItem(this.PROFILES_KEY);
    return profiles ? JSON.parse(profiles) : [];
  }

  static saveLocalProfiles(profiles: any[]): void {
    localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles));
  }

  static addLocalProfile(profile: any): void {
    const profiles = this.getLocalProfiles();
    const existingIndex = profiles.findIndex(p => p.linkedin_url === profile.linkedin_url);
    
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    
    this.saveLocalProfiles(profiles);
  }

  // Clear all data
  static clearAllData(): void {
    localStorage.removeItem(this.USERS_KEY);
    localStorage.removeItem(this.CURRENT_USER_KEY);
    localStorage.removeItem(this.APIFY_KEYS_KEY);
    localStorage.removeItem(this.JOBS_KEY);
    localStorage.removeItem(this.PROFILES_KEY);
  }
}