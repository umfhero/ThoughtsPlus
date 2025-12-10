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

- **Feature:** "AI Quick Add" (Ctrl+M) & "Dynamic Briefing".
- **Quick Add Flow:**
  1. User types a natural language prompt (e.g., "Meeting with John tomorrow at 2pm").
  2. Frontend sends prompt to Main process via IPC.
  3. Main process calls Google Gemini API.
  4. API returns structured JSON (Title, Date, Time, Description).
  5. Frontend receives structured data and creates the event.
- **Briefing Flow:**
  1. Dashboard aggregates upcoming (14 days), recent past (7 days), and overdue tasks.
  2. Sends filtered list to AI model.
  3. AI generates a comforting summary using a specific persona:
     - **Tone:** Warm, comforting, casual (supportive friend).
     - **Structure:** Congratulates on recent completions -> Encourages immediate tasks -> Reminds of future deadlines.
     - **Prioritization:** Focuses on high urgency tasks if overwhelmed; emphasizes relaxation.
     - **Specifics:** Provides task-specific advice (e.g., "revise" for exams).
  4. Updates dynamically when tasks are marked complete.

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

### 4.5. Mobile Support (Progressive Web App)

To circumvent app store fees while delivering a native-like experience, the mobile version is implemented as a Progressive Web App (PWA).

- **Architecture:**

  - **Shared Codebase:** Leverages the existing React components and logic from the desktop app, refactored into a shared core package or monorepo structure where applicable.
  - **Hosting:** Hosted on Vercel (Free Tier) for global edge distribution.

- **Core PWA Features:**

  - **Installability:** Uses a `manifest.json` to allow users to "Add to Home Screen" on iOS and Android. This removes browser chrome (URL bars) and gives the app a dedicated icon and standalone window context.
  - **Service Workers:** Handles asset caching (`vite-plugin-pwa`) to ensure the app loads instantly even on slow mobile networks.

- **Notifications (Lock Screen "Lite"):**
  - **Implementation:** Uses the Web Push API and Supabase Edge Functions.
  - **Functionality:** Instead of native widgets (which require paid store distribution), the app sends push notifications for upcoming tasks. These persist on the user's lock screen until cleared, effectively acting as a "task list" widget.

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

**Environment Variables:** `.env` file is used for development secrets.

- `VITE_SUPABASE_URL`: The unique API URL for the backend database.
- `VITE_SUPABASE_ANON_KEY`: The public API key for client-side requests.
- `GOOGLE_GENERATIVE_AI_KEY`: API key for Gemini integration.

- **User Defaults:** `user-defaults.json` can be used to pre-seed configuration (GitHub username, Creator codes) for personal builds.

## 8. Known Issues / To Do

- **Resolved:** AI API Quota/Key Issue: The "404 Not Found" errors have been resolved by implementing a robust model fallback system. The app now prioritizes `gemini-2.5-flash` and `gemini-2.5-flash-lite`, falling back to `gemini-2.0-flash-exp`, `gemini-1.5-flash`, and `gemini-1.5-pro` if necessary.

## 9. Planned Roadmap

### Data Persistence & Sync (Migration to v2)

The application is transitioning from a local-only JSON architecture to a cloud-hybrid model to support multi-device syncing and mobile access.

- **Primary Database (Cloud):** Supabase (PostgreSQL).

  - **Role:** Acts as the single source of truth for all events, settings, and user data.
  - **Tiers:** Utilises the free tier (500MB storage, 50,000 MAU) to maintain zero cost.

- **Sync Engine:**

  - **Realtime:** Uses Supabase Realtime subscriptions (`postgres_changes`) to push updates instantly between Desktop and Mobile.
  - **Optimistic UI:** The frontend updates the UI immediately upon user action (e.g., creating a task) while the network request resolves in the background, ensuring the "snappy" feel remains.

- **Authentication:**

  - **Provider:** Supabase Auth (configured with Google OAuth).
  - **Security:** Row Level Security (RLS) policies ensure users can strictly access only their own data records.

- **Legacy/Offline Support:**
  - The app retains a local caching mechanism (localStorage/IndexedDB) to allow viewing the calendar when offline. Changes made offline are queued and replayed to Supabase upon reconnection.

### Distribution & Updates (Microsoft Store)

- **Primary Distribution:** Microsoft Store.

  - **Rationale:** Solves the "Unknown Publisher" (SmartScreen) warning without requiring expensive annual EV code-signing certificates ($300+/yr). Microsoft signs the package upon Store submission.
  - **Cost Strategy:** Utilises the one-time individual developer registration fee (~$19 USD) for lifetime access, adhering to the "low cost" constraint.

- **Packaging:**

  - **Format:** The Electron app is packaged as an `.msix` or a Store-compatible `.exe` (Win32 App) using `electron-builder` configurations.
  - **CI/CD:** GitHub Actions pipeline builds the artifact and can optionally automate submission to the Microsoft Partner Center.

- **Update Mechanism:**
  - **Store Build:** Updates are handled entirely by the Microsoft Store infrastructure. When a new version is published to the Store, Windows automatically downloads and installs it for the user in the background.
  - **Direct Download (Fallback):** The app retains `electron-updater` logic for users who prefer downloading the portable `.exe` directly from GitHub Releases, though these users may encounter SmartScreen warnings.

### Advanced Appearance & Customization

- **Custom Fonts:** Allow users to upload and preload custom fonts.
- **Extended Accent Colors:** Apply accent colors to more UI elements, including setting icons and dashboard widget backgrounds.

### Dashboard Enhancements

- **Edit Mode:** Enable users to rearrange dashboard widgets.
- **New Widgets:** Add more widget options to the dashboard.

### Core Logic Improvements

- **API Logic Refactor:** Redo the API logic to fix breaking fallback mechanisms.
- **Third-Party Imports:** Support importing external calendars with selective add/remove capabilities.

### AI & Productivity

- **AI Quick Note:** Add a repeating toggle (e.g., "repeat every X times" or "every X days").

### Settings & Management

- **Notification Toggle:** Simple toggle to enable/disable notifications.
- **Settings Export/Import:** "One-click" export of all settings and data into a single package for easy transfer to another machine.
- **Factory Reset:** "Start Clean" button to wipe all data and restart the onboarding process.
