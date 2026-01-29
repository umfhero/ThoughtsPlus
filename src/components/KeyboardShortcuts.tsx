import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, RotateCcw, AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

// Shortcut configuration interface
export interface ShortcutConfig {
    id: string;
    label: string;
    key: string;  // e.g., 'D', 'C', 'M', 'Enter'
    modifier: 'Ctrl' | 'Ctrl+Shift' | 'Ctrl+Alt';
    description: string;
    enabled: boolean;
    isGlobal?: boolean;  // For Quick Capture (system-wide)
}

// Default shortcuts based on the app
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
    { id: 'dashboard', label: 'Dashboard', key: 'D', modifier: 'Ctrl', description: 'Open Dashboard', enabled: true },
    { id: 'calendar', label: 'Calendar', key: 'C', modifier: 'Ctrl', description: 'Open Calendar', enabled: true },
    { id: 'timer', label: 'Timer', key: 'T', modifier: 'Ctrl', description: 'Open Timer', enabled: true },
    { id: 'board', label: 'Board', key: 'B', modifier: 'Ctrl', description: 'Open Board', enabled: true },
    { id: 'github', label: 'GitHub', key: 'G', modifier: 'Ctrl', description: 'Open GitHub', enabled: true },
    { id: 'progress', label: 'Progress', key: 'P', modifier: 'Ctrl', description: 'Open Progress', enabled: true },
    { id: 'notebook', label: 'Notebook', key: 'N', modifier: 'Ctrl', description: 'Open Notebook', enabled: true },
    { id: 'settings', label: 'Settings', key: 'S', modifier: 'Ctrl', description: 'Open Settings', enabled: true },
    { id: 'ai-quick-add', label: 'AI Quick Add', key: 'M', modifier: 'Ctrl', description: 'Open AI Quick Add modal', enabled: true, isGlobal: true },
    { id: 'quick-timer', label: 'Quick Timer', key: 'T', modifier: 'Ctrl+Shift', description: 'Open Quick Timer modal', enabled: true, isGlobal: true },
    { id: 'quick-capture', label: 'Quick Capture', key: 'N', modifier: 'Ctrl+Shift', description: 'Capture a note from anywhere, saved in workspace', enabled: true, isGlobal: true },
    { id: 'quick-todo', label: 'Quick To-Do', key: 'K', modifier: 'Ctrl+Shift', description: 'Add a to-do from anywhere', enabled: true, isGlobal: true },
];

// Keys to show on the keyboard (only relevant ones)
const KEYBOARD_KEYS = [
    // Row 1 - Letters for shortcuts
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    // Row 2
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    // Row 3
    ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Enter'],
    // Row 4 - Ctrl
    ['Ctrl', 'Alt', 'Space'],
];

interface KeyboardShortcutsProps {
    className?: string;
}

// Check if a key is a modifier key
const isModifierKey = (key: string) => ['Ctrl', 'Alt', 'Shift', 'Space'].includes(key);

// Shortcut Item Component
interface ShortcutItemProps {
    shortcut: ShortcutConfig;
    recordingId: string | null;
    duplicates: string[];
    accentColor: string;
    startRecording: (id: string) => void;
    toggleShortcut: (id: string) => void;
}

