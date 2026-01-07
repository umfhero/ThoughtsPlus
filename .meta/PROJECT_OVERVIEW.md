# Thoughts+ - AI Context Guide

> **Purpose:** Provide AI models with essential context to modify this Electron + React app without breaking it.

---

## Tech Stack

| Layer    | Technology                                             |
| -------- | ------------------------------------------------------ |
| Desktop  | Electron 29 (Main + Renderer process)                  |
| Frontend | React 18 + TypeScript + Vite                           |
| Styling  | Tailwind CSS + `clsx` + `framer-motion` for animations |
| Icons    | `lucide-react`                                         |
| Charts   | `recharts`, `react-activity-calendar`                  |
| Dates    | `date-fns`                                             |
| AI       | Google Gemini API (`@google/generative-ai`)            |

---

## Project Structure

```
ThoughtsPlus/
├── electron/
│   ├── main.ts          # Electron main process - IPC handlers, window, AI calls
│   └── preload.ts       # Secure IPC bridge (exposes window.ipcRenderer)
├── src/
│   ├── App.tsx          # Root component - routing, global state, providers
│   ├── types.ts         # TypeScript types (Page, Note, NotesData, etc.)
│   ├── main.tsx         # React entry point
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React Context providers (Theme, Notification, Timer)
│   ├── pages/           # Full page components
│   ├── utils/           # Helper functions
│   └── styles/          # Global CSS
├── public/              # Static assets
└── package.json
```

---

## Key Files & Their Roles

### Pages (`src/pages/`)

| File            | Purpose                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| `Dashboard.tsx` | Main view with widgets, events, trends                                                |
| `Calendar.tsx`  | Monthly calendar view, event CRUD                                                     |
| `Timer.tsx`     | Timer/stopwatch with history                                                          |
| `Board.tsx`     | Interactive whiteboard with sticky notes, backgrounds, calculator, per-board settings |
| `Settings.tsx`  | App configuration                                                                     |
| `Github.tsx`    | GitHub profile & contributions                                                        |
| `Stats.tsx`     | Fortnite creator statistics                                                           |

### Contexts (`src/contexts/`)

| File                      | State Managed                 | Hook                |
| ------------------------- | ----------------------------- | ------------------- |
| `ThemeContext.tsx`        | `theme`, `accentColor`        | `useTheme()`        |
| `NotificationContext.tsx` | Toast notifications           | `useNotification()` |
| `TimerContext.tsx`        | Active timer, history, alerts | `useTimer()`        |

### Important Components (`src/components/`)

| File                    | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `Sidebar.tsx`           | Navigation with reorderable items, feature toggles |
| `AiQuickAddModal.tsx`   | Natural language event creation (Ctrl+M)           |
| `TaskTrendChart.tsx`    | Completion rate graph with time range selection    |
| `TimerAlertOverlay.tsx` | Timer completion alert + mini indicator            |
| `SetupWizard.tsx`       | First-run onboarding flow                          |

---

## Architecture Patterns

### 1. Page Navigation

```tsx
// App.tsx manages currentPage state
const [currentPage, setCurrentPage] = useState<Page>("dashboard");

// Page type defined in types.ts
type Page =
  | "dashboard"
  | "calendar"
  | "stats"
  | "settings"
  | "drawing"
  | "github"
  | "dev"
  | "custom"
  | "timer";

// Sidebar calls setPage() to navigate
<Sidebar currentPage={currentPage} setPage={setCurrentPage} />;
```

### 2. IPC Communication (Renderer ↔ Main)

```tsx
// In React (renderer) - call main process
const data = await window.ipcRenderer.invoke("get-data");
await window.ipcRenderer.invoke("save-data", newData);

// In electron/main.ts - handle calls
ipcMain.handle("get-data", async () => {
  /* return data */
});
ipcMain.handle("save-data", async (_, data) => {
  /* save data */
});
```

### 3. Feature Toggles

```tsx
// Stored in localStorage as 'feature-toggles'
const enabledFeatures = {
  calendar: true,
  drawing: true,
  stats: true,
  github: true,
  timer: true,
  aiDescriptions: true,
};

// Components check: if (enabledFeatures.timer) { render... }
// On change: window.dispatchEvent(new CustomEvent('feature-toggles-changed', { detail: newFeatures }));
```

### 4. Theme & Accent Color

```tsx
const { theme, accentColor } = useTheme();
// theme: 'light' | 'dark'
// accentColor: hex string like '#3b82f6'

// Use in styles:
style={{ backgroundColor: accentColor }}
style={{ backgroundColor: `${accentColor}15` }} // with transparency
className="dark:bg-gray-800" // Tailwind dark mode
```

