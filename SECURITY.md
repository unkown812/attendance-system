# 🔐 Security Policy — AttenMo

This document outlines the security architecture, implemented protections, and vulnerability reporting process for the **AttenMo** smart attendance platform.

---

## 📋 Table of Contents

- [Supported Versions](#supported-versions)
- [Security Architecture Overview](#security-architecture-overview)
- [Authentication & Identity](#authentication--identity)
- [Anti-Proxy & Anti-Spoofing System](#anti-proxy--anti-spoofing-system)
- [Database Security Rules](#database-security-rules)
- [QR Session Integrity](#qr-session-integrity)
- [Geofencing & GPS Validation](#geofencing--gps-validation)
- [Student Session Management](#student-session-management)
- [Data Validation & Input Sanitization](#data-validation--input-sanitization)
- [AI Chatbot Worker Security](#ai-chatbot-worker-security)
- [Known Limitations](#known-limitations)
- [Reporting a Vulnerability](#reporting-a-vulnerability)

---

## ✅ Supported Versions

| Version | Support Status       |
|---------|---------------------|
| Latest  | ✅ Actively supported |
| Older   | ❌ No security patches |

Security updates are applied only to the latest release. Users should always use the most recent version of the web app and Android APK.

---

## 🏗️ Security Architecture Overview

AttenMo implements a **multi-layered security model** designed to prevent attendance fraud at every point of entry:

```
┌──────────────────────────────────────────────────────┐
│                     CLIENT LAYER                     │
│  ┌─────────────────┐   ┌──────────────────────────┐  │
│  │ Device Fingerprint│  │  Mock GPS Detection (APK)│  │
│  └─────────────────┘   └──────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│                  AUTHENTICATION LAYER                │
│  ┌─────────────────┐   ┌──────────────────────────┐  │
│  │  Google OAuth   │   │  First-Scan UID Binding  │  │
│  │  (Firebase Auth)│   │  (Roll → UID lock)       │  │
│  └─────────────────┘   └──────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│                    SESSION LAYER                     │
│  ┌─────────────────┐   ┌──────────────────────────┐  │
│  │ Expiring QR     │   │  student_auth_sessions   │  │
│  │ (5-min TTL)     │   │  (2-min OTP relay)       │  │
│  └─────────────────┘   └──────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│                    DATABASE LAYER                    │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Firebase RTDB Rules — Auth + Schema Validation │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 🔑 Authentication & Identity

### Google OAuth via Firebase Auth
- All CR (Class Representative) logins use **Firebase Authentication** with Google OAuth 2.0.
- Firebase ID tokens are verified server-side by Firebase before any privileged database write is allowed.
- Session tokens are managed entirely by Firebase SDK — no custom JWT implementation is used.

### First-Scan UID Binding
- When a student submits attendance using Google Sign-In for the first time, their **Google UID is permanently bound** to their Roll Number in the `google_user_links` node.
- Subsequent submissions verify this binding. A mismatched UID is silently flagged as suspicious.
- This prevents students from sharing accounts or roll numbers to submit each other's attendance.

### Phone OTP (CR Fallback)
- Phone number authentication is offered as a fallback login for CRs using Firebase's built-in OTP service.
- OTP codes are time-limited and verified entirely by Firebase servers.

---

## 🛡️ Anti-Proxy & Anti-Spoofing System

### 1. Device Fingerprinting (Web)
A **3-layer persistent Device ID** is generated per student browser:
1. `localStorage` (primary)
2. `sessionStorage` (backup)
3. HTTP Cookie (tertiary fallback)

If a device ID is detected across multiple roll numbers within a session, the submission is silently flagged as a **proxy attempt** and routed to the CR's requests panel for manual review.

### 2. Mock GPS / Location Spoofing Detection (Android APK)
The native Android APK implements `MockLocationChecker`, a custom Capacitor plugin that:
- Uses `Location.isMock()` on **Android 12+** (API 31+)
- Falls back to `Location.isFromMockProvider()` on **Android 4.3–11**
- Rejects submissions where `isMock: true` is detected

This blocks popular GPS spoofing apps (e.g., Fake GPS, Mock Locations) at the OS level, independent of the browser environment.

### 3. Suspicious Flag System
Submissions are automatically flagged (⚠️) for CR review when:
- The device ID is associated with more than one roll number
- The submitted location is outside the configured geofence boundary
- The student denied location access
- A mock GPS signal is detected on the Android APK
- A late check-in occurs after session expiry

---

## 📜 Database Security Rules

Firebase Realtime Database rules enforce **authentication + schema validation** on every write. Key rules:

| Node | Read | Write | Notes |
|------|------|-------|-------|
| `users/$uid` | Any authenticated user | Only own UID | Profile isolation |
| `attendance/$session` | Any authenticated user | Auth required; no overwrites | Append-only |
| `requests/$session` | Any authenticated user | Auth required; no overwrites | Append-only |
| `qr_sessions/$id` | Any authenticated user | Auth required | Schema validated |
| `google_user_links/$uid` | Any authenticated user | Only own UID | UID binding lock |
| `feedbacks/$id` | Any authenticated user | Write-once; `now` timestamp enforced | Prevents backdating |
| `student_auth_sessions/$key` | Auth + unused + created within 2 min | Auth + delete-only | One-time relay token |
| `fcm_tokens`, `student_preferences`, `sent_push_alerts` | Any authenticated user | Any authenticated user | Preference data |

### Field-Level Validation
Attendance and request records enforce server-side **schema validation** rules:
- Required fields must be present (`name`, `rollNo`, `timestamp`, etc.)
- String length limits enforced (e.g., `name ≤ 100 chars`, `rollNo ≤ 40 chars`)
- `timestamp` must be a number; `status` must be a string
- Feedback timestamps are validated against server `now` to prevent backdating

---

## ⏱️ QR Session Integrity

- Each QR code encodes a **unique session ID** with a **5-minute default expiry** (`expiryTime` stored in `qr_sessions`).
- On submission, the client and server both validate that `now < expiryTime`. Expired sessions are rejected outright.
- Auto-cleanup removes the `qr_sessions` node entry immediately when the timer reaches zero, preventing re-use of expired session tokens.
- Session IDs are cryptographically random and not enumerable or guessable.

---

## 📍 Geofencing & GPS Validation

- CRs define a circular geofence from **10 meters to 2.0 km** radius.
- Student GPS coordinates are validated against the stored center coordinates and radius.
- A **smart auto-approval tolerance** of **1.8× radius or +60m** accounts for GPS drift without manual CR intervention.
- Submissions outside the expanded tolerance are marked as **out-of-boundary** and sent to the CR's request panel.
- Location is verified **client-side** for instant feedback. CRs can cross-verify via the admin dashboard.

> **Note:** Client-side geofencing is the primary check. A server-side Cloud Function re-validation layer is planned as a future enhancement.

---

## 🔐 Student Session Management

The `student_auth_sessions` node provides a **secure one-time relay mechanism** for the Student Portal (`track.html`):

1. A session key is created by an authenticated client with a 2-minute TTL (`createdAt > now - 120000`).
2. The key can only be **read** if it is unused (`used === false`) and within the TTL window.
3. Once consumed, the key is **deleted** (only delete writes are allowed on existing records).
4. This prevents session replay attacks and ensures each authentication event is consumed exactly once.

---

## 🧹 Data Validation & Input Sanitization

- All user-supplied strings (name, roll number, subject) are length-limited at the database rules layer.
- No raw HTML is injected into the DOM from database values without explicit sanitization.
- QR session parameters are validated by the database schema before storage.
- Feedback entries require all mandatory fields and server-enforced timestamp matching.

---

## 🤖 AI Chatbot Worker Security

The support chatbot runs on **Cloudflare Workers** (`attenmo-support-worker`) and:
- Never receives or stores personally identifiable user data.
- Uses API keys stored as **Cloudflare Worker environment secrets** — never exposed to the client.
- Implements a **fallback chain**: Gemini 2.5 Flash → OpenRouter, ensuring no API key fallback is visible in client code.
- Rate limiting is handled at the Cloudflare edge layer.

---

## ⚠️ Known Limitations

| Area | Limitation | Mitigation |
|------|-----------|------------|
| Geofencing | Client-side only; a determined user can intercept and modify coordinates in the browser | Mock GPS detection (APK) + suspicious flag system |
| Device Fingerprint | Can be cleared by a user who clears browser storage | Multi-layer fallback (localStorage + sessionStorage + cookie) reduces bypass probability |
| Web vs. APK | Mock GPS detection only works in the native APK, not the web browser | Students using the APK are protected; web users rely on geofence and flag system |
| Firebase Auth | Guest/anonymous sessions not supported for CRs | All CR actions require authenticated identity |
| Realtime DB Rules | `attendance` node allows unauthenticated writes to existing records (legacy rule) | Existing records are validated on first write; overwrites are blocked at session level |

---

## 🚨 Reporting a Vulnerability

We take security issues seriously. If you discover a vulnerability in AttenMo, please **do not open a public GitHub issue**.

### How to Report

**Contact the developer privately:**

- 📧 **Email**: attenmo.tech@gmail.com *(preferred for sensitive disclosures)*
- 💬 **WhatsApp Community**: [AttenMo Community](https://chat.whatsapp.com/GDOjvKK7nxGFvQ7NSrQNiG)
- 💼 **LinkedIn**: [Shivam Kumar Mahto](https://www.linkedin.com/in/shivam-kumar-mahto-046228361/)

### What to Include

Please include as much of the following as possible:
- Type of vulnerability (e.g., authentication bypass, XSS, database rule exploit)
- Affected component (web app, Android APK, Firebase rules, Cloudflare Worker)
- Step-by-step reproduction instructions
- Potential impact assessment
- Any suggested mitigation (optional)

### Response Timeline

| Stage | Target Time |
|-------|-------------|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 7 days |
| Fix or workaround | Within 30 days (critical: within 7 days) |
| Public disclosure | After fix is deployed |

We appreciate responsible disclosure and will credit reporters in the release notes (with your permission).

---

## 📄 Legal

This project is **proprietary and confidential**. Security research must not involve:
- Unauthorized access to production data or user accounts
- Automated scanning or DoS attacks against production endpoints
- Extraction or exfiltration of any user data

Testing should be performed only on your own self-hosted or development instances.

---

*Last updated: July 2026 | Maintained by [Shivam Kumar Mahto](https://github.com/shivam238)*
