/**
 * Migration: Add Advanced Form Features
 * Description: Add conditional logic, calculations, and enhanced field properties to existing forms
 * Created: 2025-01-15T00:01:00.000Z
 */

import mongoose from 'mongoose';

export const description = 'Add Advanced Form Features';

/**
 * Run the migration
 */
export async function up(): Promise<void> {
  console.log('Running migration: Add Advanced Form Features');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Update existing forms to add new advanced features
    const result = await db.collection('forms').updateMany(
      {},
      {
        $set: {
          // Add version field for form versioning
          version: { $ifNull: ['$version', 1] },
          
          // Add advanced settings
          'settings.autoSave': { $ifNull: ['$settings.autoSave', { enabled: false, interval: 30 }] },
          'settings.allowMultiple': { $ifNull: ['$settings.allowMultiple', false] },
          'settings.requireAuth': { $ifNull: ['$settings.requireAuth', false] },
          'settings.collectIP': { $ifNull: ['$settings.collectIP', false] },
          'settings.collectLocation': { $ifNull: ['$settings.collectLocation', false] },
          'settings.enableCaptcha': { $ifNull: ['$settings.enableCaptcha', false] },
          'settings.submitLimit': { $ifNull: ['$settings.submitLimit', null] },
          'settings.timeLimit': { $ifNull: ['$settings.timeLimit', null] },
          'settings.scheduledPublication': { $ifNull: ['$settings.scheduledPublication', null] },
          'settings.passwordProtection': { $ifNull: ['$settings.passwordProtection', null] },
          
          // Add customization options
          'customization.theme': { $ifNull: ['$customization.theme', 'default'] },
          'customization.colors.primary': { $ifNull: ['$customization.colors.primary', '#3B82F6'] },
          'customization.colors.background': { $ifNull: ['$customization.colors.background', '#FFFFFF'] },
          'customization.colors.text': { $ifNull: ['$customization.colors.text', '#1F2937'] },
          'customization.font': { $ifNull: ['$customization.font', 'Inter'] },
          'customization.buttonStyle': { $ifNull: ['$customization.buttonStyle', 'rounded'] },
          'customization.backgroundImage': { $ifNull: ['$customization.backgroundImage', null] },
          'customization.logo': { $ifNull: ['$customization.logo', null] },
          'customization.css': { $ifNull: ['$customization.css', ''] },
          
          // Add notification settings
          'notifications.onSubmission': { $ifNull: ['$notifications.onSubmission', true] },
          'notifications.emailNotifications': { $ifNull: ['$notifications.emailNotifications', [] ] },
          'notifications.webhookUrl': { $ifNull: ['$notifications.webhookUrl', null] },
          'notifications.slackWebhook': { $ifNull: ['$notifications.slackWebhook', null] },
          
          // Add analytics settings
          'analytics.enabled': { $ifNull: ['$analytics.enabled', true] },
          'analytics.trackViews': { $ifNull: ['$analytics.trackViews', true] },
          'analytics.trackCompletions': { $ifNull: ['$analytics.trackCompletions', true] },
          'analytics.trackAbandonments': { $ifNull: ['$analytics.trackAbandonments', true] },
          
          // Add SEO settings
          'seo.title': { $ifNull: ['$seo.title', null] },
          'seo.description': { $ifNull: ['$seo.description', null] },
          'seo.keywords': { $ifNull: ['$seo.keywords', []] },
          'seo.ogImage': { $ifNull: ['$seo.ogImage', null] },
          
          // Add privacy settings
          'privacy.isPublic': { $ifNull: ['$privacy.isPublic', true] },
          'privacy.allowIndexing': { $ifNull: ['$privacy.allowIndexing', true] },
          'privacy.dataRetention': { $ifNull: ['$privacy.dataRetention', 365] },
          'privacy.gdprCompliant': { $ifNull: ['$privacy.gdprCompliant', false] },
          
          // Add integration settings
          'integrations.enabled': { $ifNull: ['$integrations.enabled', []] },
          'integrations.googleSheets': { $ifNull: ['$integrations.googleSheets', null] },
          'integrations.mailchimp': { $ifNull: ['$integrations.mailchimp', null] },
          'integrations.zapier': { $ifNull: ['$integrations.zapier', null] },
          
          // Add sharing settings
          'sharing.embedEnabled': { $ifNull: ['$sharing.embedEnabled', true] },
          'sharing.socialSharing': { $ifNull: ['$sharing.socialSharing', false] },
          'sharing.qrCode': { $ifNull: ['$sharing.qrCode', null] },
          'sharing.customDomain': { $ifNull: ['$sharing.customDomain', null] }
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} form documents with advanced features`);
    
    // Update existing form fields to add conditional logic and validation support
    const formsWithFields = await db.collection('forms').find({ fields: { $exists: true, $ne: [] } }).toArray();
    
    for (const form of formsWithFields) {
      const updatedFields = form.fields.map((field: any) => ({
        ...field,
        // Add conditional logic support
        conditional: field.conditional || { enabled: false },
        
        // Add enhanced validation
        validation: {
          ...field.validation,
          custom: field.validation?.custom || null,
          errorMessage: field.validation?.errorMessage || null
        },
        
        // Add field metadata
        metadata: field.metadata || {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        },
        
        // Add accessibility options
        accessibility: field.accessibility || {
          ariaLabel: field.label,
          tabIndex: field.order || 0,
          required: field.required || false
        }
      }));
      
      await db.collection('forms').updateOne(
        { _id: form._id },
        { $set: { fields: updatedFields } }
      );
    }
    
    console.log(`Enhanced ${formsWithFields.length} forms with advanced field features`);
    
    // Create indexes for better performance
    await db.collection('forms').createIndex({ 'settings.scheduledPublication': 1 });
    await db.collection('forms').createIndex({ 'customization.theme': 1 });
    await db.collection('forms').createIndex({ 'privacy.isPublic': 1 });
    await db.collection('forms').createIndex({ version: 1 });
    
    console.log('Created indexes for advanced form features');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback the migration
 */
export async function down(): Promise<void> {
  console.log('Rolling back migration: Add Advanced Form Features');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Remove the advanced features from forms
    await db.collection('forms').updateMany(
      {},
      {
        $unset: {
          version: 1,
          settings: 1,
          customization: 1,
          notifications: 1,
          analytics: 1,
          seo: 1,
          privacy: 1,
          integrations: 1,
          sharing: 1
        }
      }
    );
    
    // Restore simple field structure
    const formsWithFields = await db.collection('forms').find({ fields: { $exists: true, $ne: [] } }).toArray();
    
    for (const form of formsWithFields) {
      const simplifiedFields = form.fields.map((field: any) => ({
        id: field.id,
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required || false,
        order: field.order || 0,
        options: field.options || [],
        validation: {
          required: field.required || false
        }
      }));
      
      await db.collection('forms').updateOne(
        { _id: form._id },
        { $set: { fields: simplifiedFields } }
      );
    }
    
    // Drop the indexes
    try {
      await db.collection('forms').dropIndex('settings.scheduledPublication_1');
      await db.collection('forms').dropIndex('customization.theme_1');
      await db.collection('forms').dropIndex('privacy.isPublic_1');
      await db.collection('forms').dropIndex('version_1');
    } catch (indexError) {
      console.warn('Some indexes may not exist:', indexError);
    }
    
    console.log('Removed advanced form features');
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}