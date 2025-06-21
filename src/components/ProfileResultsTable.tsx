import React, { useState, useMemo } from 'react';
import { 
  User, MapPin, Users, Briefcase, GraduationCap, Award, 
  Eye, EyeOff, Filter, Download, RefreshCw, ExternalLink,
  Mail, Phone, Building, Calendar, Star, X
} from 'lucide-react';

interface ProfileResultsTableProps {
  profiles: any[];
  onViewDetails: (profile: any) => void;
  onUpdateProfile?: (profileUrl: string) => Promise<void>;
  onExport?: (format: string) => void;
  isUpdating?: boolean;
  showActions?: boolean;
}

export const ProfileResultsTable: React.FC<ProfileResultsTableProps> = ({
  profiles,
  onViewDetails,
  onUpdateProfile,
  onExport,
  isUpdating = false,
  showActions = true
}) => {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['picture', 'name', 'headline', 'location', 'connections', 'company', 'actions'])
  );
  const [filter, setFilter] = useState('');

  const allColumns = [
    { key: 'picture', label: 'Picture' },
    { key: 'name', label: 'Name' },
    { key: 'headline', label: 'Headline' },
    { key: 'location', label: 'Location' },
    { key: 'connections', label: 'Connections' },
    { key: 'followers', label: 'Followers' },
    { key: 'company', label: 'Current Company' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'industry', label: 'Industry' },
    { key: 'experience', label: 'Experience' },
    { key: 'education', label: 'Education' },
    { key: 'skills', label: 'Top Skills' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'duration', label: 'Current Role Duration' },
    { key: 'website', label: 'Website' },
    { key: 'actions', label: 'Actions' }
  ];

  const filteredProfiles = useMemo(() => {
    if (!filter) return profiles;
    
    return profiles.filter(profile => {
      const searchText = `${profile.fullName || ''} ${profile.headline || ''} ${profile.addressWithCountry || ''} ${profile.companyName || ''}`.toLowerCase();
      return searchText.includes(filter.toLowerCase());
    });
  }, [profiles, filter]);

  const toggleColumn = (columnKey: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnKey)) {
      newVisible.delete(columnKey);
    } else {
      newVisible.add(columnKey);
    }
    setVisibleColumns(newVisible);
  };

  const renderCell = (profile: any, columnKey: string) => {
    switch (columnKey) {
      case 'picture':
        return (
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {profile.profilePic ? (
              <img 
                src={profile.profilePic} 
                alt={profile.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
        );
      
      case 'name':
        return (
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim()}
            </div>
            <div className="text-sm text-blue-600 hover:underline">
              <a 
                href={profile.linkedinUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                LinkedIn Profile
              </a>
            </div>
          </div>
        );
      
      case 'headline':
        return (
          <div className="max-w-xs">
            <div 
              className="text-sm text-gray-900 line-clamp-2" 
              title={profile.headline}
            >
              {profile.headline || 'No headline'}
            </div>
          </div>
        );
      
      case 'location':
        return (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {profile.addressWithCountry || profile.addressCountryOnly || 'Not specified'}
            </span>
          </div>
        );
      
      case 'connections':
        return (
          <div className="flex items-center gap-1 text-sm">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-medium">
              {profile.connections?.toLocaleString() || '0'}
            </span>
          </div>
        );
      
      case 'followers':
        return (
          <div className="flex items-center gap-1 text-sm">
            <Users className="w-4 h-4 text-green-600" />
            <span className="font-medium">
              {profile.followers?.toLocaleString() || '0'}
            </span>
          </div>
        );
      
      case 'company':
        return (
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {profile.companyName || 'Not specified'}
              </div>
              {profile.companySize && (
                <div className="text-xs text-gray-500">
                  {profile.companySize} employees
                </div>
              )}
            </div>
          </div>
        );
      
      case 'jobTitle':
        return (
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-900 truncate">
              {profile.jobTitle || 'Not specified'}
            </span>
          </div>
        );
      
      case 'industry':
        return (
          <span className="text-sm text-gray-600">
            {profile.companyIndustry || 'Not specified'}
          </span>
        );
      
      case 'experience':
        return (
          <div className="text-sm text-gray-600">
            {profile.experiences?.length || 0} positions
          </div>
        );
      
      case 'education':
        return (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <GraduationCap className="w-4 h-4" />
            <span>{profile.educations?.length || 0} schools</span>
          </div>
        );
      
      case 'skills':
        return (
          <div className="max-w-xs">
            {profile.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {profile.skills.slice(0, 3).map((skill: any, idx: number) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                  >
                    {skill.title}
                  </span>
                ))}
                {profile.skills.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{profile.skills.length - 3} more
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-500">No skills listed</span>
            )}
          </div>
        );
      
      case 'email':
        return profile.email ? (
          <a 
            href={`mailto:${profile.email}`}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Mail className="w-4 h-4" />
            {profile.email}
          </a>
        ) : (
          <span className="text-sm text-gray-500">Not available</span>
        );
      
      case 'phone':
        return profile.mobileNumber ? (
          <a 
            href={`tel:${profile.mobileNumber}`}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Phone className="w-4 h-4" />
            {profile.mobileNumber}
          </a>
        ) : (
          <span className="text-sm text-gray-500">Not available</span>
        );
      
      case 'duration':
        return (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{profile.currentJobDuration || 'Not specified'}</span>
          </div>
        );
      
      case 'website':
        return profile.creatorWebsite?.link ? (
          <a 
            href={profile.creatorWebsite.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            {profile.creatorWebsite.name || 'Website'}
          </a>
        ) : (
          <span className="text-sm text-gray-500">Not available</span>
        );
      
      case 'actions':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => onViewDetails(profile)}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Details
            </button>
            
            {showActions && onUpdateProfile && (
              <button
                onClick={() => onUpdateProfile(profile.linkedinUrl)}
                disabled={isUpdating}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                Update
              </button>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h3 className="text-xl font-bold text-gray-900">
            Profile Results ({filteredProfiles.length})
          </h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Filter profiles..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {onExport && (
              <select
                onChange={(e) => onExport(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue=""
              >
                <option value="" disabled>Export as...</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xlsx">Excel</option>
              </select>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {allColumns.map(column => (
              <button
                key={column.key}
                onClick={() => toggleColumn(column.key)}
                className={`inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full transition-colors ${
                  visibleColumns.has(column.key)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {visibleColumns.has(column.key) ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                {column.label}
                {visibleColumns.has(column.key) && column.key !== 'actions' && (
                  <X className="w-3 h-3 ml-1 hover:text-red-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {allColumns
                .filter(column => visibleColumns.has(column.key))
                .map(column => (
                  <th key={column.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {column.label}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProfiles.map((profile, index) => (
              <tr key={profile.linkedinUrl || index} className="hover:bg-gray-50">
                {allColumns
                  .filter(column => visibleColumns.has(column.key))
                  .map(column => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                      {renderCell(profile, column.key)}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredProfiles.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <div className="text-gray-500">No profiles found</div>
        </div>
      )}
    </div>
  );
};