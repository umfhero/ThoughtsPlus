import { useState, useEffect } from 'react';
import { Folder, Moon, Sun, Power, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';

export function SettingsPage() {
    const [dataPath, setDataPath] = useState<string>('Loading...');
    const [autoLaunch, setAutoLaunch] = useState(false);
    const { theme, accentColor, setTheme, setAccentColor } = useTheme();

    useEffect(() => {
        checkAutoLaunch();
        loadDataPath();
    }, []);

    const loadDataPath = async () => {
        const path = await window.ipcRenderer.invoke('get-current-data-path');
        if (path) {
            setDataPath(path);
        }
    };

    const checkAutoLaunch = async () => {
        const isEnabled = await window.ipcRenderer.invoke('get-auto-launch');
        setAutoLaunch(isEnabled);
    };

    const toggleAutoLaunch = async () => {
        const newState = await window.ipcRenderer.invoke('set-auto-launch', !autoLaunch);
        setAutoLaunch(newState);
    };

    const handleSelectFolder = async () => {
        const newPath = await window.ipcRenderer.invoke('select-data-folder');
        if (newPath) {
            setDataPath(newPath);
        }
    };

    return (
        <div className="p-10 space-y-10 h-full overflow-y-auto">
            <div>
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage your preferences</p>
            </div>

            <div className="space-y-6">
                {/* Data Storage */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <Folder className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Data Storage</h2>
                    </div>

                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Choose where to store your calendar data. Select a OneDrive folder to sync across devices.
                    </p>

                    <div className="flex items-center gap-4">
                        <div className="flex-1 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-mono text-sm truncate">
                            {dataPath}
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSelectFolder}
                            className="px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition-colors"
                        >
                            Change Location
                        </motion.button>
                    </div>
                </motion.div>

                {/* Auto Launch */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 transition-colors"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                <Power className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Run on Startup</h2>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">Launch Calendar Pro automatically when you log in.</p>
                            </div>
                        </div>

                        <button
                            onClick={toggleAutoLaunch}
                            className={clsx(
                                "w-16 h-9 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500",
                                autoLaunch ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"
                            )}
                        >
                            <motion.div
                                layout
                                className="w-7 h-7 rounded-full bg-white shadow-md"
                                animate={{ x: autoLaunch ? 28 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        </button>
                    </div>
                </motion.div>

                {/* Theme Settings */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <Moon className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Appearance</h2>
                    </div>
                    
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Choose your theme preference</p>
                    
                    <div className="flex gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setTheme('light')}
                            className={clsx(
                                "flex-1 p-4 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-colors",
                                theme === 'light'
                                    ? "bg-blue-50 border-blue-500 text-blue-600 shadow-lg shadow-blue-500/10"
                                    : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                            )}
                        >
                            <Sun className="w-5 h-5" /> Light Mode
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setTheme('dark')}
                            className={clsx(
                                "flex-1 p-4 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-colors",
                                theme === 'dark'
                                    ? "bg-gray-900 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10"
                                    : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                            )}
                        >
                            <Moon className="w-5 h-5" /> Dark Mode
                        </motion.button>
                    </div>
                </motion.div>

                {/* Accent Color */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 rounded-2xl bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
                            <Palette className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Accent Color</h2>
                    </div>
                    
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Choose your preferred accent color</p>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <input
                                type="color"
                                value={accentColor.startsWith('#') ? accentColor : '#3b82f6'}
                                onChange={(e) => setAccentColor(e.target.value)}
                                className="w-20 h-20 rounded-xl cursor-pointer border-2 border-gray-200 dark:border-gray-600"
                                style={{ backgroundColor: accentColor.startsWith('#') ? accentColor : 'var(--accent-primary)' }}
                            />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Color</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Click to choose any color from the color wheel</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <div 
                                        className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"
                                        style={{ backgroundColor: accentColor.startsWith('#') ? accentColor : 'var(--accent-primary)' }}
                                    />
                                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                        {accentColor.startsWith('#') ? accentColor.toUpperCase() : 'Custom'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Quick presets:</p>
                            <div className="grid grid-cols-6 gap-2">
                                {['#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#f97316', '#ef4444', '#06b6d4', '#eab308'].map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setAccentColor(color)}
                                        className="w-full aspect-square rounded-lg border-2 transition-all hover:scale-110"
                                        style={{ 
                                            backgroundColor: color,
                                            borderColor: accentColor === color ? '#ffffff' : 'transparent',
                                            boxShadow: accentColor === color ? `0 0 0 2px ${color}` : 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* About Section */}
                <div className="text-center pt-8 pb-4">
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                        Calendar Plus v2.0.0
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                        © 2025 Calendar Plus
                    </p>
                </div>
            </div>
        </div>
    );
}
