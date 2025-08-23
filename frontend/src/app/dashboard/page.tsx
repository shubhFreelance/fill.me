'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Form } from '@/types';
import FormSharingModal from '@/components/FormSharingModal';

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalForms: 0,
    totalViews: 0,
    totalSubmissions: 0
  });
  const [shareModalForm, setShareModalForm] = useState<Form | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchForms();
    }
  }, [user]);

  const fetchForms = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/forms`);
      const formsData = response.data.data;
      setForms(formsData);

      // Calculate stats
      const totalViews = formsData.reduce((sum: number, form: Form) => sum + form.analytics.views, 0);
      const totalSubmissions = formsData.reduce((sum: number, form: Form) => sum + form.analytics.submissions, 0);
      
      setStats({
        totalForms: formsData.length,
        totalViews,
        totalSubmissions
      });
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const deleteForm = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this form?')) {
      return;
    }

    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/forms/${formId}`);
      toast.success('Form deleted successfully');
      fetchForms(); // Refresh the list
    } catch (error) {
      console.error('Error deleting form:', error);
      toast.error('Failed to delete form');
    }
  };

  const syncAllAnalytics = async () => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/forms/sync-all-analytics`);
      toast.success('Analytics synced successfully!');
      fetchForms(); // Refresh to show updated numbers
    } catch (error: any) {
      console.error('Error syncing analytics:', error);
      toast.error(error.response?.data?.message || 'Failed to sync analytics');
    }
  };

  const syncFormAnalytics = async (formId: string) => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/forms/${formId}/sync-analytics`);
      toast.success('Form analytics synced!');
      fetchForms(); // Refresh to show updated numbers
    } catch (error: any) {
      console.error('Error syncing form analytics:', error);
      toast.error(error.response?.data?.message || 'Failed to sync analytics');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
                Youform Clone
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Welcome, {user.firstName || user.email}!
              </span>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your forms and view analytics</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Sync Analytics Button (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={syncAllAnalytics}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                title="Sync analytics for all forms"
              >
                🔄 Sync Analytics
              </button>
            )}
            <Link
              href="/forms/create"
              className="btn-primary"
            >
              Create New Form
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Forms</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalForms}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalViews}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Submissions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSubmissions}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Forms Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your Forms</h2>
          </div>
          
          {forms.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No forms yet</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first form</p>
              <Link
                href="/forms/create"
                className="btn-primary"
              >
                Create Your First Form
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Form
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conversion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {forms.map((form) => (
                    <tr key={form._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{form.title}</div>
                          <div className="text-sm text-gray-500">{form.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.analytics.views}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span>{form.analytics.submissions}</span>
                          {process.env.NODE_ENV === 'development' && (
                            <button
                              onClick={() => syncFormAnalytics(form._id)}
                              className="text-gray-400 hover:text-gray-600 text-xs"
                              title="Sync this form's analytics"
                            >
                              🔄
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.analytics.views > 0 
                          ? `${((form.analytics.submissions / form.analytics.views) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(form.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Link
                          href={`/forms/${form._id}/edit`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/forms/${form._id}/responses`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Responses
                        </Link>
                        <button
                          onClick={() => setShareModalForm(form)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Share
                        </button>
                        <Link
                          href={`/public/${form.publicUrl}`}
                          target="_blank"
                          className="text-purple-600 hover:text-purple-900"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => deleteForm(form._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Form Sharing Modal */}
      {shareModalForm && (
        <FormSharingModal
          form={shareModalForm}
          isOpen={true}
          onClose={() => setShareModalForm(null)}
        />
      )}
    </div>
  );
}