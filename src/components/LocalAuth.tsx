import React, { useState } from 'react';
import { LocalStorageService, type LocalUser } from '../lib/localStorage';
import { User, Mail, UserPlus, LogIn, Users } from 'lucide-react';

interface LocalAuthProps {
  onAuthSuccess: (user: LocalUser) => void;
}

export const LocalAuth: React.FC<LocalAuthProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'select'>('select');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: ''
  });
  const [selectedUserId, setSelectedUserId] = useState('');

  const existingUsers = LocalStorageService.getUsers();

  const handleCreateUser = () => {
    if (!formData.username.trim() || !formData.email.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    const user = LocalStorageService.createUser({
      username: formData.username.trim(),
      email: formData.email.trim(),
      fullName: formData.fullName.trim() || undefined
    });

    onAuthSuccess(user);
  };

  const handleSelectUser = () => {
    if (!selectedUserId) {
      alert('Please select a user');
      return;
    }

    const user = existingUsers.find(u => u.id === selectedUserId);
    if (user) {
      LocalStorageService.setCurrentUser(user.id);
      onAuthSuccess(user);
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This will remove all their data.')) {
      const users = LocalStorageService.getUsers();
      const filteredUsers = users.filter(u => u.id !== userId);
      localStorage.setItem('linkedin_scraper_users', JSON.stringify(filteredUsers));
      
      // Clear other data for this user
      const keys = LocalStorageService.getApifyKeys(userId);
      keys.forEach(key => LocalStorageService.deleteApifyKey(key.id));
      
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-xl font-bold">LinkedIn Scraper</h2>
              <p className="text-blue-100 text-sm mt-1">Select or create a user profile</p>
            </div>
          </div>

          <div className="p-8">
            {/* Mode Selection */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode('select')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'select' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Select User
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'signup' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                New User
              </button>
            </div>

            {mode === 'select' && (
              <div className="space-y-4">
                {existingUsers.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {existingUsers.map(user => (
                        <div
                          key={user.id}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                            selectedUserId === user.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {user.fullName || user.username}
                                </div>
                                <div className="text-sm text-gray-600">{user.email}</div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUser(user.id);
                              }}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSelectUser}
                      disabled={!selectedUserId}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      Continue as Selected User
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No users found. Create your first user to get started.</p>
                  </div>
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter full name (optional)"
                  />
                </div>

                <button
                  onClick={handleCreateUser}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Create User
                </button>
              </div>
            )}

            {/* Clear All Data Button */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
                    LocalStorageService.clearAllData();
                    window.location.reload();
                  }
                }}
                className="w-full text-sm text-red-600 hover:text-red-800"
              >
                Clear All Local Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};