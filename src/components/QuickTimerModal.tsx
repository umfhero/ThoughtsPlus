import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Timer as TimerIcon } from 'lucide-react';
import { useTimer, formatTimeVerbose } from '../contexts/TimerContext';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect } from 'react';

interface QuickTimerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

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
];

export function QuickTimerModal({ isOpen, onClose }: QuickTimerModalProps) {
    const { history, startTimer, startStopwatch } = useTimer();
    const { accentColor } = useTheme();
    const [selectedTab, setSelectedTab] = useState<'presets' | 'recent'>('presets');

    // Get unique recent durations from history
    const recentDurations = history
        .filter(h => h.type === 'timer')
        .slice(0, 6)
        .reduce((acc, item) => {
            if (!acc.some(d => d.duration === item.duration)) {
                acc.push({ duration: item.duration, label: item.label });
            }
            return acc;
        }, [] as { duration: number; label?: string }[])
        .slice(0, 4);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleStartPreset = (preset: QuickTimerPreset) => {
        startTimer(preset.seconds, preset.label);
        onClose();
    };

    const handleStartRecent = (duration: number, label?: string) => {
        startTimer(duration, label);
        onClose();
    };

    const handleStartStopwatch = () => {
        startStopwatch();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full max-w-sm mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            {/* Header */}
                            <div
                                className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between"
                                style={{ background: `linear-gradient(135deg, ${accentColor}15, transparent)` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="p-2 rounded-xl"
                                        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                                    >
                                        <TimerIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-900 dark:text-white">Quick Timer</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Start a timer instantly</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 p-2 bg-gray-50 dark:bg-gray-800/50 mx-4 mt-4 rounded-xl">
                                <button
                                    onClick={() => setSelectedTab('presets')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${selectedTab === 'presets'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    Presets
                                </button>
                                <button
                                    onClick={() => setSelectedTab('recent')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${selectedTab === 'recent'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    Recent
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                {selectedTab === 'presets' ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        {quickPresets.map((preset) => (
                                            <motion.button
                                                key={preset.label}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleStartPreset(preset)}
                                                className="py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors text-center"
                                            >
                                                {preset.label}
                                            </motion.button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recentDurations.length > 0 ? (
                                            recentDurations.map((item, index) => (
                                                <motion.button
                                                    key={index}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleStartRecent(item.duration, item.label)}
                                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="p-2 rounded-lg"
                                                            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                                                        >
                                                            <TimerIcon className="w-4 h-4" />
                                                        </div>
                                                        <span className="font-medium text-gray-700 dark:text-gray-200">
                                                            {formatTimeVerbose(item.duration)}
                                                        </span>
                                                    </div>
                                                    {item.label && (
                                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                                            {item.label}
                                                        </span>
                                                    )}
                                                </motion.button>
                                            ))
                                        ) : (
                                            <div className="text-center py-6">
                                                <Clock className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                                <p className="text-sm text-gray-400">No recent timers</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Stopwatch Button */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleStartStopwatch}
                                    className="w-full mt-4 py-3 px-4 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-colors"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <Clock className="w-5 h-5" />
                                    Start Countdown
                                </motion.button>
                            </div>

                            {/* Footer */}
                            <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-center text-gray-400">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono">Esc</kbd> to close
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
