import { Types } from 'mongoose';
import { IUser } from '../types';
import User from '../models/User';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * API Key Management Service
 * Handles creation, validation, and management of API keys for secure API access
 */
export class APIKeyService {

  /**
   * Generate a new API key for a user
   * @param userId - User identifier
   * @param keyData - API key configuration
   * @returns Created API key information
   */
  static async generateAPIKey(
    userId: string,
    keyData: IAPIKeyCreateData
  ): Promise<IAPIKeyResponse> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check API key limits
      const existingKeys = user.apiKeys?.filter(key => key.isActive) || [];
      const plan = user.subscription?.plan || 'free';
      const maxKeys = this.getMaxAPIKeysForPlan(plan);

      if (existingKeys.length >= maxKeys) {
        throw new Error(`Maximum API keys limit reached for ${plan} plan (${maxKeys})`);
      }

      // Generate secure API key
      const keyPrefix = this.getKeyPrefix(keyData.keyType);
      const keySecret = this.generateSecureKey();
      const apiKey = `${keyPrefix}_${keySecret}`;
      
      // Hash the key for secure storage
      const hashedKey = await bcrypt.hash(apiKey, 12);

      // Create API key object
      const newAPIKey: IAPIKey = {
        id: crypto.randomUUID(),
        name: keyData.name,
        keyType: keyData.keyType,
        hashedKey,
        keyPreview: `${keyPrefix}_${'*'.repeat(32)}${keySecret.slice(-4)}`,
        permissions: keyData.permissions || this.getDefaultPermissions(keyData.keyType),
        scopes: keyData.scopes || [],
        rateLimit: keyData.rateLimit || this.getDefaultRateLimit(keyData.keyType),
        restrictions: keyData.restrictions || {},
        isActive: true,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: new Date(),
        expiresAt: keyData.expiresAt || this.calculateDefaultExpiry(keyData.keyType),
        metadata: {
          createdBy: userId,
          createdFrom: keyData.createdFrom || 'dashboard',
          userAgent: keyData.userAgent,
          ipAddress: keyData.ipAddress
        }
      };

      // Add to user's API keys
      if (!user.apiKeys) {
        user.apiKeys = [];
      }
      user.apiKeys.push(newAPIKey);
      await user.save();

