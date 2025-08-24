'use client';

import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Users, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Shield, 
  Clock,
  Mail,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import WorkspaceService, { IWorkspaceMember, IWorkspaceInvitation } from '../lib/WorkspaceService';

interface MemberManagementProps {
  workspaceId: string;
  members: IWorkspaceMember[];
  onMemberUpdate: () => void;
  onInviteClick: () => void;
}

const MemberManagement: React.FC<MemberManagementProps> = ({
  workspaceId,
  members,
  onMemberUpdate,
  onInviteClick
}) => {
  const [invitations, setInvitations] = useState<IWorkspaceInvitation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');

  useEffect(() => {
    loadInvitations();
  }, [workspaceId]);

  const loadInvitations = async () => {
    try {
      const data = await WorkspaceService.getWorkspaceInvitations(workspaceId);
      setInvitations(data);
    } catch (err) {
      console.error('Load invitations error:', err);
    }
  };

  const handleUpdateRole = async (userId: string, role: 'viewer' | 'editor' | 'admin') => {
    setLoading(true);
    setError(null);

    try {
      await WorkspaceService.updateMemberRole(workspaceId, userId, role);
      onMemberUpdate();
      setEditingMember(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await WorkspaceService.removeMember(workspaceId, userId);
      onMemberUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setLoading(true);
    setError(null);

    try {
      await WorkspaceService.cancelInvitation(workspaceId, invitationId);
      await loadInvitations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel invitation');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member =>
    member.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'editor': return 'bg-yellow-100 text-yellow-800';
      case 'viewer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInvitationStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Workspace Members</h3>
          <p className="text-gray-600 mt-1">Manage team members and their permissions</p>
        </div>
        <button
          onClick={onInviteClick}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-4 sm:mt-0"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-md font-medium text-gray-900 flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Current Members ({filteredMembers.length})
          </h4>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredMembers.map((member) => (
            <div key={member.userId} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{member.user.name}</h4>
                    <p className="text-sm text-gray-500">{member.user.email}</p>
                    <p className="text-xs text-gray-400">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                      {member.lastActivity && (
                        <span> • Last active {new Date(member.lastActivity).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Role Management */}
                  {editingMember === member.userId ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as any)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleUpdateRole(member.userId, newRole)}
                        disabled={loading}
                        className="p-1 text-green-600 hover:text-green-800"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingMember(null)}
                        className="p-1 text-gray-600 hover:text-gray-800"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                      
                      {/* Actions Menu */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setEditingMember(member.userId);
                            setNewRole(member.role);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveMember(member.userId, member.user.name)}
                        disabled={loading}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredMembers.length === 0 && (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No members found</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-md font-medium text-gray-900 flex items-center">
              <Mail className="h-4 w-4 mr-2" />
              Pending Invitations ({invitations.filter(inv => inv.status === 'pending').length})
            </h4>
          </div>
          <div className="divide-y divide-gray-200">
            {invitations.map((invitation) => (
              <div key={invitation._id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Mail className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{invitation.inviteeEmail}</h4>
                      <p className="text-sm text-gray-500">
                        Invited by {invitation.inviterEmail}
                      </p>
                      <p className="text-xs text-gray-400">
                        Sent {new Date(invitation.createdAt).toLocaleDateString()}
                        {invitation.status === 'pending' && invitation.expiresAt && (
                          <span> • Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(invitation.role)}`}>
                      {invitation.role}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getInvitationStatusColor(invitation.status)}`}>
                      {invitation.status}
                    </span>
                    
                    {invitation.status === 'pending' && (
                      <button
                        onClick={() => handleCancelInvitation(invitation._id)}
                        disabled={loading}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Cancel invitation"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Permissions Info */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h5 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
          <Shield className="h-4 w-4 mr-2" />
          Role Permissions
        </h5>
        <div className="text-xs text-blue-800 space-y-1">
          <div><strong>Admin:</strong> Full workspace access, can manage members and settings</div>
          <div><strong>Editor:</strong> Can create, edit, and delete forms, view all responses</div>
          <div><strong>Viewer:</strong> Can view forms and responses, cannot make changes</div>
        </div>
      </div>
    </div>
  );
};

export default MemberManagement;