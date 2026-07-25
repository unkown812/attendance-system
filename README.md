# 📱 AttenMo

A high-performance, **Firebase-powered web application** for seamless student attendance management using **dynamic QR codes**, **smart geofencing**, **Google Meet integration**, and a built-in **anti-proxy detection engine**.

---

## 🚀 Key Features

### Core Attendance
- **⚡ Real-time Tracking**: Live attendance updates powered by Firebase Realtime Database.
- **🔐 Secure QR Sessions & Auto-Cleanup**: Unique QR codes (5 min default) with auto-expiry. Database cleans up expired session data instantly when the timer runs out to prevent bypass.
- **📍 Smart Geofencing with Auto-Approval**: Circle boundary geofencing from **10m to 2.0 km**. Automatically approves and marks present students within a minor GPS-drift tolerance (1.8x radius or +60m), saving manual approval time.
- **🔔 Request Management**: Auto-flags late check-ins, out-of-boundary submissions, GPS denials — with one-click CR approval/rejection.

### 🛡️ Anti-Proxy & Authentication System *(Enhanced)*
- **Mandatory Google Auth (First-Scan Binding)**: Students must sign in via Google. Their Google UID binds permanently to their roll number on the first scan, preventing account/roll sharing.
- **Mock GPS Spoofing Detection**: Integrated native Android APK checks (via `MockLocationChecker`) that detect and block fake GPS applications.
- **Device Fingerprinting**: Persistent 3-layer Device ID (localStorage → sessionStorage → cookie) to uniquely identify student devices and silently flag proxy/shared device attempts.

### 🔔 Native Notifications & Audio
- **OS-Level Push Notifications**: Browser native notifications and native Android tray notifications (via Capacitor) for each attendance submission.
- **Distinct Audio Chimes**: Web Audio API double tone for normal, warning chime for proxy/suspicious submissions.

### 🎓 Roster Syncing & Google Meet Import
- **Google Sheets Live Sync**: Sync student lists instantly using a public Google Sheets CSV URL.
- **Google Classroom Import**: Fetch courses and rosters directly from Google Classroom using Google Identity Services (GIS) OAuth.
- **Google Meet Attendance Import**: Paste Google Meet participants list to auto-match names using smart fuzzy matching and alias memory.

### 📊 Dashboard & Reporting
- **👨‍🏫 CR Dashboard**: Tabs for QR generation, live feed, today's summary, student management, history, requests, and Export Hub.
- **👩‍🎓 Student Portal** (`track.html`): Subject-wise attendance percentage, logs, PDF export.
- **📊 Export Hub & Auto-Export**: Manual/Matrix Excel reports (`.xlsx`). Prompts with a shareable Excel file for immediate download or native mobile sharing as soon as a session is closed.
- **🤖 AI Support Chatbot**: Chatbot on the Contact page powered by Gemini 2.5 Flash with OpenRouter fallback on Cloudflare Workers.

---

## 🧭 Quick Start Guide

### 👨‍🏫 For CRs / Educators

1. **Sign In**: Google login (recommended) or phone OTP.
2. **Setup**: Add class details, subjects, and student list (`NAME - ROLLNO` format per line).
3. **Generate QR**: Select subject → click **Generate QR Code** → share fullscreen or copy link.
4. **Monitor**: Watch live attendance feed with OS notifications and audio chimes.
5. **Online Class**: Use **🟢 MEET IMPORT** → paste Google Meet participant list → auto-match & save.
6. **Review**: Approve/reject pending requests; audit ⚠️ Suspicious entries.
7. **Export**: Download Excel report from Export Hub.

### 👩‍🎓 For Students

1. **Scan** the CR's QR code or open the shared link.
2. **Enter** Roll Number (or full name).
3. **Allow** location if requested.
4. **Submit** — get instant confirmation or pending approval notice.
5. **Track** attendance anytime via `track.html` using Class ID + Roll Number.

---

## ⚙️ Built With

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| **Backend / DB** | Google Firebase (Auth + Realtime Database + Hosting) |
| **AI Chatbot** | Gemini 2.5 Flash (primary) + OpenRouter (fallback) on Cloudflare Workers |
| **Mapping** | Leaflet.js + Nominatim (OpenStreetMap) |
| **Classroom OAuth** | Google Identity Services (GIS) |
| **QR Generation** | qrcode.js |
| **Excel Export** | SheetJS (xlsx) |
| **Notifications** | Browser Notification API + Web Audio API |
| **PWA** | Service Worker (cache-first/network-first strategy) |

---

## 🌐 Live URLs

- **Main App**: https://attenmo.web.app
- **AI Support Worker**: https://attenmo-support-worker.sm3165599.workers.dev

---

## 📱 Mobile Application (Android APK)

AttenMo is fully integrated with **Capacitor** to build a native Android app.

### 📥 Download Android App
Download the compiled, ready-to-install Android APK directly from our official release:
👉 **[Download AttenMo APK (Latest)](https://github.com/shivam238/attendance-system/releases/latest/download/AttenMo.apk)**

### 🌟 Mobile-Specific Features
- **Instant Entry**: Detects Capacitor and automatically bypasses the landing page to load the login screen instantly.
- **Native Notifications**: Integrated with `@capacitor/local-notifications` to send native push notifications to the device system tray.
- **Custom App Branding**: Custom launcher icons and splash screens compiled using `@capacitor/assets`.

### 🛠️ Building & Deploying (Unified Automation Pipeline)

The project includes a master deployment script `deploy-all.sh` that automates compilation, release publishing, server hosting updates, and Git pushes in one command:

```bash
bash deploy-all.sh "Your commit message"
```

This single command executes:
1. **Regenerates PDF Manual**: Creates a fresh `public/QR Attendance System - Complete User Manual.pdf` from the updated `manual.html`.
2. **Compiles Android APK**: Builds `AttenMo.apk` using Android Gradle and Capacitor.
3. **Auto-Publishes to GitHub Releases**: Uses `upload-apk.py` to connect via the GitHub API, deletes the old APK asset, and uploads the new APK to the latest release automatically.
4. **Installs on Test Device**: Automatically pushes and updates the app via ADB on any connected Android smartphone.
5. **Firebase Hosting Deploy**: Deploys front-end static assets to Firebase.
6. **Cloudflare Worker Deploy**: Deploys the support assistant worker to Cloudflare.
7. **Git Synchronization**: Commits and pushes the latest updates to the GitHub repository.

To only compile the APK locally without publishing or deploying:
```bash
bash build-app.sh
```

---

## 📄 License & Attribution

This project is **proprietary and confidential**. All rights are reserved. Copying, redistribution, modification, or commercial use of this codebase and its compiled assets (including the APK) is strictly prohibited without the express written permission of the developer.

**Developed by Shivam Kumar Mahto**  
🔗 [GitHub](https://github.com/shivam238) | 💬 [WhatsApp Community](https://chat.whatsapp.com/GDOjvKK7nxGFvQ7NSrQNiG) | 📷 [Instagram](https://www.instagram.com/theattenmo/) | 💼 [LinkedIn](https://www.linkedin.com/in/shivam-kumar-mahto-046228361/)

© 2026 Shivam Kumar Mahto (AttenMo). All rights reserved.


---

