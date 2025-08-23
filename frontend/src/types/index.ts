export interface User {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  user: User;
  token: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'email' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'file';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For dropdown, radio, checkbox
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

export interface FormCustomization {
  primaryColor: string;
  fontFamily: string;
  logoUrl?: string;
}

export interface Form {
  _id: string;
  title: string;
  description?: string;
  fields: FormField[];
  customization: FormCustomization;
  isPublic: boolean;
  userId: string;
  publicUrl: string;
  embedCode?: string;
  analytics: {
    views: number;
    submissions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FormResponse {
  _id: string;
  formId: string;
  responses: Record<string, any>;
  submittedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FormAnalytics {
  totalViews: number;
  totalSubmissions: number;
  conversionRate: number;
  recentResponses: FormResponse[];
}