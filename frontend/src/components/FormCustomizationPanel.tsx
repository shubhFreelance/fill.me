'use client';

import { useState } from 'react';
import { FormCustomization } from '@/types';
import axios from 'axios';
import toast from 'react-hot-toast';

interface FormCustomizationPanelProps {
  customization: FormCustomization;
  onUpdate: (updates: Partial<FormCustomization>) => void;
  formId?: string;
}

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Modern Sans-serif)' },
  { value: 'Roboto', label: 'Roboto (Clean & Readable)' },
  { value: 'Open Sans', label: 'Open Sans (Friendly)' },
  { value: 'Lato', label: 'Lato (Professional)' },
  { value: 'Montserrat', label: 'Montserrat (Elegant)' },
  { value: 'Poppins', label: 'Poppins (Rounded)' }
];

const COLOR_PRESETS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Black', value: '#000000' }
];

export default function FormCustomizationPanel({ 
  customization, 
  onUpdate, 
  formId 
}: FormCustomizationPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [customColor, setCustomColor] = useState(customization.primaryColor);

  const handleColorChange = (color: string) => {
    setCustomColor(color);
    onUpdate({ primaryColor: color });
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    onUpdate({ primaryColor: color });
  };

  const handleFontChange = (font: string) => {
    onUpdate({ fontFamily: font });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/forms/${formId}/upload-logo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const logoUrl = response.data.logoUrl;
      onUpdate({ logoUrl: `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}` });
      toast.success('Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    onUpdate({ logoUrl: '' });
    toast.success('Logo removed');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Form Customization</h3>
        <p className="text-sm text-gray-600 mb-6">
          Customize the appearance of your form to match your brand
        </p>
      </div>

      {/* Color Customization */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Primary Color
        </label>
        
        {/* Color Presets */}
        <div className="grid grid-cols-6 gap-2 mb-4">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color.value}
              onClick={() => handleColorChange(color.value)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                customColor === color.value 
                  ? 'border-gray-800 scale-110' 
                  : 'border-gray-300 hover:scale-105'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>

        {/* Custom Color Picker */}
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={customColor}
            onChange={handleCustomColorChange}
            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => handleCustomColorChange(e as any)}
            className="input-field font-mono text-sm"
            placeholder="#3b82f6"
          />
        </div>

        {/* Color Preview */}
        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">Preview:</p>
          <div className="space-y-2">
            <button
              className="px-4 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: customColor }}
            >
              Submit Button
            </button>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                style={{ accentColor: customColor }}
                readOnly
                checked
              />
              <span className="text-sm">Checkbox Example</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                className="h-4 w-4"
                style={{ accentColor: customColor }}
                readOnly
                checked
              />
              <span className="text-sm">Radio Button Example</span>
            </div>
          </div>
        </div>
      </div>

      {/* Font Customization */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Font Family
        </label>
        
        <div className="space-y-2">
          {FONT_OPTIONS.map((font) => (
            <label key={font.value} className="flex items-center">
              <input
                type="radio"
                name="fontFamily"
                value={font.value}
                checked={customization.fontFamily === font.value}
                onChange={(e) => handleFontChange(e.target.value)}
                className="h-4 w-4 border-gray-300"
                style={{ accentColor: customColor }}
              />
              <span 
                className="ml-3 text-sm"
                style={{ fontFamily: font.value }}
              >
                {font.label}
              </span>
            </label>
          ))}
        </div>

        {/* Font Preview */}
        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">Font Preview:</p>
          <div style={{ fontFamily: customization.fontFamily }}>
            <h4 className="text-lg font-bold text-gray-900">Form Title Example</h4>
            <p className="text-gray-600">This is how your form text will appear to users.</p>
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700">
                Field Label Example
              </label>
              <input
                type="text"
                placeholder="Placeholder text example"
                className="mt-1 input-field"
                style={{ fontFamily: customization.fontFamily }}
                readOnly
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Form Logo
        </label>
        
        {customization.logoUrl ? (
          <div className="space-y-4">
            {/* Current Logo Display */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Current Logo:</p>
              <div className="flex items-center justify-center bg-white border rounded-lg p-4">
                <img
                  src={customization.logoUrl}
                  alt="Form Logo"
                  className="max-h-16 max-w-full object-contain"
                />
              </div>
            </div>
            
            {/* Logo Actions */}
            <div className="flex space-x-3">
              <label className="btn-secondary cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? 'Uploading...' : 'Replace Logo'}
              </label>
              <button
                onClick={removeLogo}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Remove Logo
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Logo Upload Area */}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload logo</span>
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            
            {uploading && (
              <div className="mt-2 flex items-center text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Uploading logo...
              </div>
            )}
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          Your logo will appear at the top of your form. Recommended size: 200x60px or similar ratio.
        </p>
      </div>

      {/* Advanced Settings */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Advanced Settings
        </label>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Show "Powered by" branding</p>
              <p className="text-xs text-gray-500">Display "Powered by Youform Clone" at bottom of form</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={true}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Enable form animations</p>
              <p className="text-xs text-gray-500">Add smooth transitions and hover effects</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={true}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Reset to Defaults */}
      <div className="pt-4 border-t">
        <button
          onClick={() => {
            onUpdate({
              primaryColor: '#3b82f6',
              fontFamily: 'Inter',
              logoUrl: ''
            });
            setCustomColor('#3b82f6');
            toast.success('Customization reset to defaults');
          }}
          className="text-sm text-gray-600 hover:text-gray-800 font-medium"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}