# Implementation Plan: IDE Workspace

## Overview

This implementation transforms the Notebook page into an IDE-style workspace with a file tree sidebar, custom file extensions, folder organization, and smooth navigation transitions. The implementation follows an incremental approach, building core data structures first, then UI components, and finally integration with existing editors.

## Tasks

- [x] 1. Set up workspace data types and utilities
  - [x] 1.1 Create workspace types and constants
    - Create `src/types/workspace.ts` with WorkspaceFile, WorkspaceFolder, WorkspaceData interfaces
    - Define FileType union type and FILE_EXTENSIONS, FILE_ICONS constants
    - Add file name validation regex and helper types
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Implement workspace utility functions
    - Create `src/utils/workspace.ts` with core workspace logic
    - Implement `getFileDisplayName(file)` - returns "name.extension" format
    - Implement `validateFileName(name, type, parentId, existingFiles)` - checks uniqueness
    - Implement `validateFolderName(name, parentId, existingFolders)` - checks uniqueness
    - Implement `buildTreeStructure(files, folders)` - creates hierarchical tree
    - Implement `getDescendants(folderId, files, folders)` - for cascading delete
    - _Requirements: 1.2, 1.4, 1.5, 2.1, 3.4, 3.6, 6.2_

  - [ ]* 1.3 Write property tests for workspace utilities
    - **Property 1: File Name Uniqueness Validation**
    - **Property 2: File Display Format**
    - **Property 4: Tree Structure Rendering**
    - **Property 9: Cascading Folder Delete**
    - **Property 10: Folder Name Uniqueness**
    - **Validates: Requirements 1.2, 1.4, 1.5, 2.1, 3.4, 3.6, 6.2**

- [-] 2. Implement workspace persistence layer
  - [x] 2.1 Create workspace storage functions
    - Create `src/utils/workspaceStorage.ts`
    - Implement `saveWorkspace(data)` - saves to IPC
    - Implement `loadWorkspace()` - loads from IPC
    - Implement `addToRecentFiles(fileId, recentFiles)` - maintains recent list with cap
    - Add debounced auto-save helper
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [ ]* 2.2 Write property tests for persistence
    - **Property 11: Workspace State Persistence Round-Trip**
    - **Property 13: Recent Files Cap**
    - **Validates: Requirements 4.5, 5.2, 9.1, 9.2, 9.4, 9.5**

- [x] 3. Checkpoint - Core utilities complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement data migration
  - [x] 4.1 Create migration utility
    - Create `src/utils/workspaceMigration.ts`
    - Implement `migrateNerdbooks(nerdbooks)` - creates .exec files
    - Implement `migrateBoards(boards)` - creates .board files
    - Implement `migrateQuickNotes(notes)` - creates .note files
    - Implement `runMigration(existingData, workspaceData)` - orchestrates migration
    - Add migration complete flag check
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 4.2 Write property tests for migration
    - **Property 15: Migration Creates Workspace Files**
    - **Property 16: Migration Preserves Content Reference**
    - **Property 17: Migration Idempotence**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 5. Build FileTree component
  - [x] 5.1 Create FileTreeNode component
    - Create `src/components/workspace/FileTreeNode.tsx`
    - Implement file node with icon, name, selection highlight
    - Implement folder node with expand/collapse toggle
    - Add click handlers for selection and toggle
    - Style with Tailwind matching existing app theme
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.2 Create FileTree component
    - Create `src/components/workspace/FileTree.tsx`
    - Render hierarchical tree using FileTreeNode recursively
    - Implement drag-and-drop for file/folder moving
    - Add context menu for rename, delete, move
    - Add "New File" and "New Folder" buttons at top
    - _Requirements: 2.1, 2.7, 2.8, 3.2, 3.3_

  - [ ]* 5.3 Write property tests for FileTree logic
    - **Property 5: Folder Toggle State**
    - **Property 6: File Selection Updates State**
    - **Property 7: Folder Creation at Any Level**
    - **Property 8: Item Move Operation**
    - **Validates: Requirements 2.4, 2.5, 3.1, 3.2, 3.3, 5.4**

- [x] 6. Build ContentArea component
  - [x] 6.1 Create WelcomeView component
    - Create `src/components/workspace/WelcomeView.tsx`
    - Display recent files list with icons and timestamps
    - Add quick action buttons for creating new files
    - Style to match VS Code welcome screen aesthetic
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 Create TextNoteEditor component
    - Create `src/components/workspace/TextNoteEditor.tsx`
    - Simple textarea-based editor for .note files
    - Auto-save on content change with debounce
    - _Requirements: 8.3_

  - [x] 6.3 Create ContentArea component
    - Create `src/components/workspace/ContentArea.tsx`
    - Render WelcomeView when no file selected
    - Render appropriate editor based on file type
    - Add file header with name and type icon
    - _Requirements: 5.1, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.4 Write property tests for ContentArea logic
    - **Property 12: Welcome View Display Condition**
    - **Property 18: Editor Selection by File Type**
    - **Property 19: File Header Display**
    - **Validates: Requirements 5.1, 8.1, 8.2, 8.3, 8.4**

- [x] 7. Checkpoint - Components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build WorkspacePage
  - [x] 8.1 Create WorkspacePage component
    - Create `src/pages/Workspace.tsx`
    - Integrate FileTree sidebar and ContentArea
    - Implement workspace state management (selected file, expanded folders)
    - Wire up file operations (create, rename, delete, move)
    - Add back button navigation to dashboard
    - _Requirements: 2.1, 4.3, 6.1, 6.3, 6.4_

  - [x] 8.2 Implement sidebar transition animations
    - Add Framer Motion animations for sidebar slide in/out
    - Coordinate with main app sidebar visibility
    - Implement smooth transition when entering/exiting workspace
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 8.3 Write property tests for file operations
    - **Property 3: File Creation with Extension**
    - **Property 14: File Deletion Behavior**
    - **Validates: Requirements 1.3, 6.4**

- [x] 9. Integrate with existing editors
  - [x] 9.1 Adapt NerdbookEditor for workspace
    - Modify to accept contentId prop instead of managing own state
    - Ensure it loads/saves via workspace content reference
    - _Requirements: 8.1_

  - [x] 9.2 Adapt BoardEditor for workspace
    - Modify to accept contentId prop instead of managing own state
    - Ensure it loads/saves via workspace content reference
    - _Requirements: 8.2_

  - [x] 9.3 Wire up content loading in ContentArea
    - Load nerdbook content when .exec file selected
    - Load board content when .board file selected
    - Load quick note content when .note file selected
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Update App routing and navigation
  - [x] 10.1 Update App.tsx for workspace navigation
    - Replace Notebook page with Workspace page
    - Add sidebar visibility state for transitions
    - Update Page type to include 'workspace'
    - _Requirements: 4.1, 4.2_

  - [x] 10.2 Update Sidebar component
    - Change "Notebook" to trigger workspace entry
    - Add animation support for sliding off-screen
    - _Requirements: 4.1, 4.4_

- [x] 11. Implement migration on first load
  - [x] 11.1 Add migration trigger to WorkspacePage
    - Check migrationComplete flag on mount
    - Run migration if not complete
    - Load existing nerdbooks, boards, quick notes
    - Create workspace files and mark migration complete
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12. Add Electron IPC handlers
  - [x] 12.1 Add workspace IPC handlers
    - Add `get-workspace` handler in electron/main.ts
    - Add `save-workspace` handler in electron/main.ts
    - Store workspace data in user data directory
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 13. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.
  - Verify migration works with existing data
  - Test all file operations end-to-end

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing NerdbookEditor and BoardEditor components will be adapted rather than rewritten
