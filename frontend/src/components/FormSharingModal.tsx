'use client';

import { useState } from 'react';
import { Form } from '@/types';
import toast from 'react-hot-toast';

interface FormSharingModalProps {
  form: Form;
  isOpen: boolean;
  onClose: () => void;
}

export default function FormSharingModal({ form, isOpen, onClose }: FormSharingModalProps) {
  const [activeTab, setActiveTab] = useState<'link' | 'embed'>('link');

  if (!isOpen) return null;

  const publicUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/public/${form.publicUrl}`;
  const embedCode = `<iframe src="${process.env.NEXT_PUBLIC_FRONTEND_URL}/embed/${form.publicUrl}" width="100%" height="600" frameborder="0" style="border: none; border-radius: 8px;"></iframe>`;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard!`);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Share Form</h2>
            <p className="text-sm text-gray-600 mt-1">{form.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'link'
                  ? 'border-primary-500 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Public Link</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('embed')}
              className={`flex-1 py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'embed'
                  ? 'border-primary-500 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Embed Code</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'link' ? (
            <div className="space-y-6">
              {/* Public URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Public Form URL
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={publicUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-50 text-gray-700 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(publicUrl, 'Link')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Anyone with this link can view and submit your form
                </p>
              </div>

              {/* QR Code Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Code
                </label>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="w-32 h-32 mx-auto bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h5v5H4V4zm11 11h5v5h-5v-5zM4 15h5v5H4v-5z" />
                      </svg>
                      <p className="text-xs text-gray-500">QR Code</p>
                      <p className="text-xs text-gray-400">Coming Soon</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Share Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Share on Social Media
                </label>
                <div className="flex space-x-3">
                  <a
                    href={`https://twitter.com/intent/tweet?text=Check out this form: ${encodeURIComponent(form.title)}&url=${encodeURIComponent(publicUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                    Twitter
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Embed Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Embed Code
                </label>
                <div className="relative">
                  <textarea
                    value={embedCode}
                    readOnly
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-mono text-sm resize-none"
                  />
                  <button
                    onClick={() => copyToClipboard(embedCode, 'Embed code')}
                    className="absolute top-2 right-2 px-3 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Copy this code and paste it into your website's HTML
                </p>
              </div>

              {/* Embed Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <iframe
                    src={`${process.env.NEXT_PUBLIC_FRONTEND_URL}/embed/${form.publicUrl}`}
                    width="100%"
                    height="400"
                    frameBorder="0"
                    className="rounded-lg"
                    title="Form Preview"
                  />
                </div>
              </div>

              {/* Embed Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Customize Embed
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Width
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                      <option value="100%">100% (Responsive)</option>
                      <option value="800px">800px (Fixed)</option>
                      <option value="600px">600px (Fixed)</option>
                      <option value="400px">400px (Fixed)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Height
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                      <option value="600">600px</option>
                      <option value="800">800px</option>
                      <option value="500">500px</option>
                      <option value="400">400px</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* WordPress Plugin Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-1">
                      WordPress Integration
                    </h4>
                    <p className="text-sm text-blue-700">
                      For WordPress sites, you can also use our shortcode: 
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs ml-1">
                        [youform id="{form.publicUrl}"]
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <span className="inline-flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Form is public and ready to collect responses
              </span>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => window.open(publicUrl, '_blank')}
                className="btn-secondary"
              >
                Preview Form
              </button>
              <button
                onClick={onClose}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}