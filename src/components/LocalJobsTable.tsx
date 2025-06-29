import React from 'react';
import { Clock, CheckCircle, XCircle, Loader2, StopCircle, AlertTriangle } from 'lucide-react';
import { LocalStorageService, type LocalJob } from '../lib/localStorage';

interface LocalJobsTableProps {
  jobs: LocalJob[];
  onCancelJob?: (jobId: string) => void;
}

export const LocalJobsTable: React.FC<LocalJobsTableProps> = ({ 
  jobs, 
  onCancelJob
}) => {
  const getStatusIcon = (status: string) => {
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

  const getStatusBadge = (status: string) => {
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

  const handleCancelJob = (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;

    // Update job status locally
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      const updatedJob: LocalJob = {
        ...job,
        status: 'failed',
        errorMessage: 'Job cancelled by user',
        completedAt: new Date().toISOString()
      };
      LocalStorageService.saveJob(updatedJob);
    }

    if (onCancelJob) {
      onCancelJob(jobId);
    }
  };

  const getJobDuration = (createdAt: string, completedAt?: string) => {
    const start = new Date(createdAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Scraping Jobs ({jobs.length})</h3>
          
          {jobs.some(job => job.status === 'running') && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">
                {jobs.filter(job => job.status === 'running').length} job(s) running
              </span>
            </div>
          )}
        </div>
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
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
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
                      {job.status}
                    </span>
                  </div>
                  {job.errorMessage && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mt-1" title={job.errorMessage}>
                      <AlertTriangle className="w-3 h-3" />
                      Error: {job.errorMessage.substring(0, 50)}...
                    </div>
                  )}
                  {job.status === 'running' && (
                    <div className="text-xs text-blue-600 mt-1">
                      Processing... ({getJobDuration(job.createdAt)})
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">
                    {formatJobType(job.jobType)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <a
                      href={job.inputUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate block"
                      title={job.inputUrl}
                    >
                      {job.inputUrl}
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {job.resultsCount.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500">
                    {getJobDuration(job.createdAt, job.completedAt)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        title="Cancel job"
                      >
                        <StopCircle className="w-3 h-3" />
                        Cancel
                      </button>
                    )}
                  </div>
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