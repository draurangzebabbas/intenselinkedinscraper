import { supabase } from './supabase';

// Simplified Supabase service only for storing scraped profiles
export class SupabaseProfilesService {
  static async saveProfile(profileData: any, userId: string): Promise<boolean> {
    try {
      console.log('💾 Saving profile to Supabase:', profileData.linkedinUrl);
      
      // Include user_id to satisfy the NOT NULL constraint
      const { error } = await supabase
        .from('linkedin_profiles')
        .upsert({
          linkedin_url: profileData.linkedinUrl || profileData.linkedin_url,
          profile_data: profileData,
          user_id: userId, // Include the user_id to satisfy the NOT NULL constraint
          last_updated: new Date().toISOString(),
          tags: [] // Default empty tags
        }, {
          onConflict: 'linkedin_url'
        });

      if (error) {
        console.error('❌ Error saving profile to Supabase:', error);
        return false;
      }

      console.log('✅ Profile saved to Supabase successfully');
      return true;
    } catch (error) {
      console.error('❌ Critical error saving profile to Supabase:', error);
      return false;
    }
  }

  static async saveMultipleProfiles(profiles: any[], userId: string): Promise<number> {
    let savedCount = 0;
    
    for (const profile of profiles) {
      const success = await this.saveProfile(profile, userId);
      if (success) savedCount++;
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return savedCount;
  }

  static async getAllProfiles(): Promise<any[]> {
    try {
      console.log('🔍 Fetching all profiles from Supabase...');
      
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('❌ Error fetching profiles from Supabase:', error);
        return [];
      }

      console.log('✅ Fetched', data?.length || 0, 'profiles from Supabase');
      return data || [];
    } catch (error) {
      console.error('❌ Critical error fetching profiles from Supabase:', error);
      return [];
    }
  }

  static async checkProfileExists(linkedinUrl: string): Promise<any | null> {
    try {
      // Clean the URL to ensure it's a single URL
      const cleanUrl = linkedinUrl.trim();
      
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .eq('linkedin_url', cleanUrl)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

      if (error) {
        console.error('❌ Error checking profile existence:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Critical error checking profile existence:', error);
      return null;
    }
  }
}