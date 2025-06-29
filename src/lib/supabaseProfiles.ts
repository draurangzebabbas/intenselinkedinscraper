import { supabase } from './supabase';
import { ImageStorageService } from '../utils/imageStorage';

// Enhanced Supabase service with image optimization
export class SupabaseProfilesService {
  static async saveProfile(profileData: any, userId: string): Promise<boolean> {
    try {
      console.log('💾 Saving profile to Supabase:', profileData.linkedinUrl);
      
      // Optimize images before saving
      let optimizedProfileData = profileData;
      try {
        console.log('🖼️ Starting image optimization...');
        optimizedProfileData = await ImageStorageService.optimizeProfileImages(
          profileData, 
          `${userId}-${Date.now()}`
        );
        console.log('✅ Image optimization completed');
      } catch (imageError) {
        console.error('❌ Image optimization failed:', imageError);
        // Continue with original data if image optimization fails
        optimizedProfileData = profileData;
      }
      
      // Include user_id to satisfy the NOT NULL constraint
      const { error } = await supabase
        .from('linkedin_profiles')
        .upsert({
          linkedin_url: optimizedProfileData.linkedinUrl || optimizedProfileData.linkedin_url,
          profile_data: optimizedProfileData,
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

  static async updateProfile(profileData: any, userId: string): Promise<boolean> {
    try {
      console.log('🔄 Updating profile in Supabase:', profileData.linkedinUrl);
      
      // Optimize images before updating
      let optimizedProfileData = profileData;
      try {
        console.log('🖼️ Starting image optimization for update...');
        optimizedProfileData = await ImageStorageService.optimizeProfileImages(
          profileData, 
          `${userId}-${Date.now()}`
        );
        console.log('✅ Image optimization completed for update');
      } catch (imageError) {
        console.error('❌ Image optimization failed for update:', imageError);
        // Continue with original data if image optimization fails
        optimizedProfileData = profileData;
      }
      
      const { error } = await supabase
        .from('linkedin_profiles')
        .update({
          profile_data: optimizedProfileData,
          last_updated: new Date().toISOString()
        })
        .eq('linkedin_url', optimizedProfileData.linkedinUrl || optimizedProfileData.linkedin_url);

      if (error) {
        console.error('❌ Error updating profile in Supabase:', error);
        return false;
      }

      console.log('✅ Profile updated in Supabase successfully');
      return true;
    } catch (error) {
      console.error('❌ Critical error updating profile in Supabase:', error);
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

  static async getAllProfilesForUser(userId: string): Promise<any[]> {
    try {
      console.log('🔍 Fetching profiles for user from Supabase:', userId);
      
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('❌ Error fetching user profiles from Supabase:', error);
        return [];
      }

      console.log('✅ Fetched', data?.length || 0, 'profiles for user from Supabase');
      return data || [];
    } catch (error) {
      console.error('❌ Critical error fetching user profiles from Supabase:', error);
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

  static async deleteProfiles(profileIds: string[]): Promise<boolean> {
    try {
      console.log('🗑️ Deleting profiles from Supabase:', profileIds);
      
      const { error } = await supabase
        .from('linkedin_profiles')
        .delete()
        .in('id', profileIds);

      if (error) {
        console.error('❌ Error deleting profiles from Supabase:', error);
        return false;
      }

      console.log('✅ Profiles deleted from Supabase successfully');
      return true;
    } catch (error) {
      console.error('❌ Critical error deleting profiles from Supabase:', error);
      return false;
    }
  }
}