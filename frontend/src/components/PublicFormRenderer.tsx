'use client';

import { useState } from 'react';
import { Form, FormField } from '@/types';
import axios from 'axios';
import toast from 'react-hot-toast';

interface PublicFormRendererProps {
  form: Form;
}

export default function PublicFormRenderer({ form }: PublicFormRendererProps) {
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (fieldId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => ({
        ...prev,
        [fieldId]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    form.fields.forEach(field => {
      if (field.required) {
        const value = responses[field.id];
        if (!value || (typeof value === 'string' && !value.trim())) {
          newErrors[field.id] = `${field.label} is required`;
        }
      }

      // Additional validation for specific field types
      const value = responses[field.id];
      if (value && field.type === 'email') {
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.id] = 'Please enter a valid email address';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setLoading(true);
    try {
      // Check if form contains file uploads
      const hasFiles = form.fields.some(field => field.type === 'file' && responses[field.id]);
      
      if (hasFiles) {
        // Use FormData for file uploads
        const formData = new FormData();
        
        // Add non-file responses
        const nonFileResponses: Record<string, any> = {};
        form.fields.forEach(field => {
          if (field.type === 'file' && responses[field.id]) {
            // Add file directly to FormData
            formData.append(field.id, responses[field.id]);
          } else if (responses[field.id] !== undefined) {
            nonFileResponses[field.id] = responses[field.id];
          }
        });
        
        // Add responses as JSON string
        formData.append('responses', JSON.stringify(nonFileResponses));
        
        // Add metadata
        formData.append('metadata', JSON.stringify({
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language
        }));

        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/public/forms/${form.publicUrl}/submit`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      } else {
        // Regular JSON submission for forms without files
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/public/forms/${form.publicUrl}/submit`,
          {
            responses,
            metadata: {
              screenResolution: `${window.screen.width}x${window.screen.height}`,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              language: navigator.language
            }
          }
        );
      }

      setSubmitted(true);
      toast.success('Form submitted successfully!');
    } catch (error: any) {
      console.error('Error submitting form:', error);
      
      if (error.response?.data?.errors) {
        const serverErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: any) => {
          serverErrors[err.fieldId] = err.message;
        });
        setErrors(serverErrors);
      }
      
      toast.error(error.response?.data?.message || 'Failed to submit form');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your response has been submitted successfully.</p>
          <button
            onClick={() => {
              setSubmitted(false);
              setResponses({});
              setErrors({});
            }}
            className="btn-primary"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Form Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          {form.customization?.logoUrl && (
            <div className="mb-6">
              <img
                src={form.customization.logoUrl}
                alt="Form Logo"
                className="h-16 w-auto mx-auto"
              />
            </div>
          )}
          
          <div className="text-center">
            <h1 
              className="text-3xl font-bold mb-4"
              style={{ 
                color: form.customization?.primaryColor || '#3b82f6',
                fontFamily: form.customization?.fontFamily || 'Inter'
              }}
            >
              {form.title}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-lg">{form.description}</p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-8">
          <div className="space-y-6">
            {form.fields.map((field) => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={responses[field.id]}
                onChange={(value) => handleFieldChange(field.id, value)}
                error={errors[field.id]}
                primaryColor={form.customization?.primaryColor || '#3b82f6'}
                fontFamily={form.customization?.fontFamily || 'Inter'}
              />
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: form.customization?.primaryColor || '#3b82f6',
                fontFamily: form.customization?.fontFamily || 'Inter'
              }}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </div>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          Powered by{' '}
          <a
            href={process.env.NEXT_PUBLIC_FRONTEND_URL}
            className="text-primary-600 hover:text-primary-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Youform Clone
          </a>
        </div>
      </div>
    </div>
  );
}

// Form Field Renderer Component
interface FormFieldRendererProps {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  primaryColor: string;
  fontFamily: string;
}

function FormFieldRenderer({ 
  field, 
  value, 
  onChange, 
  error, 
  primaryColor, 
  fontFamily 
}: FormFieldRendererProps) {
  const baseInputClass = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
    error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
  }`;

  const inputStyle = {
    fontFamily,
    '--tw-ring-color': primaryColor,
  } as React.CSSProperties;

  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
            style={inputStyle}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={baseInputClass}
            style={inputStyle}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'Enter your email'}
            className={baseInputClass}
            style={inputStyle}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            style={inputStyle}
          />
        );

      case 'dropdown':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            style={inputStyle}
          >
            <option value="">Select an option</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-4 w-4 border-gray-300 rounded"
                  style={{ accentColor: primaryColor }}
                />
                <span className="ml-2" style={{ fontFamily }}>
                  {option}
                </span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="checkbox"
                  value={option}
                  checked={(value || []).includes(option)}
                  onChange={(e) => {
                    const currentValues = value || [];
                    if (e.target.checked) {
                      onChange([...currentValues, option]);
                    } else {
                      onChange(currentValues.filter((v: string) => v !== option));
                    }
                  }}
                  className="h-4 w-4 border-gray-300 rounded"
                  style={{ accentColor: primaryColor }}
                />
                <span className="ml-2" style={{ fontFamily }}>
                  {option}
                </span>
              </label>
            ))}
          </div>
        );

      case 'file':
        return (
          <input
            type="file"
            onChange={(e) => onChange(e.target.files?.[0])}
            className={baseInputClass}
            style={inputStyle}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily }}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {error && (
        <p className="mt-1 text-sm text-red-600" style={{ fontFamily }}>
          {error}
        </p>
      )}
    </div>
  );
}