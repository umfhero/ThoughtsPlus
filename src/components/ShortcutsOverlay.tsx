import { motion, AnimatePresence } from 'framer-motion';
import {
    Home,
    Calendar,
    TrendingUp,
    Settings,
    PenTool,
    Github,
    Sparkles,
    X,
    ArrowUp,
    Timer,
    Notebook,
    LucideIcon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page } from '../types';
import { DEFAULT_SHORTCUTS, ShortcutConfig } from './KeyboardShortcuts';

interface ShortcutsOverlayProps {
    currentPage: Page;
}

// Map shortcut IDs to icons
const SHORTCUT_ICONS: Record<string, LucideIcon> = {
    'dashboard': Home,
    'calendar': Calendar,
    'timer': Timer,
    'board': PenTool,
    'github': Github,
    'progress': TrendingUp,
    'notebook': Notebook,
    'settings': Settings,
    'ai-quick-add': Sparkles,
    'quick-timer': Timer,
};

export function ShortcutsOverlay({ currentPage }: ShortcutsOverlayProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>(DEFAULT_SHORTCUTS);

    // Load shortcuts from localStorage and listen for changes
    useEffect(() => {
        const loadShortcuts = () => {
            const saved = localStorage.getItem('keyboard-shortcuts');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Merge with defaults to ensure all shortcuts exist
                    const merged = DEFAULT_SHORTCUTS.map(def => {
                        const found = parsed.find((s: ShortcutConfig) => s.id === def.id);
                        return found ? { ...def, ...found } : def;
                    });
                    setShortcuts(merged);
                } catch {
                    setShortcuts([...DEFAULT_SHORTCUTS]);
                }
            } else {
                setShortcuts([...DEFAULT_SHORTCUTS]);
            }
        };

        loadShortcuts();

        const handleShortcutsChanged = (e: CustomEvent) => {
            setShortcuts(e.detail);
        };

        window.addEventListener('shortcuts-changed', handleShortcutsChanged as EventListener);
        return () => window.removeEventListener('shortcuts-changed', handleShortcutsChanged as EventListener);
    }, []);

    useEffect(() => {
        let showTimeout: NodeJS.Timeout | null = null;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && currentPage !== 'drawing' && currentPage !== 'settings' && currentPage !== 'notebook' && currentPage !== 'workspace') {
                // Delay showing overlay by 0.5 seconds so quick Ctrl presses don't flash it
                if (!showTimeout) {
                    showTimeout = setTimeout(() => {
                        setIsVisible(true);
                    }, 500);
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.ctrlKey) {
                // Cancel the timeout if Ctrl is released before delay
                if (showTimeout) {
                    clearTimeout(showTimeout);
                    showTimeout = null;
                }
                setIsVisible(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (showTimeout) clearTimeout(showTimeout);
        };
    }, [currentPage]);

    useEffect(() => {
        if (currentPage === 'drawing' || currentPage === 'notebook' || currentPage === 'workspace') {
            setIsVisible(false);
        }
    }, [currentPage]);

    // Build display shortcuts from saved config
    const displayShortcuts = [
        // AI Quick Add (prominent)
        ...shortcuts
            .filter(s => s.id === 'ai-quick-add' && s.enabled)
            .map(s => ({
                icon: SHORTCUT_ICONS[s.id] || Sparkles,
                key: `${s.modifier} + ${s.key}`,
                description: s.label,
                color: '',
                prominent: true,
                useAccentColor: true
            })),
        // Other shortcuts
        ...shortcuts
            .filter(s => s.id !== 'ai-quick-add' && s.id !== 'quick-capture' && s.enabled && SHORTCUT_ICONS[s.id])
            .map(s => ({
                icon: SHORTCUT_ICONS[s.id],
                key: `${s.modifier} + ${s.key}`,
                description: s.label,
                color: 'text-white',
                prominent: false,
                useAccentColor: false
            })),
        // Static shortcuts that aren't customizable
        { icon: ArrowUp, key: 'Ctrl + ↑/↓', description: 'Navigate Pages', color: 'text-white', prominent: false, useAccentColor: false },
        { icon: X, key: 'Esc', description: 'Close Menus / Sidebar', color: 'text-white', prominent: false, useAccentColor: false },
    ];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: '100%', opacity: 0, skewX: -15, scale: 0.9 }}
                    animate={{ x: 0, opacity: 1, skewX: 0, scale: 1 }}
                    exit={{ x: '100%', opacity: 0, skewX: 15, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, mass: 0.8 }}
                    className="fixed right-0 top-0 h-full w-64 bg-gray-900/90 backdrop-blur-xl border-l border-white/10 z-[100] p-5 shadow-2xl flex flex-col justify-center"
                >
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="bg-white/20 p-1 rounded">Ctrl</span> Shortcuts
                    </h2>
                    <div className="space-y-3">
                        {displayShortcuts.map((shortcut, index) => (
                            <motion.div
                                key={index}
                                className={`flex items-center gap-3 ${shortcut.prominent ? 'text-white' : 'text-gray-200/70'}`}
                                whileHover={{ scale: 1.05, x: -5 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <div
                                    className={`p-2 bg-white/10 rounded-lg shrink-0`}
                                    style={shortcut.prominent ? { boxShadow: '0 0 0 2px var(--accent-primary)', opacity: 0.8 } : undefined}
                                >
                                    <shortcut.icon
                                        className={`w-5 h-5 ${shortcut.color}`}
                                        style={shortcut.useAccentColor ? { color: 'var(--accent-primary)' } : undefined}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-base">{shortcut.key}</div>
                                    <div className="text-sm truncate">{shortcut.description}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
