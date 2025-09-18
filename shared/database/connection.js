import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { mongoCircuitBreaker } from '../resilience/CircuitBreaker.js';

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }
  
  async connect() {
    const options = {
      // Connection pool settings
      maxPoolSize: config.mongodb.poolSize,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: config.mongodb.timeout,
      socketTimeoutMS: 45000,
      
      // Reliability settings
      bufferMaxEntries: 0,
      bufferCommands: false,
      
      // Monitoring
      heartbeatFrequencyMS: 10000,
      
      // Performance
      maxConnecting: 2,
      maxStalenessSeconds: 90,
      
      // Security
      authSource: 'admin'
    };
    
    try {
      await mongoCircuitBreaker.execute(async () => {
        await mongoose.connect(config.mongodb.uri, options);
      });
      
      this.setupEventHandlers();
      this.isConnected = true
this.connectionRetries = 0;
      logger.info({ 
        poolSize: config.mongodb.poolSize,
        timeout: config.mongodb.timeout 
      }, 'MongoDB connected successfully');
      
    } catch (error) {
      this.connectionRetries++;
      logger.error({ 
        error: error.message, 
        retries: this.connectionRetries,
        maxRetries: this.maxRetries 
      }, 'MongoDB connection failed');
      
      if (this.connectionRetries < this.maxRetries) {
        logger.info({ delay: this.retryDelay }, 'Retrying MongoDB connection');
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }
      
      throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts`);
    }
  }
  
  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('MongoDB connection established');
    });
    
    mongoose.connection.on('error', (error) => {
      this.isConnected = false;
      logger.error({ error: error.message }, 'MongoDB connection error');
    });
    
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
      logger.info('MongoDB reconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }
  
  async gracefulShutdown() {
    logger.info('Closing MongoDB connection...');
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error({ error: error.message }, 'Error closing MongoDB connection');
    }
  }
  
  async healthCheck() {
    try {
      await mongoCircuitBreaker.execute(async () => {
        await mongoose.connection.db.admin().ping();
      });
      
      const stats = mongoose.connection.db.stats ? await mongoose.connection.db.stats() : {};
      
      return {
        healthy: this.isConnected && mongoose.connection.readyState === 1,
        state: this.getReadyStateString(mongoose.connection.readyState),
        poolSize: config.mongodb.poolSize,
        stats: {
          collections: stats.collections || 'unknown',
          dataSize: stats.dataSize || 'unknown',
          indexSize: stats.indexSize || 'unknown'
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        state: this.getReadyStateString(mongoose.connection.readyState)
      };
    }
  }
  
  getReadyStateString(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[state] || 'unknown';
  }
}

export const databaseConnection = new DatabaseConnection();
export const connectDatabase = () => databaseConnection.connect();
export const getDatabaseHealth = () => databaseConnection.healthCheck();
