export const criteria = {
  "assets": {
    "memo": { 
      "asa_id": 885835936, 
      "decimals": 6,
      "name": "$MemO",
      "unit_name": "MEMO"
    }
  },
  "badges": {
    "hodl": {
      "shrimp": 100,
      "crab": 1000,
      "fish": 10000,
      "dolphin": 50000,
      "shark": 100000,
      "whale": 500000,
      "titan": 1000000
    },
    "lp": {
      "bronze": 100,
      "silver": 1000,
      "gold": 5000,
      "platinum": 25000,
      "diamond": 100000
    }
  },
  "reputation": {
    "weights": {
      "eth": {
        "balance": 45,
        "transactions": 35,
        "contract": 10,
        "age": 10
      },
      "solana": {
        "balance": 50,
        "transactions": 30,
        "age": 20
      },
      "algorand": {
        "balance": 60,
        "transactions": 25,
        "participation": 15
      }
    },
    "thresholds": {
      "eth_balance_k": 0.5,
      "eth_tx_k": 10,
      "sol_balance_k": 0.5,
      "sol_tx_k": 5,
      "algo_balance_k": 1.0,
      "algo_tx_k": 5
    }
  },
  "limits": {
    "max_badge_awards_per_user": 50,
    "max_reputation_cache_age_ms": 900000,
    "max_balance_cache_age_ms": 60000
  }
};
