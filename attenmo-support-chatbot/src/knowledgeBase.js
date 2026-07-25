export default `
# AttenMo AI Customer Support Knowledge Base

Generated automatically from the repository manual and documentation.

## Creator & Developer Information

- **Creator & Developer**: **Shivam Kumar Mahto**
- **Creator Role**: Sole Creator, Developer, and Maintainer of the AttenMo application.
- **Creator Details**: Shivam Kumar Mahto is the developer who created AttenMo to digitize and automate student attendance tracking using QR codes and geofencing. He designed, implemented, and built the entire application using HTML5, CSS3, vanilla JavaScript, and Google Firebase.
- **Contact Channels**:
  - **Email**: attenmo.tech@gmail.com
  - **WhatsApp Community**: https://chat.whatsapp.com/GDOjvKK7nxGFvQ7NSrQNiG
  - **Instagram**: https://www.instagram.com/theattenmo/ (@theattenmo)
  - **LinkedIn**: https://www.linkedin.com/in/shivam-kumar-mahto-046228361/
- **Crucial Rule**: When asked "who created this app?", "who built this?", "developer contact", or "owner details", you MUST proudly mention **Shivam Kumar Mahto** and provide his contact details (email, WhatsApp Community, Instagram, and LinkedIn).

## Product & System Overview

AttenMo is a high-performance, Firebase-powered web and mobile application for QR-based student attendance.
- **Host Web URL**: \`https://attenmo.web.app\`
- **Database Backend**: Firebase Realtime Database.
- **Authentication**: Firebase Authentication (Google OAuth & Firebase Phone Auth).
- **PWA Capabilities**: Service worker handling offline assets and caching.
- **Mobile Environment**: Capacitor-wrapped native Android APK (~5 MB download size) containing native notifications and hardware-level mock location checks.

---

## System Features & User Manual (Official Documentation)

### 🌐 System Overview


> **[TIP]** 💡 AttenMo is 100% free — no subscription, no credit card. Built on Firebase + OpenStreetMap.


### 🎯 CR Registration (CR Only)


> **[TIP]** 💡 **Student Format:** Each student should be on one line as \`NAME - ROLLNO\` (e.g. \`RAHUL SHARMA - 29/B09/042\`). ChatGPT handles the formatting for you.


### 📲 Taking Attendance (CR Only)


#### QR Lifecycle & Security


> **[WARNING]** ⚠️ Each student can mark attendance **only once per QR session**. Duplicate submissions are automatically blocked.


### 📍 Geofencing & Location Verification (CR Only)


#### Setting Up


#### How Verification Works

- When a student submits attendance, the browser requests their GPS location.
- The Haversine formula calculates the exact distance from the classroom center.
- **Within range →** Attendance marked immediately ✅

> **[TIP]** 💡 GPS accuracy varies by device and network. The Smart Geofence tolerance handles minor drifts automatically, but it's still best to set a reasonable baseline radius.


### 🎓 Google Meet &amp; Classroom Integration (CR Only)


#### Google Meet Import


#### Google Classroom & Sheets Sync


### 🛡️ Anti-Proxy Security Engine (CR Only)


#### How It Protects Your Roster


### 📱 Mobile Application (Android APK) (All Users)


#### Key Features & Settings


### 👨‍🎓 Student Guide (Students)


#### Student Attendance Tracker (track.html)


> **[WARNING]** ⚠️ If your attendance shows as **"Pending CR Approval"**, it means you were outside the classroom boundary or denied GPS access. Your CR will review and approve/reject it manually.


### 🔔 Managing Requests (CR Only)

- Go to the **Requests** tab to see all pending attendance submissions.

### 📊 History & Export (CR Only)


#### View History

- Each session shows who was present and who was absent.

#### Export Hub & Reporting


### ⚙️ Account Management

- To add/edit/remove students, go to the **Students** tab.
- To add or rename subjects, click **📚 Manage Subjects**.

### 🤖 Customer Support & AI Assistant
`;
