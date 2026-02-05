# Task: Initialize Workflow and Review Codebase State

## Done
- [x] Review `instruction.md`
- [x] Create `tasks/` directory and required files (`todo.md`, `lessons.md`)
- [x] Review recent changes in `backend-rust/src/routes/ai.rs` and `backend-rust/src/ws/matchmaking.rs`
- [x] Fix missing imports in `backend-rust/src/routes/ai.rs`
- [x] Verify if AI's poison selection is removed from game creation response (Verified: AI mode is safe)
- [x] Fix WebSocket sensitive data leak (poison_choice revealed in broadcasts)
- [x] Verify atomic transaction implementation for entry fees
- [x] Make matchmaking loop more robust for payment failures
- [x] Verify backend compilation (`cargo check`)

## Upcoming
### 1. Verification & Testing
- [ ] Implement unit tests for `GameSession::for_viewer` sanitization
- [ ] Test the payment failure path in matchmaking with a simulated scenario

### 2. Further Security Audits
- [ ] Audit `backend-rust/src/middleware/auth.rs` for JWT best practices
- [ ] Check if `diamonds_balance` is properly handled in transactions
