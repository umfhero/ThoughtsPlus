# Requirements Document

## Introduction

This feature transforms the Notebook page into an IDE-style workspace with a file tree sidebar, custom file extensions, folder organization, and file type icons. Users can manage all their note structures (Nerdbooks, Boards, Quick Notes) in a unified file system interface, similar to VS Code or other modern IDEs.

## Glossary

- **Workspace**: The IDE-style interface that replaces the current Notebook hub, containing a file tree sidebar and content area
- **File_Tree**: A hierarchical sidebar displaying folders and files with icons, supporting expand/collapse and selection
- **Workspace_File**: A document in the workspace with a name, type extension, and content (e.g., "project-notes.exec")
- **File_Extension**: A suffix indicating the file type: `.exec` (executable notebooks), `.board` (whiteboards), `.note` (quick notes)
- **Folder**: A container that can hold Workspace_Files and other Folders for organization
- **Content_Area**: The main editing region where selected files are opened and edited
- **Welcome_View**: The default view shown when no file is selected, displaying recently opened files

## Requirements

### Requirement 1: File Extension System

**User Story:** As a user, I want distinct file extensions for different note types, so that I can quickly identify the type of content in each file.

#### Acceptance Criteria

1. THE Workspace SHALL support three file extensions: `.exec` for executable notebooks, `.board` for whiteboards, and `.note` for quick notes
2. WHEN a file is displayed in the File_Tree, THE Workspace SHALL show the full filename including extension (e.g., "project-notes.exec")
3. WHEN a user creates a new file, THE Workspace SHALL automatically append the appropriate extension based on the selected file type
4. THE Workspace SHALL prevent creation of duplicate files with the same name AND same extension within the same folder
5. THE Workspace SHALL allow files with the same name but different extensions to coexist (e.g., "project.exec" and "project.board")

### Requirement 2: File Tree Sidebar

**User Story:** As a user, I want a file tree sidebar like VS Code, so that I can see and navigate all my files and folders in one place.

#### Acceptance Criteria

1. WHEN the user enters the Workspace, THE File_Tree SHALL display all folders and files in a hierarchical tree structure
2. THE File_Tree SHALL display appropriate icons for each file type: FileCode icon for `.exec`, PenTool icon for `.board`, FileText icon for `.note`
3. THE File_Tree SHALL display Folder icons that change between closed and open states based on expansion
4. WHEN a user clicks a folder, THE File_Tree SHALL toggle the folder's expanded/collapsed state
5. WHEN a user clicks a file, THE Workspace SHALL open that file in the Content_Area
6. THE File_Tree SHALL highlight the currently selected/open file
7. THE File_Tree SHALL support right-click context menu for rename, delete, and move operations
8. THE File_Tree SHALL display a "New File" and "New Folder" button at the top

### Requirement 3: Folder Organization

**User Story:** As a user, I want to organize my files into folders, so that I can group related content together.

#### Acceptance Criteria

1. THE Workspace SHALL allow users to create folders at any level of the hierarchy
2. THE Workspace SHALL allow users to move files between folders via drag-and-drop
3. THE Workspace SHALL allow users to move folders (with contents) between parent folders
4. WHEN a folder is deleted, THE Workspace SHALL prompt for confirmation and delete all contained files and subfolders
5. THE Workspace SHALL allow folders to contain files of different types (e.g., a folder with both `.exec` and `.board` files)
6. THE Workspace SHALL prevent creation of duplicate folder names within the same parent folder

### Requirement 4: Workspace Navigation UI

**User Story:** As a user, I want a smooth transition into the workspace view, so that the interface feels cohesive and intuitive.

#### Acceptance Criteria

1. WHEN the user clicks "Notebook" in the main sidebar, THE main sidebar SHALL slide off-screen to the left
2. WHEN entering the Workspace, THE File_Tree sidebar SHALL slide in from the left
3. THE File_Tree sidebar SHALL include a back button at the top-left that returns to the Dashboard
4. WHEN the back button is clicked, THE Workspace SHALL animate the File_Tree sliding out and main sidebar sliding back in
5. THE Workspace SHALL preserve the user's last selected file and folder expansion state between sessions

### Requirement 5: Welcome View and Recent Files

**User Story:** As a user, I want to see my recently opened files when no file is selected, so that I can quickly resume my work.

#### Acceptance Criteria

1. WHEN no file is open, THE Content_Area SHALL display a Welcome_View
2. THE Welcome_View SHALL display a list of recently opened files (up to 10 items)
3. THE Welcome_View SHALL show each recent file's name, type icon, and last modified time
4. WHEN a user clicks a recent file, THE Workspace SHALL open that file in the Content_Area
5. THE Welcome_View SHALL display quick action buttons for creating new files of each type

### Requirement 6: File Operations

**User Story:** As a user, I want to create, rename, and delete files, so that I can manage my workspace content.

#### Acceptance Criteria

1. WHEN a user creates a new file, THE Workspace SHALL prompt for a filename (without extension)
2. WHEN a user renames a file, THE Workspace SHALL validate the new name doesn't conflict with existing files of the same type in the same folder
3. WHEN a user deletes a file, THE Workspace SHALL prompt for confirmation before deletion
4. IF a file deletion is confirmed, THEN THE Workspace SHALL remove the file and close it if currently open
5. THE Workspace SHALL auto-save file content changes with a debounce delay

### Requirement 7: Data Migration

**User Story:** As a user, I want my existing notes to be automatically migrated, so that I don't lose any content.

#### Acceptance Criteria

1. WHEN the Workspace loads for the first time, THE Workspace SHALL migrate existing Nerdbooks to `.exec` files in the root folder
2. WHEN the Workspace loads for the first time, THE Workspace SHALL migrate existing Boards to `.board` files in the root folder
3. WHEN the Workspace loads for the first time, THE Workspace SHALL migrate existing Quick Notes to `.note` files in the root folder
4. THE Workspace SHALL preserve all content and metadata during migration
5. THE Workspace SHALL only perform migration once and mark it as complete

### Requirement 8: Content Editing

**User Story:** As a user, I want to edit my files in the content area, so that I can work on my notes seamlessly.

#### Acceptance Criteria

1. WHEN a `.exec` file is opened, THE Content_Area SHALL display the Nerdbook editor interface
2. WHEN a `.board` file is opened, THE Content_Area SHALL display the Board/whiteboard editor interface
3. WHEN a `.note` file is opened, THE Content_Area SHALL display a simple text editor interface
4. THE Content_Area SHALL show the current file's name and type in a header/tab area
5. WHEN switching between files, THE Workspace SHALL preserve unsaved changes or prompt to save

### Requirement 9: Persistence

**User Story:** As a user, I want my workspace structure to be saved, so that my organization persists across sessions.

#### Acceptance Criteria

1. THE Workspace SHALL persist the folder structure to local storage
2. THE Workspace SHALL persist file metadata (name, type, parent folder) to local storage
3. THE Workspace SHALL persist file content using the existing IPC mechanisms for each file type
4. WHEN the application restarts, THE Workspace SHALL restore the complete folder and file structure
5. THE Workspace SHALL persist the list of recently opened files
