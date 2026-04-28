# Attendance Pro

A mobile application for managing worker attendance, advances, and payroll in civil construction projects. Built with React Native (Expo) on the frontend and Node.js/Express on the backend, with JSON file-based storage.

---

## Table of Contents

- [Overview](#overview)
- [User Roles](#user-roles)
- [Features](#features)
- [Screens](#screens)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
- [How to Run](#how-to-run)
- [Required Configuration Changes](#required-configuration-changes)

---

## Overview

**Attendance Pro** is designed for civil construction site managers to track daily worker attendance, record cash advances (salary loans), manage travel expenses, and generate balance payment reports in Excel or PDF format. The app supports three user roles — Admin, Manager, and Worker — each with different access levels.

---

## User Roles

### Admin
- Create and delete managers
- Create workers for any manager
- View all managers and their workers
- Change passwords for any user
- Update worker daily rates
- Access balance payment reports with Excel/PDF download
- View and undo any action log

### Manager
- Create and manage their own workers
- Mark daily attendance for their workers
- Add advances to workers
- View monthly attendance and earning reports
- Hide or disable workers
- Undo their own recent actions (within 30 minutes)
- Edit worker travel expenses

### Worker (Labour / Mistry / Half Mistry)
- View their own daily attendance
- View monthly history (days worked, advances, travel, balance)
- Edit their own travel expense
- Change their own password

---

## Features

| Feature | Description |
|---|---|
| Role-based access | Admin, Manager, Worker with separate home screens and permissions |
| Attendance marking | Quick buttons: A (Absent), ½ (Half day), P (Full), P½ (1.5x), PP (2x), and more |
| Advance management | Quick buttons (₹500, ₹1000, ₹1500, ₹2000) or custom amount |
| Travel expense tracking | Per-day travel expense per worker |
| Monthly reports | Attendance summary with earnings, advance, travel, balance |
| Balance payment sheet | Admin-only report with Excel/PDF export and column selector |
| Action log & undo | Last 10 actions undoable within 30 minutes |
| Worker status | Active, Hidden (off home screen), Disabled (archived), Long Leave |
| Auto absent | Scheduled job marks all unmarked workers as absent at end of day |
| JWT authentication | Access token (7-day) + refresh token (30-day) with auto-refresh |
| Offline detection | NetInfo detects connection loss and shows warning |
| Photo upload | Worker profile photos via Cloudinary (optional) |
| Test mode | Manual date toggle for QA/testing without waiting for real dates |
| Admin impersonation | Admin can view any manager's home screen |

---

## Screens

### LoginScreen
- Mobile number (10-digit) + password login
- Show/hide password toggle
- Redirects to role-specific home screen after login

### AdminHome
- Dashboard: manager count, total workers, total advance paid, balance to pay
- Manager list with per-manager worker count
- Tap a manager → opens their ManagerHome view
- Long-press a manager → change password or remove manager
- Monthly report table per manager (attendance, earnings, advance, travel, balance)
- Month navigation arrows
- Create Manager button

### ManagerHome
- List of active workers for this manager
- Per-worker attendance quick buttons (A / ½ / P / P½ / PP)
- Per-worker advance quick buttons + custom amount input
- Worker cards show: name, role, rate, today's attendance status, advance status
- Search/filter workers by name, role, or status
- Action log panel — undo last actions within 30 minutes
- Long-press a worker → view history or disable worker
- Pull-to-refresh

### WorkerHome
- Today's attendance display
- Travel expense input with save button
- Monthly summary cards: days worked, advance total, travel total, balance owed
- Monthly calendar view + detailed attendance table
- Edit previous attendance / advance / travel entries
- Change password modal
- Test mode toggle (manual date for testing)
- Online/offline indicator

### MonthHistory
- Complete monthly record for a single worker
- Per-day: attendance value (color-coded), travel expense, advance, marked-by name
- Edit modals for attendance, advance, travel
- Summary: total days, advance, travel, balance
- Month navigation

### CreateWorker
- Form: name, mobile, role (Mistry / Labour / Half Mistry), daily rate
- Optional profile photo (camera or gallery → uploaded to Cloudinary)
- Default password = mobile number
- Auto-assigned to the creating manager (or selected manager if Admin)

### CreateManager
- Form: name, mobile, daily rate
- Default password = mobile number
- Admin-only

### BalancePayment
- Admin-only monthly balance sheet
- Summary: total workers, earned, advance, net payable
- Sortable table: name, earned, advance, travel, balance
- Column selector for customising Excel/PDF output
- Download as Excel or PDF

### HiddenWorkers
- Lists workers hidden from the manager's home screen
- Unhide worker (returns to home screen)
- View month history or edit attendance for hidden workers

### DisabledWorkers
- Lists archived/disabled workers with their disable date
- Re-enable a worker (returns to active status)
- View month history or edit attendance for disabled workers

### DrawerContent
- Sidebar navigation (opened via hamburger icon)
- Displays logged-in user name, role, mobile
- Links: Home, Add Worker, Create Manager, Hidden Workers, Disabled Workers, Balance Payment
- Test mode toggle
- Logout button

---

## Tech Stack

### Mobile (Frontend)

| Library | Version | Purpose |
|---|---|---|
| React Native | 0.81.5 | Mobile UI framework |
| Expo | ~54.0.0 | Build toolchain & native APIs |
| React Navigation | 7.0.0 | Drawer + Stack navigation |
| Zustand | 4.5.2 | Global state management |
| Axios | 1.6.8 | HTTP client with token auto-refresh |
| AsyncStorage | ~2.2.0 | Persistent local token/user storage |
| NetInfo | ~11.4.1 | Network connectivity detection |
| Expo Image Picker | ~17.0.10 | Camera and gallery photo access |
| React Native Toast Message | 2.2.0 | In-app toast notifications |
| React Native Gesture Handler | ~2.28.0 | Touch/swipe handling |
| React Native Safe Area Context | ~5.6.0 | Notch/safe area support |

### Backend

| Library | Version | Purpose |
|---|---|---|
| Express.js | 4.18.2 | HTTP server and routing |
| jsonwebtoken | 9.0.2 | JWT auth (access + refresh tokens) |
| node-cron | 3.0.3 | Scheduled auto-absent job |
| cors | 2.8.5 | Cross-origin request support |
| PDFKit | 0.14.0 | Balance sheet PDF generation |
| XLSX | 0.18.5 | Balance sheet Excel generation |
| Cloudinary | 1.41.3 | Worker profile photo hosting |
| dotenv | 16.3.1 | Environment variable management |
| nodemon | 3.0.2 | Dev server auto-reload |

### Storage
JSON file-based storage (no database required):
- `backend/data/users.json`
- `backend/data/attendance.json`
- `backend/data/advances.json`
- `backend/data/actionlogs.json`

---

## Directory Structure

```
Attendance-main-final/
├── README.md
│
├── backend/
│   ├── server.js          # Express server, all routes, middleware, cron jobs
│   ├── models.js          # Data access layer (read/write JSON files)
│   ├── package.json       # Backend dependencies
│   └── data/
│       ├── users.json       # All users (admin, managers, workers)
│       ├── attendance.json  # Daily attendance records
│       ├── advances.json    # Advance payment records
│       └── actionlogs.json  # Audit trail for undo feature
│
└── mobile/
    ├── App.js             # Root component, navigation setup
    ├── app.json           # Expo app config (name, icons, permissions)
    ├── babel.config.js    # Babel config for Expo
    ├── package.json       # Mobile dependencies
    ├── assets/            # Icons, splash screen images
    └── src/
        ├── api.js         # Axios instance with token refresh interceptor
        ├── config.js      # API URL, attendance map, role labels, colours
        ├── store.js       # Zustand store (auth state, test mode)
        └── screens/
            ├── LoginScreen.js
            ├── AdminHome.js
            ├── ManagerHome.js
            ├── WorkerHome.js
            ├── MonthHistory.js
            ├── CreateWorker.js
            ├── CreateManager.js
            ├── BalancePayment.js
            ├── HiddenWorkers.js
            ├── DisabledWorkers.js
            └── DrawerContent.js
```

---

## Data Models

### User
```json
{
  "_id": "uuid",
  "name": "John Doe",
  "mobile": "9876543210",
  "password": "plaintext",
  "role": "admin | manager | labour | mistry | half_mistry",
  "status": "active | disabled | long_leave",
  "rate": 600,
  "photoUrl": "https://cloudinary.com/...",
  "createdBy": "uuid-of-creator",
  "isHidden": false,
  "disabledAt": "2025-01-01T00:00:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### Attendance
```json
{
  "_id": "uuid",
  "workerId": "uuid",
  "date": "2025-04-28T00:00:00.000Z",
  "value": "1",
  "markedBy": "uuid",
  "travelExpense": 100,
  "createdAt": "2025-04-28T00:00:00.000Z",
  "updatedAt": "2025-04-28T00:00:00.000Z"
}
```

**Attendance values:**
| Value | Label | Meaning |
|---|---|---|
| `0` | A | Absent |
| `0.5` | ½ | Half day |
| `1` | P | Full day |
| `1.25` | P¼ | 1.25 days |
| `1.5` | P½ | 1.5 days |
| `2` | PP | 2 days |
| `2.25` | PP¼ | 2.25 days |
| `2.5` | PP½ | 2.5 days |
| `3` | PPP | 3 days |

### Advance
```json
{
  "_id": "uuid",
  "workerId": "uuid",
  "amount": 1000,
  "date": "2025-04-28T00:00:00.000Z",
  "givenBy": "uuid",
  "note": "optional note",
  "createdAt": "2025-04-28T00:00:00.000Z"
}
```

### ActionLog
```json
{
  "_id": "uuid",
  "performedBy": "uuid",
  "actionType": "mark_attendance | edit_attendance | add_advance | remove_advance | status_change",
  "targetUser": "uuid",
  "previousValue": {},
  "newValue": {},
  "date": "2025-04-28T00:00:00.000Z",
  "createdAt": "2025-04-28T00:00:00.000Z"
}
```

---

## API Endpoints

### Auth
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login with mobile + password |
| POST | `/api/auth/refresh` | Public | Refresh JWT access token |
| PUT | `/api/auth/change-password` | Self | Change own password |

### Admin
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/admin/managers` | Admin | List all managers |
| POST | `/api/admin/managers` | Admin | Create a manager |
| PUT | `/api/admin/users/:id/password` | Admin | Force change user password |
| PUT | `/api/admin/users/:id/rate` | Admin | Update user daily rate |
| DELETE | `/api/admin/managers/:id` | Admin | Delete a manager |

### Workers
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/workers` | Admin/Manager | List active workers |
| GET | `/api/workers/inactive` | Admin/Manager | Workers on long leave |
| GET | `/api/workers/disabled` | Admin/Manager | Disabled workers |
| GET | `/api/workers/hidden` | Admin/Manager | Hidden workers |
| POST | `/api/workers` | Admin/Manager | Create new worker |
| PUT | `/api/workers/:id/status` | Admin/Manager | Change status (active/disabled/long_leave) |
| PUT | `/api/workers/:id/toggle-hidden` | Admin/Manager | Hide or unhide worker |
| GET | `/api/workers/:id/history` | Admin/Manager | Worker's month history |

### Attendance
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/attendance/today` | Admin/Manager | Today's attendance + worker list |
| POST | `/api/attendance` | Admin/Manager | Mark attendance |
| PUT | `/api/attendance/:id` | Admin/Manager | Edit attendance record |
| POST | `/api/attendance/fill-absent` | Admin/Manager | Mark all unmarked as absent |
| PUT | `/api/attendance/travel` | Self | Worker updates own travel expense |
| PUT | `/api/attendance/travel/:workerId` | Admin/Manager | Update worker's travel expense |
| GET | `/api/attendance/me` | Self | Own monthly attendance |
| GET | `/api/attendance/streak/:workerId` | Admin/Manager | 7-day attendance streak |

### Advances
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/advance` | Admin/Manager | Add advance |
| PUT | `/api/advance/:id` | Admin/Manager | Edit advance |
| DELETE | `/api/advance/:id` | Admin/Manager | Remove advance |

### Reports
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/report` | Admin/Manager | Monthly report |
| GET | `/api/report/balance` | Admin | Balance payment report |
| GET | `/api/report/balance-excel` | Admin | Download balance Excel |
| GET | `/api/report/balance-pdf` | Admin | Download balance PDF |
| GET | `/api/report/excel` | Admin/Manager | Download attendance Excel |
| GET | `/api/report/pdf` | Admin/Manager | Download attendance PDF |

### Actions
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/actions/log` | Admin/Manager | Last 10 actions (30-min window) |
| POST | `/api/actions/undo` | Admin/Manager | Undo an action |

### Upload
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/upload/photo` | Authenticated | Upload photo to Cloudinary |

---

## How to Run

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- A smartphone with **Expo Go** app installed, or an Android/iOS emulator
- Both your PC and phone must be on the **same Wi-Fi network**

### 1. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The server starts on `http://0.0.0.0:5000`. Note your machine's local IP address (e.g., `192.168.1.10`).

To create an initial admin user, manually add one to `backend/data/users.json`:

```json
[
  {
    "_id": "admin-001",
    "name": "Admin",
    "mobile": "9999999999",
    "password": "admin123",
    "role": "admin",
    "status": "active",
    "rate": 0,
    "photoUrl": null,
    "isHidden": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### 2. Configure the Mobile App

Edit `mobile/src/config.js` and set `API_URL` to your machine's local IP:

```js
export const API_URL = 'http://192.168.1.10:5000'; // ← replace with your IP
```

### 3. Start the Mobile App

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `a` for Android emulator / `i` for iOS simulator.

---

## Required Configuration Changes

Before running in any environment, make these changes:

### 1. API URL — `mobile/src/config.js`
```js
// Change this to your server's IP address (or production domain)
export const API_URL = 'http://YOUR_SERVER_IP:5000';
```

### 2. JWT Secret — `backend/server.js`
Find the `JWT_SECRET` constant and replace it with a strong random string:
```js
const JWT_SECRET = 'your-strong-random-secret-here'; // ← change this
```

### 3. Cloudinary Credentials — `backend/server.js`
Replace the placeholder Cloudinary config with your own account credentials from [cloudinary.com](https://cloudinary.com):
```js
cloudinary.config({
  cloud_name: 'YOUR_CLOUD_NAME',
  api_key: 'YOUR_API_KEY',
  api_secret: 'YOUR_API_SECRET',
});
```
If you do not want photo uploads, you can skip this — the photo field in CreateWorker is optional.

### 4. Passwords Are Stored in Plain Text
The current implementation stores passwords as plain text in `users.json`. For any production deployment, replace this with a hashed approach using `bcrypt`:
```bash
npm install bcrypt
```
Then hash passwords on creation and use `bcrypt.compare()` on login.

### 5. Default Passwords
When a worker or manager is created, their default password is set to their mobile number. Instruct users to change their password after first login.

### 6. Port
The backend defaults to port `5000`. Change it in `backend/server.js` if needed:
```js
const PORT = process.env.PORT || 5000;
```

### 7. Data Backup
All data is stored in `backend/data/*.json` files. Set up regular backups of this folder to prevent data loss. For a more robust solution, migrate the data layer in `backend/models.js` to a proper database like MongoDB or SQLite.
