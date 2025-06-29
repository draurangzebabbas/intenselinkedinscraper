import { supabase } from './supabase';
import { ImageStorageService } from '../utils/imageStorage';

// Enhanced Supabase service with proper user isolation
export class SupabaseProfilesService {
  static async saveProfile(profileData: any, userId: string): Promise<any | null> {
    try {
      console.log('💾 Saving profile to Supabase for user:', userId, 'URL:', profileData.linkedinUrl);
      
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
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .upsert({
          linkedin_url: optimizedProfileData.linkedinUrl || optimizedProfileData.linkedin_url,
          profile_data: optimizedProfileData,
          user_id: userId, // This ensures the profile belongs to the specific user
          last_updated: new Date().toISOString(),
          tags: [] // Default empty tags
        }, {
          onConflict: 'linkedin_url'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving profile to Supabase:', error);
        return null;
      }

      console.log('✅ Profile saved to Supabase successfully for user:', userId);
      return data; // Return the complete saved profile object with id
    } catch (error) {
      console.error('❌ Critical error saving profile to Supabase:', error);
      return null;
    }
  }

  static async updateProfile(profileData: any, userId: string): Promise<boolean> {
    try {
      console.log('🔄 Updating profile in Supabase for user:', userId, 'URL:', profileData.linkedinUrl);
      
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
      
      // Only update profiles that belong to this user
      const { error } = await supabase
        .from('linkedin_profiles')
        .update({
          profile_data: optimizedProfileData,
          last_updated: new Date().toISOString()
        })
        .eq('linkedin_url', optimizedProfileData.linkedinUrl || optimizedProfileData.linkedin_url)
        .eq('user_id', userId); // Ensure we only update profiles owned by this user

      if (error) {
        console.error('❌ Error updating profile in Supabase:', error);
        return false;
      }

      console.log('✅ Profile updated in Supabase successfully for user:', userId);
      return true;
    } catch (error) {
      console.error('❌ Critical error updating profile in Supabase:', error);
      return false;
    }
  }

  static async saveMultipleProfiles(profiles: any[], userId: string): Promise<number> {
    let savedCount = 0;
    
    for (const profile of profiles) {
      const savedProfile = await this.saveProfile(profile, userId);
      if (savedProfile) savedCount++;
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return savedCount;
  }

  // FIXED: This should only return profiles for the specific user
  static async getUserProfiles(userId: string): Promise<any[]> {
    try {
      console.log('🔍 Fetching profiles for user from Supabase:', userId);
      
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .eq('user_id', userId) // Only get profiles for this specific user
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

  // DEPRECATED: This method should not be used in user-specific contexts
  static async getAllProfiles(): Promise<any[]> {
    console.warn('⚠️ getAllProfiles() called - this returns ALL profiles from ALL users!');
    try {
      console.log('🔍 Fetching ALL profiles from Supabase (admin function)...');
      
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('❌ Error fetching all profiles from Supabase:', error);
        return [];
      }

      console.log('✅ Fetched', data?.length || 0, 'total profiles from Supabase');
      return data || [];
    } catch (error) {
      console.error('❌ Critical error fetching all profiles from Supabase:', error);
      return [];
    }
  }

  static async checkProfileExists(linkedinUrl: string, userId?: string): Promise<any | null> {
    try {
      // Clean the URL to ensure it's a single URL
      const cleanUrl = linkedinUrl.trim();
      
      let query = supabase
        .from('linkedin_profiles')
        .select('*')
        .eq('linkedin_url', cleanUrl);
      
      // If userId is provided, only check profiles for that user
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.maybeSingle();

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

  static async deleteProfiles(profileIds: string[], userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting profiles from Supabase for user:', userId, 'IDs:', profileIds);
      
      // Only delete profiles that belong to this user
      const { error } = await supabase
        .from('linkedin_profiles')
        .delete()
        .in('id', profileIds)
        .eq('user_id', userId); // Ensure we only delete profiles owned by this user

      if (error) {
        console.error('❌ Error deleting profiles from Supabase:', error);
        return false;
      }

      console.log('✅ Profiles deleted from Supabase successfully for user:', userId);
      return true;
    } catch (error) {
      console.error('❌ Critical error deleting profiles from Supabase:', error);
      return false;
    }
  }
}