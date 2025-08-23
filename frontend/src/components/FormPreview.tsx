'use client';

import { FormField, FormCustomization } from '@/types';

interface FormPreviewProps {
  title: string;
  description?: string;
  fields: FormField[];
  customization: FormCustomization;
}

export default function FormPreview({ 
  title, 
  description, 
  fields, 
  customization 
}: FormPreviewProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 max-h-96 overflow-y-auto">
      <div className="text-center mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Live Preview</h3>
        
        {/* Logo Preview */}
        {customization.logoUrl && (
          <div className="mb-4">
            <img
              src={customization.logoUrl}
              alt="Form Logo"
              className="h-12 w-auto mx-auto"
            />
          </div>
        )}
        
        {/* Title and Description */}
        <h1 
          className="text-2xl font-bold mb-2"
          style={{ 
            color: customization.primaryColor,
            fontFamily: customization.fontFamily
          }}
        >
          {title || 'Form Title'}
        </h1>
        {description && (
          <p 
            className="text-gray-600"
            style={{ fontFamily: customization.fontFamily }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Fields Preview */}
      <div className="space-y-4">
        {fields.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p style={{ fontFamily: customization.fontFamily }}>
              Add fields to see preview
            </p>
          </div>
        ) : (
          fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <label 
                className="block text-sm font-medium text-gray-700"
                style={{ fontFamily: customization.fontFamily }}
              >
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              
              <PreviewFieldRenderer 
                field={field}
                customization={customization}
              />
            </div>
          ))
        )}
      </div>

      {/* Submit Button Preview */}
      {fields.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            className="px-6 py-2 rounded-lg text-white font-medium cursor-default"
            style={{ 
              backgroundColor: customization.primaryColor,
              fontFamily: customization.fontFamily
            }}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

// Preview Field Renderer Component
interface PreviewFieldRendererProps {
  field: FormField;
  customization: FormCustomization;
}

function PreviewFieldRenderer({ field, customization }: PreviewFieldRendererProps) {
  const baseInputClass = `w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-default`;

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          placeholder={field.placeholder || 'Enter text...'}
          className={baseInputClass}
          style={{ fontFamily: customization.fontFamily }}
          readOnly
        />
      );

    case 'textarea':
      return (
        <textarea
          placeholder={field.placeholder || 'Enter your message...'}
          rows={3}
          className={baseInputClass}
          style={{ fontFamily: customization.fontFamily }}
          readOnly
        />
      );

    case 'email':
      return (
        <input
          type="email"
          placeholder={field.placeholder || 'Enter your email...'}
          className={baseInputClass}
          style={{ fontFamily: customization.fontFamily }}
          readOnly
        />
      );

    case 'date':
      return (
        <input
          type="date"
          className={baseInputClass}
          style={{ fontFamily: customization.fontFamily }}
          readOnly
        />
      );

    case 'dropdown':
      return (
        <select
          className={baseInputClass}
          style={{ fontFamily: customization.fontFamily }}
          disabled
        >
          <option>Select an option</option>
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
            <label key={index} className="flex items-center cursor-default">
              <input
                type="radio"
                name={field.id}
                value={option}
                className="h-4 w-4 border-gray-300 cursor-default"
                style={{ accentColor: customization.primaryColor }}
                disabled
              />
              <span 
                className="ml-2 text-sm"
                style={{ fontFamily: customization.fontFamily }}
              >
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
            <label key={index} className="flex items-center cursor-default">
              <input
                type="checkbox"
                value={option}
                className="h-4 w-4 border-gray-300 cursor-default"
                style={{ accentColor: customization.primaryColor }}
                disabled
              />
              <span 
                className="ml-2 text-sm"
                style={{ fontFamily: customization.fontFamily }}
              >
                {option}
              </span>
            </label>
          ))}
        </div>
      );

    case 'file':
      return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
          <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p 
            className="text-sm text-gray-500"
            style={{ fontFamily: customization.fontFamily }}
          >
            Click to upload file
          </p>
        </div>
      );

    default:
      return (
        <div className="p-4 bg-gray-100 rounded-lg text-center">
          <span 
            className="text-gray-500 text-sm"
            style={{ fontFamily: customization.fontFamily }}
          >
            {field.type} field preview
          </span>
        </div>
      );
  }
}