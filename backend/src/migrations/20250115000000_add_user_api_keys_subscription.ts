/**
 * Migration: Add API Keys and Subscription Features to Users
 * Description: Add apiKeys array and subscription fields to existing User documents
 * Created: 2025-01-15T00:00:00.000Z
 */

import mongoose from 'mongoose';

export const description = 'Add API Keys and Subscription Features to Users';

/**
 * Run the migration
 */
export async function up(): Promise<void> {
  console.log('Running migration: Add API Keys and Subscription Features to Users');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Update existing users to add new fields if they don't exist
    const result = await db.collection('users').updateMany(
      {}, 
      {
        $set: {
          // Initialize apiKeys array if it doesn't exist
          apiKeys: { $ifNull: ['$apiKeys', []] },
          
          // Initialize subscription object if it doesn't exist
          'subscription.plan': { $ifNull: ['$subscription.plan', 'free'] },
          'subscription.status': { $ifNull: ['$subscription.status', 'active'] },
          'subscription.startDate': { $ifNull: ['$subscription.startDate', new Date()] },
          'subscription.endDate': { $ifNull: ['$subscription.endDate', null] },
          'subscription.cancelAtPeriodEnd': { $ifNull: ['$subscription.cancelAtPeriodEnd', false] },
          'subscription.stripeCustomerId': { $ifNull: ['$subscription.stripeCustomerId', null] },
          'subscription.stripeSubscriptionId': { $ifNull: ['$subscription.stripeSubscriptionId', null] },
          
          // Initialize preferences if they don't exist
          'preferences.theme': { $ifNull: ['$preferences.theme', 'light'] },
          'preferences.language': { $ifNull: ['$preferences.language', 'en'] },
          'preferences.notifications.email': { $ifNull: ['$preferences.notifications.email', true] },
          'preferences.notifications.browser': { $ifNull: ['$preferences.notifications.browser', true] },
          'preferences.notifications.newResponse': { $ifNull: ['$preferences.notifications.newResponse', true] },
          'preferences.notifications.weeklyReport': { $ifNull: ['$preferences.notifications.weeklyReport', false] },
          
          // Initialize usage tracking
          'usage.formsCreated': { $ifNull: ['$usage.formsCreated', 0] },
          'usage.responsesReceived': { $ifNull: ['$usage.responsesReceived', 0] },
          'usage.apiCalls': { $ifNull: ['$usage.apiCalls', 0] },
          'usage.storageUsed': { $ifNull: ['$usage.storageUsed', 0] },
          'usage.lastResetDate': { $ifNull: ['$usage.lastResetDate', new Date()] },
          
          // Initialize features array
          features: { $ifNull: ['$features', ['basic_forms', 'basic_analytics']] }
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} user documents`);
    
    // Create indexes for better performance
    await db.collection('users').createIndex({ 'apiKeys.id': 1 });
    await db.collection('users').createIndex({ 'subscription.plan': 1 });
    await db.collection('users').createIndex({ 'subscription.stripeCustomerId': 1 });
    
    console.log('Created indexes for user API keys and subscription fields');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback the migration
 */
export async function down(): Promise<void> {
  console.log('Rolling back migration: Add API Keys and Subscription Features to Users');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Remove the added fields
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          apiKeys: 1,
          subscription: 1,
          preferences: 1,
          usage: 1,
          features: 1
        }
      }
    );
    
    // Drop the indexes
    try {
      await db.collection('users').dropIndex('apiKeys.id_1');
      await db.collection('users').dropIndex('subscription.plan_1');
      await db.collection('users').dropIndex('subscription.stripeCustomerId_1');
    } catch (indexError) {
      console.warn('Some indexes may not exist:', indexError);
    }
    
    console.log('Removed API keys and subscription features from users');
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}