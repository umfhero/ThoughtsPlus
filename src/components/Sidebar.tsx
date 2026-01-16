import { Home, Calendar as CalendarIcon, PieChart, Settings, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Github, Code, Timer, TrendingUp, NotebookPen } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { Page, NotesData } from '../types';
import { DEFAULT_SHORTCUTS, ShortcutConfig } from './KeyboardShortcuts';
import logoPng from '../assets/Thoughts+.png';
import { useDashboardLayout } from '../contexts/DashboardLayoutContext';

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
    isIconOnly?: boolean; // New prop for icon-only mode
}

// Tooltip component for icon-only mode
function IconTooltip({ children, label, show }: { children: React.ReactNode; label: string; show: boolean }) {
    const [isHovered, setIsHovered] = useState(false);

    if (!show) return <>{children}</>;

    return (
        <div
            className="relative flex items-center justify-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none"
                    >
                        <div className="px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium whitespace-nowrap shadow-lg border border-gray-700">
                            {label}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Bottom bar tooltip (shows above the icon)
function BottomBarTooltip({ children, label, show }: { children: React.ReactNode; label: string; show: boolean }) {
    const [isHovered, setIsHovered] = useState(false);

    if (!show) return <>{children}</>;

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-0 right-0 mb-2 z-50 pointer-events-none flex justify-center"
                    >
                        <div className="px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium whitespace-nowrap shadow-lg border border-gray-700">
                            {label}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function Sidebar({ currentPage, setPage, notes, onMonthSelect, currentMonth, isCollapsed, toggleSidebar, showDev, isEditMode, isIconOnly = false }: SidebarProps) {
    const { layoutType } = useDashboardLayout();
    const [isCalendarOpen, setIsCalendarOpen] = useState(true);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [enabledFeatures, setEnabledFeatures] = useState({
        calendar: true,
        notebook: true,
        progress: true,
        stats: false,
        github: true,
        timer: true
    });

    // Shortcuts state
    const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>(DEFAULT_SHORTCUTS);

    // Load shortcuts and listen for changes
    useEffect(() => {
        const loadShortcuts = () => {
            const saved = localStorage.getItem('keyboard-shortcuts');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Merge with defaults
                    const merged = DEFAULT_SHORTCUTS.map(def => {
                        const found = parsed.find((s: ShortcutConfig) => s.id === def.id);
                        return found ? { ...def, ...found } : def;
                    });
                    setShortcuts(merged);
                } catch {
                    setShortcuts(DEFAULT_SHORTCUTS);
                }
            } else {
                setShortcuts(DEFAULT_SHORTCUTS);
            }
        };

        loadShortcuts();

        const handleShortcutsChanged = (e: CustomEvent) => {
            setShortcuts(e.detail);
        };

        window.addEventListener('shortcuts-changed', handleShortcutsChanged as EventListener);
        return () => window.removeEventListener('shortcuts-changed', handleShortcutsChanged as EventListener);
    }, []);

    const [order, setOrder] = useState<string[]>([]);

    // Sync Order - with version key to force new default order
    useEffect(() => {
        const SIDEBAR_ORDER_VERSION = 'v2'; // Increment this to reset order for all users
        const savedVersion = localStorage.getItem('sidebar-order-version');
        const savedOrder = localStorage.getItem('sidebar-order');
        const defaultItems = ['dashboard', 'notebook', 'calendar', 'timer', 'github', 'progress'];

        let newOrder: string[] = [];

        // If version mismatch or no saved order, use defaults
        if (savedVersion !== SIDEBAR_ORDER_VERSION || !savedOrder) {
            newOrder = [...defaultItems];
            localStorage.setItem('sidebar-order-version', SIDEBAR_ORDER_VERSION);
            localStorage.setItem('sidebar-order', JSON.stringify(newOrder));
        } else {
            try {
                const parsed = JSON.parse(savedOrder);
                // Filter to only include default items (removes old 'stats' entries)
                newOrder = parsed.filter((id: string) => defaultItems.includes(id));

                // Add missing default items at the end
                defaultItems.forEach(id => {
                    if (!newOrder.includes(id)) newOrder.push(id);
                });
            } catch (e) {
                newOrder = [...defaultItems];
            }
        }

        // Only update if different to avoid loops
        if (JSON.stringify(newOrder) !== JSON.stringify(order)) {
            setOrder(newOrder);
        }
    }, [enabledFeatures]);

    // Helper to get shortcut string
    const getShortcutString = (id: string) => {
        const s = shortcuts.find(s => s.id === id);
        if (!s || !s.enabled) return '';
        return `${s.modifier}+${s.key}`;
    };

    // Save order when it changes
    useEffect(() => {
        if (order.length > 0) {
            localStorage.setItem('sidebar-order', JSON.stringify(order));
        }
    }, [order]);

    // Load feature toggles from localStorage
    useEffect(() => {
        const loadFeatureToggles = () => {
            const defaultFeatures = {
                calendar: true,
                notebook: true,
                progress: true,
                stats: false, // Always default to false
                github: true,
                timer: true
            };
            const saved = localStorage.getItem('feature-toggles');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Force stats to be false unless explicitly saved as true
                    // This prevents stats from reappearing unexpectedly
                    const merged = { ...defaultFeatures, ...parsed };
                    // If stats was not explicitly saved, keep it false
                    if (parsed.stats === undefined) {
                        merged.stats = false;
                    }
                    setEnabledFeatures(merged);
                } catch {
                    setEnabledFeatures(defaultFeatures);
                }
            } else {
                setEnabledFeatures(defaultFeatures);
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
    // Handle keyboard shortcuts
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey; // Support Meta for Mac if needed, though mostly Windows focused
            const isShift = e.shiftKey;
            const isAlt = e.altKey;

            // Show visual hints on Ctrl press (except on drawing and notebook pages which have their own shortcuts)
            if (e.key === 'Control' && !e.repeat && currentPage !== 'drawing' && currentPage !== 'notebook') {
                setShowShortcuts(true);
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    setShowShortcuts(false);
                }, 3000);
            }

            // Arrow Navigation (Ctrl + Up/Down)
            if (isCtrl && !isShift && !isAlt && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // Build dynamic pages array based on sidebar order and enabled features
                const pages: Page[] = order.filter(id => {
                    if (id === 'dashboard') return true;
                    if (id === 'progress') return enabledFeatures.progress;
                    if (id === 'notebook') return enabledFeatures.notebook;
                    if (id === 'calendar') return enabledFeatures.calendar;
                    if (id === 'timer') return enabledFeatures.timer;
                    if (id === 'stats') return enabledFeatures.stats;
                    if (id === 'github') return enabledFeatures.github;
                    return false;
                }) as Page[];
                pages.push('settings'); // Always last

                const currentIndex = pages.indexOf(currentPage);
                e.preventDefault();

                if (e.key === 'ArrowUp') {
                    if (currentIndex > 0) setPage(pages[currentIndex - 1]);
                    else setPage(pages[pages.length - 1]);
                } else {
                    if (currentIndex < pages.length - 1) setPage(pages[currentIndex + 1]);
                    else setPage(pages[0]);
                }
                return;
            }

            // Allow native clipboard operations (Ctrl+C/X/V) when:
            // 1. User is in an input/textarea
            // 2. User has text selected anywhere
            // 3. User is on notebook/nerdbook page (has its own clipboard handling)
            if (isCtrl && ['c', 'x', 'v'].includes(e.key.toLowerCase())) {
                const target = e.target as HTMLElement;
                const isInInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.getAttribute('contenteditable') === 'true';
                const hasSelection = window.getSelection()?.toString().length ?? 0 > 0;
                const isOnNotebookPage = currentPage === 'notebook' || currentPage === 'workspace';

                if (isInInput || hasSelection || isOnNotebookPage) {
                    // Let native clipboard or page-specific handler work
                    return;
                }
            }

            // Find matching shortcut
            const matchingShortcut = shortcuts.find(s => {
                const keyMatch = s.key.toLowerCase() === e.key.toLowerCase();
                let modMatch = false;
                if (s.modifier === 'Ctrl') modMatch = isCtrl && !isShift && !isAlt;
                else if (s.modifier === 'Ctrl+Shift') modMatch = isCtrl && isShift && !isAlt;
                else if (s.modifier === 'Ctrl+Alt') modMatch = isCtrl && !isShift && isAlt;

                return s.enabled && !s.isGlobal && keyMatch && modMatch;
            });

            if (matchingShortcut) {
                // Disable ID-based shortcuts on drawing page (except specific ones if needed)
                if (currentPage === 'drawing') return;

                e.preventDefault();
                switch (matchingShortcut.id) {
                    case 'dashboard': setPage('dashboard'); break;
                    case 'calendar': if (enabledFeatures.calendar) setPage('calendar'); break;
                    case 'timer': if (enabledFeatures.timer) setPage('timer'); break;
                    case 'board': if (enabledFeatures.notebook) setPage('workspace'); break;
                    case 'github': if (enabledFeatures.github) setPage('github'); break;
                    case 'progress': if (enabledFeatures.progress) setPage('progress'); break;
                    case 'notebook': setPage('workspace'); break;
                    case 'settings': setPage('settings'); break;
                    case 'ai-quick-add':
                        window.dispatchEvent(new CustomEvent('open-ai-quick-add'));
                        break;
                    case 'quick-timer':
                        window.dispatchEvent(new CustomEvent('open-quick-timer'));
                        break;
                }
            } else if (isCtrl && e.key.toLowerCase() === 'escape') {
                // Handle Ctrl+Escape for Sidebar toggle (legacy support, or if we want to keep it hardcoded)
                // Keeping it valid if no other shortcut claimed it
                e.preventDefault();
                if (!isCollapsed) toggleSidebar();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') {
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
    }, [toggleSidebar, setPage, currentPage, isCollapsed, enabledFeatures, order, shortcuts]);

    // Auto-minimize calendar dropdown if not on calendar page
    useEffect(() => {
        if (currentPage !== 'calendar') {
            setIsCalendarOpen(false);
        } else {
            setIsCalendarOpen(true);
        }

        // Force hide shortcuts when on drawing or notebook or workspace page
        if (currentPage === 'drawing' || currentPage === 'notebook' || currentPage === 'workspace') {
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
            {/* FOCUS-CENTRIC BOTTOM NAVIGATION BAR */}
            {layoutType === 'focus-centric' && currentPage === 'dashboard' && (
                <>
                    {/* Bottom Bar */}
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{
                            y: isCollapsed ? 100 : 0,
                            opacity: isCollapsed ? 0 : 1
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30
                        }}
                        className="fixed bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none"
                    >
                        <div className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50">
                            {/* Navigation Items */}
                            {order.filter(id => {
                                if (id === 'dashboard' || id === 'progress') return true;
                                if (id === 'notebook') return enabledFeatures.notebook;
                                if (id === 'calendar') return enabledFeatures.calendar;
                                if (id === 'timer') return enabledFeatures.timer;
                                if (id === 'stats') return enabledFeatures.stats;
                                if (id === 'github') return enabledFeatures.github;
                                return false;
                            }).map(id => {
                                let Icon = Home;
                                let label = 'Dashboard';
                                let page: Page = 'dashboard';

                                switch (id) {
                                    case 'dashboard': Icon = Home; label = 'Dashboard'; page = 'dashboard'; break;
                                    case 'progress': Icon = TrendingUp; label = 'Progress'; page = 'progress'; break;
                                    case 'notebook': Icon = NotebookPen; label = 'Workspace'; page = 'workspace'; break;
                                    case 'calendar': Icon = CalendarIcon; label = 'Calendar'; page = 'calendar'; break;
                                    case 'timer': Icon = Timer; label = 'Timer'; page = 'timer'; break;
                                    case 'stats': Icon = PieChart; label = 'Stats'; page = 'stats'; break;
                                    case 'github': Icon = Github; label = 'GitHub'; page = 'github'; break;
                                }

                                const isActive = currentPage === page;

                                return (
                                    <BottomBarTooltip key={id} label={label} show={true}>
                                        <motion.button
                                            onClick={() => setPage(page)}
                                            className={clsx(
                                                "w-11 h-11 flex items-center justify-center rounded-xl transition-colors duration-200 relative",
                                                isActive
                                                    ? "text-gray-900 dark:text-white"
                                                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                            )}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="bottomBarActive"
                                                    className="absolute inset-0 rounded-xl bg-gray-100 dark:bg-gray-700/60"
                                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                />
                                            )}
                                            <Icon className="w-5 h-5 relative z-10" style={isActive ? { color: 'var(--accent-primary)' } : undefined} />
                                        </motion.button>
                                    </BottomBarTooltip>
                                );
                            })}

                            {/* Divider */}
                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                            {/* Settings */}
                            <BottomBarTooltip label="Settings" show={true}>
                                <motion.button
                                    onClick={() => setPage('settings')}
                                    className="w-11 h-11 flex items-center justify-center rounded-xl transition-colors duration-200 relative text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Settings className="w-5 h-5 relative z-10" />
                                </motion.button>
                            </BottomBarTooltip>
                        </div>
                    </motion.div>

                    {/* Hide/Show Toggle for Bottom Bar */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50"
                    >
                        <button
                            onClick={toggleSidebar}
                            className={clsx(
                                "px-4 py-1.5 rounded-t-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl",
                                "border border-b-0 border-gray-200/50 dark:border-gray-700/50",
                                "shadow-lg transition-all duration-300 hover:bg-white dark:hover:bg-gray-800",
                                "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                                "opacity-40 hover:opacity-100"
                            )}
                        >
                            <motion.div
                                animate={{ rotate: isCollapsed ? 180 : 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <ChevronDown className="w-4 h-4" />
                            </motion.div>
                        </button>
                    </motion.div>
                </>
            )}

            {/* REGULAR VERTICAL SIDEBAR - Hidden when on Focus-Centric dashboard */}
            {!(layoutType === 'focus-centric' && currentPage === 'dashboard') && (
                <>
                    <motion.div
                        animate={{
                            width: isCollapsed ? 0 : (isIconOnly ? 80 : 225),
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
                            animate={{ x: isCollapsed ? (isIconOnly ? -80 : -225) : 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 180,
                                damping: 24,
                                mass: 1
                            }}
                            className={clsx("py-4 pl-4 pr-2", isIconOnly ? "w-[80px] h-[calc(100%-60px)]" : "w-[225px] h-full")}
                        >
                            <div className="h-full rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col overflow-hidden transition-colors">
                                {/* Logo Area */}
                                <div className={clsx("flex items-center shrink-0", isIconOnly ? "p-3 justify-center" : "p-6 gap-3")}>
                                    <div className={clsx("flex items-center justify-center shrink-0", isIconOnly ? "w-8 h-8" : "w-10 h-10")}>
                                        <img src={logoPng} alt="Logo" className={isIconOnly ? "w-8 h-8" : "w-10 h-10"} />
                                    </div>
                                    {!isIconOnly && (
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">ThoughtsPlus</span>
                                        </div>
                                    )}
                                </div>

                                {/* Navigation */}
                                <Reorder.Group axis="y" values={order} onReorder={setOrder} className={clsx("flex-1 flex flex-col py-2 space-y-2 min-h-0", isIconOnly ? "px-2 items-center overflow-hidden" : "pl-8 pr-4 overflow-y-auto custom-scrollbar")}>
                                    {order.map(id => {
                                        // Dashboard
                                        if (id === 'dashboard') {
                                            return (
                                                <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative z-0">
                                                    <IconTooltip label="Dashboard" show={isIconOnly}>
                                                        <motion.button
                                                            onClick={() => setPage('dashboard')}
                                                            className={clsx(
                                                                isIconOnly
                                                                    ? "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative"
                                                                    : "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                                currentPage === 'dashboard'
                                                                    ? isIconOnly ? "" : "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                            )}
                                                        >
                                                            {currentPage === 'dashboard' && (
                                                                isIconOnly ? (
                                                                    <motion.div
                                                                        layoutId="activeCircle"
                                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                ) : (
                                                                    <motion.div
                                                                        layoutId="activeBg"
                                                                        className="absolute bg-gray-900 dark:bg-gray-700 rounded-xl top-0 bottom-0"
                                                                        initial={{ left: 0, width: "100%" }}
                                                                        animate={{
                                                                            left: showShortcuts ? -24 : 0,
                                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                                        }}
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                )
                                                            )}

                                                            {/* Badge - only show when not icon-only */}
                                                            {!isIconOnly && (
                                                                <AnimatePresence>
                                                                    {showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -20 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                                        >
                                                                            {getShortcutString('dashboard') && (
                                                                                <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                                    {getShortcutString('dashboard')}
                                                                                </span>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            )}

                                                            {isIconOnly ? (
                                                                <div className="relative z-10">
                                                                    <Home className="w-5 h-5" style={currentPage === 'dashboard' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                                    {/* Icon wrapper */}
                                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                                        <motion.div
                                                                            animate={{
                                                                                opacity: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0 : 1,
                                                                                scale: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0.5 : 1,
                                                                                x: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? -15 : 0
                                                                            }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            whileHover={{ scale: 1.1 }}
                                                                        >
                                                                            <Home className="w-5 h-5" style={currentPage === 'dashboard' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                        </motion.div>
                                                                    </div>
                                                                    <span className="font-medium text-sm">Dashboard</span>
                                                                </div>
                                                            )}
                                                        </motion.button>
                                                    </IconTooltip>
                                                </Reorder.Item>
                                            );
                                        }

                                        // Progress
                                        if (id === 'progress' && enabledFeatures.progress) {
                                            return (
                                                <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative overflow-visible">
                                                    <IconTooltip label="Progress" show={isIconOnly}>
                                                        <button
                                                            onClick={() => setPage('progress')}
                                                            className={clsx(
                                                                isIconOnly
                                                                    ? "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative"
                                                                    : "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative overflow-visible",
                                                                currentPage === 'progress'
                                                                    ? isIconOnly ? "" : "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                            )}
                                                        >
                                                            {currentPage === 'progress' && (
                                                                isIconOnly ? (
                                                                    <motion.div
                                                                        layoutId="activeCircle"
                                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                ) : (
                                                                    <motion.div
                                                                        layoutId="activeBg"
                                                                        className="absolute bg-gray-900 dark:bg-gray-700 rounded-xl top-0 bottom-0"
                                                                        initial={{ left: 0, width: "100%" }}
                                                                        animate={{
                                                                            left: showShortcuts ? -24 : 0,
                                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                                        }}
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                )
                                                            )}

                                                            {!isIconOnly && (
                                                                <AnimatePresence>
                                                                    {showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -20 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                                        >
                                                                            {getShortcutString('progress') && (
                                                                                <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                                    {getShortcutString('progress')}
                                                                                </span>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            )}

                                                            {isIconOnly ? (
                                                                <div className="relative z-10">
                                                                    <TrendingUp className="w-5 h-5" style={currentPage === 'progress' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                                        <motion.div
                                                                            animate={{
                                                                                opacity: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0 : 1,
                                                                                scale: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0.5 : 1,
                                                                                x: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? -15 : 0
                                                                            }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            whileHover={{ scale: 1.1 }}
                                                                        >
                                                                            <TrendingUp className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'progress' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                        </motion.div>
                                                                    </div>
                                                                    <span className="font-medium text-sm">Progress</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    </IconTooltip>
                                                </Reorder.Item>
                                            );
                                        }

                                        // Notebook
                                        if (id === 'notebook' && enabledFeatures.notebook) {
                                            return (
                                                <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative overflow-visible">
                                                    <IconTooltip label="Workspace" show={isIconOnly}>
                                                        <button
                                                            onClick={() => setPage('workspace')}
                                                            className={clsx(
                                                                isIconOnly
                                                                    ? "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative"
                                                                    : "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative overflow-visible",
                                                                (currentPage === 'notebook' || currentPage === 'workspace')
                                                                    ? isIconOnly ? "" : "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                            )}
                                                        >
                                                            {(currentPage === 'notebook' || currentPage === 'workspace') && (
                                                                isIconOnly ? (
                                                                    <motion.div
                                                                        layoutId="activeCircle"
                                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                ) : (
                                                                    <motion.div
                                                                        layoutId="activeBg"
                                                                        className="absolute bg-gray-900 dark:bg-gray-700 rounded-xl top-0 bottom-0"
                                                                        initial={{ left: 0, width: "100%" }}
                                                                        animate={{
                                                                            left: showShortcuts ? -24 : 0,
                                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                                        }}
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                )
                                                            )}

                                                            {!isIconOnly && (
                                                                <AnimatePresence>
                                                                    {showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && currentPage !== 'workspace' && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -20 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                                        >
                                                                            {getShortcutString('notebook') && (
                                                                                <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                                    {getShortcutString('notebook')}
                                                                                </span>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            )}

                                                            {isIconOnly ? (
                                                                <div className="relative z-10">
                                                                    <NotebookPen className="w-5 h-5" style={(currentPage === 'notebook' || currentPage === 'workspace') ? { color: 'var(--accent-primary)' } : undefined} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                                        <motion.div
                                                                            animate={{
                                                                                opacity: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && currentPage !== 'workspace' ? 0 : 1,
                                                                                scale: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && currentPage !== 'workspace' ? 0.5 : 1,
                                                                                x: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && currentPage !== 'workspace' ? -15 : 0
                                                                            }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            whileHover={{ scale: 1.1 }}
                                                                        >
                                                                            <NotebookPen className={clsx("w-5 h-5 shrink-0")} style={(currentPage === 'notebook' || currentPage === 'workspace') ? { color: 'var(--accent-primary)' } : undefined} />
                                                                        </motion.div>
                                                                    </div>
                                                                    <span className="font-medium text-sm">Workspace</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    </IconTooltip>
                                                </Reorder.Item>
                                            );
                                        }

                                        // Calendar
                                        if (id === 'calendar' && enabledFeatures.calendar) {
                                            // In icon-only mode, Calendar is simplified (no month dropdown)
                                            if (isIconOnly) {
                                                return (
                                                    <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative overflow-visible">
                                                        <IconTooltip label="Calendar" show={true}>
                                                            <button
                                                                onClick={() => setPage('calendar')}
                                                                className={clsx(
                                                                    "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative",
                                                                    currentPage === 'calendar'
                                                                        ? ""
                                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                                )}
                                                            >
                                                                {currentPage === 'calendar' && (
                                                                    <motion.div
                                                                        layoutId="activeCircle"
                                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                )}
                                                                <div className="relative z-10">
                                                                    <CalendarIcon className="w-5 h-5" style={currentPage === 'calendar' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                </div>
                                                            </button>
                                                        </IconTooltip>
                                                    </Reorder.Item>
                                                );
                                            }

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
                                                                {showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, x: -20 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                                                                        transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                        className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                                    >
                                                                        {getShortcutString('calendar') && (
                                                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                                {getShortcutString('calendar')}
                                                                            </span>
                                                                        )}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>

                                                            <div className="flex items-center gap-3 relative z-10 w-full">
                                                                <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                                    <motion.div
                                                                        animate={{
                                                                            opacity: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0 : 1,
                                                                            scale: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0.5 : 1,
                                                                            x: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? -15 : 0
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

                                        // Stats
                                        if (id === 'stats' && enabledFeatures.stats) {
                                            return (
                                                <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative">
                                                    <IconTooltip label="Creator Stats" show={isIconOnly}>
                                                        <button
                                                            onClick={() => setPage('stats')}
                                                            className={clsx(
                                                                isIconOnly
                                                                    ? "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative"
                                                                    : "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                                currentPage === 'stats'
                                                                    ? isIconOnly ? "" : "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                            )}
                                                        >
                                                            {currentPage === 'stats' && (
                                                                isIconOnly ? (
                                                                    <motion.div
                                                                        layoutId="activeCircle"
                                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                ) : (
                                                                    <motion.div
                                                                        layoutId="activeBg"
                                                                        className="absolute bg-gray-900 dark:bg-gray-700 rounded-xl top-0 bottom-0"
                                                                        initial={{ left: 0, width: "100%" }}
                                                                        animate={{ left: 0, width: "100%" }}
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                )
                                                            )}
                                                            {isIconOnly ? (
                                                                <div className="relative z-10">
                                                                    <PieChart className="w-5 h-5" style={currentPage === 'stats' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                                    <motion.div whileHover={{ scale: 1.1 }}>
                                                                        <PieChart className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'stats' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                    </motion.div>
                                                                    <span className="font-medium text-sm whitespace-nowrap">Creator Stats</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    </IconTooltip>
                                                </Reorder.Item>
                                            );
                                        }

                                        // Github
                                        if (id === 'github' && enabledFeatures.github) {
                                            return (
                                                <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative">
                                                    <IconTooltip label="GitHub" show={isIconOnly}>
                                                        <button
                                                            onClick={() => setPage('github')}
                                                            className={clsx(
                                                                isIconOnly
                                                                    ? "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative"
                                                                    : "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                                currentPage === 'github'
                                                                    ? isIconOnly ? "" : "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                            )}
                                                        >
                                                            {currentPage === 'github' && (
                                                                isIconOnly ? (
                                                                    <motion.div
                                                                        layoutId="activeCircle"
                                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                ) : (
                                                                    <motion.div
                                                                        layoutId="activeBg"
                                                                        className="absolute bg-gray-900 dark:bg-gray-700 rounded-xl top-0 bottom-0"
                                                                        initial={{ left: 0, width: "100%" }}
                                                                        animate={{
                                                                            left: showShortcuts ? -24 : 0,
                                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                                        }}
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                )
                                                            )}

                                                            {!isIconOnly && (
                                                                <AnimatePresence>
                                                                    {showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -20 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                                        >
                                                                            {getShortcutString('github') && (
                                                                                <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                                    {getShortcutString('github')}
                                                                                </span>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            )}

                                                            {isIconOnly ? (
                                                                <div className="relative z-10">
                                                                    <Github className="w-5 h-5" style={currentPage === 'github' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                                        <motion.div
                                                                            animate={{
                                                                                opacity: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0 : 1,
                                                                                scale: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0.5 : 1,
                                                                                x: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? -15 : 0
                                                                            }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            whileHover={{ scale: 1.1 }}
                                                                        >
                                                                            <Github className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'github' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                        </motion.div>
                                                                    </div>
                                                                    <span className="font-medium text-sm">Github</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    </IconTooltip>
                                                </Reorder.Item>
                                            );
                                        }

                                        // Timer
                                        if (id === 'timer' && enabledFeatures.timer) {
                                            return (
                                                <Reorder.Item key={id} value={id} dragListener={isEditMode} className="relative">
                                                    <IconTooltip label="Timer" show={isIconOnly}>
                                                        <button
                                                            onClick={() => setPage('timer')}
                                                            className={clsx(
                                                                isIconOnly
                                                                    ? "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative"
                                                                    : "w-full flex items-center justify-start p-3 rounded-xl transition-colors duration-300 group relative",
                                                                currentPage === 'timer'
                                                                    ? isIconOnly ? "" : "text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                            )}
                                                        >
                                                            {currentPage === 'timer' && (
                                                                isIconOnly ? (
                                                                    <motion.div
                                                                        layoutId="activeCircle"
                                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                ) : (
                                                                    <motion.div
                                                                        layoutId="activeBg"
                                                                        className="absolute bg-gray-900 dark:bg-gray-700 rounded-xl top-0 bottom-0"
                                                                        initial={{ left: 0, width: "100%" }}
                                                                        animate={{
                                                                            left: showShortcuts ? -24 : 0,
                                                                            width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                                        }}
                                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                                    />
                                                                )
                                                            )}

                                                            {!isIconOnly && (
                                                                <AnimatePresence>
                                                                    {showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -20 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                                        >
                                                                            {getShortcutString('timer') && (
                                                                                <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                                    {getShortcutString('timer')}
                                                                                </span>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            )}

                                                            {isIconOnly ? (
                                                                <div className="relative z-10">
                                                                    <Timer className="w-5 h-5" style={currentPage === 'timer' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 relative z-10 w-full">
                                                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                                        <motion.div
                                                                            animate={{
                                                                                opacity: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0 : 1,
                                                                                scale: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0.5 : 1,
                                                                                x: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? -15 : 0
                                                                            }}
                                                                            transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                                            whileHover={{ scale: 1.1 }}
                                                                        >
                                                                            <Timer className={clsx("w-5 h-5 shrink-0")} style={currentPage === 'timer' ? { color: 'var(--accent-primary)' } : undefined} />
                                                                        </motion.div>
                                                                    </div>
                                                                    <span className="font-medium text-sm">Timer</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    </IconTooltip>
                                                </Reorder.Item>
                                            );
                                        }

                                        return null;
                                    })}
                                </Reorder.Group>

                                {/* Dev Mode Button */}
                                {showDev && (
                                    <div className={clsx(isIconOnly ? "px-2 pt-2 flex justify-center" : "pl-8 pr-4 pt-2")}>
                                        <IconTooltip label="Dev Tools" show={isIconOnly}>
                                            <button
                                                onClick={() => setPage('dev')}
                                                className={clsx(
                                                    isIconOnly
                                                        ? "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative"
                                                        : "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 group relative",
                                                    currentPage === 'dev'
                                                        ? isIconOnly ? "" : "bg-gray-900 dark:bg-gray-700 text-white shadow-lg shadow-gray-900/20 dark:shadow-gray-950/30"
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'dev' && (
                                                    isIconOnly ? (
                                                        <motion.div
                                                            layoutId="activeCircle"
                                                            className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                        />
                                                    ) : (
                                                        <motion.div
                                                            layoutId="activeBg"
                                                            className="absolute inset-0 bg-gray-900 dark:bg-gray-700 rounded-xl"
                                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                        />
                                                    )
                                                )}
                                                {isIconOnly ? (
                                                    <div className="relative z-10">
                                                        <Code className="w-5 h-5" style={currentPage === 'dev' ? { color: 'var(--accent-primary)' } : undefined} />
                                                    </div>
                                                ) : (
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
                                                )}
                                            </button>
                                        </IconTooltip>
                                    </div>
                                )}

                                {/* Settings at bottom */}
                                <div className={clsx(isIconOnly ? "flex justify-center py-2" : "pl-8 pr-4 pt-4 pb-4", "shrink-0")}>
                                    {!isIconOnly && <div className="h-px bg-gray-200 dark:bg-gray-700 mb-4" />}
                                    {isIconOnly ? (
                                        <div className="relative group z-[60]">
                                            <button
                                                onClick={() => setPage('settings')}
                                                className={clsx(
                                                    "w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 relative cursor-pointer",
                                                    currentPage === 'settings'
                                                        ? ""
                                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                                )}
                                            >
                                                {currentPage === 'settings' && (
                                                    <motion.div
                                                        layoutId="activeCircle"
                                                        className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-700/60"
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}
                                                <Settings className="w-5 h-5 relative z-10" style={currentPage === 'settings' ? { color: 'var(--accent-primary)' } : undefined} />
                                            </button>
                                            {/* Tooltip using CSS group-hover */}
                                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                                <div className="px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium whitespace-nowrap shadow-lg border border-gray-700">
                                                    Settings
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
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
                                                    className="absolute bg-gray-900 dark:bg-gray-700 rounded-xl top-0 bottom-0"
                                                    initial={{ left: 0, width: "100%" }}
                                                    animate={{
                                                        left: showShortcuts ? -24 : 0,
                                                        width: showShortcuts ? "calc(100% + 24px)" : "100%"
                                                    }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                />
                                            )}

                                            <AnimatePresence>
                                                {showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                                                        transition={{ type: "spring", stiffness: 500, damping: 14 }}
                                                        className="absolute left-[-16px] top-0 bottom-0 w-[48px] flex items-center justify-center z-20"
                                                    >
                                                        {getShortcutString('settings') && (
                                                            <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md whitespace-nowrap border border-gray-700 flex items-center justify-center shadow-lg">
                                                                {getShortcutString('settings')}
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <div className="flex items-center gap-3 relative z-10 w-full">
                                                <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                    <motion.div
                                                        animate={{
                                                            opacity: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0 : 1,
                                                            scale: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? 0.5 : 1,
                                                            x: showShortcuts && currentPage !== 'drawing' && currentPage !== 'notebook' ? -15 : 0
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
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Floating Toggle Button */}
                    <div className={clsx(
                        "absolute z-50 transition-all duration-300",
                        isIconOnly && !isCollapsed ? "bottom-4 left-[28px]" : "bottom-4 left-4"
                    )}>
                        <button
                            onClick={toggleSidebar}
                            className={clsx(
                                "p-3 rounded-xl bg-white shadow-lg border border-gray-100 transition-all duration-300 hover:scale-110 hover:shadow-xl text-gray-600 hover:text-blue-600",
                                !isCollapsed && !isIconOnly && "translate-x-[215px]",
                                "opacity-50 hover:opacity-100"
                            )}
                        >
                            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                        </button>
                    </div>
                </>
            )}
        </>
    );
}

