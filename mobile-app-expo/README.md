# BillVaultAI Mobile App (Expo / React Native)

A state-of-the-art, cross-platform mobile application for **BillVaultAI**, featuring 100% copy-to-copy design, feature, and workflow parity with the web application portal (`frontend-user`).

---

## 📱 Features & Highlights

- **Dark Glassmorphic Aesthetic**: Matches the dark ambient aesthetic (`#0B0F17` background with `#161F30` glass cards and `#06B6D4` / `#10B981` primary accents).
- **Authentication**: Sign In, Sign Up, and Password Reset with 6-digit OTP code verification.
- **Dashboard**:
  - Top financial KPI stat tiles (Total Invoices, Billed Volume, Settled, Outstanding).
  - AI Spatial Insights banner highlighting real-time liabilities.
  - Interactive search bar and recent invoices list with status pills (`PAID`, `UNPAID`, `OVERDUE`).
  - Notifications Bell popover panel with unread alert badges.
- **AI Document Upload**:
  - Ingest invoices via Camera capture, Device Image Gallery, or PDF document picker.
  - Live progress animation and instant backend queueing.
- **Invoice Vault / History**:
  - Filter by expense categories (`All`, `Office`, `Travel`, `Food`, `Utilities`, `Medical`, `Electronics`).
  - Search by vendor merchant or invoice number.
- **Unpaid Invoices Registry**:
  - Track unpaid balance, due date alerts, and overdue warnings.
  - Direct **"✓ PAY NOW"** action to update invoice payment status to `PAID` via API.
- **Bill Detail Modal**:
  - Preview invoice fields, confidence score, payment terms, and date details.
- **Profile & Subscription**:
  - View account details, avatar, and monthly upload usage quota (`uploads_used` / `uploads_limit`).
  - Upgrade to Pro tier with instant backend integration.
- **Admin Console**:
  - Full admin tab visibility for administrator accounts to monitor user metrics and server stats.

---

## 🚀 How to Run on Physical Phone or Emulator

### Prerequisites
1. Install **Node.js** (v18 or higher) on your PC.
2. Install **Expo Go** app from Google Play Store (Android) or Apple App Store (iOS) on your physical phone.

### Steps to Launch
1. Ensure your computer and your phone are connected to the **same Wi-Fi network**.
2. Open terminal in the `mobile-app-expo` folder:
   ```bash
   cd mobile-app-expo
   npm start
   ```
3. A **QR code** will display in your terminal console.
4. Open the **Expo Go** app on your phone and scan the QR code.
5. The application will immediately load and launch on your device!

---

## 🌐 Network Configuration

To ensure your physical phone can talk to the FastAPI backend running on your PC:
- Open `src/config/apiConfig.ts`.
- Replace `192.168.1.100` with your PC's local Wi-Fi IP address (obtainable via `ipconfig` on Windows).
- Ensure your FastAPI backend server is running (`uvicorn app.main:app --host 0.0.0.0 --port 8000`).
