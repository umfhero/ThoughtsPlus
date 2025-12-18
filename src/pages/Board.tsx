import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Calculator, BookOpen, Sparkles, X, Trash2, Folder, Upload, Mic, Link as LinkIcon, MoreVertical, MessageSquare, List, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface StickyNote {
    id: string;
    type: 'text' | 'list' | 'calculator' | 'image' | 'audio' | 'link';
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
    color: string;
    paperStyle: 'smooth' | 'lined' | 'grid';
    attachmentStyle: 'tape-orange' | 'tape-blue' | 'tape-green' | 'tape-purple' | 'pin-red' | 'pin-blue' | 'pin-green' | 'none';
    font: 'modern' | 'serif' | 'handwritten' | 'script';
    fontSize: number;
    listItems?: { id: string; text: string; checked: boolean }[];
    imageUrl?: string;
    audioUrl?: string;
    linkUrl?: string;
}

interface Board {
    id: string;
    name: string;
    color: string;
    notes: StickyNote[];
}

const COLORS = [
    { name: 'Cozy Cream', value: '#FFF8DC' },
    { name: 'Soft Beige', value: '#F5F5DC' },
    { name: 'Cloud Gray', value: '#E8E8E8' },
    { name: 'Pale Mint', value: '#E0F2E9' },
    { name: 'Sky Whisper', value: '#E6F3FF' },
    { name: 'Soft Lavender', value: '#E6E6FA' },
    { name: 'Peach', value: '#FFE5B4' },
    { name: 'Light Yellow', value: '#FFFFE0' },
];

const BOARD_COLORS = ['#FFD4A3', '#FFE699', '#B4E7CE', '#A8D8EA', '#E6B8D7', '#D4C5F9'];

const BACKGROUNDS = [
    { name: 'Default', value: 'bg-[#F5F1E8] dark:bg-gray-900' },
    { name: 'Grid', value: 'bg-[#F5F1E8] dark:bg-gray-900', pattern: 'grid' },
    { name: 'Dots', value: 'bg-[#F0EDE5] dark:bg-gray-900', pattern: 'dots' },
    { name: 'Cork', value: 'bg-[#D4A574] dark:bg-gray-800', pattern: 'cork' },
    { name: 'Linen', value: 'bg-[#FAF9F6] dark:bg-gray-900', pattern: 'linen' },
];

