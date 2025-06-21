export const exportData = (data: any[], format: string, filename: string = 'linkedin_data', selectedProfiles?: Set<string>) => {
  // Filter data if selectedProfiles is provided
  let exportData = data;
  if (selectedProfiles && selectedProfiles.size > 0) {
    exportData = data.filter(item => selectedProfiles.has(item.id));
  }

  switch (format) {
    case 'csv':
      exportToCSV(exportData, filename);
      break;
    case 'json':
      exportToJSON(exportData, filename);
      break;
    case 'xlsx':
      // For Excel export, we'll use a simple CSV for now
      // In a real app, you'd use a library like xlsx
      exportToCSV(exportData, filename);
      break;
    default:
      console.error('Unsupported export format:', format);
  }
};

const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  // Flatten the profile data for CSV export
  const flattenedData = data.map(profile => {
    const element = profile.profile_data || {};
    return {
      id: profile.id,
      linkedin_url: profile.linkedin_url,
      first_name: element.firstName || '',
      last_name: element.lastName || '',
      full_name: element.fullName || `${element.firstName || ''} ${element.lastName || ''}`.trim(),
      headline: element.headline || '',
      about: element.about || '',
      location: element.addressWithCountry || element.addressCountryOnly || '',
      connections: element.connections || 0,
      followers: element.followers || 0,
      current_company: element.companyName || element.experiences?.[0]?.companyName || '',
      job_title: element.jobTitle || '',
      company_industry: element.companyIndustry || '',
      company_size: element.companySize || '',
      current_job_duration: element.currentJobDuration || '',
      email: element.email || '',
      mobile_number: element.mobileNumber || '',
      experience_count: element.experiences?.length || 0,
      education_count: element.educations?.length || 0,
      skills_count: element.skills?.length || 0,
      top_skills: element.skills?.slice(0, 5).map((s: any) => s.title).join('; ') || '',
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
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
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