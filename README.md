<div align="center">
  <img src="git/newpics/thoughtsplus/banner.png" alt="ThoughtsPlus Banner" width="70%" style="border-radius: 15px; overflow: hidden;" />

![Microsoft Store](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/umfhero/ThoughtsPlus/main/version.json&query=$.msstore_version&label=Microsoft%20Store&color=0078D4&logo=microsoft)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/umfhero/ThoughtsPlus/total)
![GitHub last commit](https://img.shields.io/github/last-commit/umfhero/ThoughtsPlus)
![GitHub stars](https://img.shields.io/github/stars/umfhero/ThoughtsPlus?style=social)
[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4%EF%B8%8F&color=white&labelColor=white&style=flat&logo=github&logoColor=black)](https://github.com/sponsors/umfhero)

[![Microsoft Store](https://img.shields.io/badge/Microsoft_Store-Download-white?style=for-the-badge&logo=microsoft&logoColor=0078D4)](https://apps.microsoft.com/detail/9nb8vzfwnv81?hl=en-GB&gl=GB)
[![Website](https://img.shields.io/badge/Website-Visit_Site-white?style=for-the-badge&logo=netlify&logoColor=00C7B7)](https://thoughtsplus.netlify.app/)
</div>

> [!IMPORTANT]
> #### Transparent. Free. Forever. **ThoughtsPlus is a labour of love, not a product.**
> * **Zero Cost:** No "Pro" tiers or hidden paywalls.
> * **Zero Distraction:** No advertisements or sponsored content.
> * **Zero Tracking:** No telemetry or data collection.
>
> We build this for fun and for the "nerdy" community. If you find value in it, your support is appreciated but never expected. 

**ThoughtsPlus** is an ultra-low-friction productivity suite designed for the "nerdy" brain. While modern tools like Notion and Obsidian have become cluttered with complex menus and feature bloat, ThoughtsPlus focuses on instant capture. It is designed for the user who needs to offload a thought in a split second and return to their primary task without breaking momentum.

## **Why ThoughtsPlus?**
Shortcut-First Design: Move at the speed of thought. Execute commands and capture notes through a no-menu only, keyboard-centric interface.

Frictionless Brain Dumping: Part calendar, part planning board and part analytics dashboard designed to be the ultimate landing zone for raw ideas.

Zero-Cloud Privacy: As a Cyber Security focused project, privacy is the default. No cloud lock in, no subscription fees and absolutely no telemetry. Your data stays on your machine.

Built for Power Users: Whether you are sketching on an infinite canvas, tracking GitHub contributions, or monitoring personal analytics, ThoughtsPlus brings your digital life into one customisable, high performance interface.

> [!TIP]
> "Life's too short to juggle a dozen ugly, slow apps. ThoughtsPlus is the buffer between your brain and your permanent knowledge base."

> This is a work in progress application, please be aware of bugs and issues, please report them to the [Issues](https://github.com/umfhero/ThoughtsPlus/issues) page.

### Dashboard

<div align="center">
  <img src="git/newpics/thoughtsplus/dashboard.png" alt="Dashboard" width="100%" />
  <p><em>Central command centre featuring widget-based layout, AI briefings, and real-time data.</em></p>
</div>

## Features

- **Advanced Timer System** - Microwave-style input, history tracking, and stopwatch capability
- **Always-on-Screen Timer** - Mini sidebar indicator to keep track of time while navigating
- **Smart Task Management** - Track completed, missed, and overdue tasks with visual insights
- **Interactive Dashboard** - Widget-based layout with Board Previews, Trends, and Quick Actions
- **AI-Powered Quick Notes** - Create recurring events and tasks instantly using natural language
- **Dynamic AI Briefing** - Daily summaries adapting to your schedule and missed deadlines
- **Drawing & Whiteboard** - Infinite canvas for visual brainstorming and note-taking
- **GitHub Integration** - View contribution graphs and activity directly in your dashboard
- **Creator Analytics** - Track Fortnite creator code performance and stats
- **Multi-Device Sync** - Seamlessly sync data across devices via cloud folders (OneDrive/Dropbox)
- **Offline-First Privacy** - Zero telemetry, local storage, and full data ownership
- **Customisable UI** - Drag-and-drop widgets, themes, and global keyboard shortcuts

### AI Optimisation for Free Tier Users

ThoughtsPlus is designed to work seamlessly with **Google Gemini's free tier** (50 requests/day). Through planned caching and smart quota management:

- **Use AI Quick Notes ~25-30 times per day** - Efficient model selection ensures you get the most out of your daily quota
- **Daily briefings without exhausting quota** - Smart caching prevents unnecessary API calls
- **Navigate Settings without wasting calls** - Validation results are cached, no repeated checks
- **Clear quota messages** - Know exactly when you've hit limits and when they'll reset

**No premium API subscription needed** - ThoughtsPlus maximises the free tier so you can enjoy AI features without worrying about costs.

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

|                                                                                                                                                                  |                                                                                                                                                                      |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|        <img src="git/newpics/thoughtsplus/onbaording.png" width="400" /><br>**Setup Wizard**<br>First-run onboarding experience with feature highlights.         | <img src="git/newpics/thoughtsplus/calendar.png" width="400" /><br>**Interactive Calendar**<br>Robust event management with recurring tasks and AI-powered creation. |
|       <img src="git/newpics/thoughtsplus/timer.png" width="400" /><br>**Advanced Timer**<br>Microwave-style input, stopwatch mode, and persistent history.       |      <img src="git/newpics/thoughtsplus/board.png" width="400" /><br>**Board / Whiteboard**<br>Infinite canvas with customisable sticky notes and backgrounds.       |
|     <img src="git/newpics/thoughtsplus/github.png" width="400" /><br>**GitHub Integration**<br>View your contribution graph and profile directly in the app.     |   <img src="git/newpics/thoughtsplus/creatorstats.png" width="400" /><br>**Creator Stats**<br>Fortnite analytics with playtime, players, and favourites tracking.    |
| <img src="git/newpics/thoughtsplus/settings.png" width="400" /><br>**Settings**<br>Comprehensive configuration for AI, integrations, storage, and notifications. | <img src="git/newpics/thoughtsplus/settingsappearnce.png" width="400" /><br>**Appearance**<br>Theming, accent colours, and UI customisation powered by Tailwind CSS. |
|  <img src="git/newpics/thoughtsplus/settingsfeaturetoggle.png" width="400" /><br>**Feature Toggles**<br>Modular architecture allowing dynamic feature enabling.  |   <img src="git/newpics/thoughtsplus/boardwidget.png" width="400" /><br>**Board Preview Widget**<br>Live dashboard widget showing your recent boards at a glance.    |

---

## Version History

### v5.6.0 - The Layout Update (last update for Github releases, new versions will be published to Microsoft store)

**The customisation update:** Multiple dashboard layouts, Focus-Centric UI with bottom navigation, and enhanced Progress page with task completion.

#### Dashboard Layout Presets

- **Default Layout** - Classic widget-based dashboard with Events, Trends, and Board Preview.
- **Focus-Centric Layout** - Minimalist design with Playfair Display font, centred greeting, and elegant bottom navigation bar.
- **Timeline & Flow Layout** - Left-side timeline view with clickable completion dots for upcoming events.
- **Calendar-Centric Layout** - Large calendar view with integrated task statistics and trends.

#### Progress Page Enhancements

- **Events Panel** - Added "Events This Week" container matching the Dashboard style.
- **Time Range Sync** - Events panel automatically syncs with Task Trends time range (1D/1W/1M/ALL).
- **Task Completion** - Complete/uncomplete tasks directly from Progress page with confetti celebration.
- **Coloured Task Cards** - Importance-based colours (High=Red, Medium=Amber, Low=Green).
- **Overdue Banners** - Visual "OVERDUE" indicator on past-due tasks.

#### UI Improvements

- **Icon-Only Sidebar Mode** - Toggle sidebar between full labels and compact icons-only view.
- **Layout Previews** - Visual preview cards in Settings for each dashboard layout option.
- **Better Click Targets** - Larger, easier-to-click checkboxes throughout the application.
- **Stable Scrolling** - Fixed scrollbar glitches with improved gutter styling.

---

### v5.5.0 - The Progress Update

**The analytics update:** New Progress page with weekly/monthly tracking, streak indicators, and performance improvements.

- **Progress Page** - Dedicated analytics page with weekly/monthly completion tracking.
- **Week Details Modal** - Click any week to see detailed task breakdown and statistics.
- **Streak Tracking** - Visual streak indicators with best streak records.
- **Lazy Loading** - Improved performance with code-splitting for all pages.
- **Taskbar Badge** - Windows taskbar shows pending task count.
- **1D Chart Filter** - New "Today" option added to Task Trends chart.

---

### v5.4.0 - The Rebrand (ThoughtsPlus)

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/ThoughtsPlus/v5.4.0/total?label=v5.4.0%20downloads)

**The identity update:** A complete rebrand from "Calendar+" to "ThoughtsPlus" to reflect the broader scope of the application as a Windows nerdy brain dump & organisation suite app.

- **Rebrand** - Renamed to ThoughtsPlus with new logos and identity.
- **Website** - Launched dedicated website for better onboarding.
- **Onboarding** - Redesigned first-run experience with cleaner aesthetics.
- **Localisation** - Fully migrated app to British English spelling (Organisation, Colour, Personalise).
- **Visual Cleanup** - Refined board preview widgets to remove heavy shadows for a cleaner, flatter aesthetic.
- **Data Safety** - Added "Force Import" capability to ensure legacy data is never lost during upgrades.

### v5.3.0 - The Efficiency Update

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/v5.3.0/total?label=v5.3.0%20downloads)

**The efficiency-focused update:** Introducing a powerful new Timer system, enhanced dashboard widgets, and smarter task management.

<div align="center">
  <img src="git/newpics/V5.3.0.png" alt="Dashboard v5.3.0" width="60%" />
  <p><em>New Board Preview widget (bottom right) for instant whiteboard access, plus distinct "Missed" and "Completed Late" task statuses in the Events widget.</em></p>
</div>

#### Advanced Timer Ecosystem

<div align="center">
  <img src="git/newpics/timer.png" alt="Timer Feature" width="60%" />
  <p><em>New dedicated Timer page with microwave-style input, history tracking, and stopwatch mode.</em></p>
</div>

- **Microwave-Style Input** - Rapidly set time by typing digits (e.g., "130" = 1:30).
- **Quick Timer Modal** - Floating overlay (`Ctrl+Enter`) for instant timer creation from anywhere.
- **Persistent History** - Restart recent timers with a single click.
- **Stopwatch Mode** - Count-up functionality for tracking task duration.
- **Mini Indicator** - Visual progress bar in the sidebar keeps you aware of remaining time.
- **Smart Alerts** - Window flashing and fullscreen overlays ensure you never miss an alarm.

#### Dashboard & Task Improvements

- **Board Preview Widget** - Live, high-fidelity snapshots of your whiteboard directly on the dashboard.
- **Overdue Task Mastery** - Distinct analytics for "Missed" tasks vs "Completed Late" items.
- **Grid Layout Sync** - Dashboard widgets automatically align heights for a cleaner look.
- **Unified Headers** - Polished, consistent design language across all containers.

#### Quality of Life

- **Global Time Format** - Toggle between 12H and 24H formats application-wide.
- **Smart Persistence** - Chart time ranges and view preferences are now saved.

### v5.2.1 - Stability & Performance Update

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/v5.2.1/total?label=v5.2.1%20downloads)

**The stability-focused update:** Streamlined architecture with improved performance and reliability.

#### Core Improvements

- **Removed Auto-Update System** - Simplified deployment and reduced complexity
- **Removed Roadmap Feature** - Streamlined settings interface for better focus
- **Performance Optimisations** - Faster load times and improved responsiveness
- **Stability Enhancements** - Bug fixes and error handling improvements
- **Documentation Updates** - Updated licence and version references across project

#### Bug Fixes

- **Build Error Resolution** - Fixed TypeScript compilation issues in Board.tsx
- **Component Cleanup** - Removed unused components and dependencies
- **Code Refinement** - Improved code quality and maintainability

### v5.2.0 - Board Visual Overhaul

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/v5.2.0/total?label=v5.2.0%20downloads)

**The creative workspace update:** Complete redesign of the Board feature with enhanced sticky notes, customisation options, and visual polish.

<div align="center">
  <img src="git/newpics/Board.png" alt="Board Feature" width="100%" />
  <p><em>Redesigned Board interface with customisable sticky notes and backgrounds.</em></p>
</div>

#### Board & Sticky Note Enhancements

- **Visual Style Overhaul** - Modern, polished sticky note designs with refined shadows and borders
- **Context Menus** - Right-click menus for notes and boards with quick actions
- **Calculator Note Type** - New sticky note type for quick calculations
- **Improved Zoom System** - Smoother pan and zoom controls for infinite canvas
- **Board Backgrounds** - Grid, dots, cork, and linen background patterns
- **Board Sidebar** - Quick navigation between multiple boards
- **Font Customisation** - Per-board font settings for personalised styling
- **Background Settings** - Per-board background preferences
- **Board Sorting** - Improved board organisation and management
- **Board Card UI** - Enhanced visual design for board selection
- **Lined Paper Style** - Adjustable spacing for lined sticky note backgrounds
- **Menu Button Positioning** - Refined UI controls for better accessibility
- **Global Settings Persistence** - Board preferences saved and restored across sessions
- **Icon Integration** - Visual indicators throughout board interface

#### AI System Upgrades

- **Gemini 2.5 Flash Integration** - Upgraded to latest Gemini model for better performance
- **Enhanced Model Fallback** - Improved AI model fallback system (2.5 Flash → 2.5 Flash Lite → 2.0 → 1.5)
- **Better Error Handling** - More robust API error management and user feedback

#### Bug Fixes

- **Board Rendering** - Fixed sticky note positioning and rendering issues
- **UI Consistency** - Resolved styling inconsistencies across board components
- **Performance** - Optimised board rendering for smoother interactions

### v5.1.4 - Dashboard Customisation & Advanced Analytics

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/v5.1.4/total?label=v5.1.4%20downloads)

**The productivity powerhouse update:** Complete dashboard overhaul with customisable layouts, advanced task trend analytics, recurring events, and refined user experience controls.

#### Dashboard Customisation

- **Drag-and-Drop Widget System** - Rearrange dashboard widgets to match your workflow
- **Combine Widgets** - Place two widgets side-by-side for efficient space usage
- **Resizable Panels** - Adjust widget heights and widths to your preference
- **Hide/Show Widgets** - Toggle visibility of widgets you don't need
- **Custom Widgets** - Add your own custom widgets with URLs and configurations
- **Edit Mode** - Long-press any widget to enter edit mode for quick customisation
- **Persistent Layouts** - Your dashboard configuration syncs across devices

#### Advanced Task Analytics

- **Task Trend Chart** - Visual graph showing completion score over time
- **Smart Projections** - See projected scores for upcoming tasks
- **Performance Metrics** - Track completion rate, missed tasks, early/late completions
- **Time Range Filters** - View trends by week, month, or all-time
- **Colour-Coded Insights** - Green for completed, red for missed, gray for projections
- **Interactive Tooltips** - Hover over data points for detailed task information
- **Motivational Feedback** - "On fire!", "Perfect!", and encouraging messages

#### Recurring Events

- **AI-Powered Detection** - Natural language parsing for recurring patterns
- **Flexible Recurrence** - Daily, weekly, fortnightly, monthly options
- **Series Management** - Group recurring events with completion tracking
- **Smart Completion** - Mark individual instances or entire series complete
- **Visual Indicators** - Repeat icon and "X/Y completed" counters
- **Delete Options** - Choose to delete single instance or entire series

#### Critical Bug Fixes

- **AI Modal Backdrop Fix** - Resolved freeze issue when adding recurring events
- **API Key Deletion** - Fixed persistence bug when removing API keys
- **Delete Confirmation Modal** - Replaced browser confirm with themed modal
- **Recurring Event Creation** - Fixed backend to properly generate all instances
- **Series Grouping** - Corrected dashboard display for recurring event series

#### UI/UX Improvements

- **Themed Delete Modals** - Beautiful, consistent modals for all confirmations
- **Improved Event Cards** - Better visual hierarchy and information density
- **Search & Filter** - Enhanced event filtering by importance and search terms
- **Completion Animations** - Satisfying confetti effects for task completion
- **Responsive Design** - Better mobile and small-screen layouts
- **Performance Optimisations** - Faster rendering and smoother animations

### v4.5.0 - Production Ready

![GitHub Downloads (specific release)](https://img.shields.io/github/downloads/umfhero/CalendarPlus/v4.5.0/total?label=v4.5.0%20downloads)

**User-configurable & production-ready:** Complete rewrite of integrations to be user-driven rather than developer-specific. No hardcoded credentials, multi-device sync support, and privacy-focused architecture.

- User-configurable API keys and integrations
- Multi-device cloud sync (OneDrive, Dropbox, etc.)
- Graceful feature degradation when not configured
- Enhanced Settings page with all configuration options
- Removed all hardcoded personal data
- Privacy-friendly default state (opt-in integrations)
- System username detection
- GitHub profile customisation
- Fortnite creator codes customisation

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
