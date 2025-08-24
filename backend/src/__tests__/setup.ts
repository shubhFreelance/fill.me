import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

// Global test variables
let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.disconnect();
  
  // Stop the in-memory MongoDB instance
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clean up after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Test utilities
export const TestUtils = {
  // Generate test JWT token
  generateToken: (userId: string, email: string = 'test@example.com') => {
    return jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },

  // Create test user data
  createTestUser: () => ({
    email: 'test@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    isVerified: true,
    subscription: {
      plan: 'free' as const,
      status: 'active' as const,
      cancelAtPeriodEnd: false,
      features: {
        maxForms: 3,
        maxResponses: 100,
        maxFileStorage: 100,
        customBranding: false,
        advancedAnalytics: false,
        integrations: false,
        apiAccess: false,
        customDomains: false,
        whiteLabeling: false,
        prioritySupport: false
      }
    },
    preferences: {
      theme: 'light' as const,
      language: 'en',
      timezone: 'UTC',
      emailNotifications: {
        formSubmissions: true,
        weeklyReports: false,
        productUpdates: false,
        marketingEmails: false
      },
      dashboard: {
        defaultView: 'forms' as const,
        itemsPerPage: 10
      }
    },
    profile: {},
    security: {
      twoFactorEnabled: false,
      backupCodes: [],
      lastPasswordChange: new Date(),
      loginAttempts: 0,
      ipWhitelist: [],
      sessionTimeout: 3600
    },
    usage: {
      formsCreated: 0,
      responsesReceived: 0,
      storageUsed: 0,
      apiCallsThisMonth: 0
    },
    role: 'user' as const,
    analytics: {
      totalLogins: 0
    },
    apiKeys: []
  }),

  // Create test form data
  createTestForm: (userId: string) => ({
    title: 'Test Form',
    description: 'A test form for unit testing',
    userId: new mongoose.Types.ObjectId(userId),
    isPublic: true,
    isActive: true,
    publicUrl: 'test-form-' + Date.now(),
    fields: [
      {
        id: 'field1',
        type: 'text',
        label: 'Name',
        placeholder: 'Enter your name',
        required: true,
        order: 0,
        options: [],
        validation: {},
        conditional: {
          show: { enabled: false, conditions: [] },
          skip: { enabled: false, conditions: [] }
        },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      }
    ],
    customization: {
      primaryColor: '#007bff',
      backgroundColor: '#ffffff',
      theme: 'default', // This should be a string from enum, not an object
      fontFamily: 'Inter'
    },
    settings: {
      isMultiStep: false,
      showProgressBar: false,
      allowBackNavigation: true,
      allowMultipleSubmissions: false,
      requireLogin: false,
      collectIpAddress: true,
      collectUserAgent: true,
      notifications: {
        email: { enabled: false, recipients: [] },
        webhook: { enabled: false, headers: new Map() }
      },
      autoSave: { enabled: false, interval: 30 },
      passwordProtection: { enabled: false },
      responseLimit: { enabled: false },
      schedule: { enabled: false },
      gdpr: { enabled: false, dataRetentionDays: 365 }
    },
    analytics: {
      totalViews: 0,
      totalSubmissions: 0,
      uniqueVisitors: 0,
      conversionRate: 0,
      averageCompletionTime: 0,
      dropoffRate: 0,
      viewsByDay: new Map(),
      submissionsByDay: new Map(),
      fieldDropoffs: new Map(),
      deviceTypes: new Map(),
      browsers: new Map(),
      countries: new Map(),
      referrers: new Map()
    },
    thankYouPage: {
      type: 'message' as const,
      message: 'Thank you for your submission!',
      showConfetti: false,
      autoRedirectDelay: 0
    },
    payment: {
      enabled: false,
      currency: 'USD',
      items: []
    },
    languages: {
      default: 'en',
      supported: [{ // This should be an array of objects, not strings
        code: 'en',
        name: 'English',
        translations: new Map()
      }]
    },
    seo: {
      title: 'Test Form',
      description: 'A test form',
      keywords: []
    }
  }),

  // Wait for async operations
  wait: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms))
};