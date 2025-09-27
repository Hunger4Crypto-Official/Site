#!/usr/bin/env node
/*
 * Wrapper for Next.js build that forces NEXT_DISABLE_SWC_AUTO_PATCH so that
 * CI/CD environments without outbound network access (like automated tests)
 * don't fail when Next.js tries to patch the lockfile by fetching metadata.
 */
const { spawn } = require('child_process');

const cwd = process.cwd();
const nextBin = require.resolve('next/dist/bin/next');

const disableAutoPatch = process.env.NEXT_IGNORE_INCORRECT_LOCKFILE || process.env.NEXT_DISABLE_SWC_AUTO_PATCH || '1';
process.env.NEXT_DISABLE_SWC_AUTO_PATCH = disableAutoPatch;
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = disableAutoPatch;

const env = {
  ...process.env,
  NEXT_DISABLE_SWC_AUTO_PATCH: disableAutoPatch,
  NEXT_IGNORE_INCORRECT_LOCKFILE: disableAutoPatch,
};

const child = spawn(process.execPath, [nextBin, 'build'], {
  cwd,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Next.js build terminated due to signal: ${signal}`);
    process.exit(1);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to start Next.js build:', error);
  process.exit(1);
});
