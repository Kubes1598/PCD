# Online Multiplayer Testing Guide

## 🎯 **How to Test Online Multiplayer**

The PCD game now has full online multiplayer with automatic matchmaking. Here's how to test it thoroughly:

## 🚀 **Quick Start Testing**

### **Prerequisites**
1. ✅ Backend running on `http://localhost:8000`
2. ✅ Frontend running on `http://localhost:3002`
3. ✅ Both servers are healthy

### **Method 1: Two Browser Tabs (Easiest)**

1. **Open Tab 1:**
   ```
   http://localhost:3002
   ```
   - Click "Play Online" 
   - Click "Find Random Player"
   - Should show "Looking for players..." with queue position

2. **Open Tab 2:**
   ```
   http://localhost:3002  
   ```
   - Click "Play Online"
   - Click "Find Random Player"
   - **Both should automatically match within seconds!**

3. **Expected Result:**
   - Both tabs should show "Player found! Starting game vs [opponent]"
   - Both should navigate to the game board
   - Players can take turns picking candies
   - Profile feedback shows "Yummy! 😋" or "Got ya!!! 🎉"

## 🔧 **Advanced Testing Methods**

### **Method 2: Different Browsers**
- **Chrome**: `http://localhost:3002`
- **Firefox/Safari**: `http://localhost:3002`
- **Edge**: `http://localhost:3002`

Each browser acts as a completely separate player.

### **Method 3: Incognito/Private Windows**
- **Regular Window**: Normal browsing session
- **Private/Incognito Window**: Separate session
- Different localStorage = Different players

### **Method 4: Multiple Devices**
- **Computer**: `http://localhost:3002`
- **Phone**: `http://your-computer-ip:3002` (if on same network)
- **Tablet**: `http://your-computer-ip:3002`

## 🛠 **Debug Testing Tools**

### **Console Commands** (Open Browser DevTools → Console)

```javascript
// Check matchmaking status
showMatchmakingDebugInfo();

// Simulate a second player for testing
simulateSecondPlayer();

// Check backend health
fetch('http://localhost:8000/health').then(r => r.json()).then(console.log);

// Check matchmaking queue
fetch('http://localhost:8000/matchmaking/status').then(r => r.json()).then(console.log);
```

### **Expected Console Output**
```
🔍 MATCHMAKING DEBUG INFO:
- Player ID: player_1699123456789_abc123def
- Player Name: Anonymous
- Is Searching: true
- WebSocket State: 1 (OPEN)
- Game Mode: online
- Queue Size: 2
- Waiting Players: [...]
```

## 🎮 **Complete Testing Checklist**

### **Connection Testing**
- [ ] Player can click "Find Random Player"
- [ ] "Looking for players..." appears
- [ ] Queue position updates (Position in queue: 1)
- [ ] Players can cancel search
- [ ] Match found notification appears
- [ ] Both players navigate to game board

### **Gameplay Testing**
- [ ] Both players see opponent's name
- [ ] Turn-based gameplay works
- [ ] Player 1 can pick candies from Player 2's grid
- [ ] Player 2 can pick candies from Player 1's grid
- [ ] Candy collection updates in real-time
- [ ] Profile feedback shows "Yummy! 😋" when picking candy
- [ ] Profile feedback shows "Got ya!!! 🎉" when someone picks poison
- [ ] Win/lose conditions work correctly
- [ ] Game ends properly for both players

### **Profile Feedback Testing**
- [ ] "Yummy! 😋" appears on picker's profile
- [ ] "Got ya!!! 🎉" appears on winner's profile when poison picked
- [ ] Feedback animates smoothly
- [ ] Multiple feedbacks don't conflict
- [ ] Feedback appears above correct player profiles

### **Network Testing**
- [ ] Connection survives brief network interruption
- [ ] Reconnection works if WebSocket drops
- [ ] Error handling for backend downtime
- [ ] Graceful degradation when matchmaking fails

## 🚨 **Troubleshooting Common Issues**

### **"Unable to connect to matchmaking server"**
```bash
# Check if backend is running
curl http://localhost:8000/health

# Check if matchmaking endpoint works
curl http://localhost:8000/matchmaking/status
```

### **"Failed to start matchmaking"**
- Check browser console for errors
- Ensure WebSocket connection is not blocked
- Try refreshing the page

### **Players don't get matched**
```javascript
// Check queue status in console
showMatchmakingDebugInfo();
```

### **Game doesn't start after match**
- Check if both players navigated to game screen
- Verify game state is properly initialized
- Check for JavaScript errors in console

## 🎯 **Manual Testing Scenarios**

### **Scenario 1: Basic Matchmaking**
1. Two players search for game
2. Automatic matching occurs
3. Game starts successfully
4. Players take turns
5. Game ends with winner

### **Scenario 2: Poison Pick**
1. Players take turns normally
2. One player picks opponent's poison
3. Winner gets "Got ya!!! 🎉" feedback
4. Game ends immediately
5. Proper win/lose message

### **Scenario 3: Network Interruption**
1. Start online game
2. Temporarily disconnect one player's internet
3. Reconnect network
4. Verify game continues or handles gracefully

### **Scenario 4: Multiple Simultaneous Games**
1. Open 4+ browser tabs
2. Start matchmaking in pairs
3. Verify multiple games run simultaneously
4. Check backend handles concurrent connections

## 📊 **Performance Testing**

### **Load Testing**
```javascript
// Simulate multiple players
for(let i = 0; i < 10; i++) {
    setTimeout(() => simulateSecondPlayer(), i * 1000);
}
```

### **WebSocket Health**
- Monitor WebSocket connections in DevTools → Network
- Check for proper handshake
- Verify message exchange during gameplay

## ✅ **Success Criteria**

A successful online multiplayer test should achieve:

1. **< 5 seconds** match time with 2 players
2. **Real-time** move synchronization  
3. **Contextual feedback** on player profiles
4. **Graceful error handling**
5. **Proper game state management**
6. **Clean session cleanup**

## 🎉 **Ready to Test!**

The system is now ready for comprehensive testing. Start with Method 1 (two browser tabs) for the quickest verification, then proceed to more advanced scenarios.

**Pro Tip**: Keep browser DevTools open during testing to monitor WebSocket connections and catch any errors! 