import { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage, safeStorage, globalShortcut } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import dotenv from 'dotenv'
import chokidar, { FSWatcher } from 'chokidar'

// Windows Store auto-launch support (for APPX builds)
let WindowsStoreAutoLaunch: any = null;
const isWindowsStore = process.windowsStore || false;
if (isWindowsStore) {
    try {
        // Dynamic import for Windows Store builds only
        WindowsStoreAutoLaunch = require('electron-winstore-auto-launch').WindowsStoreAutoLaunch;
    } catch (e) {
        console.log('Windows Store auto-launch module not available');
    }
}

// AI Provider types
type AIProvider = 'gemini' | 'openai' | 'perplexity' | 'openrouter';

// Multi-provider configuration
interface ProviderConfig {
    provider: AIProvider;
    apiKey: string;
    enabled: boolean;
    priority: number; // Lower = higher priority
}

interface FallbackEvent {
    timestamp: string;
    fromProvider: AIProvider;
    toProvider: AIProvider;
    reason: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env file
const envPath = app.isPackaged
    ? path.join(app.getAppPath(), '.env')
    : path.join(__dirname, '../.env');

dotenv.config({ path: envPath });

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null

// ============================================================================
// DEV MODE DATA ISOLATION
// ============================================================================
// In development mode, use a separate folder to protect production data from
// accidental overwrites during hot-reloads. Production data is auto-copied
// to the dev folder on startup if it doesn't exist.
// ============================================================================
const IS_DEV_MODE = !app.isPackaged;
const DEV_FOLDER_NAME = 'ThoughtsPlus-Dev'; // Separate dev folder to avoid modifying production data
const PROD_FOLDER_NAME = 'ThoughtsPlus';

// Try to detect OneDrive path, fallback to Documents
const oneDrivePath = process.env.OneDrive || path.join(app.getPath('home'), 'OneDrive');

// CUSTOM DEV FOLDER PATH - Override for specific machine
// Set to null to use default OneDrive location
const CUSTOM_DEV_FOLDER_PATH = IS_DEV_MODE ? 'C:\\Users\\umfhe\\Desktop\\ThoughtsPlusDevFolder' : null;

// Use dev folder in dev mode, production folder in production
const DATA_FOLDER_NAME = IS_DEV_MODE ? DEV_FOLDER_NAME : PROD_FOLDER_NAME;
const ONEDRIVE_DATA_PATH = CUSTOM_DEV_FOLDER_PATH
    ? path.join(CUSTOM_DEV_FOLDER_PATH, 'calendar-data.json')
    : path.join(oneDrivePath, DATA_FOLDER_NAME, 'calendar-data.json');
const DEFAULT_DATA_PATH = ONEDRIVE_DATA_PATH;
let currentDataPath = DEFAULT_DATA_PATH;

// Production data path (for copying to dev)
const PROD_DATA_FOLDER = path.join(oneDrivePath, PROD_FOLDER_NAME);
// Note: PROD_DATA_PATH is available for future migration features if needed
void PROD_DATA_FOLDER; // Suppress unused warning - kept for reference

// Device-specific settings (stored locally, not synced)
// NOTE: This persists in AppData\Roaming\thoughts-plus\device-settings.json and survives app uninstall
// To fully reset for testing: Delete %AppData%\Roaming\thoughts-plus folder
const DEVICE_SETTINGS_PATH = path.join(app.getPath('userData'), 'device-settings.json');
let deviceSettings: any = {};

// Global settings (synced across devices)
let globalSettingsPath = '';

// ============================================================================
// FILE LOCK - Prevents race conditions and JSON corruption
// ============================================================================
// Uses a mutex pattern to ensure only one read or write operation happens
// at a time. Writes use atomic file operations (write to temp, then rename).
// ============================================================================
class FileLock {
    private locked = false;
    private waitQueue: Array<() => void> = [];

    async acquire(): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return;
        }

        return new Promise((resolve) => {
            this.waitQueue.push(resolve);
        });
    }

    release(): void {
        if (this.waitQueue.length > 0) {
            const next = this.waitQueue.shift();
            if (next) next();
        } else {
            this.locked = false;
        }
    }

    async withLock<T>(operation: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await operation();
        } finally {
            this.release();
        }
    }
}

const dataFileLock = new FileLock();

// Atomic write: write to temp file, then rename (prevents partial writes)
// Uses copyFile + unlink pattern for Windows compatibility (rename fails if target exists)
async function atomicWriteFile(filePath: string, data: string, skipJsonValidation = false): Promise<void> {
    const tempPath = filePath + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2);
    try {
        // Write to temp file first
        await fs.writeFile(tempPath, data, 'utf-8');

        // Verify the temp file was written correctly by reading it back
        const verification = await fs.readFile(tempPath, 'utf-8');

        // Only validate JSON if not skipped (for plain text files like .nt)
        if (!skipJsonValidation) {
            try {
                JSON.parse(verification); // Validate JSON before replacing
            } catch (parseError) {
                throw new Error('JSON validation failed before atomic write: ' + (parseError as Error).message);
            }
        }

        // On Windows, use copyFile then unlink temp (more reliable than rename)
        // This avoids the gap between unlink and rename where reads could fail
        if (process.platform === 'win32') {
            await fs.copyFile(tempPath, filePath);
            await fs.unlink(tempPath);
        } else {
            // On Unix, rename is atomic
            await fs.rename(tempPath, filePath);
        }
    } catch (error) {
        // Clean up temp file if it exists
        try {
            if (existsSync(tempPath)) {
                await fs.unlink(tempPath);
            }
        } catch { /* ignore cleanup errors */ }
        throw error;
    }
}


// Copy production data to dev folder - DISABLED
// Now just creates the dev folder if it doesn't exist
// User should manually copy their data once if needed
async function copyProductionToDevFolder(): Promise<void> {
    if (!IS_DEV_MODE) return;

    const devDataFolder = CUSTOM_DEV_FOLDER_PATH || path.join(oneDrivePath, DEV_FOLDER_NAME);

    console.log('================================================================');
    console.log('🔧 DEV MODE: Data Isolation Active');
    console.log('================================================================');
    console.log(`Dev folder: ${devDataFolder}`);
    if (CUSTOM_DEV_FOLDER_PATH) {
        console.log('⚙️  Using CUSTOM dev folder path');
    }

    try {
        // Create dev folder if it doesn't exist
        if (!existsSync(devDataFolder)) {
            await fs.mkdir(devDataFolder, { recursive: true });
            console.log('Created dev data folder');
            console.log('📝 Note: Copy your production data manually to this folder if needed');
        } else {
            console.log('Dev folder exists, using existing data');
        }
    } catch (err) {
        console.error('Failed to create dev folder:', err);
    }

    console.log('================================================================');
}

async function loadSettings() {
    // Load device-specific settings (local)
    try {
        if (existsSync(DEVICE_SETTINGS_PATH)) {
            deviceSettings = JSON.parse(await fs.readFile(DEVICE_SETTINGS_PATH, 'utf-8'));
            // Migrate plain text keys to encrypted format
            await migrateToEncrypted();
        } else {
            // First run: load preload config if available
            await loadPreloadConfig();
        }
    } catch (e) {
        console.error('Failed to load device settings', e);
    }

    // Load global settings (from OneDrive folder OR Documents folder)
    try {
        const log = (msg: string) => {
            console.log(msg);
            if (win?.webContents) {
                const escaped = JSON.stringify(msg);
                win.webContents.executeJavaScript(`console.log(${escaped})`).catch(() => { });
            }
        };

        // Migration: Check if we need to migrate from "A - CalendarPlus" to "ThoughtsPlus"
        try {
            const thoughtsPlusPath = path.join(oneDrivePath, 'ThoughtsPlus');
            const calendarPlusPath = path.join(oneDrivePath, 'A - CalendarPlus');

            // Log paths for debugging
            console.log(`Checking for migration...`);
            console.log(`  ThoughtsPlus Path: ${thoughtsPlusPath} (Exists: ${existsSync(thoughtsPlusPath)})`);
            console.log(`  CalendarPlus Path: ${calendarPlusPath} (Exists: ${existsSync(calendarPlusPath)})`);

            // Only migrate if ThoughtsPlus doesn't exist AND CalendarPlus does
            if (!existsSync(thoughtsPlusPath) && existsSync(calendarPlusPath)) {
                console.log('Detected legacy "A - CalendarPlus" folder. Migrating to "ThoughtsPlus"...');
                await fs.mkdir(thoughtsPlusPath, { recursive: true });

                const files = await fs.readdir(calendarPlusPath);
                for (const file of files) {
                    const src = path.join(calendarPlusPath, file);
                    const dest = path.join(thoughtsPlusPath, file);
                    // Only copy files (json data), skip directories to be safe
                    const stat = await fs.stat(src);
                    if (stat.isFile()) {
                        await fs.copyFile(src, dest);
                        console.log(`  Copied legacy file: ${file}`);
                    }
                }
                console.log('Migration to ThoughtsPlus complete.');
            }
        } catch (migrationErr) {
            console.error('Migration failed:', migrationErr);
            // Continue execution, don't block app startup
        }

        let targetDir = '';
        let foundExistingData = false;

        // If custom dev folder path is set, use it directly
        if (CUSTOM_DEV_FOLDER_PATH) {
            targetDir = CUSTOM_DEV_FOLDER_PATH;
            foundExistingData = existsSync(path.join(targetDir, 'calendar-data.json'));
            log('🔧 DEV MODE: Using CUSTOM dev folder path');
            log(`  Custom path: ${targetDir}`);
            log(`  Data file exists: ${foundExistingData}`);
        } else {
            // Potential folder names to search for (prioritize ones with actual data)
            let folderNames = ['ThoughtsPlus', 'A - CalendarPlus', 'A - Calendar Pro', 'CalendarPlus'];

            // DEV MODE SAFETY: Only look for the Dev folder
            if (IS_DEV_MODE) {
                log('🔧 DEV MODE: Forcing use of Dev folder');
                folderNames = [DEV_FOLDER_NAME];
            }

            log('Searching for existing data folders...');

            // 1. Search in OneDrive for folders WITH calendar-data.json
            for (const folderName of folderNames) {
                const checkPath = path.join(oneDrivePath, folderName);
                const dataFile = path.join(checkPath, 'calendar-data.json');
                log(`  Checking: ${checkPath}`);
                log(`  Data file exists: ${existsSync(dataFile)}`);
                if (existsSync(dataFile)) {
                    targetDir = checkPath;
                    foundExistingData = true;
                    log(`Found existing data file in OneDrive: ${targetDir}`);
                    break;
                }
            }

            // 2. Search in Documents for folders WITH calendar-data.json (if not found in OneDrive)
            // Skip in Dev mode to force creation of new dev folder if needed
            if (!foundExistingData && !IS_DEV_MODE) {
                const documentsPath = app.getPath('documents');
                for (const folderName of folderNames) {
                    const checkPath = path.join(documentsPath, folderName);
                    const dataFile = path.join(checkPath, 'calendar-data.json');
                    log(`  Checking: ${checkPath}`);
                    log(`  Data file exists: ${existsSync(dataFile)}`);
                    if (existsSync(dataFile)) {
                        targetDir = checkPath;
                        foundExistingData = true;
                        log(`Found existing data file in Documents: ${targetDir}`);
                        break;
                    }
                }
            }

            // 3. If no data found, check for folders with settings.json
            if (!foundExistingData) {
                for (const folderName of folderNames) {
                    const checkPath = path.join(oneDrivePath, folderName);
                    if (existsSync(path.join(checkPath, 'settings.json'))) {
                        targetDir = checkPath;
                        foundExistingData = true;
                        log(`Found settings.json in OneDrive: ${targetDir}`);
                        break;
                    }
                }
            }

            // 4. Default to OneDrive/ThoughtsPlus (or Dev) if nothing found
            if (!targetDir) {
                targetDir = path.join(oneDrivePath, IS_DEV_MODE ? DEV_FOLDER_NAME : 'ThoughtsPlus');
                log(`Using default path: ${targetDir}`);
            }
        }

        if (!existsSync(targetDir)) {
            await fs.mkdir(targetDir, { recursive: true });
        }

        globalSettingsPath = path.join(targetDir, 'settings.json');

        if (existsSync(globalSettingsPath)) {
            const settings = JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
            // In Dev Mode, IGNORE the saved dataPath to prevent pointing back to production
            if (settings.dataPath && !IS_DEV_MODE) {
                currentDataPath = settings.dataPath;
            } else {
                currentDataPath = path.join(targetDir, 'calendar-data.json');
            }
        } else {
            currentDataPath = path.join(targetDir, 'calendar-data.json');
        }

        log(`Final data path: ${currentDataPath}`);

        console.log('----------------------------------------------------------------');
        console.log('DATA STORAGE PATHS');
        console.log('----------------------------------------------------------------');
        console.log('Main Data Path:', currentDataPath);
        console.log('Device Settings:', DEVICE_SETTINGS_PATH);
        console.log('Global Settings:', globalSettingsPath);
        console.log('Data Path Exists:', existsSync(currentDataPath));
        console.log('----------------------------------------------------------------');

    } catch (e) {
        console.error('Failed to load global settings', e);
        currentDataPath = ONEDRIVE_DATA_PATH;
    }
}

async function loadPreloadConfig() {
    try {
        // Check for preload-config.json in app resources
        const preloadPath = app.isPackaged
            ? path.join(process.resourcesPath, 'preload-config.json')
            : path.join(__dirname, '../preload-config.json');

        if (existsSync(preloadPath)) {
            const preloadData = JSON.parse(await fs.readFile(preloadPath, 'utf-8'));
            const config = preloadData.personalConfig;

            // Load into device settings
            if (config.apiKey) deviceSettings.apiKey = config.apiKey;
            if (config.githubUsername) deviceSettings.githubUsername = config.githubUsername;
            if (config.githubToken) deviceSettings.githubToken = config.githubToken;
            if (config.creatorCodes) deviceSettings.creatorCodes = config.creatorCodes;

            await saveDeviceSettings();
            console.log('Preload configuration applied successfully');
        }
    } catch (e) {
        console.error('Failed to load preload config', e);
    }
}

// Encryption helpers using Electron's safeStorage (OS-level encryption)
function encryptString(plainText: string): string {
    if (!plainText) return '';
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const buffer = safeStorage.encryptString(plainText);
            return buffer.toString('base64');
        } else {
            console.warn('Encryption not available, storing in plain text');
            return plainText;
        }
    } catch (e) {
        console.error('Encryption failed:', e);
        return plainText;
    }
}

function decryptString(encryptedText: string): string {
    if (!encryptedText) return '';
    try {
        // Check if it's already encrypted (base64 format)
        if (safeStorage.isEncryptionAvailable() && encryptedText.length > 0) {
            try {
                const buffer = Buffer.from(encryptedText, 'base64');
                return safeStorage.decryptString(buffer);
            } catch {
                // If decryption fails, it might be plain text (migration case)
                console.log('Decryption failed, treating as plain text (migration)');
                return encryptedText;
            }
        }
        return encryptedText;
    } catch (e) {
        console.error('Decryption error:', e);
        return encryptedText;
    }
}

