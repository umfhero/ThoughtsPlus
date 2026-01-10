# Changelog

Track all new features, fixes, and changes for each version.

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

---

## v5.7.1

> **Upcoming** - Power User & Quick Capture

- **Global Quick Capture (Overlay)**: Press a customizable hotkey (e.g., Alt+Q) anywhere—even over games/movies—to dim the screen and open a floaty note input.
  - **Auto-Save**: Automatically saves to your board/inbox when you hit Esc or close it.
  - **Game Mode Friendly**: Designed to be lightweight and non-intrusive.
- **Global Hotkeys**: Configurable system-wide shortcuts for other app functions
- **Settings**: Added "Check for Updates" button linking to Microsoft Store
- Global language, 

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
