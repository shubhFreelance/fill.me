'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Eye, 
  Edit, 
  MessageSquare, 
  Send,
  Circle,
  Clock,
  X
} from 'lucide-react';
import WorkspaceService, { ICollaborationSession } from '../lib/WorkspaceService';

interface RealTimeCollaborationProps {
  formId: string;
  isActive: boolean;
  onToggle: (active: boolean) => void;
}

interface FormComment {
  _id: string;
  content: string;
  user: {
    name: string;
    email: string;
  };
  fieldId?: string;
  createdAt: string;
  isResolved: boolean;
}

const RealTimeCollaboration: React.FC<RealTimeCollaborationProps> = ({
  formId,
  isActive,
  onToggle
}) => {
  const [collaborators, setCollaborators] = useState<ICollaborationSession[]>([]);
  const [comments, setComments] = useState<FormComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
      startCollaboration();
    } else {
      stopCollaboration();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, formId]);

  const startCollaboration = async () => {
    try {
      setLoading(true);
      await WorkspaceService.joinCollaboration(formId);
      await loadCollaborators();
      await loadComments();

      // Set up polling for real-time updates
      intervalRef.current = setInterval(async () => {
        await loadCollaborators();
        await WorkspaceService.updateCollaborationActivity(formId);
      }, 30000); // Update every 30 seconds

    } catch (err: any) {
      setError('Failed to start collaboration');
      console.error('Start collaboration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopCollaboration = async () => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      await WorkspaceService.leaveCollaboration(formId);
      setCollaborators([]);
    } catch (err) {
      console.error('Stop collaboration error:', err);
    }
  };

  const loadCollaborators = async () => {
    try {
      const data = await WorkspaceService.getActiveCollaborators(formId);
      setCollaborators(data);
    } catch (err) {
      console.error('Load collaborators error:', err);
    }
  };

  const loadComments = async () => {
    try {
      const data = await WorkspaceService.getFormComments(formId);
      setComments(data);
    } catch (err) {
      console.error('Load comments error:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await WorkspaceService.addFormComment(formId, {
        content: newComment,
        fieldId: selectedFieldId || undefined
      });
      
      setNewComment('');
      setSelectedFieldId(null);
      await loadComments();
    } catch (err) {
      setError('Failed to add comment');
      console.error('Add comment error:', err);
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - commentTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return commentTime.toLocaleDateString();
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'text-green-500' : 'text-gray-400';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-800">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Collaboration Panel */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Collaboration
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowComments(!showComments)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Toggle comments"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                onClick={() => onToggle(!isActive)}
                disabled={loading}
                className={`flex items-center space-x-1 px-2 py-1 text-xs rounded ${
                  isActive 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Circle className={`h-2 w-2 fill-current ${getStatusColor(isActive)}`} />
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Collaborators */}
        {isActive && (
          <div className="p-4 border-b border-gray-200">
            <div className="text-xs font-medium text-gray-500 mb-2">
              Active Now ({collaborators.length})
            </div>
            {collaborators.length > 0 ? (
              <div className="space-y-2">
                {collaborators.map((session) => (
                  <div key={session._id} className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {session.user.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatRelativeTime(session.lastActivity)}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <Circle className="h-2 w-2 fill-current text-green-500" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No other collaborators</p>
            )}
          </div>
        )}

        {/* Comments Section */}
        {showComments && (
          <div className="p-4">
            <div className="text-xs font-medium text-gray-500 mb-3">
              Comments ({comments.filter(c => !c.isResolved).length})
            </div>
            
            {/* Comments List */}
            <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
              {comments.filter(c => !c.isResolved).slice(-5).map((comment) => (
                <div key={comment._id} className="text-xs">
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-2 w-2 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{comment.user.name}</p>
                      <p className="text-gray-700 mt-1">{comment.content}</p>
                      <p className="text-gray-400 mt-1">{formatRelativeTime(comment.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {comments.filter(c => !c.isResolved).length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No comments yet</p>
              )}
            </div>

            {/* Add Comment Form */}
            {isActive && (
              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center justify-between">
                  <select
                    value={selectedFieldId || ''}
                    onChange={(e) => setSelectedFieldId(e.target.value || null)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 flex-1 mr-2"
                  >
                    <option value="">General comment</option>
                    <option value="field1">Field specific</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Status Information */}
        {!isActive && (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-2">
              Start collaboration to work with team members in real-time
            </p>
            <button
              onClick={() => onToggle(true)}
              disabled={loading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Collaboration'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeCollaboration;