# Lessons Learned

## Security
- **Sensitive Data in Broadcasts**: Never broadcast raw state objects that contain sensitive fields (like `poison_choice`) to all players. Use a "viewer-aware" sanitization method to Tailor messages for each recipient.
- **Server-Side AI Logic**: Keep AI decision-making on the server to prevent players from inspecting AI's internal state via frontend debug tools.

## Reliability
- **Matchmaking Robustness**: When popping players from a queue for matching, ensure that all subsequent steps (payment, game creation, etc.) are handled. If a step fails, notify players or have a recovery mechanism so they are NOT left in a "limbo" state outside the queue without a game.

## Rust Development
- **Missing Imports during Port**: When porting logic (like AI), always check for missing imports (`Uuid`, `AppError`) that might have been implicit in the source or missed during the move.
- **Cargo Check**: Regularly run `cargo check` to catch compilation errors early, especially after multi-file edits.
