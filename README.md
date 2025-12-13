<div align="center">
  <img src="git/newpics/Banner.png" alt="CalendarPlus Banner" width="90%" style="border-radius: 15px;" />

  <h3>Latest Release 4.5.0</h3>

![GitHub Release](https://img.shields.io/github/v/release/umfhero/CalendarPlus)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/total)
![GitHub last commit](https://img.shields.io/github/last-commit/umfhero/CalendarPlus)
![GitHub stars](https://img.shields.io/github/stars/umfhero/CalendarPlus?style=social)

[![Website](https://img.shields.io/badge/Website-officialcalendarplus.netlify.app-blue?style=for-the-badge&logo=netlify)](https://officialcalendarplus.netlify.app/)

> **New in v4.5.0:** Fully user-configurable with your own API keys, GitHub profile and analytics integrations (Only creator stats for now). No more hardcoded personal data!

</div>

---

**CalendarPlus** is a Windows desktop calendar application built for people who are tired of clunky, overcomplicated calendar apps that make adding a simple event feel like filing taxes.

While other calendar apps are slow, bloated, and require multiple clicks just to add a reminder, CalendarPlus keeps it dead simple: hit a keyboard shortcut, type "Meeting with team next Monday at 10am", and you're done. No friction, no fuss, no endless dropdown menus. Just fast, intelligent event creation that actually works.

Built for frictionless event management, quick notes, and constant reminders that actually keep you on track, because life's too short to wrestle with your calendar.

### Dashboard

<div align="center">
  <img src="git/newpics/dashboard-v2.png" alt="Dashboard" width="100%" />
  <p><em>Central command centre featuring widget-based layout and real-time data.</em></p>
</div>

## Features

- **User-Configurable Integrations** - Add your own API keys and credentials
- **Multi-Device Sync** - Store data in OneDrive, Dropbox, or any cloud folder for seamless sync
- **AI-Powered Quick Notes** - Smart event creation using Google Gemini AI (bring your own API key)
- **Dynamic AI Briefing** - Daily briefings that adapt to completed tasks and missed deadlines
- **GitHub Integration** - Connect your GitHub profile to track activity and contributions
- **Creator Analytics** - Track Fortnite island stats with your own creator codes (optional)
- **Drawing & Whiteboard** - Visual note-taking and brainstorming canvas
- **Offline-First** - Local data storage with optional cloud sync
- **Modern UI** - Dark/light themes with customizable accent colors
- **Privacy-Focused** - All data stays local, no tracking or telemetry

### AI Optimization for Free Tier Users

CalendarPlus is designed to work seamlessly with **Google Gemini's free tier** (50 requests/day). Through planned caching and smart quota management:

- **Use AI Quick Notes ~25-30 times per day** - Efficient model selection ensures you get the most out of your daily quota
- **Daily briefings without exhausting quota** - Smart caching prevents unnecessary API calls
- **Navigate Settings without wasting calls** - Validation results are cached, no repeated checks
- **Clear quota messages** - Know exactly when you've hit limits and when they'll reset

**No premium API subscription needed** - CalendarPlus maximizes the free tier so you can enjoy AI features without worrying about costs.

## Getting Started

### First-Time Setup

1. **Download & Install** - Get the latest installer from [Releases](https://github.com/umfhero/CalendarPlus/releases)
2. **Choose Data Location** - Select where to store your calendar data (local or cloud folder)
3. **Configure Integrations (Optional)**
   - Add your Google Gemini API key for AI features
   - Enter your GitHub username to view your profile
   - Add Fortnite creator codes for analytics

### Multi-Device Sync Setup

To sync between multiple devices (e.g., desktop and laptop):

1. **Device 1:** Install app and choose OneDrive/Dropbox folder as data location
2. **Device 2:** Install app and point to the **same** OneDrive/Dropbox folder
3. **Done!** - All notes, settings, and drawings automatically sync

## Config

All settings are managed through the **Settings** page:

### AI Configuration

- Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Paste it in Settings → AI Configuration
- Enables AI Quick Note feature (Ctrl+M)

### GitHub Integration (Optional)

- Enter your GitHub username in Settings → GitHub Integration
- Optionally add a Personal Access Token for private repos
- View your profile, repos, and contribution graph

### Fortnite Creator Stats (Optional)

- Add your island codes (comma-separated) in Settings
- Track plays, unique players, favorites, and playtime
- Data syncs across devices

### Developer Configuration

If you're forking this project, you can preserve your personal baseline data:

1. Copy `user-defaults.template.json` to `user-defaults.json`
2. Add your GitHub username, creator codes, and preferences
3. The `user-defaults.json` file is gitignored by default for privacy

```json
{
  "github": {
    "username": "your-github-username"
  },
  "fortnite": {
    "creatorCodes": ["1234-5678-9012"]
  },
  "preferences": {
    "defaultUsername": "Your Name"
  }
}
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Desktop Runtime:** Electron
- **AI:** Google Gemini API
- **Data Storage:** Local JSON files with optional cloud sync
- **Build Tooling:** Vite, PostCSS, Electron Builder

## Security & Privacy

- **No Telemetry** - Zero tracking or data collection
- **Local Storage** - All data stays on your devices
- **Encrypted Credentials** - API keys stored securely in device settings
- **Open Source** - Full transparency, audit the code yourself

---

### Application Tour

|                                                                                                                                        |                                                                                                                                                    |
| :------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="git/newpics/onboarding-v2.jpg" width="400" /><br>**Setup Wizard**<br>First-run onboarding experience for easy configuration. |    <img src="git/newpics/calendar-v2.png" width="400" /><br>**Interactive Calendar**<br>Robust event management built with React & TypeScript.     |
| <img src="git/newpics/creatorstats-v2.png" width="400" /><br>**Creator Stats**<br>Data visualisation and analytics from imported CSVs. |       <img src="git/newpics/settings-v2.png" width="400" /><br>**Settings**<br>Comprehensive app configuration and local storage management.       |
|   <img src="git/newpics/appearnce-v2.png" width="400" /><br>**Appearance**<br>Theming and UI customisation powered by Tailwind CSS.    |    <img src="git/newpics/AI%20quick%20add%20note-v2.png" width="400" /><br>**AI Quick Note**<br>Smart input processing for rapid task creation.    |
|       <img src="git/newpics/drawing-v2.png" width="400" /><br>**Drawing Mode**<br>Canvas-based sketching for visual note-taking.       |  <img src="git/newpics/feature%20toggle-v2.png" width="400" /><br>**Feature Toggles**<br>Modular architecture allowing dynamic feature enabling.   |
|       <img src="git/newpics/shortcuts-v2.png" width="400" /><br>**Keyboard Shortcuts**<br>Productivity boosters for power users.       | <img src="git/newpics/scrolleddowndashboard-v2.png" width="400" /><br>**Extended Dashboard**<br>Scrollable view showcasing responsive grid layout. |

## Roadmap

### Planned Features

- [ ] **Microsoft Store Distribution** - Publishing to the Microsoft Store to resolve "Unknown Publisher" warnings and enable seamless background updates, utilizing the one-time developer fee for a cost-effective signing solution.
- [ ] **On hover Hour timer** - Hoverable hover to see count time in hours instead of days/weeks
- [ ] **Pets** - Mini pets that hang out in the app that are mini AIs (based on personality) that mentions notifcations etc
- [x] **Advanced Appearance Settings** - Custom font uploads, extended accent color support (backgrounds, icons).
- [x] **Dashboard Edit Mode** - Rearrange and add widgets to customize the dashboard layout.
- [x] **Refactor API Logic** - Implemented robust AI model fallback system (Gemini 2.5 → 2.0 → 1.5) to prevent API errors and ensure reliability.
- [x] **Third-Party Calendar Imports** - Selective import/export capabilities for external calendars.
- [x] **AI Quick Note with Recurring Options** - Quick note creation with flexible repetition settings.
- [x] **Settings Management** - Notification toggles etc
- [x] **Task Completion Analytics** - Track completed vs incomplete tasks with weekly/monthly/yearly performance graphs
- [x] **Enhanced Data Visualization** - More charts, trends, and insights into your productivity patterns
- [x] **Self-hosted Website** - Official website for CalendarPlus with intuitive onboarding, easy downloads and the latest news and updates
- [x] **Auto Update** - Automatic updates with self-deletion of old versions and seamless data migration, removing the need to manually uninstall and transfer files
- [x] **Global Keyboard Shortcuts** - Native support for standard shortcuts (Ctrl+C, Ctrl+V, Ctrl+A) across the entire application

### Future Considerations

- [ ] **Mobile Support (PWA)** - A Progressive Web App implementation for mobile access, featuring "Add to Home Screen" capability and push notifications for task reminders without app store fees.
- [ ] **Data Persistence & Sync (Migration to v2)** - Transitioning to a cloud-hybrid model using Supabase (PostgreSQL) for real-time multi-device syncing, while retaining offline capabilities via local caching.

---

## Past Versions

### v4.5.0 - Production Ready (Current)

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/v4.5.0/total?label=v4.5.0%20downloads)

**User-configurable & production-ready:** Complete rewrite of integrations to be user-driven rather than developer-specific. No hardcoded credentials, multi-device sync support, and privacy-focused architecture.

- User-configurable API keys and integrations
- Multi-device cloud sync (OneDrive, Dropbox, etc.)
- Graceful feature degradation when not configured
- Enhanced Settings page with all configuration options
- Removed all hardcoded personal data
- Privacy-friendly default state (opt-in integrations)
- System username detection
- GitHub profile customization
- Fortnite creator codes customization

### V3 - Pre-Production (Released - Wizard Installer)

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/V3/total?label=v3.0.0%20downloads)

_Released beta to testers_

- Creator stats and data visualisation
- Epic Games CSV analytics integration
- Custom chart components and trend analysis
- Drawing mode for visual note-taking
- AI Quick Add for rapid task creation
- Feature toggle system for modular architecture
- Responsive grid layout improvements
- Enhanced theming capabilities

### V2 - Feature Expansion

- Recurring events support
- Smart reminders and notifications
- CSV import functionality for analytics
- Enhanced UI/UX with modern design patterns
- Dashboard with widget-based layout
  - Settings and appearance customisation
- Keyboard shortcuts for power users

### V1 - Initial Release

- Core calendar functionality with event CRUD operations
- Basic UI with React and TypeScript
- Electron desktop application setup
- Local data persistence
- Initial Tailwind CSS styling

### V0 - Calendar Pro (Predecessor)

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/Calender-Pro/CalPro/total?label=Calendar%20Pro%20v1%20downloads)

<div align="center">
  <img src="git/newpics/oldapp-v2.png" alt="Calendar Pro - Original Version" width="600" />
  <p><em>Calendar Pro - Built with Python and CustomTkinter</em></p>
</div>

The original Calendar Pro was a Python-based desktop app built with CustomTkinter that experimented with alternative calendar navigation patterns. While the execution was rough, it laid the conceptual groundwork for CalendarPlus.

**What Worked:**

- Vertical month navigation concept that challenged traditional grid layouts
- Local data persistence with JSON storage
- Note management with countdown indicators
- Clean month selection UI that prioritised ease of navigation

**What Didn't Work:**

- Limited scalability with Python/CustomTkinter stack
- Poor performance and responsiveness
- Lack of advanced features (recurring events, analytics, integrations)
- Basic UI that couldn't compete with modern design standards
- No cross-platform optimisation or professional polish

---
