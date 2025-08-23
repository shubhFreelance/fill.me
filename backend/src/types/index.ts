import { Document, Types } from 'mongoose';
import { Request } from 'express';

// Base document interface extending Mongoose Document
export interface BaseDocument extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// User related types
export interface IUser extends BaseDocument {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLogin?: Date;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  subscription: ISubscription;
  apiKeys: IApiKey[];
  preferences: IUserPreferences;
  profile: IUserProfile;
  security: IUserSecurity;
  usage: IUserUsage;
  role: 'user' | 'admin' | 'super_admin';
  isVerified: boolean;
  verificationToken?: string;
  verificationExpire?: Date;
  analytics: IUserAnalytics;
}

export interface ISubscription {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd: boolean;
  features: ISubscriptionFeatures;
}

export interface ISubscriptionFeatures {
  maxForms: number;
  maxResponses: number;
  maxFileStorage: number;
  customBranding: boolean;
  advancedAnalytics: boolean;
  integrations: boolean;
  apiAccess: boolean;
  customDomains: boolean;
  whiteLabeling: boolean;
  prioritySupport: boolean;
}

export interface IApiKey {
  name: string;
  key: string;
  hashedKey: string;
  permissions: IApiPermissions;
  rateLimit: IRateLimit;
  isActive: boolean;
  lastUsed?: Date;
  usageStats: IApiUsageStats;
  expiresAt?: Date;
  createdAt: Date;
}

export interface IApiPermissions {
  forms: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  responses: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  analytics: {
    read: boolean;
  };
  integrations: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
}

export interface IRateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface IApiUsageStats {
  totalRequests: number;
  lastRequestAt?: Date;
  lastRequestIp?: string;
}

export interface IUserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  emailNotifications: IEmailNotifications;
  dashboard: IDashboardPreferences;
}

export interface IEmailNotifications {
  formSubmissions: boolean;
  weeklyReports: boolean;
  productUpdates: boolean;
  marketingEmails: boolean;
}

export interface IDashboardPreferences {
  defaultView: 'forms' | 'analytics' | 'templates';
  itemsPerPage: number;
}

export interface IUserProfile {
  avatar?: string;
  bio?: string;
  website?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  address?: IAddress;
  socialLinks?: ISocialLinks;
}

export interface IAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface ISocialLinks {
  twitter?: string;
  linkedin?: string;
  github?: string;
}

export interface IUserSecurity {
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes: string[];
  lastPasswordChange: Date;
  loginAttempts: number;
  lockUntil?: Date;
  ipWhitelist: string[];
  sessionTimeout: number;
}

export interface IUserUsage {
  formsCreated: number;
  responsesReceived: number;
  storageUsed: number;
  apiCallsThisMonth: number;
  lastApiCall?: Date;
}

export interface IUserAnalytics {
  signupSource?: string;
  referralCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  firstLoginAt?: Date;
  totalLogins: number;
}

// Form related types
export interface IForm extends BaseDocument {
  title: string;
  description?: string;
  fields: IFormField[];
  customization: IFormCustomization;
  isPublic: boolean;
  isActive: boolean;
  userId: Types.ObjectId;
  analytics: IFormAnalytics;
  publicUrl: string;
  embedCode?: string;
  templateId?: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  settings: IFormSettings;
  thankYouPage: IThankYouPage;
  payment: IPaymentSettings;
  languages: ILanguageSettings;
  seo: ISeoSettings;
}

export interface IFormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: IFieldValidation;
  order: number;
  conditional: IConditionalLogic;
  answerRecall: IAnswerRecall;
  calculation: ICalculation;
  prefill: IPrefillSettings;
  properties: IFieldProperties;
}

export type FormFieldType = 
  | 'text' | 'textarea' | 'email' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'file'
  | 'number' | 'phone' | 'url' | 'rating' | 'scale' | 'matrix' | 'signature' | 'payment'
  | 'address' | 'name' | 'password' | 'hidden' | 'divider' | 'heading' | 'paragraph'
  | 'image' | 'video' | 'audio' | 'calendar';

