import { logger } from '../utils/logger.js';
import { ServiceUnavailableError } from '../errors/AppError.js';

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.monitoringPeriodMs = options.monitoringPeriodMs || 60000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.halfOpenCalls = 0;
    
    // Statistics
    this.stats = {
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastStateChange: Date.now()
    };
    
    logger.info({ name, options }, 'Circuit breaker initialized');
  }
  
  async execute(operation, fallback = null) {
    this.stats.totalCalls++;
    
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        logger.debug({ name: this.name }, 'Circuit breaker OPEN, using fallback');
        return this.handleOpenState(fallback);
      }
      
      // Transition to HALF_OPEN
      this.state = 'HALF_OPEN';
      this.halfOpenCalls = 0;
      this.stats.lastStateChange = Date.now();
      logger.info({ name: this.name }, 'Circuit breaker transitioning to HALF_OPEN');
    }
    
    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        logger.debug({ name: this.name }, 'Circuit breaker HALF_OPEN limit reached');
        return this.handleOpenState(fallback);
      }
      this.halfOpenCalls++;
    }
    
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.onSuccess(duration);
      return result;
      
    } catch (error) {
      this.onFailure(error);
      
      if (this.state === 'OPEN' && fallback) {
        logger.warn({ name: this.name, error: error.message }, 'Circuit breaker opened, using fallback');
        return await this.executeFallback(fallback);
      }
      
      throw error;
    }
  }
  
  onSuccess(duration = 0) {
    this.failureCount = 0;
    this.successCount++;
    this.stats.totalSuccesses++;
    
    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        // Enough successful calls in HALF_OPEN, close the circuit
        this.state = 'CLOSED';
        this.stats.lastStateChange = Date.now();
        logger.info({ 
          name: this.name, 
          duration,
          callsInHalfOpen: this.halfOpenCalls 
        }, 'Circuit breaker recovered, closing');
      }
    }
    
    logger.debug({ 
      name: this.name, 
      state: this.state, 
      duration,
      successCount: this.successCount 
    }, 'Circuit breaker operation succeeded');
  }
  
  onFailure(error) {
    this.failureCount++;
    this.stats.totalFailures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN state reopens the circuit
      this.openCircuit();
      logger.warn({ 
        name: this.name, 
        error: error.message 
      }, 'Circuit breaker opening from HALF_OPEN due to failure');
      return;
    }
    
    if (this.failureCount >= this.failureThreshold) {
      this.openCircuit();
      logger.error({ 
        name: this.name,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        error: error.message 
      }, 'Circuit breaker opening due to failure threshold');
    }
    
    logger.debug({ 
      name: this.name, 
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message 
    }, 'Circuit breaker operation failed');
  }
  
  openCircuit() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeoutMs;
    this.stats.lastStateChange = Date.now();
  }
  
  async handleOpenState(fallback) {
    if (fallback) {
      return await this.executeFallback(fallback);
    }
    
    throw new ServiceUnavailableError(`${this.name} circuit breaker is open`);
  }
  
  async executeFallback(fallback) {
    try {
      if (typeof fallback === 'function') {
        return await fallback();
      }
      return fallback;
    } catch (fallbackError) {
      logger.error({ 
        name: this.name, 
        error: fallbackError.message 
      }, 'Circuit breaker fallback failed');
      throw fallbackError;
    }
  }
  
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      halfOpenCalls: this.halfOpenCalls,
      stats: this.stats
    };
  }
  
  getHealthStatus() {
    const now = Date.now();
    const uptime = now - this.stats.lastStateChange;
    const failureRate = this.stats.totalCalls > 0 
      ? (this.stats.totalFailures / this.stats.totalCalls * 100).toFixed(2)
      : 0;
    
    return {
      name: this.name,
      healthy: this.state === 'CLOSED',
      state: this.state,
      uptime,
      failureRate: `${failureRate}%`,
      totalCalls: this.stats.totalCalls,
      recentFailures: this.failureCount,
      threshold: this.failureThreshold
    };
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.halfOpenCalls = 0;
    this.stats.lastStateChange = Date.now();
    
    logger.info({ name: this.name }, 'Circuit breaker manually reset');
  }
}

// Pre-configured circuit breakers for common services
export const algorandCircuitBreaker = new CircuitBreaker('algorand-api', {
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 2
});

export const discordCircuitBreaker = new CircuitBreaker('discord-api', {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 3
});

export const redisCircuitBreaker = new CircuitBreaker('redis', {
  failureThreshold: 3,
  resetTimeoutMs: 15000,
  halfOpenMaxCalls: 2
});

export const mongoCircuitBreaker = new CircuitBreaker('mongodb', {
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 2
});