const FONTS = [
    { name: 'Modern', value: 'modern' },
    { name: 'Serif', value: 'serif' },
    { name: 'Handwritten', value: 'handwritten' },
    { name: 'Script', value: 'script' },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export function BoardPage({ refreshTrigger }: { refreshTrigger?: number }) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [boards, setBoards] = useState<Board[]>([]);
    const [activeBoardId, setActiveBoardId] = useState<string>('');
    const [notes, setNotes] = useState<StickyNote[]>([]);
    const [globalFont, setGlobalFont] = useState('modern');
    const [background, setBackground] = useState(BACKGROUNDS[0]);
    const [isLoading, setIsLoading] = useState(true);

    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [draggedNote, setDraggedNote] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const [resizingNote, setResizingNote] = useState<{ id: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showDictionary, setShowDictionary] = useState(false);
    const [showAIDraft, setShowAIDraft] = useState(false);
    const [showBoardSidebar, setShowBoardSidebar] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: string } | null>(null);

    const [noteConfig, setNoteConfig] = useState({
        type: 'text' as 'text' | 'list' | 'image' | 'audio' | 'link',
        paperStyle: 'smooth' as const,
        attachmentStyle: 'tape-orange' as const,
        color: COLORS[0].value,
    });

    const activeBoard = boards.find(b => b.id === activeBoardId);

    useEffect(() => {
        loadData();
        loadGlobalFont();
    }, [refreshTrigger]);

    useEffect(() => {
        if (boards.length > 0 && activeBoardId) {
            const timeout = setTimeout(saveData, 1000);
            return () => clearTimeout(timeout);
        }
    }, [boards, activeBoardId, notes]);

    // Update all notes' font when global font changes
    useEffect(() => {
        if (notes.length > 0) {
            setNotes(prev => prev.map(note => ({ ...note, font: globalFont as any })));
        }
    }, [globalFont]);

    const loadGlobalFont = async () => {
        try {
            // @ts-ignore
            const font = await window.ipcRenderer.invoke('get-global-setting', 'font');
            if (font) setGlobalFont(font);
        } catch (e) {
            console.error('Failed to load global font:', e);
        }
    };

    const loadData = async () => {
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-boards');
            if (data && data.boards && data.boards.length > 0) {
                setBoards(data.boards);
                const targetId = data.activeBoardId || data.boards[0].id;
                setActiveBoardId(targetId);
                const current = data.boards.find((b: Board) => b.id === targetId);
                setNotes(current?.notes || []);

                // Restore global settings
                if (data.globalFont) setGlobalFont(data.globalFont);
                if (data.background) {
                    const bg = BACKGROUNDS.find(b => b.name === data.background);
                    if (bg) setBackground(bg);
                }
            } else {
                // Create default board
                const defaultBoard: Board = {
                    id: generateId(),
                    name: 'My Board',
                    color: BOARD_COLORS[0],
                    notes: []
                };
                setBoards([defaultBoard]);
                setActiveBoardId(defaultBoard.id);
                setNotes([]);
            }
        } catch (e) {
            console.error('Failed to load boards:', e);
            // Fallback: create default board even on error
            const defaultBoard: Board = {
                id: generateId(),
                name: 'My Board',
                color: BOARD_COLORS[0],
                notes: []
            };
            setBoards([defaultBoard]);
            setActiveBoardId(defaultBoard.id);
            setNotes([]);
        } finally {
            setIsLoading(false);
        }
    };

    const saveData = async () => {
        try {
            const updatedBoards = boards.map(b =>
                b.id === activeBoardId ? { ...b, notes } : b
            );
            // @ts-ignore
            await window.ipcRenderer.invoke('save-boards', {
                boards: updatedBoards,
                activeBoardId,
                globalFont,
                background: background.name
            });
        } catch (e) {
            console.error('Failed to save boards:', e);
        }
    };

    // Save global settings when they change
    useEffect(() => {
        if (boards.length > 0) {
            saveData();
        }
    }, [globalFont, background]);

    const handleWheel = useCallback((e: WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            // Get mouse position relative to canvas
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate position in canvas coordinates (before zoom)
            const canvasX = (mouseX - panOffset.x) / zoom;
            const canvasY = (mouseY - panOffset.y) / zoom;

            // Calculate new zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.1, Math.min(3, zoom * delta));

            // Calculate new pan offset to keep mouse position fixed
            const newPanX = mouseX - canvasX * newZoom;
            const newPanY = mouseY - canvasY * newZoom;

            setZoom(newZoom);
            setPanOffset({ x: newPanX, y: newPanY });
        } else {
            setPanOffset(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    }, [zoom, panOffset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            return () => canvas.removeEventListener('wheel', handleWheel);
        }
    }, [handleWheel]);

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        setContextMenu(null);
        if (e.button === 1 || (e.button === 0 && e.target === canvasRef.current)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
            setSelectedNoteId(null);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPanOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        } else if (draggedNote) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = (e.clientX - rect.left - panOffset.x - draggedNote.offsetX) / zoom;
                const y = (e.clientY - rect.top - panOffset.y - draggedNote.offsetY) / zoom;
                setNotes(prev => prev.map(n =>
                    n.id === draggedNote.id ? { ...n, x, y } : n
                ));
            }
        } else if (resizingNote) {
            const dx = (e.clientX - resizingNote.startX) / zoom;
            const dy = (e.clientY - resizingNote.startY) / zoom;
            setNotes(prev => prev.map(n =>
                n.id === resizingNote.id
                    ? {
                        ...n,
                        width: Math.max(150, resizingNote.startWidth + dx),
                        height: Math.max(100, resizingNote.startHeight + dy)
                    }
                    : n
            ));
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
        setDraggedNote(null);
        setResizingNote(null);
    };

    const addNote = () => {
        const newNote: StickyNote = {
            id: generateId(),
            type: noteConfig.type,
            x: -panOffset.x / zoom + 100,
            y: -panOffset.y / zoom + 100,
            width: 250,
            height: 200,
            content: '',
            color: noteConfig.color,
            paperStyle: noteConfig.paperStyle,
            attachmentStyle: noteConfig.attachmentStyle,
            font: globalFont as any,
            fontSize: 16,
            listItems: noteConfig.type === 'list' ? [{ id: generateId(), text: '', checked: false }] : undefined
        };
        setNotes(prev => [...prev, newNote]);
        setShowAddNoteModal(false);
        setSelectedNoteId(newNote.id);

        // Auto-trigger file picker for image notes
        if (noteConfig.type === 'image') {
            setTimeout(() => {
                const fileInput = document.querySelector(`input[type="file"][data-note-id="${newNote.id}"]`) as HTMLInputElement;
                if (fileInput) {
                    fileInput.click();
                }
            }, 100);
        }
    };

    const addCalculator = () => {
        const calcNote: StickyNote = {
            id: generateId(),
            type: 'calculator',
            x: -panOffset.x / zoom + 100,
            y: -panOffset.y / zoom + 100,
            width: 300,
            height: 400,
            content: '',
            color: '#FFFFFF',
            paperStyle: 'smooth',
            attachmentStyle: 'none',
            font: 'modern',
            fontSize: 16
        };
        setNotes(prev => [...prev, calcNote]);
    };

    const addNewBoard = () => {
        const newBoard: Board = {
            id: generateId(),
            name: `Board ${boards.length + 1}`,
            color: BOARD_COLORS[boards.length % BOARD_COLORS.length],
            notes: []
        };
        setBoards(prev => [...prev, newBoard]);
        setActiveBoardId(newBoard.id);
        setNotes([]);
    };

    const deleteBoard = (id: string) => {
        if (boards.length === 1) return;
        const newBoards = boards.filter(b => b.id !== id);
        setBoards(newBoards);
        if (activeBoardId === id) {
            setActiveBoardId(newBoards[0].id);
            setNotes(newBoards[0].notes);
        }
    };

    const deleteNote = (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        if (selectedNoteId === id) setSelectedNoteId(null);
    };

    const handleNoteMouseDown = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        const note = notes.find(n => n.id === noteId);
        if (note) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const offsetX = (e.clientX - rect.left - panOffset.x) / zoom - note.x;
                const offsetY = (e.clientY - rect.top - panOffset.y) / zoom - note.y;
                setDraggedNote({ id: noteId, offsetX, offsetY });
                setSelectedNoteId(noteId);
            }
        }
    };

    const handleResizeStart = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        const note = notes.find(n => n.id === noteId);
        if (note) {
            setResizingNote({
                id: noteId,
                startX: e.clientX,
                startY: e.clientY,
                startWidth: note.width,
                startHeight: note.height
            });
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && selectedNoteId) {
                deleteNote(selectedNoteId);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearchModal(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNoteId]);

    const getBackgroundStyle = () => {
        if (background.pattern === 'grid') {
            return {
                backgroundImage: 'linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px)',
                backgroundSize: '30px 30px'
            };
        } else if (background.pattern === 'dots') {
            return {
                backgroundImage: 'radial-gradient(circle, #999 2px, transparent 2px)',
                backgroundSize: '25px 25px'
            };
        } else if (background.pattern === 'cork') {
            return {
                backgroundColor: '#C19A6B',
                backgroundImage: `
                    radial-gradient(circle at 20% 30%, rgba(139, 90, 43, 0.3) 0%, transparent 50%),
                    radial-gradient(circle at 80% 70%, rgba(160, 82, 45, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 40% 80%, rgba(101, 67, 33, 0.2) 0%, transparent 50%),
                    radial-gradient(circle at 90% 20%, rgba(139, 90, 43, 0.3) 0%, transparent 50%),
                    url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.35'/%3E%3C/svg%3E")
                `,
                backgroundBlendMode: 'multiply, multiply, multiply, multiply, overlay'
            };
        } else if (background.pattern === 'linen') {
            return {
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,.03) 2px, rgba(0,0,0,.03) 4px)',
            };
        }
        return {};
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#F5F1E8] dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading boards...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 relative z-10">
                <input
                    value={activeBoard?.name || ''}
                    onChange={(e) => setBoards(prev => prev.map(b =>
                        b.id === activeBoardId ? { ...b, name: e.target.value } : b
                    ))}
                    className="text-2xl font-bold bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-100"
                />

                <motion.button
                    onClick={() => setShowBoardSidebar(true)}
                    className="bg-purple-500 text-white p-3 rounded-full shadow-lg hover:bg-purple-600"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <Folder className="w-6 h-6" />
                </motion.button>
            </div>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className={clsx("flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing", background.value)}
                style={getBackgroundStyle()}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
            >
                <div
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                        width: '100%',
                        height: '100%',
                        position: 'relative'
                    }}
                >
                    {notes.map(note => (
                        note.type === 'calculator' ? (
                            <CalculatorNote
                                key={note.id}
                                note={note}
                                isSelected={selectedNoteId === note.id}
                                onMouseDown={(e) => handleNoteMouseDown(e, note.id)}
                                onResizeStart={(e) => handleResizeStart(e, note.id)}
                                onDelete={() => deleteNote(note.id)}
                            />
                        ) : (
                            <StickyNoteComponent
                                key={note.id}
                                note={note}
                                isSelected={selectedNoteId === note.id}
                                onMouseDown={(e) => handleNoteMouseDown(e, note.id)}
                                onResizeStart={(e) => handleResizeStart(e, note.id)}
                                onDelete={() => deleteNote(note.id)}
                                onChange={(updates) => setNotes(prev => prev.map(n =>
                                    n.id === note.id ? { ...n, ...updates } : n
                                ))}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setContextMenu({ x: e.clientX, y: e.clientY, noteId: note.id });
                                }}
                            />

                        )
                    ))}
                </div>
            </div>

            {/* Bottom Toolbar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-10">
                {/* Font Selector */}
                <select
                    value={globalFont}
                    onChange={(e) => setGlobalFont(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 border-none focus:outline-none cursor-pointer"
                >
                    {FONTS.map(font => (
                        <option key={font.value} value={font.value}>{font.name}</option>
                    ))}
                </select>

                {/* Background Selector */}
                <select
                    value={BACKGROUNDS.findIndex(b => b.name === background.name)}
                    onChange={(e) => setBackground(BACKGROUNDS[parseInt(e.target.value)])}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 border-none focus:outline-none cursor-pointer"
                >
                    {BACKGROUNDS.map((bg, idx) => (
                        <option key={idx} value={idx}>{bg.name}</option>
                    ))}
                </select>

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

                <ToolbarButton icon={Plus} onClick={() => setShowAddNoteModal(true)} title="Add Note" />
                <ToolbarButton icon={Search} onClick={() => setShowSearchModal(true)} title="Search (Cmd+K)" />
                <ToolbarButton icon={Calculator} onClick={addCalculator} title="Calculator" />
                <ToolbarButton icon={BookOpen} onClick={() => setShowDictionary(true)} title="Dictionary" />
                <ToolbarButton icon={Sparkles} onClick={() => setShowAIDraft(true)} title="AI Draft" />
            </div>

            {/* Board Sidebar */}
            <AnimatePresence>
                {showBoardSidebar && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/30 z-40"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowBoardSidebar(false)}
                        />
                        <motion.div
                            className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Boards</h2>
                                    <button onClick={() => setShowBoardSidebar(false)} className="text-gray-500 hover:text-gray-700">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <button
                                    onClick={addNewBoard}
                                    className="w-full py-3 mb-4 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
                                >
                                    + New Board
                                </button>

                                <div className="space-y-3">
                                    {boards.map(board => (
                                        <BoardCard
                                            key={board.id}
                                            board={board}
                                            isActive={board.id === activeBoardId}
                                            onClick={() => {
                                                setActiveBoardId(board.id);
                                                setNotes(board.notes);
                                                setShowBoardSidebar(false);
                                            }}
                                            onColorChange={(color) => setBoards(prev => prev.map(b =>
                                                b.id === board.id ? { ...b, color } : b
                                            ))}
                                            onNameChange={(name) => setBoards(prev => prev.map(b =>
                                                b.id === board.id ? { ...b, name } : b
                                            ))}
                                            onDelete={() => deleteBoard(board.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Modals */}
            {showAddNoteModal && (
                <AddNoteModal
                    onClose={() => setShowAddNoteModal(false)}
                    config={noteConfig}
                    setConfig={setNoteConfig}
                    onAdd={addNote}
                />
            )}

            {showSearchModal && (
                <SearchModal
                    onClose={() => setShowSearchModal(false)}
                    notes={notes}
                    onSelectNote={(id) => {
                        setSelectedNoteId(id);
                        setShowSearchModal(false);
                    }}
                />
            )}

            {contextMenu && (
                <div
                    className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 w-56"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Color</p>
                        <div className="grid grid-cols-4 gap-2">
                            {COLORS.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => {
                                        setNotes(prev => prev.map(n => n.id === contextMenu.noteId ? { ...n, color: c.value } : n));
                                    }}
                                    className="w-full aspect-square rounded-full hover:scale-110 transition-transform border border-black/5"
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Paper Style</p>
                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
                            {['smooth', 'lined', 'grid'].map(style => (
                                <button
                                    key={style}
                                    onClick={() => {
                                        setNotes(prev => prev.map(n => n.id === contextMenu.noteId ? { ...n, paperStyle: style as any } : n));
                                    }}
                                    className="flex-1 text-xs py-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 shadow-sm transition-all capitalize"
                                >
                                    {style}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Attachment</p>
                        <select
                            className="w-full text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-[var(--accent-primary)]"
                            onChange={(e) => {
                                setNotes(prev => prev.map(n => n.id === contextMenu.noteId ? { ...n, attachmentStyle: e.target.value as any } : n));
                            }}
                            defaultValue={notes.find(n => n.id === contextMenu.noteId)?.attachmentStyle || 'none'}
                        >
                            <option value="none">None</option>
                            <option value="tape-orange">Orange Tape</option>
                            <option value="tape-blue">Blue Tape</option>
                            <option value="tape-green">Green Tape</option>
                            <option value="tape-purple">Purple Tape</option>
                            <option value="pin-red">Red Pin</option>
                            <option value="pin-blue">Blue Pin</option>
                            <option value="pin-green">Green Pin</option>
                        </select>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-2" />

                    <button
                        onClick={() => {
                            deleteNote(contextMenu.noteId);
                            setContextMenu(null);
                        }}
                        className="w-full px-2 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium flex items-center gap-2"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Note
                    </button>
                </div>
            )}

            {showDictionary && <DictionaryModal onClose={() => setShowDictionary(false)} />}
            {showAIDraft && <AIDraftModal onClose={() => setShowAIDraft(false)} />}
        </div>
    );
}

function ToolbarButton({ icon: Icon, onClick, title }: any) {
    return (
        <motion.button
            onClick={onClick}
            className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={title}
        >
            <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </motion.button>
    );
}

function BoardCard({ board, isActive, onClick, onColorChange, onNameChange, onDelete }: any) {
    const [isHovered, setIsHovered] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div
            className={clsx(
                "relative w-full h-48 cursor-pointer group transition-all mb-6",
                isActive && "scale-105"
            )}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Back Layer (Folder Body + Tab) */}
            <div
                className="absolute inset-0 top-3 rounded-2xl transition-colors shadow-sm"
                style={{ backgroundColor: board.color }}
            >
                {/* Folder Tab */}
                <div
                    className="absolute -top-3 left-0 w-1/3 h-5 rounded-t-xl"
                    style={{ backgroundColor: board.color }}
                />

                {/* Menu Button (Top Right of Back Layer) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                    className="absolute top-2 right-2 p-1.5 hover:bg-black/10 rounded-full transition-colors z-30 opacity-60 hover:opacity-100"
                >
                    <MoreVertical className="w-4 h-4 text-gray-700" />
                </button>
            </div>

            {/* Middle Layer (Paper Preview) */}
            <motion.div
                className="absolute inset-x-3 bg-white rounded-lg shadow-sm p-4 overflow-hidden z-10"
                initial={{ top: '1.5rem', bottom: '1rem', scale: 0.95 }}
                animate={{
                    top: isHovered ? '0.5rem' : '1.5rem',
                    bottom: '1rem',
                    scale: 1
                }}
                transition={{ duration: 0.3 }}
            >
                {board.notes.length > 0 ? (
                    <>
                        <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                            {board.notes.length} note{board.notes.length !== 1 ? 's' : ''} inside
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-4 font-medium">
                            {board.notes[0].content || (board.notes[0].imageUrl ? '[Image Note]' : 'Empty note')}
                        </p>
                    </>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                        No notes yet
                    </div>
                )}
            </motion.div>

            {/* Front Layer (Cover Pocket) */}
            <motion.div
                className="absolute inset-x-0 bottom-0 z-20 rounded-2xl shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)] flex flex-col justify-end p-5"
                style={{ backgroundColor: board.color }}
                initial={{ height: '75%' }}
                animate={{ height: isHovered ? '45%' : '75%' }}
                transition={{ duration: 0.3 }}
            >
                <div className="w-full">
                    <input
                        value={board.name}
                        onChange={(e) => {
                            e.stopPropagation();
                            onNameChange(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-xl bg-transparent border-none focus:outline-none text-gray-900 w-full mb-1 placeholder-gray-500/50"
                        placeholder="Board Name"
                    />
                    <motion.p
                        className="text-sm text-gray-700 font-medium opacity-80"
                        animate={{ opacity: isHovered ? 0 : 0.8 }}
                    >
                        {board.notes.length} notes
                    </motion.p>
                </div>
            </motion.div>

            {/* Active Indicator Ring */}
            {isActive && (
                <div className="absolute -inset-1 rounded-3xl border-2 border-[var(--accent-primary)] pointer-events-none z-30" />
            )}

            {/* Context Menu */}
            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        className="absolute top-10 right-[-10px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-3 z-40 border border-gray-200 dark:border-gray-700 w-48"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    >
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">Folder Color</p>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {BOARD_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => {
                                        onColorChange(color);
                                        setShowMenu(false);
                                    }}
                                    className={clsx(
                                        "w-6 h-6 rounded-full transition-transform hover:scale-110 border border-black/5",
                                        board.color === color && "ring-2 ring-offset-1 ring-gray-400"
                                    )}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-2" />
                        <button
                            onClick={() => {
                                onDelete();
                                setShowMenu(false);
                            }}
                            className="w-full px-2 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium flex items-center gap-2"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Board
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function BoardCardOld({ board, isActive, onClick, onColorChange, onNameChange, onDelete }: any) {
    const [isHovered, setIsHovered] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    return (
        <motion.div
            className={clsx(
                "relative cursor-pointer transition-all mb-4",
                isActive && "scale-105"
            )}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ y: -4 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Folder Shape */}
            <div
                className="relative rounded-3xl p-6 shadow-xl"
                style={{
                    backgroundColor: board.color,
                    boxShadow: isActive
                        ? `0 10px 30px -5px ${board.color}80, 0 0 0 3px #A78BFA`
                        : `0 8px 20px -5px ${board.color}60`
                }}
            >
                {/* Menu Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                    className="absolute top-4 right-4 p-1.5 hover:bg-black/10 rounded-full transition-colors"
                >
                    <MoreVertical className="w-4 h-4 text-gray-700" />
                </button>

                {/* Board Name */}
                <input
                    value={board.name}
                    onChange={(e) => {
                        e.stopPropagation();
                        onNameChange(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-bold text-xl bg-transparent border-none focus:outline-none text-gray-900 w-full mb-1 pr-8"
                />

                {/* Note Count */}
                <p className="text-sm text-gray-700 font-medium">{board.notes.length} notes</p>

                {/* Preview on Hover */}
                <AnimatePresence>
                    {isHovered && board.notes.length > 0 && (
                        <motion.div
                            className="mt-4 p-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg"
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <p className="text-xs text-gray-700 font-medium mb-1">Preview:</p>
                            <p className="text-sm text-gray-600 line-clamp-3">
                                {board.notes[0]?.content || 'Empty note'}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Color & Delete Menu */}
            {showMenu && (
                <motion.div
                    className="absolute top-14 right-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-3 z-20 border border-gray-200 dark:border-gray-700"
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Change Color</p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {BOARD_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => {
                                    onColorChange(color);
                                    setShowMenu(false);
                                }}
                                className={clsx(
                                    "w-8 h-8 rounded-lg transition-transform hover:scale-110",
                                    board.color === color && "ring-2 ring-purple-500 ring-offset-2"
                                )}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            onDelete();
                            setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                    >
                        Delete Board
                    </button>
                </motion.div>
            )}
        </motion.div>
    );
}

function StickyNoteComponent({ note, isSelected, onMouseDown, onResizeStart, onDelete, onChange, onContextMenu }: any) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getAttachmentStyle = () => {
        if (!note.attachmentStyle || note.attachmentStyle === 'none') {
            return null;
        }

        if (note.attachmentStyle.startsWith('tape-')) {
            const color = note.attachmentStyle.split('-')[1];
            const colors: any = {
                orange: '#FF8C42',
                blue: '#4A90E2',
                green: '#7ED321',
                purple: '#A78BFA'
            };
            return (
                <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-8 rounded-sm opacity-80 shadow-md"
                    style={{
                        backgroundColor: colors[color],
                        background: `linear-gradient(135deg, ${colors[color]} 0%, ${colors[color]}dd 100%)`,
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)'
                    }}
                />
            );
        } else if (note.attachmentStyle.startsWith('pin-')) {
            const color = note.attachmentStyle.split('-')[1];
            const colors: any = {
                red: '#EF4444',
                blue: '#3B82F6',
                green: '#10B981'
            };
            return (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <div
                        className="w-4 h-4 rounded-full shadow-lg"
                        style={{
                            backgroundColor: colors[color],
                            boxShadow: `0 2px 4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.5)`
                        }}
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-white/50 absolute top-1 left-1" />
                    </div>
                </div>
            );
        }
        return null;
    };

    const getFontFamily = () => {
        switch (note.font) {
            case 'modern': return 'Inter, sans-serif';
            case 'serif': return 'Georgia, serif';
            case 'handwritten': return 'Comic Sans MS, cursive';
            case 'script': return 'Brush Script MT, cursive';
            default: return 'Inter, sans-serif';
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                onChange({ imageUrl: event.target?.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div
            style={{
                position: 'absolute',
                left: note.x,
                top: note.y,
                width: note.width,
                height: note.height,
            }}
            className={clsx(
                "rounded-lg shadow-lg transition-shadow duration-150 cursor-move group",
                isSelected && "ring-4 ring-purple-400 shadow-2xl"
            )}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
        >
            {/* Attachment (tape/pin) - needs to be above the note content */}
            <div className="absolute top-0 left-0 w-full pointer-events-none" style={{ zIndex: 10 }}>
                {getAttachmentStyle()}
            </div>

            <div
                className="w-full h-full p-4 rounded-lg overflow-auto custom-scrollbar relative"
                style={{
                    backgroundColor: note.color,
                    backgroundImage: note.paperStyle === 'lined'
                        ? `
                            linear-gradient(to right, transparent 0, transparent 29px, rgba(231, 76, 60, 0.4) 29px, rgba(231, 76, 60, 0.4) 31px, transparent 31px),
                            repeating-linear-gradient(
                                to bottom,
                                transparent 0,
                                transparent 23px,
                                #d1d5db 23px,
                                #d1d5db 24px
                            )
                        `
                        : note.paperStyle === 'grid'
                            ? 'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)'
                            : 'none',
                    backgroundSize: note.paperStyle === 'grid' ? '20px 20px' : 'auto',
                    backgroundPosition: note.paperStyle === 'lined' ? '0 8px' : '0 0',
                    paddingLeft: note.paperStyle === 'lined' ? '45px' : '16px',
                    paddingTop: note.paperStyle === 'lined' ? '32px' : '16px'
                }}
            >
                {note.type === 'list' ? (
                    <div className="space-y-2">
                        {note.listItems?.map((item: any, idx: number) => (
                            <div key={item.id} className="flex items-center gap-2 group/item">
                                <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        const newItems = [...(note.listItems || [])];
                                        newItems[idx].checked = e.target.checked;
                                        onChange({ listItems: newItems });
                                    }}
                                    className="w-4 h-4 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={item.text}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        const newItems = [...(note.listItems || [])];
                                        newItems[idx].text = e.target.value;
                                        onChange({ listItems: newItems });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const newItems = [...(note.listItems || [])];
                                            newItems.splice(idx + 1, 0, { id: generateId(), text: '', checked: false });
                                            onChange({ listItems: newItems });
                                        }
                                    }}
                                    className={clsx(
                                        "flex-1 bg-transparent border-none focus:outline-none",
                                        item.checked && "line-through opacity-50"
                                    )}
                                    style={{ fontFamily: getFontFamily(), fontSize: `${note.fontSize}px` }}
                                    placeholder="List item..."
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newItems = note.listItems?.filter((_: any, i: number) => i !== idx);
                                        onChange({ listItems: newItems });
                                    }}
                                    className="text-red-500 hover:text-red-700 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange({
                                    listItems: [...(note.listItems || []), { id: generateId(), text: '', checked: false }]
                                });
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700 mt-2"
                        >
                            + Add item
                        </button>
                    </div>
                ) : note.type === 'image' ? (
                    <div className="h-full flex flex-col">
                        {note.imageUrl ? (
                            <img
                                src={note.imageUrl}
                                alt="Note"
                                className="w-full h-full object-contain rounded pointer-events-none"
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    Upload Image
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    data-note-id={note.id}
                                />
                            </div>
                        )}
                    </div>
                ) : note.type === 'link' ? (
                    <div className="space-y-2">
                        <input
                            type="url"
                            value={note.linkUrl || ''}
                            onChange={(e) => onChange({ linkUrl: e.target.value })}
                            placeholder="https://..."
                            className="w-full px-3 py-2 bg-white/50 rounded border border-gray-300 focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {note.linkUrl && (
                            <a
                                href={note.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <LinkIcon className="w-3 h-3" />
                                Open Link
                            </a>
                        )}
                        <textarea
                            value={note.content}
                            onChange={(e) => onChange({ content: e.target.value })}
                            className="w-full h-32 bg-transparent border-none focus:outline-none resize-none"
                            style={{ fontFamily: getFontFamily(), fontSize: `${note.fontSize}px` }}
                            placeholder="Add notes about this link..."
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : note.type === 'audio' ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <Mic className="w-12 h-12 text-gray-400" />
                        <p className="text-sm text-gray-500">Audio recording coming soon</p>
                    </div>
                ) : (
                    <textarea
                        value={note.content}
                        onChange={(e) => onChange({ content: e.target.value })}
                        className="w-full h-full bg-transparent border-none focus:outline-none resize-none"
                        style={{
                            fontFamily: getFontFamily(),
                            fontSize: `${note.fontSize}px`,
                            lineHeight: note.paperStyle === 'lined' ? '24px' : '1.5'
                        }}
                        placeholder="Type here..."
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>

            {isSelected && (
                <>
                    <motion.button
                        onClick={onDelete}
                        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                    >
                        <X className="w-4 h-4" />
                    </motion.button>

                    <motion.div
                        onMouseDown={onResizeStart}
                        className="absolute -bottom-3 -right-3 bg-purple-500 text-white rounded-full p-2 shadow-lg cursor-nwse-resize hover:bg-purple-600"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                    >
                        <div className="w-4 h-4 flex items-center justify-center">⤡</div>
                    </motion.div>
                </>
            )}
        </div>
    );
}

function CalculatorNote({ note, isSelected, onMouseDown, onResizeStart, onDelete }: any) {
    const [equation, setEquation] = useState('');
    const [display, setDisplay] = useState('0');

    const handleInput = (value: string) => {
        if (value === 'C') {
            setEquation('');
            setDisplay('0');
        } else if (value === '=') {
            try {
                const result = eval(equation);
                setDisplay(String(result));
                setEquation(String(result));
            } catch {
                setDisplay('Error');
            }
        } else if (['+', '-', '*', '/', '(', ')'].includes(value)) {
            setEquation(prev => prev + value);
            setDisplay(equation + value);
        } else {
            setEquation(prev => prev + value);
            setDisplay(equation + value);
        }
    };

    return (
        <motion.div
            style={{
                position: 'absolute',
                left: note.x,
                top: note.y,
                width: note.width,
                height: note.height,
            }}
            className={clsx(
                "rounded-lg shadow-2xl bg-white dark:bg-gray-800 cursor-move",
                isSelected && "ring-4 ring-purple-400"
            )}
            onMouseDown={onMouseDown}
            initial={{ scale: 0, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            <div className="p-4 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 h-6 overflow-hidden">{equation || ' '}</div>
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 text-right">{display}</div>
                </div>

                <div className="grid grid-cols-4 gap-2 flex-1">
                    {['C', '(', ')', '/'].map(btn => (
                        <button key={btn} onClick={() => handleInput(btn)} className="py-3 bg-gray-200 dark:bg-gray-600 rounded-lg font-medium hover:bg-gray-300 transition-colors">{btn}</button>
                    ))}
                    {['7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+'].map(btn => (
                        <button key={btn} onClick={() => handleInput(btn)} className={clsx("py-3 rounded-lg font-medium transition-colors", /\d/.test(btn) ? "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200" : "bg-purple-500 text-white hover:bg-purple-600")}>{btn}</button>
                    ))}
                    <button onClick={() => handleInput('0')} className="col-span-2 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">0</button>
                    <button onClick={() => handleInput('.')} className="py-3 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">.</button>
                    <button onClick={() => handleInput('=')} className="py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors">=</button>
                </div>
            </div>

            {isSelected && (
                <>
                    <motion.button onClick={onDelete} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <X className="w-4 h-4" />
                    </motion.button>
                    <motion.div onMouseDown={onResizeStart} className="absolute -bottom-3 -right-3 bg-purple-500 text-white rounded-full p-2 shadow-lg cursor-nwse-resize hover:bg-purple-600" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <div className="w-4 h-4">⤡</div>
                    </motion.div>
                </>
            )}
        </motion.div>
    );
}

function AddNoteModal({ onClose, config, setConfig, onAdd }: any) {
    return (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
            <motion.div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 shadow-2xl" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Add Note</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Paper Style</label>
                    <select value={config.paperStyle} onChange={(e) => setConfig({ ...config, paperStyle: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        <option value="smooth">Smooth</option>
                        <option value="lined">Lined</option>
                        <option value="grid">Grid</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attachment</label>
                    <select value={config.attachmentStyle} onChange={(e) => setConfig({ ...config, attachmentStyle: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        <option value="tape-orange">Orange Tape</option>
                        <option value="tape-blue">Blue Tape</option>
                        <option value="tape-green">Green Tape</option>
                        <option value="tape-purple">Purple Tape</option>
                        <option value="pin-red">Red Pin</option>
                        <option value="pin-blue">Blue Pin</option>
                        <option value="pin-green">Green Pin</option>
                        <option value="none">None</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
                    <div className="grid grid-cols-4 gap-2">
                        {COLORS.map(color => (
                            <button key={color.value} onClick={() => setConfig({ ...config, color: color.value })} className={clsx("w-full h-12 rounded-lg transition-all", config.color === color.value && "ring-4 ring-purple-400")} style={{ backgroundColor: color.value }} />
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setConfig({ ...config, type: 'text' })} className={clsx("flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium", config.type === 'text' ? "bg-[var(--accent-primary)] text-white" : "bg-gray-100 dark:bg-gray-700")}>
                            <MessageSquare className="w-4 h-4" />
                            Text
                        </button>
                        <button onClick={() => setConfig({ ...config, type: 'list' })} className={clsx("flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium", config.type === 'list' ? "bg-[var(--accent-primary)] text-white" : "bg-gray-100 dark:bg-gray-700")}>
                            <List className="w-4 h-4" />
                            List
                        </button>
                        <button onClick={() => setConfig({ ...config, type: 'image' })} className={clsx("flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium", config.type === 'image' ? "bg-[var(--accent-primary)] text-white" : "bg-gray-100 dark:bg-gray-700")}>
                            <ImageIcon className="w-4 h-4" />
                            Image
                        </button>
                        <button onClick={() => setConfig({ ...config, type: 'link' })} className={clsx("flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium", config.type === 'link' ? "bg-[var(--accent-primary)] text-white" : "bg-gray-100 dark:bg-gray-700")}>
                            <LinkIcon className="w-4 h-4" />
                            Link
                        </button>
                    </div>
                </div>

                <button onClick={onAdd} className="w-full py-3 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90">Create Note</button>
            </motion.div>
        </motion.div>
    );
}

function SearchModal({ onClose, notes, onSelectNote }: any) {
    const [query, setQuery] = useState('');
    const filtered = notes.filter((n: StickyNote) => n.content.toLowerCase().includes(query.toLowerCase()));

    return (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
            <motion.div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl" initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Search className="w-5 h-5 text-gray-400" />
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes..." className="flex-1 bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-200" autoFocus />
                        <button onClick={onClose}><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="max-h-96 overflow-y-auto p-4">
                    {filtered.length === 0 ? <div className="text-center py-8 text-gray-500">No notes found</div> : (
                        <div className="space-y-2">
                            {filtered.map((note: StickyNote) => (
                                <button key={note.id} onClick={() => onSelectNote(note.id)} className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                                    <span className="px-2 py-1 bg-[var(--accent-light)] text-[var(--accent-secondary)] text-xs rounded">{note.type}</span>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{note.content}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function DictionaryModal({ onClose }: any) {
    const [word, setWord] = useState('');
    return (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
            <motion.div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 shadow-2xl" initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Dictionary</h2>
                    <button onClick={onClose}><X className="w-5 h-5" /></button>
                </div>
                <input type="text" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Enter a word..." className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
            </motion.div>
        </motion.div>
    );
}

function AIDraftModal({ onClose }: any) {
    const [prompt, setPrompt] = useState('');
    return (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
            <motion.div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 shadow-2xl" initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">AI Draft</h2>
                    <button onClick={onClose}><X className="w-5 h-5" /></button>
                </div>
                <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What do you want to create?" className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 mb-4" />
                <button className="w-full py-3 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90">Generate</button>
            </motion.div>
        </motion.div>
    );
}
