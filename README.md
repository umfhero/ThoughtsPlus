<h1>
  <img src="public/calendar_icon_181520.png" alt="Calendar Icon" width="36" style="vertical-align:middle; margin-right:8px;" />
  CalendarPlus
</h1>

![GitHub stars](https://img.shields.io/github/stars/umfhero/CalendarPlus?style=social)
![GitHub forks](https://img.shields.io/github/forks/umfhero/CalendarPlus?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/umfhero/CalendarPlus)
![GitHub repo size](https://img.shields.io/github/repo-size/umfhero/CalendarPlus)
![GitHub issues](https://img.shields.io/github/issues/umfhero/CalendarPlus)
![GitHub pull requests](https://img.shields.io/github/issues-pr/umfhero/CalendarPlus)
![Top Language](https://img.shields.io/github/languages/top/umfhero/CalendarPlus)

---

**CalendarPlus** is a Windows desktop calendar application engineered for personal productivity, event management and calendar data visualization. This project is developed for private use, but the codebase is open for review and local experimentation by others.

> **Note:** This is a personal-use project, not intended for public deployment. Feedback and code exploration are welcome.

### Dashboard

<div align="center">
  <img src="git/newpics/dashboard.png" alt="Dashboard" width="100%" />
  <p><em>Central command center featuring widget-based layout and real-time data.</em></p>
</div>

## Features

- Intuitive event CRUD (create, read, update, delete) operations
- Recurring events and smart reminders
- Responsive, modern UI built with React, TypeScript, and Tailwind CSS
- Local CSV import for analytics and custom graphing (Epic Games CSV support)
- Electron-based desktop experience for Windows, macOS, and Linux
- (Optional) Integration hooks for external calendar APIs (e.g., Google Calendar)
- Offline-first architecture with local persistence

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Desktop Runtime:** Electron
- **Data Handling:** Local storage, CSV parsing for analytics
- **Build Tooling:** Vite, PostCSS
- **Visualization:** Custom chart components

## Security & Privacy

- This project is for personal use. Do **not** commit sensitive data or API keys.
- If you fork or clone, create your own `.env` file for local configuration.

---

### Application Tour

|                                                                                                                                                 |                                                                                                                                     |
| :---------------------------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------: |
|    <img src="git/newpics/calendar.png" width="400" /><br>**Interactive Calendar**<br>Robust event management built with React & TypeScript.     | <img src="git/newpics/creatorstats.png" width="400" /><br>**Creator Stats**<br>Data visualization and analytics from imported CSVs. |
|       <img src="git/newpics/settings.png" width="400" /><br>**Settings**<br>Comprehensive app configuration and local storage management.       |   <img src="git/newpics/appearnce.png" width="400" /><br>**Appearance**<br>Theming and UI customization powered by Tailwind CSS.    |
|    <img src="git/newpics/AI%20quick%20add%20note.png" width="400" /><br>**AI Quick Note**<br>Smart input processing for rapid task creation.    |       <img src="git/newpics/drawing.png" width="400" /><br>**Drawing Mode**<br>Canvas-based sketching for visual note-taking.       |
|  <img src="git/newpics/feature%20toggle.png" width="400" /><br>**Feature Toggles**<br>Modular architecture allowing dynamic feature enabling.   |       <img src="git/newpics/shortcuts.png" width="400" /><br>**Keyboard Shortcuts**<br>Productivity boosters for power users.       |
| <img src="git/newpics/scrolleddowndashboard.png" width="400" /><br>**Extended Dashboard**<br>Scrollable view showcasing responsive grid layout. |                                                                                                                                     |

---

## Planned Features - Coming Soon!

### V4 - Semi-Production

- **Production-ready release** with stability improvements
- **Enhanced Drawing Whiteboard** with advanced tools
- **AI Integration** for quick idea dumping and brainstorming
- **Improved performance** and optimization
- **Extended analytics** and reporting features
- **Cloud sync** capabilities (optional)
- **Mobile companion app** (under consideration)

---

## Past Versions

### V3 - Pre-Production (Released - Wizard Installer)

- Creator stats and data visualization
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
- Settings and appearance customization
- Keyboard shortcuts for power users

### V1 - Initial Release

- Core calendar functionality with event CRUD operations
- Basic UI with React and TypeScript
- Electron desktop application setup
- Local data persistence
- Initial Tailwind CSS styling

### V0 - Calendar Pro (Predecessor)

<div align="center">
  <img src="git/newpics/old app.png" alt="Calendar Pro - Original Version" width="600" />
  <p><em>Calendar Pro - Built with Python and CustomTkinter</em></p>
</div>

The original Calendar Pro was a Python-based desktop app built with CustomTkinter that experimented with alternative calendar navigation patterns. While the execution was rough, it laid the conceptual groundwork for CalendarPlus.

**What Worked:**

- Vertical month navigation concept that challenged traditional grid layouts
- Local data persistence with JSON storage
- Note management with countdown indicators
- Clean month selection UI that prioritized ease of navigation

**What Didn't Work:**

- Limited scalability with Python/CustomTkinter stack
- Poor performance and responsiveness
- Lack of advanced features (recurring events, analytics, integrations)
- Basic UI that couldn't compete with modern design standards
- No cross-platform optimization or professional polish

**Lessons Learned:**  
CalendarPlus retains the core philosophy of intuitive navigation and note management but completely rebuilds the foundation with modern web technologies (React, TypeScript, Electron). The result is a production-ready application that combines the original vision with professional performance, extensibility, and design.

---