      // Return API key response (only time the full key is shown)
      return {
        success: true,
        apiKey: {
          id: newAPIKey.id,
          name: newAPIKey.name,
          keyType: newAPIKey.keyType,
          key: apiKey, // Full key only shown once
          keyPreview: newAPIKey.keyPreview,
          permissions: newAPIKey.permissions,
          scopes: newAPIKey.scopes,
          rateLimit: newAPIKey.rateLimit,
          restrictions: newAPIKey.restrictions,
          isActive: newAPIKey.isActive,
          createdAt: newAPIKey.createdAt,
          expiresAt: newAPIKey.expiresAt
        },
        usage: {
          currentKeys: existingKeys.length + 1,
          maxKeys,
          plan
        }
      };
    } catch (error) {
      console.error('Error generating API key:', error);
      throw error;
    }
  }

  /**
   * Validate an API key and return associated user/permissions
   * @param apiKey - API key to validate
   * @returns Validation result with user and permissions
   */
  static async validateAPIKey(apiKey: string): Promise<IAPIKeyValidation> {
    try {
      if (!apiKey || typeof apiKey !== 'string') {
        return { isValid: false, error: 'Invalid API key format' };
      }

      // Extract key prefix and validate format
      const keyParts = apiKey.split('_');
      if (keyParts.length !== 2) {
        return { isValid: false, error: 'Invalid API key format' };
      }

      const [prefix] = keyParts;
      const keyType = this.getKeyTypeFromPrefix(prefix);
      if (!keyType) {
        return { isValid: false, error: 'Invalid API key prefix' };
      }

      // Find user with matching API key
      const users = await User.find({
        'apiKeys.isActive': true,
        'apiKeys.keyType': keyType
      }).select('apiKeys email name subscription');

      for (const user of users) {
        if (!user.apiKeys) continue;

        for (const storedKey of user.apiKeys) {
          if (!storedKey.isActive || storedKey.keyType !== keyType) continue;

          // Check if key matches
          const isMatch = await bcrypt.compare(apiKey, storedKey.hashedKey);
          if (!isMatch) continue;

          // Check expiry
          if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
            return { isValid: false, error: 'API key has expired' };
          }

          // Update usage statistics
          await this.updateKeyUsage(user._id.toString(), storedKey.id);

          return {
            isValid: true,
            user: {
              id: user._id.toString(),
              email: user.email,
              name: user.name,
              plan: user.subscription?.plan || 'free'
            },
            apiKey: {
              id: storedKey.id,
              name: storedKey.name,
              keyType: storedKey.keyType,
              permissions: storedKey.permissions,
              scopes: storedKey.scopes,
              rateLimit: storedKey.rateLimit,
              restrictions: storedKey.restrictions
            }
          };
        }
      }

      return { isValid: false, error: 'API key not found or invalid' };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { isValid: false, error: 'Internal error during validation' };
    }
  }

  /**
   * List all API keys for a user
   * @param userId - User identifier
   * @returns List of user's API keys (without sensitive data)
   */
  static async listAPIKeys(userId: string): Promise<IAPIKeyListResponse> {
    try {
      const user = await User.findById(userId).select('apiKeys subscription');
      if (!user) {
        throw new Error('User not found');
      }

      const apiKeys = (user.apiKeys || []).map(key => ({
        id: key.id,
        name: key.name,
        keyType: key.keyType,
        keyPreview: key.keyPreview,
        permissions: key.permissions,
        scopes: key.scopes,
        rateLimit: key.rateLimit,
        restrictions: key.restrictions,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt
      }));

      const activeKeys = apiKeys.filter(key => key.isActive);
      const plan = user.subscription?.plan || 'free';

      return {
        apiKeys,
        summary: {
          totalKeys: apiKeys.length,
          activeKeys: activeKeys.length,
          expiredKeys: apiKeys.filter(key => key.expiresAt && key.expiresAt < new Date()).length,
          maxKeys: this.getMaxAPIKeysForPlan(plan),
          plan
        }
      };
    } catch (error) {
      console.error('Error listing API keys:', error);
      throw error;
    }
  }

  /**
   * Revoke/deactivate an API key
   * @param userId - User identifier
   * @param keyId - API key identifier
   * @returns Revocation result
   */
  static async revokeAPIKey(userId: string, keyId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.apiKeys) {
        throw new Error('User or API keys not found');
      }

      const keyIndex = user.apiKeys.findIndex(key => key.id === keyId);
      if (keyIndex === -1) {
        throw new Error('API key not found');
      }

      // Deactivate the key
      user.apiKeys[keyIndex].isActive = false;
      user.apiKeys[keyIndex].revokedAt = new Date();
      
      await user.save();

      return {
        success: true,
        message: 'API key revoked successfully'
      };
    } catch (error) {
      console.error('Error revoking API key:', error);
      throw error;
    }
  }

  /**
   * Update API key permissions and settings
   * @param userId - User identifier
   * @param keyId - API key identifier
   * @param updates - Updates to apply
   * @returns Update result
   */
  static async updateAPIKey(
    userId: string,
    keyId: string,
    updates: IAPIKeyUpdateData
  ): Promise<{ success: boolean; apiKey: any }> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.apiKeys) {
        throw new Error('User or API keys not found');
      }

      const keyIndex = user.apiKeys.findIndex(key => key.id === keyId);
      if (keyIndex === -1) {
        throw new Error('API key not found');
      }

      const apiKey = user.apiKeys[keyIndex];

      // Update allowed fields
      if (updates.name !== undefined) apiKey.name = updates.name;
      if (updates.permissions !== undefined) apiKey.permissions = updates.permissions;
      if (updates.scopes !== undefined) apiKey.scopes = updates.scopes;
      if (updates.rateLimit !== undefined) apiKey.rateLimit = updates.rateLimit;
      if (updates.restrictions !== undefined) apiKey.restrictions = updates.restrictions;
      if (updates.expiresAt !== undefined) apiKey.expiresAt = updates.expiresAt;

      await user.save();

      return {
        success: true,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyType: apiKey.keyType,
          keyPreview: apiKey.keyPreview,
          permissions: apiKey.permissions,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          restrictions: apiKey.restrictions,
          isActive: apiKey.isActive,
          lastUsedAt: apiKey.lastUsedAt,
          usageCount: apiKey.usageCount,
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt
        }
      };
    } catch (error) {
      console.error('Error updating API key:', error);
      throw error;
    }
  }

  /**
   * Get API key usage statistics
   * @param userId - User identifier
   * @param keyId - API key identifier (optional)
   * @returns Usage statistics
   */
  static async getAPIKeyUsage(userId: string, keyId?: string): Promise<IAPIKeyUsageStats> {
    try {
      const user = await User.findById(userId).select('apiKeys');
      if (!user || !user.apiKeys) {
        throw new Error('User or API keys not found');
      }

      let targetKeys = user.apiKeys;
      if (keyId) {
        targetKeys = user.apiKeys.filter(key => key.id === keyId);
        if (targetKeys.length === 0) {
          throw new Error('API key not found');
        }
      }

      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = targetKeys.reduce((acc, key) => {
        return {
          totalUsage: acc.totalUsage + key.usageCount,
          activeKeys: acc.activeKeys + (key.isActive ? 1 : 0),
          recentUsage: acc.recentUsage + (key.lastUsedAt && key.lastUsedAt > last30Days ? key.usageCount : 0),
          expiredKeys: acc.expiredKeys + (key.expiresAt && key.expiresAt < now ? 1 : 0)
        };
      }, {
        totalUsage: 0,
        activeKeys: 0,
        recentUsage: 0,
        expiredKeys: 0
      });

      return {
        ...stats,
        totalKeys: targetKeys.length,
        keyBreakdown: targetKeys.map(key => ({
          id: key.id,
          name: key.name,
          keyType: key.keyType,
          usageCount: key.usageCount,
          lastUsedAt: key.lastUsedAt,
          isActive: key.isActive,
          isExpired: key.expiresAt ? key.expiresAt < now : false
        }))
      };
    } catch (error) {
      console.error('Error getting API key usage:', error);
      throw error;
    }
  }

  // Helper methods
  private static generateSecureKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private static getKeyPrefix(keyType: IAPIKeyType): string {
    const prefixes = {
      'read_only': 'fmro',
      'read_write': 'fmrw',
      'admin': 'fmad',
      'webhook': 'fmwh',
      'public': 'fmpb'
    };
    return prefixes[keyType];
  }

  private static getKeyTypeFromPrefix(prefix: string): IAPIKeyType | null {
    const typeMap = {
      'fmro': 'read_only',
      'fmrw': 'read_write',
      'fmad': 'admin',
      'fmwh': 'webhook',
      'fmpb': 'public'
    };
    return typeMap[prefix as keyof typeof typeMap] || null;
  }

  private static getDefaultPermissions(keyType: IAPIKeyType): IAPIKeyPermissions {
    const permissions = {
      'read_only': {
        forms: { read: true, create: false, update: false, delete: false },
        responses: { read: true, create: false, update: false, delete: false },
        analytics: { read: true, create: false, update: false, delete: false },
        webhooks: { read: false, create: false, update: false, delete: false },
        users: { read: false, create: false, update: false, delete: false }
      },
      'read_write': {
        forms: { read: true, create: true, update: true, delete: false },
        responses: { read: true, create: true, update: true, delete: false },
        analytics: { read: true, create: false, update: false, delete: false },
        webhooks: { read: true, create: true, update: true, delete: true },
        users: { read: false, create: false, update: false, delete: false }
      },
      'admin': {
        forms: { read: true, create: true, update: true, delete: true },
        responses: { read: true, create: true, update: true, delete: true },
        analytics: { read: true, create: true, update: true, delete: true },
        webhooks: { read: true, create: true, update: true, delete: true },
        users: { read: true, create: false, update: true, delete: false }
      },
      'webhook': {
        forms: { read: true, create: false, update: false, delete: false },
        responses: { read: false, create: true, update: false, delete: false },
        analytics: { read: false, create: false, update: false, delete: false },
        webhooks: { read: false, create: false, update: false, delete: false },
        users: { read: false, create: false, update: false, delete: false }
      },
      'public': {
        forms: { read: true, create: false, update: false, delete: false },
        responses: { read: false, create: true, update: false, delete: false },
        analytics: { read: false, create: false, update: false, delete: false },
        webhooks: { read: false, create: false, update: false, delete: false },
        users: { read: false, create: false, update: false, delete: false }
      }
    };
    return permissions[keyType];
  }

  private static getDefaultRateLimit(keyType: IAPIKeyType): IAPIKeyRateLimit {
    const rateLimits = {
      'read_only': { requestsPerMinute: 100, requestsPerHour: 1000, requestsPerDay: 10000 },
      'read_write': { requestsPerMinute: 60, requestsPerHour: 600, requestsPerDay: 5000 },
      'admin': { requestsPerMinute: 120, requestsPerHour: 1200, requestsPerDay: 12000 },
      'webhook': { requestsPerMinute: 30, requestsPerHour: 300, requestsPerDay: 3000 },
      'public': { requestsPerMinute: 20, requestsPerHour: 200, requestsPerDay: 2000 }
    };
    return rateLimits[keyType];
  }

  private static getMaxAPIKeysForPlan(plan: string): number {
    const limits = {
      'free': 2,
      'starter': 5,
      'professional': 15,
      'enterprise': 50
    };
    return limits[plan as keyof typeof limits] || 2;
  }

  private static calculateDefaultExpiry(keyType: IAPIKeyType): Date | null {
    const expiryDays = {
      'read_only': 365,    // 1 year
      'read_write': 365,   // 1 year
      'admin': 90,         // 3 months (more sensitive)
      'webhook': null,     // No expiry (for automated systems)
      'public': 30         // 1 month (public access)
    };

    const days = expiryDays[keyType];
    if (days === null) return null;

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }

  private static async updateKeyUsage(userId: string, keyId: string): Promise<void> {
    try {
      await User.updateOne(
        { _id: userId, 'apiKeys.id': keyId },
        {
          $inc: { 'apiKeys.$.usageCount': 1 },
          $set: { 'apiKeys.$.lastUsedAt': new Date() }
        }
      );
    } catch (error) {
      console.error('Error updating key usage:', error);
    }
  }
}

// Type definitions
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

export default APIKeyService;