# Changelog

Track all new features, fixes, and changes for each version.

---

## v5.7.1

> **Release Date**: January 12, 2026 - Microsoft Store Certification Fix

### 🛠️ Fixes

- **AI Region Handling**: Improved error messaging for Gemini region restrictions
- **Settings UX**: Redesigned AI Configuration section with collapsible provider menus
- **User Guidance**: Added clear warnings and helpful messages directing users to Perplexity in restricted regions


### 🎨 UI/UX Improvements

- Cleaner AI provider selection with dropdown indicators
- Current provider status display
- Tooltip hints for advanced features
- Better visual hierarchy in Settings

---

## v6.1.0

> **Future Concept** - Ecosystem Expansion

- **Voice Memos**: Record voice notes directly onto the board
- **Podcast Mode**: READ out your notes/articles using AI TTS

---

## v6.0.0

> **Future Concept** - The Creator Update

- **Board Templates**: Kanban, Retrospective, Brainstorming, Roadmap layouts
- **Screen Recording**: Built-in simple screen recorder to attach clips to notes
- **Export Options**: Export boards to PDF, High-Res Image, or Markdown

---

## v5.9.0

> **Major Milestone** - "Synergy" Update

- **Collaboration**: (Experimental) Live peer-to-peer board sharing
- **Plugin System**: API for community-created widgets (linked to website)

---

## v5.8.0

> **Future Concept** - The Notebook Update

- **Modular Notebook System**: A new central "Library" sidebar page replacing the standalone Board.
- **Note Modules**:
  - **Visual Board**: The classic whiteboard experience (moved here from sidebar).
  - **Smart-Doc (Jupyter Style)**: A linear, rich-text document allowing mixed media, runnable code snippets, and visual embeds.
  - **Study Mode**: Flashcards and quizzes generated automatically from your current note/module (and tags).
- **AI "Backbone" Generation**: AI generates the structure (Headings, Sections, Bullet points) based on a topic, and _you_ fill in the key details.
  - _Goal: Stop wasting time on setup/formatting, focus purely on the content._
- **Context Awareness**: Drag & drop Files (PDFs, Coursework) into a notebook to power the AI context and Quiz generation.
- **Visual Module Selector**: A beautiful gallery view to choose your note type, complete with simplified visual diagrams explaining each structure.
- **Knowledge Graph**:

  - **Interactive Node View**: Visualize connections between your notes based on shared tags (Obsidian-style).
  - **Dashboard Widget**: A new mini-graph widget to see your knowledge network at a glance.
  - **Multi-Tagging**: Notes can hold multiple tags to create complex web-like relationships.

- **Language Selection Infrastructure**: Framework for multi-language support
  - Language context with 10 supported languages (en, es, fr, de, pt, ja, zh, ko, it, ru)
  - Language preference persistence to storage
  - Language selector UI component (currently disabled)
    **TODO - Language Feature:**
- Add translation JSON files for each supported language
- Implement actual translation lookup in `t()` function
- Replace emoji flags with SVG flag icons (emoji flags don't render properly on Windows)
- Wrap all UI text throughout the app with `t('key')` translation calls
- Re-enable Language section in Settings once translations are ready

> **Upcoming** - Power User & Quick Capture

- **Global Quick Capture (Overlay)**: Press a customizable hotkey (e.g., Alt+Q) anywhere—even over games/movies—to dim the screen and open a floaty note input.
  - **Auto-Save**: Automatically saves to your board/inbox when you hit Esc or close it.
  - **Game Mode Friendly**: Designed to be lightweight and non-intrusive.
- **Global Hotkeys**: Configurable system-wide shortcuts for other app functions

---

## v5.7.1

- **Settings**: Added "Check for Updates" button linking to Microsoft Store
- **Custom Theme System**: Create, save, load, and manage personalized themes
  - Custom color pickers for background, text, sidebar, border, and card colors
  - Save unlimited custom themes with names
  - Load, update, and delete saved themes
  - Live preview of custom theme changes
  - Automatic fallback to Light theme when deleting active custom theme
  - Theme persistence across app restarts

## v5.7.0

> **Published** - The Multi-Provider AI & Security Update

This update brings major AI improvements with encrypted storage, multi-provider support, and enhanced Board features:

New Features
Encrypted API Key Storage – All API keys now encrypted using Windows DPAPI for maximum security
Multi-Provider AI Support – Choose between Gemini and Perplexity with seamless switching
Auto-Fallback System – Automatic failover when one provider runs out of quota
Enhanced Error Messages – User-friendly messages for AI issues including geographic restrictions

Note: Upgrading automatically migrates API keys to encrypted storage.

---

## v5.6.9

> **Published** - The board UI and UX functionality update

- Fixed board preview shadows extending beyond card boundaries on dashboard
- Board: Added drag handle bar for moving notes (allows text selection inside notes)
- Paste clipboard content into notes (Images, notes, text)
- Shortcuts (Ctrl+B, Ctrl+I, Ctrl+U to make text bold, italic, underline)
- Fixed backspace deleting notes not working
- Fixed board cursor being fully overriden and now replaced by default user cursor (special cases like drag handles, resizing and checkbox are kept the same UX/UI visual cursors)
- Image notes now scale to the image size, not just scaled to landscape images anymore
- Tweaked the edit note menu to be more visible
- Image notes now have a tape attachment by default
- Semi fixed shadow issue appearing on board preview widget on dashboard
- Github contributions in settings removed bots appearing in the list
- Added custom color picker to edit note menu

---

## v5.6.8

> **Published**

- Fixed taskbar icons not being transparent on Windows
