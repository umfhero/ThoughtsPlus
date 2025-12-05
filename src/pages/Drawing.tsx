import { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Undo, Redo, Plus, Type, X, Layers, GripVertical, Check, ArrowDownRight, Palette, Type as TypeIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// --- Types ---
interface CanvasObject {
    id: string;
    type: 'text' | 'image';
    x: number;
    y: number;
    width?: number;
    height?: number;
    content: string;
    color?: string;
    fontSize?: number;
}

interface Tab {
    id: string;
    name: string;
    emoji: string;
    color: string;
    canvasData: string | null;
    objects: CanvasObject[];
}

// --- Constants ---
const DEFAULT_TAB_COLOR = '#3B82F6';
const EMOJIS = ['📝', '🎨', '💡', '📅', '✅', '🔥', '❤️', '⭐', '🔷', '🟢', '🧠', '💼'];
const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280'];

const generateId = () => Math.random().toString(36).substring(2, 9);

export function DrawingPage() {
    // --- Refs ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef<{ x: number, y: number }>({ x: 960, y: 540 });
    const textInputRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

    // --- State: Tabs & Navigation ---
    const [tabs, setTabs] = useState<Tab[]>([{
        id: generateId(),
        name: 'Untitled',
        emoji: '📝',
        color: DEFAULT_TAB_COLOR,
        canvasData: null,
        objects: []
    }]);
    const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id);
    const [showTabsPanel, setShowTabsPanel] = useState(false);

    // Header/Tab Editing State
    const [tabEmojiPickerOpenFor, setTabEmojiPickerOpenFor] = useState<string | null>(null);
    const [tabColorPickerOpenFor, setTabColorPickerOpenFor] = useState<string | null>(null);
    const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

    // New Tab Creator Modal
    const [isNewTabModalOpen, setIsNewTabModalOpen] = useState(false);
    const [newTabConfig, setNewTabConfig] = useState({ name: 'New Drawing', emoji: '🎨', color: DEFAULT_TAB_COLOR });

    // --- State: Drawing Tools ---
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [savedStatus, setSavedStatus] = useState('Saved');
    const [showColorPicker, setShowColorPicker] = useState(false);

    // --- State: UI Helpers ---
    const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
    const [cursorScale, setCursorScale] = useState(1);

    // --- State: Objects ---
    const [textMode, setTextMode] = useState(false);
    const [objects, setObjects] = useState<CanvasObject[]>([]);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
    const [resizeStart, setResizeStart] = useState<{ id: string, startX: number, startY: number, startWidth: number, startHeight: number } | null>(null);

    const rafRef = useRef<number | null>(null);

    // --- State: History ---
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Refs for drawing mathematics
    const startPos = useRef<{ x: number, y: number } | null>(null);
    const snapshot = useRef<ImageData | null>(null);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    // --- Lifecycle & Persistence ---

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const updateScale = () => {
            if (canvasRef.current && containerRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setCursorScale(rect.width / 1920);
            }
        };
        window.addEventListener('resize', updateScale);
        setTimeout(updateScale, 100);
        return () => window.removeEventListener('resize', updateScale);
    }, [showTabsPanel]);

    useEffect(() => {
        const timeout = setTimeout(saveAll, 1000);
        return () => clearTimeout(timeout);
    }, [tabs, activeTabId, objects]);

    const loadData = async () => {
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-drawing');
            if (data) {
                if (Array.isArray(data.tabs)) {
                    setTabs(data.tabs);
                    const targetId = data.activeTabId || data.tabs[0]?.id;
                    setActiveTabId(targetId);
                    const current = data.tabs.find((t: Tab) => t.id === targetId);
                    setObjects(current?.objects || []);
                } else if (typeof data === 'string') {
                    setTabs([{
                        id: generateId(),
                        name: 'My Drawing',
                        emoji: '🎨',
                        color: DEFAULT_TAB_COLOR,
                        canvasData: data,
                        objects: []
                    }]);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const saveAll = async () => {
        setSavedStatus('Saving...');
        try {
            const currentCanvasData = canvasRef.current?.toDataURL() || null;
            const updatedTabs = tabs.map(t =>
                t.id === activeTabId
                    ? { ...t, canvasData: currentCanvasData, objects: objects }
                    : t
            );
            const dataToSave = { tabs: updatedTabs, activeTabId };
            // @ts-ignore
            await window.ipcRenderer.invoke('save-drawing', dataToSave);
            setSavedStatus('Saved');
        } catch (e) {
            setSavedStatus('Error');
        }
    };

    // --- Tab Management Logic ---

    const handleSwitchTab = (newId: string) => {
        if (newId === activeTabId) return;
        const currentData = canvasRef.current?.toDataURL() || null;
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, canvasData: currentData, objects } : t));

        const newTab = tabs.find(t => t.id === newId);
        if (newTab && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, 1920, 1080);
            if (newTab.canvasData) {
                const img = new Image();
                img.src = newTab.canvasData;
                img.onload = () => ctx?.drawImage(img, 0, 0);
            }
            setActiveTabId(newId);
            setObjects(newTab.objects || []);
            setHistory([]);
            setHistoryIndex(-1);
        }
    };

    const confirmAddTab = () => {
        const newTab: Tab = {
            id: generateId(),
            name: newTabConfig.name,
            emoji: newTabConfig.emoji,
            color: newTabConfig.color,
            canvasData: null,
            objects: []
        };
        const currentData = canvasRef.current?.toDataURL();
        setTabs(prev => [...prev.map(t => t.id === activeTabId ? { ...t, canvasData: currentData || null, objects } : t), newTab]);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, 1920, 1080);
        setActiveTabId(newTab.id);
        setObjects([]);
        setIsNewTabModalOpen(false);
        setNewTabConfig({ name: 'New Drawing', emoji: '🎨', color: DEFAULT_TAB_COLOR });
    };

    const handleDeleteTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tabs.length <= 1) return;
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            handleSwitchTab(newTabs[0].id);
        }
    };

    const updateTabProperty = (id: string, prop: keyof Tab, value: any) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, [prop]: value } : t));
    };

    const onTabDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTabId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onTabDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedTabId || draggedTabId === targetId) return;
        const sourceIndex = tabs.findIndex(t => t.id === draggedTabId);
        const targetIndex = tabs.findIndex(t => t.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return;
        const newTabs = [...tabs];
        const [removed] = newTabs.splice(sourceIndex, 1);
        newTabs.splice(targetIndex, 0, removed);
        setTabs(newTabs);
    };

    // --- Drawing / Object Logic ---

    const addTextObject = (text: string, x?: number, y?: number) => {
        const newObj: CanvasObject = {
            id: generateId(),
            type: 'text',
            x: x || 100,
            y: y || 100,
            width: 250,
            height: 100,
            content: text,
            color: color,
            fontSize: brushSize * 4
        };
        setObjects(prev => [...prev, newObj]);
        setSelectedObjectId(newObj.id);
        // Force focus on next render
        setTimeout(() => {
            if (textInputRefs.current[newObj.id]) {
                textInputRefs.current[newObj.id]?.focus();
                textInputRefs.current[newObj.id]?.select();
            }
        }, 10);
    };

    const deleteAction = () => {
        if (selectedObjectId) {
            setObjects(prev => prev.filter(o => o.id !== selectedObjectId));
            setSelectedObjectId(null);
        } else {
            clearCanvas();
        }
    };

    const clearCanvas = () => {
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, 1920, 1080);
        setObjects([]);
        addToHistory();
    };

    // --- Resize Logic ---
    const handleResizeStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const obj = objects.find(o => o.id === id);
        if (obj) {
            setResizeStart({
                id,
                startX: e.clientX,
                startY: e.clientY,
                startWidth: obj.width || 250,
                startHeight: obj.height || 100
            });
        }
    };

    // --- Global Mouse Move for Drag/Resize ---
    const handleMouseMoveGlobal = useCallback((e: React.MouseEvent) => {
        e.persist();

        // Cursor follow
        if (containerRef.current) {
            const r = containerRef.current.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            lastMousePos.current = { x, y };
            if (cursorRef.current) cursorRef.current.style.transform = `translate(${x}px, ${y}px)`;
        }

        // Throttle updates with RAF
        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            if (resizeStart) {
                const dx = e.clientX - resizeStart.startX;
                const dy = e.clientY - resizeStart.startY;

                setObjects(prev => prev.map(o => {
                    if (o.id === resizeStart.id) {
                        return {
                            ...o,
                            width: Math.max(50, resizeStart.startWidth + dx),
                            height: Math.max(30, resizeStart.startHeight + dy)
                        };
                    }
                    return o;
                }));
            } else if (selectedObjectId && dragStart) {
                setObjects(prev => {
                    return prev.map(o => o.id === selectedObjectId ? { ...o, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y } : o);
                });
            }
            if (isDrawing && canvasRef.current) {
                draw(e);
            }
            rafRef.current = null;
        });
    }, [resizeStart, isDrawing, selectedObjectId, dragStart]); // Dependencies needed to recreate callback

    // --- Shortcuts ---

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Paste logic
            if (e.ctrlKey && e.key.toLowerCase() === 'v') {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        e.preventDefault();
                        addTextObject(text, lastMousePos.current.x, lastMousePos.current.y);
                    }
                } catch (err) { console.error('Clipboard read failed', err); }
                return;
            }

            // Allow typing in inputs
            if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && !e.ctrlKey) return;

            if (e.key === 'Delete') {
                if (selectedObjectId) {
                    setObjects(prev => prev.filter(o => o.id !== selectedObjectId));
                    setSelectedObjectId(null);
                }
            }

            if (e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'z': e.preventDefault(); undo(); break;
                    case 'y': e.preventDefault(); redo(); break;
                    case 'c': e.preventDefault(); setShowColorPicker(true); break;
                    case 't':
                        e.preventDefault();
                        const x = lastMousePos.current.x > 0 ? lastMousePos.current.x : 200;
                        const y = lastMousePos.current.y > 0 ? lastMousePos.current.y : 200;
                        addTextObject('Type here...', x, y);
                        break;
                    case 'd':
                        e.preventDefault();
                        setShowTabsPanel(p => !p);
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedObjectId]);

    // Independent Scroll Listener for Font Size
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (selectedObjectId) {
                // Check if hovering over the selected object or if just selected is enough? 
                // User said "scrolling up and down to change text size should still be there". 
                // Assume if selected, scroll changes size.
                // We must be careful not to block normal page scroll if not hovering.
                // But this page is overflow hidden basically.
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1 : -1;
                setObjects(prev => prev.map(o => o.id === selectedObjectId && o.type === 'text' ? { ...o, fontSize: Math.max(8, (o.fontSize || 16) + delta * 2) } : o));
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [selectedObjectId]);

    const startDrawing = (e: React.MouseEvent) => {
        if (textMode) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) addTextObject('Type here...', e.clientX - rect.left, e.clientY - rect.top);
            setTextMode(false);
            return;
        }

        setSelectedObjectId(null);

        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = 1920 / rect.width;
        const scaleY = 1080 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        startPos.current = { x, y };
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            snapshot.current = ctx.getImageData(0, 0, 1920, 1080);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            setIsDrawing(true);
        }
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = 1920 / rect.width;
        const scaleY = 1080 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const ctx = canvasRef.current.getContext('2d');
        if (ctx && startPos.current) {
            if (e.shiftKey && snapshot.current) {
                ctx.putImageData(snapshot.current, 0, 0);
                ctx.beginPath();
                ctx.rect(startPos.current.x, startPos.current.y, x - startPos.current.x, y - startPos.current.y);
                ctx.stroke();
            } else {
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            addToHistory();
        }
    };

    const addToHistory = () => {
        if (canvasRef.current) {
            const data = canvasRef.current.toDataURL();
            const newH = history.slice(0, historyIndex + 1);
            newH.push(data);
            setHistory(newH);
            setHistoryIndex(newH.length - 1);
            setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, canvasData: data } : t));
        }
    };

    const undo = () => {
        if (historyIndex > 0) {
            const idx = historyIndex - 1;
            setHistoryIndex(idx);
            loadHistory(history[idx]);
        }
    };
    const redo = () => {
        if (historyIndex < history.length - 1) {
            const idx = historyIndex + 1;
            setHistoryIndex(idx);
            loadHistory(history[idx]);
        }
    };
    const loadHistory = (data: string) => {
        const img = new Image();
        img.src = data;
        img.onload = () => {
            const ctx = canvasRef.current?.getContext('2d');
            ctx?.clearRect(0, 0, 1920, 1080);
            ctx?.drawImage(img, 0, 0);
        };
    };

    const cursorSize = Math.max(brushSize * cursorScale, 5);
    const showCustomCursor = isHoveringCanvas && !selectedObjectId && !textMode && !resizeStart;

    return (
        <div ref={containerRef} className="h-full flex relative bg-gray-50 dark:bg-gray-900 overflow-hidden"
            onMouseMove={handleMouseMoveGlobal}
            onMouseUp={() => { setDragStart(null); setResizeStart(null); stopDrawing(); }}
        >
            {/* Custom Cursor */}
            <div ref={cursorRef}
                className={clsx("absolute top-0 left-0 pointer-events-none z-[100] flex items-center justify-center transition-opacity", showCustomCursor ? "opacity-100" : "opacity-0")}
                style={{
                    width: cursorSize, height: cursorSize,
                    marginTop: -cursorSize / 2, marginLeft: -cursorSize / 2,
                    backgroundColor: `${color}33`, borderRadius: '50%',
                    border: `2px solid ${color}`,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.4)'
                }}>
                <div className="w-1 h-1 bg-white rounded-full" />
            </div>

            {/* Canvas Container */}
            <div className={clsx("flex-1 relative", textMode ? "cursor-text" : (showCustomCursor ? "cursor-none" : "cursor-default"))}
                onMouseEnter={() => setIsHoveringCanvas(true)}
                onMouseLeave={() => setIsHoveringCanvas(false)}>

                {/* Header Overlay */}
                <div className="absolute top-4 left-6 z-10 flex items-center gap-3 select-none">
                    <div className="relative">
                        <button onClick={() => setTabEmojiPickerOpenFor(tabEmojiPickerOpenFor === 'header' ? null : 'header')}
                            className="text-4xl hover:scale-110 transition-transform">
                            {activeTab.emoji}
                        </button>
                        {tabEmojiPickerOpenFor === 'header' && (
                            <div className="absolute top-12 left-0 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-xl border border-gray-200 z-50 grid grid-cols-4 gap-1 w-max">
                                {EMOJIS.map(em => (
                                    <button key={em} onClick={() => { updateTabProperty(activeTabId, 'emoji', em); setTabEmojiPickerOpenFor(null); }} className="p-2 hover:bg-gray-100 rounded text-xl">{em}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <input value={activeTab.name}
                            onChange={(e) => updateTabProperty(activeTabId, 'name', e.target.value)}
                            className="text-3xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-gray-800 dark:text-gray-100 placeholder-white/20 w-80"
                            placeholder="Untitled"
                        />
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                            {tabs.length} drawings • {savedStatus}
                            <span className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px] text-gray-500">Ctrl+D for tabs</span>
                        </div>
                    </div>
                </div>

                <canvas ref={canvasRef} width={1920} height={1080}
                    onMouseDown={startDrawing}
                    className="w-full h-full bg-white dark:bg-gray-800 shadow-inner block"
                />

                {/* Objects Layer */}
                {objects.map(obj => {
                    const isSelected = selectedObjectId === obj.id;
                    const isHovered = hoveredObjectId === obj.id;
                    const showControls = isSelected || isHovered;

                    return (
                        <div key={obj.id}
                            style={{ position: 'absolute', left: obj.x, top: obj.y, cursor: 'move' }}
                            onMouseDown={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); setDragStart({ x: e.clientX - obj.x, y: e.clientY - obj.y }); }}
                            onMouseEnter={() => setHoveredObjectId(obj.id)}
                            onMouseLeave={() => setHoveredObjectId(null)}
                            className={clsx("group", isSelected && "z-50")}
                        >
                            <div className={clsx("relative p-2 border-2 transition-all rounded-lg",
                                showControls ? "border-blue-500/50 border-dashed bg-blue-50/10" : "border-transparent"
                            )}
                                style={obj.type === 'text' ? { width: obj.width, height: obj.height } : {}}
                            >
                                {obj.type === 'text' ? (
                                    <textarea
                                        ref={el => { textInputRefs.current[obj.id] = el; }}
                                        value={obj.content}
                                        onChange={e => setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, content: e.target.value } : o))}
                                        className="bg-transparent font-handwriting border-none focus:outline-none w-full h-full resize-none p-0 overflow-hidden leading-tight"
                                        style={{ color: obj.color, fontSize: obj.fontSize }}
                                        placeholder="Type..."
                                        spellCheck={true}
                                    />
                                ) : (
                                    <img src={obj.content} className="pointer-events-none max-w-[500px]" alt="obj" />
                                )}

                                {/* Controls: Close, Resize, Properties */}
                                <AnimatePresence>
                                    {showControls && (
                                        <>
                                            {/* Delete Button */}
                                            <motion.button
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                onClick={(e) => { e.stopPropagation(); deleteAction(); }}
                                                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-md z-50"
                                            >
                                                <X className="w-3 h-3" />
                                            </motion.button>

                                            {/* Resize Handle - Bottom Right */}
                                            {obj.type === 'text' && (
                                                <motion.div
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    className="absolute -bottom-3 -right-3 w-6 h-6 bg-white border border-blue-500 rounded-full cursor-nwse-resize flex items-center justify-center z-50 hover:bg-blue-50 transition-colors shadow-md text-blue-500"
                                                    onMouseDown={(e) => handleResizeStart(e, obj.id)}
                                                >
                                                    <ArrowDownRight className="w-4 h-4" />
                                                </motion.div>
                                            )}

                                            {/* Properties Popout (Color, Size) - Only when selected */}
                                            {isSelected && obj.type === 'text' && (
                                                <motion.div
                                                    initial={{ y: 10, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: 10, opacity: 0 }}
                                                    className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 p-1.5 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center gap-2 z-[60]"
                                                    onMouseDown={e => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                                        <TypeIcon className="w-3 h-3 text-gray-500" />
                                                        <input
                                                            type="number"
                                                            value={obj.fontSize}
                                                            onChange={e => setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, fontSize: parseInt(e.target.value) } : o))}
                                                            className="w-10 bg-transparent text-xs text-center focus:outline-none dark:text-gray-200"
                                                        />
                                                    </div>
                                                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-600" />
                                                    <div className="relative w-6 h-6 rounded-full overflow-hidden ring-1 ring-gray-200 cursor-pointer">
                                                        <input
                                                            type="color"
                                                            value={obj.color}
                                                            onChange={e => setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, color: e.target.value } : o))}
                                                            className="absolute inset-0 w-full h-full p-0 border-none scale-150 cursor-pointer"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}

                {/* Toolbar - Moved to Top Right, integrated Tabs Button */}
                <div className="absolute top-6 right-6 flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50">
                    <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden relative cursor-pointer" style={{ backgroundColor: color }}>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <input type="range" min="1" max="50" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-20 accent-blue-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <button onClick={() => setTextMode(!textMode)} className={clsx("p-2 rounded-xl", textMode ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-500")}><Type className="w-5 h-5" /></button>
                    <button onClick={undo} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><Undo className="w-5 h-5" /></button>
                    <button onClick={redo} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><Redo className="w-5 h-5" /></button>
                    <button onClick={deleteAction} className={clsx("p-2 rounded-xl hover:bg-red-50 text-red-500")}>
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                    {/* Integrated Tabs Button */}
                    <button onClick={() => setShowTabsPanel(!showTabsPanel)} className={clsx("p-2 rounded-xl text-gray-500 hover:bg-gray-100", showTabsPanel && "text-blue-600 bg-blue-50")}>
                        <Layers className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Tab Panel */}
            <AnimatePresence>
                {showTabsPanel && (
                    <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
                        className="absolute top-20 right-6 bottom-20 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-40 flex flex-col overflow-hidden">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <span className="font-bold text-gray-700 dark:text-gray-200">Drawings</span>
                            <div className="flex gap-1">
                                <button onClick={() => setIsNewTabModalOpen(true)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg"><Plus className="w-4 h-4" /></button>
                                <button onClick={() => setShowTabsPanel(false)} className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg"><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {tabs.map((tab, idx) => (
                                <div key={tab.id}
                                    className={clsx("flex items-center gap-2 p-2 rounded-xl border transition-all group",
                                        activeTabId === tab.id ? "border-transparent text-white" : "bg-white dark:bg-gray-900 border-gray-100 hover:border-blue-200 text-gray-700"
                                    )}
                                    style={activeTabId === tab.id ? { backgroundColor: tab.color } : {}}
                                    onClick={() => handleSwitchTab(tab.id)}
                                    draggable
                                    onDragStart={(e) => onTabDragStart(e, tab.id)}
                                    onDragOver={(e) => onTabDragOver(e, tab.id)}
                                >
                                    <div className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100"><GripVertical className="w-4 h-4" /></div>
                                    <div className="relative">
                                        <button onClick={(e) => { e.stopPropagation(); setTabEmojiPickerOpenFor(tabEmojiPickerOpenFor === tab.id ? null : tab.id); }}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-lg">
                                            {tab.emoji}
                                        </button>
                                        {tabEmojiPickerOpenFor === tab.id && (
                                            <div className="absolute top-8 left-0 z-50 bg-white p-2 rounded-xl shadow-xl border grid grid-cols-4 gap-1 w-max">
                                                {EMOJIS.map(em => (
                                                    <button key={em} onClick={(e) => { e.stopPropagation(); updateTabProperty(tab.id, 'emoji', em); setTabEmojiPickerOpenFor(null); }} className="p-1 hover:bg-gray-100 rounded text-lg">{em}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <span className={clsx("font-medium text-sm truncate", activeTabId === tab.id ? "text-white" : "text-gray-900 dark:text-gray-200")}>{tab.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <button onClick={(e) => { e.stopPropagation(); setTabColorPickerOpenFor(tabColorPickerOpenFor === tab.id ? null : tab.id); }}
                                                className="w-3 h-3 rounded-full border border-white/40" style={{ backgroundColor: tab.color }}>
                                            </button>
                                            {tabColorPickerOpenFor === tab.id && (
                                                <div className="absolute top-12 left-10 z-50 bg-white p-2 rounded-xl shadow-xl border grid grid-cols-5 gap-1 w-max">
                                                    {COLORS.map(c => (
                                                        <button key={c} onClick={(e) => { e.stopPropagation(); updateTabProperty(tab.id, 'color', c); setTabColorPickerOpenFor(null); }}
                                                            className="w-5 h-5 rounded-full ring-1 ring-gray-100" style={{ backgroundColor: c }} />
                                                    ))}
                                                </div>
                                            )}
                                            <span className="text-[10px] opacity-70">{tab.objects.length} items</span>
                                        </div>
                                    </div>
                                    <button onClick={(e) => handleDeleteTab(e, tab.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* New Tab Modal */}
            <AnimatePresence>
                {isNewTabModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-96 border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold dark:text-gray-100">New Drawing Setup</h2>
                                <button onClick={() => setIsNewTabModalOpen(false)} className="bg-gray-100 dark:bg-gray-700 p-1 rounded-full"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">Name</label>
                                    <input autoFocus value={newTabConfig.name} onChange={e => setNewTabConfig({ ...newTabConfig, name: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">Quick Setup</label>
                                    <div className="flex gap-2 justify-between">
                                        <div className="flex gap-1 bg-gray-50 dark:bg-gray-700 p-1 rounded-xl">
                                            {['🎨', '📝', '💡', '📅'].map(e => (
                                                <button key={e} onClick={() => setNewTabConfig({ ...newTabConfig, emoji: e })}
                                                    className={clsx("w-8 h-8 rounded-lg", newTabConfig.emoji === e ? "bg-white shadow text-xl" : "hover:bg-gray-200")}>{e}</button>
                                            ))}
                                        </div>
                                        <div className="flex gap-1 bg-gray-50 dark:bg-gray-700 p-1 rounded-xl">
                                            {COLORS.slice(0, 4).map(c => (
                                                <button key={c} onClick={() => setNewTabConfig({ ...newTabConfig, color: c })}
                                                    className={clsx("w-8 h-8 rounded-lg border-2", newTabConfig.color === c ? "border-black/20 scale-90" : "border-transparent")} style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={confirmAddTab} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 mt-4">
                                    <Check className="w-5 h-5" /> Create Drawing
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
