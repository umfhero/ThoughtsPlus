import { Home, Calendar as CalendarIcon, PieChart, Settings, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, PenTool, Github, Code, Timer, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { Page, NotesData } from '../types';
import logoPng from '../assets/Thoughts+.png';

interface SidebarProps {
    currentPage: Page;
    setPage: (page: Page) => void;
    notes: NotesData;
    onMonthSelect?: (monthIndex: number) => void;
    currentMonth?: Date;
    isCollapsed: boolean;
    toggleSidebar: () => void;
    showDev?: boolean;
    isEditMode: boolean;
}

const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function Sidebar({ currentPage, setPage, notes, onMonthSelect, currentMonth, isCollapsed, toggleSidebar, showDev, isEditMode }: SidebarProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(true);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [enabledFeatures, setEnabledFeatures] = useState({
        calendar: true,
        drawing: true,
        stats: true,
        github: true,
        timer: true
    });
    const [order, setOrder] = useState<string[]>([]);

    // Sync Order
    useEffect(() => {
        const savedOrder = localStorage.getItem('sidebar-order');
        const defaultItems = ['dashboard', 'progress', 'calendar', 'timer', 'drawing', 'stats', 'github'];

        let newOrder: string[] = [];

        if (savedOrder) {
            try {
                const parsed = JSON.parse(savedOrder);
                // Filter to only include default items
                newOrder = parsed.filter((id: string) => defaultItems.includes(id));

                // Add missing default items
                defaultItems.forEach(id => {
                    if (!newOrder.includes(id)) newOrder.push(id);
                });
            } catch (e) {
                newOrder = [...defaultItems];
            }
        } else {
            newOrder = [...defaultItems];
        }

        // Only update if different to avoid loops
        if (JSON.stringify(newOrder) !== JSON.stringify(order)) {
            setOrder(newOrder);
        }
    }, [enabledFeatures]);

    // Save order when it changes
    useEffect(() => {
        if (order.length > 0) {
            localStorage.setItem('sidebar-order', JSON.stringify(order));
        }
    }, [order]);

    // Load feature toggles from localStorage
    useEffect(() => {
        const loadFeatureToggles = () => {
            const saved = localStorage.getItem('feature-toggles');
            if (saved) {
                setEnabledFeatures(JSON.parse(saved));
            }
        };

        loadFeatureToggles();

        // Listen for changes from settings
        const handleFeatureToggleChange = (event: CustomEvent) => {
            setEnabledFeatures(event.detail);
        };

        window.addEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);

        return () => {
            window.removeEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);
        };
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey) {
                if (!e.repeat && currentPage !== 'drawing') {
                    setShowShortcuts(true);
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        setShowShortcuts(false);
                    }, 3000);
                }

                // Build dynamic pages array based on sidebar order and enabled features
                const pages: Page[] = order.filter(id => {
                    if (id === 'dashboard' || id === 'progress') return true;
                    if (id === 'calendar') return enabledFeatures.calendar;
                    if (id === 'timer') return enabledFeatures.timer;
                    if (id === 'drawing') return enabledFeatures.drawing;
                    if (id === 'stats') return enabledFeatures.stats;
                    if (id === 'github') return enabledFeatures.github;
                    return false;
                }) as Page[];
                // Add settings at the end (it's always last, not in reorderable list)
                pages.push('settings');

                const currentIndex = pages.indexOf(currentPage);

                // Disable global navigation shortcuts when on drawing page to allow local shortcuts
                // BUT allow page navigation (ArrowUp/ArrowDown)
                if (currentPage === 'drawing' && !['arrowup', 'arrowdown'].includes(e.key.toLowerCase())) return;

                switch (e.key.toLowerCase()) {
                    case 'd':
                        e.preventDefault();
                        setPage('dashboard');
                        break;
                    case 'c':
                        if (enabledFeatures.calendar) {
                            e.preventDefault();
                            setPage('calendar');
                        }
                        break;
                    case 't':
                        if (enabledFeatures.timer) {
                            e.preventDefault();
                            setPage('timer');
                        }
                        break;
                    case 'b':
                        if (enabledFeatures.drawing) {
                            e.preventDefault();
                            setPage('drawing');
                        }
                        break;
                    case 'g':
                        if (enabledFeatures.github) {
                            e.preventDefault();
                            setPage('github');
                        }
                        break;
                    case 'p':
                        e.preventDefault();
                        setPage('progress');
                        break;
                    case 's':
                        e.preventDefault();
                        setPage('settings');
                        break;
                    case 'escape':
                        e.preventDefault();
                        if (!isCollapsed) toggleSidebar();
                        break;
                    case 'arrowup':
                        e.preventDefault();
                        if (currentIndex > 0) {
                            setPage(pages[currentIndex - 1]);
                        } else {
                            // Wrap around to last item (settings)
                            setPage(pages[pages.length - 1]);
                        }
                        break;
                    case 'arrowdown':
                        e.preventDefault();
                        if (currentIndex < pages.length - 1) {
                            setPage(pages[currentIndex + 1]);
                        } else {
                            // Wrap around to first item
                            setPage(pages[0]);
                        }
                        break;
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.ctrlKey && currentPage !== 'drawing') {
                setShowShortcuts(false);
                if (timeoutId) clearTimeout(timeoutId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [toggleSidebar, setPage, currentPage, isCollapsed, enabledFeatures, order]);

    // Auto-minimize calendar dropdown if not on calendar page
    useEffect(() => {
        if (currentPage !== 'calendar') {
            setIsCalendarOpen(false);
        } else {
            setIsCalendarOpen(true);
        }

        // Force hide shortcuts when on drawing page
        if (currentPage === 'drawing') {
            setShowShortcuts(false);
        }
    }, [currentPage]);

    const getNoteCountForMonth = (monthIndex: number) => {
        let count = 0;
        const currentYear = new Date().getFullYear();

        Object.keys(notes).forEach(dateStr => {
            const date = new Date(dateStr);
            if (date.getMonth() === monthIndex && date.getFullYear() === currentYear) {
                count += notes[dateStr].length;
            }
        });
        return count;
    };

    return (
        <>
            <motion.div
                animate={{
                    width: isCollapsed ? 0 : 260,
                    opacity: isCollapsed ? 0 : 1
                }}
                transition={{
                    type: "spring",
                    stiffness: 180,
                    damping: 24,
                    mass: 1
                }}
                className="h-full flex flex-col relative z-30 overflow-hidden"
            >
                <motion.div
                    animate={{ x: isCollapsed ? -260 : 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 180,
                        damping: 24,
                        mass: 1
                    }}
                    className="h-full w-[225px] py-4 pl-4 pr-2"
                >
                    <div className="h-full rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col overflow-hidden transition-colors">
                        {/* Logo Area */}
                        <div className="p-6 flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                <img src={logoPng} alt="Logo" className="w-10 h-10" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">Thoughts+</span>
                            </div>
                        </div>

                        {/* Navigation */}
                        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="flex-1 flex flex-col pl-8 pr-4 py-2 space-y-2 overflow-y-auto custom-scrollbar">
                            {order.map(id => {
                                // Dashboard
                                if (id === 'dashboard') {
                                    return (
                                        <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative z-0">
                                            <motion.button
                                                onClick={() => setPage('dashboard')}
                                                className={clsx(
                                                    "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                    currentPage === 'dashboard'
                                                        ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'dashboard' && (
                                                    <motion.div
                                                        layoutId="activeBg"
                                                        className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                        initial={{ left: 0, width: "100%" }}
                                                        animate={{
                                                            left: showShortcuts ? -24 : 0,
                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                        }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}

                                                {/* Badge */}
                                                <AnimatePresence>
                                                    {showShortcuts && currentPage !== 'drawing' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -20 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                        >
                                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                Ctrl+D
                                                            </span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                    {/* Icon wrapper */}
                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                        <motion.div
                                                            animate={{
                                                                opacity: showShortcuts && currentPage !== 'drawing' ? 0 : 1,
                                                                scale: showShortcuts && currentPage !== 'drawing' ? 0.5 : 1,
                                                                x: showShortcuts && currentPage !== 'drawing' ? -15 : 0
                                                            }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            whileHover={{ scale: 1.1 }}
                                                        >
                                                            <Home className="w-5 h-5" style={currentPage === 'dashboard' ? { color: 'var(--accent-primary)' } : undefined} />
                                                        </motion.div>
                                                    </div>
                                                    <span className="font-medium text-sm">Dashboard</span>
                                                </div>
                                            </motion.button>
                                        </Reorder.Item>
                                    );
                                }

                                // Progress
                                if (id === 'progress') {
                                    return (
                                        <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative overflow-visible">
                                            <button
                                                onClick={() => setPage('progress')}
                                                className={clsx(
                                                    "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative overflow-visible",
                                                    currentPage === 'progress'
                                                        ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'progress' && (
                                                    <motion.div
                                                        layoutId="activeBg"
                                                        className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                        initial={{ left: 0, width: "100%" }}
                                                        animate={{
                                                            left: showShortcuts ? -24 : 0,
                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                        }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}

                                                <AnimatePresence>
                                                    {showShortcuts && currentPage !== 'drawing' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -20 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                        >
                                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                Ctrl+P
                                                            </span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                        <motion.div
                                                            animate={{
                                                                opacity: showShortcuts && currentPage !== 'drawing' ? 0 : 1,
                                                                scale: showShortcuts && currentPage !== 'drawing' ? 0.5 : 1,
                                                                x: showShortcuts && currentPage !== 'drawing' ? -15 : 0
                                                            }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            whileHover={{ scale: 1.1 }}
                                                        >
                                                            <TrendingUp className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'progress' ? { color: 'var(--accent-primary)' } : undefined} />
                                                        </motion.div>
                                                    </div>
                                                    <span className="font-medium text-sm">Progress</span>
                                                </div>
                                            </button>
                                        </Reorder.Item>
                                    );
                                }

                                // Calendar
                                if (id === 'calendar' && enabledFeatures.calendar) {
                                    return (
                                        <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative overflow-visible">
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => {
                                                        setPage('calendar');
                                                        setIsCalendarOpen(!isCalendarOpen);
                                                    }}
                                                    className={clsx(
                                                        "w-full flex items-center justify-between p-3 rounded-xl transition-colors duration-300 group relative overflow-visible",
                                                        currentPage === 'calendar'
                                                            ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                    )}
                                                >
                                                    {currentPage === 'calendar' && (
                                                        <motion.div
                                                            layoutId="activeBg"
                                                            className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                            initial={{ left: 0, width: "100%" }}
                                                            animate={{
                                                                left: showShortcuts ? -24 : 0,
                                                                width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                            }}
                                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                        />
                                                    )}

                                                    <AnimatePresence>
                                                        {showShortcuts && currentPage !== 'drawing' && (
                                                            <motion.div
                                                                initial={{ opacity: 0, x: -20 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                exit={{ opacity: 0, x: -20 }}
                                                                transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                            >
                                                                <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                    Ctrl+C
                                                                </span>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>

                                                    <div className="flex items-center gap-3 relative z-10 w-full">
                                                        <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                            <motion.div
                                                                animate={{
                                                                    opacity: showShortcuts && currentPage !== 'drawing' ? 0 : 1,
                                                                    scale: showShortcuts && currentPage !== 'drawing' ? 0.5 : 1,
                                                                    x: showShortcuts && currentPage !== 'drawing' ? -15 : 0
                                                                }}
                                                                transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                whileHover={{ scale: 1.1 }}
                                                            >
                                                                <CalendarIcon className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'calendar' ? { color: 'var(--accent-primary)' } : undefined} />
                                                            </motion.div>
                                                        </div>
                                                        <span className="font-medium text-sm">Calendar</span>
                                                    </div>
                                                    <div className="relative z-10 flex items-center">
                                                        {isCalendarOpen ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                                                    </div>
                                                </button>

                                                <AnimatePresence>
                                                    {isCalendarOpen && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="pl-4 pr-2 py-2 space-y-0.5">
                                                                {months.map((month, index) => {
                                                                    const isCurrentMonth = currentMonth?.getMonth() === index;
                                                                    const count = getNoteCountForMonth(index);

                                                                    return (
                                                                        <button
                                                                            key={month}
                                                                            onClick={() => onMonthSelect?.(index)}
                                                                            className={clsx(
                                                                                "w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors",
                                                                                isCurrentMonth
                                                                                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                                                                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                                            )}
                                                                        >
                                                                            <span>{month}</span>
                                                                            {count > 0 && (
                                                                                <span className={clsx(
                                                                                    "px-2 py-0.5 rounded-full text-xs font-bold",
                                                                                    isCurrentMonth ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                                                                )}>
                                                                                    {count}
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </Reorder.Item>
                                    );
                                }

                                // Drawing
                                if (id === 'drawing' && enabledFeatures.drawing) {
                                    return (
                                        <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative">
                                            <button
                                                onClick={() => setPage('drawing')}
                                                className={clsx(
                                                    "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                    currentPage === 'drawing'
                                                        ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'drawing' && (
                                                    <motion.div
                                                        layoutId="activeBg"
                                                        className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                        initial={{ left: 0, width: "100%" }}
                                                        animate={{
                                                            left: showShortcuts ? -24 : 0,
                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                        }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}

                                                <AnimatePresence>
                                                    {showShortcuts && currentPage !== 'drawing' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -20 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                        >
                                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                Ctrl+B
                                                            </span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                        <motion.div
                                                            animate={{
                                                                opacity: showShortcuts && currentPage !== 'drawing' ? 0 : 1,
                                                                scale: showShortcuts && currentPage !== 'drawing' ? 0.5 : 1,
                                                                x: showShortcuts && currentPage !== 'drawing' ? -15 : 0
                                                            }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            whileHover={{ scale: 1.1 }}
                                                        >
                                                            <PenTool className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'drawing' ? { color: 'var(--accent-primary)' } : undefined} />
                                                        </motion.div>
                                                    </div>
                                                    <span className="font-medium text-sm">Board</span>
                                                </div>
                                            </button>
                                        </Reorder.Item>
                                    );
                                }

                                // Stats
                                if (id === 'stats' && enabledFeatures.stats) {
                                    return (
                                        <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative">
                                            <button
                                                onClick={() => setPage('stats')}
                                                className={clsx(
                                                    "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                    currentPage === 'stats'
                                                        ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'stats' && (
                                                    <motion.div
                                                        layoutId="activeBg"
                                                        className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                        initial={{ left: 0, width: "100%" }}
                                                        animate={{ left: 0, width: "100%" }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}
                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                    <motion.div whileHover={{ scale: 1.1 }}>
                                                        <PieChart className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'stats' ? { color: 'var(--accent-primary)' } : undefined} />
                                                    </motion.div>
                                                    <span className="font-medium text-sm whitespace-nowrap">Creator Stats</span>
                                                </div>
                                            </button>
                                        </Reorder.Item>
                                    );
                                }

                                // Github
                                if (id === 'github' && enabledFeatures.github) {
                                    return (
                                        <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative">
                                            <button
                                                onClick={() => setPage('github')}
                                                className={clsx(
                                                    "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                    currentPage === 'github'
                                                        ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'github' && (
                                                    <motion.div
                                                        layoutId="activeBg"
                                                        className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                        initial={{ left: 0, width: "100%" }}
                                                        animate={{
                                                            left: showShortcuts ? -24 : 0,
                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                        }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}

                                                <AnimatePresence>
                                                    {showShortcuts && currentPage !== 'drawing' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -20 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                        >
                                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                Ctrl+G
                                                            </span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                        <motion.div
                                                            animate={{
                                                                opacity: showShortcuts && currentPage !== 'drawing' ? 0 : 1,
                                                                scale: showShortcuts && currentPage !== 'drawing' ? 0.5 : 1,
                                                                x: showShortcuts && currentPage !== 'drawing' ? -15 : 0
                                                            }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            whileHover={{ scale: 1.1 }}
                                                        >
                                                            <Github className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'github' ? { color: 'var(--accent-primary)' } : undefined} />
                                                        </motion.div>
                                                    </div>
                                                    <span className="font-medium text-sm">Github</span>
                                                </div>
                                            </button>
                                        </Reorder.Item>
                                    );
                                }

                                // Timer
                                if (id === 'timer' && enabledFeatures.timer) {
                                    return (
                                        <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative">
                                            <button
                                                onClick={() => setPage('timer')}
                                                className={clsx(
                                                    "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                    currentPage === 'timer'
                                                        ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'timer' && (
                                                    <motion.div
                                                        layoutId="activeBg"
                                                        className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                        initial={{ left: 0, width: "100%" }}
                                                        animate={{
                                                            left: showShortcuts ? -24 : 0,
                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                        }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}

                                                <AnimatePresence>
                                                    {showShortcuts && currentPage !== 'drawing' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -20 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                        >
                                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                Ctrl+T
                                                            </span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                        <motion.div
                                                            animate={{
                                                                opacity: showShortcuts && currentPage !== 'drawing' ? 0 : 1,
                                                                scale: showShortcuts && currentPage !== 'drawing' ? 0.5 : 1,
                                                                x: showShortcuts && currentPage !== 'drawing' ? -15 : 0
                                                            }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                            whileHover={{ scale: 1.1 }}
                                                        >
                                                            <Timer className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'timer' ? { color: 'var(--accent-primary)' } : undefined} />
                                                        </motion.div>
                                                    </div>
                                                    <span className="font-medium text-sm">Timer</span>
                                                </div>
                                            </button>
                                        </Reorder.Item>
                                    );
                                }

                                return null;
                            })}
                        </Reorder.Group>

                        {/* Dev Mode Button */}
                        {showDev && (
                            <div className="pl-8 pr-4 pt-2">
                                <button
                                    onClick={() => setPage('dev')}
                                    className={clsx(
                                        "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 group relative",
                                        currentPage === 'dev'
                                            ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                    )}
                                >
                                    {currentPage === 'dev' && (
                                        <motion.div
                                            layoutId="activeBg"
                                            className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <div className="flex items-center gap-3 relative z-10">
                                        <motion.div
                                            whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
                                            transition={{ duration: 0.5 }}
                                        >
                                            <Code className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'dev' ? { color: 'var(--accent-primary)' } : undefined} />
                                        </motion.div>
                                        <span className="font-medium text-sm">
                                            Dev Tools
                                        </span>
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* Settings at bottom */}
                        <div className="pl-8 pr-4 pt-4 pb-4 relative">
                            <div className="h-px bg-gray-200 dark:bg-gray-700 mb-4" />
                            <button
                                onClick={() => setPage('settings')}
                                className={clsx(
                                    "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                    currentPage === 'settings'
                                        ? "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                )}
                            >
                                {currentPage === 'settings' && (
                                    <motion.div
                                        layoutId="activeBg"
                                        className="absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                        initial={{ left: 0, width: "100%" }}
                                        animate={{
                                            left: showShortcuts ? -24 : 0,
                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                        }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                <AnimatePresence>
                                    {showShortcuts && currentPage !== 'drawing' && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                        >
                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                Ctrl+S
                                            </span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex items-center gap-3 relative z-10 w-full">
                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                        <motion.div
                                            animate={{
                                                opacity: showShortcuts && currentPage !== 'drawing' ? 0 : 1,
                                                scale: showShortcuts && currentPage !== 'drawing' ? 0.5 : 1,
                                                x: showShortcuts && currentPage !== 'drawing' ? -15 : 0
                                            }}
                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                            whileHover={{ scale: 1.1 }}
                                        >
                                            <Settings className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'settings' ? { color: 'var(--accent-primary)' } : undefined} />
                                        </motion.div>
                                    </div>
                                    <span className="font-medium text-sm">
                                        Settings
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* Floating Toggle Button */}
            <div className="absolute bottom-8 left-4 z-50">
                <button
                    onClick={toggleSidebar}
                    className={clsx(
                        "p-3 rounded-xl bg-white shadow-lg border border-gray-100 transition-all duration-300 hover:scale-110 hover:shadow-xl text-gray-600 hover:text-blue-600",
                        !isCollapsed && "translate-x-[250px]",
                        "opacity-50 hover:opacity-100"
                    )}
                >
                    {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
            </div>
        </>
    );
}
