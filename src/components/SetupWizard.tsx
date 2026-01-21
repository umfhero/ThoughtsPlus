import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Sparkles, Github, Check, ChevronRight, ChevronLeft, BookOpen, Clock, Layout, MessageSquare, Cloud, Shield, Palette, Repeat, Calendar, Target, Sidebar as SidebarIcon, Heart } from 'lucide-react';
import logoPng from '../assets/Thoughts+.png';
import clsx from 'clsx';
import { useDashboardLayout, DashboardLayoutType } from '../contexts/DashboardLayoutContext';
import { LayoutPreview } from './LayoutPreview';
import { LAYOUT_CONFIGS, getAllLayoutTypes } from '../utils/dashboardLayouts';
import { useTheme } from '../contexts/ThemeContext';
import { Contributor, fetchGithubContributors } from '../utils/github';
import { getAppVersion } from '../utils/version';

interface SetupWizardProps {
    onComplete: () => void;
    isDemoMode?: boolean;
}

export function SetupWizard({ onComplete, isDemoMode = false }: SetupWizardProps) {
    const [step, setStep] = useState(0);
    const [showWelcome, setShowWelcome] = useState(true);
    const [dataPath, setDataPath] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<'onedrive' | 'local' | 'custom'>('onedrive');
    const [apiKey, setApiKey] = useState('');
    const [githubUsername, setGithubUsername] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    // Layout selection state
    const { layoutType, setLayoutType } = useDashboardLayout();
    const { theme, accentColor } = useTheme();
    const [selectedLayout, setSelectedLayout] = useState<DashboardLayoutType>(layoutType);
    const [appVersion, setAppVersion] = useState<string>('');
    const [contributors, setContributors] = useState<Contributor[]>([]);

    useEffect(() => {
        // Load default path suggestions
        loadDefaultPaths();
        // Load app version
        loadAppVersion();
        // Load contributors
        loadContributors();
    }, []);

    const loadContributors = async () => {
        try {
            const data = await fetchGithubContributors('umfhero', 'ThoughtsPlus');
            setContributors(data);
        } catch (err) {
            console.error('Failed to load contributors:', err);
        }
    };

    const loadAppVersion = async () => {
        const version = await getAppVersion();
        setAppVersion(version);
    };

    const loadDefaultPaths = async () => {
        // @ts-ignore
        const oneDrive = await window.ipcRenderer.invoke('get-onedrive-path');
        if (oneDrive) {
            setDataPath(oneDrive);
        }
    };

    const handleLocationChange = async (location: 'onedrive' | 'local' | 'custom') => {
        setSelectedLocation(location);

        if (location === 'custom') {
            // For custom, immediately open folder browser
            handleSelectFolder();
        } else {
            // For onedrive/local, open folder browser with suggested path
            // @ts-ignore
            const newPath = await window.ipcRenderer.invoke('select-data-folder');
            if (newPath) {
                setDataPath(newPath);
            } else {
                // If user cancels, fall back to suggested path
                // @ts-ignore
                const suggestedPath = await window.ipcRenderer.invoke('get-suggested-path', location);
                setDataPath(suggestedPath);
            }
        }
    };

    const handleSelectFolder = async () => {
        // @ts-ignore
        const newPath = await window.ipcRenderer.invoke('select-data-folder');
        if (newPath) {
            setDataPath(newPath);
            setSelectedLocation('custom');
        }
    };

    const validateApiKey = async () => {
        if (!apiKey.trim()) return true; // Skip validation if empty
        setIsValidating(true);
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('validate-api-key', apiKey);
            setIsValidating(false);
            return result.valid;
        } catch {
            setIsValidating(false);
            return false;
        }
    };

    const handleNext = async () => {
        if (step === 0) {
            // Welcome screen - move to step 1
            setStep(1);
        } else if (step === 1) {
            // Save data path
            if (!isDemoMode) {
                // @ts-ignore
                await window.ipcRenderer.invoke('set-data-path', dataPath);
                // Notify Settings page to reload path
                window.dispatchEvent(new CustomEvent('data-path-changed'));
            }
            setStep(2);
        } else if (step === 2) {
            // Validate and save API key if provided
            if (apiKey.trim()) {
                const valid = await validateApiKey();
                if (!valid) return; // Don't proceed if invalid
                if (!isDemoMode) {
                    // @ts-ignore
                    await window.ipcRenderer.invoke('set-api-key', apiKey);
                    // Cache validation status
                    localStorage.setItem('api_key_validated', 'true');
                    localStorage.setItem('api_key_hash', btoa(apiKey.substring(0, 10)));
                }
            }
            setStep(3);
        } else if (step === 3) {
            // Save GitHub if provided
            if (!isDemoMode) {
                if (githubUsername.trim()) {
                    // @ts-ignore
                    await window.ipcRenderer.invoke('set-github-username', githubUsername);
                }
            }
            setStep(4);
        } else if (step === 4) {
            // Save layout selection
            setLayoutType(selectedLayout);
            // Mark setup as complete
            if (!isDemoMode) {
                // @ts-ignore
                await window.ipcRenderer.invoke('set-setup-complete', true);
            }
            onComplete();
        }
    };

    const handleSkip = () => {
        if (step === 2 || step === 3) {
            setStep(step + 1);
        } else if (step === 4) {
            handleNext();
        }
    };

    const handleGetStarted = () => {
        setShowWelcome(false);
        setStep(1);
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-8 z-50">
            {/* Drag Region for Setup Wizard */}
            <div className="absolute top-0 left-0 w-full h-12 z-50" style={{ WebkitAppRegion: 'drag' } as any} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 border border-gray-200 relative z-10"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                {showWelcome ? (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center"
                    >
                        <div className="mb-6 flex justify-center">
                            <div className="p-3">
                                <img src={logoPng} alt="Thoughts+" className="w-24 h-24" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Welcome to <span className="text-blue-500">ThoughtsPlus</span>
                        </h1>

                        <p className="text-base text-gray-600 mb-6 max-w-xl mx-auto">
                            Your personal productivity suite for managing events, notes, and tracking your creative projects.
                        </p>

                        <div className="grid grid-cols-4 gap-3 mb-8 max-w-4xl mx-auto">
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Layout className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Dashboard Hub</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Calendar className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Smart Calendar</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Clock className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Advanced Timer</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <BookOpen className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Nerdbook</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Sparkles className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">AI Quick Notes</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <MessageSquare className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Daily Briefing</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Target className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Progress Tracking</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Github className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">GitHub Profile</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Cloud className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Cloud Sync</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Shield className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Local Privacy</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Palette className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Custom Themes</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                                <Repeat className="w-4 h-4 text-blue-500 mb-1.5" />
                                <p className="text-[10px] font-medium text-gray-700 leading-tight">Recurring Events</p>
                            </div>
                        </div>

                        <button
                            onClick={handleGetStarted}
                            className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
                        >
                            Get Started
                            <ChevronRight className="w-4 h-4" />
                        </button>

                        {/* Contributors & Version Section */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 mb-3">
                                Created with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> by
                            </div>
                            {contributors.length > 0 ? (
                                <div className="flex justify-center gap-2 flex-wrap mb-3">
                                    {contributors.slice(0, 4).map((contributor) => (
                                        <div
                                            key={contributor.id}
                                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-gray-50 border border-gray-100 min-w-[80px]"
                                        >
                                            <img
                                                src={contributor.avatar_url}
                                                alt={contributor.login}
                                                className="w-10 h-10 rounded-full border-2 border-gray-200"
                                            />
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {contributor.login}
                                                </span>
                                                <span className="text-[10px] text-gray-500">
                                                    {contributor.contributions} commits
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {contributors.length > 4 && (
                                        <div className="flex items-center justify-center p-2 rounded-xl bg-gray-50 border border-gray-100 min-w-[80px]">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="text-lg font-bold text-gray-600">
                                                    +{contributors.length - 4}
                                                </div>
                                                <span className="text-[10px] text-gray-500">
                                                    more
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 text-center mb-3">@umfhero</p>
                            )}
                            <p className="text-xs text-gray-400 text-center">
                                Version {appVersion}
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    <>
                        {/* Progress Bar */}
                        <div className="flex items-center mb-8">
                            {[1, 2, 3, 4].map((s) => (
                                <>
                                    <div key={s}
                                        className={clsx(
                                            "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all shrink-0",
                                            step >= s
                                                ? "bg-blue-500 text-white"
                                                : "bg-gray-200 text-gray-400"
                                        )}
                                    >
                                        {step > s ? <Check className="w-5 h-5" /> : s}
                                    </div>
                                    {s < 4 && (
                                        <div
                                            className={clsx(
                                                "flex-1 h-1 mx-2 rounded transition-all",
                                                step > s ? "bg-blue-500" : "bg-gray-200"
                                            )}
                                        />
                                    )}
                                </>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <Folder className="w-6 h-6 text-gray-700" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800">
                                                Choose Data Location
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                Where should ThoughtsPlus store your data?
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <button
                                            onClick={() => handleLocationChange('onedrive')}
                                            className={clsx(
                                                "w-full p-4 rounded-xl border-2 text-left transition-all",
                                                selectedLocation === 'onedrive'
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <div className="font-semibold text-gray-800 mb-1">
                                                OneDrive (Recommended)
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Browse and select your OneDrive folder to sync across devices
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => handleLocationChange('local')}
                                            className={clsx(
                                                "w-full p-4 rounded-xl border-2 text-left transition-all",
                                                selectedLocation === 'local'
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <div className="font-semibold text-gray-800 mb-1">
                                                Documents Folder
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Browse and select a folder in your Documents
                                            </div>
                                        </button>

                                        <button
                                            onClick={handleSelectFolder}
                                            className={clsx(
                                                "w-full p-4 rounded-xl border-2 text-left transition-all",
                                                selectedLocation === 'custom'
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <div className="font-semibold text-gray-800 mb-1">
                                                Custom Location
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Browse and choose any folder (Dropbox, Google Drive, etc.)
                                            </div>
                                        </button>
                                    </div>

                                    <div className="mb-6">
                                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                                            Selected Path
                                        </label>
                                        <input
                                            type="text"
                                            value={dataPath}
                                            readOnly
                                            className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-mono"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <Sparkles className="w-6 h-6 text-gray-700" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800">
                                                AI Configuration (Optional)
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                Enable AI-powered quick notes with Gemini
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                                            Google Gemini API Key
                                        </label>
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Paste your API key here (optional)"
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                        />
                                        <a
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                // @ts-ignore
                                                window.ipcRenderer.invoke('open-external', 'https://aistudio.google.com/app/apikey');
                                            }}
                                            className="text-xs text-blue-500 hover:underline mt-2 inline-block"
                                        >
                                            Get a free API key from Google AI Studio →
                                        </a>
                                    </div>

                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                                        <p className="text-sm text-gray-600">
                                            <strong>Note:</strong> You can skip this step and add your API key later in Settings.
                                            AI features will be disabled until configured.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <Github className="w-6 h-6 text-gray-700" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800">
                                                Integrations (Optional)
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                Connect your GitHub profile
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                                                GitHub Username
                                            </label>
                                            <input
                                                type="text"
                                                value={githubUsername}
                                                onChange={(e) => setGithubUsername(e.target.value)}
                                                placeholder="yourusername (optional)"
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                                        <p className="text-sm text-gray-600">
                                            <strong>Note:</strong> All integrations are optional and can be configured later in Settings.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {step === 4 && (
                                <motion.div
                                    key="step4"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <Target className="w-6 h-6 text-gray-700" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800">
                                                Choose Your Layout
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                Select a dashboard style that works best for you
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        {getAllLayoutTypes().map((type) => {
                                            const config = LAYOUT_CONFIGS[type];
                                            const isSelected = selectedLayout === type;
                                            return (
                                                <button
                                                    key={type}
                                                    onClick={() => setSelectedLayout(type)}
                                                    className={clsx(
                                                        "group relative p-3 rounded-xl border-2 transition-all text-left overflow-hidden",
                                                        isSelected
                                                            ? "border-blue-500 bg-blue-50/50"
                                                            : "border-gray-200 hover:border-gray-300"
                                                    )}
                                                >
                                                    <div className="aspect-[4/3] w-full mb-3 rounded-lg overflow-hidden">
                                                        <LayoutPreview
                                                            layoutType={type}
                                                            isSelected={isSelected}
                                                            isDark={theme === 'dark'}
                                                            accentColor={accentColor}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className={clsx(
                                                                "text-sm font-semibold block",
                                                                isSelected ? "text-blue-700" : "text-gray-700"
                                                            )}>
                                                                {config.name}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {config.description}
                                                            </span>
                                                        </div>
                                                        {isSelected && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                                    </div>
                                                    {config.forceIconOnlySidebar && (
                                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                                                            <SidebarIcon className="w-3 h-3" />
                                                            <span>Icon-only sidebar</span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                                        <p className="text-sm text-gray-600">
                                            <strong>Tip:</strong> You can change your layout anytime in Settings. The "Default" layout is fully customizable!
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </>
                )}

                {/* Navigation Buttons */}
                {!showWelcome && (
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                        {step > 1 ? (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </button>
                        ) : (
                            <div />
                        )}

                        <div className="flex gap-3">
                            {(step === 2 || step === 3 || step === 4) && (
                                <button
                                    onClick={handleSkip}
                                    className="px-6 py-3 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                                >
                                    Skip
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                disabled={isValidating || (step === 1 && !dataPath)}
                                className={clsx(
                                    "px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2",
                                    "bg-blue-500 hover:bg-blue-600 text-white",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {isValidating ? (
                                    "Validating..."
                                ) : step === 4 ? (
                                    <>
                                        Get Started
                                        <Check className="w-4 h-4" />
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
