<h1>
  <img src="public/calendar_icon_181520.png" alt="Calendar Icon" width="36" style="vertical-align:middle; margin-right:8px;" />
  CalendarPlus
</h1>

---

**CalendarPlus** is a Windows desktop calendar application engineered for personal productivity, event management and calendar data visualization. This project is developed for private use, but the codebase is open for review and local experimentation by others.

> **Note:** This is a personal-use project, not intended for public deployment. Feedback and code exploration are welcome.

## Features

- Intuitive event CRUD (create, read, update, delete) operations
- Recurring events and smart reminders
- Responsive, modern UI built with React, TypeScript, and Tailwind CSS
- Local CSV import for analytics and custom graphing (Epic Games CSV support)
- Electron-based desktop experience for Windows, macOS, and Linux
- (Optional) Integration hooks for external calendar APIs (e.g., Google Calendar)
- Offline-first architecture with local persistence

## Screenshots

The following screenshots are taken from the app and live in the `git/` folder.

- **Dashboard**

  ![Dashboard](git/dashboard.png)

- **Dark Theme**

  ![Dark Theme](git/darktheme.png)

- **Accent Color Settings**

  ![Accent Color Settings](git/accentcolor_settings.png)

- **Creator Stats**

  ![Creator Stats](git/creatorstats.png)

---

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