// Migrate plain text API keys to encrypted format
async function migrateToEncrypted() {
    let needsSave = false;

    // Migrate main API key
    if (deviceSettings.apiKey && !deviceSettings._apiKeyEncrypted) {
        console.log('Migrating main API key to encrypted storage...');
        deviceSettings.apiKey = encryptString(deviceSettings.apiKey);
        deviceSettings._apiKeyEncrypted = true;
        needsSave = true;
    }

    // Migrate provider API keys
    if (deviceSettings.providerApiKeys && !deviceSettings._providerKeysEncrypted) {
        console.log('Migrating provider API keys to encrypted storage...');
        const providers = Object.keys(deviceSettings.providerApiKeys);
        for (const provider of providers) {
            if (deviceSettings.providerApiKeys[provider]) {
                deviceSettings.providerApiKeys[provider] = encryptString(deviceSettings.providerApiKeys[provider]);
            }
        }
        deviceSettings._providerKeysEncrypted = true;
        needsSave = true;
    }

    // Migrate GitHub token
    if (deviceSettings.githubToken && !deviceSettings._githubTokenEncrypted) {
        console.log('Migrating GitHub token to encrypted storage...');
        deviceSettings.githubToken = encryptString(deviceSettings.githubToken);
        deviceSettings._githubTokenEncrypted = true;
        needsSave = true;
    }

    // Migrate provider configs
    if (deviceSettings.providerConfigs && !deviceSettings._providerConfigsEncrypted) {
        console.log('Migrating provider configs API keys to encrypted storage...');
        deviceSettings.providerConfigs = deviceSettings.providerConfigs.map((config: ProviderConfig) => ({
            ...config,
            apiKey: encryptString(config.apiKey)
        }));
        deviceSettings._providerConfigsEncrypted = true;
        needsSave = true;
    }

    if (needsSave) {
        await saveDeviceSettings();
        console.log('API keys migration to encrypted storage complete');
    }
}

async function saveDeviceSettings() {
    try {
        await fs.writeFile(DEVICE_SETTINGS_PATH, JSON.stringify(deviceSettings, null, 2));
    } catch (e) {
        console.error('Failed to save device settings', e);
    }
}

// async function loadGlobalSettings() {
//     try {
//         if (existsSync(globalSettingsPath)) {
//             return JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
//         }
//         return {};
//     } catch (e) {
//         console.error('Failed to load global settings', e);
//         return {};
//     }
// }

async function saveGlobalSettings(settings: any) {
    try {
        const settingsDir = path.dirname(globalSettingsPath);
        if (!existsSync(settingsDir)) {
            await fs.mkdir(settingsDir, { recursive: true });
        }
        await fs.writeFile(globalSettingsPath, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('Failed to save global settings', e);
    }
}

async function tryMigrateLegacyData() {
    try {
        console.log('Checking for legacy V4.5 data...');
        // Construct legacy path: OneDrive/A - Calendar Pro/notes.json
        const legacyPath = path.join(oneDrivePath, 'A - Calendar Pro', 'notes.json');

        if (existsSync(legacyPath)) {
            console.log('Found legacy data at:', legacyPath);
            const legacyData = JSON.parse(await fs.readFile(legacyPath, 'utf-8'));
            const newNotes: any = {};

            const monthMap: { [key: string]: string } = {
                "January": "01", "February": "02", "March": "03", "April": "04", "May": "05", "June": "06",
                "July": "07", "August": "08", "September": "09", "October": "10", "November": "11", "December": "12"
            };

            // Iterate Year -> Month -> Day
            for (const year in legacyData) {
                for (const monthName in legacyData[year]) {
                    const month = monthMap[monthName];
                    if (!month) continue;

                    for (const day in legacyData[year][monthName]) {
                        const notesList = legacyData[year][monthName][day];
                        if (!Array.isArray(notesList)) continue;

                        const paddedDay = day.padStart(2, '0');
                        const dateKey = `${year}-${month}-${paddedDay}`;

                        newNotes[dateKey] = notesList.map((noteText: string) => ({
                            id: randomUUID(),
                            title: noteText,
                            description: '',
                            time: '09:00',
                            importance: 'medium',
                            completed: false
                        }));
                    }
                }
            }

            // Save to currentDataPath
            const newData = { notes: newNotes };
            await fs.writeFile(currentDataPath, JSON.stringify(newData, null, 2));
            console.log('Migration successful. Saved to:', currentDataPath);

            // Also try to migrate config/settings if available
            try {
                // Check if there is a settings file in the legacy folder
                const legacySettingsPath = path.join(oneDrivePath, 'A - Calendar Pro', 'settings.json'); // Check hypothetical location
                // Or potentially in the root of A - Calendar Plus if that's where it was
                const legacyRootSettings = path.join(oneDrivePath, 'A - CalendarPlus', 'settings.json');

                let legacySettings: any = {};

                if (existsSync(legacySettingsPath)) {
                    legacySettings = JSON.parse(await fs.readFile(legacySettingsPath, 'utf-8'));
                } else if (existsSync(legacyRootSettings)) {
                    legacySettings = JSON.parse(await fs.readFile(legacyRootSettings, 'utf-8'));
                }

                // If we found any settings, merge them into our new structure
                if (legacySettings) {
                    // Update device settings (local)
                    if (legacySettings.apiKey) deviceSettings.apiKey = legacySettings.apiKey;
                    if (legacySettings.userName || legacySettings.customUserName) deviceSettings.customUserName = legacySettings.userName || legacySettings.customUserName;
                    if (legacySettings.theme) deviceSettings.theme = legacySettings.theme; // map if needed
                    if (legacySettings.accentColor) deviceSettings.accentColor = legacySettings.accentColor;

                    await saveDeviceSettings();
                    console.log('Migrated legacy settings (API Key, User Name, etc)');
                }
            } catch (err) {
                console.warn('Could not migrate legacy settings:', err);
            }

            return true;
        }
    } catch (e) {
        console.error('Migration failed:', e);
    }
    return false;
}

function createWindow() {
    // Use the icon from the app resources
    // Windows uses .ico for proper taskbar transparency, other platforms use .png
    let iconPath: string;
    if (process.platform === 'win32') {
        iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'ThoughtsPlus.ico')
            : path.join(process.env.VITE_PUBLIC || '', 'ThoughtsPlus.ico');
    } else {
        iconPath = path.join(process.env.VITE_PUBLIC || '', 'Thoughts+.png');
    }

    win = new BrowserWindow({
        width: 1200, height: 900, frame: false, titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#00000000', symbolColor: '#4b5563', height: 30 },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Allow loading local files
        },
        backgroundColor: '#00000000',
        icon: iconPath
    })
    console.log('Creating window...');
    Menu.setApplicationMenu(null);
    win.webContents.on('did-finish-load', () => win?.webContents.send('main-process-message', (new Date).toLocaleString()))
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
        win.webContents.openDevTools()
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'index.html'))
    }

    // Enable DevTools shortcuts in production
    win.webContents.on('before-input-event', (_event, input) => {
        if (input.type === 'keyDown') {
            // F12 or Ctrl+Shift+I to toggle DevTools
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                if (win?.webContents.isDevToolsOpened()) {
                    win.webContents.closeDevTools();
                } else {
                    win?.webContents.openDevTools();
                }
            }
        }
    });

    // Enable context menu for spell-checking and text editing
    win.webContents.on('context-menu', (_event, params) => {
        const { selectionText, isEditable, misspelledWord, dictionarySuggestions } = params;

        if (isEditable) {
            const menuTemplate: any[] = [];

            // Spell-check suggestions
            if (misspelledWord) {
                if (dictionarySuggestions.length > 0) {
                    dictionarySuggestions.forEach((suggestion: string) => {
                        menuTemplate.push({
                            label: suggestion,
                            click: () => win?.webContents.replaceMisspelling(suggestion)
                        });
                    });
                    menuTemplate.push({ type: 'separator' });
                } else {
                    menuTemplate.push({
                        label: 'No suggestions',
                        enabled: false
                    });
                    menuTemplate.push({ type: 'separator' });
                }

                menuTemplate.push({
                    label: 'Add to dictionary',
                    click: () => win?.webContents.session.addWordToSpellCheckerDictionary(misspelledWord)
                });
                menuTemplate.push({ type: 'separator' });
            }

            // Standard editing options
            menuTemplate.push(
                { label: 'Cut', role: 'cut', enabled: selectionText.length > 0 },
                { label: 'Copy', role: 'copy', enabled: selectionText.length > 0 },
                { label: 'Paste', role: 'paste' },
                { type: 'separator' },
                { label: 'Select All', role: 'selectAll' }
            );

            const menu = Menu.buildFromTemplate(menuTemplate);
            menu.popup();
        }
    });
}

// Unregister all shortcuts when quitting
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// Set app user model ID for Windows to ensure proper taskbar icon
if (process.platform === 'win32') {
    app.setAppUserModelId('com.thoughtsplus.app');
}


