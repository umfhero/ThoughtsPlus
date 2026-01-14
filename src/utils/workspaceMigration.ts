import { WorkspaceFile, WorkspaceData, FileType } from '../types/workspace';
import { NerdNotebook, QuickNote } from '../types';

/**
 * Board interface for migration (matches Board.tsx structure)
 */
export interface BoardForMigration {
    id: string;
    name: string;
    color: string;
    notes: unknown[]; // StickyNote array, but we don't need the details for migration
    lastAccessed?: number;
    font?: string;
    background?: { name: string; value: string; pattern?: string };
}

/**
 * Existing data structure that may need migration
 */
export interface ExistingData {
    nerdbooks?: NerdNotebook[];
    boards?: BoardForMigration[];
    quickNotes?: QuickNote[];
}

/**
 * Generates a unique ID for workspace items
 */
function generateId(): string {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Sanitizes a name for use as a file name
 * Removes invalid characters and trims whitespace
 */
function sanitizeFileName(name: string): string {
    // Remove invalid characters: / \ : * ? " < > |
    const sanitized = name.replace(/[\/\\:*?"<>|]/g, '-').trim();
    // If empty after sanitization, return a default name
    return sanitized || 'untitled';
}

/**
 * Creates a WorkspaceFile from a NerdNotebook
 * @param nerdbook - The nerdbook to migrate
 * @returns A WorkspaceFile representing the nerdbook
 */
export function createFileFromNerdbook(nerdbook: NerdNotebook): WorkspaceFile {
    const now = new Date().toISOString();
    return {
        id: generateId(),
        name: sanitizeFileName(nerdbook.title),
        type: 'exec' as FileType,
        parentId: null, // Root level
        createdAt: nerdbook.createdAt || now,
        updatedAt: nerdbook.updatedAt || now,
        contentId: nerdbook.id, // Reference to original nerdbook
    };
}

/**
 * Creates a WorkspaceFile from a Board
 * @param board - The board to migrate
 * @returns A WorkspaceFile representing the board
 */
export function createFileFromBoard(board: BoardForMigration): WorkspaceFile {
    const now = new Date().toISOString();
    return {
        id: generateId(),
        name: sanitizeFileName(board.name),
        type: 'board' as FileType,
        parentId: null, // Root level
        createdAt: now, // Boards don't have createdAt
        updatedAt: board.lastAccessed ? new Date(board.lastAccessed).toISOString() : now,
        contentId: board.id, // Reference to original board
    };
}

/**
 * Creates a WorkspaceFile from a QuickNote
 * @param note - The quick note to migrate
 * @returns A WorkspaceFile representing the quick note
 */
export function createFileFromQuickNote(note: QuickNote): WorkspaceFile {
    const now = new Date().toISOString();
    // Use first line of content as name, or 'untitled' if empty
    const firstLine = note.content.split('\n')[0].trim();
    const name = firstLine.substring(0, 50) || 'untitled-note';

    return {
        id: generateId(),
        name: sanitizeFileName(name),
        type: 'note' as FileType,
        parentId: null, // Root level
        createdAt: note.createdAt || now,
        updatedAt: note.updatedAt || note.createdAt || now,
        contentId: note.id, // Reference to original quick note
    };
}

/**
 * Migrates an array of NerdNotebooks to WorkspaceFiles
 * @param nerdbooks - Array of nerdbooks to migrate
 * @returns Array of WorkspaceFiles
 */
export function migrateNerdbooks(nerdbooks: NerdNotebook[]): WorkspaceFile[] {
    if (!nerdbooks || !Array.isArray(nerdbooks)) {
        return [];
    }
    return nerdbooks.map(createFileFromNerdbook);
}

/**
 * Migrates an array of Boards to WorkspaceFiles
 * @param boards - Array of boards to migrate
 * @returns Array of WorkspaceFiles
 */
export function migrateBoards(boards: BoardForMigration[]): WorkspaceFile[] {
    if (!boards || !Array.isArray(boards)) {
        return [];
    }
    return boards.map(createFileFromBoard);
}

/**
 * Migrates an array of QuickNotes to WorkspaceFiles
 * @param notes - Array of quick notes to migrate
 * @returns Array of WorkspaceFiles
 */
export function migrateQuickNotes(notes: QuickNote[]): WorkspaceFile[] {
    if (!notes || !Array.isArray(notes)) {
        return [];
    }
    return notes.map(createFileFromQuickNote);
}

/**
 * Checks if migration has already been completed
 * @param workspaceData - Current workspace data
 * @returns true if migration is complete
 */
export function isMigrationComplete(workspaceData: WorkspaceData): boolean {
    return workspaceData.migrationComplete === true;
}

/**
 * Checks if a content ID already exists in the workspace files
 * Used to prevent duplicate migrations
 * @param contentId - The content ID to check
 * @param files - Existing workspace files
 * @returns true if the content ID already exists
 */
export function contentIdExists(contentId: string, files: WorkspaceFile[]): boolean {
    return files.some(file => file.contentId === contentId);
}

/**
 * Orchestrates the full migration of existing data to workspace format
 * - Only runs if migration is not already complete
 * - Skips items that have already been migrated (by contentId)
 * - Sets migrationComplete flag when done
 * 
 * @param existingData - The existing nerdbooks, boards, and quick notes
 * @param workspaceData - The current workspace data
 * @returns Updated workspace data with migrated files
 */
export function runMigration(
    existingData: ExistingData,
    workspaceData: WorkspaceData
): WorkspaceData {
    // Check if migration is already complete
    if (isMigrationComplete(workspaceData)) {
        return workspaceData;
    }

    const existingFiles = [...workspaceData.files];
    const newFiles: WorkspaceFile[] = [];

    // Migrate nerdbooks (skip if already migrated)
    if (existingData.nerdbooks && existingData.nerdbooks.length > 0) {
        for (const nerdbook of existingData.nerdbooks) {
            if (!contentIdExists(nerdbook.id, existingFiles)) {
                newFiles.push(createFileFromNerdbook(nerdbook));
            }
        }
    }

    // Migrate boards (skip if already migrated)
    if (existingData.boards && existingData.boards.length > 0) {
        for (const board of existingData.boards) {
            if (!contentIdExists(board.id, existingFiles)) {
                newFiles.push(createFileFromBoard(board));
            }
        }
    }

    // Migrate quick notes (skip if already migrated)
    if (existingData.quickNotes && existingData.quickNotes.length > 0) {
        for (const note of existingData.quickNotes) {
            if (!contentIdExists(note.id, existingFiles)) {
                newFiles.push(createFileFromQuickNote(note));
            }
        }
    }

    // Return updated workspace data with migration complete flag
    return {
        ...workspaceData,
        files: [...existingFiles, ...newFiles],
        migrationComplete: true,
    };
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
    success: boolean;
    workspaceData: WorkspaceData;
    migratedCounts: {
        nerdbooks: number;
        boards: number;
        quickNotes: number;
    };
    error?: string;
}

/**
 * Runs migration with detailed result reporting
 * @param existingData - The existing data to migrate
 * @param workspaceData - The current workspace data
 * @returns Detailed migration result
 */
export function runMigrationWithResult(
    existingData: ExistingData,
    workspaceData: WorkspaceData
): MigrationResult {
    try {
        // Check if migration is already complete
        if (isMigrationComplete(workspaceData)) {
            return {
                success: true,
                workspaceData,
                migratedCounts: { nerdbooks: 0, boards: 0, quickNotes: 0 },
            };
        }

        const existingFiles = [...workspaceData.files];
        const newNerdbookFiles: WorkspaceFile[] = [];
        const newBoardFiles: WorkspaceFile[] = [];
        const newNoteFiles: WorkspaceFile[] = [];

        // Migrate nerdbooks
        if (existingData.nerdbooks) {
            for (const nerdbook of existingData.nerdbooks) {
                if (!contentIdExists(nerdbook.id, existingFiles)) {
                    newNerdbookFiles.push(createFileFromNerdbook(nerdbook));
                }
            }
        }

        // Migrate boards
        if (existingData.boards) {
            for (const board of existingData.boards) {
                if (!contentIdExists(board.id, existingFiles)) {
                    newBoardFiles.push(createFileFromBoard(board));
                }
            }
        }

        // Migrate quick notes
        if (existingData.quickNotes) {
            for (const note of existingData.quickNotes) {
                if (!contentIdExists(note.id, existingFiles)) {
                    newNoteFiles.push(createFileFromQuickNote(note));
                }
            }
        }

        const updatedWorkspaceData: WorkspaceData = {
            ...workspaceData,
            files: [...existingFiles, ...newNerdbookFiles, ...newBoardFiles, ...newNoteFiles],
            migrationComplete: true,
        };

        return {
            success: true,
            workspaceData: updatedWorkspaceData,
            migratedCounts: {
                nerdbooks: newNerdbookFiles.length,
                boards: newBoardFiles.length,
                quickNotes: newNoteFiles.length,
            },
        };
    } catch (error) {
        return {
            success: false,
            workspaceData,
            migratedCounts: { nerdbooks: 0, boards: 0, quickNotes: 0 },
            error: error instanceof Error ? error.message : 'Unknown migration error',
        };
    }
}
