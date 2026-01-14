import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Edit2, Check, X, ChevronLeft,
    Type, Code, FileText, Sparkles, FolderOpen, Clock
} from 'lucide-react';
import { NerdNotebook, NerdCell, NerdCellType, Page } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

interface NerdbookPageProps {
    notebooks: NerdNotebook[];
    onAddNotebook: (notebook: NerdNotebook) => void;
    onUpdateNotebook: (notebook: NerdNotebook) => void;
    onDeleteNotebook: (notebookId: string) => void;
    setPage: (page: Page) => void;
}

type NerdbookView = 'list' | 'editor';

// Color palette for notebooks
const NOTEBOOK_COLORS = [
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#f43f5e', // Rose
    '#84cc16', // Lime
];

export function NerdbookPage({
    notebooks,
    onAddNotebook,
    onUpdateNotebook,
    onDeleteNotebook,
    setPage
}: NerdbookPageProps) {
    const { accentColor } = useTheme();
    const [currentView, setCurrentView] = useState<NerdbookView>('list');
    const [activeNotebook, setActiveNotebook] = useState<NerdNotebook | null>(null);
    const [editingCellId, setEditingCellId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

    // Create a new notebook
    const handleCreateNotebook = () => {
        const newNotebook: NerdNotebook = {
            id: crypto.randomUUID(),
            title: 'Untitled Notebook',
            cells: [
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    content: '',
                    createdAt: new Date().toISOString(),
                }
            ],
            createdAt: new Date().toISOString(),
            color: NOTEBOOK_COLORS[Math.floor(Math.random() * NOTEBOOK_COLORS.length)],
        };
        onAddNotebook(newNotebook);
        setActiveNotebook(newNotebook);
        setCurrentView('editor');
        setEditingCellId(newNotebook.cells[0].id);
    };

    // Open a notebook for editing
    const handleOpenNotebook = (notebook: NerdNotebook) => {
        setActiveNotebook(notebook);
        setCurrentView('editor');
    };

    // Add a new cell
    const handleAddCell = (type: NerdCellType, afterCellId?: string) => {
        if (!activeNotebook) return;

        const newCell: NerdCell = {
            id: crypto.randomUUID(),
            type,
            content: '',
            createdAt: new Date().toISOString(),
        };

        let newCells: NerdCell[];
        if (afterCellId) {
            const index = activeNotebook.cells.findIndex(c => c.id === afterCellId);
            newCells = [
                ...activeNotebook.cells.slice(0, index + 1),
                newCell,
                ...activeNotebook.cells.slice(index + 1)
            ];
        } else {
            newCells = [...activeNotebook.cells, newCell];
        }

        const updatedNotebook = {
            ...activeNotebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setEditingCellId(newCell.id);
    };

    // Update a cell's content
    const handleUpdateCell = useCallback((cellId: string, content: string) => {
        if (!activeNotebook) return;

        const updatedCells = activeNotebook.cells.map(cell =>
            cell.id === cellId
                ? { ...cell, content, updatedAt: new Date().toISOString() }
                : cell
        );

        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        // Debounced save will handle this
    }, [activeNotebook]);

    // Delete a cell
    const handleDeleteCell = (cellId: string) => {
        if (!activeNotebook || activeNotebook.cells.length <= 1) return;

        const updatedCells = activeNotebook.cells.filter(c => c.id !== cellId);
        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setEditingCellId(null);
    };

    // Change cell type
    const handleChangeCellType = (cellId: string, newType: NerdCellType) => {
        if (!activeNotebook) return;

        const updatedCells = activeNotebook.cells.map(cell =>
            cell.id === cellId
                ? { ...cell, type: newType, updatedAt: new Date().toISOString() }
                : cell
        );

        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
    };

    // Save notebook title
    const handleSaveTitle = () => {
        if (!activeNotebook || !titleInput.trim()) return;

        const updatedNotebook = {
            ...activeNotebook,
            title: titleInput.trim(),
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setEditingTitle(false);
    };

    // Auto-save on blur or when navigating away
    const handleSaveNotebook = useCallback(() => {
        if (activeNotebook) {
            onUpdateNotebook(activeNotebook);
        }
    }, [activeNotebook, onUpdateNotebook]);

    // Debounce save
    useEffect(() => {
        if (!activeNotebook) return;
        const timeout = setTimeout(() => {
            handleSaveNotebook();
        }, 1000);
        return () => clearTimeout(timeout);
    }, [activeNotebook, handleSaveNotebook]);

    // Auto-resize textarea
    const autoResizeTextarea = (textarea: HTMLTextAreaElement | null) => {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Handle keyboard shortcuts in cells
    const handleCellKeyDown = (e: React.KeyboardEvent, cellId: string) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Enter: Add new cell below
            e.preventDefault();
            handleAddCell('text', cellId);
        } else if (e.key === 'Escape') {
            // Escape: Finish editing
            setEditingCellId(null);
        } else if (e.key === 'Backspace' && e.ctrlKey && e.shiftKey) {
            // Ctrl+Shift+Backspace: Delete cell
            e.preventDefault();
            handleDeleteCell(cellId);
        }
    };

    // Format relative time
    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Filter notebooks
    const filteredNotebooks = useMemo(() => {
        if (!searchQuery.trim()) return notebooks;
        const query = searchQuery.toLowerCase();
        return notebooks.filter(nb =>
            nb.title.toLowerCase().includes(query) ||
            nb.cells.some(cell => cell.content.toLowerCase().includes(query))
        );
    }, [notebooks, searchQuery]);

    // Sorted notebooks (most recent first)
    const sortedNotebooks = useMemo(() => {
        return [...filteredNotebooks].sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt).getTime();
            return bTime - aTime;
        });
    }, [filteredNotebooks]);

    // Render markdown preview (simple version)
    const renderMarkdownPreview = (content: string) => {
        // Very basic markdown rendering for preview
        let html = content
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-sm font-mono">$1</code>')
            .replace(/\n/gim, '<br />');
        return html;
    };

    // Cell type icons
    const getCellTypeIcon = (type: NerdCellType) => {
        switch (type) {
            case 'markdown': return FileText;
            case 'code': return Code;
            case 'text': default: return Type;
        }
    };

    // Cell type labels
    const getCellTypeLabel = (type: NerdCellType) => {
        switch (type) {
            case 'markdown': return 'Markdown';
            case 'code': return 'Code';
            case 'text': default: return 'Text';
        }
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden">
            <AnimatePresence mode="wait">
                {currentView === 'list' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full flex flex-col space-y-6"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setPage('notebook')}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Back to Notebook"
                                >
                                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                                <div
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                                    style={{ backgroundColor: accentColor, boxShadow: `0 10px 15px -3px ${accentColor}40` }}
                                >
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nerdbook</h1>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {notebooks.length} {notebooks.length === 1 ? 'notebook' : 'notebooks'}
                                    </p>
                                </div>
                            </div>

                            {/* Create Button */}
                            <button
                                onClick={handleCreateNotebook}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-all hover:scale-105 hover:shadow-lg"
                                style={{ backgroundColor: accentColor, boxShadow: `0 4px 12px ${accentColor}40` }}
                            >
                                <Plus className="w-4 h-4" />
                                <span>New Notebook</span>
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search notebooks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 pl-11 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 text-sm"
                                style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                            />
                            <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        {/* Notebooks Grid */}
                        <div className="flex-1 overflow-y-auto thin-scrollbar">
                            {sortedNotebooks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div
                                        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                                        style={{ backgroundColor: `${accentColor}15` }}
                                    >
                                        <Sparkles className="w-10 h-10" style={{ color: accentColor }} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {searchQuery ? 'No notebooks found' : 'No notebooks yet'}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
                                        {searchQuery
                                            ? 'Try a different search term'
                                            : 'Create your first Nerdbook to start capturing ideas with rich text, code, and diagrams!'
                                        }
                                    </p>
                                    {!searchQuery && (
                                        <button
                                            onClick={handleCreateNotebook}
                                            className="px-4 py-2 rounded-xl text-white font-medium transition-all hover:scale-105"
                                            style={{ backgroundColor: accentColor }}
                                        >
                                            Create Notebook
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sortedNotebooks.map((notebook, index) => (
                                        <motion.div
                                            key={notebook.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="group relative"
                                        >
                                            <button
                                                onClick={() => handleOpenNotebook(notebook)}
                                                className={clsx(
                                                    "w-full text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700",
                                                    "p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                                                )}
                                            >
                                                {/* Color accent bar */}
                                                <div
                                                    className="w-10 h-1 rounded-full mb-3"
                                                    style={{ backgroundColor: notebook.color || accentColor }}
                                                />

                                                <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                                                    {notebook.title}
                                                </h3>

                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                                                    {notebook.cells[0]?.content.slice(0, 100) || 'Empty notebook'}
                                                </p>

                                                <div className="flex items-center justify-between text-xs text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatRelativeTime(notebook.updatedAt || notebook.createdAt)}
                                                    </span>
                                                    <span>{notebook.cells.length} cells</span>
                                                </div>
                                            </button>

                                            {/* Delete button (hidden, shows on hover) */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (deleteConfirmId === notebook.id) {
                                                        onDeleteNotebook(notebook.id);
                                                        setDeleteConfirmId(null);
                                                    } else {
                                                        setDeleteConfirmId(notebook.id);
                                                        setTimeout(() => setDeleteConfirmId(null), 3000);
                                                    }
                                                }}
                                                className={clsx(
                                                    "absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                                                    deleteConfirmId === notebook.id
                                                        ? "bg-red-500 text-white"
                                                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-red-100 hover:text-red-500"
                                                )}
                                                title={deleteConfirmId === notebook.id ? "Click again to confirm" : "Delete notebook"}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full flex flex-col"
                    >
                        {/* Editor Header */}
                        <div className="flex items-center justify-between shrink-0 mb-4">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        handleSaveNotebook();
                                        setCurrentView('list');
                                        setActiveNotebook(null);
                                    }}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Back to list"
                                >
                                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>

                                {editingTitle ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={titleInput}
                                            onChange={(e) => setTitleInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveTitle();
                                                if (e.key === 'Escape') setEditingTitle(false);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 text-lg font-semibold"
                                            style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSaveTitle}
                                            className="p-1.5 rounded-lg text-white"
                                            style={{ backgroundColor: accentColor }}
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setEditingTitle(false)}
                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setTitleInput(activeNotebook?.title || '');
                                            setEditingTitle(true);
                                        }}
                                        className="flex items-center gap-2 group"
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: activeNotebook?.color || accentColor }}
                                        />
                                        <h1 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                                            {activeNotebook?.title}
                                        </h1>
                                        <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                )}
                            </div>

                            {/* Toolbar */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
                                    <button
                                        onClick={() => handleAddCell('text')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                        title="Add text cell"
                                    >
                                        <Type className="w-4 h-4" />
                                        <span className="hidden sm:inline">Text</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddCell('markdown')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                        title="Add markdown cell"
                                    >
                                        <FileText className="w-4 h-4" />
                                        <span className="hidden sm:inline">Markdown</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddCell('code')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                        title="Add code cell"
                                    >
                                        <Code className="w-4 h-4" />
                                        <span className="hidden sm:inline">Code</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Cells Container */}
                        <div className="flex-1 overflow-y-auto thin-scrollbar space-y-3 pb-20">
                            <AnimatePresence>
                                {activeNotebook?.cells.map((cell) => {
                                    const CellIcon = getCellTypeIcon(cell.type);
                                    const isEditing = editingCellId === cell.id;

                                    return (
                                        <motion.div
                                            key={cell.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="group relative"
                                        >
                                            <div
                                                className={clsx(
                                                    "relative bg-white dark:bg-gray-800 rounded-xl border transition-all",
                                                    isEditing
                                                        ? "border-2 shadow-lg"
                                                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                                )}
                                                style={{
                                                    borderColor: isEditing ? (activeNotebook?.color || accentColor) : undefined,
                                                    boxShadow: isEditing ? `0 4px 20px ${activeNotebook?.color || accentColor}20` : undefined,
                                                }}
                                            >
                                                {/* Cell Type Indicator */}
                                                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                                                    <div
                                                        className="p-1 rounded"
                                                        style={{ backgroundColor: `${activeNotebook?.color || accentColor}15` }}
                                                    >
                                                        <CellIcon
                                                            className="w-3.5 h-3.5"
                                                            style={{ color: activeNotebook?.color || accentColor }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        {getCellTypeLabel(cell.type)}
                                                    </span>

                                                    {/* Cell Actions */}
                                                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {/* Type Switcher */}
                                                        <div className="flex items-center gap-0.5">
                                                            {(['text', 'markdown', 'code'] as NerdCellType[]).map(type => {
                                                                const Icon = getCellTypeIcon(type);
                                                                return (
                                                                    <button
                                                                        key={type}
                                                                        onClick={() => handleChangeCellType(cell.id, type)}
                                                                        className={clsx(
                                                                            "p-1 rounded transition-colors",
                                                                            cell.type === type
                                                                                ? "bg-gray-200 dark:bg-gray-600"
                                                                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                        )}
                                                                        title={getCellTypeLabel(type)}
                                                                    >
                                                                        <Icon className="w-3 h-3 text-gray-500" />
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />

                                                        {/* Add cell after */}
                                                        <button
                                                            onClick={() => handleAddCell('text', cell.id)}
                                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                            title="Add cell below"
                                                        >
                                                            <Plus className="w-3 h-3 text-gray-500" />
                                                        </button>

                                                        {/* Delete cell */}
                                                        {activeNotebook.cells.length > 1 && (
                                                            <button
                                                                onClick={() => handleDeleteCell(cell.id)}
                                                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                                                                title="Delete cell (Ctrl+Shift+Backspace)"
                                                            >
                                                                <Trash2 className="w-3 h-3 text-gray-500" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Cell Content */}
                                                <div
                                                    className="p-4 cursor-text"
                                                    onClick={() => setEditingCellId(cell.id)}
                                                >
                                                    {isEditing ? (
                                                        <textarea
                                                            ref={(el) => {
                                                                textareaRefs.current[cell.id] = el;
                                                                if (el) autoResizeTextarea(el);
                                                            }}
                                                            value={cell.content}
                                                            onChange={(e) => {
                                                                handleUpdateCell(cell.id, e.target.value);
                                                                autoResizeTextarea(e.target);
                                                            }}
                                                            onKeyDown={(e) => handleCellKeyDown(e, cell.id)}
                                                            onBlur={handleSaveNotebook}
                                                            placeholder={
                                                                cell.type === 'markdown'
                                                                    ? "Write markdown here... (# Heading, **bold**, *italic*, `code`)"
                                                                    : cell.type === 'code'
                                                                        ? "// Write code here..."
                                                                        : "Start typing..."
                                                            }
                                                            className={clsx(
                                                                "w-full resize-none focus:outline-none bg-transparent",
                                                                "text-gray-900 dark:text-gray-100 placeholder-gray-400",
                                                                cell.type === 'code' && "font-mono text-sm"
                                                            )}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <div
                                                            className={clsx(
                                                                "min-h-[1.5rem]",
                                                                cell.type === 'code' && "font-mono text-sm bg-gray-50 dark:bg-gray-900 -m-4 p-4 rounded-b-xl",
                                                                !cell.content && "text-gray-400 italic"
                                                            )}
                                                        >
                                                            {cell.content ? (
                                                                cell.type === 'markdown' ? (
                                                                    <div
                                                                        className="prose dark:prose-invert prose-sm max-w-none"
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: renderMarkdownPreview(cell.content)
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <pre className="whitespace-pre-wrap">{cell.content}</pre>
                                                                )
                                                            ) : (
                                                                'Click to edit...'
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Keyboard hints */}
                                            {isEditing && (
                                                <div className="absolute -bottom-5 left-4 text-[10px] text-gray-400 flex gap-3">
                                                    <span>Ctrl+Enter: new cell</span>
                                                    <span>Esc: done</span>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {/* Quick add button at bottom */}
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={() => handleAddCell('text')}
                                className="w-full py-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add cell</span>
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