function ShortcutItem({
    shortcut,
    recordingId,
    duplicates,
    accentColor,
    startRecording,
    toggleShortcut
}: ShortcutItemProps) {
    return (
        <motion.div
            className={clsx(
                "flex items-center justify-between p-3 rounded-lg border transition-all",
                shortcut.enabled
                    ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    : "bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-60",
                duplicates.includes(shortcut.id) && "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
            )}
        >
            <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                    {shortcut.isGlobal && (
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: accentColor }}
                            title="Global Shortcut"
                        />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-xs truncate">{shortcut.label}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{shortcut.description}</p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
                {/* Key Display / Recording */}
                {recordingId === shortcut.id ? (
                    <div
                        className="px-2 py-1 rounded text-xs font-mono animate-pulse bg-gray-100 dark:bg-gray-700 font-medium"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Recording...
                    </div>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); startRecording(shortcut.id); }}
                        className="flex items-center gap-1 px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        disabled={!shortcut.enabled}
                    >
                        <kbd className="min-w-[1.5rem] h-6 flex items-center justify-center rounded bg-white dark:bg-gray-600 text-xs font-mono font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-500 shadow-sm px-1.5">
                            {shortcut.modifier === 'Ctrl' ? 'Ctrl' : shortcut.modifier === 'Ctrl+Shift' ? 'Ctrl+Shift' : 'Ctrl+Alt'}
                        </kbd>
                        <span className="text-xs text-gray-300 dark:text-gray-500 font-bold">+</span>
                        <kbd className="min-w-[1.5rem] h-6 flex items-center justify-center rounded bg-white dark:bg-gray-600 text-xs font-mono font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-500 shadow-sm px-1.5">
                            {shortcut.key}
                        </kbd>
                    </button>
                )}

                {/* Enable/Disable Toggle - Tiny */}
                <button
                    onClick={() => toggleShortcut(shortcut.id)}
                    className={clsx(
                        "w-8 h-4 rounded-full p-0.5 transition-colors duration-300 shrink-0",
                        shortcut.enabled ? "" : "bg-gray-300 dark:bg-gray-600"
                    )}
                    style={shortcut.enabled ? { backgroundColor: accentColor } : undefined}
                >
                    <motion.div
                        layout
                        className="w-3 h-3 rounded-full bg-white shadow-sm"
                        animate={{ x: shortcut.enabled ? 16 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                </button>
            </div>
        </motion.div>
    );
}

