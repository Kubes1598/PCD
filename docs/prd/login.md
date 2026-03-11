# PCD Authentication & Login PRD (v1.5)

This document outlines the authentication and authorization (IAM) features of the Poisoned Candy Duel (PCD) platform, distinguishing between implemented features and those remaining in the roadmap.

## 1. Core Security Strategy (NIST/OWASP Compliance)

Our IAM design follows the principle of **Zero-Trust** where a successful login is not a blanket permission.

### A. Authentication vs Authorization
- **Authentication**: Centralized identity flow (Password, Passkey, OAuth). 
- **Authorization**: **Deny-by-default** applies to every request. **Step-Up** required for high-risk actions.

### B. Session as the Security Boundary
- **24-Hour Access Tokens**: Short-lived JWTs to minimize blast radius.
- **Persistent Refresh Tokens**: 30-day stateful tokens in DB with **Mandatory Rotation** on every refresh.
- **Instant Revocation**: Redis-based access blacklist + DB-based refresh token deletion.

### C. Layered Connection Governance
- **Admission Control**: Distributed caps on global (10k), per-user (3), and per-IP connections.
- **Runtime Throttling**: Message rate limiting (5/5s) and size checks (32KB) for long-lived WebSockets.

---

## 2. Feature Status: What We Have (✅ IMPLEMENTED)

### ✅ Hardened Brute-Force Protection
- **Account Lockout**: Accounts are automatically locked for **15 minutes** after 5 consecutive failed login attempts.
- **Audit Trails**: Every failed attempt and lockout event is recorded for administrative review.

### ✅ Stateful & Rotational Sessions
- **Persistent Sessions**: Users stay logged in for 30 days via DB-backed refresh tokens.
- **Token Rotation**: Refresh tokens are rotated on every use, making stolen refresh tokens statistically easier to detect.
- **Full Revocation**: Logging out invalidates the entire session chain (Access and Refresh).

### ✅ Layered WebSocket Governance
- **Distributed Per-User Caps**: Enforces a limit of 3 concurrent connections per player.
- **Runtime Message Throttling**: Limits messages and packet size to prevent buffer overflow and engine DoS.

### ✅ Step-Up Authentication (Tiered Proofs)
- **Assurance Tiers**: Destructive actions (Account Deletion) require a short-lived (5 min), action-bound security proof.
- **Proof Consumption**: Proofs are destroyed after first use.

### ✅ Persistent Guest & Native Data Transfer
- **Device ID Binding**: Guests maintain stats across sessions and receive refresh tokens.
- **Identity Upgrade**: Seamless guest-to-account migration preserving all history.

### ✅ Audit & Compliance Logging
- **Financial Guards**: Automatic `warning` logs for transfers > 10,000 coins or 100 diamonds.

---

## 3. Feature Status: What Is Missing (Roadmap)

### ❌ Social OAuth Signature Verification (Q2)
- Proper cryptographic verification of Google and Apple ID tokens using JWKS public keys. (Currently using valid placeholders).

### ❌ Biometric/Passkey Integration (Q3)
- Wiring the Step-Up framework to real WebAuthn challenges.

---

## 4. Immediate Security Roadmap

1. **Integrated Social ID Verification**: Moving from placeholders to full JWKS signature validation.

*Verified by PCD Engineering Team | Production-Safe Design Ref v1.5*
