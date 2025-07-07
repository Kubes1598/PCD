# Product Requirements Document (PRD): Poison Candy Duel Game - Economy System Enhancements


---

## 1. Overview

### 1.1 Purpose
This PRD outlines the requirements for enhancing the economy system (diamonds and coins) in the *Poison Candy Duel* game. The goal is to implement a robust currency system that integrates with all game modes, supports currency conversion, in-app purchases, and daily login rewards to improve user engagement and retention.

### 1.2 Scope
The scope includes:
- Initial currency allocation for new users.
- Integration of currency balances across all game modes.
- Currency conversion system (diamonds to coins).
- In-app purchase system for buying diamonds with real currency (USD).
- Daily login reward system with special rewards for consecutive logins.

### 1.3 Objectives
- Increase player engagement through a rewarding economy system.
- Provide clear incentives for gameplay, purchases, and consistent logins.
- Ensure seamless integration of currency balances across all game modes.
- Maintain fairness and transparency in currency management.

---

## 2. Requirements

### 2.1 Initial Currency Allocation
- **Feature**: New User Currency Allocation
- **Description**: Every new user will receive an initial balance upon account creation.
- **Details**:
  - 500 diamonds
  - 10,000 coins
- **Implementation**:
  - Allocate currencies when a user completes the registration process or first logs into the game.
  - Store balances in the user’s profile in the game’s backend database.
  - Display the initial balance in the user interface (UI) upon first login.
- **Validation**:
  - Ensure the correct amounts are credited only once per user.
  - Verify balances are visible in the UI (e.g., in a wallet or profile section).

### 2.2 Currency Integration Across Game Modes
- **Feature**: Unified Currency System
- **Description**: Diamond and coin balances will be affected by gameplay outcomes across all game modes (e.g., single-player, multiplayer, tournaments).
- **Details**:
  - **Earning Currency**:
    - Winning a game mode grants rewards (e.g., +50 coins for a standard win, +10 diamonds for a tournament win).
    - Specific reward amounts for each game mode to be defined by the game design team (e.g., 10 coins for a single-player win, 100 coins for a multiplayer win, etc.).
  - **Spending Currency**:
    - Players can spend coins or diamonds to enter premium game modes, purchase in-game items (e.g., skins, power-ups), or unlock features.
    - Example costs: 100 coins to enter a multiplayer match, 5 diamonds for a special power-up.
  - **Balance Updates**:
    - Real-time updates to diamond and coin balances after each game session.
    - Deduct entry fees before the game starts and credit rewards after completion.
- **Implementation**:
  - Backend: Update user balance in the database after each game session.
  - Frontend: Reflect updated balances in the UI immediately after transactions.
  - Ensure synchronization to prevent discrepancies (e.g., use transactional updates to avoid race conditions).
- **Validation**:
  - Test balance updates for wins, losses, and draws in all game modes.
  - Verify that negative balances are prevented (e.g., cannot enter a game without sufficient currency).
  - Log all transactions for auditing and debugging.

### 2.3 Currency Conversion (Diamonds to Coins)
- **Feature**: Diamond-to-Coin Conversion
- **Description**: Players can convert diamonds to coins at predefined rates to increase their coin balance for gameplay or purchases.
- **Details**:
  - Conversion rates:
    - 600 diamonds = 15,000 coins
    - 1,200 diamonds = 30,000 coins
  - Conversion is one-way (diamonds to coins only; no coin-to-diamond conversion).
  - Players must have sufficient diamonds to initiate conversion.
- **Implementation**:
  - Add a “Convert Currency” option in the game’s wallet or shop UI.
  - Display conversion rates clearly to the user.
  - Backend: Deduct diamonds and credit coins in a single transaction to ensure atomicity.
  - Frontend: Prompt user to confirm conversion to prevent accidental transactions.
- **Validation**:
  - Test conversion for both rates (600 and 1,200 diamonds).
  - Verify that insufficient diamond balance prevents conversion.
  - Ensure UI updates reflect new balances post-conversion.
  - Log conversions for tracking and analytics.

### 2.4 In-App Purchase System
- **Feature**: Purchase Diamonds with USD
- **Description**: Players can buy diamonds using real currency (USD) through in-app purchases.
- **Details**:
  - Purchase option: $5 = 2,000 diamonds.
  - Additional purchase tiers (e.g., $10 for 4,500 diamonds, $20 for 10,000 diamonds) may be added later based on analytics.
  - Purchases processed via platform-specific payment systems (e.g., Apple App Store, Google Play Store).
- **Implementation**:
  - Integrate with platform payment APIs (e.g., Apple In-App Purchase, Google Play Billing).
  - Add a “Buy Diamonds” section in the shop UI, clearly displaying the $5 = 2,000 diamonds offer.
  - Backend: Credit diamonds to the user’s account upon successful payment confirmation.
  - Provide a transaction receipt or confirmation in the UI.
- **Validation**:
  - Test purchase flow on all supported platforms (iOS, Android, web).
  - Verify correct diamond crediting after purchase.
  - Ensure failed payments do not credit diamonds.
  - Comply with platform-specific refund and error-handling policies.

