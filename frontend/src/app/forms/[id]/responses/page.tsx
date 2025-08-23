'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Form, FormResponse } from '@/types';
import axios from 'axios';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function FormResponsesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const formId = params.id as string;

  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && formId) {
      fetchFormAndResponses();
      fetchAnalytics();
    }
  }, [user, formId, currentPage]);

  const fetchFormAndResponses = async () => {
    setLoading(true);
    try {
      // Fetch form details
      const formResponse = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/forms/${formId}`);
      setForm(formResponse.data.data);

      // Fetch responses
      const responsesResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/responses/forms/${formId}?page=${currentPage}&limit=20`
      );
      setResponses(responsesResponse.data.data);
      setTotalPages(responsesResponse.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load form data');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/responses/forms/${formId}/analytics`
      );
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/responses/forms/${formId}/export`,
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${form?.title || 'form'}-responses.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Responses exported successfully!');
    } catch (error) {
      console.error('Error exporting responses:', error);
      toast.error('Failed to export responses');
    } finally {
      setExporting(false);
    }
  };

  const deleteResponse = async (responseId: string) => {
    if (!confirm('Are you sure you want to delete this response?')) {
      return;
    }

    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/responses/${responseId}`);
      toast.success('Response deleted successfully');
      fetchFormAndResponses(); // Refresh the list
      fetchAnalytics(); // Update analytics
    } catch (error) {
      console.error('Error deleting response:', error);
      toast.error('Failed to delete response');
    }
  };

  // Helper function to render response values
  const renderResponseValue = (fieldId: string, value: any, field: any) => {
    if (!value) return '-';
    
    // Handle file uploads
    if (field?.type === 'file' && typeof value === 'object' && value.filename) {
      return (
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <a 
            href={`${process.env.NEXT_PUBLIC_API_URL}${value.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm truncate max-w-32"
            title={value.originalName}
          >
            {value.originalName || value.filename}
          </a>
        </div>
      );
    }
    
    // Handle arrays (checkboxes)
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    // Handle regular values
    return String(value);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user || !form) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                {form.title} - Responses
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href={`/public/${form.publicUrl}`}
                target="_blank"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                View Public Form
              </Link>
              <Link
                href={`/forms/${formId}/edit`}
                className="btn-secondary"
              >
                Edit Form
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalViews}</p>
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
                  <p className="text-sm font-medium text-gray-600">Submissions</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalSubmissions}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.conversionRate}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Latest Response</p>
                  <p className="text-sm font-bold text-gray-900">
                    {analytics.overview.latestResponse 
                      ? new Date(analytics.overview.latestResponse).toLocaleDateString()
                      : 'No responses yet'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Form Responses</h2>
              <p className="text-sm text-gray-600">
                {responses.length > 0 
                  ? `Showing ${responses.length} responses`
                  : 'No responses yet'
                }
              </p>
            </div>
            <div className="flex space-x-3">
              {responses.length > 0 && (
                <button
                  onClick={exportToCSV}
                  disabled={exporting}
                  className="btn-secondary"
                >
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Responses Table */}
        {responses.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No responses yet</h3>
            <p className="text-gray-600 mb-4">Share your form to start collecting responses</p>
            <Link
              href={`/public/${form.publicUrl}`}
              target="_blank"
              className="btn-primary"
            >
              View Public Form
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    {form.fields.slice(0, 3).map((field) => (
                      <th key={field.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {field.label}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {responses.map((response) => (
                    <tr key={response._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(response.submittedAt).toLocaleString()}
                      </td>
                      {form.fields.slice(0, 3).map((field) => (
                        <td key={field.id} className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          {renderResponseValue(field.id, response.responses[field.id], field)}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            // Open detailed view modal or page
                            const detailsWindow = window.open('', '_blank', 'width=800,height=600');
                            if (detailsWindow) {
                              const renderDetailValue = (fieldId: string, value: any, field: any) => {
                                if (!value) return 'No response';
                                
                                if (field?.type === 'file' && typeof value === 'object' && value.filename) {
                                  return `<div style="margin: 5px 0;">
                                    <a href="${process.env.NEXT_PUBLIC_API_URL}${value.url}" target="_blank" style="color: #2563eb; text-decoration: underline;">
                                      📎 ${value.originalName || value.filename}
                                    </a>
                                    <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                                      Size: ${(value.size / 1024).toFixed(1)} KB | Type: ${value.mimetype || 'Unknown'}
                                    </div>
                                  </div>`;
                                }
                                
                                if (Array.isArray(value)) {
                                  return value.join(', ');
                                }
                                
                                return String(value);
                              };
                              
                              detailsWindow.document.write(`
                                <html>
                                  <head><title>Response Details</title></head>
                                  <body style="font-family: Arial, sans-serif; padding: 20px;">
                                    <h2>Response Details</h2>
                                    <p><strong>Submitted:</strong> ${new Date(response.submittedAt).toLocaleString()}</p>
                                    ${form.fields.map(field => `
                                      <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                        <strong>${field.label}:</strong><br>
                                        ${renderDetailValue(field.id, response.responses[field.id], field)}
                                      </div>
                                    `).join('')}
                                  </body>
                                </html>
                              `);
                            }
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteResponse(response._id)}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Page <span className="font-medium">{currentPage}</span> of{' '}
                      <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}