### 5. Data Persistence

```tsx
// Calendar data - synced via OneDrive/Documents
await window.ipcRenderer.invoke("save-data", { notes: notesData });

// Local preferences - localStorage
localStorage.setItem("dashboard_use24HourTime", "true");
localStorage.setItem("taskTrendChart-timeRange", "1W");

// Device settings - local only (API keys, window state)
await window.ipcRenderer.invoke("save-device-setting", "apiKey", key);
```

---

## Data Types (`src/types.ts`)

```typescript
interface Note {
  id: string;
  title: string;
  description: string;
  time: string; // "HH:mm" format
  importance: "low" | "medium" | "high" | "misc";
  completed?: boolean;
  completedLate?: boolean;
  recurrence?: {
    type: "daily" | "weekly" | "fortnightly" | "monthly";
    endDate?: string;
    count?: number;
  };
  seriesId?: string; // Groups recurring events
}

interface NotesData {
  [date: string]: Note[]; // Key is ISO date "YYYY-MM-DD"
}
```

---

## Common Patterns

### Adding a New Page

1. Create `src/pages/NewPage.tsx`:

```tsx
export function NewPage({
  isSidebarCollapsed = false,
}: {
  isSidebarCollapsed?: boolean;
}) {
  const { accentColor } = useTheme();
  return <div className="h-full overflow-y-auto p-6">...</div>;
}
```

2. Add to `types.ts`:

```tsx
type Page = "..." | "newpage";
```

3. Add to `App.tsx`:

```tsx
import { NewPage } from "./pages/NewPage";
// In render:
{
  currentPage === "newpage" && (
    <NewPage isSidebarCollapsed={isSidebarCollapsed} />
  );
}
```

4. Add to `Sidebar.tsx`:

```tsx
// Add to order array, add icon import, add render block
```

### Adding a New IPC Handler

1. In `electron/main.ts` inside `setupIpcHandlers()`:

```typescript
ipcMain.handle("my-handler", async (_, arg1, arg2) => {
  // Do something
  return result;
});
```

2. Call from React:

```tsx
const result = await window.ipcRenderer.invoke("my-handler", arg1, arg2);
```

### Dashboard Container Style

```tsx
// Standard container with accent bar header
<motion.div className="p-6 md:p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <div
        className="w-1 h-4 rounded-full"
        style={{ backgroundColor: accentColor }}
      ></div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Container Title
      </p>
    </div>
    {/* Optional icon on right */}
    <div
      className="p-2.5 rounded-xl"
      style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
    >
      <Icon className="w-4 h-4" />
    </div>
  </div>
  {/* Content */}
</motion.div>
```

---

## Key IPC Handlers

| Handler                       | Purpose                         |
| ----------------------------- | ------------------------------- |
| `get-data` / `save-data`      | Calendar notes CRUD             |
| `get-boards` / `save-boards`  | Whiteboard data                 |
| `get-global-setting`          | Synced settings (theme, accent) |
| `save-global-setting`         | Persist synced settings         |
| `get-device-setting`          | Local settings (API keys)       |
| `save-device-setting`         | Persist local settings          |
| `parse-natural-language-note` | AI: text → structured event     |
| `generate-ai-overview`        | AI: daily briefing generation   |
| `flash-window`                | Flash taskbar (timer alerts)    |
| `get-github-username`         | GitHub integration              |
| `get-creator-stats`           | Fortnite API stats              |

---

## Recent Version History

### V5.6.0 - The Layout Update

_Focus: Multiple dashboard layouts, Focus-Centric UI, and Progress page enhancements._

#### New Features

- **Dashboard Layout Presets**:

  - **Default Layout**: Classic widget-based dashboard with Events, Trends, and Board Preview.
  - **Focus-Centric Layout**: Minimalist design with Playfair Display font, centered content, and bottom navigation bar.
  - **Timeline & Flow Layout**: Left-side timeline view with upcoming events and completion checkboxes.
  - **Calendar-Centric Layout**: Large calendar view with integrated task stats and trends.

- **Focus-Centric Dashboard**:

  - **Bottom Navigation Bar**: Landscape-oriented nav bar with icon tooltips.
  - **Collapsible Nav**: Hide/show bottom bar with smooth animations.
  - **Logo Header**: Centered Thoughts+ logo in top-left corner.
  - **Playfair Display Font**: Elegant serif typography for headers.

- **Timeline-Flow Completion**:

  - **Clickable Timeline Dots**: Complete tasks directly from timeline view.
  - **Visual Feedback**: Completed tasks show green checkmark and strikethrough title.

