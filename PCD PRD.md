# Product Requirements Document (PRD) - Poisoned Candy Duel

## 1. Overview
**Poisoned Candy Duel** is a two-player strategic game with hidden information. Players alternate picking candies from a shared pool of 20, each aiming to achieve their win condition while avoiding a poisoned candy chosen by their opponent. The game ends in a draw if both poisoned candies remain unpicked, leaving exactly two candies on the table.

### 1.1 Objective
- **Player 1**: Collect 9 candies without picking Player 2’s poisoned candy (P2).
- **Player 2**: Pick Player 1’s poisoned candy (P1) without ever picking P2, and before Player 1 collects 9 candies.
- **Draw**: Occurs when 18 candies are picked (9 per player), leaving P1 and P2 on the table.

### 1.2 Target Audience
- Casual gamers, strategy enthusiasts, and fans of games with hidden information (e.g., Liar’s Dice, Battleship).
- Suitable for digital (mobile/web) or physical (board game) formats.

### 1.3 Platform
- Digital: Web, iOS, Android apps.
- Physical: Tabletop with cards/tokens representing candies.

## 2. Game Components
- **Candies**: 20 distinct items (e.g., labeled C1–C20 or unique icons/images).
- **Poisoned Candies**: P1 (Player 2’s choice for Player 1), P2 (Player 1’s choice for Player 2).
- **Game State Tracker**: Tracks picked candies, turn order, and win/draw conditions.

## 3. Gameplay Process (Step-by-Step)

### Step 1: Game Setup
1. **Initialize the Table**:
   - Place 20 distinct candies in a shared pool, visible to both players.
   - Digital: Display candies as clickable icons/buttons.
   - Physical: Lay out 20 unique cards/tokens face-up.
2. **Secret Poison Selection**:
   - Player 1 secretly chooses one candy as P2 (Player 2’s poison).
   - Player 2 secretly chooses one candy as P1 (Player 1’s poison).
   - Digital: Players select via private interface (e.g., hidden dropdown).
   - Physical: Players write down/mark their choice secretly (e.g., hidden slip).
   - Ensure P1 ≠ P2 via validation or rule enforcement.

### Step 2: Game Start
1. **Determine First Player**:
   - Player 1 always goes first.
2. **Initialize State**:
   - Turn = 1, Player 1 candy count = 0, Player 2 candy count = 0.
   - Track whether Player 2 has picked P2 (initially false).

### Step 3: Alternating Turns
1. **Player’s Turn**:
   - **Player 1’s Turn** (odd turns: 1, 3, 5, ..., up to 17):
     - Player 1 selects one unpicked candy.
     - Remove candy from table, add to Player 1’s collection.
   - **Player 2’s Turn** (even turns: 2, 4, 6, ..., up to 18):
     - Player 2 selects one unpicked candy.
     - Remove candy from table, add to Player 2’s collection.
   - Digital: Update UI to reflect removed candy and player’s count.
   - Physical: Player takes card/token to their pile.
2. **Check Conditions After Each Pick**:
   - **If Player 1 Picks P2**:
     - Player 2 wins immediately. End game.
   - **If Player 2 Picks P2**:
     - Mark Player 2 as having picked P2 (disqualifies them from winning).
     - Continue game (Player 2 can still pick to reach draw or allow Player 1 to win).
   - **If Player 2 Picks P1** and has not picked P2:
     - Player 2 wins immediately. End game.
   - **If Player 1’s Candy Count Reaches 9** (without picking P2):
     - Player 1 wins immediately. End game.
3. **Check Draw Condition**:
   - After 18 candies are picked (9 per player, turn 18, 2 candies remain):
     - If remaining candies are P1 and P2, game ends in a draw.
     - Digital: Verify by checking stored P1, P2 values.
     - Physical: Reveal selections to confirm.
4. **Proceed to Next Turn**:
   - If no win/draw, increment turn and switch player.