export interface IFieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface IConditionalLogic {
  show: {
    enabled: boolean;
    conditions: ICondition[];
  };
  skip: {
    enabled: boolean;
    targetFieldId?: string;
    conditions: ICondition[];
  };
}

export interface ICondition {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: any;
  logicalOperator?: 'and' | 'or';
}

export interface IAnswerRecall {
  enabled: boolean;
  sourceFieldId?: string;
  template?: string;
}

export interface ICalculation {
  enabled: boolean;
  formula?: string;
  dependencies: string[];
  displayType: 'currency' | 'percentage' | 'number' | 'decimal';
}

export interface IPrefillSettings {
  enabled: boolean;
  urlParameter?: string;
  defaultValue?: any;
}

export interface IFieldProperties {
  ratingScale?: IRatingScale;
  scale?: IScale;
  matrix?: IMatrix;
  payment?: IFieldPayment;
  address?: IAddressField;
  fileUpload?: IFileUpload;
  media?: IMediaField;
}

export interface IRatingScale {
  min: number;
  max: number;
  step: number;
  labels: {
    start?: string;
    end?: string;
  };
}

export interface IScale {
  min: number;
  max: number;
  step: number;
  leftLabel?: string;
  rightLabel?: string;
}

export interface IMatrix {
  rows: string[];
  columns: string[];
  allowMultiple: boolean;
}

export interface IFieldPayment {
  amount?: number;
  currency: string;
  description?: string;
  allowCustomAmount: boolean;
}

export interface IAddressField {
  includeCountry: boolean;
  includeState: boolean;
  includePostalCode: boolean;
  defaultCountry?: string;
}

export interface IFileUpload {
  maxFileSize: number;
  allowedTypes: string[];
  maxFiles: number;
}

export interface IMediaField {
  url?: string;
  caption?: string;
  alt?: string;
  autoplay: boolean;
}

export interface IFormCustomization {
  primaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  backgroundColor: string;
  backgroundImage?: string;
  theme: 'default' | 'minimal' | 'modern' | 'classic' | 'custom';
  customCss?: string;
  thankYouPage?: ICustomThankYouPage;
  confetti?: IConfettiSettings;
}

export interface IFormAnalytics {
  views: number;
  submissions: number;
  starts: number;
  completions: number;
  abandons: number;
  averageCompletionTime: number;
  fieldDropoffs: Map<string, number>;
  deviceStats: IDeviceStats;
  referrerStats: Map<string, number>;
}

