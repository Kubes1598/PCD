# PCD Authentication & Security Engineering Guide (v2.2)

This document defines the implementation details and the core security philosophy for the Poisoned Candy Duel (PCD) platform. It aligns with modern **NIST SP 800-63B** and **OWASP** standards.

---

## 1. Core Security Pillars (The Unified Security Model)

### ✅ Strict Separation of AuthN vs AuthO
- **Authentication**: Centralized identity flow (Password, Guest, OAuth placeholders).
- **Authorization**: **Deny-by-default**. Every request (REST, WS, AI) is verified server-side.

### ✅ Session as a Statistically Revocable Boundary
- **24-Hour Access Tokens**: Short-lived JWTs to minimize blast radius.
- **30-Day Refresh Tokens**: Database-tracked with **Mandatory Rotation** on every refresh.
- **Immediate Revocation**: Redis (Access) + DB (Refresh) ensures sessions can be severed instantly on logout.

### ✅ IDOR & Spoofing Protection
- **Identity Derivation**: Uses JWT claims exclusively for identity.
- **Participation Verification**: Every game-related action is verified against the specific game session participants.

---

## 2. Layered WebSocket Governance (Implemented)

For a "1M Users" scale, we implement a **Distributed Connection Governor**:

### A. Admission Control (The Handshake)
- **Global Cap**: 10,000 concurrent sockets max.
- **Per-User Cap**: **3 concurrent connections** (Primary for authenticated users).
- **Per-IP fallback**: Cap for anonymous/pre-auth traffic.

### B. Runtime Governance (Inside the Socket)
The system remains proactive *after* the connection is established:
- **Message Rate Limiting**: Throttling to **5 messages per 5 seconds** (e.g. `ws_matchmaking`).
- **Message Size Limits**: Rejecting packets > **32KB** to prevent memory-based DoS.
- **Atomic Cleanup**: Distributed counters are atomically released in the `handle_socket` cleanup loop.

---

## 3. Account Hardening & Brute-Force Defense (Implemented)

### A. Lockout Policy
- **Threshold**: 5 consecutive failed login attempts on a single account.
- **Penalty**: 15 minutes of temporary lockout (`lockout_until` timestamp in DB).
- **Reset**: Successful login resets the error counter to zero.

### B. Audit & Compliance
- **Failed Logins**: Tracked with IP/Email for brute-force patterns.
- **Large Transfers**: Automatic warnings for transfers > 10,000 coins or 100 diamonds.
- **Transaction Integrity**: Every balance movement uses `BEGIN...COMMIT` blocks with atomic constraints.

---

## 4. Tiered Assurance & Step-Up MFA (Implemented)

We follow the rule: **"A low-risk session must not authorize a high-risk action."**

### A. Action Classification (Tiers)
| Tier | Action Example | Risk | Implementation |
| :--- | :--- | :--- | :--- |
| **Tier 0-1** | Casual Play, Reading Stats | Low | Base JWT session |
| **Tier 2** | Account Deletion, Deleting Game | **High** | **Scoped Step-Up Proof (MFA)** |

### B. Step-Up Logic (The "Proof-of-Assurance")
- **Scoped Proofs**: The re-auth result is bound to a specific `user_id` + `action_id`.
- **Short-lived window**: Valid for 300 seconds (5 min) before expiration.
- **Immediate Consumption**: Proof is deleted from Redis the *instant* it is verified, preventing replay attacks.
- **Consumer Validation**: Triggered automatically in `/account/delete` and other protected endpoints.

---

## 5. Current Security Flaws & Active Risks (Roadmap)

| Risk | Finding | High-Assurance Mitigation |
| :--- | :--- | :--- |
| **Social Spoofing** | OAuth routes currently skip signature verification with provider public keys. | Integrate `jsonwebtoken` with JWKS fetching for Google/Apple. |
| **Biometric Gap** | Step-Up is currently simulated via a `/stepup` endpoint. | Implement WebAuthn/Passkey triggers as the "Step-Up" factor. |

---

*Authored by Antigravity AI | Verified Production Security Reference v2.2*
