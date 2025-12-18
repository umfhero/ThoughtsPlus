# Project Overview: Calendar Plus

**Version:** 5.2.0  
**Last Updated:** December 18, 2025  
**Author:** Majid (umfhero)

---

## 1. Introduction

**Calendar Plus** is a Windows desktop calendar application designed for speed, simplicity, and "frictionless" event management. It leverages AI (Google Gemini) for natural language event creation and offers features like multi-device sync, GitHub activity tracking, creator analytics, customizable dashboard widgets, and automatic updates.

**Core Philosophy:** "No friction, no fuss."  
**Target Audience:** Users who want a fast, keyboard-centric calendar with modern integrations and AI-powered productivity features.

---

## 2. Technical Stack

### Frontend (Renderer Process)

| Category   | Technology                                                         |
| ---------- | ------------------------------------------------------------------ |
| Framework  | React 18                                                           |
| Build Tool | Vite 5.1                                                           |
| Language   | TypeScript 5.4                                                     |
| Styling    | Tailwind CSS 3.4, `clsx`, `tailwind-merge`                         |
| Icons      | `lucide-react`                                                     |
| Animations | `framer-motion` 11                                                 |
| Charts     | `recharts` 3.4, `react-activity-calendar`, `react-github-calendar` |
| Utilities  | `date-fns` (dates), `papaparse` (CSV), `canvas-confetti`           |

### Backend (Main Process)

| Category       | Technology                                         |
| -------------- | -------------------------------------------------- |
| Runtime        | Electron 29.1                                      |
| Language       | TypeScript                                         |
| AI Integration | Google Generative AI SDK (`@google/generative-ai`) |
| Auto-Updates   | `electron-updater` 6.6                             |
| Packaging      | Electron Builder 24.13 (NSIS installer)            |

---

## 3. Project Structure

```
CalendarPlus/
├── .meta/                      # Project documentation
│   └── PROJECT_OVERVIEW.md     # This file
├── electron/                   # Electron Main process
│   ├── main.ts                 # Main entry (1062 lines) - IPC handlers, window, AI
│   └── preload.ts              # Secure IPC bridge
├── src/                        # React Renderer process
│   ├── components/             # Reusable UI components
│   │   ├── AddCustomWidgetModal.tsx    # Custom widget configuration
│   │   ├── AiQuickAddModal.tsx         # AI-powered quick note creation
│   │   ├── CustomWidgetContainer.tsx   # Widget rendering wrapper
│   │   ├── GenericTrendChart.tsx       # Generic chart component
│   │   ├── NotificationContainer.tsx   # Toast notifications
│   │   ├── SetupWizard.tsx             # First-run onboarding
│   │   ├── ShortcutsOverlay.tsx        # Keyboard shortcuts display
│   │   ├── Sidebar.tsx                 # Navigation sidebar
│   │   ├── TaskTrendChart.tsx          # Task completion trends
│   │   └── TrendChart.tsx              # Activity trend visualization
│   ├── contexts/               # React Contexts
│   │   ├── NotificationContext.tsx     # Global notification state
│   │   └── ThemeContext.tsx            # Theme & accent color state
│   ├── EpicGamesCSV/           # Creator stats CSV data source
│   ├── pages/                  # Main application views
│   │   ├── Board.tsx           # Whiteboard/sticky notes (1392 lines)
│   │   ├── Calendar.tsx        # Calendar & event management (1034 lines)
│   │   ├── Dashboard.tsx       # Main dashboard with widgets (2046 lines)
│   │   ├── Dev.tsx             # Developer tools page
│   │   ├── Drawing.tsx         # Canvas drawing (legacy)
│   │   ├── Github.tsx          # GitHub profile integration
│   │   ├── Settings.tsx        # App configuration (1487 lines)
│   │   └── Stats.tsx           # Creator statistics
│   ├── styles/                 # Global CSS
│   ├── utils/                  # Helper functions
│   │   ├── customWidgetManager.ts      # Custom widget persistence
│   │   ├── github.ts                   # GitHub API helpers
│   │   ├── icsHelper.ts                # Calendar import/export
│   │   └── statsManager.ts             # Stats data processing
│   ├── App.tsx                 # Main React component (501 lines)
│   ├── main.tsx                # React entry point
│   └── types.ts                # TypeScript type definitions
├── public/                     # Static assets
│   └── ROADMAP.json            # Feature roadmap data
├── release/                    # Build output directory
├── package.json                # Dependencies & scripts
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
└── README.md                   # User documentation
```

