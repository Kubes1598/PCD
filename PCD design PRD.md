# Product Requirements Document (PRD) - Poisoned Candy Duel Design

## 1. Overview
This PRD outlines the design requirements for **Poisoned Candy Duel**, a two-player strategic game with hidden information. The design focuses on creating an intuitive, visually appealing, and accessible user interface (UI) and user experience (UX) for digital platforms (web, iOS, Android). The goal is to enhance player engagement through clear visuals, smooth interactions, and a cohesive aesthetic that reflects the game’s theme of strategy and suspense.

### 1.1 Objectives
- Deliver a visually engaging UI that reflects the game’s candy-themed, high-stakes duel concept.
- Ensure intuitive UX with clear navigation, feedback, and minimal learning curve.
- Support accessibility for diverse users (e.g., colorblind, low-vision, motor-impaired).
- Maintain consistency across web and mobile platforms.

### 1.2 Target Audience
- Casual gamers and strategy enthusiasts (ages 10+).
- Players familiar with digital games involving hidden information (e.g., Liar’s Dice, Among Us).
- Users seeking quick, engaging multiplayer or single-player experiences.

### 1.3 Platforms
- **Web**: Responsive design for desktop and mobile browsers (Chrome, Safari, Firefox).
- **Mobile**: Native apps for iOS (iPhone/iPad) and Android (phones/tablets).

## 2. Design Principles
- **Clarity**: Ensure game state, actions, and outcomes are immediately clear.
- **Thematic Consistency**: Use a candy-themed aesthetic with a playful yet suspenseful tone.
- **Responsiveness**: Adapt layouts for various screen sizes and orientations.
- **Feedback**: Provide visual and auditory cues for every user action.
- **Accessibility**: Comply with WCAG 2.1 guidelines for inclusive design.

## 3. Visual Design

