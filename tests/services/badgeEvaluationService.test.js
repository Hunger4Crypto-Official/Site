// bot/test/services/badgeEvaluationService.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { BadgeEvaluationService } from '../../src/services/badgeEvaluationService.js';
import { User, Badge } from '../../src/database/models.js';

// Mock dependencies
const mockAlgoClient = {
  getAssetBalance: async (address, asaId) => {
    // Mock balance responses
    const balances = {
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 500000000, // 500 $MemO (decimals: 6)
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB': 1000000000, // 1000 $MemO
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC': 50000000000, // 50,000 $MemO
    };
    return balances[address] || 0;
  }
};

// Mock the algorandClient import
let originalAlgoClient;
beforeEach(async () => {
  // Store original and replace with mock
  const algorandModule = await import('../../src/utils/algorandClient.js');
  originalAlgoClient = algorandModule.algoClient;
  algorandModule.algoClient = mockAlgoClient;
});

afterEach(() => {
  // Restore original
  if (originalAlgoClient) {
    const algorandModule = require('../../src/utils/algorandClient.js');
    algorandModule.algoClient = originalAlgoClient;
  }
});

describe('BadgeEvaluationService', () => {
  describe('evaluateAndAwardHodl', () => {
    it('should award shrimp badge for 100+ $MemO', async () => {
      // Mock user data
      const mockUser = {
        discordId: 'test123',
        walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        walletVerified: true,
        badges: []
      };

      // Mock database operations
      User.findOne = async () => mockUser;
      User.findOneAndUpdate = async (filter, update, options) => {
        // Simulate atomic update
        return { ...mockUser, badges: ['hodl-shrimp'] };
      };
      Badge.findOneAndUpdate = async () => ({ badgeId: 'hodl-shrimp' });

      // Mock Discord client and role service
      const mockClient = {};
      const mockGuildId = 'guild123';

      const result = await BadgeEvaluationService.evaluateAndAwardHodl(
        mockClient, 
        mockGuildId, 
        'test123'
      );

      assert.deepStrictEqual(result.awarded, ['hodl-shrimp']);
      assert.strictEqual(result.currentBadge, 'hodl-shrimp');
      assert.strictEqual(result.balance, 500);
    });

    it('should upgrade from crab to fish badge', async () => {
      const mockUser = {
        discordId: 'test456',
        walletAddress: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        walletVerified: true,
        badges: ['hodl-crab']
      };

      User.findOne = async () => mockUser;
      User.findOneAndUpdate = async (filter, update, options) => {
        return { ...mockUser, badges: ['hodl-fish'] };
      };
      Badge.findOneAndUpdate = async () => ({ badgeId: 'hodl-fish' });

      const result = await BadgeEvaluationService.evaluateAndAwardHodl(
        {}, 
        'guild123', 
        'test456'
      );

      assert.deepStrictEqual(result.awarded, ['hodl-fish']);
      assert.deepStrictEqual(result.removed, ['hodl-crab']);
      assert.strictEqual(result.balance, 50000);
    });

    it('should handle unverified wallet', async () => {
      const mockUser = {
        discordId: 'test789',
        walletAddress: 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        walletVerified: false,
        badges: []
      };

      User.findOne = async () => mockUser;

      const result = await BadgeEvaluationService.evaluateAndAwardHodl(
        {}, 
        'guild123', 
        'test789'
      );

      assert.deepStrictEqual(result.awarded, []);
    });

    it('should handle balance below minimum threshold', async () => {
      const mockUser = {
        discordId: 'test000',
        walletAddress: 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
        walletVerified: true,
        badges: []
      };

      User.findOne = async () => mockUser;

      const result = await BadgeEvaluationService.evaluateAndAwardHodl(
        {}, 
        'guild123', 
        'test000'
      );

      assert.deepStrictEqual(result.awarded, []);
    });

    it('should handle API errors gracefully', async () => {
      const mockUser = {
        discordId: 'testError',
        walletAddress: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        walletVerified: true,
        badges: []
      };

      User.findOne = async () => mockUser;
      
      // Mock API error
      mockAlgoClient.getAssetBalance = async () => {
        throw new Error('API_UNAVAILABLE');
      };

      const result = await BadgeEvaluationService.evaluateAndAwardHodl(
        {}, 
        'guild123', 
        'testError'
      );

      assert.deepStrictEqual(result.awarded, []);
      assert.strictEqual(result.error, 'Balance check failed');
    });
  });

  describe('evaluateAndAwardLp', () => {
    it('should award bronze LP badge for $100 USD', async () => {
      const mockUser = {
        discordId: 'lptest123',
        walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        walletVerified: true,
        badges: []
      };

      User.findOne = async () => mockUser;
      User.findOneAndUpdate = async (filter, update, options) => {
        return { ...mockUser, badges: ['lp-bronze'] };
      };
      Badge.findOneAndUpdate = async () => ({ badgeId: 'lp-bronze' });

      const result = await BadgeEvaluationService.evaluateAndAwardLp(
        {}, 
        'guild123', 
        'lptest123',
        150 // $150 USD
      );

      assert.deepStrictEqual(result.awarded, ['lp-bronze']);
      assert.strictEqual(result.currentBadge, 'lp-bronze');
      assert.strictEqual(result.lpUsdValue, 150);
    });

    it('should upgrade LP badges correctly', async () => {
      const mockUser = {
        discordId: 'lptest456',
        walletAddress: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        walletVerified: true,
        badges: ['lp-bronze']
      };

      User.findOne = async () => mockUser;
      User.findOneAndUpdate = async (filter, update, options) => {
        return { ...mockUser, badges: ['lp-gold'] };
      };
      Badge.findOneAndUpdate = async () => ({ badgeId: 'lp-gold' });

      const result = await BadgeEvaluationService.evaluateAndAwardLp(
        {}, 
        'guild123', 
        'lptest456',
        6000 // $6000 USD
      );

      assert.deepStrictEqual(result.awarded, ['lp-gold']);
      assert.deepStrictEqual(result.removed, ['lp-bronze']);
    });
  });

  describe('evaluateAllBadges', () => {
    it('should evaluate both HODL and LP badges', async () => {
      const mockUser = {
        discordId: 'alltest123',
        walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        walletVerified: true,
        badges: []
      };

      User.findOne = async () => mockUser;
      User.findOneAndUpdate = async (filter, update, options) => {
        return { ...mockUser, badges: ['hodl-shrimp'] };
      };
      Badge.findOneAndUpdate = async () => ({ badgeId: 'hodl-shrimp' });

      const result = await BadgeEvaluationService.evaluateAllBadges(
        {}, 
        'guild123', 
        'alltest123'
      );

      assert.ok(result.hodl);
      assert.ok(result.lp);
      assert.deepStrictEqual(result.hodl.awarded, ['hodl-shrimp']);
      assert.deepStrictEqual(result.lp.awarded, []);
    });
  });
});
