import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../../models/User';
import { APIKeyService } from '../../services/APIKeyService';
import { TestUtils } from '../setup';

describe('APIKeyService', () => {
  let testUser: any;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);
  });

  afterEach(async () => {
    // Clean up after each test
    await User.deleteMany({});
  });

  describe('generateAPIKey', () => {
    it('should generate a read-only API key successfully', async () => {
      const keyData = {
        name: 'Test Read Only Key',
        keyType: 'read_only' as const,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      };

      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), keyData);

      expect(result.success).toBe(true);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey!.name).toBe('Test Read Only Key');
      expect(result.apiKey!.keyType).toBe('read_only');
      expect(result.apiKey!.key).toMatch(/^fmro_[a-f0-9]{64}$/);
      expect(result.apiKey!.keyPreview).toMatch(/^fmro_\*+.{4}$/);
      expect(result.apiKey!.permissions.forms.read).toBe(true);
      expect(result.apiKey!.permissions.forms.create).toBe(false);
      expect(result.apiKey!.isActive).toBe(true);
      expect(result.usage).toBeDefined();
      expect(result.usage!.currentKeys).toBe(1);
      expect(result.usage!.maxKeys).toBe(2); // Free plan limit

      // Verify key was saved to database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.apiKeys).toHaveLength(1);
      expect(updatedUser!.apiKeys![0].name).toBe('Test Read Only Key');
    });

    it('should generate a read-write API key with correct permissions', async () => {
      const keyData = {
        name: 'Test Read Write Key',
        keyType: 'read_write' as const
      };

      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), keyData);

      expect(result.success).toBe(true);
      expect(result.apiKey!.keyType).toBe('read_write');
      expect(result.apiKey!.key).toMatch(/^fmrw_[a-f0-9]{64}$/);
      expect(result.apiKey!.permissions.forms.read).toBe(true);
      expect(result.apiKey!.permissions.forms.create).toBe(true);
      expect(result.apiKey!.permissions.forms.update).toBe(true);
      expect(result.apiKey!.permissions.forms.delete).toBe(false);
      expect(result.apiKey!.permissions.responses.create).toBe(true);
    });

    it('should generate an admin API key with full permissions', async () => {
      const keyData = {
        name: 'Test Admin Key',
        keyType: 'admin' as const
      };

      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), keyData);

      expect(result.success).toBe(true);
      expect(result.apiKey!.keyType).toBe('admin');
      expect(result.apiKey!.key).toMatch(/^fmad_[a-f0-9]{64}$/);
      expect(result.apiKey!.permissions.forms.delete).toBe(true);
      expect(result.apiKey!.permissions.responses.delete).toBe(true);
      expect(result.apiKey!.permissions.webhooks.delete).toBe(true);
    });

    it('should generate a webhook API key with limited permissions', async () => {
      const keyData = {
        name: 'Test Webhook Key',
        keyType: 'webhook' as const
      };

      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), keyData);

      expect(result.success).toBe(true);
      expect(result.apiKey!.keyType).toBe('webhook');
      expect(result.apiKey!.key).toMatch(/^fmwh_[a-f0-9]{64}$/);
      expect(result.apiKey!.permissions.forms.read).toBe(false);
      expect(result.apiKey!.permissions.responses.create).toBe(true);
      expect(result.apiKey!.permissions.analytics.read).toBe(false);
    });

    it('should enforce API key limits for free plan', async () => {
      // Create 2 API keys (free plan limit)
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Key 1',
        keyType: 'read_only'
      });
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Key 2',
        keyType: 'read_only'
      });

      // Try to create a third key
      await expect(
        APIKeyService.generateAPIKey(testUser._id.toString(), {
          name: 'Key 3',
          keyType: 'read_only'
        })
      ).rejects.toThrow('Maximum API keys limit reached for free plan (2)');
    });

    it('should not count inactive keys towards limit', async () => {
      // Create 2 API keys
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Key 1',
        keyType: 'read_only'
      });
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Key 2',
        keyType: 'read_only'
      });

      // Deactivate one key
      await APIKeyService.revokeAPIKey(testUser._id.toString(), 'Key 1');

      // Should be able to create another key now
      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Key 3',
        keyType: 'read_only'
      });

      expect(result.success).toBe(true);
    });

    it('should throw error when user not found', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        APIKeyService.generateAPIKey(nonExistentUserId, {
          name: 'Test Key',
          keyType: 'read_only'
        })
      ).rejects.toThrow('User not found');
    });

    it('should set correct rate limits based on key type', async () => {
      const keyData = {
        name: 'Rate Limit Test',
        keyType: 'read_only' as const
      };

      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), keyData);

      expect(result.apiKey!.rateLimit).toEqual({
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      });
    });
  });

  describe('validateAPIKey', () => {
    let testApiKey: string;
    let hashedApiKey: string;

    beforeEach(async () => {
      // Create a test API key
      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Test Key',
        keyType: 'read_only'
      });
      testApiKey = result.apiKey!.key;
      hashedApiKey = await bcrypt.hash(testApiKey, 12);
    });

    it('should validate a correct API key successfully', async () => {
      const validation = await APIKeyService.validateAPIKey(testApiKey);

      expect(validation.isValid).toBe(true);
      expect(validation.user).toBeDefined();
      expect(validation.user!.id).toBe(testUser._id.toString());
      expect(validation.user!.email).toBe(testUser.email);
      expect(validation.user!.plan).toBe('free');
      expect(validation.apiKey).toBeDefined();
      expect(validation.apiKey!.name).toBe('Test Key');
      expect(validation.apiKey!.permissions.forms.read).toBe(true);
    });

    it('should reject invalid API key format', async () => {
      const validation = await APIKeyService.validateAPIKey('invalid-key');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid API key format');
    });

    it('should reject API key with invalid prefix', async () => {
      const invalidKey = 'invalid_' + crypto.randomBytes(32).toString('hex');
      const validation = await APIKeyService.validateAPIKey(invalidKey);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid API key prefix');
    });

    it('should reject expired API key', async () => {
      // Update the API key to be expired
      const user = await User.findById(testUser._id);
      user!.apiKeys![0].expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      await user!.save();

      const validation = await APIKeyService.validateAPIKey(testApiKey);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('API key has expired');
    });

    it('should reject inactive API key', async () => {
      // Deactivate the API key
      await APIKeyService.revokeAPIKey(testUser._id.toString(), 'Test Key');

      const validation = await APIKeyService.validateAPIKey(testApiKey);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('API key not found or invalid');
    });

    it('should handle empty or null API key', async () => {
      const validation1 = await APIKeyService.validateAPIKey('');
      const validation2 = await APIKeyService.validateAPIKey(null as any);

      expect(validation1.isValid).toBe(false);
      expect(validation1.error).toBe('Invalid API key format');
      expect(validation2.isValid).toBe(false);
      expect(validation2.error).toBe('Invalid API key format');
    });

    it('should update usage statistics on validation', async () => {
      const beforeUser = await User.findById(testUser._id);
      const beforeUsage = beforeUser!.apiKeys![0].usageStats.totalRequests;

      await APIKeyService.validateAPIKey(testApiKey);

      const afterUser = await User.findById(testUser._id);
      const afterUsage = afterUser!.apiKeys![0].usageStats.totalRequests;

      expect(afterUsage).toBeGreaterThan(beforeUsage);
      expect(afterUser!.apiKeys![0].lastUsed).toBeDefined();
    });
  });

  describe('listAPIKeys', () => {
    beforeEach(async () => {
      // Create multiple API keys for testing
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Key 1',
        keyType: 'read_only'
      });
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Key 2',
        keyType: 'read_write',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired
      });
    });

    it('should list all API keys for a user', async () => {
      const result = await APIKeyService.listAPIKeys(testUser._id.toString());

      expect(result.apiKeys).toHaveLength(2);
      expect(result.summary.totalKeys).toBe(2);
      expect(result.summary.activeKeys).toBe(2);
      expect(result.summary.expiredKeys).toBe(1);
      expect(result.summary.maxKeys).toBe(2);
      expect(result.summary.plan).toBe('free');

      const key1 = result.apiKeys.find(k => k.name === 'Key 1');
      expect(key1).toBeDefined();
      expect(key1!.keyPreview).toMatch(/^fmro_.../);
      expect(key1!.isActive).toBe(true);

      const key2 = result.apiKeys.find(k => k.name === 'Key 2');
      expect(key2).toBeDefined();
      expect(key2!.keyPreview).toMatch(/^fmrw_.../);
    });

    it('should return empty list for user with no API keys', async () => {
      // Create a new user without API keys
      const newUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'newuser@test.com'
      });

      const result = await APIKeyService.listAPIKeys(newUser._id.toString());

      expect(result.apiKeys).toHaveLength(0);
      expect(result.summary.totalKeys).toBe(0);
      expect(result.summary.activeKeys).toBe(0);
      expect(result.summary.expiredKeys).toBe(0);
    });

    it('should throw error when user not found', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        APIKeyService.listAPIKeys(nonExistentUserId)
      ).rejects.toThrow('User not found');
    });
  });

  describe('revokeAPIKey', () => {
    beforeEach(async () => {
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Test Key',
        keyType: 'read_only'
      });
    });

    it('should revoke API key successfully', async () => {
      const result = await APIKeyService.revokeAPIKey(testUser._id.toString(), 'Test Key');

      expect(result.success).toBe(true);
      expect(result.message).toBe('API key revoked successfully');

      // Verify key is deactivated in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.apiKeys![0].isActive).toBe(false);
    });

    it('should throw error when API key not found', async () => {
      await expect(
        APIKeyService.revokeAPIKey(testUser._id.toString(), 'Non-existent Key')
      ).rejects.toThrow('API key not found');
    });

    it('should throw error when user not found', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        APIKeyService.revokeAPIKey(nonExistentUserId, 'Test Key')
      ).rejects.toThrow('User or API keys not found');
    });
  });

  describe('updateAPIKey', () => {
    beforeEach(async () => {
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Test Key',
        keyType: 'read_only'
      });
    });

    it('should update API key name successfully', async () => {
      const updates = {
        name: 'Updated Key Name'
      };

      const result = await APIKeyService.updateAPIKey(
        testUser._id.toString(),
        'Test Key',
        updates
      );

      expect(result.success).toBe(true);
      expect(result.apiKey.name).toBe('Updated Key Name');

      // Verify update in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.apiKeys![0].name).toBe('Updated Key Name');
    });

    it('should update API key permissions successfully', async () => {
      const updates = {
        permissions: {
          forms: { read: true, create: true, update: true, delete: true },
          responses: { read: true, create: false, update: false, delete: false },
          analytics: { read: false, create: false, update: false, delete: false },
          webhooks: { read: false, create: false, update: false, delete: false },
          users: { read: false, create: false, update: false, delete: false }
        }
      };

      const result = await APIKeyService.updateAPIKey(
        testUser._id.toString(),
        'Test Key',
        updates
      );

      expect(result.success).toBe(true);
      expect(result.apiKey.permissions.forms.delete).toBe(true);
      expect(result.apiKey.permissions.responses.create).toBe(false);

      // Verify update in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.apiKeys![0].permissions.forms.delete).toBe(true);
      expect(updatedUser!.apiKeys![0].permissions.responses.write).toBe(false);
    });

    it('should update rate limits successfully', async () => {
      const updates = {
        rateLimit: {
          requestsPerMinute: 50,
          requestsPerHour: 500,
          requestsPerDay: 5000
        }
      };

      const result = await APIKeyService.updateAPIKey(
        testUser._id.toString(),
        'Test Key',
        updates
      );

      expect(result.success).toBe(true);
      expect(result.apiKey.rateLimit).toEqual(updates.rateLimit);

      // Verify update in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.apiKeys![0].rateLimit).toEqual(updates.rateLimit);
    });

    it('should update expiration date successfully', async () => {
      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const updates = {
        expiresAt: newExpiry
      };

      const result = await APIKeyService.updateAPIKey(
        testUser._id.toString(),
        'Test Key',
        updates
      );

      expect(result.success).toBe(true);
      expect(new Date(result.apiKey.expiresAt!).getTime()).toBe(newExpiry.getTime());

      // Verify update in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.apiKeys![0].expiresAt!.getTime()).toBe(newExpiry.getTime());
    });

    it('should throw error when API key not found', async () => {
      await expect(
        APIKeyService.updateAPIKey(testUser._id.toString(), 'Non-existent Key', {
          name: 'New Name'
        })
      ).rejects.toThrow('API key not found');
    });
  });

  describe('getAPIKeyUsage', () => {
    beforeEach(async () => {
      // Create multiple API keys with different usage
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Active Key',
        keyType: 'read_only'
      });
      await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Expired Key',
        keyType: 'read_write',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired
      });

      // Simulate some usage
      const user = await User.findById(testUser._id);
      user!.apiKeys![0].usageStats.totalRequests = 100;
      user!.apiKeys![0].lastUsed = new Date();
      user!.apiKeys![1].usageStats.totalRequests = 50;
      user!.apiKeys![1].lastUsed = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
      await user!.save();
    });

    it('should get usage statistics for all keys', async () => {
      const stats = await APIKeyService.getAPIKeyUsage(testUser._id.toString());

      expect(stats.totalKeys).toBe(2);
      expect(stats.totalUsage).toBe(150);
      expect(stats.activeKeys).toBe(2);
      expect(stats.expiredKeys).toBe(1);
      expect(stats.recentUsage).toBe(100); // Only usage from last 30 days
      expect(stats.keyBreakdown).toHaveLength(2);

      const activeKey = stats.keyBreakdown.find(k => k.name === 'Active Key');
      expect(activeKey).toBeDefined();
      expect(activeKey!.usageCount).toBe(100);
      expect(activeKey!.isActive).toBe(true);
      expect(activeKey!.isExpired).toBe(false);

      const expiredKey = stats.keyBreakdown.find(k => k.name === 'Expired Key');
      expect(expiredKey).toBeDefined();
      expect(expiredKey!.usageCount).toBe(50);
      expect(expiredKey!.isExpired).toBe(true);
    });

    it('should get usage statistics for specific key', async () => {
      const stats = await APIKeyService.getAPIKeyUsage(testUser._id.toString(), 'Active Key');

      expect(stats.totalKeys).toBe(1);
      expect(stats.totalUsage).toBe(100);
      expect(stats.activeKeys).toBe(1);
      expect(stats.expiredKeys).toBe(0);
      expect(stats.keyBreakdown).toHaveLength(1);
      expect(stats.keyBreakdown[0].name).toBe('Active Key');
    });

    it('should throw error when specific key not found', async () => {
      await expect(
        APIKeyService.getAPIKeyUsage(testUser._id.toString(), 'Non-existent Key')
      ).rejects.toThrow('API key not found');
    });

    it('should throw error when user not found', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        APIKeyService.getAPIKeyUsage(nonExistentUserId)
      ).rejects.toThrow('User or API keys not found');
    });

    it('should handle user with no API keys', async () => {
      // Create a new user without API keys
      const newUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'newuser@test.com'
      });

      await expect(
        APIKeyService.getAPIKeyUsage(newUser._id.toString())
      ).rejects.toThrow('User or API keys not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate database error by using invalid user ID
      const invalidUserId = 'invalid-user-id';
      
      await expect(
        APIKeyService.generateAPIKey(invalidUserId, {
          name: 'Test Key',
          keyType: 'read_only'
        })
      ).rejects.toThrow();
    });

    it('should handle invalid ObjectId formats', async () => {
      const invalidId = 'invalid-object-id';

      await expect(
        APIKeyService.generateAPIKey(invalidId, {
          name: 'Test Key',
          keyType: 'read_only'
        })
      ).rejects.toThrow();
    });

    it('should handle user without apiKeys array', async () => {
      // Create user without apiKeys
      const userWithoutKeys = await User.create({
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        isVerified: true,
        subscription: {
          plan: 'free',
          status: 'active',
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
          theme: 'light',
          language: 'en',
          timezone: 'UTC',
          emailNotifications: {
            formSubmissions: true,
            weeklyReports: false,
            productUpdates: false,
            marketingEmails: false
          },
          dashboard: {
            defaultView: 'forms',
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
        role: 'user',
        analytics: {
          totalLogins: 0
        }
        // Note: no apiKeys property
      });

      const result = await APIKeyService.generateAPIKey(userWithoutKeys._id.toString(), {
        name: 'First Key',
        keyType: 'read_only'
      });

      expect(result.success).toBe(true);
      expect(result.usage!.currentKeys).toBe(1);
    });

    it('should handle plan upgrades and different limits', async () => {
      // Update user to professional plan
      testUser.subscription.plan = 'professional';
      await testUser.save();

      const result = await APIKeyService.generateAPIKey(testUser._id.toString(), {
        name: 'Pro Key',
        keyType: 'read_only'
      });

      expect(result.success).toBe(true);
      expect(result.usage!.maxKeys).toBe(15); // Professional plan limit
    });
  });
});