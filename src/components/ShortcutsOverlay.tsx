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
    Code
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page } from '../types';

interface ShortcutsOverlayProps {
    currentPage: Page;
}

export function ShortcutsOverlay({ currentPage }: ShortcutsOverlayProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let showTimeout: NodeJS.Timeout | null = null;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && currentPage !== 'drawing' && currentPage !== 'settings') {
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
        if (currentPage === 'drawing') {
            setIsVisible(false);
        }
    }, [currentPage]);

    const shortcuts = [
        { icon: Sparkles, key: 'Ctrl + M', description: 'AI Quick Note', color: '', prominent: true, useAccentColor: true },
        { icon: Home, key: 'Ctrl + D', description: 'Dashboard', color: 'text-white' },
        { icon: TrendingUp, key: 'Ctrl + P', description: 'Progress', color: 'text-white' },
        { icon: Calendar, key: 'Ctrl + C', description: 'Calendar', color: 'text-white' },
        { icon: Timer, key: 'Ctrl + T', description: 'Timer', color: 'text-white' },
        { icon: PenTool, key: 'Ctrl + B', description: 'Board', color: 'text-white' },
        { icon: Github, key: 'Ctrl + G', description: 'Github', color: 'text-white' },
        { icon: Settings, key: 'Ctrl + S', description: 'Settings', color: 'text-white' },
        { icon: Code, key: 'Ctrl + /', description: 'Dev Tools', color: 'text-white' },
        { icon: ArrowUp, key: 'Ctrl + ↑/↓', description: 'Navigate Pages', color: 'text-white' },
        { icon: X, key: 'Esc', description: 'Close Menus / Sidebar', color: 'text-white' },
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
                        {shortcuts.map((shortcut, index) => (
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
                                        style={(shortcut as any).useAccentColor ? { color: 'var(--accent-primary)' } : undefined}
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