### Step 4: Game End
1. **Declare Outcome**:
   - **Player 1 Win**: Player 1 collects 9 candies without picking P2.
   - **Player 2 Win**: Player 2 picks P1 without having picked P2, or Player 1 picks P2.
   - **Draw**: After 18 candies picked, P1 and P2 remain on the table.
2. **Reveal Poisoned Candies**:
   - Show P1 and P2 for transparency.
   - Digital: Display summary with choices and game log.
   - Physical: Players reveal secret selections.
3. **Offer Replay**:
   - Digital: Prompt for new game with same/swapped roles.
   - Physical: Reset table and repeat setup.

## 4. Win and Draw Conditions
- **Player 1 Wins**:
  - Collects 9 candies without picking P2.
- **Player 2 Wins**:
  - Picks P1 without having picked P2 at any point.
  - Player 1 picks P2.
- **Draw**:
  - After 18 candies picked (9 per player), the remaining two candies are P1 and P2.

## 5. Edge Cases
- **Invalid Poison Selection**:
  - Digital: Prevent P1 = P2 via UI validation.
  - Physical: Rule enforces distinct choices.
- **Early Win**:
  - Player 1 picks P2 on turn 1: Player 2 wins.
  - Player 2 picks P1 on turn 2 (without picking P2): Player 2 wins.
- **Player 2 Disqualification**:
  - If Player 2 picks P2, they cannot win but continue picking to reach draw or allow Player 1’s win.
- **Game Length**:
  - Maximum 18 turns (9 per player). Draw check triggers on turn 18.

## 6. User Interface Requirements (Digital)
- **Setup Screen**:
  - 20 candies with unique identifiers (images/labels C1–C20).
  - Private input for poison selection (hidden from opponent).
- **Gameplay Screen**:
  - Show remaining candies.
  - Highlight current player’s turn.
  - Display candy counts (Player 1: X/9, Player 2: Y).
  - Log picks (e.g., “Player 1 picked C4”).
- **End Screen**:
  - Announce winner/draw.
  - Reveal P1, P2.
  - Replay option or main menu.

## 7. Non-Functional Requirements
- **Performance**: Real-time UI updates and condition checks (<100ms).
- **Accessibility**: High-contrast mode, screen reader support, large text.
- **Localization**: Translate candy names/instructions.
- **Security**: Hide secret selections in client-side code (online multiplayer).

## 8. Future Enhancements
- **AI Opponent**: Single-player bot with adjustable difficulty.
- **Variants**: Configurable candy count or multiple poisons.
- **Online Multiplayer**: Matchmaking and chat.
- **Bluffing**: Add hints or fake reveals for psychology.

## 9. Success Metrics
- **Engagement**: Average game duration, replays per session.
- **Satisfaction**: Feedback via surveys (1–5 scale).
- **Balance**: Target ~50% Player 1 win, ~30% Player 2 win, ~20% draw (based on random picks).

## 10. Appendix
### 10.1 Example Game Flow
- **Setup**: Candies C1–C20. Player 1 sets C5 as P2, Player 2 sets C12 as P1.
- **Turn 1**: Player 1 picks C1 (safe, count=1).
- **Turn 2**: Player 2 picks C2 (safe, count=1).
- **Turn 3**: Player 1 picks C3 (safe, count=2).
- **Turn 4**: Player 2 picks C5 (P2, Player 2 cannot win).
- **Turn 17**: Player 1 picks C18 (safe, count=9, Player 1 wins).
- **Alternate Ending**: Reach turn 18, C12 (P1) and C5 (P2) remain, draw.

### 10.2 Glossary
- **Candy**: Selectable game item.
- **P1**: Player 2’s poison for Player 1.
- **P2**: Player 1’s poison for Player 2.
- **Turn**: One player’s candy pick.

---

**Version**: 2.0  
**Date**: June 16, 2025  
​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​
