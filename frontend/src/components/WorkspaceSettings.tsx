'use client';

import React, { useState } from 'react';
import { 
  Save, 
  Trash2, 
  Shield, 
  Globe, 
  Users, 
  AlertTriangle,
  Settings,
  Lock
} from 'lucide-react';
import WorkspaceService, { IWorkspace } from '../lib/WorkspaceService';

interface WorkspaceSettingsProps {
  workspace: IWorkspace;
  onUpdate: (updatedWorkspace: IWorkspace) => void;
}

const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({
  workspace,
  onUpdate
}) => {
  const [formData, setFormData] = useState({
    name: workspace.name,
    description: workspace.description || '',
    isPublic: workspace.settings.isPublic,
    allowInvitations: workspace.settings.allowInvitations,
    defaultRole: workspace.settings.defaultRole
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedWorkspace = await WorkspaceService.updateWorkspace(workspace._id, {
        name: formData.name,
        description: formData.description,
        settings: {
          isPublic: formData.isPublic,
          allowInvitations: formData.allowInvitations,
          defaultRole: formData.defaultRole
        }
      });

      onUpdate(updatedWorkspace);
      setSuccess('Workspace settings updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update workspace settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await WorkspaceService.deleteWorkspace(workspace._id);
      // Redirect to workspaces list or show success
      window.location.href = '/dashboard/workspaces';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete workspace');
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-600">{success}</p>
        </div>
      )}

      {/* Basic Settings */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Basic Settings
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workspace Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description for your workspace"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Privacy & Access Settings */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Privacy & Access
          </h3>
        </div>
        <div className="p-6 space-y-6">
          {/* Public Workspace Toggle */}
          <div className="flex items-start space-x-3">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-900">
                  Public Workspace
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Allow anyone with the link to view this workspace and its public forms.
              </p>
            </div>
          </div>

          {/* Allow Invitations Toggle */}
          <div className="flex items-start space-x-3">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                checked={formData.allowInvitations}
                onChange={(e) => setFormData(prev => ({ ...prev, allowInvitations: e.target.checked }))}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-900">
                  Allow Member Invitations
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Allow workspace members to invite new people to join.
              </p>
            </div>
          </div>

          {/* Default Role for New Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Role for New Members
            </label>
            <select
              value={formData.defaultRole}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                defaultRole: e.target.value as 'viewer' | 'editor' | 'admin' 
              }))}
              className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="viewer">Viewer - Can view forms and responses</option>
              <option value="editor">Editor - Can edit forms and manage responses</option>
              <option value="admin">Admin - Full workspace access</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              The default role assigned to new members when they join the workspace.
            </p>
          </div>
        </div>
      </div>

      {/* Workspace Statistics */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Workspace Statistics</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{workspace.stats.totalForms}</div>
              <div className="text-sm text-blue-600">Total Forms</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{workspace.stats.totalMembers}</div>
              <div className="text-sm text-green-600">Team Members</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{workspace.stats.totalResponses}</div>
              <div className="text-sm text-purple-600">Total Responses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200">
        <div className="px-6 py-4 border-b border-red-200">
          <h3 className="text-lg font-medium text-red-900 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Danger Zone
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Delete Workspace</h4>
              <p className="text-sm text-gray-500 mt-1">
                Permanently delete this workspace and all its data. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={handleDelete}
              disabled={loading}
              className={`inline-flex items-center px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                showDeleteConfirm 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {showDeleteConfirm ? 'Confirm Delete' : 'Delete Workspace'}
            </button>
          </div>
          
          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 mb-3">
                <strong>Are you sure?</strong> This will permanently delete the workspace "{workspace.name}" 
                and all associated forms, responses, and member data.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSettings;