import { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env file
const envPath = app.isPackaged
    ? path.join(app.getAppPath(), '.env')
    : path.join(__dirname, '../.env');

dotenv.config({ path: envPath });

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null

// Try to detect OneDrive path, fallback to Documents
const oneDrivePath = process.env.OneDrive || path.join(app.getPath('home'), 'OneDrive');
const ONEDRIVE_DATA_PATH = path.join(oneDrivePath, 'ThoughtsPlus', 'calendar-data.json');
const DEFAULT_DATA_PATH = ONEDRIVE_DATA_PATH;
let currentDataPath = DEFAULT_DATA_PATH;

// Device-specific settings (stored locally, not synced)
const DEVICE_SETTINGS_PATH = path.join(app.getPath('userData'), 'device-settings.json');
let deviceSettings: any = {};

// Global settings (synced across devices)
let globalSettingsPath = '';

async function loadSettings() {
    // Load device-specific settings (local)
    try {
        if (existsSync(DEVICE_SETTINGS_PATH)) {
            deviceSettings = JSON.parse(await fs.readFile(DEVICE_SETTINGS_PATH, 'utf-8'));
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
                console.log('🔄 Detected legacy "A - CalendarPlus" folder. Migrating to "ThoughtsPlus"...');
                await fs.mkdir(thoughtsPlusPath, { recursive: true });

                const files = await fs.readdir(calendarPlusPath);
                for (const file of files) {
                    const src = path.join(calendarPlusPath, file);
                    const dest = path.join(thoughtsPlusPath, file);
                    // Only copy files (json data), skip directories to be safe
                    const stat = await fs.stat(src);
                    if (stat.isFile()) {
                        await fs.copyFile(src, dest);
                        console.log(`  ✅ Copied legacy file: ${file}`);
                    }
                }
                console.log('✨ Migration to ThoughtsPlus complete.');
            }
        } catch (migrationErr) {
            console.error('❌ Migration failed:', migrationErr);
            // Continue execution, don't block app startup
        }

        // Potential folder names to search for (prioritize ones with actual data)
        const folderNames = ['ThoughtsPlus', 'A - CalendarPlus', 'A - Calendar Pro', 'CalendarPlus'];

        let targetDir = '';
        let foundExistingData = false;

        log('🔍 Searching for existing data folders...');

        // 1. Search in OneDrive for folders WITH calendar-data.json
        for (const folderName of folderNames) {
            const checkPath = path.join(oneDrivePath, folderName);
            const dataFile = path.join(checkPath, 'calendar-data.json');
            log(`  Checking: ${checkPath}`);
            log(`  Data file exists: ${existsSync(dataFile)}`);
            if (existsSync(dataFile)) {
                targetDir = checkPath;
                foundExistingData = true;
                log(`✅ Found existing data file in OneDrive: ${targetDir}`);
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
                    log(`✅ Found existing data file in Documents: ${targetDir}`);
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
                    log(`✅ Found settings.json in OneDrive: ${targetDir}`);
                    break;
                }
            }
        }

        // 4. Default to OneDrive/CalendarPlus if nothing found
        if (!targetDir) {
            targetDir = path.join(oneDrivePath, 'ThoughtsPlus');
            log(`📁 Using default path: ${targetDir}`);
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

        log(`✅ Final data path: ${currentDataPath}`);

        console.log('----------------------------------------------------------------');
        console.log('📂 DATA STORAGE PATHS');
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
                    console.log('✅ Migrated legacy settings (API Key, User Name, etc)');
                }
            } catch (err) {
                console.warn('⚠️ Could not migrate legacy settings:', err);
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
    let iconPath: string;
    if (process.platform === 'win32') {
        iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'Thoughts+.png')
            : path.join(process.env.VITE_PUBLIC || '', 'Thoughts+.png');
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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// Set app user model ID for Windows to ensure proper taskbar icon
if (process.platform === 'win32') {
    app.setAppUserModelId('com.thoughtsplus.app');
}


// Register all IPC handlers BEFORE app is ready
function setupIpcHandlers() {
    console.log('📡 Setting up IPC handlers...');

    // Error logging from renderer (for debugging APPX issues)
    ipcMain.handle('log-error', (_, errorData) => {
        console.error('❌ Renderer Error:', errorData);
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
                    console.log('✅ Taskbar badge set from:', badgePath);
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
        return deviceSettings.apiKey || '';
    });

    ipcMain.handle('set-api-key', async (_, key) => {
        deviceSettings.apiKey = key?.trim();
        await saveDeviceSettings();
        return true;
    });

    ipcMain.handle('validate-api-key', async (_, key) => {
        try {
            if (!key) return { valid: false, error: 'API Key is empty' };
            const cleanKey = key.trim();

            const genAI = new GoogleGenerativeAI(cleanKey);

            try {
                await generateWithFallback(genAI, "Test");
                return { valid: true };
            } catch (e: any) {
                console.error("Validation failed:", e);

                // Try to list models to see what's wrong and log it to the user console
                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
                    );
                    if (response.ok) {
                        const data = await response.json();
                        const available = data.models?.map((m: any) => m.name).join(', ');
                        console.log('Available models for this key:', available);
                        win?.webContents.executeJavaScript(`console.log("ℹ️ Available models for this key: ${available}")`);
                    } else {
                        const err = await response.text();
                        console.error('Failed to list models:', err);
                        win?.webContents.executeJavaScript(`console.error("❌ Failed to list models: ${err}")`);
                    }
                } catch (listErr) {
                    console.error('Failed to list models fetch:', listErr);
                }

                return { valid: false, error: e.message || 'Invalid API Key' };
            }
        } catch (error: any) {
            console.error("API Key Validation Error:", error);
            return { valid: false, error: error.message || 'Validation failed' };
        }
    });

    ipcMain.handle('summarize-text', async (_, text) => {
        try {
            const apiKey = deviceSettings.apiKey || process.env.GEMINI_API_KEY;
            if (!apiKey) return text.slice(0, 50) + '...';

            const genAI = new GoogleGenerativeAI(apiKey);

            try {
                return await generateWithFallback(genAI, text);
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
            const apiKey = deviceSettings.apiKey || process.env.GEMINI_API_KEY;
            console.log('generate-ai-overview called. Has apiKey:', !!apiKey);
            if (!apiKey) return "Please add your AI API key in settings! Make sure not to share it with anyone.";

            const genAI = new GoogleGenerativeAI(apiKey);

            let notesStr = "";
            try {
                notesStr = JSON.stringify(notes);
            } catch (e) {
                return "Error: Could not process notes data.";
            }

            const nameToUse = userName ? userName.split(' ')[0] : 'User';
            const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            const prompt = `
            You are a warm, comforting, and casual personal assistant for ${nameToUse}. 
            Current Date: ${today}.
            Analyze the following notes and provide a briefing.
            
            Guidelines:
            1. **Tone:** Warm, comforting, and casual. Like a supportive friend.
            2. **Structure:**
               - Start with "Deep breaths, ${nameToUse}!" or "Well done, ${nameToUse}..." (place name early).
               - If completed tasks (last 7 days): "Well done for completing...".
               - Immediate tasks: "Make sure to focus on..." (be specific, e.g., "revise cheat sheets").
               - Future/Low Priority: "Also don't forget you have [Task] due on [Date], so no need to worry too much."
            3. **Prioritization:**
               - Mention low priority tasks! But frame them as less urgent (e.g., "not long to wait" or "no need to stress").
               - If overwhelmed, emphasize relaxing.
            4. **Specifics:**
               - Be task specific (pull details from notes).
               - Only congratulate on tasks completed in the last 7 days.
            5. **Constraints:**
               - Do NOT start with "Here is your briefing".
               - Keep strictly under 80 words.
               - Use British English.
               - Use **bold** for key words.
            
            Here are the notes:
            ${notesStr}
            `;

            try {
                return await generateWithFallback(genAI, prompt);
            } catch (error: any) {
                console.warn(`All models failed:`, error.message);
                return "AI cap limit reached, sorry!";
            }
        } catch (error: any) {
            console.error("Gemini API Error:", error);
            return "AI cap limit reached, sorry!";
        }
    });

    ipcMain.handle('parse-natural-language-note', async (_, input, generateDescriptions = false) => {
        try {
            const apiKey = deviceSettings.apiKey || process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return {
                    error: 'API_KEY_MISSING',
                    message: 'Please configure your Gemini API key in Settings'
                };
            }

            const genAI = new GoogleGenerativeAI(apiKey);

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
                const text = await generateWithFallback(genAI, prompt);
                // Clean up potential markdown code blocks
                const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(jsonStr);

                // Validate the parsed response
                if (!parsed.title || !parsed.date) {
                    throw new Error('Invalid response structure');
                }

                return parsed;
            } catch (error: any) {
                console.warn(`All models failed:`, error.message);
                return {
                    error: 'PARSE_ERROR',
                    message: error.message || 'AI service temporarily unavailable.'
                };
            }
        } catch (error: any) {
            console.error("Gemini Parse Error:", error);
            return {
                error: 'PARSE_ERROR',
                message: 'Internal Application Error. Please check logs.'
            };
        }
    });

    ipcMain.handle('get-creator-stats', async () => {
        win?.webContents.executeJavaScript(`console.log("🚀 Fetching all Fortnite metrics + history...")`);
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
                win?.webContents.executeJavaScript(`console.log("✅ ${metric}: ${total}")`);
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
                win?.webContents.executeJavaScript(`console.log("💾 Saved week ${weekKey} snapshot")`);
            } else {
                win?.webContents.executeJavaScript(`console.log("ℹ️ Week ${weekKey} already recorded - using cached data")`);
            }

            const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();
            win?.webContents.executeJavaScript(`console.log("📊 All-time: ${fmt(history.allTime.minutesPlayed)} min, ${fmt(history.allTime.uniquePlayers)} players, ${fmt(history.allTime.favorites)} favs, ${fmt(history.allTime.plays)} plays")`);

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
            win?.webContents.executeJavaScript(`console.error("❌ ${e.message}")`);
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

            log('📂 Reading data from: ' + currentDataPath);
            log('📂 File exists: ' + existsSync(currentDataPath));

            // Check for legacy migration if current data doesn't exist
            if (!existsSync(currentDataPath)) {
                log('🔄 Attempting legacy data migration...');
                await tryMigrateLegacyData();
            }

            if (!existsSync(currentDataPath)) {
                log('❌ No data file found, returning empty');
                return { notes: {} };
            }

            const rawData = JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
            log('📥 Raw data loaded. Has notes? ' + !!rawData.notes);
            log('📊 Raw notes keys: ' + (rawData.notes ? Object.keys(rawData.notes).length : 0));

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
                        log('✅ Fixed date ' + dateKey + ': wrapped single note in array');
                    }
                    // If it's an empty string or invalid, create empty array
                    else {
                        fixedNotes[dateKey] = [];
                        if (value !== '' && value.length !== 0) {
                            needsFixing = true;
                            log('⚠️ Fixed date ' + dateKey + ': replaced invalid value with empty array');
                        }
                    }
                }

                log('✅ Total fixed notes: ' + Object.keys(fixedNotes).length);
                rawData.notes = fixedNotes;

                // Save the fixed version back to disk
                if (needsFixing) {
                    log('💾 Normalized calendar-data.json structure. Saving...');
                    await fs.writeFile(currentDataPath, JSON.stringify(rawData, null, 2));
                    log('✅ Fixed data saved successfully.');
                }
            }

            log('📤 Returning data with ' + Object.keys(rawData.notes || {}).length + ' note dates');
            return rawData;
        } catch (e) {
            const errMsg = '❌ Error loading data: ' + (e as Error).message;
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

            log(`🔄 Data folder selected via dialog`);
            log(`🔄 Data path changed from: ${oldPath}`);
            log(`🔄 Data path changed to: ${currentDataPath}`);
            log(`🔄 Global settings path: ${globalSettingsPath}`);
            log(`📂 File exists at new location: ${existsSync(currentDataPath)}`);

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

        log(`🔄 Data path changed from: ${oldPath}`);
        log(`🔄 Data path changed to: ${currentDataPath}`);
        log(`🔄 Global settings path: ${globalSettingsPath}`);
        log(`📂 File exists at new location: ${existsSync(currentDataPath)}`);

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
                log(`🔄 Data path updated from: ${oldPath}`);
                log(`🔄 Data path updated to: ${currentDataPath}`);
                log(`🔄 Global settings path updated to: ${globalSettingsPath}`);
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

    ipcMain.handle('get-github-token', () => deviceSettings.githubToken || '');
    ipcMain.handle('set-github-token', async (_, token) => {
        deviceSettings.githubToken = token;
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

            console.log('🔄 FORCE MIGRATION REQUESTED');
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
                    console.log(`  ✅ Copied legacy file: ${file}`);

                    // Special handling for device settings if they were stored differently in older versions
                    if (file === 'device-settings.json' || file === 'settings.json') {
                        console.log(`  ℹ️  Analyzing migrated ${file} for preferences...`);
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
                                console.log('  ✅ Applied migrated preferences to active device settings.');
                            }

                        } catch (parseErr) {
                            console.warn('  ⚠️ Failed to parse migrated settings file:', parseErr);
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

// Helper function to try multiple Gemini models
async function generateWithFallback(genAI: GoogleGenerativeAI, prompt: string): Promise<string> {
    // Only use models available on the free tier
    const models = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite"
    ];

    let lastError;
    for (const modelName of models) {
        try {
            // Log to renderer console for visibility (safely escaped)
            const logMsg = JSON.stringify(`🤖 Attempting AI generation with model: ${modelName}`);
            win?.webContents.executeJavaScript(`console.log(${logMsg})`).catch(() => { });

            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e: any) {
            // Log error to renderer console (safely escaped)
            const errorMsg = JSON.stringify(`❌ Model ${modelName} failed: ${e.message}`);
            win?.webContents.executeJavaScript(`console.error(${errorMsg})`).catch(() => { });

            console.error(`Model ${modelName} failed:`, e.message);
            lastError = e;

            // Check if this is a rate limit error (429) - if so, stop trying other models
            if (e.message && (e.message.includes('429') || e.message.includes('Resource has been exhausted') || e.message.includes('quota'))) {
                console.error('⚠️ Rate limit detected - stopping model fallback to preserve quota');
                throw new Error('API rate limit reached. Please wait a moment and try again.');
            }

            // Check if this is an authentication error - if so, stop trying
            if (e.message && (e.message.includes('401') || e.message.includes('API key'))) {
                throw new Error('Invalid API key. Please check your settings.');
            }

            // For 404 errors (model not found), continue to next model
            // @ts-ignore
            if (!global.aiErrors) global.aiErrors = [];
            // @ts-ignore
            global.aiErrors.push(`${modelName}: ${e.message}`);
        }
    }

    // Construct detailed error message
    // @ts-ignore
    const details = global.aiErrors ? global.aiErrors.join('\n') : lastError?.message;
    // @ts-ignore
    global.aiErrors = []; // Reset

    // Throw a detailed error for debugging
    throw new Error(`AI service unavailable. Errors:\n${details}`);
}

// Initialize app when ready
app.whenReady().then(async () => {
    await loadSettings();
    setupIpcHandlers(); // Register handlers BEFORE creating window
    createWindow();
});