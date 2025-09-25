import { logger } from '../utils/logger.js';
import { User } from '../database/models.js';
import { BadgeEvaluationService } from '../services/badgeEvaluationService.js';
import { config } from '@h4c/shared/config';
import { withLock } from './lock.js';
import { sleep, retry } from '@h4c/shared/utils';
import { cache } from '@h4c/shared/cache';

const INTERVAL_MS = config.performance.autoAwards.bucketPeriodMin * 60 * 1000;

function bucketOf(discordId) {
  const n = BigInt('0x' + discordId.slice(-6));
  return Number(n % BigInt(config.performance.autoAwards.buckets));
}

/**
 * PERFORMANCE OPTIMIZED: Enhanced processing statistics with adaptive behavior
 */
class ProcessingStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalProcessed = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.badgesAwarded = 0;
    this.rolesUpdated = 0;
    this.startTime = Date.now();
    this.errors = [];
    this.performanceMetrics = {
      avgProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: Infinity
    };
  }

  recordSuccess(processingTime = 0, badgesAwarded = 0, rolesUpdated = false) {
    this.successCount++;
    this.totalProcessed++;
    this.badgesAwarded += badgesAwarded;
    if (rolesUpdated) this.rolesUpdated++;
    
    this.updatePerformanceMetrics(processingTime);
  }

  recordError(error, userId, processingTime = 0) {
    this.errorCount++;
    this.totalProcessed++;
    
    const errorInfo = {
      error: String(error),
      userId: userId ? userId.slice(0, 8) + '...' : 'unknown',
      timestamp: Date.now(),
      processingTime
    };
    
    this.errors.push(errorInfo);
    this.updatePerformanceMetrics(processingTime);
    
    // Keep only last 20 errors to prevent memory issues
    if (this.errors.length > 20) {
      this.errors.shift();
    }
  }
  
  updatePerformanceMetrics(processingTime) {
    if (processingTime > 0) {
      this.performanceMetrics.maxProcessingTime = Math.max(
        this.performanceMetrics.maxProcessingTime, 
        processingTime
      );
      this.performanceMetrics.minProcessingTime = Math.min(
        this.performanceMetrics.minProcessingTime, 
        processingTime
      );
      
      // Update rolling average
      const totalTime = this.performanceMetrics.avgProcessingTime * (this.totalProcessed - 1) + processingTime;
      this.performanceMetrics.avgProcessingTime = totalTime / this.totalProcessed;
    }
  }

  getSuccessRate() {
    return this.totalProcessed > 0 ? this.successCount / this.totalProcessed : 1;
  }

  getAdaptiveDelay() {
    const baseDelay = config.performance.autoAwards.scanSpacingMs;
    const successRate = this.getSuccessRate();
    
    // Adaptive delay based on success rate and performance
    if (successRate < 0.5) {
      return Math.min(baseDelay * 5, 10000); // Max 10 seconds on very high error rate
    } else if (successRate < 0.7) {
      return baseDelay * 3;
    } else if (successRate < 0.9) {
      return baseDelay * 1.5;
    } else if (this.performanceMetrics.avgProcessingTime > 5000) {
      return baseDelay * 2; // Slow down if processing is taking too long
    }
    
    return baseDelay;
  }

  getSummary() {
    const duration = Date.now() - this.startTime;
    const processingRate = this.totalProcessed / (duration / 1000);
    
    return {
      totalProcessed: this.totalProcessed,
      successCount: this.successCount,
      errorCount: this.errorCount,
      badgesAwarded: this.badgesAwarded,
      rolesUpdated: this.rolesUpdated,
      successRate: this.getSuccessRate(),
      durationMs: duration,
      processingRate: Number(processingRate.toFixed(2)), // users per second
      performance: {
        avgProcessingTime: Number(this.performanceMetrics.avgProcessingTime.toFixed(2)),
        maxProcessingTime: this.performanceMetrics.maxProcessingTime,
        minProcessingTime: this.performanceMetrics.minProcessingTime === Infinity 
          ? 0 : this.performanceMetrics.minProcessingTime
      },
      recentErrors: this.errors.slice(-5) // Last 5 errors for debugging
    };
  }
}

/**
 * PERFORMANCE OPTIMIZED: Batch processing with circuit breaker pattern
 */