// Register all IPC handlers BEFORE app is ready
function setupIpcHandlers() {
    console.log('Setting up IPC handlers...');

    // Error logging from renderer (for debugging APPX issues)
    ipcMain.handle('log-error', (_, errorData) => {
        console.error('Renderer Error:', errorData);
        return true;
    });

    // Open DevTools from renderer
    ipcMain.handle('open-dev-tools', () => {
        if (win) {
            win.webContents.openDevTools();
        }
        return true;
    });

    // Open external link in system browser
    ipcMain.handle('open-external-link', async (_, url: string) => {
        try {
            await shell.openExternal(url);
            return true;
        } catch (error) {
            console.error('Failed to open external link:', error);
            return false;
        }
    });

    // Flash window for timer alert
    ipcMain.handle('flash-window', () => {
        if (win) {
            win.flashFrame(true);
            // Stop flashing after 5 seconds
            setTimeout(() => {
                if (win) win.flashFrame(false);
            }, 5000);
        }
        return true;
    });

    // Set taskbar overlay icon (notification badge) - Windows only
    ipcMain.handle('set-taskbar-badge', () => {
        if (win && process.platform === 'win32') {
            try {
                // Load the badge icon from public folder
                const badgePath = app.isPackaged
                    ? path.join(process.resourcesPath, 'timer-badge.png')
                    : path.join(process.env.VITE_PUBLIC || '', 'timer-badge.png');

                if (existsSync(badgePath)) {
                    const badgeIcon = nativeImage.createFromPath(badgePath).resize({ width: 8, height: 8 });
                    win.setOverlayIcon(badgeIcon, 'Timer Alert');
                    console.log('Taskbar badge set from:', badgePath);
                } else {
                    console.warn('Badge icon not found at:', badgePath);
                }
            } catch (e) {
                console.error('Failed to set taskbar badge:', e);
            }
        }
        return true;
    });

    // Clear taskbar overlay icon
    ipcMain.handle('clear-taskbar-badge', () => {
        if (win && process.platform === 'win32') {
            try {
                win.setOverlayIcon(null, '');
            } catch (e) {
                console.error('Failed to clear taskbar badge:', e);
            }
        }
        return true;
    });

    // Setup Wizard IPC Handlers
    ipcMain.handle('get-setup-complete', () => {
        return deviceSettings.setupComplete || false;
    });

    ipcMain.handle('set-setup-complete', async (_, complete) => {
        deviceSettings.setupComplete = complete;
        await saveDeviceSettings();
        return true;
    });

    ipcMain.handle('get-onedrive-path', () => {
        return ONEDRIVE_DATA_PATH;
    });

    ipcMain.handle('get-suggested-path', (_, location) => {
        if (location === 'onedrive') {
            return ONEDRIVE_DATA_PATH;
        } else if (location === 'local') {
            return path.join(app.getPath('documents'), 'ThoughtsPlus', 'calendar-data.json');
        }
        return ONEDRIVE_DATA_PATH;
    });

    ipcMain.handle('get-api-key', () => {
        const encryptedKey = deviceSettings.apiKey || '';
        return decryptString(encryptedKey);
    });

    ipcMain.handle('get-ai-provider', () => {
        return deviceSettings.aiProvider || 'gemini';
    });

    ipcMain.handle('set-ai-provider', async (_, provider: AIProvider) => {
        deviceSettings.aiProvider = provider;
        await saveDeviceSettings();
        return true;
    });

    ipcMain.handle('set-api-key', async (_, key) => {
        deviceSettings.apiKey = encryptString(key?.trim() || '');
        deviceSettings._apiKeyEncrypted = true;
        await saveDeviceSettings();
        return true;
    });

    // Store API key for a specific provider
    ipcMain.handle('set-provider-api-key', async (_, provider: AIProvider, key: string) => {
        if (!deviceSettings.providerApiKeys) {
            deviceSettings.providerApiKeys = {};
        }
        deviceSettings.providerApiKeys[provider] = encryptString(key?.trim() || '');
        deviceSettings._providerKeysEncrypted = true;
        await saveDeviceSettings();
        return true;
    });

    // Get API key for a specific provider
    ipcMain.handle('get-provider-api-key', (_, provider: AIProvider) => {
        const encryptedKey = deviceSettings.providerApiKeys?.[provider] || '';
        return decryptString(encryptedKey);
    });

    // Get all provider API keys
    ipcMain.handle('get-all-provider-api-keys', () => {
        const encryptedKeys = deviceSettings.providerApiKeys || {};
        const decryptedKeys: Record<string, string> = {};
        for (const [provider, encryptedKey] of Object.entries(encryptedKeys)) {
            decryptedKeys[provider] = decryptString(encryptedKey as string);
        }
        return decryptedKeys;
    });

    // Multi-provider configuration handlers
    ipcMain.handle('get-provider-configs', () => {
        const configs = deviceSettings.providerConfigs || [];
        // Decrypt API keys before sending to renderer
        return configs.map((config: ProviderConfig) => ({
            ...config,
            apiKey: decryptString(config.apiKey)
        }));
    });

    ipcMain.handle('set-provider-configs', async (_, configs: ProviderConfig[]) => {
        // Encrypt API keys before storing
        deviceSettings.providerConfigs = configs.map((config: ProviderConfig) => ({
            ...config,
            apiKey: encryptString(config.apiKey)
        }));
        deviceSettings._providerConfigsEncrypted = true;
        await saveDeviceSettings();
        return true;
    });

    ipcMain.handle('get-fallback-events', () => {
        // Return last 20 events
        const events = deviceSettings.fallbackEvents || [];
        return events.slice(-20);
    });

    ipcMain.handle('clear-fallback-events', async () => {
        deviceSettings.fallbackEvents = [];
        await saveDeviceSettings();
        return true;
    });

    ipcMain.handle('get-multi-provider-enabled', () => {
        return deviceSettings.multiProviderEnabled || false;
    });

    ipcMain.handle('set-multi-provider-enabled', async (_, enabled: boolean) => {
        deviceSettings.multiProviderEnabled = enabled;
        await saveDeviceSettings();
        return true;
    });

    // Global Hotkey for Quick Capture
    let currentHotkey: string | null = null;
    let wasWindowHiddenBeforeQuickCapture = false; // Track if window was hidden/minimized when hotkey triggered

    ipcMain.handle('get-quick-capture-hotkey', () => {
        return deviceSettings.quickCaptureHotkey || 'CommandOrControl+Shift+N';
    });

    ipcMain.handle('set-quick-capture-hotkey', async (_, hotkey: string) => {
        // Unregister old hotkey
        if (currentHotkey) {
            try {
                globalShortcut.unregister(currentHotkey);
            } catch (e) {
                console.warn('Failed to unregister old hotkey:', e);
            }
        }

        // Save new hotkey
        deviceSettings.quickCaptureHotkey = hotkey;
        await saveDeviceSettings();

        // Register new hotkey
        if (hotkey) {
            try {
                const registered = globalShortcut.register(hotkey, () => {
                    console.log('Quick Capture hotkey triggered!');
                    if (win) {
                        // Check if window was not focused before - includes minimized, hidden, or just not active
                        wasWindowHiddenBeforeQuickCapture = win.isMinimized() || !win.isVisible() || !win.isFocused();
                        console.log('[QuickCapture] Window was not focused before:', wasWindowHiddenBeforeQuickCapture);
                        // Bring window to front
                        if (win.isMinimized()) win.restore();
                        win.show();
                        win.focus();
                        // Send event to renderer to open quick capture (including visibility state)
                        win.webContents.send('open-quick-capture', { wasHidden: wasWindowHiddenBeforeQuickCapture });
                    }
                });

                if (!registered) {
                    console.warn('Failed to register hotkey:', hotkey);
                    return { success: false, error: 'Failed to register hotkey. It may be in use by another application.' };
                }
                currentHotkey = hotkey;
                console.log('Global hotkey registered:', hotkey);
                return { success: true };
            } catch (e: any) {
                console.error('Error registering hotkey:', e);
                return { success: false, error: e.message || 'Failed to register hotkey' };
            }
        }

        return { success: true };
    });

    ipcMain.handle('unregister-quick-capture-hotkey', () => {
        if (currentHotkey) {
            try {
                globalShortcut.unregister(currentHotkey);
                currentHotkey = null;
                console.log('Global hotkey unregistered');
            } catch (e) {
                console.warn('Failed to unregister hotkey:', e);
            }
        }
        return true;
    });

    ipcMain.handle('get-quick-capture-enabled', () => {
        return deviceSettings.quickCaptureEnabled !== false; // Default to true
    });

    ipcMain.handle('set-quick-capture-enabled', async (_, enabled: boolean) => {
        deviceSettings.quickCaptureEnabled = enabled;
        await saveDeviceSettings();

        if (enabled) {
            // Re-register the hotkey
            const hotkey = deviceSettings.quickCaptureHotkey || 'CommandOrControl+Shift+N';
            if (!currentHotkey) {
                try {
                    const registered = globalShortcut.register(hotkey, () => {
                        if (win) {
                            // Check if window was not focused before - includes minimized, hidden, or just not active
                            wasWindowHiddenBeforeQuickCapture = win.isMinimized() || !win.isVisible() || !win.isFocused();
                            if (win.isMinimized()) win.restore();
                            win.show();
                            win.focus();
                            win.webContents.send('open-quick-capture', { wasHidden: wasWindowHiddenBeforeQuickCapture });
                        }
                    });
                    if (registered) {
                        currentHotkey = hotkey;
                        console.log('Global hotkey enabled:', hotkey);
                    }
                } catch (e) {
                    console.warn('Failed to register hotkey:', e);
                }
            }
        } else {
            // Unregister the hotkey
            if (currentHotkey) {
                try {
                    globalShortcut.unregister(currentHotkey);
                    currentHotkey = null;
                    console.log('Global hotkey disabled');
                } catch (e) {
                    console.warn('Failed to unregister hotkey:', e);
                }
            }
        }

        return true;
    });

    // Initialize global hotkey on startup
    setTimeout(async () => {
        const enabled = deviceSettings.quickCaptureEnabled !== false;
        const hotkey = deviceSettings.quickCaptureHotkey || 'CommandOrControl+Shift+N';

        if (enabled && hotkey) {
            try {
                const registered = globalShortcut.register(hotkey, () => {
                    if (win) {
                        // Check if window was not focused before - includes minimized, hidden, or just not active
                        wasWindowHiddenBeforeQuickCapture = win.isMinimized() || !win.isVisible() || !win.isFocused();
                        if (win.isMinimized()) win.restore();
                        win.show();
                        win.focus();
                        win.webContents.send('open-quick-capture', { wasHidden: wasWindowHiddenBeforeQuickCapture });
                    }
                });
                if (registered) {
                    currentHotkey = hotkey;
                    console.log('[QuickCapture] Global hotkey initialized:', hotkey);
                } else {
                    console.warn('[QuickCapture] Failed to register hotkey - another app may have it registered:', hotkey);
                }
            } catch (e) {
                console.warn('[QuickCapture] Failed to initialize global hotkey:', e);
            }
        } else {
            console.log('[QuickCapture] Global hotkey disabled or not set');
        }
    }, 1000); // Small delay to ensure window is ready

    // Handler to close quick capture and optionally hide window
    ipcMain.handle('close-quick-capture', (_, shouldHide: boolean) => {
        console.log('[QuickCapture] Close requested, shouldHide:', shouldHide);
        if (shouldHide && win) {
            // Minimize the window to get it out of the way
            win.minimize();
            console.log('[QuickCapture] Window minimized');
        }
        // Reset the tracking variable
        wasWindowHiddenBeforeQuickCapture = false;
        return true;
    });

    ipcMain.handle('validate-api-key', async (_, key, provider: AIProvider = 'gemini') => {
        try {
            if (!key) return { valid: false, error: 'Please enter an API key.' };
            const cleanKey = key.trim();

            // DEV MODE: Simulate region block for Gemini (but not Perplexity)
            const devSimulateRegionBlock = await win?.webContents.executeJavaScript(
                `localStorage.getItem('dev_simulate_region_block') === 'true'`
            ).catch(() => false);

            if (devSimulateRegionBlock && provider === 'gemini') {
                console.log('DEV MODE: Simulating Gemini region restriction');
                return {
                    valid: false,
                    error: 'Google Gemini is not available in your region. Please use Perplexity instead.',
                    isRegionRestricted: true
                };
            }

            // Validate based on provider
            if (provider === 'openai' || provider === 'perplexity' || provider === 'openrouter') {
                try {
                    await generateWithOpenAI(cleanKey, "Say 'ok' in one word.", provider);
                    return { valid: true };
                } catch (e: any) {
                    console.error(`${provider} validation failed:`, e);
                    return { valid: false, error: e.message || 'Invalid API Key' };
                }
            }

            // Gemini validation
            const genAI = new GoogleGenerativeAI(cleanKey);

            try {
                await generateWithGemini(genAI, "Test");
                return { valid: true };
            } catch (e: any) {
                console.error("Validation failed:", e);
                const errorMessage = e.message || e.toString() || '';

                // Check if it's a region-specific error
                const isRegionError = errorMessage.includes('User location is not supported') ||
                    errorMessage.includes('not supported for the API use') ||
                    errorMessage.includes('location');

                if (isRegionError) {
                    return {
                        valid: false,
                        error: 'Google Gemini is not available in your region. Please use Perplexity instead.',
                        isRegionRestricted: true
                    };
                }

                return { valid: false, error: e.message || 'Invalid API Key' };
            }
        } catch (error: any) {
            console.error("API Key Validation Error:", error);
            const errorMessage = error.message || error.toString() || '';
            const isRegionError = errorMessage.includes('User location is not supported') ||
                errorMessage.includes('not supported for the API use') ||
                errorMessage.includes('location');

            if (isRegionError) {
                return {
                    valid: false,
                    error: 'Google Gemini is not available in your region. Please use Perplexity instead.',
                    isRegionRestricted: true
                };
            }

            return { valid: false, error: getFriendlyErrorMessage(error, provider) };
        }
    });

    ipcMain.handle('summarize-text', async (_, text) => {
        try {
            if (!deviceSettings.apiKey) return text.slice(0, 50) + '...';

            try {
                return await generateAIContent(text);
            } catch (e) {
                console.warn(`summarize-text failed:`, e);
                return text.slice(0, 50) + '...';
            }
        } catch (error) {
            return text.slice(0, 50) + '...';
        }
    });

    ipcMain.handle('generate-ai-overview', async (_, notes, userName) => {
        try {
            console.log('generate-ai-overview called. Has apiKey:', !!deviceSettings.apiKey);
            if (!deviceSettings.apiKey) return "Please add your AI API key in settings! Make sure not to share it with anyone.";

            // Check if notes array is empty
            if (!notes || notes.length === 0) {
                return "No tasks scheduled. Enjoy your free time!";
            }

            let notesStr = "";
            try {
                notesStr = JSON.stringify(notes);
            } catch (e) {
                return "Error: Could not process notes data.";
            }

            const nameToUse = userName ? userName.split(' ')[0] : 'User';
            const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            const prompt = `
You are a warm, friendly personal assistant for ${nameToUse}. 
Today is ${today}.

Write a short, encouraging briefing based on their notes.

Rules:
- Start with "Hey ${nameToUse}!" or "Well done, ${nameToUse}!"
- Mention any tasks completed in the last 7 days with praise
- Highlight upcoming tasks with specific dates
- Keep it casual and supportive
- Maximum 60 words
- Use simple dashes (-) not em dashes
- Use **bold** for task names only
- British English spelling
- NO em dashes (—), NO colons after greetings
- Write in flowing sentences, not bullet points

Notes:
${notesStr}
            `;

            try {
                const result = await generateAIContent(prompt);

                // Check if Perplexity refused the task
                if (result.includes("I'm unable to complete") ||
                    result.includes("I'm Perplexity") ||
                    result.includes("outside my core function") ||
                    result.includes("I appreciate your") ||
                    result.includes("search assistant")) {

                    // Retry with a more research-oriented prompt that Perplexity accepts
                    const fallbackPrompt = `Analyze these task completion patterns and provide a brief productivity summary for ${nameToUse}. Today is ${today}.

Task data: ${notesStr}

Provide a 60-word analysis highlighting:
- Recently completed tasks (last 7 days)
- Upcoming scheduled tasks
- Use **bold** for task names
- British English, casual tone
- Start with "Hey ${nameToUse}!" or "Well done, ${nameToUse}!"`;

                    return await generateAIContent(fallbackPrompt);
                }

                return result;
            } catch (error: any) {
                console.warn(`AI generation failed:`, error.message);
                return error.message || "AI is temporarily unavailable. Please try again later.";
            }
        } catch (error: any) {
            console.error("AI API Error:", error);
            return "AI is temporarily unavailable. Please try again later.";
        }
    });

    ipcMain.handle('parse-natural-language-note', async (_, input, generateDescriptions = false) => {
        try {
            if (!deviceSettings.apiKey) {
                return {
                    error: 'API_KEY_MISSING',
                    message: 'Please configure your AI API key in Settings. Perplexity works worldwide.'
                };
            }

            const now = new Date();
            const descriptionField = generateDescriptions
                ? `- descriptionOptions: Generate 3 distinct, helpful, professional, and slightly detailed description options based on the input context. Do not just copy the input. Use British English spelling (e.g. 'colour', 'centre', 'programme', 'organise').`
                : `- description: Leave empty or set to empty string.`;

            const prompt = `
            You are a smart calendar assistant.
            Current Date/Time: ${now.toISOString()} (${now.toLocaleDateString('en-GB', { weekday: 'long' })})
            
            User Input: "${input}"
            
            Extract the event details into a JSON object with these fields:
            - title: Short summary (max 5 words). Use British English.
            ${descriptionField}
            - date: YYYY-MM-DD format. NOTE: If the user says "next week" without a specific day, assume it means exactly 7 days from today.
            - time: HH:mm format (24h). Default to "09:00" if not specified.
            - importance: "low", "medium", or "high" (infer from urgency/tone)
            - recurrence: optional object if recurrence is mentioned (e.g. "every day", "weekly", "fortnightly", "monthly"). Fields:
                - type: "daily", "weekly", "fortnightly", "monthly"
                - count: number (if specified, e.g. "for 3 times") OR endDate: YYYY-MM-DD (if "until X")
            
            Return ONLY the JSON object. No markdown formatting.
            `;

            try {
                const text = await generateAIContent(prompt);
                // Clean up potential markdown code blocks
                const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(jsonStr);

                // Validate the parsed response
                if (!parsed.title || !parsed.date) {
                    throw new Error('Invalid response structure');
                }

                return parsed;
            } catch (error: any) {
                console.warn(`AI generation failed:`, error.message);
                return {
                    error: 'PARSE_ERROR',
                    message: error.message || 'AI service temporarily unavailable.'
                };
            }
        } catch (error: any) {
            console.error("AI Parse Error:", error);
            return {
                error: 'PARSE_ERROR',
                message: 'Something went wrong. Please try again.'
            };
        }
    });

    // AI Draft - Generate note content for Board page
    ipcMain.handle('generate-ai-note-content', async (_, prompt: string, noteType: 'text' | 'list') => {
        try {
            if (!deviceSettings.apiKey) {
                return {
                    error: 'API_KEY_MISSING',
                    message: 'Please configure your AI API key in Settings.'
                };
            }

            const isChecklist = noteType === 'list';

            const aiPrompt = isChecklist
                ? `You are a helpful assistant creating a checklist for a sticky note.

User request: "${prompt}"

IMPORTANT RULES:
1. ONLY generate content based on what the user asked - do NOT make up specific data, dates, events, or personal information.
2. If they ask about personal data you don't have (like "my tasks", "my schedule"), create a helpful template structure they can fill in.
3. If they ask about a topic (like "revision guide for Python" or "packing list for camping"), create a relevant structured list for that topic.
4. Return ONLY the list items, one per line, without bullet points, numbering, or checkboxes.
5. Maximum 12 items. Use British English spelling.

Output format (plain text, one item per line):
First item here
Second item here
...`
                : `You are a helpful writing assistant creating content for a sticky note.

User request: "${prompt}"

IMPORTANT RULES:
1. ONLY generate content based on what the user asked - do NOT make up specific data, dates, events, names, or personal information.
2. If they ask about personal data you don't have (like "my tasks", "summarise my notes"), politely explain you don't have access to their personal data and offer to create a helpful template instead.
3. If they ask about a topic (like "revision guide for Python", "meeting agenda"), create genuinely useful content structured around that topic.
4. For topic-based requests, organise content logically (e.g., Python revision = variables, data types, loops, functions, OOP, etc.)
5. Write clear, readable paragraphs. Maximum 250 words. British English. No markdown formatting.`;

            try {
                const content = await generateAIContent(aiPrompt);
                return { content: content.trim() };
            } catch (error: any) {
                console.warn('AI content generation failed:', error.message);
                return {
                    error: 'GENERATION_ERROR',
                    message: error.message || 'AI service temporarily unavailable.'
                };
            }
        } catch (error: any) {
            console.error("AI Draft Error:", error);
            return {
                error: 'GENERATION_ERROR',
                message: 'Something went wrong. Please try again.'
            };
        }
    });

    // AI Backbone Generator - Generate notebook structure for Nerdbook
    ipcMain.handle('generate-nerdbook-backbone', async (_, userRequest: string, existingContent: string) => {
        try {
            if (!deviceSettings.apiKey) {
                return {
                    error: 'API_KEY_MISSING',
                    message: 'Please configure your AI API key in Settings.'
                };
            }

            // Truncate existing content to save tokens (max ~500 chars for context)
            const truncatedContent = existingContent
                ? existingContent.substring(0, 500) + (existingContent.length > 500 ? '...' : '')
                : '';

            const aiPrompt = `Generate notebook cells for: "${userRequest}"
${truncatedContent ? `\nContext: ${truncatedContent}` : ''}

Rules: Scaffolding only (headings, code templates with TODO/comments). 5-7 cells max. British English. NO intro cell - start with first topic. Keep markdown brief.

Return JSON array: [{"type":"markdown"|"code","content":"..."},...]`;

            try {
                const content = await generateAIContent(aiPrompt);
                // Clean up potential markdown code blocks
                const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
                const cells = JSON.parse(jsonStr);

                // Validate the response
                if (!Array.isArray(cells) || cells.length === 0) {
                    throw new Error('Invalid response structure');
                }

                // Ensure each cell has required fields
                const validatedCells = cells.map((cell: any) => ({
                    type: cell.type || 'text',
                    content: cell.content || ''
                }));

                return { cells: validatedCells };
            } catch (error: any) {
                console.warn('AI backbone generation failed:', error.message);
                return {
                    error: 'GENERATION_ERROR',
                    message: error.message || 'AI service temporarily unavailable.'
                };
            }
        } catch (error: any) {
            console.error("AI Backbone Error:", error);
            return {
                error: 'GENERATION_ERROR',
                message: 'Something went wrong. Please try again.'
            };
        }
    });

    // AI Flashcard Generator - Generate flashcards from note content
    ipcMain.handle('generate-flashcards-from-content', async (_, { content, cardCount }) => {
        try {
            if (!deviceSettings.apiKey) {
                return {
                    success: false,
                    error: 'API_KEY_MISSING',
                    message: 'Please configure your AI API key in Settings.'
                };
            }

            // AGGRESSIVE token reduction: Strip formatting and truncate heavily
            let processedContent = content
                .replace(/```[\s\S]*?```/g, '') // Remove code blocks
                .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links to text
                .replace(/#{1,6}\s/g, '') // Remove headers
                .replace(/[*_~`]/g, '') // Remove formatting
                .replace(/\n{3,}/g, '\n\n') // Collapse newlines
                .trim();

            // Truncate to 800 chars max (60% reduction from before)
            if (processedContent.length > 800) {
                const truncated = processedContent.substring(0, 800);
                const lastPeriod = truncated.lastIndexOf('.');
                processedContent = lastPeriod > 600
                    ? truncated.substring(0, lastPeriod + 1)
                    : truncated + '...';
            }

            // ULTRA-MINIMAL prompt but explicit about JSON format
            const aiPrompt = `Create ${cardCount} flashcards from this text. Return ONLY valid JSON array, no other text:

${processedContent}

Format: [{"q":"question here","a":"answer here"}]`;

            try {
                const response = await generateAIContent(aiPrompt);

                // More aggressive JSON extraction
                let jsonStr = response.trim();

                // Remove any text before the first [
                const firstBracket = jsonStr.indexOf('[');
                if (firstBracket > 0) {
                    jsonStr = jsonStr.substring(firstBracket);
                }

                // Remove any text after the last ]
                const lastBracket = jsonStr.lastIndexOf(']');
                if (lastBracket !== -1 && lastBracket < jsonStr.length - 1) {
                    jsonStr = jsonStr.substring(0, lastBracket + 1);
                }

                // Remove markdown code blocks if present
                jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

                const cards = JSON.parse(jsonStr);

                if (!Array.isArray(cards) || cards.length === 0) {
                    throw new Error('Invalid response');
                }

                const now = new Date().toISOString();
                const flashcards = cards.slice(0, cardCount).map((card: any) => ({
                    id: randomUUID(),
                    front: card.q || card.front || card.question || '',
                    back: card.a || card.back || card.answer || '',
                    createdAt: now,
                    easeFactor: 2.5,
                    interval: 0,
                    repetitions: 0,
                    nextReviewDate: now,
                }));

                return {
                    success: true,
                    cards: flashcards
                };
            } catch (error: any) {
                console.warn('AI flashcard generation failed:', error.message);
                return {
                    success: false,
                    error: 'GENERATION_ERROR',
                    message: error.message || 'AI service temporarily unavailable.'
                };
            }
        } catch (error: any) {
            console.error("AI Flashcard Error:", error);
            return {
                success: false,
                error: 'GENERATION_ERROR',
                message: 'Something went wrong. Please try again.'
            };
        }
    });

    ipcMain.handle('get-creator-stats', async () => {
        win?.webContents.executeJavaScript(`console.log("[Stats] Fetching all Fortnite metrics + history...")`);
        try {
            // Get user-configured creator codes, fallback to empty array
            const codes = deviceSettings.creatorCodes || [];

            if (!codes || codes.length === 0) {
                return {
                    error: 'NO_CREATOR_CODES',
                    message: 'Please configure your Fortnite creator codes in Settings',
                    fortnite: {
                        minutesPlayed: '0',
                        uniquePlayers: '0',
                        favorites: '0',
                        plays: '0',
                        raw: { minutesPlayed: 0, uniquePlayers: 0, favorites: 0, plays: 0 }
                    }
                };
            }

            const now = new Date();
            const ago7 = new Date(now); ago7.setDate(now.getDate() - 7);
            const from = ago7.toISOString(), to = now.toISOString();

            const metrics = ['minutes-played', 'unique-players', 'favorites', 'plays'];
            const results: any = { minutesPlayed: 0, uniquePlayers: 0, favorites: 0, plays: 0 };

            for (const metric of metrics) {
                const promises = codes.map(async (code: string) => {
                    try {
                        const url = `https://api.fortnite.com/ecosystem/v1/islands/${code}/metrics/day/${metric}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
                        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        if (res.ok) {
                            const data = await res.json();
                            return data.intervals?.reduce((s: number, i: any) => s + (i.value || 0), 0) || 0;
                        }
                        return 0;
                    } catch { return 0; }
                });
                const vals = await Promise.all(promises);
                const total = vals.reduce((s, v) => s + v, 0);
                if (metric === 'minutes-played') results.minutesPlayed = total;
                else if (metric === 'unique-players') results.uniquePlayers = total;
                else if (metric === 'favorites') results.favorites = total;
                else if (metric === 'plays') results.plays = total;
                win?.webContents.executeJavaScript(`console.log("[Stats] ${metric}: ${total}")`);
            }

            // Save stats to OneDrive folder for cross-device sync
            const oneDriveDir = path.dirname(currentDataPath);
            const statsPath = path.join(oneDriveDir, 'fortnite-stats-history.json');
            let history: any = { snapshots: [], weeklyData: {}, allTime: { minutesPlayed: 0, uniquePlayers: 0, favorites: 0, plays: 0 } };
            try {
                if (existsSync(statsPath)) history = JSON.parse(await fs.readFile(statsPath, 'utf-8'));
                if (!history.weeklyData) history.weeklyData = {};
            } catch { }

            // Use ISO week number for deduplication
            const currentTime = new Date();
            const startOfYear = new Date(currentTime.getFullYear(), 0, 1);
            const weekNumber = Math.ceil((((currentTime.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
            const weekKey = `${currentTime.getFullYear()}-W${weekNumber}`;

            const today = currentTime.toISOString().split('T')[0];
            const existing = history.snapshots.find((s: any) => s.date === today);

            // Check if this week's data already exists
            if (!history.weeklyData[weekKey]) {
                // New week - add the data
                history.weeklyData[weekKey] = { date: today, ...results };

                if (!existing) {
                    history.snapshots.push({ date: today, week: weekKey, ...results });
                }

                // Recalculate all-time stats from weekly data (prevents duplicates)
                history.allTime = { minutesPlayed: 0, uniquePlayers: 0, favorites: 0, plays: 0 };
                Object.values(history.weeklyData).forEach((weekData: any) => {
                    history.allTime.minutesPlayed += weekData.minutesPlayed || 0;
                    history.allTime.uniquePlayers = Math.max(history.allTime.uniquePlayers, weekData.uniquePlayers || 0);
                    history.allTime.favorites = Math.max(history.allTime.favorites, weekData.favorites || 0);
                    history.allTime.plays += weekData.plays || 0;
                });

                await fs.writeFile(statsPath, JSON.stringify(history, null, 2));
                win?.webContents.executeJavaScript(`console.log("[Stats] Saved week ${weekKey} snapshot")`);
            } else {
                win?.webContents.executeJavaScript(`console.log("[Stats] Week ${weekKey} already recorded - using cached data")`);
            }

            const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();
            win?.webContents.executeJavaScript(`console.log("[Stats] All-time: ${fmt(history.allTime.minutesPlayed)} min, ${fmt(history.allTime.uniquePlayers)} players, ${fmt(history.allTime.favorites)} favs, ${fmt(history.allTime.plays)} plays")`);

            return {
                fortnite: {
                    minutesPlayed: fmt(history.allTime.minutesPlayed),
                    uniquePlayers: fmt(history.allTime.uniquePlayers),
                    favorites: fmt(history.allTime.favorites),
                    plays: fmt(history.allTime.plays),
                    raw: {
                        minutesPlayed: history.allTime.minutesPlayed,
                        uniquePlayers: history.allTime.uniquePlayers,
                        favorites: history.allTime.favorites,
                        plays: history.allTime.plays
                    }
                },
                curseforge: { downloads: '0', username: deviceSettings.curseforgeUsername || '' }
            };
        } catch (e: any) {
            win?.webContents.executeJavaScript(`console.error("[Stats] Error: ${e.message}")`);
            return {
                fortnite: {
                    minutesPlayed: '0', uniquePlayers: '0', favorites: '0', plays: '0',
                    raw: { minutesPlayed: 0, uniquePlayers: 0, favorites: 0, plays: 0 }
                },
                curseforge: { downloads: '0', username: deviceSettings.curseforgeUsername || '' }
            };
        }
    });

    ipcMain.handle('get-data', async () => {
        return dataFileLock.withLock(async () => {
            try {
                const dir = path.dirname(currentDataPath);
                if (!existsSync(dir)) {
                    await fs.mkdir(dir, { recursive: true });
                }

                const log = (msg: string) => {
                    console.log(msg);
                    // Properly escape for JavaScript string
                    const escaped = JSON.stringify(msg);
                    win?.webContents.executeJavaScript(`console.log(${escaped})`).catch(() => { });
                };

                log('Reading data from: ' + currentDataPath);
                log('File exists: ' + existsSync(currentDataPath));

                // Check for legacy migration if current data doesn't exist
                if (!existsSync(currentDataPath)) {
                    log('Attempting legacy data migration...');
                    await tryMigrateLegacyData();
                }

                if (!existsSync(currentDataPath)) {
                    log('No data file found, returning empty');
                    return { notes: {} };
                }

                const rawData = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
                log('Raw data loaded. Has notes? ' + !!rawData.notes);
                log('Raw notes keys: ' + (rawData.notes ? Object.keys(rawData.notes).length : 0));

                // Normalize notes structure: ensure each date key contains an array
                if (rawData.notes && typeof rawData.notes === 'object') {
                    let needsFixing = false;
                    const fixedNotes: any = {};

                    for (const dateKey in rawData.notes) {
                        const value = rawData.notes[dateKey];

                        // If it's already an array, keep it
                        if (Array.isArray(value)) {
                            fixedNotes[dateKey] = value;
                        }
                        // If it's a single note object, wrap it in an array
                        else if (value && typeof value === 'object' && value.id) {
                            fixedNotes[dateKey] = [value];
                            needsFixing = true;
                            log('Fixed date ' + dateKey + ': wrapped single note in array');
                        }
                        // If it's an empty string or invalid, create empty array
                        else {
                            fixedNotes[dateKey] = [];
                            if (value !== '' && value.length !== 0) {
                                needsFixing = true;
                                log('Fixed date ' + dateKey + ': replaced invalid value with empty array');
                            }
                        }
                    }

                    log('Total fixed notes: ' + Object.keys(fixedNotes).length);
                    rawData.notes = fixedNotes;

                    // Save the fixed version back to disk
                    if (needsFixing) {
                        log('Normalized calendar-data.json structure. Saving...');
                        await atomicWriteFile(currentDataPath, JSON.stringify(rawData, null, 2));
                        log('Fixed data saved successfully.');
                    }
                }

                log('Returning data with ' + Object.keys(rawData.notes || {}).length + ' note dates');
                return rawData;
            } catch (e) {
                const errMsg = 'Error loading data: ' + (e as Error).message;
                console.error(errMsg, e);
                const escaped = JSON.stringify(errMsg);
                win?.webContents.executeJavaScript(`console.error(${escaped})`).catch(() => { });
                return { notes: {} };
            }
        });
    });

    ipcMain.handle('save-data', async (_, data) => {
        return dataFileLock.withLock(async () => {
            try {
                const dir = path.dirname(currentDataPath);
                if (!existsSync(dir)) {
                    await fs.mkdir(dir, { recursive: true });
                }
                await atomicWriteFile(currentDataPath, JSON.stringify(data, null, 2));
                return { success: true };
            } catch (e) { return { success: false, error: e }; }
        });
    });

    ipcMain.handle('get-current-data-path', async () => {
        return currentDataPath;
    });

    ipcMain.handle('select-data-folder', async () => {
        const log = (msg: string) => {
            console.log(msg);
            const escaped = JSON.stringify(msg);
            win?.webContents.executeJavaScript(`console.log(${escaped})`).catch(() => { });
        };

        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) {
            const oldPath = currentDataPath;
            const newPath = path.join(result.filePaths[0], 'calendar-data.json');
            currentDataPath = newPath;
            globalSettingsPath = path.join(path.dirname(newPath), 'settings.json');

            log(`Data folder selected via dialog`);
            log(`Data path changed from: ${oldPath}`);
            log(`Data path changed to: ${currentDataPath}`);
            log(`Global settings path: ${globalSettingsPath}`);
            log(`File exists at new location: ${existsSync(currentDataPath)}`);

            await saveGlobalSettings({ dataPath: newPath });
            return newPath;
        }
        return null;
    });

    ipcMain.handle('set-data-path', async (_, newPath) => {
        const log = (msg: string) => {
            console.log(msg);
            const escaped = JSON.stringify(msg);
            win?.webContents.executeJavaScript(`console.log(${escaped})`).catch(() => { });
        };

        const oldPath = currentDataPath;
        currentDataPath = newPath;
        globalSettingsPath = path.join(path.dirname(newPath), 'settings.json');

        log(`Data path changed from: ${oldPath}`);
        log(`Data path changed to: ${currentDataPath}`);
        log(`Global settings path: ${globalSettingsPath}`);
        log(`File exists at new location: ${existsSync(currentDataPath)}`);

        await saveGlobalSettings({ dataPath: newPath });
        return newPath;
    });

    // Device-specific settings (divider position, etc.)
    ipcMain.handle('get-device-setting', async (_, key) => {
        return deviceSettings[key];
    });

    ipcMain.handle('save-device-setting', async (_, key, value) => {
        deviceSettings[key] = value;
        await saveDeviceSettings();
        return { success: true };
    });

    // Global settings (theme, etc.)
    ipcMain.handle('get-global-setting', async (_, key) => {
        try {
            if (existsSync(globalSettingsPath)) {
                const settings = JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
                return settings[key];
            }
        } catch { }
        return null;
    });

    ipcMain.handle('save-global-setting', async (_, key, value) => {
        try {
            const log = (msg: string) => {
                console.log(msg);
                const escaped = JSON.stringify(msg);
                win?.webContents.executeJavaScript(`console.log(${escaped})`).catch(() => { });
            };

            let settings: any = {};
            if (existsSync(globalSettingsPath)) {
                settings = JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
            }
            settings[key] = value;
            await saveGlobalSettings(settings);

            // If dataPath was updated, update the currentDataPath variable
            if (key === 'dataPath' && value) {
                const oldPath = currentDataPath;
                currentDataPath = value;
                globalSettingsPath = path.join(path.dirname(value), 'settings.json');
                log(`Data path updated from: ${oldPath}`);
                log(`Data path updated to: ${currentDataPath}`);
                log(`Global settings path updated to: ${globalSettingsPath}`);
            }

            return { success: true };
        } catch (e) { return { success: false, error: e }; }
    });

    ipcMain.handle('get-drawing', async () => {
        return dataFileLock.withLock(async () => {
            try {
                if (!existsSync(currentDataPath)) return null;
                const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
                return data.drawing || null;
            } catch { return null; }
        });
    });

    ipcMain.handle('save-drawing', async (_, drawingData) => {
        return dataFileLock.withLock(async () => {
            try {
                const dir = path.dirname(currentDataPath);
                if (!existsSync(dir)) {
                    await fs.mkdir(dir, { recursive: true });
                }
                let data: any = {};
                if (existsSync(currentDataPath)) {
                    data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
                }
                data.drawing = drawingData;
                await atomicWriteFile(currentDataPath, JSON.stringify(data, null, 2));
                return { success: true };
            } catch (e) { return { success: false, error: e }; }
        });
    });

    ipcMain.handle('get-boards', async () => {
        return dataFileLock.withLock(async () => {
            try {
                if (!existsSync(currentDataPath)) return null;
                const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
                return data.boards || null;
            } catch { return null; }
        });
    });

    ipcMain.handle('save-boards', async (_, boardsData) => {
        return dataFileLock.withLock(async () => {
            try {
                const dir = path.dirname(currentDataPath);
                if (!existsSync(dir)) {
                    await fs.mkdir(dir, { recursive: true });
                }
                let data: any = {};
                if (existsSync(currentDataPath)) {
                    data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
                }
                data.boards = boardsData;
                await atomicWriteFile(currentDataPath, JSON.stringify(data, null, 2));
                return { success: true };
            } catch (e) { return { success: false, error: e }; }
        });
    });

    // Workspace IPC Handlers
    ipcMain.handle('get-workspace', async () => {
        return dataFileLock.withLock(async () => {
            try {
                if (!existsSync(currentDataPath)) {
                    return null;
                }
                const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
                return data.workspace || null;
            } catch (e) {
                console.error('Failed to load workspace:', e);
                return null;
            }
        });
    });

    ipcMain.handle('save-workspace', async (_, workspaceData) => {
        return dataFileLock.withLock(async () => {
            try {
                const dir = path.dirname(currentDataPath);
                if (!existsSync(dir)) {
                    await fs.mkdir(dir, { recursive: true });
                }
                let data: any = {};
                if (existsSync(currentDataPath)) {
                    data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
                }
                data.workspace = workspaceData;
                await atomicWriteFile(currentDataPath, JSON.stringify(data, null, 2));
                return { success: true };
            } catch (e) {
                console.error('Failed to save workspace:', e);
                return { success: false, error: (e as Error).message };
            }
        });
    });

    // Auto-launch handlers - supports both regular builds and Windows Store (APPX)
    ipcMain.handle('get-auto-launch', async () => {
        if (isWindowsStore && WindowsStoreAutoLaunch) {
            try {
                const status = await WindowsStoreAutoLaunch.getStatus();
                // Status: 0 = disabled, 1 = disabledByUser, 2 = enabled
                return status === 2;
            } catch (e) {
                console.error('Failed to get Windows Store auto-launch status:', e);
                return false;
            }
        }
        return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('set-auto-launch', async (_, openAtLogin) => {
        if (isWindowsStore && WindowsStoreAutoLaunch) {
            try {
                if (openAtLogin) {
                    await WindowsStoreAutoLaunch.enable();
                } else {
                    await WindowsStoreAutoLaunch.disable();
                }
                const status = await WindowsStoreAutoLaunch.getStatus();
                return status === 2;
            } catch (e) {
                console.error('Failed to set Windows Store auto-launch:', e);
                return false;
            }
        }
        // Don't specify path - let Electron use the correct executable path
        app.setLoginItemSettings({ openAtLogin });
        return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('open-external', async (_, url) => {
        await shell.openExternal(url);
    });

    // Open Windows Store review page
    ipcMain.handle('open-store-review', async () => {
        try {
            // Windows Store Product ID for ThoughtsPlus
            const productId = '9nb8vzfwnv81';
            const reviewUrl = `ms-windows-store://review/?ProductId=${productId}`;

            await shell.openExternal(reviewUrl);
            console.log('Opened Windows Store review page');
            return true;
        } catch (error) {
            console.error('Failed to open Windows Store review page:', error);
            return false;
        }
    });

    ipcMain.handle('get-username', async () => {
        const customName = deviceSettings.customUserName;
        return customName || os.userInfo().username;
    });

    ipcMain.handle('set-username', async (_event, name: string) => {
        deviceSettings.customUserName = name;
        await saveDeviceSettings();
        return true;
    });

    // GitHub Configuration
    ipcMain.handle('get-github-username', () => deviceSettings.githubUsername || '');
    ipcMain.handle('set-github-username', async (_, username) => {
        deviceSettings.githubUsername = username;
        await saveDeviceSettings();
        return { success: true };
    });

    ipcMain.handle('get-github-token', () => {
        const encryptedToken = deviceSettings.githubToken || '';
        return decryptString(encryptedToken);
    });
    ipcMain.handle('set-github-token', async (_, token) => {
        deviceSettings.githubToken = encryptString(token || '');
        deviceSettings._githubTokenEncrypted = true;
        await saveDeviceSettings();
        return { success: true };
    });

    // Open data folder in file explorer (opens workspace subfolder)
    ipcMain.handle('open-data-folder', async () => {
        try {
            const dataDir = path.dirname(currentDataPath);
            const workspaceDir = path.join(dataDir, 'workspace');

            // Ensure workspace folder exists
            if (!existsSync(workspaceDir)) {
                await fs.mkdir(workspaceDir, { recursive: true });
            }

            await shell.openPath(workspaceDir);
            return { success: true, path: workspaceDir };
        } catch (e) {
            console.error('Failed to open data folder:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Get current data folder path
    ipcMain.handle('get-data-folder-path', () => {
        return path.dirname(currentDataPath);
    });

    // Open file dialog to select a workspace file
    ipcMain.handle('open-workspace-file-dialog', async () => {
        if (!win) return { success: false, error: 'No window' };

        try {
            const result = await dialog.showOpenDialog(win, {
                title: 'Open Workspace File',
                filters: [
                    {
                        name: 'All Supported Files',
                        extensions: [
                            'exec', 'brd', 'nt', 'nbm', 'deck', 'md',
                            'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt',
                            'txt', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'
                        ]
                    },
                    { name: 'Notebook Files', extensions: ['exec'] },
                    { name: 'Board Files', extensions: ['brd'] },
                    { name: 'Node Map Files', extensions: ['nbm'] },
                    { name: 'Note Files', extensions: ['nt'] },
                    { name: 'Flashcard Decks', extensions: ['deck'] },
                    { name: 'Markdown Files', extensions: ['md'] },
                    { name: 'PDF Documents', extensions: ['pdf'] },
                    { name: 'Word Documents', extensions: ['docx', 'doc'] },
                    { name: 'Excel Spreadsheets', extensions: ['xlsx', 'xls'] },
                    { name: 'PowerPoint Presentations', extensions: ['pptx', 'ppt'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] },
                ],
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true };
            }

            const filePath = result.filePaths[0];
            const fileName = path.basename(filePath);
            const ext = path.extname(filePath).toLowerCase();

            // Read file content
            const content = await fs.readFile(filePath, 'utf-8');

            // Handle .md files - convert to exec notebook with markdown cell
            if (ext === '.md') {
                const notebookId = crypto.randomUUID();
                const now = new Date().toISOString();

                // Create a notebook structure with the markdown content
                const notebookContent = {
                    id: notebookId,
                    title: path.basename(fileName, ext),
                    cells: [
                        {
                            id: crypto.randomUUID(),
                            type: 'markdown',
                            content: content,
                            createdAt: now,
                        }
                    ],
                    createdAt: now,
                    updatedAt: now,
                };

                // Save as a .exec file in the workspace folder
                const wsDir = getWorkspaceFilesDir();
                if (!existsSync(wsDir)) {
                    await fs.mkdir(wsDir, { recursive: true });
                }

                const safeName = path.basename(fileName, ext).replace(/[<>:"/\\|?*]/g, '_').trim() || 'Untitled';
                let execFilePath = path.join(wsDir, `${safeName}.exec`);
                let counter = 1;
                while (existsSync(execFilePath)) {
                    execFilePath = path.join(wsDir, `${safeName} (${counter}).exec`);
                    counter++;
                }

                await atomicWriteFile(execFilePath, JSON.stringify(notebookContent, null, 2));

                console.log(`[open-workspace-file-dialog] Converted MD to exec: ${filePath} -> ${execFilePath}`);

                return {
                    success: true,
                    filePath: execFilePath,
                    fileName: path.basename(execFilePath, '.exec'),
                    fileType: 'exec',
                    content: notebookContent,
                    convertedFromMd: true,
                    originalMdPath: filePath,
                };
            }

            // Determine file type from extension
            let fileType: 'exec' | 'board' | 'note' | 'nbm' | 'deck' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'txt' | 'md' | 'image' | null = null;

            if (ext === '.exec') fileType = 'exec';
            else if (ext === '.brd') fileType = 'board';
            else if (ext === '.nbm') fileType = 'nbm';
            else if (ext === '.nt') fileType = 'note';
            else if (ext === '.deck') fileType = 'deck';
            else if (ext === '.pdf') fileType = 'pdf';
            else if (ext === '.docx' || ext === '.doc') fileType = 'docx';
            else if (ext === '.xlsx' || ext === '.xls') fileType = 'xlsx';
            else if (ext === '.pptx' || ext === '.ppt') fileType = 'pptx';
            else if (ext === '.txt') fileType = 'txt';
            else if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) fileType = 'image';

            if (!fileType) {
                return { success: false, error: 'Unknown file type' };
            }

            // For document types (not native workspace files), just return the file path
            const documentTypes = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'image'];
            if (documentTypes.includes(fileType)) {
                return {
                    success: true,
                    filePath,
                    fileName: path.basename(fileName, ext),
                    fileType,
                    content: null, // Don't load content for documents
                    isDocument: true
                };
            }

            // For native workspace files, parse the content
            let parsedContent;
            try {
                parsedContent = JSON.parse(content);
            } catch {
                parsedContent = { content }; // For plain text notes
            }

            return {
                success: true,
                filePath,
                fileName: path.basename(fileName, ext),
                fileType,
                content: parsedContent
            };
        } catch (e) {
            console.error('Failed to open file dialog:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // ============================================================================
    // FILE-BASED WORKSPACE STORAGE
    // ============================================================================
    // Each workspace file (.exec, .brd, .nt) is stored as an individual file
    // in the workspace/ subfolder of the data directory.
    // ============================================================================

    // Get the workspace files directory
    const getWorkspaceFilesDir = () => {
        const dataDir = path.dirname(currentDataPath);
        return path.join(dataDir, 'workspace');
    };

    // Ensure workspace directory exists
    const ensureWorkspaceDir = async () => {
        const wsDir = getWorkspaceFilesDir();
        if (!existsSync(wsDir)) {
            await fs.mkdir(wsDir, { recursive: true });
        }
        return wsDir;
    };

    // Generate a safe filename from a title
    const sanitizeFileName = (name: string): string => {
        // Remove invalid characters for Windows/Mac/Linux
        return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Untitled';
    };

    // Get unique file path (add number suffix if exists)
    const getUniqueFilePath = async (dir: string, baseName: string, ext: string): Promise<string> => {
        let filePath = path.join(dir, `${baseName}${ext}`);
        let counter = 1;
        while (existsSync(filePath)) {
            filePath = path.join(dir, `${baseName} (${counter})${ext}`);
            counter++;
        }
        return filePath;
    };

    // Save a workspace file to disk
    ipcMain.handle('save-workspace-file', async (_, { filePath, content, createNew, name, type, folderName }) => {
        try {
            let targetPath = filePath;

            // If creating new file, generate path in workspace directory
            if (createNew || !filePath) {
                const wsDir = await ensureWorkspaceDir();

                // If folderName is provided, create/use subfolder
                let targetDir = wsDir;
                if (folderName) {
                    targetDir = path.join(wsDir, folderName);
                    // Ensure subfolder exists
                    if (!existsSync(targetDir)) {
                        await fs.mkdir(targetDir, { recursive: true });
                    }
                }

                const ext = type === 'exec' ? '.exec' : type === 'board' ? '.brd' : type === 'nbm' ? '.nbm' : '.nt';
                const safeName = sanitizeFileName(name || 'Untitled');
                targetPath = await getUniqueFilePath(targetDir, safeName, ext);
            }

            // Ensure parent directory exists
            const dir = path.dirname(targetPath);
            if (!existsSync(dir)) {
                await fs.mkdir(dir, { recursive: true });
            }

            // For .nt files, save as plain text, not JSON
            if (type === 'note') {
                await atomicWriteFile(targetPath, typeof content === 'string' ? content : '', true); // Skip JSON validation
            } else {
                await atomicWriteFile(targetPath, JSON.stringify(content, null, 2));
            }

            return { success: true, filePath: targetPath };
        } catch (e) {
            console.error('Failed to save workspace file:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Load a workspace file from disk
    ipcMain.handle('load-workspace-file', async (_, filePath) => {
        try {
            if (!existsSync(filePath)) {
                return { success: false, error: 'File not found', notFound: true };
            }

            // Detect file type from extension
            const ext = path.extname(filePath).toLowerCase();

            // Document types - return file path only, don't load content
            const documentExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'];
            if (documentExtensions.includes(ext)) {
                return {
                    success: true,
                    content: null,
                    filePath,
                    isDocument: true,
                    message: 'Document file - content not loaded'
                };
            }

            // Text files and markdown - return as plain text
            if (['.txt', '.md', '.nt'].includes(ext)) {
                const content = await fs.readFile(filePath, 'utf-8');
                return { success: true, content: content, filePath };
            }

            // Image files - return file path only
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
            if (imageExtensions.includes(ext)) {
                return {
                    success: true,
                    content: null,
                    filePath,
                    isImage: true,
                    message: 'Image file - content not loaded'
                };
            }

            // Native workspace files (.exec, .brd, .nbm, .deck) - parse as JSON
            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, content: JSON.parse(content), filePath };
        } catch (e) {
            console.error('Failed to load workspace file:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Rename a workspace file on disk
    ipcMain.handle('rename-workspace-file', async (_, { oldPath, newName, type }) => {
        try {
            if (!existsSync(oldPath)) {
                return { success: false, error: 'File not found' };
            }

            const dir = path.dirname(oldPath);
            const ext = type === 'exec' ? '.exec' : type === 'board' ? '.brd' : type === 'nbm' ? '.nbm' : '.nt';
            const safeName = sanitizeFileName(newName);
            const newPath = await getUniqueFilePath(dir, safeName, ext);

            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (e) {
            console.error('Failed to rename workspace file:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Delete a workspace file from disk
    ipcMain.handle('delete-workspace-file', async (_, filePath) => {
        try {
            if (existsSync(filePath)) {
                await fs.unlink(filePath);
            }
            return { success: true };
        } catch (e) {
            console.error('Failed to delete workspace file:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Get workspace files directory path
    ipcMain.handle('get-workspace-files-dir', async () => {
        const wsDir = await ensureWorkspaceDir();
        return wsDir;
    });

    // ============================================================================
    // FILE SYSTEM WATCHER - Auto-detect new files in workspace
    // ============================================================================
    let fileWatcher: FSWatcher | null = null;

    // Start watching workspace directory for new files
    ipcMain.handle('start-workspace-watcher', async () => {
        try {
            const wsDir = await ensureWorkspaceDir();

            // Stop existing watcher if any
            if (fileWatcher) {
                await fileWatcher.close();
            }

            // Watch for new files (not directories)
            fileWatcher = chokidar.watch(wsDir, {
                ignored: /(^|[\/\\])\../, // ignore dotfiles
                persistent: true,
                ignoreInitial: true, // Don't trigger for existing files
                depth: 2, // Watch subdirectories up to 2 levels
                awaitWriteFinish: {
                    stabilityThreshold: 2000,
                    pollInterval: 100
                }
            });

            fileWatcher.on('add', async (filePath: string) => {
                console.log('[FileWatcher] New file detected:', filePath);

                // Detect file type from extension
                const ext = path.extname(filePath).toLowerCase();
                const supportedExtensions = [
                    '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
                    '.txt', '.md', '.markdown', '.png', '.jpg', '.jpeg', '.gif',
                    '.bmp', '.webp', '.svg'
                ];

                if (supportedExtensions.includes(ext)) {
                    // Notify renderer process about new file
                    if (win?.webContents) {
                        win.webContents.send('workspace-file-added', {
                            filePath,
                            fileName: path.basename(filePath),
                            extension: ext
                        });
                    }
                }
            });

            fileWatcher.on('unlink', async (filePath: string) => {
                console.log('[FileWatcher] File deleted:', filePath);
                if (win?.webContents) {
                    win.webContents.send('workspace-file-deleted', {
                        filePath
                    });
                }
            });

            fileWatcher.on('error', (error: unknown) => {
                console.error('[FileWatcher] Error:', error);
            });

            console.log('[FileWatcher] Started watching:', wsDir);
            return { success: true, watchPath: wsDir };
        } catch (e) {
            console.error('Failed to start workspace watcher:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Stop watching workspace directory
    ipcMain.handle('stop-workspace-watcher', async () => {
        try {
            if (fileWatcher) {
                await fileWatcher.close();
                fileWatcher = null;
                console.log('[FileWatcher] Stopped watching');
            }
            return { success: true };
        } catch (e) {
            console.error('Failed to stop workspace watcher:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Scan workspace directory for external files to import
    ipcMain.handle('scan-workspace-for-documents', async () => {
        try {
            const wsDir = await ensureWorkspaceDir();
            const supportedExtensions = [
                '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
                '.txt', '.md', '.markdown', '.png', '.jpg', '.jpeg', '.gif',
                '.bmp', '.webp', '.svg'
            ];

            const scanDirectory = async (dir: string, depth: number = 0): Promise<any[]> => {
                if (depth > 2) return []; // Limit recursion depth

                const entries = await fs.readdir(dir, { withFileTypes: true });
                const files: any[] = [];

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        // Recursively scan subdirectories
                        const subFiles = await scanDirectory(fullPath, depth + 1);
                        files.push(...subFiles);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (supportedExtensions.includes(ext)) {
                            const stats = await fs.stat(fullPath);
                            files.push({
                                filePath: fullPath,
                                fileName: entry.name,
                                extension: ext,
                                size: stats.size,
                                createdAt: stats.birthtime.toISOString(),
                                modifiedAt: stats.mtime.toISOString(),
                                relativePath: path.relative(wsDir, fullPath)
                            });
                        }
                    }
                }

                return files;
            };

            const files = await scanDirectory(wsDir);
            console.log(`[FileWatcher] Scanned workspace, found ${files.length} documents`);

            return { success: true, files };
        } catch (e) {
            console.error('Failed to scan workspace for documents:', e);
            return { success: false, error: (e as Error).message, files: [] };
        }
    });

    // Open external file in default application
    ipcMain.handle('open-external-file', async (_, filePath) => {
        try {
            await shell.openPath(filePath);
            return { success: true };
        } catch (e) {
            console.error('Failed to open external file:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Convert DOCX to HTML for preview
    ipcMain.handle('convert-docx-to-html', async (_, filePath) => {
        try {
            const mammoth = require('mammoth');

            // Enhanced conversion options for better formatting
            const options = {
                styleMap: [
                    // Preserve bold
                    "b => strong",
                    "i => em",
                    // Headings
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Heading 3'] => h3:fresh",
                    "p[style-name='Heading 4'] => h4:fresh",
                    // Lists
                    "p[style-name='List Paragraph'] => li:fresh",
                ],
                convertImage: mammoth.images.imgElement(async (image: any) => {
                    // Convert images to base64 data URLs
                    const buffer = await image.read();
                    const base64 = buffer.toString('base64');
                    const contentType = image.contentType || 'image/png';
                    return {
                        src: `data:${contentType};base64,${base64}`
                    };
                }),
                includeDefaultStyleMap: true,
                includeEmbeddedStyleMap: true,
            };

            const result = await mammoth.convertToHtml({ path: filePath }, options);

            // Wrap in a container with table styling
            const styledHtml = `
                <style>
                    table { 
                        border-collapse: collapse; 
                        width: 100%; 
                        margin: 1em 0;
                    }
                    td, th { 
                        border: 1px solid #ddd; 
                        padding: 8px; 
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        margin: 1em 0;
                    }
                    strong {
                        font-weight: bold;
                    }
                    em {
                        font-style: italic;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        margin-top: 1em;
                        margin-bottom: 0.5em;
                    }
                </style>
                ${result.value}
            `;

            return { success: true, html: styledHtml, messages: result.messages };
        } catch (e) {
            console.error('Failed to convert DOCX:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Read PDF file as buffer for react-pdf
    ipcMain.handle('read-pdf-file', async (_, filePath) => {
        try {
            const buffer = await fs.readFile(filePath);
            return { success: true, data: Array.from(buffer) };
        } catch (e) {
            console.error('Failed to read PDF:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Convert XLSX to HTML table for preview with colors and styles
    ipcMain.handle('convert-xlsx-to-html', async (_, filePath) => {
        try {
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath, { cellStyles: true });

            let html = '<div class="xlsx-preview">';

            // Helper function to convert Excel color to hex
            const excelColorToHex = (color: any): string | null => {
                if (!color) return null;

                // RGB format
                if (color.rgb) {
                    const rgb = color.rgb;
                    // Handle ARGB format (8 chars) or RGB format (6 chars)
                    if (rgb.length === 8) {
                        return '#' + rgb.substring(2); // Remove alpha channel
                    }
                    return '#' + rgb;
                }

                // Indexed color - use common Excel palette
                if (color.indexed !== undefined) {
                    const palette: { [key: number]: string } = {
                        0: '#000000', 1: '#FFFFFF', 2: '#FF0000', 3: '#00FF00',
                        4: '#0000FF', 5: '#FFFF00', 6: '#FF00FF', 7: '#00FFFF',
                        8: '#000000', 9: '#FFFFFF', 10: '#FF0000', 11: '#00FF00',
                        12: '#0000FF', 13: '#FFFF00', 14: '#FF00FF', 15: '#00FFFF',
                        64: '#000000', 65: '#FFFFFF'
                    };
                    return palette[color.indexed] || null;
                }

                return null;
            };

            // Convert each sheet to HTML with styles
            workbook.SheetNames.forEach((sheetName: string, index: number) => {
                const worksheet = workbook.Sheets[sheetName];
                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

                html += `
                    <div class="sheet-container">
                        <h3 class="sheet-title">${sheetName}</h3>
                        <table>
                `;

                // Generate table rows
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    html += '<tr>';
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                        const cell = worksheet[cellAddress];

                        let cellValue = '';
                        let cellStyle = '';

                        if (cell) {
                            // Get cell value
                            cellValue = cell.w || cell.v || '';

                            // Build inline styles from cell formatting
                            const styles: string[] = [];

                            if (cell.s) {
                                // Background color
                                const bgColor = excelColorToHex(cell.s.fgColor || cell.s.bgColor);
                                if (bgColor) {
                                    styles.push(`background-color: ${bgColor}`);
                                }

                                // Font color
                                if (cell.s.font) {
                                    const fontColor = excelColorToHex(cell.s.font.color);
                                    if (fontColor) {
                                        styles.push(`color: ${fontColor}`);
                                    }

                                    // Bold
                                    if (cell.s.font.bold) {
                                        styles.push('font-weight: bold');
                                    }

                                    // Italic
                                    if (cell.s.font.italic) {
                                        styles.push('font-style: italic');
                                    }

                                    // Font size
                                    if (cell.s.font.sz) {
                                        styles.push(`font-size: ${cell.s.font.sz}pt`);
                                    }
                                }

                                // Text alignment
                                if (cell.s.alignment) {
                                    if (cell.s.alignment.horizontal) {
                                        styles.push(`text-align: ${cell.s.alignment.horizontal}`);
                                    }
                                    if (cell.s.alignment.vertical) {
                                        styles.push(`vertical-align: ${cell.s.alignment.vertical}`);
                                    }
                                }
                            }

                            if (styles.length > 0) {
                                cellStyle = ` style="${styles.join('; ')}"`;
                            }
                        }

                        const tag = R === range.s.r ? 'th' : 'td';
                        html += `<${tag}${cellStyle}>${cellValue}</${tag}>`;
                    }
                    html += '</tr>';
                }

                html += `
                        </table>
                    </div>
                `;

                if (index < workbook.SheetNames.length - 1) {
                    html += '<hr class="sheet-divider" />';
                }
            });

            html += '</div>';

            return { success: true, html, sheetCount: workbook.SheetNames.length };
        } catch (e) {
            console.error('Failed to convert XLSX:', e);
            return { success: false, error: (e as Error).message };
        }
    });

    // Copy external file into workspace
    ipcMain.handle('import-external-file', async (_, { sourcePath, targetName }) => {
        try:
        const wsDir = await ensureWorkspaceDir();
        const ext = path.extname(sourcePath);
        const baseName = targetName || path.basename(sourcePath, ext);
        const targetPath = await getUniqueFilePath(wsDir, baseName, ext);

        await fs.copyFile(sourcePath, targetPath);

        const stats = await fs.stat(targetPath);
        return {
            success: true,
            filePath: targetPath,
            fileName: path.basename(targetPath),
            size: stats.size
        };
    } catch (e) {
        console.error('Failed to import external file:', e);
        return { success: false, error: (e as Error).message };
    }
});

// Save a pasted image to the workspace assets folder
ipcMain.handle('save-pasted-image', async (_, { imageData, fileName }) => {
    try {
        const wsDir = await ensureWorkspaceDir();
        const assetsDir = path.join(wsDir, 'assets');

        // Ensure assets directory exists
        if (!existsSync(assetsDir)) {
            await fs.mkdir(assetsDir, { recursive: true });
        }

        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const safeName = fileName || `pasted-image-${timestamp}`;
        const finalName = `${safeName}-${timestamp}.png`;
        const imagePath = path.join(assetsDir, finalName);

        // imageData is base64 encoded PNG
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        await fs.writeFile(imagePath, buffer);

        return {
            success: true,
            filePath: imagePath,
            relativePath: `assets/${finalName}`,
            fileName: finalName
        };
    } catch (e) {
        console.error('Failed to save pasted image:', e);
        return { success: false, error: (e as Error).message };
    }
});

// List all images in the workspace assets folder
ipcMain.handle('list-workspace-images', async () => {
    try {
        const wsDir = await ensureWorkspaceDir();
        const assetsDir = path.join(wsDir, 'assets');

        if (!existsSync(assetsDir)) {
            return { success: true, images: [] };
        }

        const entries = await fs.readdir(assetsDir, { withFileTypes: true });
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

        const images = await Promise.all(
            entries
                .filter(e => e.isFile() && imageExtensions.includes(path.extname(e.name).toLowerCase()))
                .map(async (e) => {
                    const filePath = path.join(assetsDir, e.name);
                    const stats = await fs.stat(filePath);
                    const sizeInKB = stats.size / 1024;
                    const sizeFormatted = sizeInKB < 1024
                        ? `${sizeInKB.toFixed(1)} KB`
                        : `${(sizeInKB / 1024).toFixed(1)} MB`;

                    return {
                        fileName: e.name,
                        filePath,
                        size: stats.size,
                        sizeFormatted,
                        createdAt: stats.birthtime.toISOString(),
                    };
                })
        );

        // Sort by creation date (newest first)
        images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return { success: true, images };
    } catch (e) {
        console.error('Failed to list workspace images:', e);
        return { success: false, error: (e as Error).message, images: [] };
    }
});

// Delete an image from the workspace assets folder
ipcMain.handle('delete-workspace-image', async (_, filePath) => {
    try {
        if (existsSync(filePath)) {
            await fs.unlink(filePath);
        }
        return { success: true };
    } catch (e) {
        console.error('Failed to delete workspace image:', e);
        return { success: false, error: (e as Error).message };
    }
});

// Show item in folder (for opening file location)
ipcMain.handle('show-item-in-folder', async (_, filePath) => {
    try {
        shell.showItemInFolder(filePath);
        return { success: true };
    } catch (e) {
        console.error('Failed to show item in folder:', e);
        return { success: false, error: (e as Error).message };
    }
});

// List all workspace files in a directory
ipcMain.handle('list-workspace-files', async (_, dirPath?: string) => {
    try {
        const targetDir = dirPath || await ensureWorkspaceDir();
        if (!existsSync(targetDir)) {
            return { success: true, files: [] };
        }

        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const files = entries
            .filter(e => e.isFile() && ['.exec', '.brd', '.nt', '.nbm'].includes(path.extname(e.name).toLowerCase()))
            .map(e => ({
                name: path.basename(e.name, path.extname(e.name)),
                fileName: e.name,
                filePath: path.join(targetDir, e.name),
                type: path.extname(e.name).toLowerCase() === '.exec' ? 'exec'
                    : path.extname(e.name).toLowerCase() === '.brd' ? 'board'
                        : path.extname(e.name).toLowerCase() === '.nbm' ? 'nbm'
                            : 'note'
            }));

        return { success: true, files };
    } catch (e) {
        console.error('Failed to list workspace files:', e);
        return { success: false, error: (e as Error).message, files: [] };
    }
});

// Migrate boards from calendar-data.json to individual files
ipcMain.handle('migrate-boards-to-files', async () => {
    try {
        const wsDir = await ensureWorkspaceDir();

        // Load existing boards from calendar-data.json
        if (!existsSync(currentDataPath)) {
            return { success: true, migrated: 0, message: 'No data file found' };
        }

        const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
        const boards = data.boards?.boards || [];

        if (boards.length === 0) {
            return { success: true, migrated: 0, message: 'No boards to migrate' };
        }

        const migratedFiles: { id: string; filePath: string; name: string }[] = [];

        for (const board of boards) {
            const safeName = sanitizeFileName(board.name || 'Untitled Board');
            const filePath = await getUniqueFilePath(wsDir, safeName, '.brd');

            // Save board content to file
            await atomicWriteFile(filePath, JSON.stringify(board, null, 2));

            migratedFiles.push({
                id: board.id,
                filePath,
                name: board.name
            });
        }

        console.log(`Migrated ${migratedFiles.length} boards to individual files`);
        return {
            success: true,
            migrated: migratedFiles.length,
            files: migratedFiles,
            message: `Migrated ${migratedFiles.length} boards`
        };
    } catch (e) {
        console.error('Failed to migrate boards:', e);
        return { success: false, error: (e as Error).message, migrated: 0 };
    }
});

// Migrate notebooks from calendar-data.json to individual files
ipcMain.handle('migrate-notebooks-to-files', async () => {
    try {
        const wsDir = await ensureWorkspaceDir();

        // Load existing notebooks from calendar-data.json
        if (!existsSync(currentDataPath)) {
            return { success: true, migrated: 0, message: 'No data file found' };
        }

        const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
        const notebooks = data.nerdbooks?.notebooks || [];

        if (notebooks.length === 0) {
            return { success: true, migrated: 0, message: 'No notebooks to migrate' };
        }

        const migratedFiles: { id: string; filePath: string; name: string }[] = [];

        for (const notebook of notebooks) {
            const safeName = sanitizeFileName(notebook.title || 'Untitled Notebook');
            const filePath = await getUniqueFilePath(wsDir, safeName, '.exec');

            // Save notebook content to file
            await atomicWriteFile(filePath, JSON.stringify(notebook, null, 2));

            migratedFiles.push({
                id: notebook.id,
                filePath,
                name: notebook.title
            });
        }

        console.log(`Migrated ${migratedFiles.length} notebooks to individual files`);
        return {
            success: true,
            migrated: migratedFiles.length,
            files: migratedFiles,
            message: `Migrated ${migratedFiles.length} notebooks`
        };
    } catch (e) {
        console.error('Failed to migrate notebooks:', e);
        return { success: false, error: (e as Error).message, migrated: 0 };
    }
});

// Migrate all workspace files (boards and notebooks) to individual files
// This is called to migrate existing files that don't have filePath set
ipcMain.handle('migrate-workspace-files-to-disk', async (_, workspaceFiles: Array<{ id: string; contentId: string; name: string; type: string; parentId?: string | null }>) => {
    try {
        const wsDir = await ensureWorkspaceDir();

        if (!existsSync(currentDataPath)) {
            return { success: false, error: 'No data file found', files: [] };
        }

        const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
        const boards = data.boards?.boards || [];
        const notebooks = data.nerdbooks?.notebooks || [];
        const quickNotes = data.notebookNotes || [];

        const migratedFiles: { id: string; filePath: string; name: string; type: string }[] = [];

        // Get workspace data to check for Quick Notes folder
        const workspaceData = data.workspace || { files: [], folders: [] };
        const quickNotesFolder = workspaceData.folders?.find(
            (f: any) => f.isQuickNotesFolder === true || f.name === 'Quick Notes'
        );

        for (const wsFile of workspaceFiles) {
            let content: any = null;
            let ext = '';
            let targetDir = wsDir;
            let isPlainText = false;

            if (wsFile.type === 'board') {
                content = boards.find((b: any) => b.id === wsFile.contentId);
                ext = '.brd';
            } else if (wsFile.type === 'exec') {
                content = notebooks.find((n: any) => n.id === wsFile.contentId);
                ext = '.exec';
            } else if (wsFile.type === 'note') {
                // Find the quick note by contentId
                const quickNote = quickNotes.find((n: any) => n.id === wsFile.contentId);
                if (quickNote) {
                    content = quickNote.content || ''; // Plain text content
                    isPlainText = true;
                }
                ext = '.nt';

                // If this note belongs to Quick Notes folder, save to subfolder
                if (quickNotesFolder && wsFile.parentId === quickNotesFolder.id) {
                    targetDir = path.join(wsDir, 'Quick Notes');
                    // Ensure Quick Notes subfolder exists
                    if (!existsSync(targetDir)) {
                        await fs.mkdir(targetDir, { recursive: true });
                    }
                }
            } else if (wsFile.type === 'nbm') {
                // Node maps might not be in legacy data, but supporting for consistency
                ext = '.nbm';
            }

            if (content !== null && content !== undefined) {
                const safeName = sanitizeFileName(wsFile.name || 'Untitled');

                // Check if file already exists at the expected path
                const expectedPath = path.join(targetDir, safeName + ext);
                let filePath: string;

                if (existsSync(expectedPath)) {
                    // File already exists, use it (don't create duplicate)
                    filePath = expectedPath;
                    console.log(`File already exists, skipping migration: ${filePath}`);
                } else {
                    // File doesn't exist, create it (use getUniqueFilePath in case of conflicts)
                    filePath = await getUniqueFilePath(targetDir, safeName, ext);

                    // Save content to file
                    if (isPlainText) {
                        // For .nt files, save as plain text
                        await atomicWriteFile(filePath, typeof content === 'string' ? content : '', true);
                    } else {
                        // For other files, save as JSON
                        await atomicWriteFile(filePath, JSON.stringify(content, null, 2));
                    }

                    console.log(`Migrated ${wsFile.type} "${wsFile.name}" to ${filePath}`);
                }

                migratedFiles.push({
                    id: wsFile.id,
                    filePath,
                    name: wsFile.name,
                    type: wsFile.type
                });

                console.log(`Migrated ${wsFile.type} "${wsFile.name}" to ${filePath}`);
            }
        }

        return {
            success: true,
            migrated: migratedFiles.length,
            files: migratedFiles,
            message: `Migrated ${migratedFiles.length} files to individual storage`
        };
    } catch (e) {
        console.error('Failed to migrate workspace files:', e);
        return { success: false, error: (e as Error).message, files: [] };
    }
});

// Fix old .nt files that contain JSON structure instead of plain text
ipcMain.handle('fix-nt-json-files', async (_, filePaths: string[]) => {
    try {
        const fixedFiles: string[] = [];

        for (const filePath of filePaths) {
            if (!existsSync(filePath) || !filePath.endsWith('.nt')) {
                continue;
            }

            try {
                const content = await fs.readFile(filePath, 'utf-8');

                // Try to parse as JSON
                const parsed = JSON.parse(content);

                // If it has the old structure with content field, extract it
                if (parsed && typeof parsed === 'object' && 'content' in parsed) {
                    const plainText = parsed.content || '';

                    // Rewrite as plain text
                    await atomicWriteFile(filePath, plainText, true);
                    fixedFiles.push(filePath);
                    console.log(`Fixed .nt file: ${filePath}`);
                }
            } catch (parseError) {
                // Not JSON or already plain text, skip
                continue;
            }
        }

        return {
            success: true,
            fixed: fixedFiles.length,
            files: fixedFiles,
            message: `Fixed ${fixedFiles.length} .nt files`
        };
    } catch (e) {
        console.error('Failed to fix .nt files:', e);
        return { success: false, error: (e as Error).message, files: [] };
    }
});

// Open file in system file explorer (reveal in folder)
ipcMain.handle('reveal-in-explorer', async (_, filePath) => {
    try {
        shell.showItemInFolder(filePath);
        return { success: true };
    } catch (e) {
        console.error('Failed to reveal in explorer:', e);
        return { success: false, error: (e as Error).message };
    }
});

// ============================================================================
// ANKI PACKAGE PARSER - Parse .apkg files for flashcard import
// ============================================================================
// .apkg files are ZIP archives containing a SQLite database (collection.anki2)
// This handler extracts and parses the database to get flashcard data
// ============================================================================
ipcMain.handle('parse-anki-package', async (_, data) => {
    let tempDir: string | null = null;
    let tempFilePath: string | null = null;

    try {
        // Handle both file path (old) and buffer (new) formats
        const isBuffer = data && typeof data === 'object' && data.buffer;

        if (isBuffer) {
            console.log('[parse-anki-package] Parsing from buffer:', data.fileName);

            // Create temp file from buffer
            tempDir = path.join(os.tmpdir(), 'anki-import-' + Date.now());
            await fs.mkdir(tempDir, { recursive: true });
            tempFilePath = path.join(tempDir, data.fileName);

            // Write buffer to temp file
            const buffer = Buffer.from(data.buffer);
            await fs.writeFile(tempFilePath, buffer);
            console.log('[parse-anki-package] Wrote buffer to temp file:', tempFilePath);
        } else {
            // Legacy: direct file path
            tempFilePath = data;
            console.log('[parse-anki-package] Parsing from path:', tempFilePath);
        }

        // Use require for native modules instead of dynamic import
        // This avoids Rollup bundling issues with native bindings
        const AdmZip = require('adm-zip');
        const Database = require('better-sqlite3');

        // Create extraction directory
        const extractDir = path.join(os.tmpdir(), 'anki-extract-' + Date.now());

        try {
            // Extract .apkg file (it's a ZIP archive)
            const zip = new AdmZip(tempFilePath);
            zip.extractAllTo(extractDir, true);
            console.log('[parse-anki-package] Extracted to:', extractDir);

            // List all extracted files to see what we have
            const extractedFiles = await fs.readdir(extractDir);
            console.log('[parse-anki-package] Extracted files:', extractedFiles.join(', '));

            // Find the database file (usually collection.anki2 or collection.anki21)
            // Prefer .anki21 (newer format) over .anki2 (older format)
            const dbFiles = ['collection.anki21', 'collection.anki2'];
            let dbPath: string | null = null;

            for (const dbFile of dbFiles) {
                const testPath = path.join(extractDir, dbFile);
                if (existsSync(testPath)) {
                    dbPath = testPath;
                    console.log('[parse-anki-package] Found database:', dbFile);
                    break;
                }
            }

            if (!dbPath) {
                throw new Error('No Anki database found in package. Expected collection.anki2 or collection.anki21');
            }

            console.log('[parse-anki-package] Opening database:', dbPath);

            // Open the SQLite database
            const db = new Database(dbPath, { readonly: true, fileMustExist: true });

            // First, let's inspect the database schema to understand the structure
            console.log('[parse-anki-package] Inspecting database schema...');
            try {
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
                console.log('[parse-anki-package] Available tables:', tables.map((t: any) => t.name).join(', '));

                // Check if we have the cards table
                const hasCards = tables.some((t: any) => t.name === 'cards');
                const hasNotes = tables.some((t: any) => t.name === 'notes');

                console.log('[parse-anki-package] Has cards table:', hasCards, 'Has notes table:', hasNotes);

                if (hasNotes) {
                    // Check notes table structure
                    const notesInfo = db.prepare("PRAGMA table_info(notes)").all();
                    console.log('[parse-anki-package] Notes table columns:', notesInfo.map((c: any) => c.name).join(', '));
                }

                if (hasCards) {
                    // Check cards table structure
                    const cardsInfo = db.prepare("PRAGMA table_info(cards)").all();
                    console.log('[parse-anki-package] Cards table columns:', cardsInfo.map((c: any) => c.name).join(', '));
                }
            } catch (schemaError) {
                console.error('[parse-anki-package] Schema inspection error:', schemaError);
            }

            // Get deck name from the decks table
            let deckName = 'Imported Deck';
            try {
                const decksRow = db.prepare('SELECT decks FROM col').get() as { decks: string } | undefined;
                if (decksRow?.decks) {
                    const decksData = JSON.parse(decksRow.decks);
                    // Get the first non-default deck name
                    const deckNames = Object.values(decksData)
                        .filter((d: any) => d.name && d.name !== 'Default')
                        .map((d: any) => d.name);
                    if (deckNames.length > 0) {
                        deckName = deckNames[0] as string;
                    }
                }
            } catch (e) {
                console.warn('[parse-anki-package] Could not extract deck name:', e);
            }

            // Query notes from the database
            // Anki stores notes with fields separated by \x1f (ASCII Unit Separator)
            const notes = db.prepare('SELECT flds, tags FROM notes').all() as Array<{ flds: string; tags: string }>;

            console.log('[parse-anki-package] Found', notes.length, 'notes');

            // Also check cards table to see if there's more data there
            try {
                const cardsCount = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
                console.log('[parse-anki-package] Found', cardsCount.count, 'cards in cards table');

                // Sample a few cards to see their structure
                const sampleCards = db.prepare('SELECT * FROM cards LIMIT 3').all();
                console.log('[parse-anki-package] Sample cards:', JSON.stringify(sampleCards, null, 2));
            } catch (cardsError) {
                console.error('[parse-anki-package] Error checking cards table:', cardsError);
            }

            if (notes.length === 0) {
                // Try alternative: query cards table with note join
                console.log('[parse-anki-package] No notes found, trying cards table...');
                try {
                    const cardsQuery = db.prepare(`
                            SELECT n.flds, n.tags 
                            FROM cards c 
                            JOIN notes n ON c.nid = n.id
                        `).all() as Array<{ flds: string; tags: string }>;

                    console.log('[parse-anki-package] Found', cardsQuery.length, 'cards via join');

                    if (cardsQuery.length === 0) {
                        db.close();
                        if (tempDir && existsSync(tempDir)) {
                            await fs.rm(tempDir, { recursive: true, force: true });
                        }
                        return {
                            success: false,
                            error: 'No cards found in the Anki package.'
                        };
                    }
                    notes.push(...cardsQuery);
                } catch (joinError) {
                    console.error('[parse-anki-package] Cards table query failed:', joinError);
                    db.close();
                    if (tempDir && existsSync(tempDir)) {
                        await fs.rm(tempDir, { recursive: true, force: true });
                    }
                    return {
                        success: false,
                        error: 'No cards found in the Anki package.'
                    };
                }
            }

            // Parse notes into flashcards
            const cards = notes.map((note: { flds: string; tags: string }, index: number) => {
                // Split fields by \x1f separator
                const fields = note.flds.split('\x1f');

                // Log first few cards for debugging
                if (index < 3) {
                    console.log('[parse-anki-package] Card', index, 'has', fields.length, 'fields:');
                    fields.forEach((field, i) => {
                        console.log(`  Field ${i}: "${field.substring(0, 100)}" (length: ${field.length})`);
                    });
                }

                // Most Anki cards have at least 2 fields: front and back
                // But some note types have more fields or different order
                // Try to find the first two non-empty fields
                const nonEmptyFields = fields.filter(f => f.trim().length > 0);

                const front = nonEmptyFields[0] || '';
                const back = nonEmptyFields[1] || '';

                return {
                    front: front.trim(),
                    back: back.trim(),
                    tags: note.tags || ''
                };
            }).filter((card: { front: string; back: string }, index: number) => {
                const isValid = card.front && card.back;
                if (!isValid && index < 3) {
                    console.log('[parse-anki-package] Card', index, 'filtered out - front:', card.front?.length || 0, 'back:', card.back?.length || 0);
                }
                return isValid;
            }); // Filter out empty cards

            db.close();

            // Clean up temp directories
            await fs.rm(extractDir, { recursive: true, force: true });
            if (tempDir && existsSync(tempDir)) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }

            console.log('[parse-anki-package] Successfully parsed', cards.length, 'cards from', notes.length, 'notes');

            if (cards.length === 0) {
                return {
                    success: false,
                    error: 'No valid cards found after parsing. Cards may be empty or in an unsupported format.'
                };
            }

            return {
                success: true,
                deckName,
                cards
            };

        } catch (dbError) {
            // Clean up temp directories on error
            try {
                if (existsSync(extractDir)) {
                    await fs.rm(extractDir, { recursive: true, force: true });
                }
                if (tempDir && existsSync(tempDir)) {
                    await fs.rm(tempDir, { recursive: true, force: true });
                }
            } catch { /* ignore cleanup errors */ }
            throw dbError;
        }

    } catch (e) {
        console.error('[parse-anki-package] Error:', e);
        return {
            success: false,
            error: 'Failed to parse Anki package: ' + (e as Error).message
        };
    }
});

// ============================================================================
// @ CONNECTIONS - Add/Remove @mentions from file content
// ============================================================================

// Add a @connection (mention) to a file
ipcMain.handle('add-connection-to-file', async (_, { filePath, fileType, targetFileName }) => {
    try {
        if (!existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }

        const content = await fs.readFile(filePath, 'utf-8');
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            // For plain text files (notes)
            parsed = { content };
        }

        // Format mention - quote if contains spaces
        const mention = targetFileName.includes(' ')
            ? `@"${targetFileName}"`
            : `@${targetFileName}`;

        // Add mention based on file type
        if (fileType === 'exec') {
            // For notebooks, add to the first cell's content or create a connections note
            if (parsed.cells && parsed.cells.length > 0) {
                // Add to first cell, prepending with newline if cell has content
                const firstCell = parsed.cells[0];
                if (firstCell.content && firstCell.content.trim()) {
                    firstCell.content = firstCell.content + '\n' + mention;
                } else {
                    firstCell.content = mention;
                }
            } else {
                // Create first cell with mention
                parsed.cells = [{
                    id: crypto.randomUUID(),
                    type: 'code',
                    content: mention,
                    createdAt: new Date().toISOString(),
                }];
            }
        } else if (fileType === 'board') {
            // For boards, add a text note with the mention
            if (!parsed.notes) parsed.notes = [];

            // Check if there's already a "Connections" note
            const connectionsNote = parsed.notes.find((n: any) =>
                n.type === 'text' && n.text && n.text.startsWith('📌 Connections:')
            );

            if (connectionsNote) {
                // Append to existing connections note
                connectionsNote.text = connectionsNote.text + '\n' + mention;
            } else {
                // Create a new connections note in top-left corner
                parsed.notes.push({
                    id: crypto.randomUUID(),
                    type: 'text',
                    text: '📌 Connections:\n' + mention,
                    x: 50,
                    y: 50,
                    width: 200,
                    height: 100,
                    color: '#3b82f6',
                    fontSize: 14,
                });
            }
        } else if (fileType === 'nbm') {
            // For node maps, store connections in a dedicated array
            if (!parsed.connections) parsed.connections = [];

            // Check if this connection already exists
            if (!parsed.connections.includes(mention)) {
                parsed.connections.push(mention);
            }
        } else {
            // For plain notes, append to content
            if (typeof parsed.content === 'string') {
                if (parsed.content.trim()) {
                    parsed.content = parsed.content + '\n' + mention;
                } else {
                    parsed.content = mention;
                }
            } else {
                parsed.content = mention;
            }
        }

        // Save the updated content
        await atomicWriteFile(filePath, JSON.stringify(parsed, null, 2));
        return { success: true, mention };

    } catch (e) {
        console.error('Failed to add connection to file:', e);
        return { success: false, error: (e as Error).message };
    }
});

// Remove a @connection (mention) from a file
ipcMain.handle('remove-connection-from-file', async (_, { filePath, fileType, mentionText }) => {
    try {
        if (!existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }

        const content = await fs.readFile(filePath, 'utf-8');
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            parsed = { content };
        }

        // Helper to remove mention from text
        const removeMention = (text: string): string => {
            if (!text) return text;
            // Remove the mention and any preceding/trailing newline
            return text
                .split('\n')
                .filter(line => !line.includes(mentionText))
                .join('\n')
                .trim();
        };

        // Remove mention based on file type
        if (fileType === 'exec') {
            // For notebooks, search through all cells
            if (parsed.cells) {
                for (const cell of parsed.cells) {
                    if (cell.content && cell.content.includes(mentionText)) {
                        cell.content = removeMention(cell.content);
                    }
                }
            }
        } else if (fileType === 'board') {
            // For boards, search through notes
            if (parsed.notes) {
                for (const note of parsed.notes) {
                    if (note.type === 'text' && note.text && note.text.includes(mentionText)) {
                        note.text = removeMention(note.text);
                        // Remove the whole note if it's now empty or just the header
                        if (note.text === '📌 Connections:' || !note.text.trim()) {
                            parsed.notes = parsed.notes.filter((n: any) => n.id !== note.id);
                        }
                    }
                }
            }
        } else if (fileType === 'nbm') {
            // For node maps, remove from connections array
            if (parsed.connections && Array.isArray(parsed.connections)) {
                parsed.connections = parsed.connections.filter((c: string) => c !== mentionText);
            }
        } else {
            // For plain notes
            if (typeof parsed.content === 'string') {
                parsed.content = removeMention(parsed.content);
            }
        }

        // Save the updated content
        await atomicWriteFile(filePath, JSON.stringify(parsed, null, 2));
        return { success: true };

    } catch (e) {
        console.error('Failed to remove connection from file:', e);
        return { success: false, error: (e as Error).message };
    }
});

// Fortnite Creator Codes Configuration
ipcMain.handle('get-creator-codes', () => deviceSettings.creatorCodes || []);
ipcMain.handle('set-creator-codes', async (_, codes) => {
    deviceSettings.creatorCodes = codes;
    await saveDeviceSettings();
    return { success: true };
});

// Version IPC Handler
ipcMain.handle('get-current-version', () => {
    return app.getVersion();
});

ipcMain.handle('open-devtools', () => {
    if (win) {
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools();
        }
    }
});

ipcMain.handle('force-migration', async () => {
    try {
        const thoughtsPlusPath = path.join(oneDrivePath, 'ThoughtsPlus');
        const calendarPlusPath = path.join(oneDrivePath, 'A - CalendarPlus');

        console.log('FORCE MIGRATION REQUESTED');
        console.log(`  Source: ${calendarPlusPath}`);
        console.log(`  Target: ${thoughtsPlusPath}`);

        if (!existsSync(calendarPlusPath)) {
            return { success: false, error: 'Legacy "A - CalendarPlus" folder not found.' };
        }

        if (!existsSync(thoughtsPlusPath)) {
            await fs.mkdir(thoughtsPlusPath, { recursive: true });
        }

        const files = await fs.readdir(calendarPlusPath);
        let copyCount = 0;

        for (const file of files) {
            const src = path.join(calendarPlusPath, file);
            const dest = path.join(thoughtsPlusPath, file);

            // Only copy files (json data), skip directories to be safe
            const stat = await fs.stat(src);
            if (stat.isFile()) {
                await fs.copyFile(src, dest);
                console.log(`  Copied legacy file: ${file}`);

                // Special handling for device settings if they were stored differently in older versions
                if (file === 'device-settings.json' || file === 'settings.json') {
                    console.log(`  Analyzing migrated ${file} for preferences...`);
                    try {
                        const migratedSettings = JSON.parse(await fs.readFile(dest, 'utf-8'));
                        let updated = false;

                        // Migrate User Name
                        if (migratedSettings.customUserName || migratedSettings.userName) {
                            deviceSettings.customUserName = migratedSettings.customUserName || migratedSettings.userName;
                            updated = true;
                        }

                        // Migrate API Key
                        if (migratedSettings.apiKey) {
                            deviceSettings.apiKey = migratedSettings.apiKey;
                            updated = true;
                        }

                        // Migrate GitHub
                        if (migratedSettings.githubUsername) {
                            deviceSettings.githubUsername = migratedSettings.githubUsername;
                            updated = true;
                        }

                        // Migrate Creator Codes
                        if (migratedSettings.creatorCodes) {
                            deviceSettings.creatorCodes = migratedSettings.creatorCodes;
                            updated = true;
                        }

                        if (updated) {
                            await saveDeviceSettings();
                            console.log('  Applied migrated preferences to active device settings.');
                        }

                    } catch (parseErr) {
                        console.warn('  Failed to parse migrated settings file:', parseErr);
                    }
                }

                copyCount++;
            }
        }

        // Force reload of settings to pick up new paths
        currentDataPath = path.join(thoughtsPlusPath, 'calendar-data.json');
        globalSettingsPath = path.join(thoughtsPlusPath, 'settings.json');

        return { success: true, count: copyCount };
    } catch (e: any) {
        console.error('Force migration failed:', e);
        return { success: false, error: e.message };
    }
});
}

// User-friendly error message mapping
function getFriendlyErrorMessage(error: any, provider: AIProvider): string {
    const message = error?.message || error?.toString() || 'Unknown error';

    // Network errors
    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo') || message.includes('network')) {
        return 'Unable to connect to the internet. Please check your connection and try again.';
    }
    if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
        return 'The request timed out. Please check your internet connection and try again.';
    }
    if (message.includes('ECONNREFUSED') || message.includes('ECONNRESET')) {
        return 'Connection was refused or reset. Please try again in a moment.';
    }

    // Geographic restrictions (Gemini specific)
    if (message.includes('User location is not supported') || message.includes('not supported for the API use')) {
        if (provider === 'gemini') {
            return 'Google Gemini is not available in your region. Please use Perplexity instead.';
        }
        return 'This AI service is not available in your region. Please try a different provider.';
    }

    // Rate limiting
    if (message.includes('429') || message.includes('Resource has been exhausted') || message.includes('quota') || message.includes('rate limit') || message.includes('Rate limit')) {
        return 'You\'ve made too many requests. Please wait a minute and try again.';
    }

    // Authentication errors
    if (message.includes('401') || message.includes('Unauthorized') || message.includes('Invalid API key') || message.includes('invalid_api_key')) {
        return 'Invalid API key. Please double-check your key and make sure it\'s entered correctly.';
    }
    if (message.includes('403') || message.includes('Forbidden') || message.includes('permission')) {
        return 'Access denied. Your API key may not have permission for this feature.';
    }

    // Billing/payment issues
    if (message.includes('billing') || message.includes('payment') || message.includes('insufficient_quota') || message.includes('exceeded')) {
        return 'Your API account needs attention. Please check your billing settings or usage limits.';
    }

    // Model not found
    if (message.includes('404') || message.includes('not found') || message.includes('does not exist')) {
        return 'The AI model is temporarily unavailable. Please try again later.';
    }

    // Server errors
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504') || message.includes('Internal server error')) {
        return `The ${provider === 'gemini' ? 'Google' : provider === 'openai' ? 'OpenAI' : 'Perplexity'} servers are experiencing issues. Please try again later.`;
    }

    // Content safety
    if (message.includes('safety') || message.includes('blocked') || message.includes('content policy') || message.includes('filtered')) {
        return 'The request was blocked by content safety filters. Please try rephrasing your request.';
    }

    // Context length
    if (message.includes('context length') || message.includes('too long') || message.includes('max_tokens') || message.includes('maximum')) {
        return 'Your request was too long. Please try with less content.';
    }

    // Generic fallback with provider context
    return `Something went wrong with ${provider === 'gemini' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'Perplexity'}. Please try again or switch to a different AI provider.`;
}

// Generate with OpenAI/Perplexity (OpenAI-compatible API)
async function generateWithOpenAI(apiKey: string, prompt: string, provider: 'openai' | 'perplexity' | 'openrouter'): Promise<string> {
    const baseURL = provider === 'perplexity'
        ? 'https://api.perplexity.ai'
        : provider === 'openrouter'
            ? 'https://openrouter.ai/api/v1'
            : undefined;
    const model = provider === 'perplexity'
        ? 'sonar'
        : provider === 'openrouter'
            ? 'google/gemma-2-9b-it:free'
            : 'gpt-4o-mini';

    const client = new OpenAI({
        apiKey,
        baseURL
    });

    const logMsg = JSON.stringify(`[AI] Attempting AI generation with ${provider} model: ${model}`);
    win?.webContents.executeJavaScript(`console.log(${logMsg})`).catch(() => { });

    try {
        const completion = await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1024,
        });

        return completion.choices[0]?.message?.content || '';
    } catch (e: any) {
        const errorMsg = JSON.stringify(`[AI] ${provider} failed: ${e.message}`);
        win?.webContents.executeJavaScript(`console.error(${errorMsg})`).catch(() => { });
        throw new Error(getFriendlyErrorMessage(e, provider));
    }
}

// Helper function to try multiple Gemini models
async function generateWithGemini(genAI: GoogleGenerativeAI, prompt: string): Promise<string> {
    // DEV MODE: Simulate region block for Gemini
    const devSimulateRegionBlock = await win?.webContents.executeJavaScript(
        `localStorage.getItem('dev_simulate_region_block') === 'true'`
    ).catch(() => false);

    if (devSimulateRegionBlock) {
        console.log('DEV MODE: Simulating Gemini region restriction in content generation');
        throw new Error('User location is not supported for the API use');
    }

    // Use Gemini 2.5 models available on the free tier
    const models = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite"
    ];

    let lastError;
    for (const modelName of models) {
        try {
            // Log to renderer console for visibility (safely escaped)
            const logMsg = JSON.stringify(`[AI] Attempting AI generation with model: ${modelName}`);
            win?.webContents.executeJavaScript(`console.log(${logMsg})`).catch(() => { });

            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e: any) {
            // Log error to renderer console (safely escaped)
            const errorMsg = JSON.stringify(`[AI] Model ${modelName} failed: ${e.message}`);
            win?.webContents.executeJavaScript(`console.error(${errorMsg})`).catch(() => { });

            console.error(`Model ${modelName} failed:`, e.message);
            lastError = e;

            // Check for critical errors that should stop immediately
            const friendlyError = getFriendlyErrorMessage(e, 'gemini');
            if (e.message && (
                e.message.includes('429') ||
                e.message.includes('Resource has been exhausted') ||
                e.message.includes('quota') ||
                e.message.includes('401') ||
                e.message.includes('API key') ||
                e.message.includes('User location is not supported') ||
                e.message.includes('not supported for the API use')
            )) {
                throw new Error(friendlyError);
            }
        }
    }

    // If all models failed, throw friendly error
    throw new Error(getFriendlyErrorMessage(lastError, 'gemini'));
}

// Check if error is a rate limit / quota exhaustion error
function isQuotaError(error: any): boolean {
    const message = error?.message || '';
    return message.includes('429') ||
        message.includes('Resource has been exhausted') ||
        message.includes('quota') ||
        message.includes('rate limit') ||
        message.includes('Rate limit') ||
        message.includes('insufficient_quota') ||
        message.includes('exceeded');
}

// Log a fallback event
async function logFallbackEvent(from: AIProvider, to: AIProvider, reason: string) {
    if (!deviceSettings.fallbackEvents) {
        deviceSettings.fallbackEvents = [];
    }

    const event: FallbackEvent = {
        timestamp: new Date().toISOString(),
        fromProvider: from,
        toProvider: to,
        reason
    };

    deviceSettings.fallbackEvents.push(event);

    // Keep only last 50 events
    if (deviceSettings.fallbackEvents.length > 50) {
        deviceSettings.fallbackEvents = deviceSettings.fallbackEvents.slice(-50);
    }

    await saveDeviceSettings();

    // Notify renderer about the fallback
    const msg = JSON.stringify(`[AI] Fallback: Switched from ${from} to ${to} - ${reason}`);
    win?.webContents.executeJavaScript(`console.warn(${msg})`).catch(() => { });

    // Send event to renderer for UI notification
    win?.webContents.send('ai-fallback-event', event);
}

// Try generation with a specific provider config
async function tryProvider(config: ProviderConfig, prompt: string): Promise<string> {
    switch (config.provider) {
        case 'openai':
            return generateWithOpenAI(config.apiKey, prompt, 'openai');
        case 'perplexity':
            return generateWithOpenAI(config.apiKey, prompt, 'perplexity');
        case 'openrouter':
            return generateWithOpenAI(config.apiKey, prompt, 'openrouter');
        case 'gemini':
        default:
            const genAI = new GoogleGenerativeAI(config.apiKey);
            return generateWithGemini(genAI, prompt);
    }
}

// Universal AI generation function that routes to the correct provider with fallback support
async function generateAIContent(prompt: string): Promise<string> {
    const multiProviderEnabled = deviceSettings.multiProviderEnabled || false;

    // If multi-provider is enabled, use fallback logic
    if (multiProviderEnabled) {
        const configs: ProviderConfig[] = (deviceSettings.providerConfigs || [])
            .filter((c: ProviderConfig) => c.enabled && c.apiKey)
            .map((c: ProviderConfig) => ({
                ...c,
                apiKey: decryptString(c.apiKey) // Decrypt before use
            }))
            .sort((a: ProviderConfig, b: ProviderConfig) => a.priority - b.priority);

        if (configs.length === 0) {
            throw new Error('No AI providers configured. Please add at least one API key in Settings.');
        }

        let lastError: any = null;

        for (let i = 0; i < configs.length; i++) {
            const config = configs[i];
            try {
                return await tryProvider(config, prompt);
            } catch (e: any) {
                lastError = e;

                // If this is a quota/rate limit error and we have more providers, try next
                if (isQuotaError(e) && i < configs.length - 1) {
                    const nextConfig = configs[i + 1];
                    await logFallbackEvent(
                        config.provider,
                        nextConfig.provider,
                        'Rate limit or quota exceeded'
                    );
                    continue;
                }

                // For other errors (invalid key, region blocked), also try next provider
                if (i < configs.length - 1) {
                    const nextConfig = configs[i + 1];
                    await logFallbackEvent(
                        config.provider,
                        nextConfig.provider,
                        e.message || 'Provider error'
                    );
                    continue;
                }

                // No more providers to try
                throw new Error(getFriendlyErrorMessage(e, config.provider));
            }
        }

        throw new Error(getFriendlyErrorMessage(lastError, 'gemini'));
    }

    // Single provider mode (legacy)
    const provider = (deviceSettings.aiProvider || 'gemini') as AIProvider;
    const apiKey = decryptString(deviceSettings.apiKey || '');

    if (!apiKey) {
        throw new Error('No API key configured. Please add your API key in Settings.');
    }

    switch (provider) {
        case 'openai':
            return generateWithOpenAI(apiKey, prompt, 'openai');
        case 'perplexity':
            return generateWithOpenAI(apiKey, prompt, 'perplexity');
        case 'openrouter':
            return generateWithOpenAI(apiKey, prompt, 'openrouter');
        case 'gemini':
        default:
            const genAI = new GoogleGenerativeAI(apiKey);
            return generateWithGemini(genAI, prompt);
    }
}

// Enable auto-launch on first run (default behavior)
async function enableAutoLaunchOnFirstRun() {
    // Check if we've already set up auto-launch (stored in device settings)
    if (deviceSettings.autoLaunchInitialized) {
        return;
    }

    // Skip auto-launch setup in development mode
    if (!app.isPackaged) {
        console.log('Development mode - skipping auto-launch setup');
        deviceSettings.autoLaunchInitialized = true;
        await saveDeviceSettings();
        return;
    }

    console.log('First run detected - enabling auto-launch by default');

    try {
        if (isWindowsStore && WindowsStoreAutoLaunch) {
            // Windows Store (APPX) build
            await WindowsStoreAutoLaunch.enable();
            console.log('Windows Store auto-launch enabled');
        } else {
            // Regular build (NSIS installer)
            // Don't specify path - let Electron use the correct executable path
            app.setLoginItemSettings({ openAtLogin: true });
            console.log('Standard auto-launch enabled');
        }

        // Mark as initialized so we don't override user's choice on subsequent runs
        deviceSettings.autoLaunchInitialized = true;
        await saveDeviceSettings();
    } catch (e) {
        console.error('Failed to enable auto-launch on first run:', e);
    }
}

// Initialize app when ready
app.whenReady().then(async () => {
    // In dev mode, copy production data to dev folder first
    await copyProductionToDevFolder();

    await loadSettings();
    setupIpcHandlers(); // Register handlers BEFORE creating window

    // Enable auto-launch by default on first run
    await enableAutoLaunchOnFirstRun();

    createWindow();
});