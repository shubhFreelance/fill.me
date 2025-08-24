'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Settings, 
  Activity, 
  Plus, 
  Search, 
  MoreVertical,
  UserPlus,
  FileText,
  BarChart3,
  Clock,
  Shield,
  MessageSquare
} from 'lucide-react';
import WorkspaceService, { IWorkspace, IWorkspaceMember, IWorkspaceActivity } from '../lib/WorkspaceService';
import WorkspaceSettings from './WorkspaceSettings';
import MemberManagement from './MemberManagement';
import WorkspaceActivity from './WorkspaceActivity';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import InviteMemberModal from './InviteMemberModal';

interface WorkspaceCollaborationProps {
  initialWorkspaceId?: string;
  onWorkspaceChange?: (workspaceId: string) => void;
}

const WorkspaceCollaboration: React.FC<WorkspaceCollaborationProps> = ({
  initialWorkspaceId,
  onWorkspaceChange
}) => {
  const [workspaces, setWorkspaces] = useState<IWorkspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<IWorkspace | null>(null);
  const [members, setMembers] = useState<IWorkspaceMember[]>([]);
  const [activities, setActivities] = useState<IWorkspaceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'activity' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load workspaces on component mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Load workspace details when workspace changes
  useEffect(() => {
    if (currentWorkspace?._id) {
      loadWorkspaceDetails(currentWorkspace._id);
    }
  }, [currentWorkspace?._id]);

  // Set initial workspace if provided
  useEffect(() => {
    if (initialWorkspaceId && workspaces.length > 0) {
      const workspace = workspaces.find(w => w._id === initialWorkspaceId);
      if (workspace) {
        setCurrentWorkspace(workspace);
      }
    } else if (workspaces.length > 0 && !currentWorkspace) {
      setCurrentWorkspace(workspaces[0]);
    }
  }, [initialWorkspaceId, workspaces, currentWorkspace]);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await WorkspaceService.getWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError('Failed to load workspaces');
      console.error('Load workspaces error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceDetails = async (workspaceId: string) => {
    try {
      const [membersData, activitiesData] = await Promise.all([
        WorkspaceService.getWorkspaceMembers(workspaceId),
        WorkspaceService.getWorkspaceActivity(workspaceId, { limit: 10 })
      ]);
      
      setMembers(membersData);
      setActivities(activitiesData.activities);
    } catch (err) {
      console.error('Load workspace details error:', err);
    }
  };

  const handleWorkspaceSelect = (workspace: IWorkspace) => {
    setCurrentWorkspace(workspace);
    onWorkspaceChange?.(workspace._id);
  };

  const handleCreateWorkspace = async (data: { name: string; description?: string }) => {
    try {
      const newWorkspace = await WorkspaceService.createWorkspace(data);
      setWorkspaces(prev => [...prev, newWorkspace]);
      setCurrentWorkspace(newWorkspace);
      setShowCreateModal(false);
    } catch (err) {
      setError('Failed to create workspace');
      console.error('Create workspace error:', err);
    }
  };

  const handleInviteMember = async (data: { email: string; role: 'viewer' | 'editor' | 'admin' }) => {
    if (!currentWorkspace) return;

    try {
      await WorkspaceService.inviteMember(currentWorkspace._id, data);
      await loadWorkspaceDetails(currentWorkspace._id);
      setShowInviteModal(false);
    } catch (err) {
      setError('Failed to invite member');
      console.error('Invite member error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Workspaces Yet</h3>
        <p className="text-gray-500 mb-6">Create your first workspace to start collaborating with your team.</p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Workspace
        </button>
        {showCreateModal && (
          <CreateWorkspaceModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateWorkspace}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Collaboration</h1>
          <p className="text-gray-600 mt-1">Manage your team workspaces and collaborate on forms</p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </button>
        </div>
      </div>

      {/* Workspace Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Workspace
        </label>
        <select
          value={currentWorkspace?._id || ''}
          onChange={(e) => {
            const workspace = workspaces.find(w => w._id === e.target.value);
            if (workspace) handleWorkspaceSelect(workspace);
          }}
          className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {workspaces.map((workspace) => (
            <option key={workspace._id} value={workspace._id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </div>

      {currentWorkspace && (
        <>
          {/* Workspace Info */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{currentWorkspace.name}</h2>
                {currentWorkspace.description && (
                  <p className="text-gray-600 mt-1">{currentWorkspace.description}</p>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{currentWorkspace.stats.totalForms}</div>
                  <div className="text-sm text-gray-500">Forms</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{currentWorkspace.stats.totalMembers}</div>
                  <div className="text-sm text-gray-500">Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{currentWorkspace.stats.totalResponses}</div>
                  <div className="text-sm text-gray-500">Responses</div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'members', label: 'Members', icon: Users },
                { id: 'activity', label: 'Activity', icon: Activity },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
                    <Clock className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="space-y-3">
                    {activities.slice(0, 5).map((activity) => (
                      <div key={activity._id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Activity className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{activity.user.name}</span> {activity.action}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Members */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Invite
                    </button>
                  </div>
                  <div className="space-y-3">
                    {members.slice(0, 5).map((member) => (
                      <div key={member.userId} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.user.name}</p>
                            <p className="text-xs text-gray-500">{member.user.email}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          member.role === 'admin' ? 'bg-red-100 text-red-800' :
                          member.role === 'editor' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <MemberManagement
                workspaceId={currentWorkspace._id}
                members={members}
                onMemberUpdate={() => loadWorkspaceDetails(currentWorkspace._id)}
                onInviteClick={() => setShowInviteModal(true)}
              />
            )}

            {activeTab === 'activity' && (
              <WorkspaceActivity
                workspaceId={currentWorkspace._id}
                activities={activities}
              />
            )}

            {activeTab === 'settings' && (
              <WorkspaceSettings
                workspace={currentWorkspace}
                onUpdate={(updatedWorkspace) => {
                  setCurrentWorkspace(updatedWorkspace);
                  setWorkspaces(prev => prev.map(w => 
                    w._id === updatedWorkspace._id ? updatedWorkspace : w
                  ));
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateWorkspace}
        />
      )}

      {showInviteModal && currentWorkspace && (
        <InviteMemberModal
          workspaceId={currentWorkspace._id}
          onClose={() => setShowInviteModal(false)}
          onSubmit={handleInviteMember}
        />
      )}
    </div>
  );
};

export default WorkspaceCollaboration;