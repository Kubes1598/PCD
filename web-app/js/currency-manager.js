// ===== CURRENCY MANAGEMENT SYSTEM =====

class CurrencyManager {
    constructor() {
        this.storageKey = 'pcd_currency_data';
        this.defaultCurrency = {
            coins: 10000,
            diamonds: 500,
            totalSpent: 0,
            totalEarned: 0,
            lastLogin: Date.now(),
            dailyRewardClaimed: false
        };
        this.conversionRates = {
            diamonds_to_coins: {
                600: 10000,
                1200: 20000
            },
            purchase_options: {
                1200: 5.00 // $5 for 1200 diamonds
            }
        };
        this.init();
    }

    init() {
        this.loadCurrency();
        this.checkDailyReward();
        this.updateUI();
    }

    // ===== CORE CURRENCY OPERATIONS =====

    loadCurrency() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.currency = { ...this.defaultCurrency, ...JSON.parse(saved) };
                
                // Ensure minimum values for existing users
                if (this.currency.coins < 0) this.currency.coins = 0;
                if (this.currency.diamonds < 0) this.currency.diamonds = 0;
            } else {
                // New user - give welcome bonus
                this.currency = { ...this.defaultCurrency };
                this.saveCurrency();
                this.showWelcomeBonus();
            }
        } catch (error) {
            console.error('Error loading currency:', error);
            this.currency = { ...this.defaultCurrency };
        }
    }

    saveCurrency() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.currency));
            this.updateUI();
        } catch (error) {
            console.error('Error saving currency:', error);
        }
    }

    // ===== CURRENCY GETTERS =====

    getCoins() {
        return this.currency.coins;
    }

    getDiamonds() {
        return this.currency.diamonds;
    }

    getCurrencyData() {
        return { ...this.currency };
    }

    // ===== SPENDING OPERATIONS =====

    canSpendCoins(amount) {
        return this.currency.coins >= amount;
    }

    canSpendDiamonds(amount) {
        return this.currency.diamonds >= amount;
    }

    spendCoins(amount, description = 'Game purchase') {
        if (!this.canSpendCoins(amount)) {
            throw new Error(`Insufficient coins. Need ${amount}, have ${this.currency.coins}`);
        }

        this.currency.coins -= amount;
        this.currency.totalSpent += amount;
        this.saveCurrency();
        
        console.log(`💰 Spent ${amount} coins: ${description}`);
        this.logTransaction('spend', 'coins', amount, description);
        
        return true;
    }

    spendDiamonds(amount, description = 'Premium purchase') {
        if (!this.canSpendDiamonds(amount)) {
            throw new Error(`Insufficient diamonds. Need ${amount}, have ${this.currency.diamonds}`);
        }

        this.currency.diamonds -= amount;
        this.saveCurrency();
        
        console.log(`💎 Spent ${amount} diamonds: ${description}`);
        this.logTransaction('spend', 'diamonds', amount, description);
        
        return true;
    }

    // ===== EARNING OPERATIONS =====

    addCoins(amount, description = 'Game reward') {
        this.currency.coins += amount;
        this.currency.totalEarned += amount;
        this.saveCurrency();
        
        console.log(`💰 Earned ${amount} coins: ${description}`);
        this.logTransaction('earn', 'coins', amount, description);
        
        if (typeof uxManager !== 'undefined') {
            uxManager.showNotification(`+${amount} coins earned!`, 'success');
        }
        
        return true;
    }

    addDiamonds(amount, description = 'Premium reward') {
        this.currency.diamonds += amount;
        this.saveCurrency();
        
        console.log(`💎 Earned ${amount} diamonds: ${description}`);
        this.logTransaction('earn', 'diamonds', amount, description);
        
        if (typeof uxManager !== 'undefined') {
            uxManager.showNotification(`+${amount} diamonds earned!`, 'success');
        }
        
        return true;
    }

    // ===== CONVERSION SYSTEM =====

    getConversionOptions() {
        return [
            {
                diamonds: 600,
                coins: 10000,
                value: '10K coins for 600 diamonds',
                available: this.canSpendDiamonds(600)
            },
            {
                diamonds: 1200,
                coins: 20000,
                value: '20K coins for 1200 diamonds',
                available: this.canSpendDiamonds(1200),
                bonus: true
            }
        ];
    }

    convertDiamondsToCoins(diamondAmount) {
        const conversions = this.conversionRates.diamonds_to_coins;
        
        if (!conversions[diamondAmount]) {
            throw new Error(`Invalid conversion amount: ${diamondAmount} diamonds`);
        }

        const coinAmount = conversions[diamondAmount];
        
        if (!this.canSpendDiamonds(diamondAmount)) {
            throw new Error(`Insufficient diamonds. Need ${diamondAmount}, have ${this.currency.diamonds}`);
        }

        this.spendDiamonds(diamondAmount, `Convert to ${coinAmount} coins`);
        this.addCoins(coinAmount, `Converted from ${diamondAmount} diamonds`);
        
        return { diamondsSpent: diamondAmount, coinsEarned: coinAmount };
    }

    // ===== PURCHASE SYSTEM =====

    getPurchaseOptions() {
        return [
            {
                diamonds: 1200,
                price: 5.00,
                description: 'Starter Pack',
                popular: true
            },
            {
                diamonds: 2500,
                price: 10.00,
                description: 'Value Pack',
                bonus: '+ 100 bonus diamonds'
            },
            {
                diamonds: 5000,
                price: 18.00,
                description: 'Premium Pack',
                bonus: '+ 500 bonus diamonds',
                savings: 'Save $2!'
            }
        ];
    }

    simulatePurchase(diamondAmount, price) {
        // In a real app, this would integrate with payment processing
        // For now, we'll simulate the purchase
        
        console.log(`💳 Simulating purchase: ${diamondAmount} diamonds for $${price}`);
        
        // Add purchased diamonds
        this.addDiamonds(diamondAmount, `Purchased for $${price}`);
        
        // Add bonus diamonds for larger purchases
        if (diamondAmount >= 2500) {
            const bonus = diamondAmount >= 5000 ? 500 : 100;
            this.addDiamonds(bonus, 'Purchase bonus');
        }
        
        return {
            success: true,
            diamondsAdded: diamondAmount,
            amountCharged: price
        };
    }

    // ===== DAILY REWARDS =====

    checkDailyReward() {
        const now = Date.now();
        const lastLogin = this.currency.lastLogin;
        const daysSinceLastLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastLogin >= 1) {
            this.currency.dailyRewardClaimed = false;
            this.currency.lastLogin = now;
            this.saveCurrency();
            
            if (daysSinceLastLogin >= 1) {
                this.showDailyRewardAvailable();
            }
        }
    }

    claimDailyReward() {
        if (this.currency.dailyRewardClaimed) {
            throw new Error('Daily reward already claimed');
        }

        const baseCoins = 100;
        const baseDiamonds = 5;
        const streak = this.getDailyStreak();
        
        const coinsReward = baseCoins + (streak * 10);
        const diamondsReward = baseDiamonds + Math.floor(streak / 3);
        
        this.addCoins(coinsReward, 'Daily reward');
        this.addDiamonds(diamondsReward, 'Daily reward');
        
        this.currency.dailyRewardClaimed = true;
        this.saveCurrency();
        
        return {
            coins: coinsReward,
            diamonds: diamondsReward,
            streak: streak
        };
    }

    getDailyStreak() {
        // Simplified streak calculation
        const streakData = JSON.parse(localStorage.getItem('pcd_daily_streak') || '{"streak": 0, "lastClaim": 0}');
        const now = Date.now();
        const daysSinceLastClaim = Math.floor((now - streakData.lastClaim) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastClaim === 1) {
            streakData.streak += 1;
        } else if (daysSinceLastClaim > 1) {
            streakData.streak = 1;
        }
        
        streakData.lastClaim = now;
        localStorage.setItem('pcd_daily_streak', JSON.stringify(streakData));
        
        return streakData.streak;
    }

    // ===== UI UPDATES =====

    updateUI() {
        // Update coin displays
        const coinElements = document.querySelectorAll('#coins-count, #player-balance');
        coinElements.forEach(el => {
            if (el) el.textContent = this.formatNumber(this.currency.coins);
        });

        // Update diamond displays
        const diamondElements = document.querySelectorAll('#diamonds-count');
        diamondElements.forEach(el => {
            if (el) el.textContent = this.formatNumber(this.currency.diamonds);
        });

        // Update arena buttons based on affordability
        this.updateArenaButtons();
    }

    updateArenaButtons() {
        const arenaButtons = document.querySelectorAll('.arena-btn');
        arenaButtons.forEach(btn => {
            const cost = parseInt(btn.dataset.cost) || 0;
            if (cost > 0) {
                if (this.canSpendCoins(cost)) {
                    btn.disabled = false;
                    btn.classList.remove('btn-disabled');
                } else {
                    btn.disabled = true;
                    btn.classList.add('btn-disabled');
                    btn.title = `Need ${cost} coins (you have ${this.currency.coins})`;
                }
            }
        });
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // ===== TRANSACTION LOGGING =====

    logTransaction(type, currency, amount, description) {
        const transaction = {
            type,
            currency,
            amount,
            description,
            timestamp: Date.now(),
            balance: {
                coins: this.currency.coins,
                diamonds: this.currency.diamonds
            }
        };

        // Store transaction history
        const history = JSON.parse(localStorage.getItem('pcd_transaction_history') || '[]');
        history.unshift(transaction);
        
        // Keep only last 100 transactions
        if (history.length > 100) {
            history.splice(100);
        }
        
        localStorage.setItem('pcd_transaction_history', JSON.stringify(history));
    }

    getTransactionHistory() {
        return JSON.parse(localStorage.getItem('pcd_transaction_history') || '[]');
    }

    // ===== WELCOME BONUS =====

    showWelcomeBonus() {
        setTimeout(() => {
            if (typeof uxManager !== 'undefined') {
                uxManager.showModal(
                    '🎉 Welcome Bonus!',
                    `
                        <div class="text-center space-y-4">
                            <div class="text-6xl mb-4">🎁</div>
                            <h3 class="text-xl font-bold mb-4">Welcome to Poison Candy Duel!</h3>
                            <div class="bg-gradient-to-r from-yellow-50 to-green-50 rounded-lg p-4">
                                <h4 class="font-bold text-gray-900 mb-2">🎊 Starter Package</h4>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="bg-white rounded-lg p-3">
                                        <div class="text-2xl mb-1">💰</div>
                                        <div class="font-bold text-primary">10,000 Coins</div>
                                        <div class="text-sm text-gray-600">Ready to play!</div>
                                    </div>
                                    <div class="bg-white rounded-lg p-3">
                                        <div class="text-2xl mb-1">💎</div>
                                        <div class="font-bold text-blue-600">500 Diamonds</div>
                                        <div class="text-sm text-gray-600">Premium currency!</div>
                                    </div>
                                </div>
                            </div>
                            <p class="text-sm text-gray-600">Your currencies have been added to your account!</p>
                        </div>
                    `,
                    [
                        {
                            text: 'Start Playing!',
                            class: 'btn-primary'
                        }
                    ]
                );
            }
        }, 2000);
    }

    showDailyRewardAvailable() {
        setTimeout(() => {
            if (typeof uxManager !== 'undefined') {
                uxManager.showNotification('🎁 Daily reward available!', 'info');
            }
        }, 3000);
    }
}

// ===== GLOBAL CURRENCY MANAGER =====

let currencyManager;

// Initialize currency manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    currencyManager = new CurrencyManager();
    
    // Update UI every 30 seconds
    setInterval(() => {
        currencyManager.updateUI();
    }, 30000);
});

// Export for global use
if (typeof window !== 'undefined') {
    window.CurrencyManager = CurrencyManager;
    window.currencyManager = currencyManager;
} 