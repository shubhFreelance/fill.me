import mongoose, { Schema, Document } from 'mongoose';

/**
 * Migration Document Interface
 */
export interface IMigration extends Document {
  name: string;
  batch: number;
  executedAt: Date;
  rollbackScript?: string;
  checksum: string;
}

/**
 * Migration Schema
 */
const MigrationSchema = new Schema<IMigration>({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  batch: {
    type: Number,
    required: true,
    index: true
  },
  executedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  rollbackScript: {
    type: String,
    default: null
  },
  checksum: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'migrations'
});

/**
 * Migration Model
 */
export default mongoose.model<IMigration>('Migration', MigrationSchema);