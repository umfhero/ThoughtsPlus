import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null

const ONEDRIVE_DATA_PATH = 'C:\\Users\\umfhe\\OneDrive - Middlesex University\\CalendarPlus\\calendar-data.json';
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

async function saveDeviceSettings() {
    try {
        await fs.writeFile(DEVICE_SETTINGS_PATH, JSON.stringify(deviceSettings, null, 2));
    } catch (e) {
        console.error('Failed to save device settings', e);
    }
}

async function loadGlobalSettings() {
    try {
        if (existsSync(globalSettingsPath)) {
            return JSON.parse(await fs.readFile(globalSettingsPath, 'utf-8'));
        }
        return {};
    } catch (e) {
        console.error('Failed to load global settings', e);
        return {};
    }
}

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
        width: 1200, height: 800, frame: false, titleBarStyle: 'hidden',
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

    ipcMain.handle('summarize-text', async (_, text) => {
        try {
            if (!process.env.GEMINI_API_KEY) return text.slice(0, 50) + '...';
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(text);
            return (await result.response).text();
        } catch (error) {
            return text.slice(0, 50) + '...';
        }
    });

    ipcMain.handle('get-creator-stats', async () => {
        win?.webContents.executeJavaScript(`console.log("🚀 Fetching all Fortnite metrics + history...")`);
        try {
            const codes = ['7891-5057-6642', '3432-9922-9130', '9754-2475-5004', '7835-5469-3381', '8941-4567-5858', '0127-9034-1922', '2559-5465-1064', '7145-9468-2691'];
            const now = new Date();
            const ago7 = new Date(now); ago7.setDate(now.getDate() - 7);
            const from = ago7.toISOString(), to = now.toISOString();

            const metrics = ['minutes-played', 'unique-players', 'favorites', 'plays'];
            const results: any = { minutesPlayed: 0, uniquePlayers: 0, favorites: 0, plays: 0 };

            for (const metric of metrics) {
                const promises = codes.map(async (code) => {
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
                curseforge: { downloads: '2.5M', username: 'umfhe' }
            };
        } catch (e: any) {
            win?.webContents.executeJavaScript(`console.error("❌ ${e.message}")`);
            return { 
                fortnite: { 
                    minutesPlayed: '0', uniquePlayers: '0', favorites: '0', plays: '0',
                    raw: { minutesPlayed: 0, uniquePlayers: 0, favorites: 0, plays: 0 }
                }, 
                curseforge: { downloads: '2.5M', username: 'umfhe' } 
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

    ipcMain.handle('get-auto-launch', () => app.getLoginItemSettings().openAtLogin);
    ipcMain.handle('set-auto-launch', (_, openAtLogin) => {
        app.setLoginItemSettings({ openAtLogin, path: app.getPath('exe') });
        return app.getLoginItemSettings().openAtLogin;
    });

    // Global settings handlers for theme and accent color
    ipcMain.handle('get-global-setting', async (_, key: string) => {
        try {
            const settings = await loadGlobalSettings();
            return settings[key] || null;
        } catch (e) {
            return null;
        }
    });

    ipcMain.handle('save-global-setting', async (_, key: string, value: any) => {
        try {
            const settings = await loadGlobalSettings();
            settings[key] = value;
            await saveGlobalSettings(settings);
            return true;
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle('get-username', () => 'Majid');
})