---

## 4. Architecture & Data Flow

### 4.1. Electron Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ electron/main.ts                                         │    │
│  │ • Window lifecycle management                            │    │
│  │ • File system operations (JSON persistence)              │    │
│  │ • Google Gemini AI API calls                             │    │
│  │ • Auto-update handling                                   │    │
│  │ • IPC handlers (45+ handlers registered)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    IPC Bridge (preload.ts)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                       Renderer Process                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ React Application (src/)                                 │    │
│  │ • Dashboard with customizable widgets                    │    │
│  │ • Calendar with recurring events                         │    │
│  │ • Whiteboard with sticky notes                           │    │
│  │ • GitHub activity integration                            │    │
│  │ • Settings & configuration                               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2. Data Persistence

The application follows an **"Offline-First"** approach with local JSON storage.

#### Storage Locations

| File                          | Location                   | Purpose                                           |
| ----------------------------- | -------------------------- | ------------------------------------------------- |
| `calendar-data.json`          | OneDrive/Documents folder  | Events, notes, drawings, boards                   |
| `settings.json`               | Same as data folder        | Global settings (theme, preferences)              |
| `device-settings.json`        | `%APPDATA%/calendar-plus/` | Device-specific settings (API keys, window state) |
| `fortnite-stats-history.json` | Same as data folder        | Creator stats history                             |

#### Data Path Resolution (v5.1.4+)

The app uses intelligent folder detection:

1. **Priority Order:**

   - `A - CalendarPlus` (current recommended)
   - `A - Calendar Pro` (legacy V4.5)
   - `CalendarPlus` (fallback)

2. **Search Locations:**

   - First checks OneDrive folder
   - Then checks Documents folder
   - Falls back to creating `OneDrive/CalendarPlus`

3. **Automatic Handling:**
   - Auto-migrates V4.5 data format (objects → arrays)
   - Real-time path changes without restart
   - Comprehensive logging to DevTools (F12)

### 4.3. AI Integration

**Models Used (Priority Order):**

1. `gemini-2.5-flash` (Primary)
2. `gemini-2.5-flash-lite` (Fallback)

**Features:**

| Feature                    | Implementation                                  |
| -------------------------- | ----------------------------------------------- |
| **AI Quick Add**           | Natural language → structured event (Ctrl+M)    |
| **Dynamic Briefing**       | Personalized daily summary with task priorities |
| **Description Generation** | Optional AI-generated description suggestions   |
| **Rate Limit Handling**    | Smart quota management for free tier (50/day)   |

---

## 5. Implemented Features (v5.2.0)

### 5.1. Dashboard (Implemented: v5.1.0 - December 2025)

| Feature              | Status | Description                      |
| -------------------- | ------ | -------------------------------- |
| Widget Layout System | ✅     | Drag-and-drop widget arrangement |
| Combined Widgets     | ✅     | Side-by-side widget placement    |
| Hidden Widgets       | ✅     | Show/hide widgets dynamically    |
| Custom Widgets       | ✅     | User-configurable API widgets    |
| Edit Mode            | ✅     | Long-press to enter edit mode    |
| Persistent Layouts   | ✅     | Layout syncs across devices      |

**Default Widgets:**

- AI Briefing
- Events List (upcoming/completed/missed)
- Task Trends Chart
- GitHub Activity Calendar
- Fortnite Creator Stats

