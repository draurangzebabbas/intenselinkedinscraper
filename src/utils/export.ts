export const exportData = (data: any[], format: string, filename: string = 'linkedin_data') => {
  switch (format) {
    case 'csv':
      exportToCSV(data, filename);
      break;
    case 'json':
      exportToJSON(data, filename);
      break;
    case 'xlsx':
      // For Excel export, we'll use a simple CSV for now
      // In a real app, you'd use a library like xlsx
      exportToCSV(data, filename);
      break;
    default:
      console.error('Unsupported export format:', format);
  }
};

const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  // Flatten the profile data for CSV export
  const flattenedData = data.map(profile => {
    const element = profile.profile_data?.element || {};
    return {
      id: profile.id,
      linkedin_url: profile.linkedin_url,
      first_name: element.firstName || '',
      last_name: element.lastName || '',
      full_name: `${element.firstName || ''} ${element.lastName || ''}`.trim(),
      headline: element.headline || '',
      about: element.about || '',
      location: element.location?.linkedinText || '',
      country: element.location?.countryCode || '',
      connections: element.connectionsCount || 0,
      followers: element.followerCount || 0,
      current_company: element.currentPosition?.[0]?.companyName || element.experience?.[0]?.companyName || '',
      experience_count: element.experience?.length || 0,
      education_count: element.education?.length || 0,
      last_updated: profile.last_updated || '',
      created_at: profile.created_at || ''
    };
  });

  const headers = Object.keys(flattenedData[0]);
  const csvContent = [
    headers.join(','),
    ...flattenedData.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

const exportToJSON = (data: any[], filename: string) => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};