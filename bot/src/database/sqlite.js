import path from 'path';
import fs from 'fs';

let database = null;
const writeQueue = [];
let processingPromise = Promise.resolve();
const pendingPromises = new Set();

export function setDatabase(db) {
  database = db;
}

export function getDatabase() {
  return database;
}

export function queueWrite({ operation, resolve, reject }) {
  if (typeof operation !== 'function') {
    throw new Error('queueWrite requires an operation function');
  }

  const entry = { operation };

  const promise = new Promise((innerResolve, innerReject) => {
    entry.resolve = (value) => {
      if (typeof resolve === 'function') {
        resolve(value);
      }
      innerResolve(value);
    };

    entry.reject = (error) => {
      if (typeof reject === 'function') {
        reject(error);
      }
      innerReject(error);
    };
  });

  writeQueue.push(entry);
  pendingPromises.add(promise);
  promise.finally(() => pendingPromises.delete(promise));

  scheduleProcessing();

  return promise;
}

function scheduleProcessing() {
  processingPromise = processingPromise
    .then(() => processQueue())
    .catch((error) => {
      // This should be unreachable because each queue item handles its own rejection.
      console.error('Unexpected SQLite queue error', error);
    });
  return processingPromise;
}

async function processQueue() {
  if (writeQueue.length === 0) {
    return;
  }

  if (!database) {
    const error = new Error('SQLite database has not been configured');
    while (writeQueue.length) {
      const entry = writeQueue.shift();
      entry.reject(error);
    }
    return;
  }

  const execute = ({ operation, resolve, reject }) => {
    try {
      const result = operation(database);
      resolve(result);
      return result;
    } catch (error) {
      reject(error);
      throw error;
    }
  };

  const runOperation = typeof database.transaction === 'function'
    ? database.transaction(execute)
    : execute;

  while (writeQueue.length) {
    const entry = writeQueue.shift();
    try {
      runOperation(entry);
    } catch (error) {
      // The promise for this entry has already been rejected inside execute().
    }
  }
}

export async function flushWrites() {
  let awaitedPromise;
  do {
    awaitedPromise = processingPromise;
    await awaitedPromise;
  } while (awaitedPromise !== processingPromise);

  if (pendingPromises.size > 0) {
    await Promise.allSettled([...pendingPromises]);
  }
}

export function run(query, params) {
  return queueWrite({
    operation: (db) => {
      const statement = db.prepare(query);
      if (params === undefined) {
        return statement.run();
      }
      return statement.run(params);
    }
  });
}

export async function closeDatabase() {
  await flushWrites();
  if (database && typeof database.close === 'function') {
    database.close();
  }
}

export function ensureDatabaseFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return resolvedPath;
}