### 3.1 Theme and Aesthetic
- **Theme**: A whimsical candy shop with a subtle “poisoned” twist, blending playful colors with a hint of danger (e.g., vibrant candies with occasional dark accents).
- **Color Palette**:
  - Primary: Candy-inspired colors (Pink #FF6B6B, Mint Green #4ECDC4, Lemon Yellow #FFE66D).
  - Secondary: Neutral backgrounds (Cream #FFF5E1) with dark accents (Charcoal #2D3436).
  - Accessibility: High-contrast options (e.g., Black/White mode) for colorblind users.
- **Typography**:
  - Primary Font: Playful, rounded sans-serif (e.g., Poppins, Bubblegum Sans) for headers and buttons.
  - Secondary Font: Clean sans-serif (e.g., Roboto, Open Sans) for body text and logs.
  - Sizes: Scalable (16px base, 24px headers, 32px titles) with adjustable text size for accessibility.
- **Icons and Graphics**:
  - Candies: 20 unique designs (e.g., gummy bears, lollipops, chocolates) with distinct shapes and colors.
  - Poison Indicator: Subtle skull or hazard symbol (revealed only at game end).
  - Animations: Smooth transitions for candy picks, win/draw reveals, and button presses.

### 3.2 Art Style
- **Style**: 2D, flat design with soft shadows for depth (e.g., Material Design with a candy twist).
- **Tone**: Playful but suspenseful, with animations like a candy “shaking” when hovered or a dramatic flash for poisoned candy reveals.

## 4. User Interface (UI) Components

### 4.1 Main Menu Screen
- **Purpose**: Entry point for game setup and navigation.
- **Components**:
  - **Logo/Title**: “Poisoned Candy Duel” in bold, candy-styled font (center-top).
  - **Buttons**:
    - “Play vs Friend” (local multiplayer, same device).
    - “Play vs AI” (single-player with difficulty options: Easy, Medium, Hard).
    - “Online Match” (future feature, greyed out initially).
    - “Settings” (access sound, accessibility, language).
    - “How to Play” (tutorial with animated walkthrough).
  - **Background**: Candy shop counter with scattered candies.
  - **Layout**: Vertical button stack (mobile), horizontal grid (web, large screens).
- **Interactions**:
  - Buttons scale up on hover/tap with a bounce animation.
  - Sound: Candy-crunch sound on button press (toggleable).

### 4.2 Setup Screen
- **Purpose**: Allow players to select poisoned candies secretly.
- **Components**:
  - **Candy Grid**: 20 candies in a 4x5 grid, each with unique design (e.g., C1: Red Gummy, C2: Blue Lollipop).
  - **Prompt**: “Player X, choose your opponent’s poison!” (hidden from other player).
  - **Confirm Button**: “Lock Choice” (disabled until candy selected).
  - **Player Indicator**: Shows current player (e.g., “Player 1” with pink border, “Player 2” with green).
  - **Pass Device Prompt**: “Pass to Player 2” (for local multiplayer).
- **Interactions**:
  - Tap candy to highlight (glow effect); tap again to deselect.
  - Prevent duplicate selections (P1 ≠ P2) with error message: “This candy is already poisoned!”
  - Animation: Candy pulses when selected; screen fades to black during device pass.
  - Accessibility: Keyboard navigation (arrow keys to move, Enter to select).
- **Privacy**: Ensure Player 1’s selection is hidden during Player 2’s turn (e.g., temporary screen lock).

### 4.3 Gameplay Screen
- **Purpose**: Main interaction area for picking candies and tracking game state.
- **Components**:
  - **Candy Table**: 4x5 grid of remaining candies (removed candies fade out).
  - **Player Status** (top bar):
    - Player 1: Candy count (X/9) with pink progress bar.
    - Player 2: Candy count (Y) with green progress bar.
    - Current turn: Highlighted player name with animated arrow.
  - **Game Log** (bottom or sidebar): Scrollable list of picks (e.g., “Turn 1: Player 1 picked Red Gummy”).
  - **Exit Button**: Top-right corner to pause/quit (confirmation dialog: “Are you sure?”).
- **Interactions**:
  - Tap candy to pick; confirm with pop-up: “Pick [Candy Name]?” (prevents accidental picks).
  - Animation: Candy zooms to player’s pile with a “pop” sound.
  - Feedback: Vibration (mobile) and visual flash for picks.
  - Accessibility: Screen reader announces turn, picks, and counts; large hitboxes for candies.

### 4.4 End Screen
- **Purpose**: Display game outcome and offer replay.
- **Components**:
  - **Outcome Text**: Bold headline (e.g., “Player 1 Wins!”, “Draw!”) with confetti (win) or fog (draw) animation.
  - **Reveal Section**: Show P1 and P2 with labels (e.g., “Player 1’s Poison: Blue Lollipop”).
  - **Game Summary**: List of all picks with turn numbers.
  - **Buttons**:
    - “Replay” (same roles).
    - “Swap Roles” (Player 1 becomes Player 2).
    - “Main Menu”.
  - **Background**: Dynamic based on outcome (e.g., candy explosion for win, greyed-out shop for draw).
- **Interactions**:
  - Poison reveal: Candies flip with a dramatic sound (e.g., ominous chime).
  - Buttons pulse gently to encourage replay.
  - Accessibility: Outcome read aloud; keyboard focus on “Replay” by default.

### 4.5 Settings Screen
- **Purpose**: Customize game experience and accessibility.
- **Components**:
  - **Sound**: Sliders for music, SFX, voice (toggle on/off).
  - **Accessibility**:
    - High-contrast mode (black/white).
    - Text size (Small, Medium, Large).
    - Screen reader toggle.
    - Vibration toggle (mobile).
  - **Language**: Dropdown (English, Spanish, etc.).
  - **Tutorial**: Button to replay “How to Play”.
- **Interactions**:
  - Real-time preview of changes (e.g., text size updates instantly).
  - Save settings persistently across sessions.

## 5. User Experience (UX) Flows

### 5.1 Onboarding
- **First Launch**: Animated tutorial (30 seconds) explaining rules:
  - Step 1: Choose opponent’s poison secretly.
  - Step 2: Alternate picking candies.
  - Step 3: Player 1 wins at 9 candies; Player 2 wins by picking P1; draw if P1, P2 remain.
  - Interactive demo: User picks a candy to practice.
- **Skip Option**: “Skip Tutorial” button, accessible later via Settings.

### 5.2 Game Flow
1. **Main Menu**: User selects “Play vs Friend” → Setup Screen.
2. **Setup**:
   - Player 1 picks poison → Screen locks → Pass to Player 2.
   - Player 2 picks poison → Gameplay Screen.
3. **Gameplay**:
   - Players alternate picks with clear turn indicators.
   - Pop-up confirms picks to prevent errors.
   - Real-time updates to candy counts and log.
4. **End**:
   - Outcome announced with animation.
   - Poison reveal with summary.
   - Replay or exit.

### 5.3 Error Handling
- **Invalid Pick**: Alert: “Candy already picked!” with retry option.
- **Connection Loss** (future online mode): Pause game, attempt reconnect, or save state.
- **Accessibility Issue**: Fallback to text-only mode if graphics fail to load.

## 6. Accessibility Requirements
- **WCAG 2.1 Compliance**:
  - Contrast ratio ≥ 4.5:1 for text, 3:1 for graphics.
  - Screen reader support (e.g., ARIA labels for candies: “Red Gummy, unpicked”).
  - Keyboard navigation (Tab to cycle, Enter to select).
- **Colorblind Mode**: Use shapes/patterns for candies (e.g., stripes, dots) alongside colors.
- **Motor Accessibility**: Large tap targets (min 48x48px), optional swipe gestures.
- **Audio Alternatives**: Subtitles for sound effects (e.g., “Candy picked: Pop!”).

## 7. Animations and Sound
- **Animations**:
  - Candy Pick: Candy scales up, zooms to player’s pile (0.3s).
  - Poison Reveal: Candy flips with red glow (0.5s).
  - Win: Confetti burst (2s).
  - Draw: Fog fades in (1s).
- **Sound Effects**:
  - Pick: Crunch or pop (0.2s).
  - Poison Reveal: Ominous chime (0.5s).
  - Win: Cheerful jingle (1s).
  - Draw: Low hum (0.8s).
- **Background Music**: Looping candy shop theme (muted by default, toggleable).

## 8. Non-Functional Requirements
- **Performance**: Animations run at 60fps; UI updates <100ms.
- **Resolution**: Support 320x480 (low-end mobile) to 2560x1440 (high-end web).
- **File Size**: Optimize assets (<10MB for mobile app).
- **Cross-Platform**: Consistent design across iOS, Android, web (use CSS media queries for responsive web).

## 9. Future Design Enhancements
- **Themes**: Unlockable skins (e.g., Halloween candies, sci-fi gadgets).
- **Avatars**: Player profiles with customizable candy-themed icons.
- **Emotes**: In-game reactions (e.g., “Yum!”, “Uh-oh!”) for online mode.
- **Dynamic Lighting**: Candy reflections or glows for premium devices.

## 10. Success Metrics
- **Usability**: <5% error rate on candy picks (e.g., accidental selections).
- **Engagement**: Average session time >5 minutes; >50% replay rate.
- **Accessibility**: Positive feedback from accessibility surveys (target 4/5 rating).
- **Visual Appeal**: User ratings for UI aesthetics (target 4/5 via in-app survey).

## 11. Appendix
### 11.1 Mockup References
- **Main Menu**: Centered logo, pastel buttons on candy shop background.
- **Gameplay**: 4x5 candy grid, top bar with progress, bottom log (mobile: collapse log to sidebar on web).
- **End Screen**: Large outcome text, candy reveal cards, replay button.

### 11.2 Example Interaction
- **Setup**: Player 1 taps Red Gummy → Glows → “Lock Choice” → Screen fades → Player 2 prompted.
- **Gameplay**: Player 1 taps Blue Lollipop → Pop-up: “Pick Blue Lollipop?” → Confirm → Candy zooms to pile, count updates to 1/9.
- **End**: “Player 1 Wins!” with confetti, reveals P1 (Green Jellybean), P2 (Chocolate).

---

**Version**: 1.0  
**Date**: June 16, 2025  
​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​
