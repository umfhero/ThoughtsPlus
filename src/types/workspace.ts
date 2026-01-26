import { FileCode, PenTool, FileText, LucideIcon, GitPullRequest, Brain, FileType as LucideFileType, FileSpreadsheet, Image } from 'lucide-react';

// File extension types
export type FileType = 'exec' | 'board' | 'note' | 'nbm' | 'flashcards' | 'pdf' | 'docx' | 'xlsx' | 'txt' | 'md' | 'image';

// File extension mapping
export const FILE_EXTENSIONS: Record<FileType, string> = {
    exec: '.exec',
    board: '.brd',
    note: '.nt',
    nbm: '.nbm',
    flashcards: '.deck',
    pdf: '.pdf',
    docx: '.docx',
    xlsx: '.xlsx',
    txt: '.txt',
    md: '.md',
    image: '', // Images have various extensions (.png, .jpg, etc.)
};

// Icon mapping for file types
export const FILE_ICONS: Record<FileType, LucideIcon> = {
    exec: FileCode,
    board: PenTool,
    note: FileText,
    nbm: GitPullRequest,
    flashcards: Brain,
    pdf: LucideFileType,
    docx: LucideFileType,
    xlsx: FileSpreadsheet,
    txt: FileText,
    md: FileText,
    image: Image,
};

// File name validation - cannot contain: / \ : * ? " < > |
export const INVALID_FILENAME_CHARS_REGEX = /[\/\\:*?"<>|]/;

// Extension to FileType mapping for external files
export const EXTENSION_TO_FILETYPE: Record<string, FileType> = {
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.doc': 'docx', // Treat .doc as docx
    '.xlsx': 'xlsx',
    '.xls': 'xlsx', // Treat .xls as xlsx
    '.txt': 'txt',
    '.md': 'md',
    '.markdown': 'md',
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.gif': 'image',
    '.bmp': 'image',
    '.webp': 'image',
    '.svg': 'image',
    // Native types
    '.exec': 'exec',
    '.brd': 'board',
    '.nt': 'note',
    '.nbm': 'nbm',
    '.deck': 'flashcards',
};

/**
 * Detects file type from file extension
 * @param filename - The filename with extension
 * @returns FileType or null if not recognized
 */
export function detectFileType(filename: string): FileType | null {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return EXTENSION_TO_FILETYPE[ext] || null;
}

/**
 * Checks if a file type is a document type (external file)
 * @param type - The file type
 * @returns true if it's a document type
 */
export function isDocumentType(type: FileType): boolean {
    return ['pdf', 'docx', 'xlsx', 'txt', 'md', 'image'].includes(type);
}

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
    color?: string;         // Folder icon color (hex color)
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
    color?: string;         // Folder icon color (hex color)
}
