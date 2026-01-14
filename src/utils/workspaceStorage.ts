import { WorkspaceData } from '../types/workspace';

// Maximum number of recent files to keep
const MAX_RECENT_FILES = 10;

// Debounce delay for auto-save (in milliseconds)
const AUTO_SAVE_DELAY = 1000;

/**
 * Default empty workspace data structure
 */
export function getDefaultWorkspaceData(): WorkspaceData {
    return {
        files: [],
        folders: [],
        recentFiles: [],
        expandedFolders: [],
        migrationComplete: false,
    };
}

/**
 * Saves workspace data to persistent storage via IPC
 * @param data - The workspace data to save
 * @returns Promise resolving to success status
 */
export async function saveWorkspace(data: WorkspaceData): Promise<{ success: boolean; error?: string }> {
    try {
        // @ts-ignore - ipcRenderer is exposed via preload
        const result = await window.ipcRenderer.invoke('save-workspace', data);
        return result || { success: true };
    } catch (error) {
        console.error('Failed to save workspace:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error saving workspace'
        };
    }
}

/**
 * Loads workspace data from persistent storage via IPC
 * @returns Promise resolving to workspace data or default empty workspace
 */
export async function loadWorkspace(): Promise<WorkspaceData> {
    try {
        // @ts-ignore - ipcRenderer is exposed via preload
        const data = await window.ipcRenderer.invoke('get-workspace');

        if (data && typeof data === 'object') {
            // Ensure all required fields exist with defaults
            return {
                files: Array.isArray(data.files) ? data.files : [],
                folders: Array.isArray(data.folders) ? data.folders : [],
                recentFiles: Array.isArray(data.recentFiles) ? data.recentFiles : [],
                expandedFolders: Array.isArray(data.expandedFolders) ? data.expandedFolders : [],
                migrationComplete: Boolean(data.migrationComplete),
            };
        }

        return getDefaultWorkspaceData();
    } catch (error) {
        console.error('Failed to load workspace:', error);
        return getDefaultWorkspaceData();
    }
}

/**
 * Adds a file ID to the recent files list, maintaining the cap and order
 * - Moves the file to the front if it already exists
 * - Removes the oldest entry if the cap is exceeded
 * 
 * @param fileId - The file ID to add to recent files
 * @param recentFiles - The current list of recent file IDs
 * @returns New array of recent file IDs with the file added/moved to front
 */
export function addToRecentFiles(fileId: string, recentFiles: string[]): string[] {
    // Remove the file if it already exists (to move it to front)
    const filtered = recentFiles.filter(id => id !== fileId);

    // Add to front
    const updated = [fileId, ...filtered];

    // Cap at maximum
    return updated.slice(0, MAX_RECENT_FILES);
}

// Store for debounce timers
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

/**
 * Creates a debounced auto-save function for workspace data
 * Multiple calls within the delay period will only trigger one save
 * 
 * @param key - Unique key for this debounce instance (allows multiple independent debounces)
 * @param delay - Delay in milliseconds (defaults to AUTO_SAVE_DELAY)
 * @returns A function that accepts workspace data and returns a promise
 */
export function createDebouncedSave(
    key: string = 'default',
    delay: number = AUTO_SAVE_DELAY
): (data: WorkspaceData) => Promise<{ success: boolean; error?: string }> {
    return (data: WorkspaceData): Promise<{ success: boolean; error?: string }> => {
        return new Promise((resolve) => {
            // Clear existing timer for this key
            const existingTimer = debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // Set new timer
            const timer = setTimeout(async () => {
                debounceTimers.delete(key);
                const result = await saveWorkspace(data);
                resolve(result);
            }, delay);

            debounceTimers.set(key, timer);
        });
    };
}

/**
 * Cancels any pending debounced save for the given key
 * @param key - The debounce key to cancel
 */
export function cancelDebouncedSave(key: string = 'default'): void {
    const timer = debounceTimers.get(key);
    if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(key);
    }
}

/**
 * Immediately saves workspace data, bypassing any debounce
 * Also cancels any pending debounced saves
 * 
 * @param data - The workspace data to save
 * @param key - The debounce key to cancel (optional)
 * @returns Promise resolving to success status
 */
export async function saveWorkspaceImmediate(
    data: WorkspaceData,
    key: string = 'default'
): Promise<{ success: boolean; error?: string }> {
    cancelDebouncedSave(key);
    return saveWorkspace(data);
}

// Export constants for testing
export { MAX_RECENT_FILES, AUTO_SAVE_DELAY };