export interface IDeviceStats {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface IFormSettings {
  isMultiStep: boolean;
  showProgressBar: boolean;
  allowBackNavigation: boolean;
  allowMultipleSubmissions: boolean;
  requireLogin: boolean;
  collectIpAddress: boolean;
  collectUserAgent: boolean;
  notifications: INotificationSettings;
  autoSave: IAutoSaveSettings;
  passwordProtection: IPasswordProtection;
  responseLimit: IResponseLimit;
  schedule: IScheduleSettings;
  gdpr: IGdprSettings;
}

export interface INotificationSettings {
  email: {
    enabled: boolean;
    recipients: string[];
    subject?: string;
    template?: string;
  };
  webhook: {
    enabled: boolean;
    url?: string;
    headers: Map<string, string>;
  };
}

export interface IAutoSaveSettings {
  enabled: boolean;
  interval: number;
}

// Partial Submission interfaces
export interface IPartialSubmission {
  _id?: Types.ObjectId;
  formId: Types.ObjectId;
  sessionId: string;
  responses: Record<string, any>;
  isComplete: boolean;
  progress: IProgressInfo;
  lastSavedAt: Date;
  expiresAt: Date;
  metadata: IPartialSubmissionMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPartialSubmissionMetadata {
  ipAddress?: string;
  userAgent?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  referrer?: string;
  saveCount?: number;
  fieldCount?: number;
  timeSpent?: number;
}

export interface IProgressInfo {
  totalFields: number;
  answeredFields: number;
  percentage: number;
  missingRequiredFields: number;
}

export interface IPartialSubmissionResult {
  success: boolean;
  submissionId?: string;
  sessionId?: string;
  responses?: Record<string, any>;
  progress?: IProgressInfo;
  lastSavedAt?: Date;
  expiresAt?: Date;
  metadata?: IPartialSubmissionMetadata;
  createdAt?: Date;
  error?: string;
}

export interface ICompletionResult {
  success: boolean;
  submissionId?: string;
  wasPartialSubmission: boolean;
  partialSubmissionData?: {
    sessionId: string;
    createdAt: Date;
    saveCount: number;
    totalTimeSpent: number;
  };
  error?: string;
}

export interface IPartialSubmissionStats {
  totalPartialSubmissions: number;
  averageProgress: number;
  averageSaveCount: number;
  averageTimeSpent: number;
  totalFieldsSaved: number;
  completionRate: number;
}

// Export interfaces
export interface IExportOptions {
  format?: 'excel' | 'pdf' | 'csv';
  dateFrom?: string;
  dateTo?: string;
  selectedFields?: string[];
  includeMetadata?: boolean;
  includeSummary?: boolean;
  includeAnalysis?: boolean;
  limit?: number;
  filters?: IExportFilter[];
}

export interface IExportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'not_empty' | 'greater_than' | 'less_than';
  value: any;
}

export interface IExportResult {
  success: boolean;
  data?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    size: number;
    recordCount: number;
    exportedAt: Date;
    metadata: any;
  };
  error?: string;
}

export interface IExportStats {
  formId: string;
  formTitle: string;
  totalResponses: number;
  estimatedSizes: Record<string, string>;
  supportedFormats: string[];
  recentExports: IExportHistory[];
  maxRecordsPerExport: Record<string, number>;
  features: {
    includeMetadata: boolean;
    includeSummary: boolean;
    includeAnalysis: boolean;
    dateFiltering: boolean;
    fieldSelection: boolean;
    customFormatting: boolean;
  };
}

export interface IExportHistory {
  id: string;
  format: string;
  recordCount: number;
  fileSize: number;
  exportedAt: Date;
  exportedBy?: string;
  downloadCount: number;
}

// GDPR Compliance interfaces
export type IGDPRConsentType = 'data_processing' | 'marketing' | 'analytics' | 'cookies' | 'third_party_sharing';

export interface IGDPRConsentData {
  purpose: string;
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  consentGiven: boolean;
  ipAddress?: string;
  userAgent?: string;
  consentMethod: 'checkbox' | 'button_click' | 'form_submission' | 'email_confirmation';
  explicitConsent?: boolean;
  consentText?: string;
  granularConsent?: Record<string, boolean>;
  parentalConsent?: boolean;
  dataCategories?: string[];
  retentionPeriod?: number;
  source?: string;
}

export interface IGDPRConsentRecord extends IGDPRConsentData {
  id: string;
  userId: string;
  consentType: IGDPRConsentType;
  consentTimestamp: Date;
  optInDetails: {
    explicitConsent: boolean;
    consentText?: string;
    granularConsent: Record<string, boolean>;
    parentalConsent: boolean;
  };
  isActive: boolean;
  revokedAt: Date | null;
}

export interface IGDPRRevocationData {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  revocationMethod: 'button_click' | 'email_request' | 'phone_request' | 'written_request';
}

export interface IGDPRAccessRequest {
  email?: string;
  userId?: string;
  requestId?: string;
  verificationMethod: 'email' | 'identity_document' | 'account_login';
}

export interface IGDPRAccessResponse {
  requestId: string;
  userId: string;
  email: string;
  requestDate: Date;
  dataExported: Record<string, any>;
  exportFormat: string;
  retentionNotice: string;
  dataProcessingPurposes: string[];
  thirdPartySharing: string[];
  userRights: string[];
}

export interface IGDPRErasureRequest {
  email?: string;
  userId?: string;
  requestId?: string;
  erasureScope: string[];
  verificationMethod: 'email' | 'identity_document' | 'account_login';
}