- **Progress Page Enhancements**:
  - **Events Panel**: Added "Events This Week" container matching Dashboard style.
  - **Time Range Sync**: Events panel syncs with Task Trends time range (1D/1W/1M/ALL).
  - **Task Completion**: Click checkboxes to complete/uncomplete tasks with confetti animation.
  - **Coloured Task Cards**: Importance-based colors (High=Red, Medium=Amber, Low=Green).
  - **Overdue Banners**: Visual "OVERDUE" indicator on past-due tasks.
  - **Improved Scrolling**: Fixed scrollbar glitches with stable gutter styling.

#### Improvements

- **Icon-Only Sidebar Mode**: Toggle sidebar between full labels and icons-only.
- **Layout Previews**: Visual preview cards in Settings for each dashboard layout.
- **Notifications Removed**: Cleaned up unused notification toast system.
- **Better Click Targets**: Larger, easier-to-click checkboxes throughout the app.

---

### V5.5.0 - The Progress Update

_Focus: Progress page analytics, weekly tracking, and performance._

- **Progress Page**: New dedicated page with weekly/monthly completion analytics.
- **Week Details Modal**: Click any week to see detailed task breakdown.
- **Streak Tracking**: Visual streak indicators and best streak records.
- **Lazy Loading**: Improved performance with code-splitting for all pages.
- **Taskbar Badge**: Windows taskbar shows pending task count.
- **1D Chart Filter**: New "Today" option for Task Trends chart.

---

### V5.4.0 - Thoughts+ Rebrand

_Focus: Rebranding to Thoughts+, new logo, and website update._

- **Rebranding**: Renamed from "Calendar+" to "Thoughts+".
- **New Logo**: Updated application logo to "Thoughts+".
- **Website**: New website at https://thoughtsplus.netlify.app/.
- **Source**: GitHub repository moved to https://github.com/umfhero/ThoughtsPlus.
- **Note**: This marks the version from the change of name/themeing.
- **Board Preview**: Fixed visual issues by removing heavy shadows and improving alignment for a flatter, cleaner look.
- **Data Migration**: Added "Force Import" capability to recover legacy data from CalendarPlus.

### V5.3.0 - The Efficiency Update

_Focus: Timer overhaul, dashboard refinement, and board previews._

#### New Features

- **Advanced Timer System**:

  - **Microwave-Style Input**: Rapidly type numbers (e.g., "130" = 1:30) to set timers.
  - **Quick Timer Modal** (`Ctrl+Enter`): Floating modal for fast timer interactions.
  - **Timer History**: Persistent log of completed sessions with restart capability.
  - **Mini Indicator**: Sidebar visualization of active timer progress.
  - **Stopwatch Mode**: Count-up functionality alongside count-down.

- **Board Preview Widget**:

  - **Live Snapshots**: Dashboard widget showing real-time view of the active board.
  - **Smart Centering**: Auto-zoom and pan to fit all notes in the preview.
  - **High-Fidelity**: Optimized rendering for text and note legibility.

- **Overdue Task Management**:
  - **Distinct Visuals**: Clear differentiation between active, completed, and missed tasks.
  - **Missed Status**: Separate "Missed" state for overdue items vs "Completed Late".
  - **Enhanced Trends**: Overdue data integrated into task completion charts.

#### Improvements

- **Dashboard Grid**:
  - **Row sync**: Combined widgets share height automatically.
  - **Headers**: Unified aesthetic across all dashboard containers.
- **Settings**:
  - **Time Format**: Global 12H/24H toggle.
  - **Persistence**: Chart time ranges and view preferences are now saved.

---

### V5.2.0 - The Creative Update

_Focus: Infinite canvas, sticky notes, and recurrence._

#### New Features

- **Whiteboard (Board)**:

  - **Infinite Canvas**: Scrollable, zoomable workspace.
  - **Sticky Notes**:
    - **Types**: Standard, Lined (for text), and Calculator (functional math notes).
    - **Customization**: 5 colors, adjustable fonts.
  - **Multiple Boards**: Create and manage distinct workspaces.
  - **Board Settings**: Per-board background patterns (Grid, Dots, Solid) and specific styles.

- **Recurring Events**:
  - **Flexible Schedules**: Daily, Weekly, Fortnightly, and Monthly repetition.
  - **Smart Series**: Grouping of related events in the dashboard.
  - **Completion Logic**: "Smart completion" advances to the next instance.

#### Improvements

- **Application Tour**: Revamped `SetupWizard` for better onboarding.
- **Sidebars**: Added support for custom pages and reordering.

---

## Styling Conventions