async function scanBucket(client, bucketIndex) {
  const guildId = config.discord.guildId;
  const stats = new ProcessingStats();
  
  try {
    logger.info({ 
      bucket: bucketIndex,
      totalBuckets: config.performance.autoAwards.buckets,
      concurrency: config.performance.autoAwards.scanConcurrency
    }, 'Auto-awards scan starting');

    // OPTIMIZED: Use MongoDB aggregation with proper indexing
    const users = await User.aggregate([
      { 
        $match: { 
          walletAddress: { $exists: true, $ne: null }, 
          walletVerified: true 
        } 
      },
      { 
        $project: { 
          discordId: 1, 
          walletAddress: 1, 
          badges: 1,
          _id: 0 
        } 
      },
      { $limit: 50000 } // Reasonable limit to prevent memory issues
    ]).allowDiskUse(true);

    const bucketUsers = users.filter(user => bucketOf(user.discordId) === bucketIndex);

    logger.info({ 
      totalUsers: users.length,
      bucketUsers: bucketUsers.length,
      bucket: bucketIndex
    }, 'Auto-awards user filtering complete');

    if (bucketUsers.length === 0) {
      logger.info({ bucket: bucketIndex }, 'Auto-awards: no users in bucket');
      return stats.getSummary();
    }

    // OPTIMIZED: Dynamic batch sizing based on performance
    const optimalBatchSize = Math.min(
      config.performance.autoAwards.scanConcurrency,
      Math.max(2, Math.floor(bucketUsers.length / 10)) // Dynamic sizing
    );

    logger.debug({ 
      bucket: bucketIndex,
      optimalBatchSize,
      totalBatches: Math.ceil(bucketUsers.length / optimalBatchSize)
    }, 'Auto-awards batch processing configuration');

    // Process in optimized batches
    for (let i = 0; i < bucketUsers.length; i += optimalBatchSize) {
      const batch = bucketUsers.slice(i, i + optimalBatchSize);
      
      logger.debug({ 
        bucket: bucketIndex,
        batchIndex: Math.floor(i / optimalBatchSize) + 1,
        totalBatches: Math.ceil(bucketUsers.length / optimalBatchSize),
        batchSize: batch.length,
        progress: `${i + batch.length}/${bucketUsers.length}`
      }, 'Processing auto-awards batch');

      // RESILIENT: Process batch with individual error isolation
      const results = await Promise.allSettled(
        batch.map(user => processUserWithRetry(client, guildId, user, stats))
      );

      // Analyze batch results
      const batchSuccesses = results.filter(r => r.status === 'fulfilled').length;
      const batchFailures = results.filter(r => r.status === 'rejected').length;
      
      if (batchFailures > 0) {
        logger.warn({ 
          bucket: bucketIndex,
          batchSuccesses,
          batchFailures,
          successRate: (batchSuccesses / results.length * 100).toFixed(1) + '%'
        }, 'Auto-awards batch completed with some failures');
      }

      // ADAPTIVE: Dynamic delay based on performance and success rate
      const delay = stats.getAdaptiveDelay();
      if (delay > 0 && i + optimalBatchSize < bucketUsers.length) {
        logger.debug({ 
          bucket: bucketIndex, 
          delay, 
          successRate: (stats.getSuccessRate() * 100).toFixed(1) + '%',
          avgProcessingTime: stats.performanceMetrics.avgProcessingTime.toFixed(2) + 'ms'
        }, 'Auto-awards adaptive delay');
        await sleep(delay);
      }
    }

    const summary = stats.getSummary();
    
    logger.info({ 
      bucket: bucketIndex, 
      ...summary
    }, 'Auto-awards scan completed');

    // MONITORING: Alert on concerning patterns
    if (summary.errorCount > 0 && summary.successRate < 0.8) {
      logger.error({
        bucket: bucketIndex,
        ...summary,
        alertLevel: 'HIGH'
      }, 'Auto-awards: HIGH ERROR RATE DETECTED');
      
      // Cache the alert for monitoring dashboard
      await cache.set(
        `alerts:auto-awards:${bucketIndex}`,
        { ...summary, timestamp: Date.now(), alertLevel: 'HIGH' },
        3600 // 1 hour
      );
    }

    // Update processing statistics cache
    await cache.set(
      `stats:auto-awards:${bucketIndex}`,
      summary,
      900 // 15 minutes
    );

    return summary;

  } catch (error) {
    const summary = stats.getSummary();
    logger.error({ 
      error: String(error), 
      bucket: bucketIndex,
      ...summary
    }, 'Auto-awards scan failed');
    
    return { 
      ...summary, 
      scanFailed: true, 
      scanError: String(error),
      bucket: bucketIndex
    };
  }
}

