import { useState, useEffect } from 'react';
import { Folder, Palette, Sparkles, Check, ExternalLink, Clipboard, AlertCircle, LayoutDashboard, Calendar, PieChart, Github, PenTool, Calendar as CalendarIcon, Code, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';

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
        github: true
    });

    // Update State
    const [currentVersion, setCurrentVersion] = useState('Loading...');
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle');

    const { theme, accentColor, setTheme, setAccentColor } = useTheme();
    const { addNotification } = useNotification();

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

        return () => {
            // Cleanup update listeners
            // @ts-ignore
            window.ipcRenderer.off('update-checking', handleUpdateChecking);
            // @ts-ignore
            window.ipcRenderer.off('update-available', handleUpdateAvailable);
            // @ts-ignore
            window.ipcRenderer.off('update-not-available', handleUpdateNotAvailable);
        };
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
            // Auto-validate the key if it exists
            setKeyStatus('validating');
            try {
                // @ts-ignore
                const result = await window.ipcRenderer.invoke('validate-api-key', key);
                if (result.valid) {
                    setKeyStatus('valid');
                } else {
                    setKeyStatus('invalid');
                    setValidationMsg(result.error || 'Invalid API Key');
                }
            } catch (error) {
                setKeyStatus('invalid');
                setValidationMsg('Error validating key');
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
                // Clear cached AI summary so Dashboard will regenerate it
                localStorage.removeItem('dashboard_ai_summary');
                localStorage.removeItem('dashboard_events_hash');
            } else {
                setKeyStatus('invalid');
                setValidationMsg(result.error || 'Invalid API Key');
            }
        } catch (error) {
            setKeyStatus('invalid');
            setValidationMsg('Error validating key');
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

    // Mini App Preview Component
    const AppPreview = ({ mode, accent }: { mode: 'light' | 'dark', accent: string }) => {
        const isDark = mode === 'dark';
        const bg = isDark ? '#1f2937' : '#ffffff';
        const text = isDark ? '#9ca3af' : '#6b7280';
        const border = isDark ? '#374151' : '#e5e7eb';
        const sidebarBg = isDark ? '#111827' : '#f9fafb';

        return (
            <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border shadow-sm flex" style={{ backgroundColor: bg, borderColor: border }}>
                {/* Sidebar */}
                <div className="w-1/3 h-full border-r p-2 flex flex-col gap-2" style={{ backgroundColor: sidebarBg, borderColor: border }}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: accent }} />
                        <div className="h-1.5 w-8 rounded-full bg-gray-300 dark:bg-gray-600" />
                    </div>
                    <div className="space-y-1.5">
                        {[LayoutDashboard, Calendar, PieChart, Github].map((Icon, i) => (
                            <div key={i} className="flex items-center gap-1.5 opacity-60">
                                <Icon size={8} color={text} />
                                <div className="h-1 w-10 rounded-full" style={{ backgroundColor: text, opacity: 0.3 }} />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Content */}
                <div className="flex-1 p-2">
                    <div className="h-2 w-16 rounded-full mb-2" style={{ backgroundColor: text, opacity: 0.2 }} />
                    <div className="w-full h-12 rounded-lg border border-dashed" style={{ borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }} />
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto">
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
                    <div className="flex items-center justify-between">
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

                {/* Top Row: AI + GitHub */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

                            <div className="space-y-3">
                                <div className="relative">
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

                                <div className="flex items-center justify-between pt-4">
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')}
                                            className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                                        >
                                            Get a free Google Studio API key <ExternalLink className="w-3 h-3" />
                                        </button>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                            Note: Ensure "All models" are enabled in your <button onClick={() => openExternalLink('https://aistudio.google.com/usage')} className="underline hover:text-purple-500">Google AI Studio settings</button> if you encounter issues.
                                        </p>
                                    </div>

                                    <button
                                        onClick={validateAndSaveKey}
                                        disabled={keyStatus === 'validating' || !apiKey}
                                        className={clsx(
                                            "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-md",
                                            keyStatus === 'valid'
                                                ? "bg-green-500 text-white shadow-green-500/20"
                                                : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        )}
                                    >
                                        {keyStatus === 'validating' ? (
                                            <>Checking...</>
                                        ) : keyStatus === 'valid' ? (
                                            <>Saved <Check className="w-4 h-4" /></>
                                        ) : (
                                            <>Verify & Save</>
                                        )}
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
                    </div>

                {/* Second Row: Data Storage + Creator Codes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

                            {/* Theme Selection with Previews */}
                            <div className="mb-8">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Theme Mode</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={clsx(
                                            "group relative p-2 rounded-2xl border-2 transition-all text-left overflow-hidden",
                                            theme === 'light'
                                                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        )}
                                    >
                                        <div className="mb-3">
                                            <AppPreview mode="light" accent={accentColor} />
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <span className={clsx("text-sm font-semibold", theme === 'light' ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-400")}>Light</span>
                                            {theme === 'light' && <Check className="w-4 h-4 text-blue-500" />}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={clsx(
                                            "group relative p-2 rounded-2xl border-2 transition-all text-left overflow-hidden",
                                            theme === 'dark'
                                                ? "border-purple-500 bg-purple-50/50 dark:bg-purple-900/10"
                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        )}
                                    >
                                        <div className="mb-3">
                                            <AppPreview mode="dark" accent={accentColor} />
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <span className={clsx("text-sm font-semibold", theme === 'dark' ? "text-purple-400" : "text-gray-600 dark:text-gray-400")}>Dark</span>
                                            {theme === 'dark' && <Check className="w-4 h-4 text-purple-500" />}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Accent Color */}
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Accent Color</p>

                                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="relative group">
                                            <input
                                                type="color"
                                                value={accentColor.startsWith('#') ? accentColor : '#3b82f6'}
                                                onChange={(e) => setAccentColor(e.target.value)}
                                                className="w-10 h-10 rounded-lg cursor-pointer opacity-0 absolute inset-0 z-10"
                                            />
                                            <div
                                                className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: accentColor.startsWith('#') ? accentColor : 'var(--accent-primary)' }}
                                            >
                                                <Palette className="w-4 h-4 text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Custom Color</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                                                {accentColor.startsWith('#') ? accentColor.toUpperCase() : 'Default'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {['#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#f97316', '#ef4444', '#06b6d4', '#eab308', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16', '#d946ef', '#0ea5e9', '#f59e0b', '#64748b'].map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setAccentColor(color)}
                                                className="w-8 h-8 rounded-md transition-all hover:scale-110 hover:shadow-md relative border border-transparent hover:border-gray-300 dark:hover:border-gray-500"
                                                style={{ backgroundColor: color, width: '2rem', height: '2rem', minWidth: '2rem', minHeight: '2rem' }}
                                                title={color}
                                            >
                                                {accentColor === color && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
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
            </div>
        </div>
    );
}
