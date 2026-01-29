/**
 * Application version utility
 * Single source of truth for version display across the app
 */

// This should match the version in package.json
// It's used as a fallback when IPC calls fail (e.g., in browser dev mode)
export const APP_VERSION = '6.0.6';

/**
 * Fetches the current app version from the main process
 * Falls back to APP_VERSION constant if IPC fails
 */
export async function getAppVersion(): Promise<string> {
    try {
        // @ts-ignore - window.ipcRenderer is defined by Electron preload
        if (window.ipcRenderer) {
            const version = await window.ipcRenderer.invoke('get-current-version');
            return version || APP_VERSION;
        }
        return APP_VERSION;
    } catch (err) {
        console.error('Failed to get version:', err);
        return APP_VERSION;
    }
}
