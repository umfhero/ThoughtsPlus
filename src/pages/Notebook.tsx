import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, Trash2, Edit2, Clock, SortAsc, SortDesc, Check, X, PenTool, ChevronLeft, Layers, ChevronRight, Sparkles } from 'lucide-react';
import { QuickNote, NerdNotebook, Page } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

interface NotebookPageProps {
    notes: QuickNote[];
    onDeleteNote: (noteId: string) => void;
    onUpdateNote: (note: QuickNote) => void;
    setPage: (page: Page) => void;
    nerdbooks?: NerdNotebook[];
    onOpenNerdbook?: () => void;
}

type NotebookView = 'hub' | 'quicknotes' | 'nerdbook';



interface RecentItem {
    type: 'board' | 'quicknote' | 'nerdbook';
    id: string;
    title: string;
    timestamp: number;
    noteCount?: number;
    preview?: string;
}

export function NotebookPage({ notes, onDeleteNote, onUpdateNote, setPage, nerdbooks = [], onOpenNerdbook }: NotebookPageProps) {
    const { accentColor } = useTheme();
    const [currentView, setCurrentView] = useState<NotebookView>('hub');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [boardCount, setBoardCount] = useState(0);
    const [boardPreview, setBoardPreview] = useState<string | null>(null);
    const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
    const [boards, setBoards] = useState<any[]>([]);

    // Load board data
    useEffect(() => {
        const loadBoardData = async () => {
            try {
                // @ts-ignore
                const response = await window.ipcRenderer.invoke('get-boards');
                let loadedBoards: any[] = [];
                if (response) {
                    if (Array.isArray(response)) {
                        loadedBoards = response;
                    } else if (response.boards && Array.isArray(response.boards)) {
                        loadedBoards = response.boards;
                    }
                }
                setBoards(loadedBoards);
                setBoardCount(loadedBoards.length);

                // Try to get a board preview image
                const lastActive = response?.activeBoardId || (loadedBoards[0]?.id);
                if (lastActive) {
                    const previewData = localStorage.getItem(`boardPreviewImage_${lastActive}`);
                    if (previewData) {
                        const parsed = JSON.parse(previewData);
                        setBoardPreview(parsed.image);
                    }
                }
            } catch (e) {
                console.error('Failed to load board data for notebook:', e);
            }
        };
        loadBoardData();
    }, []);

    // Build recent items from quick notes and boards
    useEffect(() => {
        const buildRecents = () => {
            const recents: RecentItem[] = [];

            // Add most recent quick notes (by createdAt or updatedAt)
            const sortedNotes = [...notes].sort((a, b) => {
                const aTime = new Date(a.updatedAt || a.createdAt).getTime();
                const bTime = new Date(b.updatedAt || b.createdAt).getTime();
                return bTime - aTime;
            });

            // Add up to 3 most recent quick notes
            sortedNotes.slice(0, 3).forEach(note => {
                recents.push({
                    type: 'quicknote',
                    id: note.id,
                    title: note.content.slice(0, 50) + (note.content.length > 50 ? '...' : ''),
                    timestamp: new Date(note.updatedAt || note.createdAt).getTime(),
                    noteCount: 1 // Single note
                });
            });

            // Add most recently accessed board
            if (boards.length > 0) {
                // Find board with most recent access
                const sortedBoards = [...boards].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                const lastBoard = sortedBoards[0];

                if (lastBoard && lastBoard.lastAccessed) {
                    recents.push({
                        type: 'board',
                        id: lastBoard.id,
                        title: lastBoard.name || 'Untitled Board',
                        timestamp: lastBoard.lastAccessed,
                        noteCount: lastBoard.notes?.length || 0
                    });
                }
            }

            // Sort by timestamp (most recent first) and take top 3
            recents.sort((a, b) => b.timestamp - a.timestamp);
            setRecentItems(recents.slice(0, 3));
        };

        buildRecents();
    }, [notes, boards]);

    // Filter and sort notes
    const filteredNotes = useMemo(() => {
        let result = [...notes];

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(note =>
                note.content.toLowerCase().includes(query)
            );
        }

        // Sort by date
        result.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [notes, searchQuery, sortOrder]);

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (days === 1) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        }
    };

    // Format relative time for recents
    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Handle edit save
    const handleSaveEdit = (noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (note && editContent.trim()) {
            onUpdateNote({
                ...note,
                content: editContent.trim(),
                updatedAt: new Date().toISOString(),
            });
        }
        setEditingNoteId(null);
        setEditContent('');
    };

    // Handle edit cancel
    const handleCancelEdit = () => {
        setEditingNoteId(null);
        setEditContent('');
    };

    // Start editing a note
    const startEditing = (note: QuickNote) => {
        setEditingNoteId(note.id);
        setEditContent(note.content);
    };

    // Navigate to Board page
    const handleBoardClick = () => {
        // Save board access time
        localStorage.setItem('lastBoardAccess', JSON.stringify({
            id: 'boards',
            name: 'Boards',
            timestamp: Date.now(),
        }));
        setPage('drawing');
    };

    // Handle recent item click
    const handleRecentClick = (item: RecentItem) => {
        if (item.type === 'board') {
            handleBoardClick();
        } else {
            setCurrentView('quicknotes');
        }
    };

    // Note structure cards for the hub view
    const noteStructures = [
        {
            id: 'board',
            title: 'Boards',
            description: 'Infinite canvas workspaces with sticky notes, images, and more',
            icon: PenTool,
            count: boardCount,
            countLabel: boardCount === 1 ? 'board' : 'boards',
            preview: boardPreview,
            onClick: handleBoardClick,
        },
        {
            id: 'quicknotes',
            title: 'Quick Notes',
            description: 'Instantly capture thoughts with Ctrl+Shift+N from anywhere',
            icon: BookOpen,
            count: notes.length,
            countLabel: notes.length === 1 ? 'note' : 'notes',
            preview: null,
            onClick: () => setCurrentView('quicknotes'),
        },
        {
            id: 'nerdbook',
            title: 'Nerdbook',
            description: 'Cell-based notebooks for structured note-taking with code and markdown',
            icon: Sparkles,
            count: nerdbooks.length,
            countLabel: nerdbooks.length === 1 ? 'notebook' : 'notebooks',
            preview: null,
            onClick: onOpenNerdbook || (() => { }),
        },
    ];

    // Mock Quick Notes preview component
    const QuickNotesMockPreview = () => (
        <div className="w-full h-full p-2 flex flex-col gap-1.5 overflow-hidden">
            {/* Mock note cards */}
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="flex-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 flex flex-col"
                    style={{ opacity: 1 - (i - 1) * 0.2 }}
                >
                    <div
                        className="h-1.5 rounded-full mb-1.5"
                        style={{
                            backgroundColor: `${accentColor}${30 + i * 10}`,
                            width: `${90 - i * 15}%`
                        }}
                    />
                    <div className="flex-1 space-y-1">
                        <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-600" style={{ width: '100%' }} />
                        <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-600" style={{ width: '80%' }} />
                        {i === 1 && <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-600" style={{ width: '60%' }} />}
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `${accentColor}40` }} />
                        <div className="h-1 rounded-full bg-gray-300 dark:bg-gray-500" style={{ width: '30%' }} />
                    </div>
                </div>
            ))}
        </div>
    );

    // Mock Board preview component (randomly placed notes, todos, images)
    const BoardMockPreview = () => (
        <div className="w-full h-full relative overflow-hidden bg-gray-50 dark:bg-gray-900 rounded-lg">
            {/* Grid dots background */}
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `radial-gradient(circle, ${accentColor}30 1px, transparent 1px)`,
                    backgroundSize: '8px 8px'
                }}
            />

            {/* Sticky note 1 - Yellow, rotated */}
            <div
                className="absolute w-12 h-10 rounded shadow-sm border border-yellow-300 dark:border-yellow-600/50"
                style={{
                    left: '8%', top: '15%',
                    backgroundColor: '#FEF3C7',
                    transform: 'rotate(-3deg)'
                }}
            >
                <div className="p-1 space-y-0.5">
                    <div className="h-0.5 rounded-full bg-yellow-500/40" style={{ width: '80%' }} />
                    <div className="h-0.5 rounded-full bg-yellow-500/40" style={{ width: '60%' }} />
                    <div className="h-0.5 rounded-full bg-yellow-500/40" style={{ width: '40%' }} />
                </div>
            </div>

            {/* Todo list note - Blue */}
            <div
                className="absolute w-14 h-12 rounded shadow-sm border border-blue-200 dark:border-blue-600/50"
                style={{
                    right: '10%', top: '10%',
                    backgroundColor: '#DBEAFE',
                    transform: 'rotate(2deg)'
                }}
            >
                <div className="p-1.5 space-y-1">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-sm border border-blue-400" />
                        <div className="h-0.5 rounded-full bg-blue-500/40 flex-1" />
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-sm bg-blue-400" />
                        <div className="h-0.5 rounded-full bg-blue-400/30 flex-1" />
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-sm border border-blue-400" />
                        <div className="h-0.5 rounded-full bg-blue-500/40" style={{ width: '70%' }} />
                    </div>
                </div>
            </div>

            {/* Image placeholder - improved for dark mode */}
            <div
                className="absolute w-11 h-9 rounded shadow-sm border-2 border-white dark:border-gray-500 overflow-hidden"
                style={{ left: '35%', top: '40%', transform: 'rotate(1deg)' }}
            >
                <div className="w-full h-full bg-gradient-to-br from-sky-300 via-indigo-200 to-violet-300 dark:from-sky-600 dark:via-indigo-500 dark:to-violet-600 relative">
                    {/* Sun */}
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-300 dark:bg-amber-400" style={{ top: '10%', right: '15%' }} />
                    {/* Mountains/hills */}
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-emerald-400 dark:from-emerald-600 to-transparent" />
                    <div className="absolute bottom-0 left-1 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[10px] border-l-transparent border-r-transparent border-b-emerald-500 dark:border-b-emerald-700" />
                </div>
            </div>

            {/* Sticky note 2 - Green, bottom left */}
            <div
                className="absolute w-10 h-9 rounded shadow-sm border border-green-300 dark:border-green-600/50"
                style={{
                    left: '5%', bottom: '15%',
                    backgroundColor: '#D1FAE5',
                    transform: 'rotate(4deg)'
                }}
            >
                <div className="p-1 space-y-0.5">
                    <div className="h-0.5 rounded-full bg-green-500/40" style={{ width: '90%' }} />
                    <div className="h-0.5 rounded-full bg-green-500/40" style={{ width: '70%' }} />
                </div>
            </div>

            {/* Sticky note 3 - Pink, bottom right (proper note) */}
            <div
                className="absolute w-11 h-10 rounded shadow-sm border border-pink-300 dark:border-pink-600/50"
                style={{
                    right: '12%', bottom: '12%',
                    backgroundColor: '#FCE7F3',
                    transform: 'rotate(-2deg)'
                }}
            >
                <div className="p-1 space-y-0.5">
                    <div className="h-0.5 rounded-full bg-pink-500/40" style={{ width: '85%' }} />
                    <div className="h-0.5 rounded-full bg-pink-500/40" style={{ width: '65%' }} />
                    <div className="h-0.5 rounded-full bg-pink-500/40" style={{ width: '75%' }} />
                </div>
            </div>
        </div>
    );

    // Mock Nerdbook preview component (document with text and code cells)
    const NerdbookMockPreview = () => (
        <div className="w-full h-full p-2 flex flex-col gap-1 overflow-hidden bg-white dark:bg-gray-800 rounded-lg">
            {/* Document header / title */}
            <div className="flex items-center gap-1 mb-0.5 px-1">
                <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: accentColor }}
                />
                <div className="h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 font-bold" style={{ width: '45%' }} />
            </div>

            {/* Text section 1 */}
            <div className="px-1 space-y-0.5">
                <div className="h-0.5 rounded-full bg-gray-200 dark:bg-gray-600" style={{ width: '100%' }} />
                <div className="h-0.5 rounded-full bg-gray-200 dark:bg-gray-600" style={{ width: '85%' }} />
            </div>

            {/* Code cell - expanded to fill more space */}
            <div className="flex-1 mt-1 rounded border border-gray-200 dark:border-gray-600 overflow-hidden flex flex-col">
                {/* Code cell header */}
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 shrink-0">
                    <div
                        className="w-1 h-1 rounded-sm"
                        style={{ backgroundColor: accentColor }}
                    />
                    <div className="h-0.5 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: '12%' }} />
                </div>
                {/* Code content - more lines */}
                <div className="flex-1 p-1.5 bg-gray-50 dark:bg-gray-900 space-y-0.5 font-mono">
                    <div className="flex gap-1">
                        <div className="h-0.5 rounded-full bg-purple-400/70" style={{ width: '10%' }} />
                        <div className="h-0.5 rounded-full bg-blue-400/70" style={{ width: '18%' }} />
                        <div className="h-0.5 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: '6%' }} />
                    </div>
                    <div className="flex gap-1 pl-2">
                        <div className="h-0.5 rounded-full bg-green-400/70" style={{ width: '22%' }} />
                    </div>
                    <div className="flex gap-1 pl-2">
                        <div className="h-0.5 rounded-full bg-yellow-400/70" style={{ width: '12%' }} />
                        <div className="h-0.5 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: '15%' }} />
                    </div>
                    <div className="flex gap-1 pl-2">
                        <div className="h-0.5 rounded-full bg-orange-400/70" style={{ width: '18%' }} />
                    </div>
                    <div className="flex gap-1">
                        <div className="h-0.5 rounded-full bg-purple-400/70" style={{ width: '8%' }} />
                        <div className="h-0.5 rounded-full bg-cyan-400/70" style={{ width: '14%' }} />
                    </div>

                    {/* Diagram/nodes visual */}
                    <div className="flex items-center gap-1 pt-1 mt-0.5 border-t border-gray-200 dark:border-gray-700">
                        <div
                            className="w-3 h-2 rounded-sm border flex items-center justify-center"
                            style={{ borderColor: accentColor, backgroundColor: `${accentColor}20` }}
                        >
                            <div className="w-1 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />
                        </div>
                        <div className="h-px w-2 bg-gray-400 dark:bg-gray-500" />
                        <div
                            className="w-3 h-2 rounded-sm border border-green-400 bg-green-400/20 flex items-center justify-center"
                        >
                            <div className="w-1 h-0.5 rounded-full bg-green-400" />
                        </div>
                        <div className="h-px w-2 bg-gray-400 dark:bg-gray-500" />
                        <div
                            className="w-3 h-2 rounded-sm border border-orange-400 bg-orange-400/20 flex items-center justify-center"
                        >
                            <div className="w-1 h-0.5 rounded-full bg-orange-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Text section 2 - reduced */}
            <div className="px-1 mt-0.5 space-y-0.5 shrink-0">
                <div className="h-0.5 rounded-full bg-gray-200 dark:bg-gray-600" style={{ width: '70%' }} />
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden">
            <AnimatePresence mode="wait">
                {currentView === 'hub' ? (
                    <motion.div
                        key="hub"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full flex flex-col space-y-6"
                    >
                        {/* Hub Header */}
                        <div className="flex items-center gap-4 shrink-0">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                                style={{ backgroundColor: accentColor, boxShadow: `0 10px 15px -3px ${accentColor}40` }}
                            >
                                <Layers className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notebook</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Your note structures
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto thin-scrollbar space-y-6">
                            {/* Recents Section */}
                            {recentItems.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock className="w-4 h-4" style={{ color: accentColor }} />
                                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent</h2>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1">
                                        {recentItems.map((item, index) => (
                                            <motion.button
                                                key={`${item.type}-${item.id}-${index}`}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.05 }}
                                                onClick={() => handleRecentClick(item)}
                                                className={clsx(
                                                    "flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700",
                                                    "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50",
                                                    "transition-all duration-200 hover:scale-[1.02] min-w-[200px] flex-shrink-0"
                                                )}
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: `${accentColor}15` }}
                                                >
                                                    {item.type === 'board' ? (
                                                        <PenTool className="w-4 h-4" style={{ color: accentColor }} />
                                                    ) : (
                                                        <BookOpen className="w-4 h-4" style={{ color: accentColor }} />
                                                    )}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {item.type === 'board' && item.noteCount !== undefined
                                                            ? `${item.noteCount} ${item.noteCount === 1 ? 'note' : 'notes'} • ${formatRelativeTime(item.timestamp)}`
                                                            : formatRelativeTime(item.timestamp)
                                                        }
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                            </motion.button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Note Structure Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {noteStructures.map((structure, index) => (
                                    <motion.button
                                        key={structure.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 + 0.1, type: "spring", stiffness: 300, damping: 30 }}
                                        onClick={structure.onClick}
                                        className={clsx(
                                            "group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700",
                                            "p-6 text-left transition-all duration-300",
                                            "hover:shadow-xl hover:scale-[1.02] hover:border-transparent"
                                        )}
                                        style={{
                                            '--hover-shadow': `${accentColor}25`,
                                        } as React.CSSProperties}
                                    >
                                        {/* Preview Image / Mock Preview */}
                                        <div
                                            className="w-full h-36 rounded-xl mb-4 overflow-hidden flex items-center justify-center"
                                            style={{ backgroundColor: `${accentColor}08` }}
                                        >
                                            {structure.id === 'board' && structure.preview ? (
                                                <img
                                                    src={structure.preview}
                                                    alt={structure.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : structure.id === 'board' ? (
                                                <BoardMockPreview />
                                            ) : structure.id === 'quicknotes' ? (
                                                <QuickNotesMockPreview />
                                            ) : structure.id === 'nerdbook' ? (
                                                <NerdbookMockPreview />
                                            ) : (
                                                <structure.icon
                                                    className="w-12 h-12 transition-transform group-hover:scale-110"
                                                    style={{ color: accentColor }}
                                                />
                                            )}
                                        </div>

                                        {/* Card Content */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                                    {structure.title}
                                                </h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                    {structure.description}
                                                </p>
                                            </div>
                                            <div
                                                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                                                style={{
                                                    backgroundColor: `${accentColor}15`,
                                                    color: accentColor,
                                                }}
                                            >
                                                {structure.count} {structure.countLabel}
                                            </div>
                                        </div>

                                        {/* Hover Accent Border */}
                                        <div
                                            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                            style={{
                                                boxShadow: `inset 0 0 0 2px ${accentColor}`,
                                            }}
                                        />
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="quicknotes"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full flex flex-col space-y-6"
                    >
                        {/* Quick Notes Header */}
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setCurrentView('hub')}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Back to Notebook"
                                >
                                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                                <div
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                                    style={{ backgroundColor: accentColor, boxShadow: `0 10px 15px -3px ${accentColor}40` }}
                                >
                                    <BookOpen className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Notes</h1>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {notes.length} {notes.length === 1 ? 'note' : 'notes'} • Captured thoughts
                                    </p>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-3">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search notes..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 pr-4 py-2 w-64 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 text-sm"
                                        style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                                    />
                                </div>

                                {/* Sort Toggle */}
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                                    className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors"
                                    style={{ '--hover-border': accentColor } as React.CSSProperties}
                                    title={sortOrder === 'newest' ? 'Showing newest first' : 'Showing oldest first'}
                                >
                                    {sortOrder === 'newest' ? (
                                        <SortDesc className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    ) : (
                                        <SortAsc className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Notes Grid */}
                        <div className="flex-1 overflow-y-auto thin-scrollbar">
                            {filteredNotes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div
                                        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                                        style={{ backgroundColor: `${accentColor}15` }}
                                    >
                                        <BookOpen className="w-10 h-10" style={{ color: accentColor }} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {searchQuery ? 'No notes found' : 'No notes yet'}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                                        {searchQuery
                                            ? 'Try a different search term'
                                            : 'Use the global hotkey (Ctrl+Shift+N) anywhere to quickly capture a thought!'
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <AnimatePresence mode="popLayout">
                                        {filteredNotes.map((note, index) => (
                                            <motion.div
                                                key={note.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 400,
                                                    damping: 30,
                                                    delay: index * 0.05
                                                }}
                                                className="group relative"
                                            >
                                                <div className={clsx(
                                                    "bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300",
                                                    "hover:shadow-lg dark:hover:shadow-gray-900/20"
                                                )}
                                                    style={{ '--hover-shadow': `${accentColor}15` } as React.CSSProperties}
                                                >
                                                    {/* Note Content */}
                                                    <div className="p-4">
                                                        {editingNoteId === note.id ? (
                                                            <div className="space-y-3">
                                                                <textarea
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    className="w-full h-32 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 resize-none focus:outline-none focus:ring-2 text-sm"
                                                                    style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                                                                    autoFocus
                                                                />
                                                                <div className="flex items-center gap-2 justify-end">
                                                                    <button
                                                                        onClick={handleCancelEdit}
                                                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleSaveEdit(note.id)}
                                                                        className="p-2 rounded-lg text-white hover:brightness-110 transition-all"
                                                                        style={{ backgroundColor: accentColor }}
                                                                    >
                                                                        <Check className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed line-clamp-6 whitespace-pre-wrap">
                                                                    {note.content}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Footer */}
                                                    {editingNoteId !== note.id && (
                                                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                <span>{formatDate(note.createdAt)}</span>
                                                                {note.updatedAt && (
                                                                    <span className="text-gray-400">• edited</span>
                                                                )}
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => startEditing(note)}
                                                                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                                                                    style={{ '--hover-color': accentColor } as React.CSSProperties}
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>

                                                                {deleteConfirmId === note.id ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                onDeleteNote(note.id);
                                                                                setDeleteConfirmId(null);
                                                                            }}
                                                                            className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                                                                            title="Confirm delete"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDeleteConfirmId(null)}
                                                                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                                                                            title="Cancel"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setDeleteConfirmId(note.id)}
                                                                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