### 2.5 Daily Login Rewards
- **Feature**: Daily Login Reward System
- **Description**: Players receive rewards for logging into the game daily, with special rewards for consecutive logins.
- **Details**:
  - **Standard Reward**: 100 coins for each daily login.
  - **Special Reward**: 50 diamonds on the 10th consecutive login, repeating every 10th login (e.g., day 10, 20, 30, etc.).
  - Consecutive login streak resets to 0 if a player misses a day.
  - Rewards are credited only once per day (based on a 24-hour cycle, e.g., UTC or local time zone).
- **Implementation**:
  - Backend: Track login timestamps and streak count in the user’s profile.
  - Credit rewards automatically upon login, with a notification in the UI.
  - Frontend: Display a “Daily Login” UI component showing the current streak, next reward, and a progress tracker (e.g., a calendar or streak bar).
  - Notify players of their streak status and upcoming 10th-day rewards.
- **Validation**:
  - Test reward crediting for daily logins (100 coins).
  - Verify 50-diamond reward on the 10th consecutive login.
  - Ensure streak resets correctly after a missed day.
  - Test edge cases (e.g., logins near midnight, time zone changes).
  - Confirm UI accurately reflects streak and reward status.

---

## 3. Technical Requirements

### 3.1 Backend
- **Database**:
  - Store user balances (diamonds, coins) in a secure, scalable database (e.g., MongoDB, PostgreSQL).
  - Add fields for login streak and last login timestamp.
  - Log all currency transactions (gameplay, conversions, purchases, rewards) for auditing.
- **APIs**:
  - GET /user/balance: Retrieve current diamond and coin balances.
  - POST /user/convert: Handle diamond-to-coin conversions.
  - POST /user/purchase: Process diamond purchases and credit diamonds.
  - POST /user/login-reward: Credit daily login rewards and update streak.
  - PATCH /user/balance: Update balances after gameplay (wins/losses).
- **Security**:
  - Use transactional updates to prevent race conditions in balance changes.
  - Validate all inputs to prevent exploits (e.g., negative conversions, duplicate rewards).
  - Encrypt sensitive data (e.g., payment information) per platform requirements.
- **Scalability**:
  - Handle high concurrency for login rewards and gameplay updates.
  - Optimize database queries for balance checks and updates.

### 3.2 Frontend
- **UI Components**:
  - Wallet/Shop UI: Display diamond and coin balances, conversion options, and purchase options.
  - Daily Login UI: Show streak progress, next reward, and claim button.
  - Gameplay UI: Show balance changes (e.g., entry fees, rewards) after each session.
- **Animations & Feedback**:
  - Visual feedback for successful transactions (e.g., coin/diamond animations).
  - Confirmation prompts for conversions and purchases.
  - Notifications for daily login rewards and streak milestones.
- **Platforms**:
  - Support iOS, Android, and web (via grok.com and x.com).
  - Ensure consistent UI/UX across platforms.

### 3.3 Integration
- Integrate with xAI’s Grok 3 API for any AI-driven features (e.g., personalized reward suggestions, if applicable).
- Use platform-specific payment systems for in-app purchases.
- Sync with game servers for real-time balance updates during gameplay.

---

## 4. User Stories

1. **As a new player**, I want to receive 500 diamonds and 10,000 coins upon signing up so that I can start playing immediately.
2. **As a player**, I want my diamond and coin balances to update based on my gameplay outcomes across all modes so that I can track my progress.
3. **As a player**, I want to convert 600 or 1,200 diamonds to 15,000 or 30,000 coins, respectively, so that I can use coins for gameplay or purchases.
4. **As a player**, I want to buy 2,000 diamonds for $5 so that I can acquire more premium currency.
5. **As a player**, I want to receive 100 coins for logging in daily and 50 diamonds every 10th consecutive login so that I’m rewarded for my loyalty.

---

## 5. Success Metrics
- **Engagement**: Increase daily active users (DAU) by 10% within 3 months of implementation.
- **Retention**: Improve 7-day retention rate by 5% due to daily login rewards.
- **Revenue**: Achieve a 5% conversion rate for in-app diamond purchases within 6 months.
- **Economy Balance**: Monitor average diamond/coin balances to ensure the economy remains sustainable (e.g., no hyperinflation or scarcity).

---

## 6. Risks and Mitigation
- **Risk**: Players exploit the system to gain free currency (e.g., manipulating login streaks).
  - **Mitigation**: Implement server-side validation and logging for all transactions.
- **Risk**: Payment processing errors lead to uncredited diamonds.
  - **Mitigation**: Test payment flows thoroughly and provide customer support for refunds.
- **Risk**: Unbalanced economy (e.g., too many coins/diamonds awarded).
  - **Mitigation**: Monitor economy metrics and adjust reward rates via server-side configuration.

---

## 7. Timeline
- **Week 1-2**: Design UI/UX mockups and finalize reward structures.
- **Week 3-4**: Develop backend APIs and database schema.
- **Week 5-6**: Implement frontend UI and integrate with backend.
- **Week 7**: Test all features (gameplay, conversions, purchases, login rewards).
- **Week 8**: Fix bugs, optimize performance, and deploy to production.

---

## 8. Dependencies
- Platform payment systems (Apple, Google).
- Game server infrastructure for real-time balance updates.
- Analytics tools for tracking engagement and economy metrics.

---

