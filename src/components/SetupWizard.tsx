import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Sparkles, Github, Check, ChevronRight, ChevronLeft, BookOpen, Target, Sidebar as SidebarIcon, Heart } from 'lucide-react';
import logoPng from '../assets/ThoughtsPlus.png';
import clsx from 'clsx';
import { useDashboardLayout, DashboardLayoutType } from '../contexts/DashboardLayoutContext';
import { LayoutPreview } from './LayoutPreview';
import { LAYOUT_CONFIGS, getAllLayoutTypes } from '../utils/dashboardLayouts';
import { useTheme } from '../contexts/ThemeContext';
import { Contributor, fetchGithubContributors } from '../utils/github';
import { getAppVersion } from '../utils/version';
import movieScreenshot from '../assets/moviescreenshot.jpg';

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
    const [perplexityApiKey, setPerplexityApiKey] = useState('');
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
            // Validate and save API keys if provided
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
            // Save Perplexity API key if provided
            if (perplexityApiKey.trim() && !isDemoMode) {
                // @ts-ignore
                await window.ipcRenderer.invoke('set-perplexity-api-key', perplexityApiKey);
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
        <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4 z-50">
            {/* Drag Region for Setup Wizard */}
            <div className="absolute top-0 left-0 w-full h-12 z-50" style={{ WebkitAppRegion: 'drag' } as any} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 pb-8 border border-gray-200 relative z-10"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                {showWelcome ? (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="relative"
                    >
                        {/* Main Content */}
                        <div className="text-center">
                            {/* Logo and Title - Same Line */}
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <img src={logoPng} alt="Thoughts+" className="w-12 h-12" />
                                <h1 className="text-4xl font-bold text-gray-900">
                                    Welcome to <span className="text-amber-600">ThoughtsPlus</span>
                                </h1>
                            </div>

                            <p className="text-xl text-gray-700 mb-2 max-w-2xl mx-auto font-medium">
                                Built for lazy nerds who want to capture thoughts instantly, not waste time organizing them.
                            </p>

                            <p className="text-base text-gray-600 mb-6 max-w-xl mx-auto">
                                100% free. Open source. No ads. No subscriptions ever.
                            </p>

                            {/* Quick Capture Flow Diagram */}
                            <div className="mb-6 max-w-full mx-auto px-4">
                                <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                                    Quick Capture Flow
                                </h3>
                                {/* Desktop/Tablet: Horizontal Layout */}
                                <div className="hidden md:flex items-start justify-center gap-3">
                                    {/* Step 1: During Task with Movie Background */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative w-52 h-28 rounded-xl overflow-hidden shadow-lg border-2 border-amber-200">
                                            {/* Blurred Movie Background */}
                                            <img
                                                src={movieScreenshot}
                                                alt="Movie background"
                                                className="absolute inset-0 w-full h-full object-cover blur-[1px]"
                                            />
                                            {/* Quick Capture Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center p-3">
                                                <div className="w-full bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-2.5 border border-gray-200">
                                                    <div className="text-xs text-gray-400 mb-1">Quick Capture</div>
                                                    <div className="h-px bg-gray-200 mb-1.5"></div>
                                                    <div className="text-sm text-gray-600">Type your thought...</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center gap-1.5 justify-center">
                                            <span className="text-xs font-mono font-bold text-gray-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                                                Ctrl+Shift+N
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">During any task</span>
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <ChevronRight className="w-5 h-5 text-amber-400 flex-shrink-0 mt-12" />

                                    {/* Step 2: Type with Cursor */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-52 h-28 rounded-xl bg-white border-2 border-amber-200 flex flex-col justify-center p-3 shadow-lg">
                                            <div className="text-xs text-gray-400 mb-1.5">Quick Capture</div>
                                            <div className="h-px bg-gray-200 mb-2"></div>
                                            <div className="text-sm text-gray-700 font-medium flex items-center">
                                                Buy RAM when prices drop
                                                <svg className="w-2.5 h-4 text-amber-600 ml-0.5 animate-pulse" viewBox="0 0 10 20" fill="currentColor">
                                                    <path d="M0 0 L10 0 L10 2 L6 2 L6 18 L10 18 L10 20 L0 20 L0 18 L4 18 L4 2 L0 2 Z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">Capture your thought</p>
                                    </div>

                                    {/* Arrow */}
                                    <ChevronRight className="w-5 h-5 text-amber-400 flex-shrink-0 mt-12" />

                                    {/* Step 3: Auto-saved - File Tree Visual */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-52 h-28 rounded-xl bg-white border-2 border-amber-200 flex flex-col justify-center p-3 shadow-lg">
                                            <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                Saved to Workspace
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Folder className="w-3 h-3" />
                                                    <span>Workspace</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 ml-3">
                                                    <Folder className="w-3 h-3" />
                                                    <span>Quick Notes</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-700 ml-6 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                    <BookOpen className="w-3 h-3 text-amber-600" />
                                                    <span>2025-01-23.nt</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">
                                            <span className="font-mono font-bold text-gray-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">ESC</span> closes instantly, back to task
                                        </p>
                                    </div>
                                </div>

                                {/* Mobile/Small Screens: Vertical Layout */}
                                <div className="flex md:hidden flex-col items-center gap-3">
                                    {/* Step 1: During Task with Movie Background */}
                                    <div className="flex flex-col items-center w-full max-w-xs">
                                        <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-lg border-2 border-amber-200">
                                            {/* Blurred Movie Background */}
                                            <img
                                                src={movieScreenshot}
                                                alt="Movie background"
                                                className="absolute inset-0 w-full h-full object-cover blur-[1px]"
                                            />
                                            {/* Quick Capture Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center p-3">
                                                <div className="w-full bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-2.5 border border-gray-200">
                                                    <div className="text-xs text-gray-400 mb-1">Quick Capture</div>
                                                    <div className="h-px bg-gray-200 mb-1.5"></div>
                                                    <div className="text-sm text-gray-600">Type your thought...</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center gap-1.5 justify-center">
                                            <span className="text-xs font-mono font-bold text-gray-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                                                Ctrl+Shift+N
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">During any task</span>
                                        </div>
                                    </div>

                                    {/* Arrow Down */}
                                    <ChevronRight className="w-5 h-5 text-amber-400 flex-shrink-0 rotate-90" />

                                    {/* Step 2: Type with Cursor */}
                                    <div className="flex flex-col items-center w-full max-w-xs">
                                        <div className="w-full h-32 rounded-xl bg-white border-2 border-amber-200 flex flex-col justify-center p-3 shadow-lg">
                                            <div className="text-xs text-gray-400 mb-1.5">Quick Capture</div>
                                            <div className="h-px bg-gray-200 mb-2"></div>
                                            <div className="text-sm text-gray-700 font-medium flex items-center">
                                                Buy RAM when prices drop
                                                <svg className="w-2.5 h-4 text-amber-600 ml-0.5 animate-pulse" viewBox="0 0 10 20" fill="currentColor">
                                                    <path d="M0 0 L10 0 L10 2 L6 2 L6 18 L10 18 L10 20 L0 20 L0 18 L4 18 L4 2 L0 2 Z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">Capture your thought</p>
                                    </div>

                                    {/* Arrow Down */}
                                    <ChevronRight className="w-5 h-5 text-amber-400 flex-shrink-0 rotate-90" />

                                    {/* Step 3: Auto-saved - File Tree Visual */}
                                    <div className="flex flex-col items-center w-full max-w-xs">
                                        <div className="w-full h-32 rounded-xl bg-white border-2 border-amber-200 flex flex-col justify-center p-3 shadow-lg">
                                            <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                Saved to Workspace
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Folder className="w-3 h-3" />
                                                    <span>Workspace</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 ml-3">
                                                    <Folder className="w-3 h-3" />
                                                    <span>Quick Notes</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-700 ml-6 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                    <BookOpen className="w-3 h-3 text-amber-600" />
                                                    <span>2025-01-23.nt</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">
                                            <span className="font-mono font-bold text-gray-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">ESC</span> closes instantly, back to task
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleGetStarted}
                                className="px-8 py-3 rounded-xl text-amber-700 font-semibold transition-all border-2 border-amber-600 hover:bg-amber-50 flex items-center gap-2 mx-auto mb-4"
                            >
                                Get Started
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Contributors & Version Section */}
                        <div className="mt-4 pt-3 border-t border-gray-200">
                            <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 mb-2">
                                Created with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> by
                            </div>
                            {contributors.length > 0 ? (
                                <div className="flex justify-center gap-2 flex-wrap mb-2">
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
                                <p className="text-xs text-gray-400 text-center mb-2">@umfhero</p>
                            )}
                            <p className="text-xs text-gray-500 text-center mb-2">
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
                                                ? "bg-amber-600 text-white"
                                                : "bg-gray-200 text-gray-400"
                                        )}
                                    >
                                        {step > s ? <Check className="w-5 h-5" /> : s}
                                    </div>
                                    {s < 4 && (
                                        <div
                                            className={clsx(
                                                "flex-1 h-1 mx-2 rounded transition-all",
                                                step > s ? "bg-amber-600" : "bg-gray-200"
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
                                                    ? "border-amber-600 bg-amber-50"
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
                                                    ? "border-amber-600 bg-amber-50"
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
                                                    ? "border-amber-600 bg-amber-50"
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
                                                Enable AI-powered features with Gemini or Perplexity
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                                                Google Gemini API Key
                                            </label>
                                            <input
                                                type="password"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                placeholder="Paste your API key here (optional)"
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500/20 outline-none"
                                            />
                                            <a
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    // @ts-ignore
                                                    window.ipcRenderer.invoke('open-external', 'https://aistudio.google.com/app/apikey');
                                                }}
                                                className="text-xs text-amber-600 hover:underline mt-2 inline-block"
                                            >
                                                Get a free API key from Google AI Studio →
                                            </a>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                                                Perplexity API Key
                                            </label>
                                            <input
                                                type="password"
                                                value={perplexityApiKey}
                                                onChange={(e) => setPerplexityApiKey(e.target.value)}
                                                placeholder="Paste your Perplexity API key here (optional)"
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500/20 outline-none"
                                            />
                                            <a
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    // @ts-ignore
                                                    window.ipcRenderer.invoke('open-external', 'https://www.perplexity.ai/settings/api');
                                                }}
                                                className="text-xs text-amber-600 hover:underline mt-2 inline-block"
                                            >
                                                Get your API key from Perplexity →
                                            </a>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                                        <p className="text-sm text-gray-600">
                                            <strong>Note:</strong> You can skip this step and add your API key later in Settings.
                                            AI features will be disabled until configured.
                                        </p>
                                    </div>

                                    {/* AI Disclaimer - Bottom */}
                                    <div className="mt-6 p-3 rounded-lg bg-gray-500/10 border border-gray-300/30">
                                        <p className="text-xs text-gray-600">
                                            AI features are optional and only speed up time-wasting tasks (e.g., generating note structures, NLP calendar entry).
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
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-amber-500/20 outline-none"
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
                                                            ? "border-amber-600 bg-amber-50/50"
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
                                                                isSelected ? "text-amber-700" : "text-gray-700"
                                                            )}>
                                                                {config.name}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {config.description}
                                                            </span>
                                                        </div>
                                                        {isSelected && <Check className="w-4 h-4 text-amber-600 flex-shrink-0" />}
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
                                    "px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 border-2",
                                    "border-amber-600 text-amber-700 hover:bg-amber-50",
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

