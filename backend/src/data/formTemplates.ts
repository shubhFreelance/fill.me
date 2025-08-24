import { ITemplate } from '../types';

export const predefinedTemplates: any[] = [
  {
    name: 'Contact Us Form',
    description: 'A simple contact form for customer inquiries',
    category: 'contact',
    tags: ['contact', 'inquiry', 'support'],
    thumbnailImage: '/templates/contact-us.png',
    isPublic: true,
    isPremium: false,
    isOfficial: true,
    isActive: true,
    version: '1.0',
    formData: {
      title: 'Contact Us Form',
      description: 'A simple contact form for customer inquiries',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Full Name',
          placeholder: 'Enter your full name',
          required: true,
          order: 1,
          conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
          answerRecall: { enabled: false },
          calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
          prefill: { enabled: false },
          properties: {}
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          placeholder: 'Enter your email',
          required: true,
          order: 2,
          conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
          answerRecall: { enabled: false },
          calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
          prefill: { enabled: false },
          properties: {}
        },
        {
          id: 'subject',
          type: 'dropdown',
          label: 'Subject',
          required: true,
          order: 3,
          options: ['General Inquiry', 'Technical Support', 'Sales Question', 'Partnership', 'Other'],
          conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
          answerRecall: { enabled: false },
          calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
          prefill: { enabled: false },
          properties: {}
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Message',
          placeholder: 'How can we help you?',
          required: true,
          order: 4,
          conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
          answerRecall: { enabled: false },
          calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
          prefill: { enabled: false },
          properties: {}
        }
      ],
      customization: {
        primaryColor: '#3b82f6',
        fontFamily: 'Inter',
        backgroundColor: '#ffffff',
        theme: 'default'
      },
      settings: {
        showProgressBar: false,
        allowMultipleSubmissions: true,
        collectEmail: false,
        requireLogin: false
      }
    },
    createdBy: undefined,
    analytics: {
      views: 0,
      usageCount: 0,
      averageRating: 0,
      ratingCount: 0,
      totalRatings: 0
    },
    ratings: []
  },
  {
    name: 'Customer Feedback Survey',
    description: 'Collect valuable feedback from your customers',
    category: 'survey',
    tags: ['feedback', 'survey', 'customer', 'satisfaction'],
    thumbnailImage: '/templates/customer-feedback.png',
    isPublic: true,
    isPremium: false,
    fields: [
      {
        id: 'overall_rating',
        type: 'rating',
        label: 'Overall satisfaction',
        required: true,
        order: 1,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {
          ratingScale: { min: 1, max: 5, step: 1, labels: { start: 'Poor', end: 'Excellent' } }
        }
      },
      {
        id: 'recommend',
        type: 'scale',
        label: 'How likely are you to recommend us?',
        required: true,
        order: 2,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {
          scale: { min: 0, max: 10, step: 1, leftLabel: 'Not likely', rightLabel: 'Very likely' }
        }
      },
      {
        id: 'improvements',
        type: 'checkbox',
        label: 'What areas need improvement?',
        required: false,
        order: 3,
        options: ['Customer Service', 'Product Quality', 'Pricing', 'Website Experience', 'Delivery Speed'],
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'additional_comments',
        type: 'textarea',
        label: 'Additional Comments',
        placeholder: 'Share any additional feedback...',
        required: false,
        order: 4,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      }
    ],
    customization: {
      primaryColor: '#10b981',
      fontFamily: 'Inter',
      backgroundColor: '#f9fafb',
      theme: 'modern'
    },
    settings: {
      isMultiStep: true,
      showProgressBar: true,
      allowBackNavigation: true,
      allowMultipleSubmissions: false,
      requireLogin: false,
      collectIpAddress: false,
      collectUserAgent: true,
      notifications: {
        email: { enabled: true, recipients: [], subject: 'New Feedback Received' },
        webhook: { enabled: false, url: '', headers: new Map() }
      },
      autoSave: { enabled: true, interval: 30 },
      passwordProtection: { enabled: false },
      responseLimit: { enabled: false },
      schedule: { enabled: false },
      gdpr: { enabled: true, consentText: 'I consent to data processing' }
    },
    isTemplate: true,
    createdBy: undefined,
    analytics: {
      views: 0,
      usageCount: 0,
      averageRating: 0,
      ratingCount: 0,
      totalRatings: 0
    }
  },
  {
    name: 'Job Application Form',
    description: 'Professional job application form for hiring',
    category: 'application',
    tags: ['job', 'application', 'hiring', 'hr'],
    thumbnailImage: '/templates/job-application.png',
    isPublic: true,
    isPremium: false,
    fields: [
      {
        id: 'personal_info',
        type: 'heading',
        label: 'Personal Information',
        required: false,
        order: 1,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'full_name',
        type: 'name',
        label: 'Full Name',
        required: true,
        order: 2,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'email',
        type: 'email',
        label: 'Email Address',
        required: true,
        order: 3,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'phone',
        type: 'phone',
        label: 'Phone Number',
        required: true,
        order: 4,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'position',
        type: 'dropdown',
        label: 'Position Applied For',
        required: true,
        order: 5,
        options: ['Software Engineer', 'Product Manager', 'Designer', 'Marketing Manager', 'Sales Representative'],
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'experience',
        type: 'radio',
        label: 'Years of Experience',
        required: true,
        order: 6,
        options: ['0-1 years', '2-3 years', '4-5 years', '6-10 years', '10+ years'],
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'resume',
        type: 'file',
        label: 'Upload Resume',
        required: true,
        order: 7,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {
          fileUpload: { maxFileSize: 5242880, allowedTypes: ['.pdf', '.doc', '.docx'], maxFiles: 1 }
        }
      },
      {
        id: 'cover_letter',
        type: 'textarea',
        label: 'Cover Letter',
        placeholder: 'Tell us why you\'re interested in this position...',
        required: false,
        order: 8,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      }
    ],
    customization: {
      primaryColor: '#6366f1',
      fontFamily: 'Inter',
      backgroundColor: '#ffffff',
      theme: 'default'
    },
    settings: {
      isMultiStep: true,
      showProgressBar: true,
      allowBackNavigation: true,
      allowMultipleSubmissions: false,
      requireLogin: false,
      collectIpAddress: true,
      collectUserAgent: true,
      notifications: {
        email: { enabled: true, recipients: [], subject: 'New Job Application Received' },
        webhook: { enabled: false, url: '', headers: new Map() }
      },
      autoSave: { enabled: true, interval: 60 },
      passwordProtection: { enabled: false },
      responseLimit: { enabled: false },
      schedule: { enabled: false },
      gdpr: { enabled: true, consentText: 'I consent to the processing of my personal data for recruitment purposes' }
    },
    isTemplate: true,
    createdBy: undefined,
    analytics: {
      views: 0,
      usageCount: 0,
      averageRating: 0,
      ratingCount: 0,
      totalRatings: 0
    }
  }
  // ... I'll add more templates in a follow-up due to space constraints
];

// Additional template categories
export const templateCategories = [
  'Contact',
  'Survey',
  'HR',
  'Education',
  'Healthcare',
  'Marketing',
  'Event',
  'Registration',
  'Order',
  'Booking',
  'Feedback',
  'Lead Generation'
];

export const popularTags = [
  'contact', 'survey', 'feedback', 'registration', 'application', 'booking',
  'order', 'event', 'lead', 'customer', 'employee', 'student', 'healthcare',
  'marketing', 'sales', 'support', 'evaluation', 'assessment', 'questionnaire'
];