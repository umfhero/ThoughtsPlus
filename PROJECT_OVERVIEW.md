# Project Overview: Calendar Plus

## 1. Introduction

**Calendar Plus** (v5.0.0) is a Windows desktop calendar application designed for speed, simplicity, and "frictionless" event management. It leverages AI for natural language event creation and offers features like multi-device sync, GitHub activity tracking, creator analytics, and automatic updates.

**Core Philosophy:** "No friction, no fuss."
**Target Audience:** Users who want a fast, keyboard-centric calendar with modern integrations.

## 2. Technical Stack

### Frontend (Renderer Process)

- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS, `clsx`, `tailwind-merge`
- **Icons:** `lucide-react`
- **Animations:** `framer-motion`
- **Charts/Data Viz:** `recharts`, `react-activity-calendar`, `react-github-calendar`
- **Utilities:** `date-fns` (date manipulation), `papaparse` (CSV parsing)

### Backend (Main Process)

- **Runtime:** Electron (v29.1.0)
- **Language:** TypeScript
- **AI Integration:** Google Generative AI SDK (`@google/generative-ai`)
- **Auto-Updates:** `electron-updater`
- **Packaging:** Electron Builder (NSIS installer)

## 3. Architecture & Data Flow

### 3.1. Electron Structure

- **Main Process (`electron/main.ts`):**
  - Handles application lifecycle, window creation, and native OS interactions.
  - Manages file system operations (reading/writing data).
  - Exposes functionality to the renderer via IPC (Inter-Process Communication).
  - Handles API calls to Google Gemini (to keep keys secure/centralized).
- **Preload Script (`electron/preload.ts`):**
  - Bridges the Main and Renderer processes.
  - Exposes a safe `window.ipcRenderer` API to the frontend.

### 3.2. Data Persistence

The application follows an "Offline-First" approach with local JSON storage.

- **Storage Location:**
  - Defaults to `Documents/CalendarPlus` or `OneDrive/CalendarPlus` if detected.
  - **`calendar-data.json`:** Stores events, notes, and user data. Synced if placed in a cloud folder (OneDrive/Dropbox).
  - **`settings.json`:** Global settings synced across devices.
  - **`device-settings.json`:** Local, device-specific settings (e.g., window size, specific API keys if not global).
- **Sync Mechanism:** Relies on the user's file system (e.g., OneDrive client) to sync the JSON files between machines. The app watches/reads these files.

### 3.3. AI Integration

- **Feature:** "AI Quick Add" (Ctrl+M).
- **Flow:**
  1. User types a natural language prompt (e.g., "Meeting with John tomorrow at 2pm").
  2. Frontend sends prompt to Main process via IPC.
  3. Main process calls Google Gemini API.
  4. API returns structured JSON (Title, Date, Time, Description).
  5. Frontend receives structured data and creates the event.

## 4. Key Features & Implementation

### 4.1. Dashboard & Calendar

- **Dashboard:** Widget-based layout showing quick notes, upcoming events, and stats.
- **Calendar:** Custom implementation using `date-fns` for grid generation.
- **Quick Notes:** Simple text-based notes with "importance" flags.

### 4.2. Stats & Analytics

- **Creator Stats:** Visualizes Fortnite island performance.
  - **Implementation:** Currently parses a bundled CSV file (`src/EpicGamesCSV`) using `papaparse`.
  - **Configuration:** Users can input Creator Codes in Settings, though the visualization currently relies on the CSV data structure.
- **GitHub Stats:**
  - Uses `react-github-calendar` to display the contribution graph.
  - Fetches user profile data via GitHub API (configured in Settings).

### 4.3. Drawing / Whiteboard

- **Implementation:** Custom React component (`src/pages/Drawing.tsx`).
- **Features:** Multi-tab support, freehand drawing, text objects, image support.
- **Storage:** Canvas data is serialized and stored in the local JSON data.

### 4.4. Auto-Update System

- **Implementation:** Integrated `electron-updater` for seamless one-click updates.
- **Features:**
  - Automatic update check on startup (silent)
  - Manual check via Settings page
  - Download progress visualization
  - One-click install & restart
  - Preserves all user data during updates
- **Configuration:** Published to GitHub Releases with automatic versioning.
- **User Experience:** No manual downloads or complex installations - users click "Install & Restart" and the app handles the rest.

## 5. Project Structure

```
CalendarPlus/
├── electron/               # Electron Main process source
│   ├── main.ts             # Entry point
│   └── preload.ts          # IPC bridge
├── src/                    # React Renderer process source
│   ├── components/         # Reusable UI components (AiQuickAddModal, Sidebar, etc.)
│   ├── contexts/           # React Contexts (ThemeContext)
│   ├── EpicGamesCSV/       # Data source for stats (CSV files)
│   ├── pages/              # Main application views (Calendar, Dashboard, Stats, etc.)
│   ├── styles/             # Global CSS and Tailwind imports
│   ├── utils/              # Helper functions (statsManager, github)
│   ├── App.tsx             # Main React component / Router
│   └── main.tsx            # React entry point
├── public/                 # Static assets (icons, etc.)
├── release/                # Output directory for builds
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
└── README.md               # User documentation
```

## 6. Setup & Development

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

- **Development Mode:**
  ```bash
  npm run dev
  ```
  This starts the Vite dev server and launches the Electron window.

### Building

- **Compile & Build:**
  ```bash
  npm run build
  ```
- **Create Installer (Windows):**
  ```bash
  npm run build:installer
  ```
  Generates an NSIS installer in the `release/` directory.

## 7. Configuration

- **Environment Variables:** `.env` file is used for development secrets.
- **User Defaults:** `user-defaults.json` can be used to pre-seed configuration (GitHub username, Creator codes) for personal builds.
