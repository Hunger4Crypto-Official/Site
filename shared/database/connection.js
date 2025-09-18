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
