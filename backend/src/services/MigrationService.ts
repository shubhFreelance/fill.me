import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Migration, { IMigration } from '../models/Migration';

/**
 * Migration Interface
 */
export interface IMigrationScript {
  name: string;
  description: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
  checksum?: string;
}

/**
 * Migration Service
 * Handles database migrations with version control and rollback capabilities
 */
export class MigrationService {
  private migrationsPath: string;
  private migrations: IMigrationScript[] = [];

  constructor(migrationsPath: string = path.join(__dirname, '../migrations')) {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Load all migration files
   */
  async loadMigrations(): Promise<void> {
    try {
      // Ensure migrations directory exists
      if (!fs.existsSync(this.migrationsPath)) {
        fs.mkdirSync(this.migrationsPath, { recursive: true });
        console.log(`Created migrations directory: ${this.migrationsPath}`);
        return;
      }

      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
        .sort();

      this.migrations = [];

      for (const file of files) {
        const filePath = path.join(this.migrationsPath, file);
        const migration = await import(filePath);
        
        const migrationName = path.basename(file, path.extname(file));
        const migrationScript: IMigrationScript = {
          name: migrationName,
          description: migration.description || 'No description',
          up: migration.up,
          down: migration.down,
          checksum: this.calculateChecksum(fs.readFileSync(filePath, 'utf8'))
        };

        this.migrations.push(migrationScript);
      }

      console.log(`Loaded ${this.migrations.length} migration(s)`);
    } catch (error) {
      console.error('Error loading migrations:', error);
      throw error;
    }
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations(): Promise<IMigration[]> {
    try {
      return await Migration.find({}).sort({ batch: 1, executedAt: 1 });
    } catch (error) {
      console.error('Error fetching executed migrations:', error);
      throw error;
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<IMigrationScript[]> {
    const executed = await this.getExecutedMigrations();
    const executedNames = executed.map(m => m.name);
    
    return this.migrations.filter(m => !executedNames.includes(m.name));
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('No pending migrations to run');
      return;
    }

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const currentBatch = await this.getNextBatchNumber();
        
        for (const migration of pending) {
          console.log(`Running migration: ${migration.name}`);
          
          try {
            // Execute the migration
            await migration.up();
            
            // Record the migration
            const migrationRecord = new Migration({
              name: migration.name,
              batch: currentBatch,
              checksum: migration.checksum || this.calculateChecksum(migration.up.toString())
            });
            
            await migrationRecord.save({ session });
            
            console.log(`✓ Migration completed: ${migration.name}`);
          } catch (error) {
            console.error(`✗ Migration failed: ${migration.name}`, error);
            throw error;
          }
        }
        
        console.log(`Successfully ran ${pending.length} migration(s) in batch ${currentBatch}`);
      });
    } catch (error) {
      console.error('Migration transaction failed:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Rollback migrations
   */
  async rollbackMigrations(steps: number = 1): Promise<void> {
    const executed = await this.getExecutedMigrations();
    
    if (executed.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    // Get the last batch(es) to rollback
    const lastBatch = executed[executed.length - 1].batch;
    const targetBatch = Math.max(1, lastBatch - steps + 1);
    
    const migrationsToRollback = executed
      .filter(m => m.batch >= targetBatch)
      .reverse(); // Rollback in reverse order

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        for (const migrationRecord of migrationsToRollback) {
          const migration = this.migrations.find(m => m.name === migrationRecord.name);
          
          if (!migration || !migration.down) {
            console.warn(`⚠ No rollback script for migration: ${migrationRecord.name}`);
            continue;
          }
          
          console.log(`Rolling back migration: ${migrationRecord.name}`);
          
          try {
            // Execute rollback
            await migration.down();
            
            // Remove migration record
            await Migration.deleteOne({ _id: migrationRecord._id }, { session });
            
            console.log(`✓ Rollback completed: ${migrationRecord.name}`);
          } catch (error) {
            console.error(`✗ Rollback failed: ${migrationRecord.name}`, error);
            throw error;
          }
        }
        
        console.log(`Successfully rolled back ${migrationsToRollback.length} migration(s)`);
      });
    } catch (error) {
      console.error('Rollback transaction failed:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    executed: IMigration[];
    pending: IMigrationScript[];
    total: number;
  }> {
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      executed,
      pending,
      total: this.migrations.length
    };
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<boolean> {
    const executed = await this.getExecutedMigrations();
    let isValid = true;
    
    for (const executedMigration of executed) {
      const migration = this.migrations.find(m => m.name === executedMigration.name);
      
      if (!migration) {
        console.error(`⚠ Migration file missing: ${executedMigration.name}`);
        isValid = false;
        continue;
      }
      
      const currentChecksum = migration.checksum || this.calculateChecksum(migration.up.toString());
      
      if (currentChecksum !== executedMigration.checksum) {
        console.error(`⚠ Migration checksum mismatch: ${executedMigration.name}`);
        isValid = false;
      }
    }
    
    return isValid;
  }

  /**
   * Generate migration file template
   */
  generateMigrationFile(name: string, description: string = ''): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const fileName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.ts`;
    
    const template = `/**
 * Migration: ${name}
 * Description: ${description}
 * Created: ${new Date().toISOString()}
 */

export const description = '${description}';

/**
 * Run the migration
 */
export async function up(): Promise<void> {
  // Add your migration logic here
  console.log('Running migration: ${name}');
  
  // Example: Add new field to collection
  // await db.collection('users').updateMany({}, { $set: { newField: null } });
  
  // Example: Create new index
  // await db.collection('forms').createIndex({ 'fields.type': 1 });
  
  // Example: Data transformation
  // const users = await db.collection('users').find({}).toArray();
  // for (const user of users) {
  //   await db.collection('users').updateOne(
  //     { _id: user._id },
  //     { $set: { transformedField: transformData(user.oldField) } }
  //   );
  // }
}

/**
 * Rollback the migration
 */
export async function down(): Promise<void> {
  // Add your rollback logic here
  console.log('Rolling back migration: ${name}');
  
  // Example: Remove field from collection
  // await db.collection('users').updateMany({}, { $unset: { newField: 1 } });
  
  // Example: Drop index
  // await db.collection('forms').dropIndex({ 'fields.type': 1 });
}
`;
    
    const filePath = path.join(this.migrationsPath, fileName);
    fs.writeFileSync(filePath, template);
    
    console.log(`Migration file created: ${filePath}`);
    return filePath;
  }

  /**
   * Calculate checksum for content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get next batch number
   */
  private async getNextBatchNumber(): Promise<number> {
    const lastMigration = await Migration.findOne({}).sort({ batch: -1 });
    return lastMigration ? lastMigration.batch + 1 : 1;
  }

  /**
   * Reset migrations (dangerous - use only in development)
   */
  async resetMigrations(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot reset migrations in production environment');
    }
    
    console.warn('⚠ Resetting all migrations - this will clear migration history');
    await Migration.deleteMany({});
    console.log('✓ Migration history cleared');
  }
}

export default MigrationService;