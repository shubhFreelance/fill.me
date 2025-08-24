/**
 * Migration: Add Workspace and Collaboration Features
 * Description: Create workspace collections and add collaboration features to forms
 * Created: 2025-01-15T00:02:00.000Z
 */

import mongoose from 'mongoose';

export const description = 'Add Workspace and Collaboration Features';

/**
 * Run the migration
 */
export async function up(): Promise<void> {
  console.log('Running migration: Add Workspace and Collaboration Features');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Create workspace collection if it doesn't exist
    const collections = await db.listCollections({ name: 'workspaces' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('workspaces');
      console.log('Created workspaces collection');
    }
    
    // Create workspace invitations collection
    const invitationsCollections = await db.listCollections({ name: 'workspaceinvitations' }).toArray();
    if (invitationsCollections.length === 0) {
      await db.createCollection('workspaceinvitations');
      console.log('Created workspace invitations collection');
    }
    
    // Create workspace activities collection
    const activitiesCollections = await db.listCollections({ name: 'workspaceactivities' }).toArray();
    if (activitiesCollections.length === 0) {
      await db.createCollection('workspaceactivities');
      console.log('Created workspace activities collection');
    }
    
    // Create collaboration sessions collection
    const sessionsCollections = await db.listCollections({ name: 'collaborationsessions' }).toArray();
    if (sessionsCollections.length === 0) {
      await db.createCollection('collaborationsessions');
      console.log('Created collaboration sessions collection');
    }
    
    // Create form comments collection
    const commentsCollections = await db.listCollections({ name: 'formcomments' }).toArray();
    if (commentsCollections.length === 0) {
      await db.createCollection('formcomments');
      console.log('Created form comments collection');
    }
    
    // Add workspace-related fields to forms
    const formResult = await db.collection('forms').updateMany(
      {},
      {
        $set: {
          workspaceId: { $ifNull: ['$workspaceId', null] },
          'collaboration.enabled': { $ifNull: ['$collaboration.enabled', false] },
          'collaboration.allowComments': { $ifNull: ['$collaboration.allowComments', false] },
          'collaboration.allowRealTimeEditing': { $ifNull: ['$collaboration.allowRealTimeEditing', false] },
          'collaboration.permissions': { $ifNull: ['$collaboration.permissions', {
            canView: ['owner'],
            canEdit: ['owner'],
            canShare: ['owner'],
            canDelete: ['owner']
          }] },
          'sharing.workspaceSharing': { $ifNull: ['$sharing.workspaceSharing', {
            enabled: false,
            permissions: {
              canView: true,
              canEdit: false,
              canShare: false
            }
          }] }
        }
      }
    );
    
    console.log(`Added workspace features to ${formResult.modifiedCount} forms`);
    
    // Add workspace tracking to users
    const userResult = await db.collection('users').updateMany(
      {},
      {
        $set: {
          'workspaces': { $ifNull: ['$workspaces', [] ] },
          'preferences.defaultWorkspace': { $ifNull: ['$preferences.defaultWorkspace', null] },
          'preferences.collaborationNotifications': { $ifNull: ['$preferences.collaborationNotifications', true] }
        }
      }
    );
    
    console.log(`Added workspace tracking to ${userResult.modifiedCount} users`);
    
    // Create indexes for workspace collections
    await db.collection('workspaces').createIndex({ owner: 1 });
    await db.collection('workspaces').createIndex({ 'members.userId': 1 });
    await db.collection('workspaces').createIndex({ 'settings.isPublic': 1 });
    await db.collection('workspaces').createIndex({ createdAt: -1 });
    
    await db.collection('workspaceinvitations').createIndex({ workspaceId: 1 });
    await db.collection('workspaceinvitations').createIndex({ inviteeEmail: 1 });
    await db.collection('workspaceinvitations').createIndex({ status: 1 });
    await db.collection('workspaceinvitations').createIndex({ expiresAt: 1 });
    
    await db.collection('workspaceactivities').createIndex({ workspaceId: 1 });
    await db.collection('workspaceactivities').createIndex({ userId: 1 });
    await db.collection('workspaceactivities').createIndex({ timestamp: -1 });
    
    await db.collection('collaborationsessions').createIndex({ formId: 1 });
    await db.collection('collaborationsessions').createIndex({ userId: 1 });
    await db.collection('collaborationsessions').createIndex({ isActive: 1 });
    await db.collection('collaborationsessions').createIndex({ lastActivity: -1 });
    
    await db.collection('formcomments').createIndex({ formId: 1 });
    await db.collection('formcomments').createIndex({ userId: 1 });
    await db.collection('formcomments').createIndex({ fieldId: 1 });
    await db.collection('formcomments').createIndex({ createdAt: -1 });
    await db.collection('formcomments').createIndex({ isResolved: 1 });
    
    // Update form indexes for workspace features
    await db.collection('forms').createIndex({ workspaceId: 1 });
    await db.collection('forms').createIndex({ 'collaboration.enabled': 1 });
    
    console.log('Created indexes for workspace and collaboration features');
    
    // Create default personal workspace for existing users
    const users = await db.collection('users').find({}).toArray();
    
    for (const user of users) {
      // Create personal workspace for each user
      const personalWorkspace = {
        name: `${user.name}'s Personal Workspace`,
        description: 'Personal workspace for individual forms',
        owner: user._id,
        members: [{
          userId: user._id,
          role: 'admin',
          joinedAt: new Date(),
          permissions: {
            canInvite: true,
            canManage: true,
            canView: true,
            canEdit: true
          }
        }],
        settings: {
          isPublic: false,
          allowInvitations: true,
          defaultRole: 'viewer'
        },
        stats: {
          totalForms: 0,
          totalMembers: 1,
          totalResponses: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const workspaceResult = await db.collection('workspaces').insertOne(personalWorkspace);
      
      // Update user's forms to belong to personal workspace
      await db.collection('forms').updateMany(
        { userId: user._id, workspaceId: null },
        { $set: { workspaceId: workspaceResult.insertedId } }
      );
      
      // Update user's workspace list
      await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            workspaces: [workspaceResult.insertedId],
            'preferences.defaultWorkspace': workspaceResult.insertedId
          }
        }
      );
    }
    
    console.log(`Created personal workspaces for ${users.length} users`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback the migration
 */
export async function down(): Promise<void> {
  console.log('Rolling back migration: Add Workspace and Collaboration Features');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  try {
    // Remove workspace-related fields from forms
    await db.collection('forms').updateMany(
      {},
      {
        $unset: {
          workspaceId: 1,
          collaboration: 1,
          'sharing.workspaceSharing': 1
        }
      }
    );
    
    // Remove workspace-related fields from users
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          workspaces: 1,
          'preferences.defaultWorkspace': 1,
          'preferences.collaborationNotifications': 1
        }
      }
    );
    
    // Drop workspace-related collections
    try {
      await db.collection('workspaces').drop();
      await db.collection('workspaceinvitations').drop();
      await db.collection('workspaceactivities').drop();
      await db.collection('collaborationsessions').drop();
      await db.collection('formcomments').drop();
      console.log('Dropped workspace-related collections');
    } catch (dropError) {
      console.warn('Some collections may not exist:', dropError);
    }
    
    // Drop workspace-related indexes from forms
    try {
      await db.collection('forms').dropIndex('workspaceId_1');
      await db.collection('forms').dropIndex('collaboration.enabled_1');
    } catch (indexError) {
      console.warn('Some form indexes may not exist:', indexError);
    }
    
    console.log('Removed workspace and collaboration features');
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}