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
const DEV_FOLDER_NAME = 'ThoughtsPlus-Dev';
const PROD_FOLDER_NAME = 'ThoughtsPlus';

// Try to detect OneDrive path, fallback to Documents
const oneDrivePath = process.env.OneDrive || path.join(app.getPath('home'), 'OneDrive');

// Use dev folder in dev mode, production folder in production
const DATA_FOLDER_NAME = IS_DEV_MODE ? DEV_FOLDER_NAME : PROD_FOLDER_NAME;
const ONEDRIVE_DATA_PATH = path.join(oneDrivePath, DATA_FOLDER_NAME, 'calendar-data.json');
const DEFAULT_DATA_PATH = ONEDRIVE_DATA_PATH;
let currentDataPath = DEFAULT_DATA_PATH;

// Production data path (for copying to dev)
const PROD_DATA_FOLDER = path.join(oneDrivePath, PROD_FOLDER_NAME);
const PROD_DATA_PATH = path.join(PROD_DATA_FOLDER, 'calendar-data.json');

// Device-specific settings (stored locally, not synced)
// NOTE: This persists in AppData\Roaming\thoughts-plus\device-settings.json and survives app uninstall
// To fully reset for testing: Delete %AppData%\Roaming\thoughts-plus folder
const DEVICE_SETTINGS_PATH = path.join(app.getPath('userData'), 'device-settings.json');
let deviceSettings: any = {};

// Global settings (synced across devices)
let globalSettingsPath = '';

// Copy production data to dev folder
async function copyProductionToDevFolder(): Promise<void> {
    if (!IS_DEV_MODE) return;

    const devDataFolder = path.join(oneDrivePath, DEV_FOLDER_NAME);
    const devDataPath = path.join(devDataFolder, 'calendar-data.json');

    console.log('================================================================');
    console.log('🔧 DEV MODE: Data Isolation Active');
    console.log('================================================================');
    console.log(`Production folder: ${PROD_DATA_FOLDER}`);
    console.log(`Dev folder: ${devDataFolder}`);

    try {
        // Create dev folder if it doesn't exist
        if (!existsSync(devDataFolder)) {
            await fs.mkdir(devDataFolder, { recursive: true });
            console.log('Created dev data folder');
        }

        // Copy production data to dev folder if dev data doesn't exist or is older
        if (existsSync(PROD_DATA_PATH)) {
            let shouldCopy = !existsSync(devDataPath);

            if (!shouldCopy && existsSync(devDataPath)) {
                // Check if dev file is suspiciously small (might be corrupted)
                const devStat = await fs.stat(devDataPath);

                // Also copy if dev file is suspiciously small (might be corrupted)
                if (devStat.size < 100) {
                    console.log('⚠️ Dev data file is very small, likely corrupted. Copying from production...');
                    shouldCopy = true;
                }
            }

            if (shouldCopy) {
                // Copy all JSON files from production to dev
                const files = await fs.readdir(PROD_DATA_FOLDER);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const src = path.join(PROD_DATA_FOLDER, file);
                        const dest = path.join(devDataFolder, file);
                        const stat = await fs.stat(src);
                        if (stat.isFile()) {
                            await fs.copyFile(src, dest);
                            console.log(`✅ Copied to dev: ${file} (${Math.round(stat.size / 1024)} KB)`);
                        }
                    }
                }
                console.log('Production data copied to dev folder for testing');
            } else {
                console.log('Dev folder already has data, using existing');
            }
        } else {
            console.log('No production data found to copy');
        }
    } catch (err) {
        console.error('Failed to copy production data to dev folder:', err);
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

        // Potential folder names to search for (prioritize ones with actual data)
        const folderNames = ['ThoughtsPlus', 'A - CalendarPlus', 'A - Calendar Pro', 'CalendarPlus'];

        let targetDir = '';
        let foundExistingData = false;

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
        if (!foundExistingData) {
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

        // 4. Default to OneDrive/CalendarPlus if nothing found
        if (!targetDir) {
            targetDir = path.join(oneDrivePath, 'ThoughtsPlus');
            log(`Using default path: ${targetDir}`);
        }

        if (!existsSync(targetDir)) {
            await fs.mkdir(targetDir, { recursive: true });
        }

        globalSettingsPath = path.join(targetDir, 'settings.json');

        if (existsSync(globalSettingsPath)) {
            const settings = JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
            if (settings.dataPath) {
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
        webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
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
                        // Bring window to front
                        if (win.isMinimized()) win.restore();
                        win.show();
                        win.focus();
                        // Send event to renderer to open quick capture
                        win.webContents.send('open-quick-capture');
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
                            if (win.isMinimized()) win.restore();
                            win.show();
                            win.focus();
                            win.webContents.send('open-quick-capture');
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
                        if (win.isMinimized()) win.restore();
                        win.show();
                        win.focus();
                        win.webContents.send('open-quick-capture');
                    }
                });
                if (registered) {
                    currentHotkey = hotkey;
                    console.log('Global hotkey initialized:', hotkey);
                }
            } catch (e) {
                console.warn('Failed to initialize global hotkey:', e);
            }
        }
    }, 1000); // Small delay to ensure window is ready

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
                return await generateAIContent(prompt);
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
                    await fs.writeFile(currentDataPath, JSON.stringify(rawData, null, 2));
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

    ipcMain.handle('save-data', async (_, data) => {
        try {
            const dir = path.dirname(currentDataPath);
            if (!existsSync(dir)) {
                await fs.mkdir(dir, { recursive: true });
            }
            await fs.writeFile(currentDataPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (e) { return { success: false, error: e }; }
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
        try {
            if (!existsSync(currentDataPath)) return null;
            const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
            return data.drawing || null;
        } catch { return null; }
    });

    ipcMain.handle('save-drawing', async (_, drawingData) => {
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
            await fs.writeFile(currentDataPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (e) { return { success: false, error: e }; }
    });

    ipcMain.handle('get-boards', async () => {
        try {
            if (!existsSync(currentDataPath)) return null;
            const data = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
            return data.boards || null;
        } catch { return null; }
    });

    ipcMain.handle('save-boards', async (_, boardsData) => {
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
            await fs.writeFile(currentDataPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (e) { return { success: false, error: e }; }
    });

    ipcMain.handle('get-auto-launch', () => app.getLoginItemSettings().openAtLogin);
    ipcMain.handle('set-auto-launch', (_, openAtLogin) => {
        app.setLoginItemSettings({ openAtLogin, path: app.getPath('exe') });
        return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('open-external', async (_, url) => {
        await shell.openExternal(url);
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

// Initialize app when ready
app.whenReady().then(async () => {
    // In dev mode, copy production data to dev folder first
    await copyProductionToDevFolder();

    await loadSettings();
    setupIpcHandlers(); // Register handlers BEFORE creating window
    createWindow();
});