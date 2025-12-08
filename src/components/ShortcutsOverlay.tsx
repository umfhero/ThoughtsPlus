import { motion, AnimatePresence } from 'framer-motion';
import { 
    Home, 
    Calendar, 
    BarChart2, 
    Settings, 
    PenTool, 
    Github, 
    Sparkles, 
    PanelLeft, 
    X,
    ArrowUp
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page } from '../types';

interface ShortcutsOverlayProps {
    currentPage: Page;
}

export function ShortcutsOverlay({ currentPage }: ShortcutsOverlayProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && currentPage !== 'drawing' && currentPage !== 'settings') {
                setIsVisible(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.ctrlKey) {
                setIsVisible(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [currentPage]);

    useEffect(() => {
        if (currentPage === 'drawing') {
            setIsVisible(false);
        }
    }, [currentPage]);

    const shortcuts = [
        { icon: Sparkles, key: 'Ctrl + M', description: 'AI Quick Note', color: 'text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]', prominent: true },
        { icon: Home, key: 'Ctrl + D', description: 'Go to Dashboard', color: 'text-blue-300 drop-shadow-[0_0_6px_rgba(147,197,253,0.6)]' },
        { icon: Calendar, key: 'Ctrl + E', description: 'Go to Calendar', color: 'text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]' },
        { icon: PenTool, key: 'Ctrl + W', description: 'Go to Drawing', color: 'text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]' },
        { icon: BarChart2, key: 'Ctrl + T', description: 'Creator Stats', color: 'text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]' },
        { icon: Github, key: 'Ctrl + G', description: 'Go to Github', color: 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]' },
        { icon: Settings, key: 'Ctrl + Z', description: 'Settings', color: 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]' },
        { icon: PanelLeft, key: 'Ctrl + S', description: 'Toggle Sidebar', color: 'text-indigo-400 drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]' },
        { icon: X, key: 'Esc', description: 'Close Menus / Sidebar', color: 'text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]' },
        { icon: ArrowUp, key: 'Ctrl + \u2191/\u2193', description: 'Navigate Pages', color: 'text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]' },
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
                                <div className={`p-2 bg-white/10 rounded-lg shrink-0 ${shortcut.prominent ? 'ring-2 ring-purple-400/50' : ''}`}>
                                    <shortcut.icon className={`w-5 h-5 ${shortcut.color}`} />
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
