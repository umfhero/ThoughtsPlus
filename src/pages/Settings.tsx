import { useState, useEffect } from 'react';
import { Folder, Palette, Sparkles, Check, ExternalLink, Clipboard, AlertCircle, LayoutDashboard, PieChart, Github, PenTool, Calendar as CalendarIcon, Code, RefreshCw, Map, Bell, BellOff, Type, Upload, FileUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { formatICSDate } from '../utils/icsHelper';

interface RoadmapItem {
    task: string;
    status: 'pending' | 'in-progress' | 'completed';
    plannedRelease: string;
}

export function SettingsPage() {
    const [dataPath, setDataPath] = useState<string>('Loading...');
    const [autoLaunch, setAutoLaunch] = useState(false);




    // User Name
    const [userName, setUserName] = useState('');
    const [userNameSaved, setUserNameSaved] = useState(false);

    // API Key State
    const [apiKey, setApiKey] = useState('');
    const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
    const [validationMsg, setValidationMsg] = useState('');

    // GitHub Configuration
    const [githubUsername, setGithubUsername] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [githubSaved, setGithubSaved] = useState(false);

    // Fortnite Creator Codes
    const [creatorCodes, setCreatorCodes] = useState('');
    const [creatorCodesSaved, setCreatorCodesSaved] = useState(false);

    // Feature Toggles
    const [enabledFeatures, setEnabledFeatures] = useState({
        calendar: true,
        drawing: true,
        stats: true,
        github: true,
        aiDescriptions: true
    });

    // Update State
    const [currentVersion, setCurrentVersion] = useState('Loading...');
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle');

    // Roadmap State
    const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
    const [roadmapLoading, setRoadmapLoading] = useState(true);
    const [roadmapError, setRoadmapError] = useState('');

    // Font State
    const [currentFont, setCurrentFont] = useState('Outfit');
    const [customFontFile, setCustomFontFile] = useState<File | null>(null);

    // Calendar Import State
    const [importedEvents, setImportedEvents] = useState<any[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedImportIndices, setSelectedImportIndices] = useState<number[]>([]);

    const { theme, accentColor, setTheme, setAccentColor } = useTheme();
    const { addNotification, isSuppressed, toggleSuppression } = useNotification();

    useEffect(() => {
        checkAutoLaunch();
        loadDataPath();
        loadApiKey();
        loadFeatureToggles();
        loadGithubConfig();
        loadCreatorCodes();
        loadUserName();
        loadCurrentVersion();
        setupUpdateListeners();
        fetchRoadmap();

        // Listen for feature toggle changes from other components (e.g., Quick Note modal)
        const handleFeatureToggleChange = (event: CustomEvent) => {
            const features = event.detail;
            setEnabledFeatures(features);
        };

        window.addEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);

        return () => {
            // Cleanup update listeners
            // @ts-ignore
            window.ipcRenderer.off('update-checking', handleUpdateChecking);
            // @ts-ignore
            window.ipcRenderer.off('update-available', handleUpdateAvailable);
            // @ts-ignore
            window.ipcRenderer.off('update-not-available', handleUpdateNotAvailable);

            // Cleanup feature toggle listener
            window.removeEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);
        };
    }, []);

    const fetchRoadmap = async () => {
        if (import.meta.env.DEV) {
            try {
                const localResponse = await fetch('/ROADMAP.json');
                if (localResponse.ok) {
                    const localData = await localResponse.json();
                    setRoadmap(localData.roadmap);
                    setRoadmapError('');
                    setRoadmapLoading(false);
                    return;
                }
            } catch (e) {
                console.warn('Local fetch failed in dev, falling back to remote...');
            }
        }

        try {
            // Try fetching from GitHub first (Source of Truth)
            const response = await fetch('https://raw.githubusercontent.com/umfhero/CalendarPlus/main/public/ROADMAP.json');
            if (!response.ok) throw new Error('Failed to fetch remote roadmap');
            const data = await response.json();
            setRoadmap(data.roadmap);
            setRoadmapError('');
        } catch (err) {
            console.warn('Failed to load remote roadmap, trying local fallback:', err);
            try {
                // Fallback to local file (for development or if remote is down)
                // In production Electron, this might need adjustment depending on how files are served,
                // but for Vite dev it works perfectly.
                const localResponse = await fetch('/ROADMAP.json');
                if (!localResponse.ok) throw new Error('Failed to fetch local roadmap');
                const localData = await localResponse.json();
                setRoadmap(localData.roadmap);
                setRoadmapError('');
            } catch (localErr) {
                console.error('Failed to load local roadmap:', localErr);
                setRoadmapError('Could not load roadmap from GitHub (and local fallback failed). Please ensure you are connected to the internet.');
            }
        } finally {
            setRoadmapLoading(false);
        }
    };

    useEffect(() => {
        // Load persist font
        const savedFont = localStorage.getItem('app-font');
        if (savedFont) {
            setCurrentFont(savedFont);
            document.documentElement.style.setProperty('--app-font', savedFont);
            document.body.style.fontFamily = `"${savedFont}", sans-serif`;
        }

        checkAutoLaunch();
        fetchRoadmap();
    }, []);


    const loadDataPath = async () => {
        // @ts-ignore
        const path = await window.ipcRenderer.invoke('get-current-data-path');
        if (path) {
            setDataPath(path);
        }
    };

    const loadApiKey = async () => {
        // @ts-ignore
        const key = await window.ipcRenderer.invoke('get-api-key');
        if (key) {
            setApiKey(key);

            // Check if we have a cached validation status (don't make API call)
            const cachedStatus = localStorage.getItem('api_key_validated');
            const cachedKey = localStorage.getItem('api_key_hash');

            // Simple hash to check if it's the same key
            const currentKeyHash = btoa(key.substring(0, 10));

            if (cachedStatus === 'true' && cachedKey === currentKeyHash) {
                // Key was previously validated and hasn't changed
                setKeyStatus('valid');
            } else {
                // Key hasn't been validated yet or has changed
                setKeyStatus('idle');
            }
        }
    };

    const loadGithubConfig = async () => {
        // @ts-ignore
        const username = await window.ipcRenderer.invoke('get-github-username');
        // @ts-ignore
        const token = await window.ipcRenderer.invoke('get-github-token');
        if (username) setGithubUsername(username);
        if (token) setGithubToken(token);
    };

    const loadCreatorCodes = async () => {
        // @ts-ignore
        const codes = await window.ipcRenderer.invoke('get-creator-codes');
        if (codes && codes.length > 0) {
            setCreatorCodes(codes.join(', '));
        }
    };

    const loadUserName = async () => {
        // @ts-ignore
        const name = await window.ipcRenderer.invoke('get-username');
        if (name) {
            setUserName(name);
        }
    };

    const saveUserName = async () => {
        if (!userName.trim()) return;
        // @ts-ignore
        await window.ipcRenderer.invoke('set-username', userName.trim());
        setUserNameSaved(true);
        setTimeout(() => setUserNameSaved(false), 2000);
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('user-name-changed'));
        addNotification({ title: 'Settings Saved', message: 'User name updated successfully.', type: 'success' });
    };

    const saveGithubConfig = async () => {
        // @ts-ignore
        await window.ipcRenderer.invoke('set-github-username', githubUsername);
        // @ts-ignore
        await window.ipcRenderer.invoke('set-github-token', githubToken);
        setGithubSaved(true);
        setTimeout(() => setGithubSaved(false), 2000);
        addNotification({ title: 'Settings Saved', message: 'GitHub configuration updated.', type: 'success' });
    };

    const saveCreatorCodes = async () => {
        const codes = creatorCodes.split(',').map(c => c.trim()).filter(c => c.length > 0);
        // @ts-ignore
        await window.ipcRenderer.invoke('set-creator-codes', codes);
        setCreatorCodesSaved(true);
        setTimeout(() => setCreatorCodesSaved(false), 2000);
        addNotification({ title: 'Settings Saved', message: 'Creator codes updated.', type: 'success' });
    };

    const checkAutoLaunch = async () => {
        // @ts-ignore
        const isEnabled = await window.ipcRenderer.invoke('get-auto-launch');
        setAutoLaunch(isEnabled);
    };

    const toggleAutoLaunch = async () => {
        // @ts-ignore
        const newState = await window.ipcRenderer.invoke('set-auto-launch', !autoLaunch);
        setAutoLaunch(newState);
        addNotification({
            title: newState ? 'Auto Launch Enabled' : 'Auto Launch Disabled',
            message: newState ? 'App will start automatically on login.' : 'App will not start automatically.',
            type: 'info'
        });
    };

    const openExternalLink = (url: string) => {
        // @ts-ignore
        window.ipcRenderer.invoke('open-external', url);
    };

    const loadFeatureToggles = () => {
        const saved = localStorage.getItem('feature-toggles');
        if (saved) {
            setEnabledFeatures(JSON.parse(saved));
        }
    };

    const toggleFeature = (feature: keyof typeof enabledFeatures) => {
        const newFeatures = { ...enabledFeatures, [feature]: !enabledFeatures[feature] };
        setEnabledFeatures(newFeatures);
        localStorage.setItem('feature-toggles', JSON.stringify(newFeatures));
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('feature-toggles-changed', { detail: newFeatures }));
    };

    const handleSelectFolder = async () => {
        // @ts-ignore
        const newPath = await window.ipcRenderer.invoke('select-data-folder');
        if (newPath) {
            setDataPath(newPath);
            addNotification({ title: 'Data Path Updated', message: `Data folder set to: ${newPath}`, type: 'success' });
        }
    };

    const handlePasteDataPath = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setDataPath(text);
                // @ts-ignore
                await window.ipcRenderer.invoke('set-data-path', text);
            }
        } catch (err) {
            console.error('Failed to read clipboard', err);
        }
    };

    const handlePasteKey = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setApiKey(text);
        } catch (err) {
            console.error('Failed to read clipboard', err);
        }
    };

    const validateAndSaveKey = async () => {
        if (!apiKey.trim()) {
            setKeyStatus('invalid');
            setValidationMsg('API Key cannot be empty');
            return;
        }

        setKeyStatus('validating');
        setValidationMsg('');

        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('validate-api-key', apiKey);

            if (result.valid) {
                setKeyStatus('valid');
                // @ts-ignore
                await window.ipcRenderer.invoke('set-api-key', apiKey);

                // Cache the validation status to avoid re-validating
                localStorage.setItem('api_key_validated', 'true');
                localStorage.setItem('api_key_hash', btoa(apiKey.substring(0, 10)));

                // Clear cached AI summary so Dashboard will regenerate it
                localStorage.removeItem('dashboard_ai_summary');
                localStorage.removeItem('dashboard_events_hash');
            } else {
                setKeyStatus('invalid');
                setValidationMsg(result.error || 'Invalid API Key');
                // Clear cache on failure
                localStorage.removeItem('api_key_validated');
                localStorage.removeItem('api_key_hash');
            }
        } catch (error) {
            setKeyStatus('invalid');
            setValidationMsg('Error validating key');
            localStorage.removeItem('api_key_validated');
            localStorage.removeItem('api_key_hash');
        }
    };

    // Update Functions
    const loadCurrentVersion = async () => {
        try {
            // @ts-ignore
            const version = await window.ipcRenderer.invoke('get-current-version');
            setCurrentVersion(version);
        } catch (err) {
            console.error('Failed to get version:', err);
            setCurrentVersion('Unknown');
        }
    };

    const setupUpdateListeners = () => {
        // @ts-ignore
        window.ipcRenderer.on('update-checking', handleUpdateChecking);
        // @ts-ignore
        window.ipcRenderer.on('update-available', handleUpdateAvailable);
        // @ts-ignore
        window.ipcRenderer.on('update-not-available', handleUpdateNotAvailable);
    };

    const handleUpdateChecking = () => {
        setUpdateStatus('checking');
    };

    const handleUpdateAvailable = () => {
        setUpdateStatus('available');
    };

    const handleUpdateNotAvailable = () => {
        setUpdateStatus('not-available');
    };

    const checkForUpdates = async () => {
        setUpdateStatus('checking');
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('check-for-updates');
            if (!result.success) {
                setUpdateStatus('error');
            }
        } catch (err: any) {
            setUpdateStatus('error');
        }
    };

    // Updated Mini App Preview Component
    const AppPreview = ({ mode, accent, font }: { mode: 'light' | 'dark', accent: string, font: string }) => {
        const isDark = mode === 'dark';
        const bg = isDark ? '#1f2937' : '#ffffff';
        const textMain = isDark ? '#f3f4f6' : '#111827';
        const textMuted = isDark ? '#9ca3af' : '#6b7280';
        const border = isDark ? '#374151' : '#e5e7eb';
        const sidebarBg = isDark ? '#111827' : '#f9fafb';

        // Ensure font is applied. If it's a standard font, quote it.
        const fontFamily = font === 'CustomFont' ? 'var(--app-font)' : `"${font}", sans-serif`;

        return (
            <div className="w-full h-full min-h-[140px] rounded-xl overflow-hidden border shadow-sm flex transition-all"
                style={{ backgroundColor: bg, borderColor: border, fontFamily: fontFamily }}>
                {/* Sidebar */}
                <div className="w-[80px] h-full border-r p-3 flex flex-col gap-3" style={{ backgroundColor: sidebarBg, borderColor: border }}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-2 w-12 rounded-full opacity-50" style={{ backgroundColor: textMuted }} />
                    ))}
                </div>
                {/* Content */}
                <div className="flex-1 p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center mb-1">
                        <div className="h-3 w-24 rounded-full" style={{ backgroundColor: textMain, opacity: 0.8 }} />
                        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: textMuted, opacity: 0.2 }} />
                    </div>

                    <div className="flex-1 rounded-lg border border-dashed p-3" style={{ borderColor: border, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
                        <div className="flex gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: accent, opacity: 0.2 }} />
                            <div className="flex-1">
                                <div className="text-[10px] font-bold mb-0.5 leading-tight" style={{ color: textMain }}>Meeting with Team</div>
                                <div className="text-[8px] opacity-70 leading-tight" style={{ color: textMuted }}>Discuss prompt...</div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="h-2 w-full rounded-full opacity-40" style={{ backgroundColor: textMuted }} />
                            <div className="h-2 w-5/6 rounded-full opacity-40" style={{ backgroundColor: textMuted }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ... handleFontChange ...

    // ... handleImportCalendar ...

    // ... confirmImport ...




    const handleFontChange = async (fontName: string, type: 'preloaded' | 'custom' = 'preloaded', file?: File) => {
        if (type === 'custom' && file) {
            try {
                const buffer = await file.arrayBuffer();
                const fontFace = new FontFace('CustomFont', buffer);
                const loadedFace = await fontFace.load();
                document.fonts.add(loadedFace);
                document.documentElement.style.setProperty('--app-font', 'CustomFont');
                setCurrentFont('CustomFont');
                localStorage.setItem('app-font', 'CustomFont'); // Persist
                setCustomFontFile(file);
                // We cannot persist file objects easily in localStorage, 
                // so custom fonts might reset on reload unless we store the binary or path (Electron specific).
                // For now, we'll notify.
                addNotification({ title: 'Font Updated', message: `Custom font loaded: ${file.name}`, type: 'success' });
            } catch (e) {
                console.error('Failed to load custom font', e);
                addNotification({ title: 'Font Error', message: 'Failed to load custom font file.', type: 'error' });
            }
        } else {
            console.log(`Applying font: ${fontName}`); // Log application
            // Apply to both root and body to ensure immediate effect
            document.documentElement.style.setProperty('--app-font', fontName);
            document.body.style.fontFamily = `"${fontName}", sans-serif`;
            console.log(`Current body font family: ${document.body.style.fontFamily}`); // Verify application

            setCurrentFont(fontName);
            localStorage.setItem('app-font', fontName); // Persist
        }
    };

    const handleImportCalendar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            // Basic ICS parsing
            const events: any[] = [];
            const lines = content.split(/\r\n|\n|\r/);
            let currentEvent: any = null;

            for (const line of lines) {
                if (line.startsWith('BEGIN:VEVENT')) {
                    currentEvent = {};
                } else if (line.startsWith('END:VEVENT')) {
                    if (currentEvent && currentEvent.summary) {
                        events.push(currentEvent);
                    }
                    currentEvent = null;
                } else if (currentEvent) {
                    if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8);
                    else if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.substring(12);
                    else if (line.startsWith('DTSTART')) {
                        const val = line.split(':')[1];
                        currentEvent.start = val;
                    }
                }
            }

            if (events.length > 0) {
                setImportedEvents(events);
                setSelectedImportIndices(events.map((_, i) => i)); // Select all by default
                setShowImportModal(true);
            } else {
                addNotification({ title: 'Import Failed', message: 'No valid events found in ICS file.', type: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const confirmImport = async () => {
        // Convert imported events to Notes
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        const notes = currentData.notes || {};

        let count = 0;
        selectedImportIndices.forEach(idx => {
            const evt = importedEvents[idx];
            if (!evt.start) return;

            // Parse date string (simple basic ISO/ICS format handling)
            // 20231225T100000Z or 20231225
            let dateStr = evt.start;
            let timeStr = '09:00';

            if (dateStr.includes('T')) {
                const parts = dateStr.split('T');
                dateStr = parts[0];
                const cleanTime = parts[1].replace('Z', '');
                timeStr = `${cleanTime.substring(0, 2)}:${cleanTime.substring(2, 4)}`;
            }

            // Format to YYYY-MM-DD
            if (dateStr.length === 8) {
                dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            }

            const note: any = {
                id: crypto.randomUUID(),
                title: evt.summary || 'Imported Event',
                description: evt.description || '',
                time: timeStr,
                importance: 'medium'
            };

            if (!notes[dateStr]) notes[dateStr] = [];
            notes[dateStr].push(note);
            count++;
        });

        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, notes });
        addNotification({ title: 'Import Complete', message: `Imported ${count} events successfully.`, type: 'success' });
        setShowImportModal(false);
        setImportedEvents([]);
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto">
            <div className="w-full max-w-[95%] 2xl:max-w-[90%] mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Settings</h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage your preferences and configurations</p>
                </div>

                {/* Version & Author Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-6 rounded-3xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border border-blue-100 dark:border-gray-700 shadow-xl shadow-blue-200/50 dark:shadow-gray-900/50"
                >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                        <div>
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 dark:from-red-400 dark:to-pink-400 bg-clip-text text-transparent mb-1">
                                Calendar Plus v{currentVersion}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Created by{' '}
                                <button
                                    onClick={() => openExternalLink('https://github.com/umfhero')}
                                    className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
                                >
                                    @umfhero
                                    <ExternalLink className="w-3 h-3" />
                                </button>
                            </p>
                        </div>
                        <button
                            onClick={checkForUpdates}
                            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                            className={clsx(
                                'px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200',
                                'flex items-center gap-2',
                                updateStatus === 'checking' || updateStatus === 'downloading'
                                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                            )}
                        >
                            <RefreshCw className={clsx('w-4 h-4', updateStatus === 'checking' && 'animate-spin')} />
                            Check for Updates
                        </button>
                    </div>
                </motion.div>



                {/* Main Grid: AI, GitHub, Storage, Creator, Notifications, Import */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                    {/* AI Configuration */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">AI Configuration</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Configure your Gemini API key to enable AI features.
                        </p>

                        <div className="space-y-4">
                            <div className="flex gap-2 items-start">
                                <div className="relative flex-1">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => {
                                            setApiKey(e.target.value);
                                            setKeyStatus('idle');
                                        }}
                                        placeholder="Paste your API Key here"
                                        className={clsx(
                                            "w-full pl-4 pr-12 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border transition-all outline-none text-sm",
                                            keyStatus === 'invalid'
                                                ? "border-red-500 dark:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                                : keyStatus === 'valid'
                                                    ? "border-green-500 dark:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                                    : "border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                        )}
                                    />
                                    {!apiKey && (
                                        <button
                                            onClick={handlePasteKey}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            title="Paste from clipboard"
                                        >
                                            <Clipboard className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={validateAndSaveKey}
                                    disabled={keyStatus === 'validating' || !apiKey}
                                    className={clsx(
                                        "px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-md shrink-0",
                                        keyStatus === 'valid'
                                            ? "bg-green-500 text-white shadow-green-500/20"
                                            : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {keyStatus === 'validating' ? (
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                    ) : keyStatus === 'valid' ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        <>Verify</>
                                    )}
                                </button>
                            </div>

                            <AnimatePresence mode="wait">
                                {keyStatus === 'invalid' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center gap-2 text-red-500 text-xs pl-1"
                                    >
                                        <AlertCircle className="w-3 h-3" />
                                        <span>{validationMsg}</span>
                                    </motion.div>
                                )}
                                {keyStatus === 'valid' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center gap-2 text-green-500 text-xs pl-1"
                                    >
                                        <Check className="w-3 h-3" />
                                        <span>Key verified and saved!</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex flex-col gap-1 pt-2">
                                <button
                                    onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')}
                                    className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer w-fit"
                                >
                                    Get a free Google Studio API key <ExternalLink className="w-3 h-3" />
                                </button>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                                    Note: Ensure "All models" are enabled in your <button onClick={() => openExternalLink('https://aistudio.google.com/usage')} className="underline hover:text-purple-500">Google AI Studio settings</button> if you encounter issues.
                                </p>
                            </div>

                            {/* AI Descriptions Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 mt-4">
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">AI Note Descriptions</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Generate detailed descriptions when creating notes with AI</span>
                                </div>
                                <button
                                    onClick={() => toggleFeature('aiDescriptions')}
                                    className={clsx(
                                        "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                        enabledFeatures.aiDescriptions ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600"
                                    )}
                                >
                                    <motion.div
                                        layout
                                        className="w-4 h-4 rounded-full bg-white shadow-md"
                                        animate={{ x: enabledFeatures.aiDescriptions ? 16 : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* GitHub Configuration */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400">
                                <Github className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">GitHub Integration</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Connect your GitHub profile (optional).
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">GitHub Username</label>
                                <input
                                    type="text"
                                    value={githubUsername}
                                    onChange={(e) => {
                                        setGithubUsername(e.target.value);
                                        setGithubSaved(false);
                                    }}
                                    placeholder="yourusername"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 outline-none text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">
                                    Personal Access Token <span className="text-gray-400">(optional)</span>
                                </label>
                                <input
                                    type="password"
                                    value={githubToken}
                                    onChange={(e) => {
                                        setGithubToken(e.target.value);
                                        setGithubSaved(false);
                                    }}
                                    placeholder="ghp_xxxxxxxxxxxx"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 outline-none text-sm"
                                />
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                                    Required only for private repos
                                </p>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={saveGithubConfig}
                                    disabled={!githubUsername.trim()}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-md",
                                        githubSaved
                                            ? "bg-green-500 text-white shadow-green-500/20"
                                            : "bg-gray-600 hover:bg-gray-700 text-white shadow-gray-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {githubSaved ? (
                                        <>Saved <Check className="w-4 h-4" /></>
                                    ) : (
                                        <>Save</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>


                    {/* Data Storage */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex-1"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <Folder className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Data Storage</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Customize your display name and calendar data location.
                        </p>

                        <div className="flex flex-col flex-1">
                            {/* Display Name Field */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Display Name</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={userName}
                                        onChange={(e) => {
                                            setUserName(e.target.value);
                                            setUserNameSaved(false);
                                        }}
                                        placeholder="Enter your name"
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                                    />
                                    <button
                                        onClick={saveUserName}
                                        disabled={!userName.trim()}
                                        className={clsx(
                                            "px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-md",
                                            userNameSaved
                                                ? "bg-green-500 text-white shadow-green-500/20"
                                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        )}
                                    >
                                        {userNameSaved ? (
                                            <>Saved <Check className="w-4 h-4" /></>
                                        ) : (
                                            <>Save</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Data Path Field */}
                            <div className="mb-1">
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Data Location</label>
                            </div>
                            <div className="relative mb-4">
                                <input
                                    type="text"
                                    value={dataPath}
                                    onChange={(e) => setDataPath(e.target.value)}
                                    onBlur={async () => {
                                        // @ts-ignore
                                        await window.ipcRenderer.invoke('set-data-path', dataPath);
                                    }}
                                    className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                {!dataPath && (
                                    <button
                                        onClick={handlePasteDataPath}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        title="Paste path"
                                    >
                                        <Clipboard className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Spacer to push buttons to bottom */}
                            <div className="flex-1" />

                            <div className="flex items-center justify-between mt-4">
                                <button
                                    onClick={handleSelectFolder}
                                    className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    Change
                                </button>

                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Run on Startup</span>
                                    <button
                                        onClick={toggleAutoLaunch}
                                        className={clsx(
                                            "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                            autoLaunch ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"
                                        )}
                                    >
                                        <motion.div
                                            layout
                                            className="w-4 h-4 rounded-full bg-white shadow-md"
                                            animate={{ x: autoLaunch ? 16 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Fortnite Creator Codes */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                                <Code className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Fortnite Creator Codes</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Add your Fortnite island codes to track stats (optional).
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Island Codes (comma-separated)</label>
                                <textarea
                                    value={creatorCodes}
                                    onChange={(e) => {
                                        setCreatorCodes(e.target.value);
                                        setCreatorCodesSaved(false);
                                    }}
                                    placeholder="7891-5057-6642, 3432-9922-9130, ..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm resize-none"
                                />
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                                    Enter your island codes separated by commas
                                </p>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={saveCreatorCodes}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-md",
                                        creatorCodesSaved
                                            ? "bg-green-500 text-white shadow-green-500/20"
                                            : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/20"
                                    )}
                                >
                                    {creatorCodesSaved ? (
                                        <>Saved <Check className="w-4 h-4" /></>
                                    ) : (
                                        <>Save</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>


                    {/* Notifications */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                {isSuppressed ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Notifications</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Manage application notifications and alerts.
                        </p>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-800 dark:text-gray-200">Stop All Notifications</span>
                            </div>
                            <button
                                onClick={() => toggleSuppression(!isSuppressed)}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                    isSuppressed ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"
                                )}
                            >
                                <motion.div
                                    layout
                                    className="w-4 h-4 rounded-full bg-white shadow-md"
                                    animate={{ x: isSuppressed ? 16 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>
                    </motion.div>

                    {/* Calendar Import */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                <FileUp className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Import Calendar</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Import events from .ics files.
                        </p>
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload</span> .ics file</p>
                            </div>
                            <input type="file" className="hidden" accept=".ics" onChange={handleImportCalendar} />
                        </label>
                    </motion.div>
                </div>

                {/* Appearance Section - Full Width */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 h-full"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
                            <Palette className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Appearance</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Accent & Font */}
                        {/* Left Column: Accent & Font */}
                        <div className="flex flex-col gap-6 h-full">
                            {/* Accent Color */}
                            <div className="flex-1 flex flex-col">
                                <p className="text-sm xl:text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Accent Color</p>

                                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 xl:p-6 border border-gray-100 dark:border-gray-700 flex-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-4 xl:gap-5 mb-4 xl:mb-5">
                                        <div className="relative group">
                                            <input
                                                type="color"
                                                value={accentColor.startsWith('#') ? accentColor : '#3b82f6'}
                                                onChange={(e) => setAccentColor(e.target.value)}
                                                className="w-10 h-10 xl:w-16 xl:h-16 rounded-lg xl:rounded-xl cursor-pointer opacity-0 absolute inset-0 z-10"
                                            />
                                            <div
                                                className="w-10 h-10 xl:w-16 xl:h-16 rounded-lg xl:rounded-xl border-2 border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: accentColor.startsWith('#') ? accentColor : 'var(--accent-primary)' }}
                                            >
                                                <Palette className="w-4 h-4 xl:w-8 xl:h-8 text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm xl:text-xl font-medium text-gray-900 dark:text-gray-100">Custom Color</p>
                                            <p className="text-xs xl:text-base text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                                                {accentColor.startsWith('#') ? accentColor.toUpperCase() : 'Default'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 xl:gap-5">
                                        {['#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#f97316', '#ef4444', '#06b6d4', '#eab308', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16', '#d946ef', '#0ea5e9', '#f59e0b', '#64748b'].map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setAccentColor(color)}
                                                className="w-8 h-8 xl:w-14 xl:h-14 rounded-md xl:rounded-lg transition-all hover:scale-110 hover:shadow-md relative border border-transparent hover:border-gray-300 dark:hover:border-gray-500"
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            >
                                                {accentColor === color && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 xl:w-3 xl:h-3 rounded-full bg-white shadow-sm" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Font Selection */}
                            <div className="flex-[1.5] flex flex-col">
                                <p className="text-sm xl:text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Application Font</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-4 h-full">
                                    {['Outfit', 'Inter', 'Roboto', 'Poppins', 'Lato'].map(font => (
                                        <button
                                            key={font}
                                            onClick={() => handleFontChange(font)}
                                            className={clsx(
                                                "p-3 xl:p-4 rounded-xl border text-left transition-all flex flex-col justify-center",
                                                currentFont === font
                                                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 ring-1 ring-blue-500"
                                                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1 xl:mb-2">
                                                <span className="font-medium xl:text-2xl" style={{ fontFamily: font }}>{font}</span>
                                                {currentFont === font && <Check className="w-4 h-4 xl:w-6 xl:h-6 text-blue-500" />}
                                            </div>
                                            <span className="text-xs xl:text-base text-gray-400" style={{ fontFamily: font }}>The quick brown fox jumps over the lazy dog.</span>
                                        </button>
                                    ))}
                                    <label className={clsx(
                                        "p-3 xl:p-4 rounded-xl border text-left transition-all cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 flex flex-col justify-center",
                                        currentFont === 'CustomFont' && "border-blue-500 ring-1 ring-blue-500"
                                    )}>
                                        <div className="flex items-center justify-between mb-1 xl:mb-2">
                                            <span className="font-medium flex items-center gap-2 xl:text-2xl">
                                                <Type className="w-4 h-4 xl:w-6 xl:h-6" /> Custom Font
                                            </span>
                                            {currentFont === 'CustomFont' && <Check className="w-4 h-4 xl:w-6 xl:h-6 text-blue-500" />}
                                        </div>
                                        <span className="text-xs xl:text-base text-gray-400 block mb-2">{customFontFile ? customFontFile.name : 'Click to select a font file (.ttf, .otf, .woff)'}</span>
                                        <input type="file" className="hidden" accept=".ttf,.otf,.woff,.woff2" onChange={(e) => {
                                            if (e.target.files?.[0]) handleFontChange('CustomFont', 'custom', e.target.files[0]);
                                        }} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Theme Previews */}
                        {/* Right Column: Theme Previews */}
                        <div className="flex flex-col h-full">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Theme Mode</p>
                            <div className="grid grid-cols-1 gap-6 h-full">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={clsx(
                                        "group relative p-2 rounded-2xl border-2 transition-all text-left overflow-hidden flex flex-col justify-between",
                                        theme === 'light'
                                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                    )}
                                >
                                    <div className="flex-1 w-full mb-3 min-h-0">
                                        <AppPreview mode="light" accent={accentColor} font={currentFont} />
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        <span className={clsx("text-sm font-semibold", theme === 'light' ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-400")}>Light Mode</span>
                                        {theme === 'light' && <Check className="w-5 h-5 text-blue-500" />}
                                    </div>
                                </button>

                                <button
                                    onClick={() => setTheme('dark')}
                                    className={clsx(
                                        "group relative p-2 rounded-2xl border-2 transition-all text-left overflow-hidden flex flex-col justify-between",
                                        theme === 'dark'
                                            ? "border-purple-500 bg-purple-50/50 dark:bg-purple-900/10"
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                    )}
                                >
                                    <div className="flex-1 w-full mb-3 min-h-0">
                                        <AppPreview mode="dark" accent={accentColor} font={currentFont} />
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        <span className={clsx("text-sm font-semibold", theme === 'dark' ? "text-purple-400" : "text-gray-600 dark:text-gray-400")}>Dark Mode</span>
                                        {theme === 'dark' && <Check className="w-5 h-5 text-purple-500" />}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Feature Toggles - Moved to Bottom */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Feature Toggles</h2>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Choose which features appear in your sidebar and dashboard.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Calendar Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3">
                                <CalendarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                <span className="font-medium text-gray-800 dark:text-gray-200">Calendar</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('calendar')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                    enabledFeatures.calendar ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                )}
                            >
                                <motion.div
                                    layout
                                    className="w-4 h-4 rounded-full bg-white shadow-md"
                                    animate={{ x: enabledFeatures.calendar ? 16 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* Drawing Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3">
                                <PenTool className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                <span className="font-medium text-gray-800 dark:text-gray-200">Drawing</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('drawing')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                    enabledFeatures.drawing ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                )}
                            >
                                <motion.div
                                    layout
                                    className="w-4 h-4 rounded-full bg-white shadow-md"
                                    animate={{ x: enabledFeatures.drawing ? 16 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* Creator Stats Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3">
                                <PieChart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                <span className="font-medium text-gray-800 dark:text-gray-200">Creator Stats</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('stats')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                    enabledFeatures.stats ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                )}
                            >
                                <motion.div
                                    layout
                                    className="w-4 h-4 rounded-full bg-white shadow-md"
                                    animate={{ x: enabledFeatures.stats ? 16 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* GitHub Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3">
                                <Github className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                <span className="font-medium text-gray-800 dark:text-gray-200">GitHub</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('github')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                    enabledFeatures.github ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                )}
                            >
                                <motion.div
                                    layout
                                    className="w-4 h-4 rounded-full bg-white shadow-md"
                                    animate={{ x: enabledFeatures.github ? 16 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 italic">
                        Note: Dashboard and Settings cannot be disabled.
                    </p>
                </motion.div>



                {/* Roadmap Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <Map className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Project Roadmap</h2>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Live roadmap fetched from GitHub. See what's coming next for CalendarPlus.
                    </p>

                    {roadmapLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                            <span className="ml-2 text-gray-500">Loading roadmap...</span>
                        </div>
                    ) : roadmapError ? (
                        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm text-center">
                            {roadmapError}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* V5 Release Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                    V5 Release (Dec 11)
                                </h3>
                                <div className="space-y-3">
                                    {roadmap.filter(item => item.plannedRelease.includes('v5.0.0') || item.plannedRelease.includes('11 Dec')).map((item, index) => (
                                        <div
                                            key={index}
                                            className={clsx(
                                                "flex items-center justify-between p-3 rounded-xl border transition-colors",
                                                item.status === 'completed'
                                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                                    : "bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={clsx(
                                                    "w-2 h-2 rounded-full",
                                                    item.status === 'completed' ? "bg-green-500" : "bg-blue-500"
                                                )} />
                                                <span className={clsx(
                                                    "font-medium text-sm",
                                                    item.status === 'completed' ? "text-green-800 dark:text-green-200" : "text-gray-800 dark:text-gray-200"
                                                )}>
                                                    {item.task}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {item.status === 'completed' && (
                                                    <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-white dark:bg-green-900/40 px-2 py-1 rounded-md border border-green-100 dark:border-green-800">
                                                        COMPLETED
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pending Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                    Future / Pending
                                </h3>
                                <div className="space-y-3">
                                    {roadmap.filter(item => !item.plannedRelease.includes('v5.0.0') && !item.plannedRelease.includes('11 Dec')).map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 opacity-75"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                                                <span className="font-medium text-sm text-gray-600 dark:text-gray-400">
                                                    {item.task}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-mono text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-100 dark:border-gray-700">
                                                    Pending
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
                <ImportModal
                    isOpen={showImportModal}
                    onClose={() => {
                        setShowImportModal(false);
                        setImportedEvents([]);
                    }}
                    events={importedEvents}
                    selectedIndices={selectedImportIndices}
                    toggleIndex={(i) => {
                        setSelectedImportIndices(prev =>
                            prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i]
                        );
                    }}
                    onConfirm={confirmImport}
                />
            </div>
        </div>
    );
}

function ImportModal({
    isOpen,
    onClose,
    events,
    selectedIndices,
    toggleIndex,
    onConfirm
}: {
    isOpen: boolean;
    onClose: () => void;
    events: any[];
    selectedIndices: number[];
    toggleIndex: (i: number) => void;
    onConfirm: () => void;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Select Events to Import</h3>
                    <div className="text-sm text-gray-500">{selectedIndices.length} selected</div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                    {events.map((evt, i) => (
                        <div
                            key={i}
                            onClick={() => toggleIndex(i)}
                            className={clsx(
                                "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                                selectedIndices.includes(i)
                                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                    : "bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                        >
                            <div className={clsx(
                                "w-5 h-5 rounded-md flex items-center justify-center border mt-0.5",
                                selectedIndices.includes(i) ? "bg-blue-500 border-blue-500" : "border-gray-300 dark:border-gray-500"
                            )}>
                                {selectedIndices.includes(i) && <Check className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-100">{evt.summary || 'Untitled Event'}</h4>
                                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {evt.start ? formatICSDate(evt.start) : 'No Date'}
                                </div>
                                {evt.description && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{evt.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={selectedIndices.length === 0}
                        className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Import Selected
                    </button>
                </div>
            </div>
        </div>
    );
}
