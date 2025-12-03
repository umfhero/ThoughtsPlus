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

export function ShortcutsOverlay() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey) {
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
    }, []);

    const shortcuts = [
        { icon: Home, key: 'Ctrl + D', description: 'Go to Dashboard' },
        { icon: Calendar, key: 'Ctrl + C', description: 'Go to Calendar' },
        { icon: PenTool, key: 'Ctrl + A', description: 'Go to Drawing' },
        { icon: BarChart2, key: 'Ctrl + T', description: 'Creator Stats' },
        { icon: Github, key: 'Ctrl + G', description: 'Go to Github' },
        { icon: Settings, key: 'Ctrl + ,', description: 'Settings' },
        { icon: Sparkles, key: 'Ctrl + M', description: 'AI Quick Note' },
        { icon: PanelLeft, key: 'Ctrl + S', description: 'Toggle Sidebar' },
        { icon: X, key: 'Esc', description: 'Close Menus / Sidebar' },
        { icon: ArrowUp, key: 'Ctrl + \u2191/\u2193', description: 'Navigate Pages' },
    ];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: '100%', opacity: 0, skewX: -15, scale: 0.9 }}
                    animate={{ x: 0, opacity: 1, skewX: 0, scale: 1 }}
                    exit={{ x: '100%', opacity: 0, skewX: 15, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, mass: 0.8 }}
                    className="fixed right-0 top-0 h-full w-80 bg-gray-900/40 backdrop-blur-xl border-l border-white/10 z-[100] p-6 shadow-2xl flex flex-col justify-center"
                >
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="bg-white/20 p-1 rounded">Ctrl</span> Shortcuts
                    </h2>
                    <div className="space-y-4">
                        {shortcuts.map((shortcut, index) => (
                            <div key={index} className="flex items-center gap-4 text-gray-200">
                                <div className="p-2 bg-white/10 rounded-lg shrink-0">
                                    <shortcut.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-sm">{shortcut.key}</div>
                                    <div className="text-xs text-gray-400">{shortcut.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
