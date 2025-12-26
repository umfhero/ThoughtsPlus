import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, StopCircle, RotateCcw, Clock, Timer as TimerIcon, History, Trash2, Plus, Minus, ChevronDown, ChevronUp, BarChart2, Zap, Info } from 'lucide-react';
import { useTimer, formatTime, formatTimeVerbose } from '../contexts/TimerContext';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

interface QuickTimerPreset {
    label: string;
    seconds: number;
}

const quickPresets: QuickTimerPreset[] = [
    { label: '1m', seconds: 60 },
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
    { label: '15m', seconds: 900 },
    { label: '25m', seconds: 1500 },
    { label: '30m', seconds: 1800 },
    { label: '45m', seconds: 2700 },
    { label: '1h', seconds: 3600 },
];

type TabType = 'timer' | 'stopwatch';

export function TimerPage({ isSidebarCollapsed: _isSidebarCollapsed = false }: { isSidebarCollapsed?: boolean }) {
    const { activeTimer, history, startTimer, startStopwatch, pauseTimer, resumeTimer, stopTimer, clearHistory, deleteHistoryItem } = useTimer();
    const { accentColor } = useTheme();

    const [activeTab, setActiveTab] = useState<TabType>('timer');
    const [customMinutes, setCustomMinutes] = useState(5);
    const [customSeconds, setCustomSeconds] = useState(0);
    const [customLabel, setCustomLabel] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [showQuickStart, setShowQuickStart] = useState(true);
    const [showStats, setShowStats] = useState(true);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Responsive detection
    useEffect(() => {
        const checkSize = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                setIsCompactMode(width < 700);
            }
        };

        checkSize();
        const observer = new ResizeObserver(checkSize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    // Focus management
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Space to start/pause
            if (e.code === 'Space' && !e.target?.toString().includes('Input')) {
                e.preventDefault();
                if (activeTimer) {
                    activeTimer.isRunning ? pauseTimer() : resumeTimer();
                } else if (activeTab === 'timer') {
                    handleStartTimer();
                } else {
                    startStopwatch(customLabel || undefined);
                }
            }
            // Escape to stop
            if (e.code === 'Escape' && activeTimer) {
                stopTimer();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTimer, activeTab, customMinutes, customSeconds, customLabel]);

    const handleStartTimer = () => {
        const totalSeconds = customMinutes * 60 + customSeconds;
        if (totalSeconds > 0) {
            startTimer(totalSeconds, customLabel || undefined);
        }
    };

    const handleQuickStart = (preset: QuickTimerPreset) => {
        startTimer(preset.seconds, preset.label);
    };

    const adjustTime = (type: 'minutes' | 'seconds', delta: number) => {
        if (type === 'minutes') {
            setCustomMinutes(Math.max(0, Math.min(99, customMinutes + delta)));
        } else {
            setCustomSeconds(Math.max(0, Math.min(59, customSeconds + delta)));
        }
    };

    // Calculate progress for circular indicator
    const progress = activeTimer?.type === 'timer' && activeTimer.duration > 0
        ? ((activeTimer.duration - activeTimer.remaining) / activeTimer.duration) * 100
        : 0;

    const circumference = 2 * Math.PI * 140; // radius = 140

    // Calculate stats - memoized to prevent re-renders on timer tick
    const statsData = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todaysTimers = history.filter(h => new Date(h.completedAt) >= todayStart);
        const totalTodaySeconds = todaysTimers.reduce((acc, h) => acc + h.duration, 0);
        const timerCount = history.filter(h => h.type === 'timer').length;
        const stopwatchCount = history.filter(h => h.type === 'stopwatch').length;
        return { todaysTimers, totalTodaySeconds, timerCount, stopwatchCount };
    }, [history]); // Only recalculate when history changes, not on every tick

    const { todaysTimers, totalTodaySeconds, timerCount, stopwatchCount } = statsData;

    // Memoize Quick Stats Sidebar to prevent flickering on timer tick
    const QuickStatsSidebar = useMemo(() => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={clsx(
                "flex flex-col gap-3",
                isCompactMode ? "w-full" : "w-64 shrink-0"
            )}
        >
            {/* Collapsible Header for compact mode */}
            {isCompactMode && (
                <button
                    onClick={() => setShowStats(!showStats)}
                    className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" style={{ color: accentColor }} />
                        <span className="font-medium text-gray-700 dark:text-gray-200">Quick Stats</span>
                    </div>
                    {showStats ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
            )}

            <AnimatePresence>
                {(showStats || !isCompactMode) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={clsx(
                            "flex gap-3 overflow-hidden",
                            isCompactMode ? "flex-row flex-wrap" : "flex-col"
                        )}
                    >
                        {/* Today's Focus Time */}
                        <div className={clsx(
                            "p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm",
                            isCompactMode ? "flex-1 min-w-[140px]" : ""
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Today's Focus</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                {formatTimeVerbose(totalTodaySeconds)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{todaysTimers.length} sessions</p>
                        </div>

                        {/* Timer vs Stopwatch Stats */}
                        <div className={clsx(
                            "p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm",
                            isCompactMode ? "flex-1 min-w-[140px]" : ""
                        )}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Session Types</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                        <span className="text-sm text-gray-600 dark:text-gray-300">Timers</span>
                                    </div>
                                    <span className="font-bold text-gray-800 dark:text-white">{timerCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <span className="text-sm text-gray-600 dark:text-gray-300">Stopwatches</span>
                                    </div>
                                    <span className="font-bold text-gray-800 dark:text-white">{stopwatchCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Info */}
                        <div className={clsx(
                            "p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm",
                            isCompactMode ? "flex-1 min-w-[140px]" : ""
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4" style={{ color: accentColor }} />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Quick Tips</span>
                            </div>
                            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                <li>• <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-[10px]">Space</kbd> Start/Pause</li>
                                <li>• <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-[10px]">Esc</kbd> Stop timer</li>
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    ), [isCompactMode, showStats, setShowStats, accentColor, totalTodaySeconds, todaysTimers, timerCount, stopwatchCount]);

    return (
        <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar">
            <div className={clsx(
                "p-4 md:p-6 lg:p-10",
                isCompactMode ? "max-w-full" : "max-w-6xl mx-auto"
            )}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 className={clsx(
                                "font-bold text-gray-800 dark:text-gray-100 mb-1",
                                isCompactMode ? "text-2xl" : "text-3xl md:text-4xl"
                            )}>Timer</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Stay focused and track your time</p>
                        </div>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={clsx(
                                "p-2.5 rounded-xl transition-colors",
                                showHistory
                                    ? "bg-gray-200 dark:bg-gray-700"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                            )}
                        >
                            <History className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>
                </motion.div>

                <div className={clsx(
                    "flex gap-6",
                    isCompactMode ? "flex-col" : "flex-row"
                )}>
                    {/* Main Timer Area */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex-1 min-w-0"
                    >
                        {/* Tab Switcher */}
                        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
                            {(['timer', 'stopwatch'] as TabType[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={clsx(
                                        "flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm",
                                        activeTab === tab
                                            ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                >
                                    {tab === 'timer' ? <TimerIcon className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                    {tab === 'timer' ? 'Timer' : 'Stopwatch'}
                                </button>
                            ))}
                        </div>

                        {/* Timer Display */}
                        <div className="flex flex-col items-center">
                            {/* Circular Progress Ring */}
                            <div className={clsx(
                                "relative mb-6",
                                isCompactMode ? "w-56 h-56" : "w-72 h-72 md:w-80 md:h-80"
                            )}>
                                <svg className="w-full h-full transform -rotate-90">
                                    {/* Background circle */}
                                    <circle
                                        cx="50%"
                                        cy="50%"
                                        r={isCompactMode ? "100" : "140"}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={isCompactMode ? "6" : "8"}
                                        className="text-gray-200 dark:text-gray-700"
                                    />
                                    {/* Progress circle */}
                                    {activeTimer && (
                                        <motion.circle
                                            cx="50%"
                                            cy="50%"
                                            r={isCompactMode ? "100" : "140"}
                                            fill="none"
                                            stroke={accentColor}
                                            strokeWidth={isCompactMode ? "6" : "8"}
                                            strokeLinecap="round"
                                            strokeDasharray={isCompactMode ? 2 * Math.PI * 100 : circumference}
                                            strokeDashoffset={activeTimer.type === 'timer'
                                                ? (isCompactMode
                                                    ? 2 * Math.PI * 100 - (progress / 100) * 2 * Math.PI * 100
                                                    : circumference - (progress / 100) * circumference)
                                                : 0
                                            }
                                            initial={{ strokeDashoffset: isCompactMode ? 2 * Math.PI * 100 : circumference }}
                                            animate={{
                                                strokeDashoffset: activeTimer.type === 'timer'
                                                    ? (isCompactMode
                                                        ? 2 * Math.PI * 100 - (progress / 100) * 2 * Math.PI * 100
                                                        : circumference - (progress / 100) * circumference)
                                                    : 0
                                            }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    )}
                                </svg>

                                {/* Time Display */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    {activeTimer ? (
                                        <>
                                            <motion.span
                                                key={activeTimer.remaining}
                                                initial={{ scale: 1.05, opacity: 0.8 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className={clsx(
                                                    "font-mono font-bold text-gray-900 dark:text-white tracking-tight",
                                                    isCompactMode ? "text-4xl" : "text-5xl md:text-6xl"
                                                )}
                                            >
                                                {formatTime(activeTimer.remaining)}
                                            </motion.span>
                                            {activeTimer.label && (
                                                <span className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                                    {activeTimer.label}
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                {activeTimer.isRunning ? 'Running' : 'Paused'}
                                            </span>
                                        </>
                                    ) : activeTab === 'timer' ? (
                                        <div className="flex items-center gap-1">
                                            <div className="flex flex-col items-center">
                                                <button
                                                    onClick={() => adjustTime('minutes', 1)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Plus className="w-4 h-4 text-gray-400" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={customMinutes}
                                                    onChange={(e) => setCustomMinutes(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                                                    className={clsx(
                                                        "text-center font-mono font-bold text-gray-900 dark:text-white bg-transparent outline-none",
                                                        isCompactMode ? "w-14 text-3xl" : "w-20 text-5xl"
                                                    )}
                                                    min="0"
                                                    max="99"
                                                />
                                                <button
                                                    onClick={() => adjustTime('minutes', -1)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Minus className="w-4 h-4 text-gray-400" />
                                                </button>
                                                <span className="text-xs text-gray-400 mt-1">min</span>
                                            </div>
                                            <span className={clsx(
                                                "font-mono font-bold text-gray-400 mb-6",
                                                isCompactMode ? "text-3xl" : "text-5xl"
                                            )}>:</span>
                                            <div className="flex flex-col items-center">
                                                <button
                                                    onClick={() => adjustTime('seconds', 5)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Plus className="w-4 h-4 text-gray-400" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={customSeconds.toString().padStart(2, '0')}
                                                    onChange={(e) => setCustomSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                                    className={clsx(
                                                        "text-center font-mono font-bold text-gray-900 dark:text-white bg-transparent outline-none",
                                                        isCompactMode ? "w-14 text-3xl" : "w-20 text-5xl"
                                                    )}
                                                    min="0"
                                                    max="59"
                                                />
                                                <button
                                                    onClick={() => adjustTime('seconds', -5)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Minus className="w-4 h-4 text-gray-400" />
                                                </button>
                                                <span className="text-xs text-gray-400 mt-1">sec</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className={clsx(
                                            "font-mono font-bold text-gray-900 dark:text-white",
                                            isCompactMode ? "text-4xl" : "text-5xl md:text-6xl"
                                        )}>
                                            0:00
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Label Input */}
                            {!activeTimer && (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={customLabel}
                                    onChange={(e) => setCustomLabel(e.target.value)}
                                    placeholder="Add a label (optional)"
                                    className="w-full max-w-xs mb-4 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border-none outline-none text-center text-gray-700 dark:text-gray-200 placeholder-gray-400 text-sm"
                                />
                            )}

                            {/* Control Buttons */}
                            <div className="flex items-center gap-3">
                                {activeTimer ? (
                                    <>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={activeTimer.isRunning ? pauseTimer : resumeTimer}
                                            className="p-3.5 rounded-2xl text-white shadow-lg transition-colors"
                                            style={{ backgroundColor: accentColor }}
                                        >
                                            {activeTimer.isRunning ? (
                                                <Pause className="w-7 h-7" />
                                            ) : (
                                                <Play className="w-7 h-7" />
                                            )}
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={stopTimer}
                                            className="p-3.5 rounded-2xl bg-red-500 text-white shadow-lg"
                                        >
                                            <StopCircle className="w-7 h-7" />
                                        </motion.button>
                                    </>
                                ) : (
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                            if (activeTab === 'timer') {
                                                handleStartTimer();
                                            } else {
                                                startStopwatch(customLabel || undefined);
                                            }
                                        }}
                                        className="px-6 py-3 rounded-2xl text-white font-bold text-base shadow-lg flex items-center gap-2"
                                        style={{ backgroundColor: accentColor }}
                                    >
                                        <Play className="w-5 h-5" />
                                        Start
                                    </motion.button>
                                )}
                            </div>

                            {/* Keyboard shortcut hint - hide on compact */}
                            {!isCompactMode && (
                                <p className="text-xs text-gray-400 mt-4">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono">Space</kbd> to start/pause, <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono">Esc</kbd> to stop
                                </p>
                            )}
                        </div>

                        {/* Quick Presets - Collapsible on compact */}
                        {!activeTimer && activeTab === 'timer' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="mt-8"
                            >
                                {isCompactMode && (
                                    <button
                                        onClick={() => setShowQuickStart(!showQuickStart)}
                                        className="flex items-center justify-between w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 mb-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-4 h-4" style={{ color: accentColor }} />
                                            <span className="font-medium text-sm text-gray-700 dark:text-gray-200">Quick Start</span>
                                        </div>
                                        {showQuickStart ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </button>
                                )}

                                <AnimatePresence>
                                    {(showQuickStart || !isCompactMode) && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                        >
                                            {!isCompactMode && (
                                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 text-center">Quick Start</h3>
                                            )}
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {quickPresets.map((preset) => (
                                                    <motion.button
                                                        key={preset.label}
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => handleQuickStart(preset)}
                                                        className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-colors text-sm"
                                                    >
                                                        {preset.label}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Sidebar Column: Quick Stats + History */}
                    <div className={clsx(
                        "flex flex-col gap-3",
                        isCompactMode ? "w-full" : "w-64 shrink-0"
                    )}>
                        {/* Quick Stats Sidebar */}
                        {QuickStatsSidebar}

                        {/* History Panel - In sidebar stack */}
                        <AnimatePresence>
                            {showHistory && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-800 dark:text-gray-100">History</h3>
                                            {history.length > 0 && (
                                                <button
                                                    onClick={clearHistory}
                                                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    Clear all
                                                </button>
                                            )}
                                        </div>

                                        {history.length === 0 ? (
                                            <div className="text-center py-8">
                                                <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                                                <p className="text-sm text-gray-400">No timer history yet</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto custom-scrollbar">
                                                {history.map((item, index) => (
                                                    <motion.div
                                                        key={item.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.03 }}
                                                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {/* Color-coded type indicator */}
                                                            <div
                                                                className="p-2 rounded-lg"
                                                                style={{
                                                                    backgroundColor: item.type === 'timer'
                                                                        ? 'rgba(16, 185, 129, 0.15)'
                                                                        : 'rgba(59, 130, 246, 0.15)',
                                                                    color: item.type === 'timer'
                                                                        ? '#10b981'
                                                                        : '#3b82f6'
                                                                }}
                                                            >
                                                                {item.type === 'timer' ? (
                                                                    <TimerIcon className="w-4 h-4" />
                                                                ) : (
                                                                    <Clock className="w-4 h-4" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-medium text-gray-800 dark:text-gray-100">
                                                                        {formatTimeVerbose(item.duration)}
                                                                    </p>
                                                                    {/* Type badge */}
                                                                    <span className={clsx(
                                                                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase",
                                                                        item.type === 'timer'
                                                                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                                                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                                    )}>
                                                                        {item.type}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-gray-400">
                                                                    {item.label || new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => startTimer(item.duration, item.label)}
                                                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                                                title="Start again"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteHistoryItem(item.id)}
                                                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Frequently used */}
                                        {history.length >= 3 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                                <p className="text-xs text-gray-400 mb-2">Frequently used</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.from(new Set(history.map(h => h.duration)))
                                                        .slice(0, 4)
                                                        .map((duration) => (
                                                            <button
                                                                key={duration}
                                                                onClick={() => startTimer(duration)}
                                                                className="px-2 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                                                            >
                                                                {formatTimeVerbose(duration)}
                                                            </button>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TimerPage;