### 5.2. Calendar (Implemented: v1.0.0 - v5.1.4)

| Feature           | Status | Description                          |
| ----------------- | ------ | ------------------------------------ |
| Monthly View      | ✅     | Visual calendar grid with navigation |
| Event CRUD        | ✅     | Create, read, update, delete events  |
| Importance Levels | ✅     | low, medium, high, misc              |
| Recurring Events  | ✅     | Daily, weekly, fortnightly, monthly  |
| Series Management | ✅     | Group recurring events with seriesId |
| Search & Filter   | ✅     | Filter by importance, search by text |
| AI Quick Add      | ✅     | Natural language event creation      |
| ICS Import/Export | ✅     | Third-party calendar compatibility   |

### 5.3. Whiteboard/Board (Implemented: v3.0.0 - v5.0.0)

| Feature         | Status | Description                                    |
| --------------- | ------ | ---------------------------------------------- |
| Multiple Boards | ✅     | Tab-based board management                     |
| Sticky Notes    | ✅     | Text, list, calculator, image, audio, link     |
| Customization   | ✅     | Colors, paper styles, attachment styles, fonts |
| Pan & Zoom      | ✅     | Infinite canvas navigation                     |
| Backgrounds     | ✅     | Grid, dots, cork, linen patterns               |
| Drag & Resize   | ✅     | Interactive note manipulation                  |

### 5.4. GitHub Integration (Implemented: v4.5.0)

| Feature            | Status | Description                     |
| ------------------ | ------ | ------------------------------- |
| Profile Display    | ✅     | Avatar, bio, follower counts    |
| Contribution Graph | ✅     | Activity calendar visualization |
| Repository List    | ✅     | Public repos with stats         |
| Token Support      | ✅     | Optional PAT for private repos  |

### 5.5. Creator Stats (Implemented: v3.0.0 - v5.0.0)

| Feature             | Status | Description                     |
| ------------------- | ------ | ------------------------------- |
| CSV Import          | ✅     | Epic Games CSV parsing          |
| Historical Analysis | ✅     | Trend charts over time          |
| Fortnite API        | ✅     | Live stats from creator codes   |
| Deduplication       | ✅     | Weekly data prevents duplicates |

### 5.6. Settings (Implemented: v4.5.0 - v5.1.4)

| Feature              | Status | Description              |
| -------------------- | ------ | ------------------------ |
| Data Path Selection  | ✅     | Custom storage location  |
| Theme Toggle         | ✅     | Dark/Light mode          |
| Accent Colors        | ✅     | Customizable UI accent   |
| Custom Fonts         | ✅     | Upload custom fonts      |
| Feature Toggles      | ✅     | Enable/disable features  |
| Auto-Launch          | ✅     | Run on Windows startup   |
| Notification Control | ✅     | Suppress notifications   |
| Roadmap View         | ✅     | Live roadmap from GitHub |

### 5.7. Auto-Update System (Implemented: v5.0.0)

| Feature           | Status | Description                    |
| ----------------- | ------ | ------------------------------ |
| Background Check  | ✅     | Silent check on startup        |
| Download Progress | ✅     | Visual progress indicator      |
| One-Click Install | ✅     | Install & restart seamlessly   |
| Data Preservation | ✅     | Updates don't affect user data |

---

## 6. IPC Handlers Reference

### Data Operations

| Handler        | Purpose                                    |
| -------------- | ------------------------------------------ |
| `get-data`     | Load all calendar data with auto-migration |
| `save-data`    | Persist calendar data                      |
| `get-boards`   | Load whiteboard data                       |
| `save-boards`  | Persist whiteboard data                    |
| `get-drawing`  | Load legacy drawing data                   |
| `save-drawing` | Persist legacy drawing data                |

### Settings

