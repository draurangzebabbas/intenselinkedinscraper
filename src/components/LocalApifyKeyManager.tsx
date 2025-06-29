import React, { useState, useEffect } from 'react';
import { Key, Plus, Edit3, Trash2, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { LocalStorageService, type LocalApifyKey } from '../lib/localStorage';

interface LocalApifyKeyManagerProps {
  userId: string;
  selectedKeyId?: string;
  onKeySelect: (key: LocalApifyKey) => void;
}

export const LocalApifyKeyManager: React.FC<LocalApifyKeyManagerProps> = ({
  userId,
  selectedKeyId,
  onKeySelect
}) => {
  const [keys, setKeys] = useState<LocalApifyKey[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKey, setEditingKey] = useState<LocalApifyKey | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({ key_name: '', api_key: '' });
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    loadKeys();
  }, [userId]);

  const loadKeys = () => {
    const userKeys = LocalStorageService.getApifyKeys(userId);
    setKeys(userKeys);

    // Auto-select first active key if none selected
    if (!selectedKeyId && userKeys.length > 0) {
      const activeKey = userKeys.find(k => k.isActive) || userKeys[0];
      onKeySelect(activeKey);
    }
  };

  const validateForm = () => {
    if (!formData.key_name.trim()) {
      setError('Please enter a key name');
      return false;
    }
    if (!formData.api_key.trim()) {
      setError('Please enter an API key');
      return false;
    }
    if (formData.key_name.trim().length < 2) {
      setError('Key name must be at least 2 characters long');
      return false;
    }
    if (formData.api_key.trim().length < 10) {
      setError('API key seems too short. Please check your key.');
      return false;
    }
    return true;
  };

  const saveKey = () => {
    if (!validateForm()) return;

    setError('');
    setSuccess('');

    try {
      if (editingKey) {
        const updatedKey: LocalApifyKey = {
          ...editingKey,
          keyName: formData.key_name.trim(),
          apiKey: formData.api_key.trim()
        };
        
        LocalStorageService.saveApifyKey(updatedKey);
        setSuccess('API key updated successfully!');
      } else {
        // Check for duplicate key names
        const existingKeys = LocalStorageService.getApifyKeys(userId);
        if (existingKeys.some(k => k.keyName === formData.key_name.trim())) {
          setError('A key with this name already exists. Please choose a different name.');
          return;
        }

        const newKey = LocalStorageService.createApifyKey(
          userId,
          formData.key_name.trim(),
          formData.api_key.trim()
        );
        
        setSuccess('API key created successfully!');
        onKeySelect(newKey);
      }

      // Reset form
      setFormData({ key_name: '', api_key: '' });
      setShowCreateForm(false);
      setEditingKey(null);
      loadKeys();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error saving API key:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const deleteKey = (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      LocalStorageService.deleteApifyKey(keyId);
      setSuccess('API key deleted successfully!');
      
      // Select another key if the deleted one was selected
      if (selectedKeyId === keyId && keys.length > 1) {
        const remainingKeys = keys.filter(k => k.id !== keyId);
        if (remainingKeys.length > 0) {
          onKeySelect(remainingKeys[0]);
        }
      }

      loadKeys();
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error deleting API key:', error);
      setError('Failed to delete API key. Please try again.');
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const startEdit = (key: LocalApifyKey) => {
    setEditingKey(key);
    setFormData({ key_name: key.keyName, api_key: key.apiKey });
    setShowCreateForm(true);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setFormData({ key_name: '', api_key: '' });
    setShowCreateForm(false);
    setError('');
    setSuccess('');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Apify API Keys</h3>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setError('');
            setSuccess('');
          }}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Key
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {showCreateForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">
            {editingKey ? 'Edit API Key' : 'Add New API Key'}
          </h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Key Name (e.g., 'Main Key', 'Backup Key')"
              value={formData.key_name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, key_name: e.target.value }));
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <input
              type="password"
              placeholder="Apify API Key"
              value={formData.api_key}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, api_key: e.target.value }));
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <div className="flex gap-2">
              <button
                onClick={saveKey}
                disabled={!formData.key_name.trim() || !formData.api_key.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingKey ? 'Update Key' : 'Add Key'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {keys.map(key => (
          <div
            key={key.id}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedKeyId === key.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onKeySelect(key)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{key.keyName}</div>
                  <div className="text-sm text-gray-500 font-mono">
                    {showApiKey[key.id] 
                      ? key.apiKey 
                      : '•'.repeat(Math.min(key.apiKey.length, 20))
                    }
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleKeyVisibility(key.id);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title={showApiKey[key.id] ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey[key.id] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(key);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Edit API key"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteKey(key.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete API key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {selectedKeyId === key.id && (
              <div className="mt-2 text-xs text-blue-600 font-medium">
                ✓ Currently selected for scraping
              </div>
            )}
          </div>
        ))}
      </div>

      {keys.length === 0 && !showCreateForm && (
        <div className="text-center py-8 text-gray-500">
          <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No API keys found. Add your first Apify API key to get started.</p>
        </div>
      )}
    </div>
  );
};