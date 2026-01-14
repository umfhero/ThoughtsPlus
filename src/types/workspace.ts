import { FileCode, PenTool, FileText, LucideIcon } from 'lucide-react';

// File extension types
export type FileType = 'exec' | 'board' | 'note';

// File extension mapping
export const FILE_EXTENSIONS: Record<FileType, string> = {
    exec: '.exec',
    board: '.board',
    note: '.note',
};

// Icon mapping for file types
export const FILE_ICONS: Record<FileType, LucideIcon> = {
    exec: FileCode,
    board: PenTool,
    note: FileText,
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
    contentId: string;      // Reference to actual content (nerdbook id, board id, etc.)
}

// Workspace folder representation
export interface WorkspaceFolder {
    id: string;
    name: string;
    parentId: string | null; // null = root level
    createdAt: string;
    updatedAt: string;
}

// Combined workspace structure for persistence
export interface WorkspaceData {
    files: WorkspaceFile[];
    folders: WorkspaceFolder[];
    recentFiles: string[];  // Array of file IDs, most recent first
    expandedFolders: string[]; // Array of folder IDs that are expanded
    migrationComplete: boolean;
}

// Recent file display data
export interface RecentFile {
    id: string;
    name: string;
    type: FileType;
    lastOpened: string;     // ISO date string
    path: string;           // Full path like "Projects/Web/notes.exec"
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
}
