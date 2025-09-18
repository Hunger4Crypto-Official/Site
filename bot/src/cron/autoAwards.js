import { logger } from '../utils/logger.js';
import { User } from '../database/models.js';
import { BadgeEvaluationService } from '../services/badgeEvaluationService.js';
import { Env } from '../utils/envGuard.js';
import { withLock } from './lock.js';

const INTERVAL_MS = Env.BUCKET_PERIOD_MIN * 60 * 1000;

function bucketOf(discordId) {
  const n = BigInt('0x' + discordId.slice(-6));
  return Number(n % BigInt(Env.BUCKETS));
}

// FIXED: Enhanced error tracking and adaptive processing
class ProcessingStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalProcessed = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
    this.errors = [];
  }

  recordSuccess() {
    this.successCount++;
    this.totalProcessed++;
  }

  recordError(error, userId) {
    this.errorCount++;
    this.totalProcessed++;
    this.errors.push({ error: String(error), userId, timestamp: Date.now() });
    
    // Keep only last 10 errors
    if (this.errors.length > 10) {
      this.errors.shift();
    }
  }

  getSuccessRate() {
    return this.totalProcessed > 0 ? this.successCount / this.totalProcessed : 1;
  }

  getAdaptiveDelay() {
    const baseDelay = Env.SCAN_SPACING_MS;
    const successRate = this.getSuccessRate();
    
    // Increase delay if error rate is high
    if (successRate < 0.7) {
      return Math.min(baseDelay * 3, 5000); // Max 5 seconds
    } else if (successRate < 0.9) {
      return baseDelay * 1.5;
    }
    
    return baseDelay;
  }

  getSummary() {
    const duration = Date.now() - this.startTime;
    return {
      totalProcessed: this.totalProcessed,
      successCount: this.successCount,
      errorCount: this.errorCount,
      successRate: this.getSuccessRate(),
      durationMs: duration,
      processingRate: this.totalProcessed / (duration / 1000), // per second
      recentErrors: this.errors.slice(-3) // Last 3 errors
    };
  }
}

// FIXED: Improved batch processing with better error handling
async function scanBucket(client, k) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const stats = new ProcessingStats();
  
  try {
    // FIXED: Add query optimization with lean() and select only needed fields
    const users = await User.find({ 
      walletAddress: { $exists: true }, 
      walletVerified: true 
    })
    .select('discordId walletAddress')
    .lean()
    .exec();

    const slice = users.filter(u => bucketOf(u.discordId) === k);

    logger.info({ 
      total: users.length, 
      bucket: k, 
      slice: slice.length,
      concurrency: Env.SCAN_CONCURRENCY
    }, 'Auto-awards: scan start');

    if (slice.length === 0) {
      logger.info({ bucket: k }, 'Auto-awards: no users in bucket');
      return stats.getSummary();
    }

    // FIXED: Process in batches with Promise.allSettled for better error isolation
    for (let i = 0; i < slice.length; i += Env.SCAN_CONCURRENCY) {
      const batch = slice.slice(i, i + Env.SCAN_CONCURRENCY);
      
      logger.debug({ 
        bucket: k, 
        batchStart: i, 
        batchSize: batch.length,
        progress: `${i + batch.length}/${slice.length}`
      }, 'Processing batch');

      // Process batch with Promise.allSettled to handle individual failures
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          try {
            const result = await BadgeEvaluationService.evaluateAndAwardHodl(
              client, 
              guildId, 
              user.discordId
            );
            
            stats.recordSuccess();
            
            // Log if badges were awarded
            if (result.awarded && result.awarded.length > 0) {
              logger.info({ 
                discordId: user.discordId, 
                awarded: result.awarded,
                bucket: k
              }, 'Badges awarded in auto-scan');
            }
            
            return result;
          } catch (error) {
            stats.recordError(error, user.discordId);
            logger.warn({ 
              error: String(error), 
              user: user.discordId,
              bucket: k
            }, 'Auto-awards: evaluate failed');
            throw error; // Re-throw for Promise.allSettled
          }
        })
      );

      // Log batch results
      const batchSuccess = results.filter(r => r.status === 'fulfilled').length;
      const batchFailures = results.filter(r => r.status === 'rejected').length;
      
      if (batchFailures > 0) {
        logger.warn({ 
          bucket: k,
          batchSuccess,
          batchFailures,
          successRate: batchSuccess / results.length
        }, 'Batch completed with some failures');
      }

      // FIXED: Adaptive delay based on success rate
      const delay = stats.getAdaptiveDelay();
      if (delay > 0 && i + Env.SCAN_CONCURRENCY < slice.length) {
        logger.debug({ bucket: k, delay, successRate: stats.getSuccessRate() }, 'Adaptive delay');
        await new Promise(r => setTimeout(r, delay));
      }
    }

    const summary = stats.getSummary();
    logger.info({ 
      bucket: k, 
      ...summary
    }, 'Auto-awards: scan complete');

    // FIXED: Alert on high error rates
    if (summary.errorCount > 0 && summary.successRate < 0.8) {
      logger.error({
        bucket: k,
        ...summary
      }, 'Auto-awards: HIGH ERROR RATE DETECTED');
      
      // TODO: Send alert to monitoring system
      // await sendAlert('auto-awards-high-error-rate', summary);
    }

    return summary;

  } catch (error) {
    logger.error({ 
      error: String(error), 
      bucket: k,
      summary: stats.getSummary()
    }, 'Auto-awards: scan failed');
    
    return { 
      ...stats.getSummary(), 
      scanFailed: true, 
      scanError: String(error) 
    };
  }
}

export async function runAutoAwards(client) {
  const minute = Math.floor(Date.now() / 60000);
  const k = minute % Env.BUCKETS;
  
  try {
    const result = await withLock('locks:autoAwards', INTERVAL_MS - 1000, () => scanBucket(client, k));
    
    if (result.skipped) {
      logger.debug({ bucket: k }, 'Auto-awards: skipped (lock held)');
    }
    
    return result;
  } catch (error) {
    logger.error({ error: String(error), bucket: k }, 'Auto-awards: lock operation failed');
    return { error: String(error), bucket: k };
  }
}

let timer = null;
let isRunning = false;

// FIXED: Better timer management with overlap protection
export function startAutoAwards(client) {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  // FIXED: Prevent overlapping executions
  const wrappedRun = async () => {
    if (isRunning) {
      logger.warn('Auto-awards: skipping run (previous still running)');
      return;
    }

    isRunning = true;
    try {
      await runAutoAwards(client);
    } catch (error) {
      logger.error({ error: String(error) }, 'Auto-awards: unhandled error');
    } finally {
      isRunning = false;
    }
  };

  timer = setInterval(wrappedRun, INTERVAL_MS);
  
  // Initial run after startup delay
  setTimeout(wrappedRun, 10_000);
  
  logger.info({ 
    intervalMs: INTERVAL_MS, 
    buckets: Env.BUCKETS,
    concurrency: Env.SCAN_CONCURRENCY
  }, 'Auto-awards: started');

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    logger.info('Auto-awards: stopped');
  };
}
