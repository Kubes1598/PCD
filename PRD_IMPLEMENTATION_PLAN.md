# PRD Implementation Plan: Economy System Alignment

## **Current State vs PRD Requirements**

### **❌ Critical Gaps Identified:**

1. **Initial Allocation**: 50 diamonds → 500 diamonds (+450 gap)
2. **Conversion Rates**: 1:10 ratio → 1:25 ratio (PRD: 600D=15K coins)
3. **Daily Login**: Simple daily → Streak system with 10-day bonus
4. **IAP System**: Missing $5=2000 diamonds purchase system
5. **Reward Structure**: Inconsistent with PRD specifications

---

## **Phase 1: Backend Currency System Updates**

### **1.1 Update Default Player Balances**
```python
# backend/api.py - Update default balances
new_player = {
    "name": request.player_name,
    "coin_balance": 10000,        # Matches PRD ✅
    "diamonds_balance": 500,      # Update: 50 → 500 ❌→✅
    "login_streak": 0,            # New: Track consecutive logins
    "last_login_date": None,      # New: Track last login
    "total_coins_earned": 0,
    "total_coins_spent": 0
}
```

### **1.2 Implement PRD Conversion Rates**
```python
# New conversion endpoint
@app.post("/players/convert", response_model=GameResponse)
async def convert_diamonds_to_coins(request: ConversionRequest):
    # PRD Rates:
    # 600 diamonds = 15,000 coins (1 diamond = 25 coins)
    # 1,200 diamonds = 30,000 coins (1 diamond = 25 coins)
```

### **1.3 Daily Login Streak System**
```python
@app.post("/players/daily-login", response_model=GameResponse)
async def process_daily_login(request: DailyLoginRequest):
    # PRD Requirements:
    # - 100 coins per daily login
    # - 50 diamonds every 10th consecutive login
    # - Reset streak if day missed
```

---

## **Phase 2: Frontend Economy Updates**

### **2.1 Update Currency Conversion UI**
```javascript
// web-app/js/game.js - Update EconomyManager
class EconomyManager {
    constructor() {
        this.conversionRates = {
            tier1: { diamonds: 600, coins: 15000 },   // PRD Rate 1
            tier2: { diamonds: 1200, coins: 30000 }   // PRD Rate 2
        };
    }
}
```

### **2.2 Daily Login Streak UI**
```javascript
// Add streak tracking and 10-day bonus system
function processDailyLogin() {
    // Track consecutive days
    // Award 100 coins daily
    // Award 50 diamonds on 10th, 20th, 30th day...
}
```

### **2.3 Standardize Game Mode Rewards**
```javascript
// Update reward system to match PRD
const PRD_REWARDS = {
    standard_win: { coins: 50, diamonds: 0 },
    tournament_win: { coins: 50, diamonds: 10 },
    multiplayer_entry: { coins: 100 },       // Entry cost
    powerup_cost: { diamonds: 5 }            // Power-up cost
};
```

---

## **Phase 3: In-App Purchase System**

### **3.1 Payment Integration**
```javascript
// Add IAP for $5 = 2000 diamonds
async function purchaseDiamonds() {
    // Platform-specific payment integration
    // Apple App Store / Google Play
    // Web: Stripe/PayPal integration
}
```

### **3.2 Purchase Validation**
```python
# backend/api.py - Diamond purchase endpoint
@app.post("/players/purchase", response_model=GameResponse)
async def process_diamond_purchase(request: PurchaseRequest):
    # Validate payment
    # Credit 2000 diamonds for $5 payment
    # Log transaction for audit
```

---

## **Phase 4: Database Schema Updates**

### **4.1 Add Missing Fields**
```sql
-- Add new columns to players table
ALTER TABLE players ADD COLUMN login_streak INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN last_login_date DATE;
ALTER TABLE players ADD COLUMN total_purchases_usd DECIMAL(10,2) DEFAULT 0;
ALTER TABLE players ADD COLUMN conversion_history JSONB DEFAULT '[]';
```

### **4.2 Transaction Logging**
```sql
-- Create transactions table for audit trail
CREATE TABLE player_transactions (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(255),
    transaction_type VARCHAR(50),  -- 'conversion', 'purchase', 'daily_login', 'game_reward'
    amount_coins INTEGER DEFAULT 0,
    amount_diamonds INTEGER DEFAULT 0,
    amount_usd DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## **Implementation Priority & Timeline**

### **Week 1: Critical Fixes**
1. ✅ **Update default diamonds: 50 → 500**
2. ✅ **Fix conversion rates: 1:10 → 1:25**
3. ✅ **Update daily login: 50 coins → 100 coins**

### **Week 2: Daily Login Streak System**
1. Backend: Streak tracking logic
2. Frontend: Streak display UI
3. 10-day diamond bonus system

### **Week 3: Standardize Rewards**
1. Update all game mode rewards to match PRD
2. Standardize entry costs and prize structures
3. Add tournament-specific diamond rewards

### **Week 4: In-App Purchases (if needed)**
1. Payment integration setup
2. $5 = 2000 diamonds purchase flow
3. Purchase validation and security

---

## **Immediate Action Items**

### **High Priority (Fix Today):**
```javascript
// 1. Update default diamonds allocation
"diamonds_balance": 500,  // Was 50

// 2. Fix conversion rate in EconomyManager
this.exchangeRate = 25; // Was 10 (1 diamond = 25 coins per PRD)

// 3. Update daily login reward
const dailyReward = 100; // Was 50 coins
```

### **Medium Priority (This Week):**
- Implement proper conversion tiers (600D=15K, 1200D=30K)
- Add consecutive login streak tracking
- Standardize game mode reward amounts

### **Lower Priority (Next Sprint):**
- In-app purchase system ($5=2000 diamonds)
- Advanced analytics and transaction logging
- A/B testing for economy balance

---

## **Success Metrics to Track:**

1. **Engagement**: Player retention with daily login streaks
2. **Economy Health**: Average player balances over time  
3. **Conversion**: Diamond-to-coin conversion frequency
4. **Monetization**: Purchase conversion rate (if IAP implemented)

This plan brings your economy system into full compliance with the PRD requirements while maintaining your existing arena-based gameplay. 