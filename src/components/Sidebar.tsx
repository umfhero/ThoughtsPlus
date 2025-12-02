import { Home, Calendar as CalendarIcon, BarChart2, Settings, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, PenTool, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { Page, NotesData } from '../App';
import logoPng from '../assets/calendar_icon_181520.png';

interface SidebarProps {
    currentPage: Page;
    setPage: (page: Page) => void;
    notes: NotesData;
    onMonthSelect?: (monthIndex: number) => void;
    currentMonth?: Date;
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function Sidebar({ currentPage, setPage, notes, onMonthSelect, currentMonth, isCollapsed, toggleSidebar }: SidebarProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(true);
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Handle keyboard shortcuts
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey) {
                if (!e.repeat) {
                    setShowShortcuts(true);
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        setShowShortcuts(false);
                    }, 2000);
                }
                
                const pages: Page[] = ['dashboard', 'calendar', 'drawing', 'stats', 'github', 'settings'];
                const currentIndex = pages.indexOf(currentPage);

                switch(e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        toggleSidebar();
                        break;
                    case 'd':
                        e.preventDefault();
                        setPage('dashboard');
                        break;
                    case 'c':
                        e.preventDefault();
                        setPage('calendar');
                        break;
                    case 't':
                        e.preventDefault();
                        setPage('stats');
                        break;
                    case 'a':
                        e.preventDefault();
                        setPage('drawing');
                        break;
                    case 'g':
                        e.preventDefault();
                        setPage('github');
                        break;
                    case 'arrowup':
                        e.preventDefault();
                        if (currentIndex > 0) {
                            setPage(pages[currentIndex - 1]);
                        }
                        break;
                    case 'arrowdown':
                        e.preventDefault();
                        if (currentIndex < pages.length - 1) {
                            setPage(pages[currentIndex + 1]);
                        }
                        break;
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.ctrlKey) {
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
    }, [toggleSidebar, setPage, currentPage]);

    // Auto-minimize calendar dropdown if not on calendar page
    useEffect(() => {
        if (currentPage !== 'calendar') {
            setIsCalendarOpen(false);
        } else {
            setIsCalendarOpen(true);
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
                    width: isCollapsed ? 0 : 240,
                    opacity: isCollapsed ? 0 : 1
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="h-full flex flex-col relative z-30 overflow-hidden"
            >
                <motion.div 
                    animate={{ x: isCollapsed ? -240 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="h-full w-[240px] p-4"
                >
                    <div className="h-full rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 shadow-2xl flex flex-col overflow-hidden transition-colors">
                        {/* Logo Area */}
                        <div className="p-6 flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                <img src={logoPng} alt="Logo" className="w-10 h-10" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">Calendar+</span>
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex-1 flex flex-col px-4 py-2 space-y-2 overflow-y-auto custom-scrollbar">
                            {/* Dashboard */}
                            <button
                                onClick={() => setPage('dashboard')}
                                className={clsx(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                    currentPage === 'dashboard'
                                        ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                )}
                            >
                                {currentPage === 'dashboard' && (
                                    <motion.div
                                        layoutId="activeBg"
                                        className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <motion.div
                                    whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
                                    transition={{ duration: 0.5 }}
                                    className="relative z-10"
                                >
                                    <Home className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'dashboard' ? { color: 'var(--accent-primary)' } : undefined} />
                                </motion.div>
                                <span className="font-medium text-sm relative z-10">
                                    Dashboard
                                </span>
                                <AnimatePresence>
                                    {showShortcuts && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500 z-20"
                                        >
                                            Ctrl+D
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>

                            {/* Calendar Dropdown */}
                            <div className="space-y-1">
                                <button
                                    onClick={() => {
                                        setPage('calendar');
                                        setIsCalendarOpen(!isCalendarOpen);
                                    }}
                                    className={clsx(
                                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                        currentPage === 'calendar'
                                            ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                    )}
                                >
                                    {currentPage === 'calendar' && (
                                        <motion.div
                                            layoutId="activeBg"
                                            className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <motion.div
                                        whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
                                        transition={{ duration: 0.5 }}
                                        className="relative z-10"
                                    >
                                        <CalendarIcon className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'calendar' ? { color: 'var(--accent-primary)' } : undefined} />
                                    </motion.div>
                                    <span className="font-medium text-sm flex-1 text-left relative z-10">Calendar</span>
                                    <div className="relative z-10 flex items-center gap-2">
                                        <AnimatePresence>
                                            {showShortcuts && (
                                                <motion.span
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                    className="text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500"
                                                >
                                                    Ctrl+C
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
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

                            {/* Drawing */}
                            <button
                                onClick={() => setPage('drawing')}
                                className={clsx(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                    currentPage === 'drawing'
                                        ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                )}
                            >
                                {currentPage === 'drawing' && (
                                    <motion.div
                                        layoutId="activeBg"
                                        className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <motion.div
                                    whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
                                    transition={{ duration: 0.5 }}
                                    className="relative z-10"
                                >
                                    <PenTool className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'drawing' ? { color: 'var(--accent-primary)' } : undefined} />
                                </motion.div>
                                <span className="font-medium text-sm relative z-10">
                                    Drawing
                                </span>
                                <AnimatePresence>
                                    {showShortcuts && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500 z-20"
                                        >
                                            Ctrl+A
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>

                            {/* Creator Stats */}
                            <button
                                onClick={() => setPage('stats')}
                                className={clsx(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                    currentPage === 'stats'
                                        ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                )}
                            >
                                {currentPage === 'stats' && (
                                    <motion.div
                                        layoutId="activeBg"
                                        className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <motion.div
                                    whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
                                    transition={{ duration: 0.5 }}
                                    className="relative z-10"
                                >
                                    <BarChart2 className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'stats' ? { color: 'var(--accent-primary)' } : undefined} />
                                </motion.div>
                                <span className="font-medium text-sm relative z-10">
                                    Creator Stats
                                </span>
                                <AnimatePresence>
                                    {showShortcuts && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500 z-20"
                                        >
                                            Ctrl+T
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>

                            {/* Github */}
                            <button
                                onClick={() => setPage('github')}
                                className={clsx(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                    currentPage === 'github'
                                        ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                )}
                            >
                                {currentPage === 'github' && (
                                    <motion.div
                                        layoutId="activeBg"
                                        className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <motion.div
                                    whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
                                    transition={{ duration: 0.5 }}
                                    className="relative z-10"
                                >
                                    <Github className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'github' ? { color: 'var(--accent-primary)' } : undefined} />
                                </motion.div>
                                <span className="font-medium text-sm relative z-10">
                                    Github
                                </span>
                                <AnimatePresence>
                                    {showShortcuts && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500 z-20"
                                        >
                                            Ctrl+G
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>

                            {/* Spacer to push Settings to bottom */}
                            <div className="flex-1" />

                            {/* Settings at bottom */}
                            <div className="pt-4 pb-2">
                                <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2 mb-4" />
                            </div>
                            <button
                                onClick={() => setPage('settings')}
                                className={clsx(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                    currentPage === 'settings'
                                        ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                )}
                            >
                                {currentPage === 'settings' && (
                                    <motion.div
                                        layoutId="activeBg"
                                        className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <motion.div
                                    whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
                                    transition={{ duration: 0.5 }}
                                    className="relative z-10"
                                >
                                    <Settings className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'settings' ? { color: 'var(--accent-primary)' } : undefined} />
                                </motion.div>
                                <span className="font-medium text-sm relative z-10">
                                    Settings
                                </span>
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
                        !isCollapsed && "translate-x-[200px]",
                        "opacity-50 hover:opacity-100"
                    )}
                >
                    {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
            </div>
        </>
    );
}
