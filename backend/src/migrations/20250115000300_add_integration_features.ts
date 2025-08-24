/**
 * Migration: Add Integration Features
 * Description: Create integration collections and add webhook/third-party service support
 * Created: 2025-01-15T00:03:00.000Z
 */

import mongoose from 'mongoose';

export const description = 'Add Integration Features';

/**
 * Run the migration
 */
export async function up(): Promise<void> {
  console.log('Running migration: Add Integration Features');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Create integrations collection if it doesn't exist
    const collections = await db.listCollections({ name: 'integrations' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('integrations');
      console.log('Created integrations collection');
    }
    
    // Create webhook logs collection
    const webhookLogsCollections = await db.listCollections({ name: 'webhooklogs' }).toArray();
    if (webhookLogsCollections.length === 0) {
      await db.createCollection('webhooklogs');
      console.log('Created webhook logs collection');
    }
    
    // Add integration support to forms
    const formResult = await db.collection('forms').updateMany(
      {},
      {
        $set: {
          'integrations.webhooks': { $ifNull: ['$integrations.webhooks', [] ] },
          'integrations.slack': { $ifNull: ['$integrations.slack', null] },
          'integrations.googleSheets': { $ifNull: ['$integrations.googleSheets', null] },
          'integrations.mailchimp': { $ifNull: ['$integrations.mailchimp', null] },
          'integrations.zapier': { $ifNull: ['$integrations.zapier', null] },
          'integrations.typeform': { $ifNull: ['$integrations.typeform', null] },
          'integrations.custom': { $ifNull: ['$integrations.custom', [] ] },
          'integrations.autoResponder': { $ifNull: ['$integrations.autoResponder', {
            enabled: false,
            subject: 'Thank you for your submission',
            message: 'We have received your form submission and will get back to you soon.',
            fromEmail: null,
            fromName: null
          }] }
        }
      }
    );
    
    console.log(`Added integration features to ${formResult.modifiedCount} forms`);
    
    // Add integration preferences to users
    const userResult = await db.collection('users').updateMany(
      {},
      {
        $set: {
          'integrations.connectedServices': { $ifNull: ['$integrations.connectedServices', [] ] },
          'integrations.apiTokens': { $ifNull: ['$integrations.apiTokens', {} ] },
          'integrations.webhookSettings': { $ifNull: ['$integrations.webhookSettings', {
            retryAttempts: 3,
            timeoutSeconds: 30,
            includeMetadata: true
          }] },
          'preferences.integrationsEnabled': { $ifNull: ['$preferences.integrationsEnabled', true] },
          'preferences.webhookNotifications': { $ifNull: ['$preferences.webhookNotifications', false] }
        }
      }
    );
    
    console.log(`Added integration preferences to ${userResult.modifiedCount} users`);
    
    // Create indexes for integration collections
    await db.collection('integrations').createIndex({ userId: 1 });
    await db.collection('integrations').createIndex({ formId: 1 });
    await db.collection('integrations').createIndex({ type: 1 });
    await db.collection('integrations').createIndex({ status: 1 });
    await db.collection('integrations').createIndex({ createdAt: -1 });
    
    await db.collection('webhooklogs').createIndex({ integrationId: 1 });
    await db.collection('webhooklogs').createIndex({ formId: 1 });
    await db.collection('webhooklogs').createIndex({ status: 1 });
    await db.collection('webhooklogs').createIndex({ timestamp: -1 });
    await db.collection('webhooklogs').createIndex({ responseId: 1 });
    
    // Update form indexes for integration features
    await db.collection('forms').createIndex({ 'integrations.webhooks.url': 1 });
    await db.collection('forms').createIndex({ 'integrations.slack.webhookUrl': 1 });
    
    console.log('Created indexes for integration features');
    
    // Create some default integration templates
    const defaultIntegrations = [
      {
        name: 'Slack Notification',
        type: 'slack',
        description: 'Send form submissions to a Slack channel',
        isTemplate: true,
        config: {
          messageFormat: 'New form submission received from {{form.title}}',
          includeFields: true,
          channel: '#general'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Google Sheets Export',
        type: 'google_sheets',
        description: 'Export form responses to a Google Sheets spreadsheet',
        isTemplate: true,
        config: {
          spreadsheetId: null,
          sheetName: 'Form Responses',
          includeTimestamp: true,
          createHeaders: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Email Autoresponder',
        type: 'email',
        description: 'Send automatic email responses to form submitters',
        isTemplate: true,
        config: {
          subject: 'Thank you for your submission',
          template: 'default',
          includeSubmissionData: false,
          delay: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Webhook Integration',
        type: 'webhook',
        description: 'Send form data to any external service via HTTP webhook',
        isTemplate: true,
        config: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          includeMetadata: true,
          retryAttempts: 3
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await db.collection('integrations').insertMany(defaultIntegrations);
    console.log(`Created ${defaultIntegrations.length} default integration templates`);
    
    // Add form response tracking for integrations
    await db.collection('formresponses').updateMany(
      {},
      {
        $set: {
          'integrations.processed': { $ifNull: ['$integrations.processed', [] ] },
          'integrations.failed': { $ifNull: ['$integrations.failed', [] ] },
          'integrations.webhookDeliveries': { $ifNull: ['$integrations.webhookDeliveries', [] ] }
        }
      }
    );
    
    console.log('Added integration tracking to form responses');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback the migration
 */
export async function down(): Promise<void> {
  console.log('Rolling back migration: Add Integration Features');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Remove integration fields from forms
    await db.collection('forms').updateMany(
      {},
      {
        $unset: {
          'integrations.webhooks': 1,
          'integrations.slack': 1,
          'integrations.googleSheets': 1,
          'integrations.mailchimp': 1,
          'integrations.zapier': 1,
          'integrations.typeform': 1,
          'integrations.custom': 1,
          'integrations.autoResponder': 1
        }
      }
    );
    
    // Remove integration fields from users
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          'integrations.connectedServices': 1,
          'integrations.apiTokens': 1,
          'integrations.webhookSettings': 1,
          'preferences.integrationsEnabled': 1,
          'preferences.webhookNotifications': 1
        }
      }
    );
    
    // Remove integration tracking from form responses
    await db.collection('formresponses').updateMany(
      {},
      {
        $unset: {
          'integrations.processed': 1,
          'integrations.failed': 1,
          'integrations.webhookDeliveries': 1
        }
      }
    );
    
    // Drop integration-related collections
    try {
      await db.collection('integrations').drop();
      await db.collection('webhooklogs').drop();
      console.log('Dropped integration-related collections');
    } catch (dropError) {
      console.warn('Some collections may not exist:', dropError);
    }
    
    // Drop integration-related indexes from forms
    try {
      await db.collection('forms').dropIndex('integrations.webhooks.url_1');
      await db.collection('forms').dropIndex('integrations.slack.webhookUrl_1');
    } catch (indexError) {
      console.warn('Some form indexes may not exist:', indexError);
    }
    
    console.log('Removed integration features');
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}