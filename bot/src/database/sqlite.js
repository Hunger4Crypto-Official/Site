import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

const __filename = fileURLToPath(import.meta.url);

const DEFAULT_DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'h4c-bot.sqlite');

class PerformanceMonitor {
  constructor() {
    this.writeCount = 0;
    this.startTime = Date.now();
    this.interval = setInterval(() => this.logStats(), 30000);
    if (typeof this.interval.unref === 'function') {
      this.interval.unref();
    }
  }

  recordWrite() {
    this.writeCount++;
  }

  logStats() {
    const elapsedSeconds = Math.max((Date.now() - this.startTime) / 1000, 1);
    const writesPerSecond = this.writeCount / elapsedSeconds;
    console.log(`Database: ${writesPerSecond.toFixed(1)} writes/sec`);
    this.writeCount = 0;
    this.startTime = Date.now();
  }
}

export const performanceMonitor = new PerformanceMonitor();

export class DatabaseManager {
  constructor(dbPath = DEFAULT_DB_PATH, options = {}) {
    this.dbPath = dbPath;
    this.monitor = options.monitor || performanceMonitor;
    this.writeQueue = [];
    this.processing = false;
    this.batchSize = options.batchSize || 100;

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.interval = setInterval(() => this.processWrites(), options.intervalMs || 50);
    if (typeof this.interval.unref === 'function') {
      this.interval.unref();
    }
  }

  prepare(query) {
    const stmt = this.db.prepare(query);
    return {
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
      run: (...params) => this.queueWrite(() => stmt.run(...params))
    };
  }

  queueWrite(operation) {
    this.writeQueue.push(operation);
  }

  processWrites() {
    if (this.processing || this.writeQueue.length === 0) {
      return;
    }

    this.processing = true;
    const operations = this.writeQueue.splice(0, this.batchSize);

    try {
      const transaction = this.db.transaction(() => {
        for (const operation of operations) {
          operation();
          this.monitor.recordWrite();
        }
      });
      transaction();
    } catch (error) {
      console.error('Batch write failed:', error);
    } finally {
      this.processing = false;
    }
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  async flush() {
    const waitForProcessing = () => new Promise((resolve) => {
      const poll = () => {
        if (!this.processing && this.writeQueue.length === 0) {
          resolve();
          return;
        }
        if (!this.processing) {
          this.processWrites();
        }
        setTimeout(poll, 10);
      };
      poll();
    });

    await waitForProcessing();
  }
}

export class BatchedDatabase {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.monitor = options.monitor || performanceMonitor;
    this.writeQueue = [];
    this.BATCH_SIZE = options.batchSize || 50;
    this.BATCH_TIMEOUT = options.batchTimeout || 100;
    this.batchTimer = undefined;

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
  }

  async write(query, params = []) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ query, params, resolve, reject });

      if (this.writeQueue.length >= this.BATCH_SIZE) {
        this.processBatch();
      } else {
        this.scheduleBatch();
      }
    });
  }

  scheduleBatch() {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.BATCH_TIMEOUT);

    if (typeof this.batchTimer.unref === 'function') {
      this.batchTimer.unref();
    }
  }

  processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.writeQueue.length === 0) {
      return;
    }

    const batch = this.writeQueue.splice(0, this.BATCH_SIZE);
    const transaction = this.db.transaction(() => {
      for (const item of batch) {
        const { query, params, resolve, reject } = item;
        try {
          const result = this.db.prepare(query).run(...params);
          this.monitor.recordWrite();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    });

    try {
      transaction();
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
    }
  }

  writeImmediate(query, params = []) {
    const result = this.db.prepare(query).run(...params);
    this.monitor.recordWrite();
    return result;
  }

  async flush() {
    if (this.writeQueue.length > 0) {
      this.processBatch();
    }
  }
}

export class WorkerDatabase {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.worker = undefined;
    this.requestId = 0;
    this.pendingRequests = new Map();

    if (isMainThread) {
      this.initializeWorker();
    }
  }

  initializeWorker() {
    this.worker = new Worker(__filename, {
      workerData: { dbPath: this.dbPath },
      execArgv: process.execArgv.filter((arg) => !arg.startsWith('--inspect')),
    });

    this.worker.on('message', ({ id, result, error }) => {
      const pending = this.pendingRequests.get(id);
      if (!pending) {
        return;
      }

      this.pendingRequests.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    });

    this.worker.on('error', (error) => {
      console.error('Database worker error:', error);
    });
  }

  async write(query, params = []) {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ id, query, params });
    });
  }

  async close() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = undefined;
    }
  }
}

export class AsyncDatabase {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  async write(query, params = []) {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const result = this.db.prepare(query).run(...params);
          performanceMonitor.recordWrite();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async read(query, params = []) {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const result = this.db.prepare(query).get(...params);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

export class ImprovedPersistence {
  constructor(options = {}) {
    this.batchedDb = new BatchedDatabase({
      dbPath: options.dbPath || DEFAULT_DB_PATH,
      monitor: options.monitor || performanceMonitor,
      batchSize: options.batchSize,
      batchTimeout: options.batchTimeout,
    });
  }

  async updateUserCoins(userId, amount) {
    await this.batchedDb.write('UPDATE profiles SET coins = coins + ? WHERE user_id = ?', [amount, userId]);
    await this.batchedDb.write(
      'INSERT INTO economy_ledger (txn_id, user_id, kind, amount, reason, meta_json, ts) VALUES (?,?,?,?,?,?,?)',
      [`txn_${Date.now()}`, userId, 'reward', amount, 'action_success', '{}', Date.now()]
    );
  }

  async saveGameState(run) {
    await this.batchedDb.write(
      'UPDATE runs SET scene_id = ?, round_id = ?, flags_json = ?, updated_at = ? WHERE run_id = ?',
      [run.scene_id, run.round_id, run.flags_json, Date.now(), run.run_id]
    );
  }

  saveRunImmediate(run) {
    return this.batchedDb.writeImmediate(
      'UPDATE runs SET scene_id = ?, round_id = ?, flags_json = ?, updated_at = ? WHERE run_id = ?',
      [run.scene_id, run.round_id, run.flags_json, Date.now(), run.run_id]
    );
  }

  async shutdown() {
    await this.batchedDb.flush();
  }
}

let defaultDatabase = null;
let improvedPersistence = null;

if (isMainThread) {
  defaultDatabase = new DatabaseManager();
  improvedPersistence = new ImprovedPersistence();
}

export const db = defaultDatabase;
export const improvedDb = improvedPersistence;
export default defaultDatabase;

if (!isMainThread) {
  const workerDb = new Database(workerData.dbPath);
  workerDb.pragma('journal_mode = WAL');

  if (parentPort) {
    parentPort.on('message', ({ id, query, params }) => {
      try {
        const result = workerDb.prepare(query).run(...params);
        parentPort.postMessage({ id, result });
      } catch (error) {
        parentPort.postMessage({ id, error: error.message });
      }
    });
  }
}
