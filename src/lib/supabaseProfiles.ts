import { supabase } from './supabase';

// Updated interface for the new shared profile model
export interface GlobalProfile {
  id: string;
  linkedin_url: string;
  profile_data: any;
  last_updated: string;
  created_at: string;
}

export interface UserStoredProfile {
  id: string;
  user_id: string;
  global_profile_id: string;
  tags: string[];
  stored_at: string;
  // Joined data from global_linkedin_profiles
  global_profile?: GlobalProfile;
}

// Enhanced Supabase service with shared profile data model
export class SupabaseProfilesService {
  /**
   * Save a profile to the global profiles table and optionally link it to a user
   */
  static async saveProfile(profileData: any, userId: string, tags: string[] = []): Promise<any | null> {
    try {
      console.log('💾 Saving profile to global storage, URL:', profileData.linkedinUrl);
      
      // Use profile data directly without image optimization
      const optimizedProfileData = profileData;
      console.log('⚠️ Using temporary image links - no storage optimization');
      
      // Step 1: Upsert into global_linkedin_profiles
      const { data: globalProfile, error: globalError } = await supabase
        .from('global_linkedin_profiles')
        .upsert({
          linkedin_url: optimizedProfileData.linkedinUrl || optimizedProfileData.linkedin_url,
          profile_data: optimizedProfileData,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'linkedin_url'
        })
        .select()
        .single();

      if (globalError) {
        console.error('❌ Error saving to global profiles:', globalError);
        
        // Provide more helpful error messages
        if (globalError.message.includes('row-level security policy')) {
          console.error('💡 RLS Policy Issue: The database policy prevents saving profiles.');
          console.error('💡 Solution: Run the migration to fix RLS policies or check your Supabase RLS settings.');
        }
        
        return null;
      }

      console.log('✅ Profile saved to global storage:', globalProfile.id);

      // Step 2: Link to user in user_stored_profiles (if not already linked)
      const { data: existingLink, error: linkCheckError } = await supabase
        .from('user_stored_profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('global_profile_id', globalProfile.id)
        .maybeSingle();

      if (linkCheckError) {
        console.error('❌ Error checking existing link:', linkCheckError);
      }

      if (!existingLink) {
        const { data: userLink, error: linkError } = await supabase
          .from('user_stored_profiles')
          .insert({
            user_id: userId,
            global_profile_id: globalProfile.id,
            tags: tags
          })
          .select()
          .single();

        if (linkError) {
          console.error('❌ Error linking profile to user:', linkError);
          // Still return the global profile even if linking fails
        } else {
          console.log('✅ Profile linked to user:', userId);
        }
      } else {
        // Update tags if profile is already linked
        const { error: updateError } = await supabase
          .from('user_stored_profiles')
          .update({ tags: tags })
          .eq('id', existingLink.id);

        if (updateError) {
          console.error('❌ Error updating tags:', updateError);
        }
      }

      // Return the global profile with additional metadata
      return {
        id: globalProfile.id,
        linkedin_url: globalProfile.linkedin_url,
        profile_data: globalProfile.profile_data,
        last_updated: globalProfile.last_updated,
        tags: tags
      };

    } catch (error) {
      console.error('❌ Critical error saving profile:', error);
      
      // Provide more context for common errors
      if (error instanceof Error) {
        if (error.message.includes('row-level security')) {
          console.error('💡 This appears to be an RLS policy issue. Please run the migration to fix database permissions.');
        }
      }
      
      return null;
    }
  }

  /**
   * Update a profile in the global storage (benefits all users)
   */
  static async updateProfile(profileData: any, linkedinUrl: string): Promise<boolean> {
    try {
      console.log('🔄 Updating global profile:', linkedinUrl);
      
      // Use profile data directly without image optimization
      const optimizedProfileData = profileData;
      console.log('⚠️ Using temporary image links - no storage optimization');
      
      const { error } = await supabase
        .from('global_linkedin_profiles')
        .update({
          profile_data: optimizedProfileData,
          last_updated: new Date().toISOString()
        })
        .eq('linkedin_url', linkedinUrl);

      if (error) {
        console.error('❌ Error updating global profile:', error);
        return false;
      }

      console.log('✅ Global profile updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Critical error updating profile:', error);
      return false;
    }
  }

  /**
   * Get profiles stored by a specific user (with latest global data)
   */
  static async getUserProfiles(userId: string): Promise<any[]> {
    try {
      console.log('🔍 Fetching user stored profiles:', userId);
      
      // First, get the user stored profiles
      const { data: userStoredProfiles, error: userError } = await supabase
        .from('user_stored_profiles')
        .select('id, user_id, global_profile_id, tags, stored_at')
        .eq('user_id', userId)
        .order('stored_at', { ascending: false });

      if (userError) {
        console.error('❌ Error fetching user stored profiles:', userError);
        return [];
      }

      if (!userStoredProfiles || userStoredProfiles.length === 0) {
        console.log('✅ No stored profiles found for user');
        return [];
      }

      // Get the global profile IDs
      const globalProfileIds = userStoredProfiles
        .map(profile => profile.global_profile_id)
        .filter(id => id !== null);

      if (globalProfileIds.length === 0) {
        console.log('✅ No valid global profile IDs found');
        return [];
      }

      // Fetch the corresponding global profiles
      const { data: globalProfiles, error: globalError } = await supabase
        .from('global_linkedin_profiles')
        .select('id, linkedin_url, profile_data, last_updated, created_at')
        .in('id', globalProfileIds);

      if (globalError) {
        console.error('❌ Error fetching global profiles:', globalError);
        return [];
      }

      // Create a map for quick lookup
      const globalProfilesMap = new Map();
      globalProfiles?.forEach(profile => {
        globalProfilesMap.set(profile.id, profile);
      });

      // Combine the data
      const profiles = userStoredProfiles.map(userProfile => {
        const globalProfile = globalProfilesMap.get(userProfile.global_profile_id);
        
        return {
          id: userProfile.id, // This is the user_stored_profiles.id for deletion
          linkedin_url: globalProfile?.linkedin_url || '',
          profile_data: globalProfile?.profile_data || {},
          last_updated: globalProfile?.last_updated || '',
          created_at: globalProfile?.created_at || '',
          tags: userProfile.tags || [],
          global_profile_id: userProfile.global_profile_id
        };
      }).filter(profile => profile.linkedin_url); // Filter out profiles without global data

      console.log('✅ Fetched', profiles.length, 'user profiles');
      return profiles;
    } catch (error) {
      console.error('❌ Critical error fetching user profiles:', error);
      return [];
    }
  }

  /**
   * Check if a profile exists in global storage
   */
  static async checkProfileExists(linkedinUrl: string): Promise<any | null> {
    try {
      const cleanUrl = linkedinUrl.trim();
      
      const { data, error } = await supabase
        .from('global_linkedin_profiles')
        .select('*')
        .eq('linkedin_url', cleanUrl)
        .maybeSingle();

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

  /**
   * Remove profiles from a user's stored list (doesn't delete global data)
   */
  static async deleteProfiles(userStoredProfileIds: string[], userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Removing profiles from user storage:', userId, 'IDs:', userStoredProfileIds);
      
      const { error } = await supabase
        .from('user_stored_profiles')
        .delete()
        .in('id', userStoredProfileIds)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error removing profiles from user storage:', error);
        return false;
      }

      console.log('✅ Profiles removed from user storage successfully');
      return true;
    } catch (error) {
      console.error('❌ Critical error removing profiles:', error);
      return false;
    }
  }

  /**
   * Get all global profiles (admin function - use sparingly)
   */
  static async getAllGlobalProfiles(): Promise<any[]> {
    console.warn('⚠️ getAllGlobalProfiles() called - this returns ALL global profiles!');
    try {
      console.log('🔍 Fetching ALL global profiles...');
      
      const { data, error } = await supabase
        .from('global_linkedin_profiles')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('❌ Error fetching all global profiles:', error);
        return [];
      }

      console.log('✅ Fetched', data?.length || 0, 'total global profiles');
      return data || [];
    } catch (error) {
      console.error('❌ Critical error fetching all global profiles:', error);
      return [];
    }
  }

  /**
   * Store multiple profiles for a user
   */
  static async saveMultipleProfiles(profiles: any[], userId: string, tags: string[] = []): Promise<number> {
    let savedCount = 0;
    
    for (const profile of profiles) {
      const savedProfile = await this.saveProfile(profile, userId, tags);
      if (savedProfile) savedCount++;
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return savedCount;
  }

  /**
   * Get profile statistics
   */
  static async getProfileStats(): Promise<{
    totalGlobalProfiles: number;
    totalUserStoredProfiles: number;
    recentlyUpdated: number;
  }> {
    try {
      const [globalCount, userStoredCount, recentCount] = await Promise.all([
        supabase.from('global_linkedin_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_stored_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('global_linkedin_profiles')
          .select('id', { count: 'exact', head: true })
          .gte('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      return {
        totalGlobalProfiles: globalCount.count || 0,
        totalUserStoredProfiles: userStoredCount.count || 0,
        recentlyUpdated: recentCount.count || 0
      };
    } catch (error) {
      console.error('❌ Error getting profile stats:', error);
      return {
        totalGlobalProfiles: 0,
        totalUserStoredProfiles: 0,
        recentlyUpdated: 0
      };
    }
  }
}