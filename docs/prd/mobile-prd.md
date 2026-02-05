# PCD Mobile App: Product Requirements Document (PRD)

## Project Status: [COMPLETE & VERIFIED]
This project has successfully migrated the **Poisoned Candy Duel (PCD)** web application into a high-performance, modular React Native mobile application. All core game mechanics, real-time matchmaking, and the currency system have been implemented with strict logic parity.

## Core Conversion Principles
1.  **Strict Logic Parity**: Move all business logic from `web-app/js/*.js` into decoupled React Hooks and Services.
2.  **Modular Componentization**: Break down the monolithic structure of the web app into reusable React components.
3.  **Aesthetic Continuity**: Mirror the premium look and feel (gradients, animations, glassmorphism) using React Native's styling system.
4.  **Native Performance**: Utilize native-optimized components like `FlatList` for grids and `Animated` API for transitions.

---

## Technical Stack
- **Framework**: React Native (TypeScript/TSX)
- **Navigation**: React Navigation (Stack & Tab)
- **State Management**: Zustand
- **Persistence**: AsyncStorage
- **Icons**: `lucide-react-native`
- **Networking**: Axios & WebSockets

---

## Proposed Folder Structure
The codebase will follow a feature-based modular structure to prevent the "long-code" issue present in the web app.

```text
/React-native
├── assets/               # Local images, fonts
├── src/
│   ├── assets/           # Application-specific visual assets
│   ├── components/       # UI Components
│   │   ├── common/       # Buttons, Inputs, Loaders, Modals
│   │   ├── game/         # CandyGrid, Timer, MatchmakingCard, CollectionView
│   │   └── layout/       # Screen containers, Headers, TabBars
│   ├── hooks/            # Business logic (e.g., useGameEngine, useAuth, useMatchmaking)
│   ├── navigation/       # Navigation configuration (MainNavigator, AuthNavigator)
│   ├── screens/          # Screen-level components
│   │   ├── AuthScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── GameScreen.tsx
│   ├── services/         # API, WebSockets, P2P Managers
│   ├── store/            # Global Context providers
│   └── utils/            # Constants, Theme, Helper functions
├── App.js                # Root Component
├── app.json              # Config
└── package.json          # Dependencies
```

---

## MVP Roadmap & Steps

### Phase 1: Foundation & UI System [COMPLETED]
- **Step 1.1**: Set up `src/utils/theme.js` containing color palettes, spacing, and typography mirrored from `main.css`. [DONE]
- **Step 1.2**: Create generic layout components (e.g., `ScreenContainer.js` with linear gradients). [DONE]
- **Step 1.3**: Set up React Navigation with initial stacks for Auth and Main app. [DONE]

### Phase 2: Logic Migration (The Engine) [COMPLETED]
- **Step 2.1**: **Service Layer**: Implement `src/services/api.ts` by porting logic from `web-app/js/api.js`. [DONE]
- **Step 2.2**: **Auth Hook**: Port `auth-manager.js` into `useAuth.ts` hook and `authStore.ts` Zustand store. [DONE]
- **Step 2.3**: **Game Engine**: Port the core duel logic, AI picking strategies, and Fair Play (Draw) rules into `gameStore.ts`. [DONE]
- **Step 2.4**: **Specialized Services**: Implement `candyPool.ts` (city-based) and `timerSync.ts`. [DONE]

### Phase 3: Compartmentalized Game UI [COMPLETED]
- **Step 3.1**: **CandyGrid Component**: Convert the HTML table/grid logic into a React Native component using `View` and `TouchableOpacity`. [DONE]
- **Step 3.2**: **CollectionPanel**: Replicate the side panels/visual score tracking. [DONE]
- **Step 3.3**: **ArenaDashboard**: Build the matchmaking/city selection UI (in `HomeScreen`). [DONE]
- **Step 3.4**: **Navigation Integration**: Connect the Home, Auth, and Game screens. [DONE]

### Phase 4: Real-time Integration & Polish [COMPLETED]
- **Step 4.1**: **WebSocket Service**: Ported matchmaking WebSocket logic. [DONE]
- **Step 4.2**: **Matchmaking UI**: Implemented searching overlay and state synchronization. [DONE]
- **Step 4.3**: **Polish**: Added candy picking animations, haptics, and result modals. [DONE]

### Phase 5: Currency & Polish [COMPLETED]
- **Step 5.1**: **Currency Logic**: Ported `currency-manager.js` to `currencyStore.ts`. [DONE]
- **Step 5.2**: **Economy Loop**: Integrated entry fees and victory prizes into `gameStore`. [DONE]
- **Step 5.3**: **Daily Rewards**: Implemented streak-based rewards with UI. [DONE]
- **Step 5.4**: **Stability**: Added `ErrorBoundary` and verified offline state persistence. [DONE]

---

## Detailed Component Mapping (Web vs Mobile)

| Web Context (HTML/JS) | React Native Component | Logic Destination |
| :--- | :--- | :--- |
| `#game-container` | `GameScreen.js` | `useDuel.js` |
| `.candy-grid` | `CandyGrid.js` | `useGameEngine.js` |
| `#auth-modal` | `AuthScreen.js` | `useAuth.js` |
| `matchmaking.js` | `MatchmakingCard.js` | `services/Matchmaking.js` |
| `main.css` | `src/utils/theme.js` | N/A |
| `localStorage` | `AsyncStorage` | `utils/storage.js` |

---

## Future Roadmap
1.  **Sound Design**: Add a library of high-fidelity SFX for candy collection and win/loss states.
2.  **Social Features**: Implement a "Friends List" and direct challenge invites via WebSockets.
3.  **Global Leaderboards**: Integrate with the backend to show top players across the season.
4.  **In-App Purchases**: Wire up the "Diamond Shop" to Apple App Store / Google Play APIs.

---
**Project Lead**: Antigravity AI
**Final Status**: All MVP modules delivered and verified.
