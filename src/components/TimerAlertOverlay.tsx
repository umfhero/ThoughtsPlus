import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, StopCircle } from 'lucide-react';
import { useTimer, formatTime } from '../contexts/TimerContext';
import { useTheme } from '../contexts/ThemeContext';

export function TimerAlertOverlay() {
    const { isAlertVisible, activeTimer, dismissAlert } = useTimer();
    const { accentColor } = useTheme();

    return (
        <AnimatePresence>
            {isAlertVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -100, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-auto min-w-80 max-w-md"
                >
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-80">
                        {/* Animated gradient bar */}
                        <motion.div
                            className="h-1 w-full"
                            style={{ backgroundColor: accentColor }}
                            animate={{
                                opacity: [1, 0.5, 1],
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                            }}
                        />

                        <div className="p-4">
                            <div className="flex items-center gap-4">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 10, -10, 0],
                                    }}
                                    transition={{
                                        duration: 0.5,
                                        repeat: Infinity,
                                        repeatDelay: 0.5
                                    }}
                                    className="p-3 rounded-xl"
                                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                                >
                                    <Bell className="w-6 h-6" />
                                </motion.div>

                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Timer Complete!
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {activeTimer?.label || 'Your timer has finished'}
                                    </p>
                                </div>

                                <button
                                    onClick={dismissAlert}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={dismissAlert}
                                    className="flex-1 py-3 px-4 rounded-xl font-medium text-white transition-colors"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    Dismiss
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Mini timer indicator that shows on all pages when timer is active
export function TimerMiniIndicator({ isSidebarCollapsed = false }: { isSidebarCollapsed?: boolean }) {
    const { activeTimer, pauseTimer, resumeTimer, stopTimer } = useTimer();

    if (!activeTimer) return null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -20, left: '50%', x: '-50%' }}
            animate={{
                opacity: 1,
                y: 0,
                x: isSidebarCollapsed ? '-50%' : 'calc(-50% + 105px)'
            }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
                type: "spring",
                stiffness: 180,
                damping: 24,
                mass: 1
            }}
            className="fixed top-4 z-[9998]"
        >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-3">
                <motion.div
                    animate={activeTimer.isRunning ? {
                        scale: [1, 1.1, 1],
                    } : {}}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                    }}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: activeTimer.isRunning ? '#22c55e' : '#eab308' }}
                />

                <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                    {formatTime(activeTimer.remaining)}
                </span>

                <div className="flex gap-1">
                    <button
                        onClick={activeTimer.isRunning ? pauseTimer : resumeTimer}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={activeTimer.isRunning ? 'Pause' : 'Resume'}
                    >
                        {activeTimer.isRunning ? (
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={stopTimer}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500"
                        title="Stop"
                    >
                        <StopCircle className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