/**
 * RESILIENT: Individual user processing with retry logic
 */
async function processUserWithRetry(client, guildId, user, stats) {
  const startTime = Date.now();
  
  try {
    const result = await retry(
      () => BadgeEvaluationService.evaluateAndAwardHodl(client, guildId, user.discordId),
      3, // max attempts
      1000 // base delay
    );
    
    const processingTime = Date.now() - startTime;
    const badgesAwarded = Array.isArray(result.awarded) ? result.awarded.length : 0;
    const rolesUpdated = result.rolesUpdated || false;
    
    stats.recordSuccess(processingTime, badgesAwarded, rolesUpdated);
    
    // Log significant badge awards
    if (badgesAwarded > 0) {
      logger.info({ 
        discordId: user.discordId.slice(0, 8) + '...',
        awarded: result.awarded,
        processingTime
      }, 'Auto-awards badges awarded');
    }
    
    return result;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    stats.recordError(error, user.discordId, processingTime);
    
    logger.warn({ 
      error: String(error), 
      user: user.discordId.slice(0, 8) + '...',
      processingTime,
      walletAddress: user.walletAddress ? user.walletAddress.slice(0, 8) + '...' : 'none'
    }, 'Auto-awards user processing failed');
    
    throw error; // Re-throw for Promise.allSettled
  }
}

/**
 * Main auto-awards execution function with distributed locking
 */
export async function runAutoAwards(client) {
  const minute = Math.floor(Date.now() / 60000);
  const bucketIndex = minute % config.performance.autoAwards.buckets;
  
  try {
    const result = await withLock(
      'locks:autoAwards', 
      INTERVAL_MS - 1000, 
      () => scanBucket(client, bucketIndex)
    );
    
    if (result.skipped) {
      logger.debug({ bucket: bucketIndex }, 'Auto-awards skipped (lock held by another process)');
    }
    
    return result;
    
  } catch (error) {
    logger.error({ 
      error: String(error), 
      bucket: bucketIndex 
    }, 'Auto-awards lock operation failed');
    
    return { 
      error: String(error), 
      bucket: bucketIndex, 
      lockFailed: true 
    };
  }
}

/**
 * ENHANCED: Timer management with health monitoring
 */
let timer = null;
let isRunning = false;
let runCount = 0;
let lastRunTime = null;

export function startAutoAwards(client) {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Auto-awards timer cleared for restart');
  }

  // RESILIENT: Wrapper to prevent overlapping executions
  const safeExecuteAutoAwards = async () => {
    if (isRunning) {
      logger.warn('Auto-awards already running, skipping this cycle');
      return;
    }

    isRunning = true;
    runCount++;
    lastRunTime = Date.now();
    
    try {
      logger.debug({ runCount }, 'Auto-awards cycle starting');
      const result = await runAutoAwards(client);
      
      if (result && !result.skipped) {
        logger.debug({ 
          runCount,
          duration: Date.now() - lastRunTime,
          ...result
        }, 'Auto-awards cycle completed');
      }
      
    } catch (error) {
      logger.error({ 
        error: String(error),
        runCount,
        duration: Date.now() - lastRunTime
      }, 'Auto-awards cycle failed');
    } finally {
      isRunning = false;
    }
  };

  // Start the interval timer
  timer = setInterval(safeExecuteAutoAwards, INTERVAL_MS);
  
  // Initial delayed run to avoid startup conflicts
  setTimeout(safeExecuteAutoAwards, 30_000); // 30 second delay
  
  logger.info({ 
    intervalMs: INTERVAL_MS,
    intervalMinutes: INTERVAL_MS / 60000,
    buckets: config.performance.autoAwards.buckets,
    concurrency: config.performance.autoAwards.scanConcurrency,
    initialDelayMs: 30000
  }, 'Auto-awards scheduler started');

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      logger.info({ 
        totalRuns: runCount,
        lastRunTime: lastRunTime ? new Date(lastRunTime).toISOString() : null
      }, 'Auto-awards scheduler stopped');
    }
  };
}
