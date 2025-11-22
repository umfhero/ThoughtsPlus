import { Home, Calendar as CalendarIcon, BarChart2, Settings, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'stats', icon: BarChart2, label: 'Creator Stats' },
] as const;

const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function Sidebar({ currentPage, setPage, notes, onMonthSelect, currentMonth, isCollapsed, toggleSidebar }: SidebarProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(true);

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
                        <div className="flex-1 px-4 py-2 space-y-2 overflow-y-auto custom-scrollbar">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setPage(item.id)}
                                    className={clsx(
                                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                        currentPage === item.id
                                            ? "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                    )}
                                >
                                    {currentPage === item.id && (
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
                                        <item.icon className={clsx("w-5 h-5 shrink-0")} style={currentPage === item.id ? { color: 'var(--accent-primary)' } : undefined} />
                                    </motion.div>
                                    <span className="font-medium text-sm relative z-10">
                                        {item.label}
                                    </span>
                                </button>
                            ))}

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
                                            ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20"
                                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                    )}
                                >
                                    {currentPage === 'calendar' && (
                                        <motion.div
                                            layoutId="activeBg"
                                            className="absolute inset-0 bg-gray-900 rounded-xl"
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
                                    <div className="relative z-10">
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
                                                                    ? "bg-blue-50 text-blue-600 font-medium"
                                                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                                            )}
                                                        >
                                                        <span>{month}</span>
                                                        {count > 0 && (
                                                            <span className={clsx(
                                                                "px-2 py-0.5 rounded-full text-xs font-bold",
                                                                isCurrentMonth ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
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

                            {/* Spacer to push Settings to bottom */}
                            <div className="flex-1" />

                            {/* Settings at bottom */}
                            <div className="pt-4 pb-2">
                                <div className="h-px bg-gray-200 mx-2 mb-4" />
                            </div>
                            <button
                                onClick={() => setPage('settings')}
                                className={clsx(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                                    currentPage === 'settings'
                                        ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20"
                                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                {currentPage === 'settings' && (
                                    <motion.div
                                        layoutId="activeBg"
                                        className="absolute inset-0 bg-gray-900 rounded-xl"
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
