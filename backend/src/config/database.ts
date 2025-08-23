import mongoose, { Connection } from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri: string = process.env.MONGODB_URI || '';
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    const conn: typeof mongoose = await mongoose.connect(mongoUri, {
      // Note: useNewUrlParser and useUnifiedTopology are deprecated in Mongoose 6+
      // They are included here for backward compatibility if using older versions
    });

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
    console.log(`🗄️  Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err: Error) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n${signal} received. Closing MongoDB connection...`);
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error: any) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    
    // Log additional connection details for debugging
    if (error.name === 'MongooseServerSelectionError') {
      console.error('💡 Possible solutions:');
      console.error('  - Check if MongoDB is running');
      console.error('  - Verify MONGODB_URI in environment variables');
      console.error('  - Check network connectivity');
      console.error('  - Verify MongoDB Atlas whitelist (if using Atlas)');
    }
    
    process.exit(1);
  }
};

// Export database connection status helper
export const getDatabaseStatus = (): {
  isConnected: boolean;
  readyState: number;
  host?: string;
  name?: string;
} => {
  const connection: Connection = mongoose.connection;
  return {
    isConnected: connection.readyState === 1,
    readyState: connection.readyState,
    host: connection.host,
    name: connection.name,
  };
};

// Export connection instance for advanced usage
export const mongooseConnection = mongoose.connection;

export default connectDB;