export interface IGDPRErasureResponse {
  requestId: string;
  userId: string;
  email: string;
  requestDate: Date;
  erasureCompleted: boolean;
  erasureResults: IGDPRErasureResult[];
  retainedData: string[];
  legalObligations: string[];
}

export interface IGDPRErasureResult {
  dataCategory: string;
  recordsAffected: number;
  erasureMethod: 'deletion' | 'anonymization' | 'pseudonymization';
  completedAt: Date;
  success: boolean;
  error?: string;
}

export interface IGDPRPortabilityRequest {
  email?: string;
  userId?: string;
  requestId?: string;
  exportFormat?: 'json' | 'csv' | 'xml';
  verificationMethod: 'email' | 'identity_document' | 'account_login';
}

export interface IGDPRPortabilityResponse {
  requestId: string;
  userId: string;
  email: string;
  requestDate: Date;
  exportFormat: string;
  portableData: any;
  dataCategories: string[];
  technicalDetails: {
    encoding: string;
    structure: string;
    apiVersion: string;
  };
}

export interface IGDPRDataProcessingRecord {
  id: string;
  formId: string;
  formTitle: string;
  dataController: {
    name: string;
    email: string;
    address: string;
  };
  processingPurpose: string[];
  legalBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  internationalTransfers: boolean;
  retentionPeriod: number;
  securityMeasures: string[];
  dataSubjectRights: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IGDPRComplianceValidation {
  formId: string;
  formTitle: string;
  complianceScore: number;
  isCompliant: boolean;
  validationResults: IGDPRValidationResult[];
  recommendations: string[];
  validatedAt: Date;
}

export interface IGDPRValidationResult {
  requirement: string;
  compliant: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
}

// API Key Management interfaces
export type IAPIKeyType = 'read_only' | 'read_write' | 'admin' | 'webhook' | 'public';

export interface IAPIKey {
  id: string;
  name: string;
  keyType: IAPIKeyType;
  hashedKey: string;
  keyPreview: string;
  permissions: IAPIKeyPermissions;
  scopes: string[];
  rateLimit: IAPIKeyRateLimit;
  restrictions: IAPIKeyRestrictions;
  isActive: boolean;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt?: Date;
  metadata: {
    createdBy: string;
    createdFrom: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface IAPIKeyPermissions {
  forms: { read: boolean; create: boolean; update: boolean; delete: boolean };
  responses: { read: boolean; create: boolean; update: boolean; delete: boolean };
  analytics: { read: boolean; create: boolean; update: boolean; delete: boolean };
  webhooks: { read: boolean; create: boolean; update: boolean; delete: boolean };
  users: { read: boolean; create: boolean; update: boolean; delete: boolean };
}

export interface IAPIKeyRateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface IAPIKeyRestrictions {
  allowedIPs?: string[];
  allowedDomains?: string[];
  allowedFormIds?: string[];
  deniedEndpoints?: string[];
}

export interface IAPIKeyCreateData {
  name: string;
  keyType: IAPIKeyType;
  permissions?: IAPIKeyPermissions;
  scopes?: string[];
  rateLimit?: IAPIKeyRateLimit;
  restrictions?: IAPIKeyRestrictions;
  expiresAt?: Date;
  createdFrom?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface IAPIKeyUpdateData {
  name?: string;
  permissions?: IAPIKeyPermissions;
  scopes?: string[];
  rateLimit?: IAPIKeyRateLimit;
  restrictions?: IAPIKeyRestrictions;
  expiresAt?: Date;
}

export interface IAPIKeyResponse {
  success: boolean;
  apiKey: {
    id: string;
    name: string;
    keyType: IAPIKeyType;
    key: string;
    keyPreview: string;
    permissions: IAPIKeyPermissions;
    scopes: string[];
    rateLimit: IAPIKeyRateLimit;
    restrictions: IAPIKeyRestrictions;
    isActive: boolean;
    createdAt: Date;
    expiresAt: Date | null;
  };
  usage: {
    currentKeys: number;
    maxKeys: number;
    plan: string;
  };
}

export interface IAPIKeyValidation {
  isValid: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    plan: string;
  };
  apiKey?: {
    id: string;
    name: string;
    keyType: IAPIKeyType;
    permissions: IAPIKeyPermissions;
    scopes: string[];
    rateLimit: IAPIKeyRateLimit;
    restrictions: IAPIKeyRestrictions;
  };
  error?: string;
}

export interface IAPIKeyListResponse {
  apiKeys: Array<{
    id: string;
    name: string;
    keyType: IAPIKeyType;
    keyPreview: string;
    permissions: IAPIKeyPermissions;
    scopes: string[];
    rateLimit: IAPIKeyRateLimit;
    restrictions: IAPIKeyRestrictions;
    isActive: boolean;
    lastUsedAt: Date | null;
    usageCount: number;
    createdAt: Date;
    expiresAt: Date | null;
  }>;
  summary: {
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    maxKeys: number;
    plan: string;
  };
}

export interface IAPIKeyUsageStats {
  totalKeys: number;
  activeKeys: number;
  totalUsage: number;
  recentUsage: number;
  expiredKeys: number;
  keyBreakdown: Array<{
    id: string;
    name: string;
    keyType: IAPIKeyType;
    usageCount: number;
    lastUsedAt: Date | null;
    isActive: boolean;
    isExpired: boolean;
  }>;
}

export interface IPasswordProtection {
  enabled: boolean;
  password?: string;
}

export interface IResponseLimit {
  enabled: boolean;
  maxResponses?: number;
}

export interface IScheduleSettings {
  enabled: boolean;
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
}

export interface IGdprSettings {
  enabled: boolean;
  consentText?: string;
  privacyPolicyUrl?: string;
  dataRetentionDays: number;
}

export interface IThankYouPage {
  type: 'message' | 'redirect' | 'custom';
  message: string;
  redirectUrl?: string;
  customHtml?: string;
  showConfetti: boolean;
  autoRedirectDelay: number;
}

// Enhanced Custom Thank You Page interface for advanced customization
export interface ICustomThankYouPage {
  id: string;
  formId: string;
  isEnabled: boolean;
  title: string;
  message: string;
  showSubmissionId: boolean;
  showResetButton: boolean;
  resetButtonText?: string;
  redirectEnabled: boolean;
  redirectUrl?: string;
  redirectDelay: number;
  customCss?: string;
  showShareButtons: boolean;
  shareMessage?: string;
  customData: Record<string, any>;
  analytics: IThankYouPageAnalytics;
  createdAt: Date;
  updatedAt: Date;
}

export interface IThankYouPageAnalytics {
  viewCount: number;
  shareCount: number;
  resetCount: number;
}

// Confetti Animation interfaces
export interface IConfettiSettings {
  enabled: boolean;
  config: IConfettiConfig;
  updatedAt: Date;
}

export interface IConfettiConfig {
  particleCount: number;
  spread: number;
  origin: { x?: number; y?: number };
  colors: string[];
  duration: number;
  scalar: number;
  drift: number;
  gravity: number;
  ticks: number;
  shapes: string[];
  zIndex: number;
  multiple?: boolean;
  launches?: number;
  launchDelay?: number;
}

export interface IPaymentSettings {
  enabled: boolean;
  provider: 'stripe' | 'paypal';
  amount?: number;
  currency: string;
  description?: string;
  allowCustomAmount: boolean;
}

export interface ILanguageSettings {
  default: string;
  supported: ILanguage[];
  autoDetect: boolean;
  fallbackLanguage: string;
  allowUserSelection: boolean;
}

export interface ILanguage {
  code: string;
  name: string;
  translations: Map<string, string>;
}

export interface ISeoSettings {
  title?: string;
  description?: string;
  keywords: string[];
  ogImage?: string;
}

// Form Response types
export interface IFormResponse extends BaseDocument {
  formId: Types.ObjectId;
  responses: Record<string, any>;
  submittedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata: IResponseMetadata;
  isValid: boolean;
  validationErrors: IValidationError[];
}

export interface IResponseMetadata {
  referrer?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

export interface IValidationError {
  fieldId: string;
  message: string;
}

// Template rating interface
export interface ITemplateRating {
  userId: Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
}

// Template types
export interface ITemplate extends BaseDocument {
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  previewImage?: string;
  thumbnailImage?: string;
  formData: ITemplateFormData;
  isOfficial: boolean;
  isPremium: boolean;
  isPublic: boolean;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdByName?: string;
  analytics: ITemplateAnalytics;
  version: string;
  publishedAt?: Date;
  ratings: ITemplateRating[];
}

export type TemplateCategory = 
  | 'contact' | 'survey' | 'quiz' | 'feedback' | 'registration' 
  | 'application' | 'booking' | 'order' | 'evaluation' | 'newsletter'
  | 'event' | 'support' | 'assessment' | 'lead-generation' | 'custom';

export interface ITemplateFormData {
  title: string;
  description?: string;
  fields: IFormField[];
  customization: IFormCustomization;
  settings: ITemplateSettings;
}

export interface ITemplateSettings {
  showProgressBar: boolean;
  allowMultipleSubmissions: boolean;
  collectEmail: boolean;
  requireLogin: boolean;
}

export interface ITemplateAnalytics {
  usageCount: number;
  lastUsed?: Date;
  averageRating: number;
  ratingCount: number;
  totalRatings: number;
  views: number;
}

// Workspace types
export interface IWorkspace extends BaseDocument {
  name: string;
  description?: string;
  slug: string;
  ownerId: Types.ObjectId;
  members: IWorkspaceMember[];
  billing: IWorkspaceBilling;
  settings: IWorkspaceSettings;
  analytics: IWorkspaceAnalytics;
  isActive: boolean;
  isPaused: boolean;
  pausedReason?: string;
  pausedAt?: Date;
  lastActivityAt: Date;
}

export interface IWorkspaceMember {
  userId: Types.ObjectId;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: IWorkspacePermissions;
  invitedBy?: Types.ObjectId;
  invitedAt: Date;
  joinedAt?: Date;
  status: 'pending' | 'active' | 'suspended';
  lastActivity: Date;
}

export interface IWorkspacePermissions {
  createForms: boolean;
  editForms: boolean;
  deleteForms: boolean;
  viewResponses: boolean;
  exportData: boolean;
  manageIntegrations: boolean;
  inviteMembers: boolean;
  manageBilling: boolean;
}

export interface IWorkspaceBilling {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  subscriptionId?: string;
  customerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  isActive: boolean;
  trialEndsAt?: Date;
  canceledAt?: Date;
  limits: IWorkspaceLimits;
}

export interface IWorkspaceLimits {
  maxForms: number;
  maxResponses: number;
  maxMembers: number;
  maxFileStorage: number;
}

export interface IWorkspaceSettings {
  branding: IBrandingSettings;
  security: ISecuritySettings;
  notifications: IWorkspaceNotifications;
  dataRetention: IDataRetentionSettings;
}

export interface IBrandingSettings {
  logo?: string;
  primaryColor: string;
  customDomain?: string;
  removeBranding: boolean;
}

export interface ISecuritySettings {
  requireSso: boolean;
  allowedDomains: string[];
  ipWhitelist: string[];
  enforcePasswordPolicy: boolean;
}

export interface IWorkspaceNotifications {
  emailNotifications: boolean;
  slackIntegration: ISlackIntegration;
  webhooks: IWebhook[];
}

export interface ISlackIntegration {
  enabled: boolean;
  webhookUrl?: string;
  channel?: string;
}

export interface IWebhook {
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
}

export interface IDataRetentionSettings {
  deleteResponsesAfter: number;
  anonymizeAfter: number;
  gdprCompliant: boolean;
}

export interface IWorkspaceAnalytics {
  totalForms: number;
  totalResponses: number;
  activeMembers: number;
  storageUsed: number;
  lastUpdated: Date;
}

// Integration types
export interface IIntegration extends BaseDocument {
  name: string;
  description?: string;
  type: IntegrationType;
  formId?: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  credentials: IIntegrationCredentials;
  settings: IIntegrationSettings;
  triggers: IIntegrationTrigger[];
  isActive: boolean;
  isPaused: boolean;
  pausedReason?: string;
  pausedAt?: Date;
  analytics: IIntegrationAnalytics;
  rateLimit: IIntegrationRateLimit;
  encryptionKey: string;
  lastValidatedAt?: Date;
  validationErrors: string[];
  version: string;
}

export type IntegrationType = 
  | 'webhook' | 'google_sheets' | 'slack' | 'stripe' | 'calendly' 
  | 'zapier' | 'make' | 'email' | 'sms' | 'discord' | 'teams' | 'custom';

export interface IIntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  apiKey?: string;
  secretKey?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  slackTeamId?: string;
  slackChannelId?: string;
  slackChannelName?: string;
  slackUserId?: string;
  spreadsheetId?: string;
  sheetId?: string;
  sheetName?: string;
  stripeAccountId?: string;
  stripePublishableKey?: string;
  calendlyUserId?: string;
  calendlySchedulingUrl?: string;
  zapierWebhookUrl?: string;
  makeWebhookUrl?: string;
  customFields: Map<string, string>;
}

export interface IIntegrationSettings {
  webhook?: IWebhookSettings;
  googleSheets?: IGoogleSheetsSettings;
  slack?: ISlackSettings;
  email?: IEmailSettings;
  stripe?: IStripeSettings;
}

export interface IWebhookSettings {
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  includeMetadata: boolean;
  customHeaders: Map<string, string>;
}

export interface IGoogleSheetsSettings {
  appendMode: 'append' | 'update';
  includeTimestamp: boolean;
  timestampColumn: string;
  fieldMapping: Map<string, string>;
}

export interface ISlackSettings {
  messageFormat: 'simple' | 'detailed' | 'custom';
  customTemplate?: string;
  mentionUsers: string[];
  includeAttachments: boolean;
}

export interface IEmailSettings {
  recipients: string[];
  subject?: string;
  template?: string;
  includeAttachments: boolean;
}

export interface IStripeSettings {
  currency: string;
  paymentMethods: string[];
  collectBillingAddress: boolean;
  allowPromotionCodes: boolean;
}

export interface IIntegrationTrigger {
  event: TriggerEvent;
  conditions: ITriggerConditions;
  isActive: boolean;
}

export type TriggerEvent = 
  | 'form_submitted' | 'form_viewed' | 'form_started' | 'form_completed' 
  | 'form_abandoned' | 'response_updated' | 'response_deleted';

export interface ITriggerConditions {
  fieldConditions: IFieldCondition[];
  minResponseTime?: number;
  maxResponseTime?: number;
  requiredFields: string[];
}

export interface IFieldCondition {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: any;
}

export interface IIntegrationAnalytics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutionAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastError?: string;
  averageResponseTime: number;
  uptime: number;
}

export interface IIntegrationRateLimit {
  maxExecutionsPerMinute: number;
  maxExecutionsPerHour: number;
  maxExecutionsPerDay: number;
}

// API Request/Response types
export interface AuthenticatedRequest extends Request {
  user?: IUser;
  apiKey?: IApiKey;
}

export interface PaginatedRequest extends AuthenticatedRequest {
  query: {
    page?: string;
    limit?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    filter?: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: IPagination;
}

export interface IPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Utility types
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Partial<T> = {
  [P in keyof T]?: T[P];
};
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

// Environment types
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
  EMAIL_HOST?: string;
  EMAIL_PORT?: number;
  EMAIL_USER?: string;
  EMAIL_PASSWORD?: string;
  REDIS_URL?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      apiKey?: IApiKey;
    }
  }
}