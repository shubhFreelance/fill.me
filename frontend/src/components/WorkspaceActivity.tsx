'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  Filter, 
  Users, 
  FileText, 
  Settings, 
  UserPlus, 
  Edit, 
  Trash2,
  Calendar,
  Search,
  Download
} from 'lucide-react';
import WorkspaceService, { IWorkspaceActivity } from '../lib/WorkspaceService';

interface WorkspaceActivityProps {
  workspaceId: string;
  activities: IWorkspaceActivity[];
}

const WorkspaceActivity: React.FC<WorkspaceActivityProps> = ({
  workspaceId,
  activities: initialActivities
}) => {
  const [activities, setActivities] = useState<IWorkspaceActivity[]>(initialActivities);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, [workspaceId, filter, dateRange, currentPage]);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await WorkspaceService.getWorkspaceActivity(workspaceId, {
        page: currentPage,
        limit: 20,
        dateRange
      });

      setActivities(response.activities);
      setTotalPages(response.pagination.pages);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('created')) return FileText;
    if (action.includes('updated') || action.includes('edited')) return Edit;
    if (action.includes('deleted')) return Trash2;
    if (action.includes('invited') || action.includes('joined')) return UserPlus;
    if (action.includes('settings')) return Settings;
    return Activity;
  };

  const getActivityColor = (action: string) => {
    if (action.includes('created')) return 'text-green-600 bg-green-100';
    if (action.includes('updated') || action.includes('edited')) return 'text-blue-600 bg-blue-100';
    if (action.includes('deleted')) return 'text-red-600 bg-red-100';
    if (action.includes('invited') || action.includes('joined')) return 'text-purple-600 bg-purple-100';
    if (action.includes('settings')) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = !searchQuery || 
      activity.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.user.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filter === 'all' || activity.action.includes(filter);
    
    return matchesSearch && matchesFilter;
  });

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - activityTime.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return activityTime.toLocaleDateString();
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
          <h3 className="text-lg font-medium text-gray-900">Workspace Activity</h3>
          <p className="text-gray-600 mt-1">Track all activities and changes in your workspace</p>
        </div>
        <button
          onClick={() => {/* Implement export functionality */}}
          className="inline-flex items-center px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 mt-4 sm:mt-0"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Activity Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Activities</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
          <option value="invited">Invitations</option>
          <option value="settings">Settings</option>
        </select>

        {/* Date Range */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>

        {/* Results count */}
        <div className="flex items-center text-sm text-gray-500">
          {filteredActivities.length} activities
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading activities...</p>
          </div>
        ) : filteredActivities.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredActivities.map((activity) => {
              const IconComponent = getActivityIcon(activity.action);
              const colorClasses = getActivityColor(activity.action);
              
              return (
                <div key={activity._id} className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClasses}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.user.name}</span>{' '}
                          <span>{activity.action}</span>
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatRelativeTime(activity.timestamp)}</span>
                        </div>
                      </div>
                      
                      {activity.details && (
                        <div className="mt-2">
                          {typeof activity.details === 'string' ? (
                            <p className="text-sm text-gray-600">{activity.details}</p>
                          ) : (
                            <div className="text-sm text-gray-600">
                              {Object.entries(activity.details).map(([key, value]) => (
                                <div key={key} className="flex items-center space-x-2">
                                  <span className="font-medium capitalize">{key}:</span>
                                  <span>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No activities found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery || filter !== 'all' ? 'Try adjusting your filters' : 'Activities will appear here as team members work'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Activity Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {activities.filter(a => a.action.includes('created')).length}
          </div>
          <div className="text-sm text-blue-600">Items Created</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {activities.filter(a => a.action.includes('updated')).length}
          </div>
          <div className="text-sm text-green-600">Items Updated</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">
            {activities.filter(a => a.action.includes('invited')).length}
          </div>
          <div className="text-sm text-purple-600">Members Invited</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {new Set(activities.map(a => a.userId)).size}
          </div>
          <div className="text-sm text-yellow-600">Active Members</div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceActivity;