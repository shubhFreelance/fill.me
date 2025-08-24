#!/usr/bin/env node

/**
 * Migration CLI Tool
 * Command-line interface for managing database migrations
 */

import { program } from 'commander';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MigrationService from '../services/MigrationService';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fillme';
const MIGRATIONS_PATH = path.join(__dirname, '../migrations');

/**
 * Connect to database
 */
async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

/**
 * Disconnect from database
 */
async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('✗ Failed to disconnect from MongoDB:', error);
  }
}

/**
 * Run migrations command
 */
async function runMigrations(): Promise<void> {
  console.log('🚀 Running database migrations...\n');
  
  const migrationService = new MigrationService(MIGRATIONS_PATH);
  
  try {
    await migrationService.loadMigrations();
    
    const status = await migrationService.getStatus();
    
    if (status.pending.length === 0) {
      console.log('✓ No pending migrations to run');
      return;
    }
    
    console.log(`Found ${status.pending.length} pending migration(s):`);
    status.pending.forEach((migration, index) => {
      console.log(`  ${index + 1}. ${migration.name} - ${migration.description}`);
    });
    console.log();
    
    await migrationService.runMigrations();
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Rollback migrations command
 */
async function rollbackMigrations(options: { steps?: string }): Promise<void> {
  const steps = parseInt(options.steps || '1', 10);
  console.log(`🔄 Rolling back ${steps} migration batch(es)...\n`);
  
  const migrationService = new MigrationService(MIGRATIONS_PATH);
  
  try {
    await migrationService.loadMigrations();
    
    const status = await migrationService.getStatus();
    
    if (status.executed.length === 0) {
      console.log('✓ No migrations to rollback');
      return;
    }
    
    console.log(`Found ${status.executed.length} executed migration(s)`);
    console.log(`Rolling back ${steps} batch(es)...\n`);
    
    await migrationService.rollbackMigrations(steps);
    
    console.log('\n✅ Rollback completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  }
}

/**
 * Show migration status
 */
async function showStatus(): Promise<void> {
  console.log('📊 Migration Status\n');
  
  const migrationService = new MigrationService(MIGRATIONS_PATH);
  
  try {
    await migrationService.loadMigrations();
    
    const status = await migrationService.getStatus();
    const isValid = await migrationService.validateMigrations();
    
    console.log(`Total migrations: ${status.total}`);
    console.log(`Executed: ${status.executed.length}`);
    console.log(`Pending: ${status.pending.length}`);
    console.log(`Integrity: ${isValid ? '✓ Valid' : '⚠ Issues detected'}\n`);
    
    if (status.executed.length > 0) {
      console.log('📝 Executed Migrations:');
      status.executed.forEach((migration) => {
        console.log(`  ✓ ${migration.name} (batch ${migration.batch}) - ${migration.executedAt.toISOString()}`);
      });
      console.log();
    }
    
    if (status.pending.length > 0) {
      console.log('⏳ Pending Migrations:');
      status.pending.forEach((migration) => {
        console.log(`  • ${migration.name} - ${migration.description}`);
      });
      console.log();
    }
    
    if (!isValid) {
      console.log('⚠ Migration integrity issues detected. Some migration files may have been modified.');
    }
    
  } catch (error) {
    console.error('❌ Failed to get migration status:', error);
    process.exit(1);
  }
}

/**
 * Generate new migration file
 */
async function generateMigration(name: string, options: { description?: string }): Promise<void> {
  console.log(`📝 Generating migration: ${name}\n`);
  
  const migrationService = new MigrationService(MIGRATIONS_PATH);
  
  try {
    const filePath = migrationService.generateMigrationFile(
      name,
      options.description || `Migration: ${name}`
    );
    
    console.log(`✅ Migration file created: ${filePath}`);
    console.log('\nNext steps:');
    console.log('1. Edit the migration file to add your migration logic');
    console.log('2. Run migrations with: npm run migrate');
    
  } catch (error) {
    console.error('❌ Failed to generate migration:', error);
    process.exit(1);
  }
}

/**
 * Reset migrations (development only)
 */
async function resetMigrations(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot reset migrations in production environment');
    process.exit(1);
  }
  
  console.log('🚨 Resetting all migrations (development only)...\n');
  
  const migrationService = new MigrationService(MIGRATIONS_PATH);
  
  try {
    await migrationService.resetMigrations();
    console.log('✅ Migration history reset successfully!');
    console.log('\n⚠ Warning: This only clears migration history, not actual data changes.');
    console.log('You may need to manually revert database changes if necessary.');
    
  } catch (error) {
    console.error('❌ Failed to reset migrations:', error);
    process.exit(1);
  }
}

/**
 * Validate migrations
 */
async function validateMigrations(): Promise<void> {
  console.log('🔍 Validating migrations...\n');
  
  const migrationService = new MigrationService(MIGRATIONS_PATH);
  
  try {
    await migrationService.loadMigrations();
    
    const isValid = await migrationService.validateMigrations();
    
    if (isValid) {
      console.log('✅ All migrations are valid!');
    } else {
      console.log('❌ Migration validation failed!');
      console.log('Some migration files may have been modified after execution.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

/**
 * Setup CLI commands
 */
program
  .name('migrate')
  .description('Database migration tool for Fill.me')
  .version('1.0.0');

program
  .command('run')
  .description('Run all pending migrations')
  .action(async () => {
    await connectDatabase();
    await runMigrations();
    await disconnectDatabase();
  });

program
  .command('rollback')
  .description('Rollback migrations')
  .option('-s, --steps <number>', 'Number of migration batches to rollback', '1')
  .action(async (options) => {
    await connectDatabase();
    await rollbackMigrations(options);
    await disconnectDatabase();
  });

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    await connectDatabase();
    await showStatus();
    await disconnectDatabase();
  });

program
  .command('generate <name>')
  .description('Generate a new migration file')
  .option('-d, --description <description>', 'Migration description')
  .action(async (name, options) => {
    await generateMigration(name, options);
  });

program
  .command('reset')
  .description('Reset migration history (development only)')
  .action(async () => {
    await connectDatabase();
    await resetMigrations();
    await disconnectDatabase();
  });

program
  .command('validate')
  .description('Validate migration integrity')
  .action(async () => {
    await connectDatabase();
    await validateMigrations();
    await disconnectDatabase();
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}