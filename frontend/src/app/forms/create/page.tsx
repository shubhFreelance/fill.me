'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { FormField, Form, FormCustomization } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import toast from 'react-hot-toast';
import FormCustomizationPanel from '@/components/FormCustomizationPanel';
import FormPreview from '@/components/FormPreview';

const FIELD_TYPES = [
  { type: 'text', label: 'Single Line Text', icon: '📝' },
  { type: 'textarea', label: 'Multi Line Text', icon: '📄' },
  { type: 'email', label: 'Email', icon: '📧' },
  { type: 'dropdown', label: 'Dropdown', icon: '📋' },
  { type: 'radio', label: 'Radio Buttons', icon: '🔘' },
  { type: 'checkbox', label: 'Checkboxes', icon: '☑️' },
  { type: 'date', label: 'Date Picker', icon: '📅' },
  { type: 'file', label: 'File Upload', icon: '📎' }
] as const;

interface FormBuilderProps {
  formId?: string;
}

export default function FormBuilder({ formId }: FormBuilderProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fields: [] as FormField[],
    customization: {
      primaryColor: '#3b82f6',
      fontFamily: 'Inter',
      logoUrl: ''
    } as FormCustomization,
    isPublic: true
  });

  const [selectedTab, setSelectedTab] = useState<'fields' | 'customize'>('fields');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<FormField | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (formId && user) {
      fetchForm();
    }
  }, [formId, user]);

  const fetchForm = async () => {
    if (!formId) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/forms/${formId}`);
      const form = response.data.data;
      setFormData({
        title: form.title,
        description: form.description || '',
        fields: form.fields,
        customization: form.customization,
        isPublic: form.isPublic
      });
    } catch (error) {
      console.error('Error fetching form:', error);
      toast.error('Failed to load form');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: uuidv4(),
      type,
      label: `${FIELD_TYPES.find(ft => ft.type === type)?.label} Field`,
      placeholder: '',
      required: false,
      options: type === 'dropdown' || type === 'radio' || type === 'checkbox' ? ['Option 1', 'Option 2'] : undefined
    };

    setFormData(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setSelectedField(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    }));
  };

  const deleteField = (fieldId: string) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId)
    }));
    setSelectedField(null);
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    setFormData(prev => {
      const newFields = [...prev.fields];
      const [movedField] = newFields.splice(fromIndex, 1);
      newFields.splice(toIndex, 0, movedField);
      return { ...prev, fields: newFields };
    });
  };

  const saveForm = async () => {
    if (!formData.title.trim()) {
      toast.error('Form title is required');
      return;
    }

    if (formData.fields.length === 0) {
      toast.error('Please add at least one field to your form');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        fields: formData.fields,
        customization: formData.customization,
        isPublic: formData.isPublic
      };

      if (formId) {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/forms/${formId}`, payload);
        toast.success('Form updated successfully!');
      } else {
        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/forms`, payload);
        toast.success('Form created successfully!');
        router.push(`/forms/${response.data.data._id}/edit`);
      }
    } catch (error: any) {
      console.error('Error saving form:', error);
      toast.error(error.response?.data?.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const previewForm = () => {
    if (formData.fields.length === 0) {
      toast.error('Please add fields to preview the form');
      return;
    }
    // Open preview in new tab (we'll implement the preview route later)
    window.open(`/forms/preview?data=${encodeURIComponent(JSON.stringify(formData))}`, '_blank');
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

  const selectedFieldData = formData.fields.find(f => f.id === selectedField);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {formId ? 'Edit Form' : 'Create New Form'}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={previewForm}
                className="btn-secondary"
              >
                Preview
              </button>
              <button
                onClick={saveForm}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : formId ? 'Update Form' : 'Save Form'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Field Types Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Fields</h3>
              <div className="space-y-2">
                {FIELD_TYPES.map((fieldType) => (
                  <button
                    key={fieldType.type}
                    onClick={() => addField(fieldType.type)}
                    className="w-full text-left p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{fieldType.icon}</span>
                      <span className="font-medium text-gray-700 text-sm">{fieldType.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Builder */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Form Settings */}
              <div className="p-6 border-b">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Form Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="input-field"
                      placeholder="Enter form title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="input-field"
                      rows={3}
                      placeholder="Enter form description (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Form Fields</h3>
                
                {formData.fields.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-12 h-12 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                      <span className="text-2xl">📝</span>
                    </div>
                    <p className="text-lg font-medium">No fields added yet</p>
                    <p className="text-sm">Click on field types from the sidebar to add them</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.fields.map((field, index) => (
                      <div
                        key={field.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedField === field.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedField(field.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {FIELD_TYPES.find(ft => ft.type === field.type)?.icon}
                              </span>
                              <span className="font-medium text-gray-900">{field.label}</span>
                              {field.required && (
                                <span className="text-red-500 text-sm">*</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {FIELD_TYPES.find(ft => ft.type === field.type)?.label}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {index > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveField(index, index - 1);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                ↑
                              </button>
                            )}
                            {index < formData.fields.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveField(index, index + 1);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                ↓
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteField(field.id);
                              }}
                              className="p-1 text-red-400 hover:text-red-600"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <FormPreview
                title={formData.title}
                description={formData.description}
                fields={formData.fields}
                customization={formData.customization}
              />
            </div>
          </div>

          {/* Properties/Customization Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              {/* Tab Navigation */}
              <div className="border-b">
                <nav className="flex">
                  <button
                    onClick={() => setSelectedTab('fields')}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 ${
                      selectedTab === 'fields'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Fields
                  </button>
                  <button
                    onClick={() => setSelectedTab('customize')}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 ${
                      selectedTab === 'customize'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Customize
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {selectedTab === 'fields' ? (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Field Properties</h3>
                    {selectedFieldData ? (
                      <FieldEditor
                        field={selectedFieldData}
                        onUpdate={(updates) => updateField(selectedFieldData.id, updates)}
                      />
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        Select a field to edit its properties
                      </p>
                    )}
                  </>
                ) : (
                  <FormCustomizationPanel
                    customization={formData.customization}
                    onUpdate={(updates) => setFormData(prev => ({
                      ...prev,
                      customization: { ...prev.customization, ...updates }
                    }))}
                    formId={formId}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Field Editor Component
interface FieldEditorProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

function FieldEditor({ field, onUpdate }: FieldEditorProps) {
  const addOption = () => {
    const newOptions = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
    onUpdate({ options: newOptions });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...(field.options || [])];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = field.options?.filter((_, i) => i !== index) || [];
    onUpdate({ options: newOptions });
  };

  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(field.type);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Label *
        </label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="input-field"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Placeholder
        </label>
        <input
          type="text"
          value={field.placeholder || ''}
          onChange={(e) => onUpdate({ placeholder: e.target.value })}
          className="input-field"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="required"
          checked={field.required}
          onChange={(e) => onUpdate({ required: e.target.checked })}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="required" className="ml-2 block text-sm text-gray-900">
          Required field
        </label>
      </div>

      {needsOptions && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options
          </label>
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 input-field"
                />
                <button
                  onClick={() => removeOption(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            )) || []}
            <button
              onClick={addOption}
              className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800"
            >
              + Add Option
            </button>
          </div>
        </div>
      )}
    </div>
  );
}