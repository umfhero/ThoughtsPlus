import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, X, Tag } from 'lucide-react';
import { Task } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface QuickToDoAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void;
    wasTriggeredFromHidden?: boolean;
}

export function QuickToDoAddModal({ isOpen, onClose, onSaveTask, wasTriggeredFromHidden }: QuickToDoAddModalProps) {
    const { accentColor } = useTheme();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [tagHistory, setTagHistory] = useState<string[]>([]);
    const [color, setColor] = useState<string>('');
    const titleRef = useRef<HTMLInputElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);

    // Load tag history from all existing to-dos (last 3 most recent)
    useEffect(() => {
        if (isOpen) {
            const loadTagHistory = async () => {
                try {
                    // @ts-ignore
                    const data = await window.ipcRenderer.invoke('get-todos');
                    if (data && data.todos) {
                        const todos = data.todos;
                        const tagFrequency = new Map<string, number>();

                        // Count tag usage (more recent = higher weight)
                        todos.forEach((todo: any, index: number) => {
                            if (todo.tags && Array.isArray(todo.tags)) {
                                todo.tags.forEach((tag: string) => {
                                    const weight = todos.length - index; // More recent = higher weight
                                    tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + weight);
                                });
                            }
                        });

                        // Sort by frequency and take top 3
                        const sortedTags = Array.from(tagFrequency.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([tag]) => tag);

                        setTagHistory(sortedTags);
                    }
                } catch (err) {
                    console.error('Failed to load tag history:', err);
                }
            };
            loadTagHistory();
        }
    }, [isOpen]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setDescription('');
            setTags([]);
            setTagInput('');
            setColor('');

            if (titleRef.current) {
                setTimeout(() => {
                    titleRef.current?.focus();
                }, 100);
            }
        }
    }, [isOpen]);

    const saveAndClose = useCallback(async () => {
        if (title.trim()) {
            onSaveTask({
                title: title.trim(),
                description: description.trim() || undefined,
                tags: tags.length > 0 ? tags : undefined,
                completed: false,
                color: color || undefined,
            });
        }

        // Reset form
        setTitle('');
        setDescription('');
        setTags([]);
        setTagInput('');
        setColor('');

        if (wasTriggeredFromHidden) {
            try {
                // @ts-ignore
                await window.ipcRenderer?.invoke('close-quick-todo', true);
            } catch (e) {
                console.warn('[QuickToDoAdd] Failed to close via IPC:', e);
            }
        }

        onClose();
    }, [title, description, tags, color, onClose, onSaveTask, wasTriggeredFromHidden]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            saveAndClose();
            return;
        }

        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveAndClose();
        }
    }, [saveAndClose]);

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const addTagFromHistory = (tag: string) => {
        if (!tags.includes(tag)) {
            setTags([...tags, tag]);
        }
        tagInputRef.current?.focus();
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            saveAndClose();
        }
    }, [saveAndClose]);

    useEffect(() => {
        if (!isOpen) return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && document.activeElement !== titleRef.current) {
                saveAndClose();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isOpen, saveAndClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="relative z-10 w-full max-w-2xl mx-4"
                    >
                        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                                        style={{ backgroundColor: accentColor, boxShadow: `0 10px 15px -3px ${accentColor}40` }}
                                    >
                                        <CheckSquare className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick To-Do</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Add to your checklist</p>
                                    </div>
                                </div>
                                <button
                                    onClick={saveAndClose}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        To-Do Title *
                                    </label>
                                    <input
                                        ref={titleRef}
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="What needs to be done?"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base"
                                        style={{
                                            '--tw-ring-color': `${accentColor}50`,
                                            borderColor: title.trim() ? accentColor : undefined
                                        } as React.CSSProperties}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Description (optional)
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Add more details..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                                        style={{
                                            '--tw-ring-color': `${accentColor}50`,
                                        } as React.CSSProperties}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Color (optional)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {/* 5 Preset Colors */}
                                        <div className="flex gap-2">
                                            {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map((colorOption) => (
                                                <button
                                                    key={colorOption}
                                                    onClick={() => setColor(color === colorOption ? '' : colorOption)}
                                                    className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                                                    style={{
                                                        backgroundColor: colorOption,
                                                        borderColor: 'transparent',
                                                        boxShadow: color === colorOption ? '0 0 0 2px ' + colorOption : 'none'
                                                    }}
                                                    title={colorOption}
                                                />
                                            ))}
                                        </div>

                                        {/* Custom Color Picker */}
                                        <div className="relative w-8 h-8">
                                            <input
                                                type="color"
                                                value={color || '#3b82f6'}
                                                onChange={(e) => setColor(e.target.value)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                title="Custom color"
                                            />
                                            <div
                                                className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 pointer-events-none flex items-center justify-center overflow-hidden"
                                                style={{
                                                    background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Tags (optional)
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {tags.map((tag) => (
                                            <motion.span
                                                key={tag}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white"
                                                style={{ backgroundColor: accentColor }}
                                            >
                                                <Tag className="w-3 h-3" />
                                                {tag}
                                                <button
                                                    onClick={() => removeTag(tag)}
                                                    className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </motion.span>
                                        ))}
                                    </div>
                                    <div>
                                        <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" style={{ position: 'relative', display: 'inline-block', transform: 'none', left: 0, top: 0, marginRight: '8px', verticalAlign: 'middle' }} />
                                        <input
                                            ref={tagInputRef}
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={handleTagKeyDown}
                                            placeholder="Type and press Enter to add tags"
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                                            style={{
                                                '--tw-ring-color': `${accentColor}50`,
                                            } as React.CSSProperties}
                                        />
                                    </div>

                                    {/* Recent Tags as Chips */}
                                    {tagHistory.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recent tags:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {tagHistory.filter(t => !tags.includes(t)).map((tag) => (
                                                    <button
                                                        key={tag}
                                                        onClick={() => addTagFromHistory(tag)}
                                                        className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Press <kbd className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono">ESC</kbd> to save & close
                                    {' '} or <kbd className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono">Ctrl+Enter</kbd>
                                </p>
                                <button
                                    onClick={saveAndClose}
                                    disabled={!title.trim()}
                                    className="px-4 py-2 rounded-lg text-white font-medium text-sm transition-all shadow-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{
                                        backgroundColor: title.trim() ? accentColor : '#9ca3af',
                                        boxShadow: title.trim() ? `0 10px 15px -3px ${accentColor}40` : undefined
                                    }}
                                >
                                    {title.trim() ? 'Add To-Do' : 'Enter Title'}
                                </button>
                            </div>
                        </div>

                        <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${accentColor}20` }} />
                        <div className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${accentColor}20` }} />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
