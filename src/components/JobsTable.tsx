import React from 'react';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Job {
  id: string;
  job_type: string;
  input_url: string;
  status: string | null;
  results_count: number | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface JobsTableProps {
  jobs: Job[];
}

export const JobsTable: React.FC<JobsTableProps> = ({ jobs }) => {
  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    const baseClasses = "inline-flex px-2 py-1 text-xs font-medium rounded-full";
    
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'running':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
    }
  };

  const formatJobType = (jobType: string) => {
    switch (jobType) {
      case 'post_comments':
        return 'Post Comments';
      case 'profile_details':
        return 'Profile Details';
      case 'mixed':
        return 'Mixed (Post + Profiles)';
      default:
        return jobType;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">Scraping Jobs ({jobs.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Results
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className={getStatusBadge(job.status)}>
                      {job.status || 'pending'}
                    </span>
                  </div>
                  {job.error_message && (
                    <div className="text-xs text-red-600 mt-1" title={job.error_message}>
                      Error: {job.error_message.substring(0, 50)}...
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">
                    {formatJobType(job.job_type)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <a
                      href={job.input_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate block"
                      title={job.input_url}
                    >
                      {job.input_url}
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {job.results_count !== null ? job.results_count.toLocaleString() : '-'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500">
                    {job.created_at ? new Date(job.created_at).toLocaleString() : '-'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500">
                    {job.completed_at ? new Date(job.completed_at).toLocaleString() : '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500">No scraping jobs yet</div>
        </div>
      )}
    </div>
  );
};