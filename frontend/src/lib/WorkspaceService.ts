import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Types for workspace collaboration
export interface IWorkspace {
  _id: string;
  name: string;
  description?: string;
  owner: string;
  members: IWorkspaceMember[];
  settings: {
    isPublic: boolean;
    allowInvitations: boolean;
    defaultRole: 'viewer' | 'editor' | 'admin';
  };
  stats: {
    totalForms: number;
    totalMembers: number;
    totalResponses: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IWorkspaceMember {
  userId: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  role: 'viewer' | 'editor' | 'admin';
  joinedAt: string;
  lastActivity?: string;
}

export interface IWorkspaceInvitation {
  _id: string;
  workspaceId: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface IWorkspaceActivity {
  _id: string;
  workspaceId: string;
  userId: string;
  user: {
    name: string;
    email: string;
  };
  action: string;
  details: any;
  timestamp: string;
}

export interface ICollaborationSession {
  _id: string;
  formId: string;
  userId: string;
  user: {
    name: string;
    email: string;
  };
  startedAt: string;
  lastActivity: string;
  isActive: boolean;
}

/**
 * Workspace Service for Frontend
 * Handles all workspace-related API calls
 */
class WorkspaceService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/auth/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Workspace Management
  async getWorkspaces(): Promise<IWorkspace[]> {
    const response = await this.api.get('/workspaces');
    return response.data.data;
  }

  async getWorkspace(workspaceId: string): Promise<IWorkspace> {
    const response = await this.api.get(`/workspaces/${workspaceId}`);
    return response.data.data;
  }

  async createWorkspace(data: {
    name: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<IWorkspace> {
    const response = await this.api.post('/workspaces', data);
    return response.data.data;
  }

  async updateWorkspace(workspaceId: string, data: {
    name?: string;
    description?: string;
    settings?: Partial<IWorkspace['settings']>;
  }): Promise<IWorkspace> {
    const response = await this.api.put(`/workspaces/${workspaceId}`, data);
    return response.data.data;
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.api.delete(`/workspaces/${workspaceId}`);
  }

  // Member Management
  async getWorkspaceMembers(workspaceId: string): Promise<IWorkspaceMember[]> {
    const response = await this.api.get(`/workspaces/${workspaceId}/members`);
    return response.data.data;
  }

  async inviteMember(workspaceId: string, data: {
    email: string;
    role: 'viewer' | 'editor' | 'admin';
  }): Promise<IWorkspaceInvitation> {
    const response = await this.api.post(`/workspaces/${workspaceId}/invite`, data);
    return response.data.data;
  }

  async updateMemberRole(workspaceId: string, userId: string, role: string): Promise<void> {
    await this.api.put(`/workspaces/${workspaceId}/members/${userId}`, { role });
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.api.delete(`/workspaces/${workspaceId}/members/${userId}`);
  }

  async leaveWorkspace(workspaceId: string): Promise<void> {
    await this.api.post(`/workspaces/${workspaceId}/leave`);
  }

  // Invitation Management
  async getWorkspaceInvitations(workspaceId: string): Promise<IWorkspaceInvitation[]> {
    const response = await this.api.get(`/workspaces/${workspaceId}/invitations`);
    return response.data.data;
  }

  async acceptInvitation(token: string): Promise<void> {
    await this.api.post(`/workspaces/invitations/${token}/accept`);
  }

  async declineInvitation(token: string): Promise<void> {
    await this.api.post(`/workspaces/invitations/${token}/decline`);
  }

  async cancelInvitation(workspaceId: string, invitationId: string): Promise<void> {
    await this.api.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`);
  }

  // Activity and Analytics
  async getWorkspaceActivity(workspaceId: string, params?: {
    limit?: number;
    page?: number;
    dateRange?: string;
  }): Promise<{
    activities: IWorkspaceActivity[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const response = await this.api.get(`/workspaces/${workspaceId}/activity`, { params });
    return response.data.data;
  }

  async getWorkspaceAnalytics(workspaceId: string, timeRange: string = '30d'): Promise<any> {
    const response = await this.api.get(`/workspaces/${workspaceId}/analytics`, {
      params: { timeRange }
    });
    return response.data.data;
  }

  // Real-time Collaboration
  async getActiveCollaborators(formId: string): Promise<ICollaborationSession[]> {
    const response = await this.api.get(`/workspaces/collaboration/${formId}/active`);
    return response.data.data;
  }

  async joinCollaboration(formId: string): Promise<ICollaborationSession> {
    const response = await this.api.post(`/workspaces/collaboration/${formId}/join`);
    return response.data.data;
  }

  async leaveCollaboration(formId: string): Promise<void> {
    await this.api.post(`/workspaces/collaboration/${formId}/leave`);
  }

  async updateCollaborationActivity(formId: string): Promise<void> {
    await this.api.put(`/workspaces/collaboration/${formId}/activity`);
  }

  // Form Sharing within Workspace
  async shareFormWithWorkspace(formId: string, workspaceId: string, permissions: {
    canEdit: boolean;
    canView: boolean;
    canShare: boolean;
  }): Promise<void> {
    await this.api.post(`/workspaces/${workspaceId}/forms/${formId}/share`, permissions);
  }

  async unshareFormFromWorkspace(formId: string, workspaceId: string): Promise<void> {
    await this.api.delete(`/workspaces/${workspaceId}/forms/${formId}/share`);
  }

  async getWorkspaceForms(workspaceId: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<any> {
    const response = await this.api.get(`/workspaces/${workspaceId}/forms`, { params });
    return response.data.data;
  }

  // Comments and Feedback
  async addFormComment(formId: string, data: {
    content: string;
    fieldId?: string;
    parentId?: string;
  }): Promise<any> {
    const response = await this.api.post(`/workspaces/forms/${formId}/comments`, data);
    return response.data.data;
  }

  async getFormComments(formId: string): Promise<any[]> {
    const response = await this.api.get(`/workspaces/forms/${formId}/comments`);
    return response.data.data;
  }

  async updateComment(commentId: string, content: string): Promise<void> {
    await this.api.put(`/workspaces/comments/${commentId}`, { content });
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.api.delete(`/workspaces/comments/${commentId}`);
  }

  // Workspace Search
  async searchWorkspace(workspaceId: string, query: string, filters?: {
    type?: 'forms' | 'members' | 'activity';
    dateRange?: string;
  }): Promise<any> {
    const response = await this.api.get(`/workspaces/${workspaceId}/search`, {
      params: { query, ...filters }
    });
    return response.data.data;
  }
}

export default new WorkspaceService();