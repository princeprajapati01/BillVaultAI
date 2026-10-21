# 📱 BillVaultAI Flutter Mobile Application (Android & iOS)

A cross-platform mobile application built with **Flutter & Dart** for **BillVaultAI (Aura Billing Suite)**. 

The mobile application connects directly to the existing **FastAPI backend** (`backend/`) without modifying any existing backend code, database schemas, or LLM pipeline logic.

---

## 🌟 Key Features

- **Dark Glassmorphic UI**: High-end Obsidian dark aesthetic (`#0B0F17`) matching the Next.js user portal with glowing cyan/emerald gradients.
- **Document Camera Scanner & Ingestion**:
  - Live Camera capture & Gallery image/PDF document picker.
  - Interactive **Scanning Laser Beam** animation overlay while background YOLOv8 + PaddleOCR processing executes.
- **Invoice Vault & Inline Field Editor**:
  - Filterable invoice vault by category chips (Travel, Fuel, Food, Software, Utilities, Medical, Electronics).
  - Search invoices by merchant name or invoice number.
  - Full-screen receipt preview modal with raw OCR output accordion.
  - Inline field editor allowing manual overrides (`PUT /api/bills/{id}`) for tax amounts, vendor name, category, and totals.
- **Financial Analytics**:
  - Category expenditure pie chart powered by `fl_chart`.
  - Monthly spending summary cards.
- **Admin Operation Console**:
  - Dedicated bottom-tab navigation for Admin accounts (`is_admin == true`).
  - Real-time CPU load, RAM memory usage, server uptime, and API latency metrics (`/api/admin/system-health`).
  - Account manager with instant user status toggles (`active` / `suspended`) and subscription plan assignment (`Free`, `Basic`, `Pro`, `Enterprise`).

---

## 🏗️ Architecture & Folder Structure

```
mobile_app/
├── lib/
│   ├── main.dart                      # Flutter Entrypoint & Auth Routing
│   ├── config/
│   │   ├── api_config.dart            # Backend IP & Endpoint URL Constants
│   │   └── app_theme.dart             # Glassmorphic Dark Design System & Color Tokens
│   ├── models/
│   │   ├── user_model.dart            # User Auth & Subscription Model
│   │   ├── bill_model.dart            # Invoice, Tax, Payment & Metadata Model
│   │   └── admin_stats_model.dart     # System Health & Dashboard Stats Models
│   ├── services/
│   │   ├── api_service.dart           # HTTP Base Client & Bearer JWT Interceptor
│   │   ├── auth_service.dart          # Login, Register, Email OTP, Password Reset
│   │   ├── bill_service.dart          # Image/PDF Document Upload & Bill CRUD
│   │   └── admin_service.dart         # Server Health, Metrics & User Management
│   ├── providers/
│   │   ├── auth_provider.dart         # Session State & Token Storage
│   │   ├── bill_provider.dart         # Invoice Vault List & Filtering State
│   │   └── admin_provider.dart        # Admin Metrics & Account State
│   ├── widgets/
│   │   ├── glass_card.dart            # Glassmorphic Container with Glow Border
│   │   ├── scanning_laser_beam.dart   # Animated Scanning Laser Beam Overlay
│   │   ├── status_badge.dart          # Colored Status Pills (Processed, Paid, Overdue)
│   │   ├── custom_text_field.dart     # Glowing Translucent Input Fields
│   │   └── spending_chart.dart        # Category Analytics Breakdown Chart
│   └── screens/
│       ├── auth/
│       │   ├── login_screen.dart       # Email/Password Sign-In
│       │   ├── register_screen.dart    # Account Registration
│       │   └── reset_password_screen.dart # Password Recovery via Email OTP
│       ├── user/
│       │   ├── user_main_screen.dart   # Navigation Hub & Bottom Bar
│       │   ├── dashboard_screen.dart   # Financial Overview & Analytics
│       │   ├── camera_scan_screen.dart # Document Capture & Ingestion Beam
│       │   ├── bill_vault_screen.dart  # Filterable Invoice Vault
│       │   ├── bill_detail_screen.dart # Receipt Preview & Inline Field Editor
│       │   └── profile_screen.dart     # User Profile & Subscription Tier
│       └── admin/
│           ├── admin_main_screen.dart  # Admin Dashboard & Metrics
│           ├── system_health_screen.dart # Real-time CPU, RAM, Latency Monitors
│           └── user_management_screen.dart # User Accounts & Plan Manager
├── pubspec.yaml                       # Dependencies & Asset Configuration
└── README.md                          # Application Setup Guide
```

---

## ⚡ Setup & Configuration Guide

### 1. Prerequisites
Ensure you have the following installed:
- **Flutter SDK** (`>= 3.0.0`)
- **Android Studio** (for Android Emulator / APK build) or **Xcode** (for iOS Simulator / IPA build)
- **FastAPI Backend running locally** on port 8000.

### 2. Networking Setup (Connecting Mobile to Backend)
Open `lib/config/api_config.dart` and update `baseUrl`:

```dart
class ApiConfig {
  // For Android Emulator (connects to PC's localhost):
  static const String baseUrl = 'http://10.0.2.2:8000';

  // For iOS Simulator:
  // static const String baseUrl = 'http://127.0.0.1:8000';

  // For Physical Android/iOS Phone (connect to PC over local Wi-Fi IP):
  // static const String baseUrl = 'http://192.168.1.5:8000';
}
```

### 3. Installation & Launch Commands

```bash
# Navigate to mobile application directory
cd mobile_app

# Fetch dependencies
flutter pub get

# Run on connected device or emulator
flutter run
```

### 4. Standalone Production Build Commands

```bash
# Build Android APK
flutter build apk --release

# Build Android App Bundle (AAB for Google Play Store)
flutter build appbundle --release

# Build iOS App (requires macOS & Xcode)
flutter build ipa --release
```

---

## 🔌 API Endpoint Reference (0% Backend Changes Required)

- **Authentication**: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`
- **Document Extraction**: `POST /process/document` (multipart form-data)
- **Invoice Vault**: `GET /api/bills`, `GET /api/bills/{id}`, `PUT /api/bills/{id}`, `DELETE /api/bills/{id}`
- **Feedback**: `POST /api/feedback`
- **Admin**: `GET /api/admin/dashboard`, `GET /api/admin/system-health`, `GET /api/admin/users`, `PUT /api/admin/users/{id}/status`, `PUT /api/admin/users/{id}/plan`
