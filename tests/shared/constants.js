// Shared constants across H4C applications

export const CHAINS = {
  ALGORAND: 'algorand',
  ETHEREUM: 'ethereum',
  SOLANA: 'solana',
  BITCOIN: 'bitcoin',
  CARDANO: 'cardano',
  POLKADOT: 'polkadot',
  AVALANCHE: 'avalanche',
  COSMOS: 'cosmos',
  BASE: 'base'
};

export const BADGE_CATEGORIES = {
  HODL: 'hodl',
  LP: 'liquidity_provider',
  GOVERNANCE: 'governance',
  COMMUNITY: 'community',
  DEVELOPER: 'developer',
  EARLY_ADOPTER: 'early_adopter'
};

export const BADGE_RARITIES = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary'
};

export const USER_ROLES = {
  CITIZEN: 'citizen',
  HODLER: 'hodler',
  WHALE: 'whale',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
};

export const API_ENDPOINTS = {
  HEALTH: '/health',
  METRICS: '/metrics',
  VERSION: '/version',
  PROFILE: '/profile',
  ROLESYNC: '/admin/rolesync',
  EMAIL_SUBSCRIBE: '/api/email/web-subscribe',
  EMAIL_EXPORT: '/api/email/export',
  LEADERBOARD_LP: '/api/leaderboard/lp'
};

export const CACHE_KEYS = {
  USER_BALANCE: (address, asaId) => `algo:bal:${address}:${asaId}`,
  USER_REPUTATION: (ethAddr, solAddr) => `repv2:${ethAddr || '-'}:${solAddr || '-'}`,
  LP_SNAPSHOT: 'lp:snapshot',
  LP_SNAPSHOT_META: 'lp:snapshot:meta',
  RATE_LIMIT: (bucket, ip) => `rl:${bucket}:${ip}`,
  AUTO_AWARDS_LOCK: 'locks:autoAwards'
};

export const DEFAULT_TIMEOUTS = {
  API_CALL: 10000,
  BLOCKCHAIN_QUERY: 15000,
  DATABASE_QUERY: 5000,
  CACHE_OPERATION: 1000
};

export const RATE_LIMITS = {
  PUBLIC_API: {
    WINDOW_MS: 60000,
    MAX_TOKENS: 120,
    REFILL_PER_SEC: 2,
    BURST: 20
  },
  ADMIN_API: {
    WINDOW_MS: 60000,
    MAX_TOKENS: 30,
    REFILL_PER_SEC: 1,
    BURST: 5
  }
};

export const MEMO_TOKEN = {
  ASA_ID: 885835936,
  DECIMALS: 6,
  SYMBOL: 'MEMO',
  NAME: '$MemO'
};

export const SUPPORTED_NETWORKS = {
  ALGORAND_MAINNET: {
    name: 'Algorand Mainnet',
    chainId: 'mainnet-v1.0',
    rpcUrl: 'https://mainnet-api.algonode.cloud',
    indexerUrl: 'https://mainnet-idx.algonode.cloud',
    explorerUrl: 'https://explorer.algonode.co'
  },
  ETHEREUM_MAINNET: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://mainnet.infura.io/v3/',
    explorerUrl: 'https://etherscan.io'
  },
  SOLANA_MAINNET: {
    name: 'Solana Mainnet',
    chainId: 'mainnet-beta',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com'
  }
};

export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  
  // External APIs
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  API_TIMEOUT: 'API_TIMEOUT',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  BADGE_NOT_FOUND: 'BADGE_NOT_FOUND',
  
  // Blockchain
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  BALANCE_UNAVAILABLE: 'BALANCE_UNAVAILABLE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  
  // Validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

export const LOG_LEVELS = {
  FATAL: 60,
  ERROR: 50,
  WARN: 40,
  INFO: 30,
  DEBUG: 20,
  TRACE: 10
};
