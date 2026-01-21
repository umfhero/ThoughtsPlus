import { FileCode, PenTool, FileText, LucideIcon, GitPullRequest, Brain } from 'lucide-react';

// File extension types
export type FileType = 'exec' | 'board' | 'note' | 'nbm' | 'flashcards';

// File extension mapping
export const FILE_EXTENSIONS: Record<FileType, string> = {
    exec: '.exec',
    board: '.brd',
    note: '.nt',
    nbm: '.nbm',
    flashcards: '.deck',
};

// Icon mapping for file types
export const FILE_ICONS: Record<FileType, LucideIcon> = {
    exec: FileCode,
    board: PenTool,
    note: FileText,
    nbm: GitPullRequest,
    flashcards: Brain,
};

// File name validation - cannot contain: / \ : * ? " < > |
export const INVALID_FILENAME_CHARS_REGEX = /[\/\\:*?"<>|]/;

// Workspace file representation
export interface WorkspaceFile {
    id: string;
    name: string;           // Without extension (e.g., "project-notes")
    type: FileType;         // Determines extension and editor
    parentId: string | null; // null = root level
    createdAt: string;      // ISO date string
    updatedAt: string;      // ISO date string
    contentId: string;      // Legacy: Reference to content in JSON (deprecated)
    sortOrder?: number;     // Custom sort order (lower = higher in list)
    filePath?: string;      // Full path to the file on disk (optional for backward compatibility)
}

// Workspace folder representation
export interface WorkspaceFolder {
    id: string;
    name: string;
    parentId: string | null; // null = root level
    createdAt: string;
    updatedAt: string;
    sortOrder?: number;     // Custom sort order (lower = higher in list)
    isQuickNotesFolder?: boolean; // Special folder for quick notes
}

// Open tab representation
export interface OpenTab {
    fileId: string;
    name: string;
    type: FileType;
}

// Saved session representation
export interface WorkspaceSession {
    id: string;
    name: string;
    openTabs: string[];     // Array of file IDs
    activeTabId: string | null;
    createdAt: string;
    updatedAt: string;
}

// Combined workspace structure for persistence
export interface WorkspaceData {
    files: WorkspaceFile[];
    folders: WorkspaceFolder[];
    recentFiles: string[];  // Array of file IDs, most recent first
    expandedFolders: string[]; // Array of folder IDs that are expanded
    openTabs: string[];     // Array of file IDs for open tabs
    activeTabId: string | null; // Currently active tab
    sidebarVisible: boolean; // Whether sidebar is visible
    migrationComplete: boolean; // Legacy migration from old data format
    fileBasedMigrationComplete?: boolean; // Migration to individual files
    sessions?: WorkspaceSession[]; // Saved sessions
}

// Recent file display data
export interface RecentFile {
    id: string;
    name: string;
    type: FileType;
    lastOpened: string;     // ISO date string
    path: string;           // Virtual path in workspace tree (e.g., "Projects/Web/notes")
    filePath: string;       // Full file system path
    fileName: string;       // File name with extension (e.g., "notes.exec")
}

// File name validation result
export interface FileNameValidation {
    isValid: boolean;
    error?: string;
}

// Tree node for hierarchical rendering
export interface TreeNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    fileType?: FileType;    // Only for files
    parentId: string | null;
    children: TreeNode[];   // Only for folders
    createdAt: string;
    updatedAt: string;
    contentId?: string;     // Only for files
    sortOrder?: number;     // Custom sort order
    isQuickNotesFolder?: boolean; // Special folder for quick notes
}
