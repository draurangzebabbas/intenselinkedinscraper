import React, { useState, useMemo } from 'react';
import { X, Download, RefreshCw, Eye, EyeOff, Filter, Calendar } from 'lucide-react';

interface Profile {
  id: string;
  linkedin_url: string;
  profile_data: any;
  last_updated: string | null;
  created_at: string | null;
}

interface DataTableProps {
  profiles: Profile[];
  onUpdateProfile: (profileUrl: string) => Promise<void>;
  onExport: (format: string) => void;
  isUpdating: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  profiles,
  onUpdateProfile,
  onExport,
  isUpdating
}) => {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['name', 'headline', 'location', 'connections', 'updated', 'actions'])
  );
  const [filter, setFilter] = useState('');

  const allColumns = [
    { key: 'picture', label: 'Picture' },
    { key: 'name', label: 'Name' },
    { key: 'headline', label: 'Headline' },
    { key: 'location', label: 'Location' },
    { key: 'connections', label: 'Connections' },
    { key: 'followers', label: 'Followers' },
    { key: 'company', label: 'Company' },
    { key: 'experience', label: 'Experience' },
    { key: 'education', label: 'Education' },
    { key: 'updated', label: 'Last Updated' },
    { key: 'actions', label: 'Actions' }
  ];

  const filteredProfiles = useMemo(() => {
    if (!filter) return profiles;
    
    return profiles.filter(profile => {
      const data = profile.profile_data || {};
      const searchText = `${data.fullName || data.firstName || ''} ${data.lastName || ''} ${data.headline || ''} ${data.addressWithCountry || ''}`.toLowerCase();
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return { text: 'Never', color: 'text-gray-600 bg-gray-50', exact: 'Never' };
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const exactDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    if (diffDays === 0) {
      return { text: 'Today', color: 'text-green-600 bg-green-50', exact: exactDate };
    } else if (diffDays <= 7) {
      return { text: 'This week', color: 'text-green-600 bg-green-50', exact: exactDate };
    } else if (diffDays <= 30) {
      return { text: 'This month', color: 'text-green-400 bg-green-50', exact: exactDate };
    } else {
      return { text: exactDate, color: 'text-yellow-600 bg-yellow-50', exact: exactDate };
    }
  };

  const renderCell = (profile: Profile, columnKey: string) => {
    const data = profile.profile_data || {};
    
    switch (columnKey) {
      case 'picture':
        return (
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
            {data.profilePic ? (
              <img src={data.profilePic} alt={data.fullName || `${data.firstName} ${data.lastName}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                No Photo
              </div>
            )}
          </div>
        );
      
      case 'name':
        return (
          <div>
            <div className="font-medium text-gray-900">
              {data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim()}
            </div>
            <div className="text-sm text-blue-600 hover:underline">
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                View Profile
              </a>
            </div>
          </div>
        );
      
      case 'headline':
        return (
          <div className="max-w-xs">
            <div className="text-sm text-gray-900 truncate" title={data.headline}>
              {data.headline || 'No headline'}
            </div>
          </div>
        );
      
      case 'location':
        return (
          <div className="text-sm text-gray-600">
            {data.addressWithCountry || data.addressCountryOnly || 'Not specified'}
          </div>
        );
      
      case 'connections':
        return (
          <div className="text-sm text-gray-900">
            {data.connections?.toLocaleString() || '0'}
          </div>
        );
      
      case 'followers':
        return (
          <div className="text-sm text-gray-900">
            {data.followers?.toLocaleString() || '0'}
          </div>
        );
      
      case 'company':
        return (
          <div className="text-sm text-gray-900">
            {data.companyName || data.experiences?.[0]?.companyName || 'Not specified'}
          </div>
        );
      
      case 'experience':
        return (
          <div className="text-sm text-gray-600">
            {data.experiences?.length || 0} positions
          </div>
        );
      
      case 'education':
        return (
          <div className="text-sm text-gray-600">
            {data.educations?.length || 0} schools
          </div>
        );
      
      case 'updated':
        const dateInfo = formatDate(profile.last_updated);
        return (
          <div className="group relative">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${dateInfo.color}`}>
              {dateInfo.text}
            </span>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {dateInfo.exact}
            </div>
          </div>
        );
      
      case 'actions':
        return (
          <button
            onClick={() => onUpdateProfile(profile.linkedin_url)}
            disabled={isUpdating}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            Update Info
          </button>
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
            Saved Profiles ({filteredProfiles.length})
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
            
            <div className="flex gap-2">
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
            </div>
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
            {filteredProfiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50">
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
          <div className="text-gray-500">No profiles found</div>
        </div>
      )}
    </div>
  );
};