export function KeyboardShortcuts({ className }: KeyboardShortcutsProps) {
    const { accentColor } = useTheme();
    const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>([]);
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const [error, setError] = useState<string>('');

    // Load shortcuts from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('keyboard-shortcuts');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults - preserve enabled state but use default keys if they've changed
                const merged = DEFAULT_SHORTCUTS.map(def => {
                    const found = parsed.find((s: ShortcutConfig) => s.id === def.id);
                    if (found) {
                        // Always use the default key/modifier unless user has explicitly customized it
                        // Check if the saved key is different from the old default (migration case)
                        return {
                            ...def,
                            enabled: found.enabled !== undefined ? found.enabled : def.enabled,
                            // Only use saved key if it's intentionally different from default
                            key: found.key || def.key,
                            modifier: found.modifier || def.modifier
                        };
                    }
                    return def;
                });
                setShortcuts(merged);
                // Save the merged version to fix any stale data
                localStorage.setItem('keyboard-shortcuts', JSON.stringify(merged));
            } catch {
                setShortcuts([...DEFAULT_SHORTCUTS]);
            }
        } else {
            setShortcuts([...DEFAULT_SHORTCUTS]);
        }
    }, []);

    // Save shortcuts to localStorage whenever they change
    useEffect(() => {
        if (shortcuts.length > 0) {
            localStorage.setItem('keyboard-shortcuts', JSON.stringify(shortcuts));
            // Dispatch event to notify other components
            window.dispatchEvent(new CustomEvent('shortcuts-changed', { detail: shortcuts }));
        }
    }, [shortcuts]);

    // Find duplicate shortcuts
    const duplicates = useMemo(() => {
        const enabled = shortcuts.filter(s => s.enabled);
        const seen = new Map<string, string[]>();
        enabled.forEach(s => {
            const combo = `${s.modifier}+${s.key}`;
            if (!seen.has(combo)) {
                seen.set(combo, []);
            }
            seen.get(combo)!.push(s.id);
        });
        const dups: string[] = [];
        seen.forEach((ids) => {
            if (ids.length > 1) {
                dups.push(...ids);
            }
        });
        return dups;
    }, [shortcuts]);

    // Get keys that are used by enabled shortcuts
    const usedKeys = useMemo(() => {
        const keys = new Map<string, { shortcut: ShortcutConfig; modifier: string }>();
        shortcuts.filter(s => s.enabled).forEach(s => {
            keys.set(s.key.toUpperCase(), { shortcut: s, modifier: s.modifier });
        });
        return keys;
    }, [shortcuts]);

    // Toggle a shortcut enabled/disabled
    const toggleShortcut = async (id: string) => {
        setError('');
        const shortcut = shortcuts.find(s => s.id === id);
        if (!shortcut) return;

        // Special handling for global shortcuts
        if (shortcut.isGlobal) {
            try {
                if (shortcut.id === 'quick-capture') {
                    // @ts-ignore
                    await window.ipcRenderer.invoke('set-quick-capture-enabled', !shortcut.enabled);
                } else if (shortcut.id === 'quick-todo') {
                    // @ts-ignore
                    await window.ipcRenderer.invoke('set-quick-todo-enabled', !shortcut.enabled);
                } else if (shortcut.id === 'quick-timer') {
                    // @ts-ignore
                    await window.ipcRenderer.invoke('set-quick-timer-enabled', !shortcut.enabled);
                } else if (shortcut.id === 'ai-quick-add') {
                    // @ts-ignore
                    await window.ipcRenderer.invoke('set-ai-quick-add-enabled', !shortcut.enabled);
                }
            } catch (err) {
                console.error(`Failed to toggle ${shortcut.id}:`, err);
            }
        }

        setShortcuts(prev => prev.map(s =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
        ));
    };

    // Reset all shortcuts to defaults
    const resetToDefaults = async () => {
        setError('');
        setShortcuts([...DEFAULT_SHORTCUTS]);
        // Re-enable global shortcuts with default keys
        try {
            // @ts-ignore
            await window.ipcRenderer.invoke('set-quick-capture-enabled', true);
            // @ts-ignore
            await window.ipcRenderer.invoke('set-quick-capture-hotkey', 'CommandOrControl+Shift+N');
            // @ts-ignore
            await window.ipcRenderer.invoke('set-quick-todo-enabled', true);
            // @ts-ignore
            await window.ipcRenderer.invoke('set-quick-todo-hotkey', 'CommandOrControl+Shift+K');
            // @ts-ignore
            await window.ipcRenderer.invoke('set-quick-timer-enabled', true);
            // @ts-ignore
            await window.ipcRenderer.invoke('set-quick-timer-hotkey', 'CommandOrControl+Shift+T');
            // @ts-ignore
            await window.ipcRenderer.invoke('set-ai-quick-add-enabled', true);
            // @ts-ignore
            await window.ipcRenderer.invoke('set-ai-quick-add-hotkey', 'CommandOrControl+M');
        } catch (err) {
            console.error('Failed to reset global shortcuts:', err);
        }
    };

    // Start recording a new key for a shortcut
    const startRecording = (id: string) => {
        setRecordingId(id);
        setError('');
    };

    // Handle key press during recording
    useEffect(() => {
        if (!recordingId) return;

        const handleKeyDown = async (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Ignore modifier-only presses
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            const key = e.key === ' ' ? 'Space' : e.key.toUpperCase();
            let modifier: 'Ctrl' | 'Ctrl+Shift' | 'Ctrl+Alt' = 'Ctrl';

            if (e.ctrlKey && e.shiftKey) {
                modifier = 'Ctrl+Shift';
            } else if (e.ctrlKey && e.altKey) {
                modifier = 'Ctrl+Alt';
            } else if (e.ctrlKey) {
                modifier = 'Ctrl';
            } else {
                setError('Shortcuts must include Ctrl key');
                setRecordingId(null);
                return;
            }

            // Check for duplicates
            const existingWithKey = shortcuts.find(s =>
                s.id !== recordingId &&
                s.enabled &&
                s.key.toUpperCase() === key &&
                s.modifier === modifier
            );

            if (existingWithKey) {
                setError(`This key combination is already used by "${existingWithKey.label}"`);
                setRecordingId(null);
                return;
            }

            // Update the shortcut
            const targetShortcut = shortcuts.find(s => s.id === recordingId);

            // Handle global shortcuts specially
            if (targetShortcut?.isGlobal) {
                const electronHotkey = `CommandOrControl+${modifier === 'Ctrl+Shift' ? 'Shift+' : modifier === 'Ctrl+Alt' ? 'Alt+' : ''}${key}`;
                try {
                    let result;
                    if (targetShortcut.id === 'quick-capture') {
                        // @ts-ignore
                        result = await window.ipcRenderer.invoke('set-quick-capture-hotkey', electronHotkey);
                    } else if (targetShortcut.id === 'quick-todo') {
                        // @ts-ignore
                        result = await window.ipcRenderer.invoke('set-quick-todo-hotkey', electronHotkey);
                    } else if (targetShortcut.id === 'quick-timer') {
                        // @ts-ignore
                        result = await window.ipcRenderer.invoke('set-quick-timer-hotkey', electronHotkey);
                    } else if (targetShortcut.id === 'ai-quick-add') {
                        // @ts-ignore
                        result = await window.ipcRenderer.invoke('set-ai-quick-add-hotkey', electronHotkey);
                    }

                    if (result && !result.success) {
                        setError(result.error || 'Failed to register hotkey');
                        setRecordingId(null);
                        return;
                    }
                } catch (err: any) {
                    setError(err.message || 'Failed to set global hotkey');
                    setRecordingId(null);
                    return;
                }
            }

            setShortcuts(prev => prev.map(s =>
                s.id === recordingId ? { ...s, key, modifier, enabled: true } : s
            ));
            setRecordingId(null);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recordingId, shortcuts]);

    // Cancel recording on click outside
    useEffect(() => {
        if (!recordingId) return;
        const handleClick = () => setRecordingId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [recordingId]);

    // Get key style based on state
    const getKeyStyle = (key: string) => {
        const upperKey = key.toUpperCase();
        const usedKey = usedKeys.get(upperKey);

        const isDuplicate = usedKey && duplicates.includes(usedKey.shortcut.id);

        if (isDuplicate) {
            return {
                backgroundColor: '#ef4444',
                color: 'white',
                borderColor: '#ef4444',
            };
        }
        if (usedKey) {
            return {
                backgroundColor: `${accentColor}20`,
                borderColor: accentColor,
            };
        }
        return {};
    };

    return (
        <div className={clsx("space-y-6", className)}>
            {/* Header - Compact */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div
                        className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700/50 shrink-0"
                    >
                        <Keyboard className="w-5 h-5" style={{ color: accentColor }} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 truncate">Shortcuts</h2>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">Global and local hotkeys</p>
                    </div>
                </div>
                <button
                    onClick={resetToDefaults}
                    className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                </button>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded">
                            <X className="w-3 h-3" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Duplicate Warning */}
            {duplicates.length > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Some shortcuts share the same key combination. This may cause conflicts.</span>
                </div>
            )}

            {/* 3D Keyboard Visualization - Compact */}
            <div
                className="p-4 rounded-xl bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700"
                style={{ perspective: '800px' }}
            >
                <div
                    className="space-y-1.5"
                    style={{
                        transform: 'rotateX(10deg) scale(0.9)',
                        transformStyle: 'preserve-3d'
                    }}
                >
                    {KEYBOARD_KEYS.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-center gap-1">
                            {row.map((key) => {
                                const keyStyle = getKeyStyle(key);
                                const isWide = ['Shift', 'Ctrl', 'Alt', 'Space', 'Enter'].includes(key);
                                const usedKey = usedKeys.get(key.toUpperCase());

                                return (
                                    <motion.div
                                        key={key}
                                        className={clsx(
                                            "relative flex items-center justify-center rounded-md font-medium text-[10px] transition-all duration-200",
                                            "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600",
                                            "shadow-[0_2px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.3)]",
                                            isWide ? "px-2 h-8 min-w-[60px]" : "w-8 h-8",
                                            key === 'Space' && "min-w-[160px]"
                                        )}
                                        style={keyStyle}
                                        whileHover={{ y: -1 }}
                                        transition={{ duration: 0.1 }}
                                    >
                                        {key}
                                        {usedKey && !isModifierKey(key) && (
                                            <div
                                                className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: accentColor }}
                                            />
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                    Hover shortcut to view key
                </p>
            </div>

            {/* Shortcuts List - Grid Layout with Sections */}
            <div className="space-y-6">
                {/* Navigation Shortcuts Section */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <span className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></span>
                        Navigation Shortcuts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shortcuts.filter(s => !['ai-quick-add', 'quick-timer', 'quick-capture', 'quick-todo'].includes(s.id)).map((shortcut) => (
                            <ShortcutItem
                                key={shortcut.id}
                                shortcut={shortcut}
                                recordingId={recordingId}
                                duplicates={duplicates}
                                accentColor={accentColor}
                                startRecording={startRecording}
                                toggleShortcut={toggleShortcut}
                            />
                        ))}
                    </div>
                </div>

                {/* Quick Add Shortcuts Section */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <span className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></span>
                        Quick Add Shortcuts
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Frictionless capture)</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shortcuts.filter(s => ['ai-quick-add', 'quick-timer', 'quick-capture', 'quick-todo'].includes(s.id)).map((shortcut) => (
                            <ShortcutItem
                                key={shortcut.id}
                                shortcut={shortcut}
                                recordingId={recordingId}
                                duplicates={duplicates}
                                accentColor={accentColor}
                                startRecording={startRecording}
                                toggleShortcut={toggleShortcut}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                <strong>Global</strong> shortcuts work system-wide, even when the app is minimized.
            </p>
        </div>
    );
}
