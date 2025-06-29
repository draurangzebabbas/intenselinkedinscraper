import { supabase } from './supabase';

// Simplified Supabase service only for storing scraped profiles
export class SupabaseProfilesService {
  static async saveProfile(profileData: any, userId: string): Promise<boolean> {
    try {
      console.log('💾 Saving profile to Supabase:', profileData.linkedinUrl);
      
      const { error } = await supabase
        .from('linkedin_profiles')
        .upsert({
          user_id: userId,
          linkedin_url: profileData.linkedinUrl || profileData.linkedin_url,
          profile_data: profileData,
          last_updated: new Date().toISOString()
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
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .eq('linkedin_url', linkedinUrl)
        .single();

      if (error && error.code !== 'PGRST116') {
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