| Handler                 | Purpose                    |
| ----------------------- | -------------------------- |
| `get-current-data-path` | Current data file location |
| `select-data-folder`    | Open folder picker dialog  |
| `set-data-path`         | Manual path entry          |
| `get-device-setting`    | Device-specific settings   |
| `save-device-setting`   | Persist device settings    |
| `get-global-setting`    | Synced settings            |
| `save-global-setting`   | Persist global settings    |

### AI

| Handler                       | Purpose                   |
| ----------------------------- | ------------------------- |
| `validate-api-key`            | Test Gemini API key       |
| `summarize-text`              | AI text summarization     |
| `generate-ai-overview`        | Daily briefing generation |
| `parse-natural-language-note` | Natural language → event  |

### Integrations

| Handler               | Purpose                  |
| --------------------- | ------------------------ |
| `get-github-username` | GitHub username          |
| `set-github-username` | Save GitHub username     |
| `get-github-token`    | GitHub PAT (optional)    |
| `set-github-token`    | Save GitHub PAT          |
| `get-creator-codes`   | Fortnite creator codes   |
| `set-creator-codes`   | Save creator codes       |
| `get-creator-stats`   | Fetch Fortnite API stats |

### System

| Handler               | Purpose             |
| --------------------- | ------------------- |
| `get-auto-launch`     | Auto-start status   |
| `set-auto-launch`     | Toggle auto-start   |
| `get-current-version` | App version         |
| `open-external`       | Open URL in browser |
| `open-devtools`       | Toggle DevTools     |

---

## 7. Keyboard Shortcuts

| Shortcut         | Action                         |
| ---------------- | ------------------------------ |
| `Ctrl+M`         | Open AI Quick Add modal        |
| `Ctrl+/`         | Toggle Dev Mode                |
| `F12`            | Open DevTools                  |
| `Ctrl+Shift+I`   | Open DevTools (alt)            |
| `Escape`         | Close modal / collapse sidebar |
| `Control (hold)` | Expand sidebar                 |

---

## 8. Security & Privacy

- **No Telemetry:** Zero tracking or data collection
- **Local Storage:** All data stays on user's devices
- **Secure API Keys:** Stored in device-specific settings, never synced
- **HTTPS Only:** All external API calls use secure connections
- **Context Isolation:** Electron security best practices

---

## 9. Microsoft Store Compliance

| Requirement                      | Status |
| -------------------------------- | ------ |
| No telemetry/tracking            | ✅     |
| Secure connections (HTTPS)       | ✅     |
| Proper content rating (Everyone) | ✅     |
| Privacy policy compliance        | ✅     |
| No harmful content               | ✅     |
| EULA/License present             | ✅     |

---

## 10. Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Commands

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create installer
npm run build:installer
```

### Build Output

- `release/Calendar Plus Setup 5.2.0.exe` - NSIS installer
- `release/latest.yml` - Auto-update manifest
- `release/win-unpacked/` - Portable version

---

## 11. Version History

| Version   | Date     | Highlights                                                                    |
| --------- | -------- | ----------------------------------------------------------------------------- |
| **5.2.0** | Dec 2025 | Board Visual Overhaul, Gemini 2.5 Flash, improved model fallback, performance |
| 5.1.4     | Dec 2025 | Dashboard customization, task analytics, recurring events                     |
| 5.1.0     | Dec 2025 | Responsive design, mobile-friendly layouts                                    |
| 5.0.0     | Dec 2025 | Auto-updates, production release                                              |
| 4.5.0     | Nov 2025 | User-configurable integrations, privacy focus                                 |
| 3.0.0     | Oct 2025 | Creator stats, drawing mode, AI quick add                                     |
| 2.0.0     | Sep 2025 | Dashboard, recurring events, CSV import                                       |
| 1.0.0     | Aug 2025 | Initial release, core calendar                                                |

---

## 12. Links

- **GitHub:** https://github.com/umfhero/CalendarPlus
- **Website:** https://officialcalendarplus.netlify.app/
- **Releases:** https://github.com/umfhero/CalendarPlus/releases

---

_This document reflects the implementation state as of v5.2.0 (December 18, 2025)._
