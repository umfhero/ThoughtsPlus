import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, MoreVertical, List, Image as ImageIcon } from 'lucide-react';
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
    lastAccessed?: number;
    font?: string;
    background?: { name: string; value: string; pattern?: string };
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

const BACKGROUNDS = [
    { name: 'Default', value: 'bg-[#F5F1E8] dark:bg-gray-900' },
    { name: 'Grid', value: 'bg-[#F5F1E8] dark:bg-gray-900', pattern: 'grid' },
    { name: 'Dots', value: 'bg-[#F0EDE5] dark:bg-gray-900', pattern: 'dots' },
    { name: 'Cork', value: 'bg-[#D4A574] dark:bg-gray-800', pattern: 'cork' },
    { name: 'Linen', value: 'bg-[#FAF9F6] dark:bg-gray-900', pattern: 'linen' },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

interface BoardEditorProps {
    /** The content ID that references the board in storage */
    contentId: string;
    /** Callback when board is updated */
    onBoardChange?: (board: Board) => void;
}

/**
 * BoardEditor component - A whiteboard/sticky note editor for the workspace.
 * Accepts a contentId prop to load/save board content via workspace content reference.
 * 
 * Requirements: 8.2
 */
export function BoardEditor({ contentId, onBoardChange }: BoardEditorProps) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [board, setBoard] = useState<Board | null>(null);
    const [notes, setNotes] = useState<StickyNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [draggedNote, setDraggedNote] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const [resizingNote, setResizingNote] = useState<{ id: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: string } | null>(null);

    const [noteConfig, setNoteConfig] = useState({
        type: 'text' as 'text' | 'list' | 'image' | 'audio' | 'link',
        paperStyle: 'smooth' as const,
        attachmentStyle: 'tape-orange' as const,
        color: COLORS[0].value,
    });

    const currentFont = board?.font || 'modern';
    const currentBackground = board?.background || BACKGROUNDS[0];

    // Load board data based on contentId
    useEffect(() => {
        const loadBoard = async () => {
            setIsLoading(true);
            try {
                // @ts-ignore
                const response = await window.ipcRenderer.invoke('get-boards');
                let loadedBoards: Board[] = [];

                if (response) {
                    if (Array.isArray(response)) {
                        loadedBoards = response;
                    } else if (response.boards && Array.isArray(response.boards)) {
                        loadedBoards = response.boards;
                    }
                }

                const found = loadedBoards.find(b => b.id === contentId);
                if (found) {
                    setBoard(found);
                    setNotes(found.notes || []);
                }
            } catch (error) {
                console.error('Failed to load board:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadBoard();
    }, [contentId]);

    // Save board to backend
    const saveBoard = useCallback(async (updatedNotes: StickyNote[]) => {
        if (!board) return;

        try {
            // @ts-ignore
            const response = await window.ipcRenderer.invoke('get-boards');
            let loadedBoards: Board[] = [];

            if (response) {
                if (Array.isArray(response)) {
                    loadedBoards = response;
                } else if (response.boards && Array.isArray(response.boards)) {
                    loadedBoards = response.boards;
                }
            }

            const updatedBoard = { ...board, notes: updatedNotes, lastAccessed: Date.now() };
            const updatedBoards = loadedBoards.map(b =>
                b.id === board.id ? updatedBoard : b
            );

            // @ts-ignore
            await window.ipcRenderer.invoke('save-boards', {
                boards: updatedBoards,
                activeBoardId: board.id
            });

            setBoard(updatedBoard);
            onBoardChange?.(updatedBoard);
        } catch (error) {
            console.error('Failed to save board:', error);
        }
    }, [board, onBoardChange]);

    // Debounced save
    useEffect(() => {
        if (!board || notes.length === 0) return;
        const timeout = setTimeout(() => {
            saveBoard(notes);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [notes, board, saveBoard]);


    // Auto-center notes on load
    useEffect(() => {
        if (isLoading || !canvasRef.current || notes.length === 0) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;

        if (canvasWidth === 0 || canvasHeight === 0) return;

        const minX = Math.min(...notes.map(n => n.x));
        const maxX = Math.max(...notes.map(n => n.x + n.width));
        const minY = Math.min(...notes.map(n => n.y));
        const maxY = Math.max(...notes.map(n => n.y + n.height));

        const notesWidth = maxX - minX;
        const notesHeight = maxY - minY;

        const zoomX = (canvasWidth * 0.9) / notesWidth;
        const zoomY = (canvasHeight * 0.9) / notesHeight;
        const optimalZoom = Math.min(zoomX, zoomY, 1.2);
        const finalZoom = Math.max(optimalZoom, 0.6);

        setZoom(finalZoom);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const canvasCenterX = canvasWidth / 2;
        const canvasCenterY = canvasHeight / 2;

        setPanOffset({
            x: canvasCenterX - centerX * finalZoom,
            y: canvasCenterY - centerY * finalZoom
        });
    }, [isLoading, notes.length]);

    const handleWheel = useCallback((e: WheelEvent) => {
        const target = e.target as HTMLElement;
        const isInsideNote = target.closest('[data-note-container]');

        if (e.ctrlKey) {
            e.preventDefault();
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const canvasX = (mouseX - panOffset.x) / zoom;
            const canvasY = (mouseY - panOffset.y) / zoom;

            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.1, Math.min(3, zoom * delta));

            const newPanX = mouseX - canvasX * newZoom;
            const newPanY = mouseY - canvasY * newZoom;

            setZoom(newZoom);
            setPanOffset({ x: newPanX, y: newPanY });
        } else if (!isInsideNote) {
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
                const canvasX = (e.clientX - rect.left - panOffset.x) / zoom;
                const canvasY = (e.clientY - rect.top - panOffset.y) / zoom;
                const x = canvasX - draggedNote.offsetX;
                const y = canvasY - draggedNote.offsetY;
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
            font: currentFont as any,
            fontSize: 16,
            listItems: noteConfig.type === 'list' ? [{ id: generateId(), text: '', checked: false }] : undefined
        };
        setNotes(prev => [...prev, newNote]);
        setShowAddNoteModal(false);
        setSelectedNoteId(newNote.id);
    };

    const deleteNote = (noteId: string) => {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        if (selectedNoteId === noteId) {
            setSelectedNoteId(null);
        }
        setContextMenu(null);
    };

    const updateNoteContent = (noteId: string, content: string) => {
        setNotes(prev => prev.map(n =>
            n.id === noteId ? { ...n, content } : n
        ));
    };

    const updateNoteColor = (noteId: string, color: string) => {
        setNotes(prev => prev.map(n =>
            n.id === noteId ? { ...n, color } : n
        ));
    };

    // Get background pattern style
    const getBackgroundStyle = () => {
        const pattern = currentBackground.pattern;
        if (!pattern) return {};

        switch (pattern) {
            case 'grid':
                return {
                    backgroundImage: `
                        linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                };
            case 'dots':
                return {
                    backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                };
            case 'cork':
                return {
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E")`
                };
            case 'linen':
                return {
                    backgroundImage: `
                        linear-gradient(90deg, rgba(0,0,0,0.02) 50%, transparent 50%),
                        linear-gradient(rgba(0,0,0,0.02) 50%, transparent 50%)
                    `,
                    backgroundSize: '4px 4px'
                };
            default:
                return {};
        }
    };

    // Get font class
    const getFontClass = (font: string) => {
        switch (font) {
            case 'serif': return 'font-serif';
            case 'handwritten': return 'font-handwritten';
            case 'script': return 'font-script';
            default: return 'font-sans';
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading board...</div>
            </div>
        );
    }

    if (!board) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Board not found</div>
            </div>
        );
    }


    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAddNoteModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Note
                    </button>
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        Zoom: {Math.round(zoom * 100)}%
                    </span>
                </div>
            </div>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className={clsx(
                    "flex-1 relative overflow-hidden cursor-grab",
                    currentBackground.value,
                    isPanning && "cursor-grabbing"
                )}
                style={getBackgroundStyle()}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
            >
                {/* Notes container with transform */}
                <div
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                    }}
                >
                    {notes.map(note => (
                        <div
                            key={note.id}
                            data-note-container
                            className={clsx(
                                "absolute rounded-lg shadow-lg transition-shadow",
                                selectedNoteId === note.id && "ring-2 ring-blue-500",
                                getFontClass(note.font)
                            )}
                            style={{
                                left: note.x,
                                top: note.y,
                                width: note.width,
                                height: note.height,
                                backgroundColor: note.color,
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNoteId(note.id);
                            }}
                            onMouseDown={(e) => {
                                if (e.button === 0) {
                                    e.stopPropagation();
                                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                                    setDraggedNote({
                                        id: note.id,
                                        offsetX: (e.clientX - rect.left) / zoom,
                                        offsetY: (e.clientY - rect.top) / zoom
                                    });
                                    setSelectedNoteId(note.id);
                                }
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, noteId: note.id });
                            }}
                        >
                            {/* Note header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-black/10">
                                <div className="flex items-center gap-2">
                                    {note.type === 'list' && <List className="w-4 h-4 text-gray-600" />}
                                    {note.type === 'image' && <ImageIcon className="w-4 h-4 text-gray-600" />}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setContextMenu({ x: e.clientX, y: e.clientY, noteId: note.id });
                                    }}
                                    className="p-1 rounded hover:bg-black/10 transition-colors"
                                >
                                    <MoreVertical className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>

                            {/* Note content */}
                            <div className="p-3 h-[calc(100%-40px)] overflow-auto">
                                {note.type === 'text' && (
                                    <textarea
                                        value={note.content}
                                        onChange={(e) => updateNoteContent(note.id, e.target.value)}
                                        placeholder="Type your note..."
                                        className="w-full h-full resize-none bg-transparent focus:outline-none text-gray-800"
                                        style={{ fontSize: note.fontSize }}
                                    />
                                )}
                                {note.type === 'list' && (
                                    <div className="space-y-2">
                                        {note.listItems?.map((item, idx) => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={(e) => {
                                                        const newItems = [...(note.listItems || [])];
                                                        newItems[idx] = { ...item, checked: e.target.checked };
                                                        setNotes(prev => prev.map(n =>
                                                            n.id === note.id ? { ...n, listItems: newItems } : n
                                                        ));
                                                    }}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.text}
                                                    onChange={(e) => {
                                                        const newItems = [...(note.listItems || [])];
                                                        newItems[idx] = { ...item, text: e.target.value };
                                                        setNotes(prev => prev.map(n =>
                                                            n.id === note.id ? { ...n, listItems: newItems } : n
                                                        ));
                                                    }}
                                                    placeholder="List item..."
                                                    className={clsx(
                                                        "flex-1 bg-transparent focus:outline-none text-gray-800",
                                                        item.checked && "line-through text-gray-500"
                                                    )}
                                                />
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newItems = [...(note.listItems || []), { id: generateId(), text: '', checked: false }];
                                                setNotes(prev => prev.map(n =>
                                                    n.id === note.id ? { ...n, listItems: newItems } : n
                                                ));
                                            }}
                                            className="text-sm text-gray-500 hover:text-gray-700"
                                        >
                                            + Add item
                                        </button>
                                    </div>
                                )}
                                {note.type === 'image' && note.imageUrl && (
                                    <img
                                        src={note.imageUrl}
                                        alt="Note"
                                        className="w-full h-full object-contain"
                                    />
                                )}
                            </div>

                            {/* Resize handle */}
                            <div
                                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setResizingNote({
                                        id: note.id,
                                        startX: e.clientX,
                                        startY: e.clientY,
                                        startWidth: note.width,
                                        startHeight: note.height
                                    });
                                }}
                            >
                                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Context Menu */}
                <AnimatePresence>
                    {contextMenu && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                        >
                            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Note Color</span>
                                <div className="flex gap-1 mt-1">
                                    {COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => {
                                                updateNoteColor(contextMenu.noteId, color.value);
                                                setContextMenu(null);
                                            }}
                                            className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => deleteNote(contextMenu.noteId)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Note
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Click outside to close context menu */}
                {contextMenu && (
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setContextMenu(null)}
                    />
                )}
            </div>

            {/* Add Note Modal */}
            <AnimatePresence>
                {showAddNoteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowAddNoteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 max-w-[90vw]"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                Add New Note
                            </h3>

                            {/* Note Type */}
                            <div className="mb-4">
                                <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Type</label>
                                <div className="flex gap-2">
                                    {(['text', 'list'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setNoteConfig(prev => ({ ...prev, type }))}
                                            className={clsx(
                                                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                                                noteConfig.type === type
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                            )}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Note Color */}
                            <div className="mb-4">
                                <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => setNoteConfig(prev => ({ ...prev, color: color.value }))}
                                            className={clsx(
                                                "w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110",
                                                noteConfig.color === color.value
                                                    ? "border-blue-500"
                                                    : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowAddNoteModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addNote}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                                >
                                    Add Note
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default BoardEditor;
