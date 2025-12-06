import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
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
const ONEDRIVE_DATA_PATH = path.join(oneDrivePath, 'CalendarPlus', 'calendar-data.json');
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

    // Load global settings (from OneDrive folder)
    try {
        const oneDriveDir = path.dirname(ONEDRIVE_DATA_PATH);
        if (!existsSync(oneDriveDir)) {
            await fs.mkdir(oneDriveDir, { recursive: true });
        }
        globalSettingsPath = path.join(oneDriveDir, 'settings.json');
        if (existsSync(globalSettingsPath)) {
            const settings = JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
            if (settings.dataPath) currentDataPath = settings.dataPath;
        } else {
            currentDataPath = ONEDRIVE_DATA_PATH;
        }
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
        const oneDriveDir = path.dirname(ONEDRIVE_DATA_PATH);
        if (!existsSync(oneDriveDir)) {
            await fs.mkdir(oneDriveDir, { recursive: true });
        }
        await fs.writeFile(globalSettingsPath, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('Failed to save global settings', e);
    }
}

function createWindow() {
    // Use the icon from the app resources
    let iconPath: string;
    if (process.platform === 'win32') {
        iconPath = app.isPackaged 
            ? path.join(process.resourcesPath, 'calendar_icon_181520.ico')
            : path.join(process.env.VITE_PUBLIC || '', 'calendar_icon_181520.ico');
    } else {
        iconPath = path.join(process.env.VITE_PUBLIC || '', 'calendar_icon_181520.png');
    }
    
    win = new BrowserWindow({
        width: 1200, height: 900, frame: false, titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#00000000', symbolColor: '#4b5563', height: 30 },
        webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
        backgroundColor: '#00000000',
        icon: iconPath
    })
    Menu.setApplicationMenu(null);
    win.webContents.on('did-finish-load', () => win?.webContents.send('main-process-message', (new Date).toLocaleString()))
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
        win.webContents.openDevTools()
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'index.html'))
    }
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// Set app user model ID for Windows to ensure proper taskbar icon
if (process.platform === 'win32') {
    app.setAppUserModelId('com.calendarplus.app');
}

app.whenReady().then(async () => {
    await loadSettings();
    createWindow();

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
            return path.join(app.getPath('documents'), 'CalendarPlus', 'calendar-data.json');
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
            
            // Test by making a direct fetch request to list models endpoint
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
            );
            
            if (response.ok) {
                const data = await response.json();
                console.log('Available models:', data.models?.map((m: any) => m.name).join(', '));
                return { valid: true };
            } else {
                const errorData = await response.json();
                return { valid: false, error: errorData.error?.message || 'Invalid API Key' };
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
            const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
            const result = await model.generateContent(text);
            return (await result.response).text();
        } catch (error) {
            return text.slice(0, 50) + '...';
        }
    });

    ipcMain.handle('generate-ai-overview', async (_, notes) => {
        try {
            const apiKey = deviceSettings.apiKey || process.env.GEMINI_API_KEY;
            console.log('generate-ai-overview called. Has apiKey:', !!apiKey);
            if (!apiKey) return "Please add your AI API key in settings! Make sure not to share it with anyone.";
            
            const genAI = new GoogleGenerativeAI(apiKey);
            // Use gemini-2.5-flash which is available in v1beta
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash"
            });
            
            const prompt = `
            You are a helpful personal assistant. 
            Analyze the following notes and provide a comforting briefing for the user. 
            Focus on priorities and timelines. 
            Tell the user what to focus on first based on the dates and importance.
            
            For example if there is a revision for a exam in 2 weeks and a society event in 1 week, say roughly something about focus on your society as its the soonest and make sure you are revising everyday for your upcoming exam!
            
            Keep the tone comforting and encouraging.
            IMPORTANT: 
            1. Keep the response strictly under 80 words.
            2. Use **bold** markdown for key words (like event names, dates, or priorities).
            3. Use British English spelling and terminology (e.g. 'colour', 'centre', 'programme', 'organise').
            
            Here are the notes:
            ${JSON.stringify(notes)}
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini API Error:", error);
            return "I'm having trouble generating your briefing right now. Please try again later.";
        }
    });

    ipcMain.handle('parse-natural-language-note', async (_, input) => {
        try {
            const apiKey = deviceSettings.apiKey || process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return {
                    error: 'API_KEY_MISSING',
                    message: 'Please configure your Gemini API key in Settings'
                };
            }
            
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
            
            const now = new Date();
            const prompt = `
            You are a smart calendar assistant.
            Current Date/Time: ${now.toISOString()} (${now.toLocaleDateString('en-GB', { weekday: 'long' })})
            
            User Input: "${input}"
            
            Extract the event details into a JSON object with these fields:
            - title: Short summary (max 5 words). Use British English.
            - descriptionOptions: Generate 3 distinct, helpful, professional, and slightly detailed description options based on the input context. Do not just copy the input. Use British English spelling (e.g. 'colour', 'centre', 'programme', 'organise').
            - date: YYYY-MM-DD format. NOTE: If the user says "next week" without a specific day, assume it means exactly 7 days from today.
            - time: HH:mm format (24h). Default to "09:00" if not specified.
            - importance: "low", "medium", or "high" (infer from urgency/tone)
            
            Return ONLY the JSON object. No markdown formatting.
            `;
            
            const result = await model.generateContent(prompt);
            const text = (await result.response).text();
            // Clean up potential markdown code blocks
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error("Gemini Parse Error:", error);
            return null;
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
            if (!existsSync(currentDataPath)) return { notes: {} };
            return JSON.parse(await fs.readFile(currentDataPath, 'utf-8'));
        } catch { return { notes: {} }; }
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
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) {
            const newPath = path.join(result.filePaths[0], 'calendar-data.json');
            currentDataPath = newPath;
            await saveGlobalSettings({ dataPath: newPath });
            return newPath;
        }
        return null;
    });

    ipcMain.handle('set-data-path', async (_, newPath) => {
        currentDataPath = newPath;
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
            let settings: any = {};
            if (existsSync(globalSettingsPath)) {
                settings = JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
            }
            settings[key] = value;
            await saveGlobalSettings(settings);
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
})
 