- **Rounded corners:** `rounded-2xl` (cards), `rounded-[2rem]` (large containers)
- **Shadows:** `shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50`
- **Dark mode:** Always include `dark:` variants
- **Spacing:** `p-6 md:p-8` for responsive padding
- **Accent color:** Use `accentColor` from `useTheme()`, not hardcoded colors
- **Animations:** Use `framer-motion` with `motion.div`, `AnimatePresence`

---

## File Locations

| Data Type       | Location                                              |
| --------------- | ----------------------------------------------------- |
| Calendar data   | `OneDrive/ThoughtsPlus/` or `Documents/ThoughtsPlus/` |
| Global settings | Same folder as calendar data                          |
| Device settings | `%APPDATA%/thoughts-plus/device-settings.json`        |
| Timer history   | `localStorage` key: `timer-history`                   |
| Feature toggles | `localStorage` key: `feature-toggles`                 |
| Sidebar order   | `localStorage` key: `sidebar-order`                   |

---

## Keyboard Shortcuts

| Shortcut        | Action                  |
| --------------- | ----------------------- |
| `Ctrl+M`        | Open AI Quick Add modal |
| `Ctrl+Enter`    | Open Quick Timer modal  |
| `Ctrl+`         | Open Settings           |
| `Space` (Timer) | Start/Pause timer       |
| `Esc` (Timer)   | Stop/Reset timer        |

---

## Microsoft Store Distribution & Updates

### Build Configuration

**Distribution Method**: Microsoft Store (MSIX/APPX package)

- Updates handled automatically through Microsoft Store
- No manual code signing required (Microsoft signs apps for free)
- Clean install/uninstall experience for users

### Package Configuration (`package.json`)

```json
{
  "name": "thoughts-plus",
  "version": "5.6.0",
  "author": "umf",
  "productName": "Thoughts+",
  "build": {
    "appId": "com.thoughtsplus.app",
    "productName": "Thoughts+",
    "publish": {
      "provider": "github",
      "owner": "umfhero",
      "repo": "ThoughtsPlus"
    },
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "appx", "arch": ["x64"] }
      ],
      "legalTrademarks": "Thoughts+",
      "publisherName": "umf"
    },
    "appx": {
      "displayName": "Thoughts+",
      "publisherDisplayName": "umf",
      "identityName": "ThoughtsPlus",
      "publisher": "CN=umf",
      "backgroundColor": "#F3F4F6"
    },
    "nsis": {
      "oneClick": true,
      "perMachine": true,
      "shortcutName": "Thoughts+",
      "uninstallDisplayName": "Thoughts+"
    }
  }
}
```

### Building for Microsoft Store

1. **Compile app**: `npm run build:compile`
2. **Build MSIX package**: `npx electron-builder --win appx`
3. **Output location**: `release/Thoughts+ [version].appx`

### Prerequisites

- **Windows Developer Mode** must be enabled (Settings → For developers → Developer Mode ON)
  - Required to avoid symlink permission errors during build
  - Allows electron-builder to extract winCodeSign tools properly

### Microsoft Store Submission Checklist

- ✅ MSIX package format (not EXE/MSI)
- ✅ Silent install support (handled by MSIX)
- ✅ Proper Add/Remove Programs entries (publisher: "umf", app: "Thoughts+")
- ✅ Code signing handled by Microsoft Store
- ✅ App updates delivered automatically via Store

### Important Notes

- **No self-signed certificates needed** - Microsoft Store signs the package
- **Validation errors** from EXE/MSI format are avoided with MSIX
- **Auto-updates** work seamlessly through Windows Store mechanisms
- All future releases should use MSIX format for consistency

---

## Microsoft Store APPX Certification - v5.6.0 Fixes

Fixed critical blank white screen issue when app launches in Microsoft Store APPX certification environment.

### Root Causes

- External Google Fonts CDN loading in sandboxed APPX environment
- Absolute asset paths incompatible with file:// protocol
- No error boundary for handling failures
- Missing startup diagnostics

### Fixes Implemented

1. **vite.config.ts** - Added `base: './'` for relative paths
2. **index.html** - Removed Google Fonts CDN links, fixed asset paths
3. **src/styles/index.css** - Replaced external imports with local font definitions
4. **src/components/ErrorBoundary.tsx** - New error boundary component
5. **src/main.tsx** - Added error boundary wrapper and startup logging
6. **electron/main.ts** - Added IPC handlers for error logging
7. **src/assets/fonts/fonts.css** - Local font definitions with system fallbacks

### Testing

- Build: `npm run build`
- Run: `./release/win-unpacked/Thoughts+.exe`
- Verify: App launches without blank screen, all pages load, no console errors

---

_Last updated: January 7, 2026 (v5.6.0)_
