# Database Migration System

This document describes the database migration system for Fill.me, which provides a robust way to manage database schema changes and data transformations.

## Overview

The migration system includes:
- **Migration tracking**: Keeps track of executed migrations
- **Rollback support**: Ability to revert migrations
- **Integrity validation**: Ensures migration files haven't been tampered with
- **CLI tools**: Command-line interface for migration management
- **Batch execution**: Groups migrations for easier rollback

## Quick Start

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration batch
npm run migrate:rollback

# Rollback multiple batches
npm run migrate:rollback -- --steps 3
```

### Creating New Migrations

```bash
# Generate a new migration file
npm run migrate:generate "add_user_preferences" -- --description "Add user preference settings"

# This creates a timestamped file: src/migrations/20250115120000_add_user_preferences.ts
```

## Migration File Structure

Migration files follow this pattern:

```typescript
/**
 * Migration: [Name]
 * Description: [Description]
 * Created: [ISO Date]
 */

export const description = 'Migration description';

/**
 * Run the migration
 */
export async function up(): Promise<void> {
  console.log('Running migration: [Name]');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  // Add your migration logic here
  await db.collection('users').updateMany({}, { $set: { newField: null } });
}

/**
 * Rollback the migration
 */
export async function down(): Promise<void> {
  console.log('Rolling back migration: [Name]');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  // Add your rollback logic here
  await db.collection('users').updateMany({}, { $unset: { newField: 1 } });
}
```

## Available Commands

### `npm run migrate`
Runs all pending migrations in sequence. Migrations are executed in a transaction to ensure consistency.

### `npm run migrate:status`
Shows the current migration status:
- Total migrations available
- Number of executed migrations
- Number of pending migrations
- Migration integrity status

### `npm run migrate:rollback`
Rolls back the last migration batch. Use `--steps` to specify multiple batches:
```bash
npm run migrate:rollback -- --steps 2
```

### `npm run migrate:generate <name>`
Creates a new migration file with the specified name:
```bash
npm run migrate:generate "add_workspace_features" -- --description "Add workspace collaboration features"
```

### `npm run migrate:validate`
Validates migration integrity by checking if migration files have been modified after execution.

### `npm run migrate:reset` (Development Only)
Resets the migration history. **Only works in development mode.**

## Migration Best Practices

### 1. **Always Include Rollback Logic**
Every migration should have a corresponding `down()` function that can revert the changes:

```typescript
export async function up(): Promise<void> {
  await db.collection('users').updateMany({}, { $set: { newField: 'default' } });
}

export async function down(): Promise<void> {
  await db.collection('users').updateMany({}, { $unset: { newField: 1 } });
}
```

### 2. **Use Descriptive Names**
Migration names should clearly describe what they do:
- ✅ `add_user_subscription_fields`
- ✅ `create_workspace_collections`
- ❌ `update_users`
- ❌ `migration_1`

### 3. **Handle Existing Data**
When adding new fields, use `$ifNull` to avoid overwriting existing data:

```typescript
await db.collection('users').updateMany(
  {},
  {
    $set: {
      newField: { $ifNull: ['$newField', 'defaultValue'] }
    }
  }
);
```

### 4. **Create Indexes**
Don't forget to create necessary indexes for new fields:

```typescript
await db.collection('users').createIndex({ newField: 1 });
```

### 5. **Test Both Directions**
Always test both the `up()` and `down()` migrations to ensure they work correctly.

### 6. **Use Transactions for Complex Operations**
For complex migrations affecting multiple collections, use transactions:

```typescript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    await db.collection('collection1').updateMany({}, { ... }, { session });
    await db.collection('collection2').updateMany({}, { ... }, { session });
  });
} finally {
  await session.endSession();
}
```

## Migration Tracking

The system uses a `migrations` collection to track executed migrations:

```javascript
{
  _id: ObjectId,
  name: "20250115000000_add_user_features",
  batch: 1,
  executedAt: ISODate,
  checksum: "sha256_hash_of_migration_content"
}
```

### Batch System
Migrations executed together get the same batch number, making rollbacks more predictable.

### Integrity Checking
Each migration file gets a checksum to detect unauthorized modifications.

## Available Migrations

The system includes several predefined migrations:

### 1. `20250115000000_add_user_api_keys_subscription.ts`
- Adds API key management to users
- Adds subscription and billing features
- Adds user preferences and usage tracking

### 2. `20250115000100_add_advanced_form_features.ts`
- Adds conditional logic support to forms
- Adds advanced customization options
- Adds notification and analytics settings
- Adds SEO and privacy controls

### 3. `20250115000200_add_workspace_collaboration.ts`
- Creates workspace collections
- Adds collaboration features to forms
- Creates personal workspaces for existing users
- Adds activity tracking

### 4. `20250115000300_add_integration_features.ts`
- Creates integration collections
- Adds webhook and third-party service support
- Adds integration templates
- Adds webhook logging

## Troubleshooting

### Migration Failed
If a migration fails:
1. Check the error message for details
2. Fix the issue in the migration file
3. Run `npm run migrate:rollback` if needed
4. Update the migration and run again

### Integrity Check Failed
If integrity validation fails:
1. Check if migration files were modified after execution
2. Use `npm run migrate:validate` to see which files have issues
3. In development, you can use `npm run migrate:reset` to clear history

### Database Connection Issues
Ensure your MongoDB connection string is correct in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/fillme
```

## Environment Variables

Required environment variables:
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (production/development)

## Security Considerations

1. **Production Safety**: The reset command is disabled in production
2. **Backup First**: Always backup your database before running migrations in production
3. **Test Thoroughly**: Test all migrations in development/staging first
4. **Access Control**: Limit who can run migrations in production

## Examples

### Adding a New Field to Users

```typescript
export async function up(): Promise<void> {
  const db = mongoose.connection.db;
  
  await db.collection('users').updateMany(
    {},
    {
      $set: {
        'profile.avatar': { $ifNull: ['$profile.avatar', null] },
        'profile.bio': { $ifNull: ['$profile.bio', ''] }
      }
    }
  );
  
  // Create index for searching
  await db.collection('users').createIndex({ 'profile.bio': 'text' });
}

export async function down(): Promise<void> {
  const db = mongoose.connection.db;
  
  await db.collection('users').updateMany(
    {},
    {
      $unset: {
        'profile.avatar': 1,
        'profile.bio': 1
      }
    }
  );
  
  await db.collection('users').dropIndex({ 'profile.bio': 'text' });
}
```

### Creating a New Collection

```typescript
export async function up(): Promise<void> {
  const db = mongoose.connection.db;
  
  // Create collection with validation
  await db.createCollection('notifications', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'type', 'message'],
        properties: {
          userId: { bsonType: 'objectId' },
          type: { bsonType: 'string' },
          message: { bsonType: 'string' },
          read: { bsonType: 'bool' }
        }
      }
    }
  });
  
  // Create indexes
  await db.collection('notifications').createIndex({ userId: 1 });
  await db.collection('notifications').createIndex({ createdAt: -1 });
  await db.collection('notifications').createIndex({ read: 1 });
}

export async function down(): Promise<void> {
  const db = mongoose.connection.db;
  
  await db.collection('notifications').drop();
}
```

This migration system provides a robust foundation for managing database changes throughout the application lifecycle.