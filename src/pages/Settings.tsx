import { useState, useEffect } from 'react';
import { Folder, Palette, Sparkles, Check, ExternalLink, Clipboard, AlertCircle, LayoutDashboard, PieChart, Github, PenTool, Calendar as CalendarIcon, Code, RefreshCw, Bell, BellOff, Type, Upload, FileUp, Timer, Heart, Sidebar as SidebarIcon, Settings2, X, Trash2, Plus, ChevronDown, ChevronUp, History, Info, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { formatICSDate } from '../utils/icsHelper';
import { useDashboardLayout } from '../contexts/DashboardLayoutContext';
import { LayoutPreview } from '../components/LayoutPreview';
import { LAYOUT_CONFIGS, getAllLayoutTypes } from '../utils/dashboardLayouts';
import { Contributor, fetchGithubContributors } from '../utils/github';
import { CustomThemeEditor } from '../components/CustomThemeEditor';
import { SavedThemesList } from '../components/SavedThemesList';
import { ThemePreview } from '../components/ThemePreview';
import { KeyboardShortcuts } from '../components/KeyboardShortcuts';

// Types for multi-provider configuration
interface ProviderConfig {
    provider: 'gemini' | 'openai' | 'perplexity' | 'openrouter';
    apiKey: string;
    enabled: boolean;
    priority: number;
}

interface FallbackEvent {
    timestamp: string;
    fromProvider: string;
    toProvider: string;
    reason: string;
}

export function SettingsPage() {
    const [dataPath, setDataPath] = useState<string>('Loading...');
    const [autoLaunch, setAutoLaunch] = useState(false);




    // User Name
    const [userName, setUserName] = useState('');
    const [userNameSaved, setUserNameSaved] = useState(false);

    // API Key State
    const [apiKey, setApiKey] = useState('');
    const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'perplexity' | 'openrouter'>('gemini');
    const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
    const [validationMsg, setValidationMsg] = useState('');
    const [showProviderConfig, setShowProviderConfig] = useState(false); // Track if config section should be visible
    // Store API keys per provider so they persist when switching tabs
    const [providerApiKeys, setProviderApiKeys] = useState<{ gemini?: string; openai?: string; perplexity?: string; openrouter?: string }>({});
    const [providerKeyStatuses, setProviderKeyStatuses] = useState<{ gemini?: 'idle' | 'valid' | 'invalid'; openai?: 'idle' | 'valid' | 'invalid'; perplexity?: 'idle' | 'valid' | 'invalid'; openrouter?: 'idle' | 'valid' | 'invalid' }>({});

    // Multi-provider state
    const [showMultiProviderModal, setShowMultiProviderModal] = useState(false);
    const [multiProviderEnabled, setMultiProviderEnabled] = useState(false);
    const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
    const [fallbackEvents, setFallbackEvents] = useState<FallbackEvent[]>([]);
    const [showFallbackHistory, setShowFallbackHistory] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorModalContent, setErrorModalContent] = useState({ title: '', message: '', details: '' });

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
        stats: false,
        github: true,
        timer: true,
        aiDescriptions: !import.meta.env.DEV // false in dev, true in production
    });

    // Dev mode AI briefing toggle (only used in dev mode)
    const [enableDevBriefing, setEnableDevBriefing] = useState(() => {
        return localStorage.getItem('dev_enable_ai_briefing') === 'true';
    });

    // Update State
    const [currentVersion, setCurrentVersion] = useState('Loading...');

    // Contributors State
    const [contributors, setContributors] = useState<Contributor[]>([]);
    const [contributorsLoading, setContributorsLoading] = useState(true);

    // Font State
    const [currentFont, setCurrentFont] = useState('Outfit');

    // Custom Theme State
    const [customThemeName, setCustomThemeName] = useState('');
    const [activeCustomThemeId, setActiveCustomThemeId] = useState<string | null>(null);

    // Calendar Import State
    const [importedEvents, setImportedEvents] = useState<any[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedImportIndices, setSelectedImportIndices] = useState<number[]>([]);

    const { theme, accentColor, setTheme, setAccentColor, customThemeColors, setCustomThemeColors, savedThemes, saveCurrentTheme, loadTheme, deleteTheme, updateTheme } = useTheme();
    const { addNotification, isSuppressed, toggleSuppression } = useNotification();
    const { layoutType, setLayoutType, sidebarIconOnly, setSidebarIconOnly, effectiveSidebarIconOnly, focusCentricFont, setFocusCentricFont } = useDashboardLayout();

    useEffect(() => {
        checkAutoLaunch();
        loadDataPath();
        loadApiKey();
        loadFeatureToggles();
        loadGithubConfig();
        loadCreatorCodes();
        loadUserName();
        loadCurrentVersion();
        loadContributors();
        loadMultiProviderConfig();

        // Listen for feature toggle changes from other components (e.g., Quick Note modal)
        const handleFeatureToggleChange = (event: CustomEvent) => {
            const features = event.detail;
            setEnabledFeatures(features);
        };

        // Listen for data path changes from wizard
        const handleDataPathChange = () => {
            loadDataPath();
        };

        // Listen for AI fallback events from backend
        const handleFallbackEvent = (_event: any, event: FallbackEvent) => {
            setFallbackEvents(prev => [...prev, event]);
            // Show a brief notification
            console.log(`AI Fallback: ${event.fromProvider} → ${event.toProvider}`);
        };

        window.addEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);
        window.addEventListener('data-path-changed', handleDataPathChange);
        // @ts-ignore
        window.ipcRenderer?.on('ai-fallback-event', handleFallbackEvent);

        return () => {
            // Cleanup listeners
            window.removeEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);
            window.removeEventListener('data-path-changed', handleDataPathChange);
            // @ts-ignore
            window.ipcRenderer?.off('ai-fallback-event', handleFallbackEvent);
        };
    }, []);

    useEffect(() => {
        // Load persist font with proper font stack
        const savedFont = localStorage.getItem('app-font');
        if (savedFont) {
            setCurrentFont(savedFont);

            // Build font stack with appropriate fallbacks based on font type
            let fontStack: string;
            switch (savedFont) {
                case 'Playfair Display':
                    fontStack = "'Playfair Display', 'Georgia', 'Times New Roman', serif";
                    break;
                case 'Architects Daughter':
                    fontStack = "'Architects Daughter', 'Comic Sans MS', cursive";
                    break;
                case 'Inter':
                    fontStack = "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                    break;
                case 'Poppins':
                    fontStack = "'Poppins', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                    break;
                case 'CustomFont':
                    fontStack = "'CustomFont', 'Segoe UI', sans-serif";
                    break;
                case 'Outfit':
                default:
                    fontStack = "'Outfit', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                    break;
            }

            document.documentElement.style.setProperty('--app-font', fontStack);
            document.body.style.fontFamily = fontStack;
        }

        checkAutoLaunch();
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
        // @ts-ignore
        const provider = await window.ipcRenderer.invoke('get-ai-provider');
        // @ts-ignore
        const allProviderKeys = await window.ipcRenderer.invoke('get-all-provider-api-keys');

        if (provider) {
            setAiProvider(provider);
        }

        // Load all provider API keys
        if (allProviderKeys) {
            setProviderApiKeys(allProviderKeys);

            // Load cached validation statuses for each provider
            const statuses: { gemini?: 'idle' | 'valid' | 'invalid'; openai?: 'idle' | 'valid' | 'invalid'; perplexity?: 'idle' | 'valid' | 'invalid'; openrouter?: 'idle' | 'valid' | 'invalid' } = {};
            (['gemini', 'openai', 'perplexity', 'openrouter'] as const).forEach(p => {
                const cachedStatus = localStorage.getItem(`api_key_validated_${p}`);
                const cachedKey = localStorage.getItem(`api_key_hash_${p}`);
                const providerKey = allProviderKeys[p];
                if (providerKey && cachedStatus === 'true' && cachedKey === btoa(providerKey.substring(0, 10))) {
                    statuses[p] = 'valid';
                } else if (providerKey) {
                    statuses[p] = 'idle';
                }
            });
            setProviderKeyStatuses(statuses);
        }

        // Set current provider's key as active
        const currentProviderKey = allProviderKeys?.[provider || 'gemini'] || key || '';
        setApiKey(currentProviderKey);

        if (currentProviderKey) {
            // Check if we have a cached validation status (don't make API call)
            const cachedStatus = localStorage.getItem(`api_key_validated_${provider || 'gemini'}`);
            const cachedKey = localStorage.getItem(`api_key_hash_${provider || 'gemini'}`);

            // Simple hash to check if it's the same key
            const currentKeyHash = btoa(currentProviderKey.substring(0, 10));

            if (cachedStatus === 'true' && cachedKey === currentKeyHash) {
                // Key was previously validated and hasn't changed
                setKeyStatus('valid');
            } else {
                // Key hasn't been validated yet or has changed
                setKeyStatus('idle');
            }
        }

        // Load multi-provider config
        await loadMultiProviderConfig();
    };

    const loadMultiProviderConfig = async () => {
        try {
            // @ts-ignore
            const enabled = await window.ipcRenderer.invoke('get-multi-provider-enabled');
            // @ts-ignore
            const configs = await window.ipcRenderer.invoke('get-provider-configs');
            // @ts-ignore
            const events = await window.ipcRenderer.invoke('get-fallback-events');

            setMultiProviderEnabled(enabled || false);
            setProviderConfigs(configs || []);
            setFallbackEvents(events || []);
        } catch (e) {
            console.error('Failed to load multi-provider config:', e);
        }
    };

    const saveMultiProviderConfig = async () => {
        try {
            // @ts-ignore
            await window.ipcRenderer.invoke('set-multi-provider-enabled', multiProviderEnabled);
            // @ts-ignore
            await window.ipcRenderer.invoke('set-provider-configs', providerConfigs);

            // Also save each provider's API key to the main storage
            for (const config of providerConfigs) {
                if (config.apiKey) {
                    // @ts-ignore
                    await window.ipcRenderer.invoke('set-provider-api-key', config.provider, config.apiKey);
                }
            }
        } catch (e) {
            console.error('Failed to save multi-provider config:', e);
        }
    };

    const addProviderConfig = () => {
        const newPriority = providerConfigs.length;
        const usedProviders = providerConfigs.map(c => c.provider);
        const availableProvider = (['gemini', 'openai', 'perplexity', 'openrouter'] as const).find(p => !usedProviders.includes(p)) || 'gemini';

        // Use saved API key for this provider if available
        const savedKey = providerApiKeys[availableProvider] || '';

        setProviderConfigs([
            ...providerConfigs,
            { provider: availableProvider, apiKey: savedKey, enabled: true, priority: newPriority }
        ]);
    };

    // Sync provider configs with saved API keys when opening modal
    const syncProviderKeysOnModalOpen = () => {
        // If no configs exist, auto-populate from saved keys
        if (providerConfigs.length === 0) {
            const newConfigs: ProviderConfig[] = [];
            let priority = 0;

            // Add providers that have saved keys, starting with the active one
            const orderedProviders = [aiProvider, ...(['gemini', 'openai', 'perplexity', 'openrouter'] as const).filter(p => p !== aiProvider)];

            orderedProviders.forEach(provider => {
                const savedKey = providerApiKeys[provider];
                if (savedKey) {
                    newConfigs.push({
                        provider,
                        apiKey: savedKey,
                        enabled: true,
                        priority: priority++
                    });
                }
            });

            if (newConfigs.length > 0) {
                setProviderConfigs(newConfigs);
            }
        } else {
            // Update existing configs with any new saved keys
            setProviderConfigs(prev => prev.map(config => ({
                ...config,
                apiKey: config.apiKey || providerApiKeys[config.provider] || ''
            })));
        }
    };

    const removeProviderConfig = (index: number) => {
        const newConfigs = providerConfigs.filter((_, i) => i !== index);
        // Recalculate priorities
        setProviderConfigs(newConfigs.map((c, i) => ({ ...c, priority: i })));
    };

    const moveProviderUp = (index: number) => {
        if (index === 0) return;
        const newConfigs = [...providerConfigs];
        [newConfigs[index - 1], newConfigs[index]] = [newConfigs[index], newConfigs[index - 1]];
        setProviderConfigs(newConfigs.map((c, i) => ({ ...c, priority: i })));
    };

    const moveProviderDown = (index: number) => {
        if (index === providerConfigs.length - 1) return;
        const newConfigs = [...providerConfigs];
        [newConfigs[index], newConfigs[index + 1]] = [newConfigs[index + 1], newConfigs[index]];
        setProviderConfigs(newConfigs.map((c, i) => ({ ...c, priority: i })));
    };

    const updateProviderConfig = (index: number, updates: Partial<ProviderConfig>) => {
        const updatedConfigs = providerConfigs.map((c, i) => i === index ? { ...c, ...updates } : c);
        setProviderConfigs(updatedConfigs);

        // If API key was updated, also update the main provider keys
        if (updates.apiKey !== undefined) {
            const config = updatedConfigs[index];
            setProviderApiKeys(prev => ({ ...prev, [config.provider]: updates.apiKey }));
        }
    };

    // Helper function for showing error modals - kept for future use
    // @ts-expect-error Reserved for future error display functionality
    const showError = (title: string, message: string, details: string = '') => {
        setErrorModalContent({ title, message, details });
        setShowErrorModal(true);
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
            const features = JSON.parse(saved);
            // In dev mode, ALWAYS override aiDescriptions to false for faster testing
            if (import.meta.env.DEV) {
                features.aiDescriptions = false;
            }
            setEnabledFeatures(features);
        } else {
            // No saved settings - use defaults based on environment
            setEnabledFeatures({
                calendar: true,
                drawing: true,
                stats: true,
                github: true,
                timer: true,
                aiDescriptions: !import.meta.env.DEV // false in dev, true in production
            });
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

            // Reload data from new path
            console.log('🔄 Reloading data from new path...');
            // @ts-ignore
            const newData = await window.ipcRenderer.invoke('get-data');
            console.log('📥 Loaded notes from new path:', newData);

            // Trigger a refresh by dispatching custom event
            window.dispatchEvent(new CustomEvent('data-path-changed', { detail: { path: newPath, data: newData } }));
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

    const handleProviderChange = async (provider: 'gemini' | 'openai' | 'perplexity' | 'openrouter') => {
        // Save current API key for current provider before switching
        if (apiKey.trim()) {
            // @ts-ignore
            await window.ipcRenderer.invoke('set-provider-api-key', aiProvider, apiKey);
            setProviderApiKeys(prev => ({ ...prev, [aiProvider]: apiKey }));
        }

        // Switch provider
        setAiProvider(provider);
        setShowProviderConfig(true); // Show the configuration section
        // @ts-ignore
        await window.ipcRenderer.invoke('set-ai-provider', provider);

        // Load saved API key for the new provider
        const savedKey = providerApiKeys[provider] || '';
        setApiKey(savedKey);

        // Also set this as the active API key
        // @ts-ignore
        await window.ipcRenderer.invoke('set-api-key', savedKey);

        // Load cached validation status for this provider
        if (savedKey) {
            const cachedStatus = localStorage.getItem(`api_key_validated_${provider}`);
            const cachedKey = localStorage.getItem(`api_key_hash_${provider}`);
            const currentKeyHash = btoa(savedKey.substring(0, 10));

            if (cachedStatus === 'true' && cachedKey === currentKeyHash) {
                setKeyStatus('valid');
            } else {
                setKeyStatus('idle');
            }
        } else {
            setKeyStatus('idle');
        }
        setValidationMsg('');
    };

    const validateAndSaveKey = async () => {
        if (!apiKey.trim()) {
            setKeyStatus('invalid');
            setValidationMsg('Please enter an API key');
            return;
        }

        setKeyStatus('validating');
        setValidationMsg('');

        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('validate-api-key', apiKey, aiProvider);

            if (result.valid) {
                setKeyStatus('valid');
                // Save as active key
                // @ts-ignore
                await window.ipcRenderer.invoke('set-api-key', apiKey);
                // Save for this specific provider
                // @ts-ignore
                await window.ipcRenderer.invoke('set-provider-api-key', aiProvider, apiKey);
                // @ts-ignore
                await window.ipcRenderer.invoke('set-ai-provider', aiProvider);

                // Update local state
                setProviderApiKeys(prev => ({ ...prev, [aiProvider]: apiKey }));
                setProviderKeyStatuses(prev => ({ ...prev, [aiProvider]: 'valid' }));

                // Cache the validation status per provider
                localStorage.setItem(`api_key_validated_${aiProvider}`, 'true');
                localStorage.setItem(`api_key_hash_${aiProvider}`, btoa(apiKey.substring(0, 10)));

                // Clear cached AI summary so Dashboard will regenerate it
                localStorage.removeItem('dashboard_ai_summary');
                localStorage.removeItem('dashboard_events_hash');
            } else {
                setKeyStatus('invalid');
                // Use more helpful message for region-restricted errors
                let errorMsg = result.error || 'Invalid API Key';
                if (result.isRegionRestricted && aiProvider === 'gemini') {
                    errorMsg = 'Google Gemini is not available in your region. Please try Perplexity instead.';
                }
                setValidationMsg(errorMsg);
                setProviderKeyStatuses(prev => ({ ...prev, [aiProvider]: 'invalid' }));
                // Clear cache on failure
                localStorage.removeItem(`api_key_validated_${aiProvider}`);
                localStorage.removeItem(`api_key_hash_${aiProvider}`);

                // Auto-suggest switching to Perplexity if Gemini is region-blocked
                if (result.isRegionRestricted && aiProvider === 'gemini') {
                    addNotification({
                        title: 'Region Restricted',
                        type: 'info',
                        message: 'Tip: Switch to the Perplexity tab to use AI features in your region.'
                    });
                }
            }
        } catch (error) {
            setKeyStatus('invalid');
            setValidationMsg('Unable to verify. Please check your internet connection.');
            setProviderKeyStatuses(prev => ({ ...prev, [aiProvider]: 'invalid' }));
            localStorage.removeItem(`api_key_validated_${aiProvider}`);
            localStorage.removeItem(`api_key_hash_${aiProvider}`);
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

    const loadContributors = async () => {
        setContributorsLoading(true);
        try {
            const data = await fetchGithubContributors('umfhero', 'ThoughtsPlus');
            setContributors(data);
        } catch (err) {
            console.error('Failed to load contributors:', err);
        } finally {
            setContributorsLoading(false);
        }
    };

    // Updated Mini App Preview Component (Currently unused)
    /*
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
                <div className="w-[80px] h-full border-r p-3 flex flex-col gap-3" style={{ backgroundColor: sidebarBg, borderColor: border }}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-2 w-12 rounded-full opacity-50" style={{ backgroundColor: textMuted }} />
                    ))}
                </div>
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
    */

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
                document.documentElement.style.setProperty('--app-font', "'CustomFont', 'Segoe UI', sans-serif");
                setCurrentFont('CustomFont');
                localStorage.setItem('app-font', 'CustomFont'); // Persist
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

            // Build font stack with appropriate fallbacks based on font type
            let fontStack: string;
            switch (fontName) {
                case 'Playfair Display':
                    fontStack = "'Playfair Display', 'Georgia', 'Times New Roman', serif";
                    break;
                case 'Architects Daughter':
                    fontStack = "'Architects Daughter', 'Comic Sans MS', cursive";
                    break;
                case 'Inter':
                    fontStack = "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                    break;
                case 'Poppins':
                    fontStack = "'Poppins', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                    break;
                case 'Outfit':
                default:
                    fontStack = "'Outfit', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                    break;
            }

            // Apply to both root CSS variable and body for immediate effect
            document.documentElement.style.setProperty('--app-font', fontStack);
            document.body.style.fontFamily = fontStack;
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
        <div className="p-4 md:p-4 h-full overflow-y-auto">
            <div className="w-full">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 truncate">Settings</h1>
                    <p className="text-gray-500 dark:text-gray-400 line-clamp-2">Manage your preferences and configurations</p>
                </div>

                {/* Version & Contributors Section */}
                <motion.div
                    initial={{ y: -15, scale: 0.97 }}
                    animate={{ y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0 }}
                    className="mb-6 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-4">
                        {/* Left side - Version and buttons */}
                        <div className="flex-1 flex flex-col w-full sm:w-auto min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap min-w-0">
                                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 truncate">
                                    ThoughtsPlus
                                </h2>

                                {/* Version Badge */}
                                {/* Version Badge & Update Check */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm">
                                        <span className="text-base font-bold text-gray-800 dark:text-gray-100">
                                            v{currentVersion}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => openExternalLink('ms-windows-store://downloadsandupdates')}
                                        className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50 transition-all hover:shadow-md active:scale-95 group shrink-0"
                                        title="Check for Updates on Microsoft Store"
                                    >
                                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                    </button>
                                </div>
                            </div>                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 font-medium">
                                Keep your nerdy thoughts organised
                            </p>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => openExternalLink('https://github.com/sponsors/umfhero')}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-medium transition-all shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:-translate-y-0.5"
                                >
                                    <Heart className="w-4 h-4 fill-white animate-pulse" />
                                    Donate
                                </button>

                                <button
                                    onClick={() => openExternalLink('https://thoughtsplus.netlify.app/')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 hover:text-[#ae8a29] dark:hover:text-yellow-400 text-sm font-medium transition-all border border-[#ae8a29]/20 dark:border-gray-600 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Website
                                </button>
                            </div>
                        </div>

                        {/* Right side - Contributors */}
                        <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto shrink-0">
                            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                Created with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> by
                            </div>
                            {contributorsLoading ? (
                                <div className="flex gap-2 flex-wrap">
                                    <div className="w-28 h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    <div className="w-28 h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                </div>
                            ) : contributors.length > 0 ? (
                                <div className="flex gap-2 flex-wrap">
                                    {contributors.slice(0, 3).map((contributor) => (
                                        <button
                                            key={contributor.id}
                                            onClick={() => openExternalLink(contributor.html_url)}
                                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-lg hover:-translate-y-0.5 min-w-[110px]"
                                        >
                                            <img
                                                src={contributor.avatar_url}
                                                alt={contributor.login}
                                                className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600"
                                            />
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                                    {contributor.login}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {contributor.contributions} commits
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                    {contributors.length > 3 && (
                                        <button
                                            onClick={() => openExternalLink('https://github.com/umfhero/ThoughtsPlus/graphs/contributors')}
                                            className="flex items-center justify-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-lg hover:-translate-y-0.5 min-w-[110px]"
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="text-xl font-bold text-gray-600 dark:text-gray-300">
                                                    +{contributors.length - 3}
                                                </div>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    more
                                                </span>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </motion.div>



                {/* Main Grid: AI, GitHub, Storage, Creator, Notifications, Import */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                    {/* AI Configuration */}
                    <motion.div
                        initial={{ y: -15, scale: 0.97 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-4 min-w-0">
                            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">AI Configuration</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                            Configure your API key to enable AI features.
                        </p>

                        <div className="space-y-4">
                            {/* Region Restriction Warning - Always visible at top */}
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2"
                            >
                                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <div className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                    <strong>Region Notice:</strong> Google Gemini is not available in all regions. If you encounter errors, please use Perplexity instead.
                                </div>
                            </motion.div>

                            {/* Current Provider Status */}
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Current AI Provider:</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                        {aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'perplexity' ? 'Perplexity' : 'None'}
                                    </span>
                                    {providerKeyStatuses[aiProvider] === 'valid' && (
                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                    )}
                                </div>
                            </div>

                            {/* AI Provider Selection */}
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block truncate">Select & Configure Provider</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'gemini', name: 'Gemini', color: 'purple' },
                                        { id: 'perplexity', name: 'Perplexity', color: 'blue' },
                                    ].map((provider) => {
                                        const isValid = providerKeyStatuses[provider.id as keyof typeof providerKeyStatuses] === 'valid';
                                        const isExpanded = showProviderConfig && aiProvider === provider.id;

                                        return (
                                            <button
                                                key={provider.id}
                                                onClick={() => handleProviderChange(provider.id as 'gemini' | 'openai' | 'perplexity' | 'openrouter')}
                                                className={clsx(
                                                    "relative px-3 py-3 rounded-xl text-sm font-medium transition-all border-2 flex items-center justify-between gap-2 hover:border-gray-300 dark:hover:border-gray-500",
                                                    "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                                                )}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    {provider.name}
                                                    {isValid && <Check className="w-3.5 h-3.5 text-green-500" />}
                                                </span>
                                                <ChevronDown
                                                    className={clsx(
                                                        "w-4 h-4 transition-transform text-gray-400",
                                                        isExpanded && "rotate-180"
                                                    )}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Provider Configuration - Only shown when provider is selected */}
                            <AnimatePresence mode="wait">
                                {showProviderConfig && aiProvider && (
                                    <motion.div
                                        key={aiProvider}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={clsx(
                                                "w-2 h-2 rounded-full",
                                                aiProvider === 'gemini' ? "bg-purple-500" : "bg-blue-500"
                                            )} />
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                                {aiProvider === 'gemini' ? 'Gemini' : 'Perplexity'} Configuration
                                            </span>
                                        </div>

                                        <div className="flex gap-2 items-start">
                                            <div className="relative flex-1">
                                                <input
                                                    type="password"
                                                    value={apiKey}
                                                    onChange={async (e) => {
                                                        const newValue = e.target.value;
                                                        setApiKey(newValue);
                                                        setKeyStatus('idle');

                                                        // Update local provider keys state
                                                        setProviderApiKeys(prev => ({ ...prev, [aiProvider]: newValue }));

                                                        // If user clears the field, immediately delete from backend
                                                        if (!newValue.trim()) {
                                                            // @ts-ignore
                                                            await window.ipcRenderer.invoke('set-api-key', '');
                                                            // @ts-ignore
                                                            await window.ipcRenderer.invoke('set-provider-api-key', aiProvider, '');
                                                            localStorage.removeItem(`api_key_validated_${aiProvider}`);
                                                            localStorage.removeItem(`api_key_hash_${aiProvider}`);
                                                            setKeyStatus('idle');
                                                            setValidationMsg('');
                                                            setProviderKeyStatuses(prev => ({ ...prev, [aiProvider]: 'idle' }));
                                                        }
                                                    }}
                                                    onBlur={async () => {
                                                        // Auto-save the key on blur (even if not validated yet)
                                                        if (apiKey.trim()) {
                                                            // @ts-ignore
                                                            await window.ipcRenderer.invoke('set-provider-api-key', aiProvider, apiKey);
                                                        }
                                                    }}
                                                    placeholder={`Paste your ${aiProvider === 'gemini' ? 'Gemini' : 'Perplexity'} API Key`}
                                                    className={clsx(
                                                        "w-full pl-4 pr-12 py-3 rounded-xl bg-white dark:bg-gray-800 border transition-all outline-none text-sm",
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
                                                    className="flex items-start gap-2 text-red-500 text-xs pl-1"
                                                >
                                                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                                    <span className="leading-relaxed">{validationMsg}</span>
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

                                        {/* Dynamic API key link based on provider */}
                                        <div className="flex flex-col gap-1 pt-2">
                                            {aiProvider === 'gemini' && (
                                                <>
                                                    <button
                                                        onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')}
                                                        className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer w-fit"
                                                    >
                                                        Get a free Google Studio API key <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                                                        Free tier available. Not available in all regions.
                                                    </p>
                                                </>
                                            )}
                                            {aiProvider === 'perplexity' && (
                                                <>
                                                    <button
                                                        onClick={() => openExternalLink('https://www.perplexity.ai/settings/api')}
                                                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer w-fit"
                                                    >
                                                        Get a Perplexity API key <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                                                        Pay-per-use pricing. Available worldwide.
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Advanced Multi-Provider Configuration - Always visible */}
                            <button
                                onClick={() => {
                                    syncProviderKeysOnModalOpen();
                                    setShowMultiProviderModal(true);
                                }}
                                title="Want multiple keys activated at once? Configure automatic fallback between providers."
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-600 text-sm font-medium"
                            >
                                <Settings2 className="w-4 h-4" />
                                <span>Advanced: Multi-Provider Fallback</span>
                                {multiProviderEnabled && (
                                    <span className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-bold shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                        ENABLED
                                    </span>
                                )}
                            </button>

                            {/* AI Descriptions Toggle */}
                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
                                <div className="flex flex-col min-w-0 flex-1">
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

                            {/* Dev Mode: AI Briefing Toggle */}
                            {import.meta.env.DEV && (
                                <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 mt-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-800 dark:text-gray-200">AI Dashboard Briefing</span>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200 rounded font-semibold">DEV</span>
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Enable AI briefing generation in dev mode</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newValue = !enableDevBriefing;
                                            setEnableDevBriefing(newValue);
                                            localStorage.setItem('dev_enable_ai_briefing', String(newValue));
                                            // Notify dashboard to re-fetch if enabled
                                            if (newValue) {
                                                localStorage.removeItem('dashboard_ai_summary');
                                                localStorage.removeItem('dashboard_events_hash');
                                            }
                                        }}
                                        className={clsx(
                                            "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                            enableDevBriefing ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
                                        )}
                                    >
                                        <motion.div
                                            layout
                                            className="w-4 h-4 rounded-full bg-white shadow-md"
                                            animate={{ x: enableDevBriefing ? 16 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Data Storage */}
                    <motion.div
                        initial={{ y: -15, scale: 0.97 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex-1 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-4 min-w-0">
                            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                                <Folder className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">Data Storage</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                            Customize your display name and calendar data location.
                        </p>

                        <div className="flex flex-col flex-1">
                            {/* Display Name Field */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block truncate">Display Name</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={userName}
                                        onChange={(e) => {
                                            setUserName(e.target.value);
                                            setUserNameSaved(false);
                                        }}
                                        placeholder="Enter your name"
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm min-w-0"
                                    />
                                    <button
                                        onClick={saveUserName}
                                        disabled={!userName.trim()}
                                        className={clsx(
                                            "px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-md shrink-0",
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
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block truncate">Data Location</label>
                            </div>
                            <div className="relative mb-4">
                                <input
                                    type="text"
                                    value={dataPath}
                                    onChange={(e) => setDataPath(e.target.value)}
                                    onBlur={async () => {
                                        // @ts-ignore
                                        await window.ipcRenderer.invoke('set-data-path', dataPath);

                                        // Reload data from new path
                                        console.log('🔄 Reloading data after manual path entry...');
                                        // @ts-ignore
                                        const newData = await window.ipcRenderer.invoke('get-data');
                                        console.log('📥 Loaded notes from new path:', newData);

                                        // Trigger refresh
                                        window.dispatchEvent(new CustomEvent('data-path-changed', { detail: { path: dataPath, data: newData } }));
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

                            <div className="flex flex-col gap-3 mt-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <button
                                        onClick={handleSelectFolder}
                                        className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shrink-0"
                                    >
                                        Change Folder
                                    </button>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Run on Startup</span>
                                        <button
                                            onClick={toggleAutoLaunch}
                                            className={clsx(
                                                "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0",
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

                                {/* Import from Legacy Button */}
                                <button
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to force copy data from "A - CalendarPlus" to "ThoughtsPlus"? This will overwrite existing files in ThoughtsPlus.')) {
                                            // @ts-ignore
                                            const result = await window.ipcRenderer.invoke('force-migration');
                                            if (result.success) {
                                                alert(`Migration successful! Copied ${result.count} files. Please restart the app.`);
                                                // Handle folder change similar to manual selection
                                                // @ts-ignore
                                                const newData = await window.ipcRenderer.invoke('get-data');
                                                window.dispatchEvent(new CustomEvent('data-path-changed', { detail: { path: 'Reloading...', data: newData } }));
                                            } else {
                                                alert(`Migration failed: ${result.error}`);
                                            }
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all border border-orange-100 dark:border-orange-800 text-sm font-medium"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Import from Legacy (CalendarPlus)</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* GitHub Integration */}
                    <motion.div
                        initial={{ y: -15, scale: 0.97 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.12 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-4 min-w-0">
                            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 shrink-0">
                                <Github className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">GitHub Integration</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                            Connect your GitHub profile (optional).
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block truncate">GitHub Username</label>
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
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block truncate">
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
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-2">
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

                    {/* Keyboard Shortcuts */}
                    <motion.div
                        initial={{ y: -15, scale: 0.97 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
                        className="md:col-span-2 xl:col-span-3 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                    >
                        <KeyboardShortcuts />
                    </motion.div>




                    {/* Notifications */}
                    <motion.div
                        initial={{ y: -15, scale: 0.97 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-4 min-w-0">
                            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0">
                                {isSuppressed ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">Notifications</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                            Manage application notifications and alerts.
                        </p>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">Stop All Notifications</span>
                            </div>
                            <button
                                onClick={() => toggleSuppression(!isSuppressed)}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0",
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
                        initial={{ y: -15, scale: 0.97 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-4 min-w-0">
                            <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 shrink-0">
                                <FileUp className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">Import Calendar</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                            Import events from .ics files.
                        </p>
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors overflow-hidden">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate"><span className="font-semibold">Click to upload</span> .ics file</p>
                            </div>
                            <input type="file" className="hidden" accept=".ics" onChange={handleImportCalendar} />
                        </label>
                    </motion.div>

                    {/* Fortnite Creator Codes */}
                    <motion.div
                        initial={{ y: -15, scale: 0.97 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.35 }}
                        className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-4 min-w-0">
                            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 shrink-0">
                                <Code className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">Fortnite Creator Codes</h2>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                            Add your Fortnite island codes to track stats (optional).
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block truncate">Island Codes (comma-separated)</label>
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
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-2">
                                    Enter your island codes separated by commas
                                </p>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={saveCreatorCodes}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-md shrink-0",
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

                {/* Language Section - COMMENTED OUT: Awaiting translation JSON files and flag icons
                   TODO: 
                   - Add translation JSON files for each language (en, es, fr, de, pt, ja, zh, ko, it, ru)
                   - Update t() function in LanguageContext to load and use translations
                   - Replace emoji flags with SVG flag icons (emoji flags don't render on Windows)
                   - Wrap all UI text throughout the app with t('key') calls
                <motion.div
                    initial={{ y: -15, scale: 0.97 }}
                    animate={{ y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.33 }}
                    className="mb-6 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4 min-w-0">
                        <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 shrink-0">
                            <Globe className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">Language</h2>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                        Select your preferred display language.
                    </p>

                    <LanguageSelector />
                </motion.div>
                */}

                {/* Appearance Section - Full Width */}
                <motion.div
                    initial={{ y: -15, scale: 0.97 }}
                    animate={{ y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.35 }}
                    className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4 min-w-0">
                        <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 shrink-0">
                            <Palette className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">Appearance</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Accent & Font (Compact) */}
                        <div className="flex flex-col gap-4 min-w-0">
                            {/* Accent Color - Compact */}
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">Accent Color</p>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 overflow-hidden">
                                    <div className="flex items-center gap-3 mb-3 min-w-0">
                                        <div className="relative group shrink-0">
                                            <input
                                                type="color"
                                                value={accentColor.startsWith('#') ? accentColor : '#3b82f6'}
                                                onChange={(e) => setAccentColor(e.target.value)}
                                                className="w-8 h-8 rounded-lg cursor-pointer opacity-0 absolute inset-0 z-10"
                                            />
                                            <div
                                                className="w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: accentColor.startsWith('#') ? accentColor : 'var(--accent-primary)' }}
                                            >
                                                <Palette className="w-3 h-3 text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">Custom</p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate">
                                                {accentColor.startsWith('#') ? accentColor.toUpperCase() : 'Default'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {['#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#f97316', '#ef4444', '#06b6d4', '#eab308', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16', '#d946ef', '#0ea5e9', '#f59e0b', '#64748b'].map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setAccentColor(color)}
                                                className="w-8 h-8 rounded-md transition-all hover:scale-110 hover:shadow-md relative border border-transparent hover:border-gray-300 dark:hover:border-gray-500 shrink-0"
                                                style={{ backgroundColor: color }}
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

                            {/* Font Selection - Horizontal Scroll */}
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">Application Font</p>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-600 px-0.5">
                                    {[
                                        { name: 'Outfit', display: 'Outfit' },
                                        { name: 'Inter', display: 'Inter' },
                                        { name: 'Poppins', display: 'Poppins' },
                                        { name: 'Playfair Display', display: 'Elegant' },
                                        { name: 'Architects Daughter', display: 'Handwriting' },
                                    ].map(font => (
                                        <button
                                            key={font.name}
                                            onClick={() => handleFontChange(font.name)}
                                            className={clsx(
                                                "shrink-0 px-4 py-2 rounded-lg border text-left transition-all min-w-[100px]",
                                                currentFont === font.name
                                                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                                                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300"
                                            )}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-lg font-medium" style={{ fontFamily: font.name }}>Aa</span>
                                                <span className="text-xs font-medium truncate w-full text-center" style={{ fontFamily: font.name }}>{font.display}</span>
                                            </div>
                                            {currentFont === font.name && (
                                                <div className="flex justify-center mt-1">
                                                    <Check className="w-3 h-3 text-blue-500" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                    <label className={clsx(
                                        "shrink-0 px-4 py-2 rounded-lg border text-left transition-all cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 min-w-[100px] flex flex-col items-center justify-center gap-1",
                                        currentFont === 'CustomFont' && "border-blue-500"
                                    )}>
                                        <Type className="w-5 h-5 text-gray-500" />
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Custom</span>
                                        <input type="file" className="hidden" accept=".ttf,.otf,.woff,.woff2" onChange={(e) => {
                                            if (e.target.files?.[0]) handleFontChange('CustomFont', 'custom', e.target.files[0]);
                                        }} />
                                        {currentFont === 'CustomFont' && <Check className="w-3 h-3 text-blue-500 mt-1" />}
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Theme Mode with Custom Option */}
                        <div className="flex flex-col min-w-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">Theme Mode</p>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                {/* Light Mode */}
                                <button
                                    onClick={() => setTheme('light')}
                                    className="group flex flex-col gap-2 cursor-pointer"
                                >
                                    <div className={clsx(
                                        "relative w-full aspect-[4/3] rounded-xl border-2 transition-all overflow-hidden",
                                        theme === 'light'
                                            ? "border-blue-500 ring-2 ring-blue-500/20"
                                            : "border-gray-200 dark:border-gray-700 group-hover:border-gray-300 dark:group-hover:border-gray-600"
                                    )}>
                                        <ThemePreview mode="light" accent={accentColor} font={currentFont} sidebarIconOnly={sidebarIconOnly} />
                                        {theme === 'light' && (
                                            <div className="absolute inset-0 ring-1 ring-inset ring-blue-500/10 rounded-xl" />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span className={clsx("text-xs font-semibold", theme === 'light' ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400")}>Light</span>
                                        {theme === 'light' && <Check className="w-3 h-3 text-blue-500" />}
                                    </div>
                                </button>

                                {/* Dark Mode */}
                                <button
                                    onClick={() => setTheme('dark')}
                                    className="group flex flex-col gap-2 cursor-pointer"
                                >
                                    <div className={clsx(
                                        "relative w-full aspect-[4/3] rounded-xl border-2 transition-all overflow-hidden",
                                        theme === 'dark'
                                            ? "border-purple-500 ring-2 ring-purple-500/20"
                                            : "border-gray-200 dark:border-gray-700 group-hover:border-gray-300 dark:group-hover:border-gray-600"
                                    )}>
                                        <ThemePreview mode="dark" accent={accentColor} font={currentFont} sidebarIconOnly={sidebarIconOnly} />
                                    </div>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span className={clsx("text-xs font-semibold", theme === 'dark' ? "text-purple-500" : "text-gray-600 dark:text-gray-400")}>Dark</span>
                                        {theme === 'dark' && <Check className="w-3 h-3 text-purple-500" />}
                                    </div>
                                </button>

                                {/* Custom Mode */}
                                <button
                                    onClick={() => setTheme('custom')}
                                    className="group flex flex-col gap-2 cursor-pointer"
                                >
                                    <div className={clsx(
                                        "relative w-full aspect-[4/3] rounded-xl border-2 transition-all overflow-hidden",
                                        theme === 'custom'
                                            ? "border-pink-500 ring-2 ring-pink-500/20"
                                            : "border-gray-200 dark:border-gray-700 group-hover:border-gray-300 dark:group-hover:border-gray-600"
                                    )}>
                                        <ThemePreview mode="custom" accent={accentColor} colors={customThemeColors} font={currentFont} sidebarIconOnly={sidebarIconOnly} />
                                    </div>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span className={clsx("text-xs font-semibold", theme === 'custom' ? "text-pink-500" : "text-gray-600 dark:text-gray-400")}>Custom</span>
                                        {theme === 'custom' && <Check className="w-3 h-3 text-pink-500" />}
                                    </div>
                                </button>
                            </div>

                            {/* Sidebar Icon Mode */}
                            <div className="mb-4">
                                <button
                                    onClick={() => setSidebarIconOnly(!sidebarIconOnly)}
                                    disabled={LAYOUT_CONFIGS[layoutType]?.forceIconOnlySidebar}
                                    className={clsx(
                                        "w-full p-2 rounded-xl border-2 transition-all text-left flex items-center justify-between",
                                        effectiveSidebarIconOnly
                                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                                        LAYOUT_CONFIGS[layoutType]?.forceIconOnlySidebar && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <SidebarIcon className={clsx("w-4 h-4", effectiveSidebarIconOnly ? "text-blue-500" : "text-gray-500")} />
                                        <div className="flex flex-col">
                                            <span className={clsx("text-xs font-semibold", effectiveSidebarIconOnly ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-400")}>Icon-Only Sidebar</span>
                                        </div>
                                    </div>
                                    <div className={clsx(
                                        "w-8 h-4 rounded-full p-0.5 transition-colors duration-300",
                                        effectiveSidebarIconOnly ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                                    )}>
                                        <div className={clsx("w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300", effectiveSidebarIconOnly ? "translate-x-4" : "translate-x-0")} />
                                    </div>
                                </button>
                                {LAYOUT_CONFIGS[layoutType]?.forceIconOnlySidebar && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 pl-1">
                                        Required by current layout
                                    </p>
                                )}
                            </div>

                            {/* Custom Theme Editor - Only shown when Custom is selected */}
                            <AnimatePresence>
                                {theme === 'custom' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-4 pt-2">
                                            {/* Custom Theme Editor */}
                                            <CustomThemeEditor
                                                colors={customThemeColors}
                                                onChange={setCustomThemeColors}
                                            />

                                            {/* Save Theme Section */}
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={customThemeName}
                                                    onChange={(e) => setCustomThemeName(e.target.value)}
                                                    placeholder="Theme name..."
                                                    className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (customThemeName.trim()) {
                                                            saveCurrentTheme(customThemeName.trim());
                                                            setCustomThemeName('');
                                                        }
                                                    }}
                                                    disabled={!customThemeName.trim()}
                                                    className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-pink-500/20"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    Save
                                                </button>
                                            </div>

                                            {/* Saved Themes List */}
                                            <SavedThemesList
                                                themes={savedThemes}
                                                activeThemeId={activeCustomThemeId || undefined}
                                                onSelect={(id) => {
                                                    loadTheme(id);
                                                    setActiveCustomThemeId(id);
                                                }}
                                                onDelete={(id) => {
                                                    deleteTheme(id);
                                                    if (activeCustomThemeId === id) {
                                                        setActiveCustomThemeId(null);
                                                    }
                                                }}
                                                onUpdate={(id) => {
                                                    updateTheme(id);
                                                }}
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Dashboard Layouts - Horizontal Scroll */}
                    <div className="mt-6">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">Dashboard Layout</p>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {getAllLayoutTypes().map((type) => {
                                const config = LAYOUT_CONFIGS[type];
                                const isSelected = layoutType === type;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setLayoutType(type)}
                                        className={clsx(
                                            "group relative p-2 rounded-xl border-2 transition-all text-left overflow-hidden min-w-[200px] flex-shrink-0",
                                            isSelected
                                                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        )}
                                    >
                                        <div className="aspect-[16/9] w-full mb-2 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                                            <LayoutPreview
                                                layoutType={type}
                                                isSelected={isSelected}
                                                isDark={theme === 'dark'}
                                                accentColor={accentColor}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between min-w-0">
                                            <div className="min-w-0 flex-1">
                                                <span className={clsx(
                                                    "text-sm font-semibold block truncate",
                                                    isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
                                                )}>
                                                    {config.name}
                                                </span>
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Focus-Centric Font Toggle */}
                        {layoutType === 'focus-centric' && (
                            <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 w-fit">
                                <Type className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Elegant Font (Playfair Display)</span>
                                <button
                                    onClick={() => setFocusCentricFont(focusCentricFont === 'playfair' ? 'default' : 'playfair')}
                                    className={clsx(
                                        "w-8 h-4 rounded-full p-0.5 transition-colors duration-300 focus:outline-none ml-2",
                                        focusCentricFont === 'playfair' ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                                    )}
                                >
                                    <motion.div
                                        layout
                                        className="w-3 h-3 rounded-full bg-white shadow-md"
                                        animate={{ x: focusCentricFont === 'playfair' ? 16 : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>




                {/* Feature Toggles - Moved to Bottom */}
                <div
                    className="mt-6 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4 min-w-0">
                        <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 shrink-0">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">Feature Toggles</h2>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                        Choose which features appear in your sidebar and dashboard.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Calendar Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <CalendarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">Calendar</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('calendar')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0",
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

                        {/* Board Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <PenTool className="w-5 h-5 text-gray-600 dark:text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">Board</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('drawing')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0",
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
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <PieChart className="w-5 h-5 text-gray-600 dark:text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">Creator Stats</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('stats')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0",
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
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Github className="w-5 h-5 text-gray-600 dark:text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">GitHub</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('github')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0",
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

                        {/* Timer Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Timer className="w-5 h-5 text-gray-600 dark:text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">Timer</span>
                            </div>
                            <button
                                onClick={() => toggleFeature('timer')}
                                className={clsx(
                                    "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0",
                                    enabledFeatures.timer ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                )}
                            >
                                <motion.div
                                    layout
                                    className="w-4 h-4 rounded-full bg-white shadow-md"
                                    animate={{ x: enabledFeatures.timer ? 16 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 italic line-clamp-2">
                        Note: Dashboard and Settings cannot be disabled.
                    </p>
                </div>

                {/* Multi-Provider Configuration Modal */}
                {
                    showMultiProviderModal && (
                        <div
                            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setShowMultiProviderModal(false)}
                        >
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden"
                            >
                                {/* Header */}
                                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">Multi-Provider Fallback</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">Configure multiple AI providers with automatic fallback</p>
                                    </div>
                                    <button
                                        onClick={() => setShowMultiProviderModal(false)}
                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                    {/* Enable Toggle */}
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-800 dark:text-gray-200">Enable Multi-Provider</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-switch when a provider runs out of quota</span>
                                        </div>
                                        <button
                                            onClick={() => setMultiProviderEnabled(!multiProviderEnabled)}
                                            className={clsx(
                                                "w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                                                multiProviderEnabled ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600"
                                            )}
                                        >
                                            <motion.div
                                                layout
                                                className="w-4 h-4 rounded-full bg-white shadow-md"
                                                animate={{ x: multiProviderEnabled ? 16 : 0 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        </button>
                                    </div>

                                    {multiProviderEnabled && (
                                        <>
                                            {/* Provider List */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Providers (in priority order)</label>
                                                    <button
                                                        onClick={addProviderConfig}
                                                        disabled={providerConfigs.length >= 3}
                                                        className="flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Add Provider
                                                    </button>
                                                </div>

                                                {providerConfigs.length === 0 && (
                                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-dashed border-gray-200 dark:border-gray-600 text-center">
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">No providers configured. Add one to get started.</p>
                                                    </div>
                                                )}

                                                {providerConfigs.map((config, index) => (
                                                    <div key={index} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-600 space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            {/* Priority indicator */}
                                                            <div className="flex flex-col gap-0.5">
                                                                <button
                                                                    onClick={() => moveProviderUp(index)}
                                                                    disabled={index === 0}
                                                                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                >
                                                                    <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                                                                </button>
                                                                <button
                                                                    onClick={() => moveProviderDown(index)}
                                                                    disabled={index === providerConfigs.length - 1}
                                                                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                >
                                                                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                                                </button>
                                                            </div>

                                                            <span className="text-xs font-bold text-gray-400 w-4">#{index + 1}</span>

                                                            {/* Provider select */}
                                                            <select
                                                                value={config.provider}
                                                                onChange={(e) => updateProviderConfig(index, { provider: e.target.value as any })}
                                                                className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                                                            >
                                                                <option value="gemini">Gemini (Free tier)</option>
                                                                {/* <option value="openai">OpenAI (Paid)</option> */}
                                                                <option value="perplexity">Perplexity (Paid)</option>
                                                                {/* <option value="openrouter">OpenRouter (Free tier)</option> */}
                                                            </select>

                                                            {/* Enable toggle */}
                                                            <button
                                                                onClick={() => updateProviderConfig(index, { enabled: !config.enabled })}
                                                                className={clsx(
                                                                    "w-8 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none shrink-0",
                                                                    config.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                                                )}
                                                            >
                                                                <motion.div
                                                                    layout
                                                                    className="w-4 h-4 rounded-full bg-white shadow-md"
                                                                    animate={{ x: config.enabled ? 12 : 0 }}
                                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                                />
                                                            </button>

                                                            {/* Delete button */}
                                                            <button
                                                                onClick={() => removeProviderConfig(index)}
                                                                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        {/* API Key input */}
                                                        <input
                                                            type="password"
                                                            value={config.apiKey}
                                                            onChange={(e) => updateProviderConfig(index, { apiKey: e.target.value })}
                                                            placeholder={`${config.provider === 'gemini' ? 'Gemini' : config.provider === 'openai' ? 'OpenAI' : config.provider === 'perplexity' ? 'Perplexity' : 'OpenRouter'} API Key`}
                                                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Fallback History */}
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => setShowFallbackHistory(!showFallbackHistory)}
                                                    className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                                >
                                                    <History className="w-3.5 h-3.5" />
                                                    Fallback History ({fallbackEvents.length})
                                                    {showFallbackHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>

                                                <AnimatePresence>
                                                    {showFallbackHistory && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="mt-2 space-y-1 overflow-hidden"
                                                        >
                                                            {fallbackEvents.length === 0 ? (
                                                                <p className="text-xs text-gray-400 dark:text-gray-500 py-2">No fallback events yet</p>
                                                            ) : (
                                                                <>
                                                                    {fallbackEvents.slice().reverse().slice(0, 10).map((event, i) => (
                                                                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
                                                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-xs text-gray-700 dark:text-gray-300">
                                                                                    <span className="font-medium">{event.fromProvider}</span> → <span className="font-medium">{event.toProvider}</span>
                                                                                </p>
                                                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{event.reason}</p>
                                                                                <p className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {fallbackEvents.length > 10 && (
                                                                        <p className="text-[10px] text-gray-400 text-center py-1">+ {fallbackEvents.length - 10} more events</p>
                                                                    )}
                                                                </>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </>
                                    )}

                                    {/* Info note */}
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                                        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                            When enabled, if the first provider fails (rate limit, quota, etc.), the app automatically tries the next provider. Great for mixing free Gemini with paid providers as backup.
                                        </p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowMultiProviderModal(false)}
                                        className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await saveMultiProviderConfig();
                                            } catch (error) {
                                                console.error('Save error:', error);
                                            } finally {
                                                setShowMultiProviderModal(false);
                                            }
                                        }}
                                        className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-500/30 transition-all"
                                    >
                                        Save Configuration
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Error Modal */}
                {
                    showErrorModal && (
                        <div
                            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setShowErrorModal(false)}
                        >
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700"
                            >
                                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{errorModalContent.title}</h3>
                                </div>
                                <div className="p-5 space-y-3">
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{errorModalContent.message}</p>
                                    {errorModalContent.details && (
                                        <details className="text-xs">
                                            <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Technical details</summary>
                                            <pre className="mt-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">{errorModalContent.details}</pre>
                                        </details>
                                    )}
                                </div>
                                <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end">
                                    <button
                                        onClick={() => setShowErrorModal(false)}
                                        className="px-6 py-2 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-bold transition-all"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

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
            </div >
        </div >
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
