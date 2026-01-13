import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Calculator, BookOpen, Sparkles, X, Trash2, Folder, Upload, Mic, Link as LinkIcon, MoreVertical, Pencil, MessageSquare, List, Image as ImageIcon, Pipette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import html2canvas from 'html2canvas';

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
    const [isLoading, setIsLoading] = useState(true);

    // Track the board ID that was navigated to from Dashboard to prevent override
    const navigatedBoardIdRef = useRef<string | null>(null);

    // Track current active board ID for async callbacks (prevents stale closure issues)
    const activeBoardIdRef = useRef<string>('');

    // Track if we're in the middle of creating a new board (prevents double creation from StrictMode)
    const isCreatingBoardRef = useRef<boolean>(false);
    const pendingNewBoardRef = useRef<string | null>(null);

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
    const currentFont = activeBoard?.font || 'modern';
    const currentBackground = activeBoard?.background || BACKGROUNDS[0];

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    // Keep ref in sync with state for async callbacks
    useEffect(() => {
        activeBoardIdRef.current = activeBoardId;
    }, [activeBoardId]);

    // Check for pending board navigation (when user clicks a board from Dashboard)
    useEffect(() => {
        const checkPendingNavigation = () => {
            const pendingId = localStorage.getItem('pendingBoardNavigation');
            if (pendingId && boards.length > 0) {
                console.log('🔄 [Board] Checking pending navigation:', pendingId);
                const targetBoard = boards.find(b => b.id === pendingId);
                if (targetBoard && pendingId !== activeBoardId) {
                    console.log('✅ [Board] Switching to board:', targetBoard.name);
                    localStorage.removeItem('pendingBoardNavigation');
                    navigatedBoardIdRef.current = pendingId; // Store to prevent loadData override
                    setActiveBoardId(pendingId);
                    setNotes(targetBoard.notes || []);
                    // Reset centering so it recalculates for the new board
                    hasCenteredRef.current = null;
                } else if (!targetBoard) {
                    console.warn('⚠️ [Board] Pending board not found:', pendingId);
                    localStorage.removeItem('pendingBoardNavigation');
                }
            }
        };

        // Check immediately when boards are loaded
        checkPendingNavigation();

        // Also listen for navigation events
        const handleNavigate = () => {
            setTimeout(checkPendingNavigation, 100);
        };
        window.addEventListener('navigate-to-page', handleNavigate);

        return () => {
            window.removeEventListener('navigate-to-page', handleNavigate);
        };
    }, [boards, activeBoardId]);

    // Listen for create-new-board event from Dashboard
    useEffect(() => {
        const handleCreateNewBoard = () => {
            console.log('📝 [Board] Received create-new-board event');
            addNewBoard();
        };

        window.addEventListener('create-new-board', handleCreateNewBoard);

        return () => {
            window.removeEventListener('create-new-board', handleCreateNewBoard);
        };
    }, []);



    useEffect(() => {
        if (boards.length > 0 && activeBoardId) {
            const timeout = setTimeout(saveData, 1000);
            return () => clearTimeout(timeout);
        }
    }, [boards, activeBoardId, notes]);

    // Update all notes' font when board font changes
    useEffect(() => {
        if (notes.length > 0 && currentFont) {
            setNotes(prev => prev.map(note => ({ ...note, font: currentFont as any })));
        }
    }, [currentFont]);

    // Auto-center and zoom to fit notes when board loads (only once per board switch)
    const hasCenteredRef = useRef<string | null>(null);

    // Function to capture board screenshot for dashboard preview
    const capturePreviewScreenshot = useCallback(async () => {
        // Capture the current board ID at the start of the async operation
        const currentBoardId = activeBoardIdRef.current;
        if (!canvasRef.current || !currentBoardId) return;

        try {
            // Wait a bit for rendering to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Check if board changed during wait - if so, abort
            if (activeBoardIdRef.current !== currentBoardId) {
                console.log('📸 [Board] Board changed during capture, aborting for:', currentBoardId);
                return;
            }

            // Determine background color based on board's pattern and theme
            const bgPattern = activeBoard?.background?.pattern;
            const isDarkMode = document.documentElement.classList.contains('dark');

            let bgColor = isDarkMode ? '#111827' : '#F5F1E8'; // Default gray-900 or cream
            if (bgPattern === 'cork') bgColor = isDarkMode ? '#1f2937' : '#C19A6B'; // gray-800 or cork
            else if (bgPattern === 'grid') bgColor = isDarkMode ? '#111827' : '#F5F1E8';
            else if (bgPattern === 'dots') bgColor = isDarkMode ? '#111827' : '#F0EDE5';
            else if (bgPattern === 'linen') bgColor = isDarkMode ? '#111827' : '#FAF9F6';

            const capturedCanvas = await html2canvas(canvasRef.current, {
                backgroundColor: bgColor, // Use actual background color
                scale: 1.5, // Higher resolution for sharper text
                logging: false,
                useCORS: true,
            });

            // Check again after capture in case board changed
            if (activeBoardIdRef.current !== currentBoardId) {
                console.log('📸 [Board] Board changed after capture, aborting for:', currentBoardId);
                return;
            }

            // Crop the canvas to remove any shadow overflow at edges
            const cropAmount = 15; // pixels to crop from each edge (scaled)
            const croppedCanvas = document.createElement('canvas');
            const ctx = croppedCanvas.getContext('2d');
            const cropWidth = capturedCanvas.width - (cropAmount * 2);
            const cropHeight = capturedCanvas.height - (cropAmount * 2);
            croppedCanvas.width = cropWidth;
            croppedCanvas.height = cropHeight;
            if (ctx) {
                ctx.drawImage(
                    capturedCanvas,
                    cropAmount, cropAmount, cropWidth, cropHeight,
                    0, 0, cropWidth, cropHeight
                );
            }

            const dataUrl = croppedCanvas.toDataURL('image/png'); // PNG for sharper text
            const previewData = {
                boardId: currentBoardId,
                image: dataUrl,
                timestamp: Date.now()
            };

            // Save with per-board key for multi-board dashboard preview
            localStorage.setItem(`boardPreviewImage_${currentBoardId}`, JSON.stringify(previewData));

            // Also save to legacy key for backward compatibility
            localStorage.setItem('boardPreviewImage', JSON.stringify(previewData));

            console.log('📸 [Board] Preview screenshot captured for board:', currentBoardId);
        } catch (e) {
            console.error('Failed to capture board preview:', e);
        }
    }, [activeBoard?.background?.pattern]);

    useEffect(() => {
        // Only center if we haven't centered this board yet and loading is done
        if (isLoading || hasCenteredRef.current === activeBoardId) return;

        let attempts = 0;
        const maxAttempts = 10;
        let timer: NodeJS.Timeout;

        const tryCenter = () => {
            if (!canvasRef.current) return;

            // Get canvas dimensions
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const canvasWidth = canvasRect.width;
            const canvasHeight = canvasRect.height;

            console.log(`📐 [Board AutoCenter] Attempt ${attempts + 1}: Canvas ${canvasWidth}x${canvasHeight}`);

            if (canvasWidth === 0 || canvasHeight === 0) {
                if (attempts < maxAttempts) {
                    attempts++;
                    timer = setTimeout(tryCenter, 100);
                }
                return;
            }

            if (notes.length > 0) {
                // Calculate bounding box of all notes
                const minX = Math.min(...notes.map(n => n.x));
                const maxX = Math.max(...notes.map(n => n.x + n.width));
                const minY = Math.min(...notes.map(n => n.y));
                const maxY = Math.max(...notes.map(n => n.y + n.height));

                // Get notes dimensions
                const notesWidth = maxX - minX;
                const notesHeight = maxY - minY;

                // Calculate zoom level to fit all notes with padding (90% of canvas for closer view)
                const zoomX = (canvasWidth * 0.9) / notesWidth;
                const zoomY = (canvasHeight * 0.9) / notesHeight;
                const optimalZoom = Math.min(zoomX, zoomY, 1.2); // Cap at 120% zoom max
                const finalZoom = Math.max(optimalZoom, 0.6); // Minimum 60% zoom (+10%)

                console.log(`🔎 [Board AutoCenter] Calculated Zoom: ${finalZoom}, Notes Dim: ${notesWidth}x${notesHeight}`);

                // Set the zoom level
                setZoom(finalZoom);

                // Get center of notes
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                // Calculate pan offset to center the notes
                const canvasCenterX = canvasWidth / 2;
                const canvasCenterY = canvasHeight / 2;

                setPanOffset({
                    x: canvasCenterX - centerX * finalZoom,
                    y: canvasCenterY - centerY * finalZoom
                });

                // Capture screenshot after centering completes
                setTimeout(capturePreviewScreenshot, 500);
            } else {
                // No notes - reset to center of canvas
                console.log('🔎 [Board AutoCenter] No notes, resetting zoom/pan');
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });

                // Still capture for empty board
                setTimeout(capturePreviewScreenshot, 500);
            }

            // Mark this board as centered
            hasCenteredRef.current = activeBoardId;
        };

        // Start trying
        timer = setTimeout(tryCenter, 100);

        return () => clearTimeout(timer);
    }, [isLoading, activeBoardId, notes.length, capturePreviewScreenshot]);


    const loadData = async () => {
        try {
            console.log('📥 [Board] loadData started');
            // @ts-ignore
            const response = await window.ipcRenderer.invoke('get-boards');
            console.log('📥 [Board] get-boards response type:', Array.isArray(response) ? 'Array' : typeof response);

            // Handle both possible response structures
            // 1. response is { boards: [...] }
            // 2. response is [...] (array of boards)
            let loadedBoards: Board[] = [];
            let lastActiveId = '';

            if (response) {
                if (Array.isArray(response)) {
                    loadedBoards = response;
                } else if (response.boards && Array.isArray(response.boards)) {
                    loadedBoards = response.boards;
                    lastActiveId = response.activeBoardId;
                }
            }

            console.log('📥 [Board] Loaded boards:', loadedBoards.length);

            if (loadedBoards.length > 0) {
                // Migration: Add tape to existing image notes that don't have attachments
                let needsSave = false;
                loadedBoards = loadedBoards.map(board => ({
                    ...board,
                    notes: board.notes.map(note => {
                        if (note.type === 'image' && (!note.attachmentStyle || note.attachmentStyle === 'none')) {
                            needsSave = true;
                            return { ...note, attachmentStyle: 'tape-orange' };
                        }
                        return note;
                    })
                }));

                if (needsSave) {
                    console.log('📥 [Board] Migrated image notes to have tape attachment');
                }

                setBoards(loadedBoards);

                // If we're in the middle of creating a new board, skip setting active board
                // Check both the ref and localStorage (set by Dashboard before navigate-to-page)
                const pendingNewBoardFromStorage = localStorage.getItem('pendingNewBoardCreation') === 'true';
                if (pendingNewBoardRef.current || pendingNewBoardFromStorage) {
                    console.log('📥 [Board] Pending new board creation, skipping board selection');
                    return;
                }

                // Determine which board to show
                // Priority:
                // 1. Already navigated board (from ref, set by previous call) - prevents override
                // 2. Pending board from navigation (localStorage)
                // 3. Last active board from saved data
                // 4. First board in list

                const pendingId = localStorage.getItem('pendingBoardNavigation');
                if (pendingId) {
                    console.log('✅ [Board] Found pending navigation for:', pendingId);
                    localStorage.removeItem('pendingBoardNavigation'); // Consume it
                    navigatedBoardIdRef.current = pendingId; // Store it to prevent override
                }

                // Use navigatedBoardIdRef if set (this survives multiple loadData calls)
                let targetId = navigatedBoardIdRef.current || pendingId || lastActiveId || loadedBoards[0].id;
                console.log('🎯 [Board] targetId determined as:', targetId, '(from ref:', !!navigatedBoardIdRef.current, ')');

                // Validate targetId exists in loaded boards
                const targetBoard = loadedBoards.find(b => b.id === targetId);
                if (!targetBoard) {
                    console.warn('⚠️ [Board] Target ID not found in loaded boards, falling back to first board');
                    targetId = loadedBoards[0].id;
                    lastActiveId = ''; // Reset if invalid
                    navigatedBoardIdRef.current = null; // Clear invalid ref
                }

                setActiveBoardId(targetId);
                const current = loadedBoards.find((b: Board) => b.id === targetId);
                console.log('✅ [Board] Setting notes from board:', current?.name, 'Note Count:', current?.notes?.length);
                setNotes(current?.notes || []);
            } else {
                console.log('⚠️ [Board] No boards found in data. Creating default.');
                // Create default board
                const defaultBoard: Board = {
                    id: 'default-board-' + Date.now(),
                    name: 'My Board',
                    color: BOARD_COLORS[0],
                    notes: []
                };
                setBoards([defaultBoard]);
                setActiveBoardId(defaultBoard.id);
                setNotes([]);
            }
        } catch (e) {
            console.error('❌ [Board] Failed to load boards:', e);
            // Fallback: create default board even on error
            const defaultBoard: Board = {
                id: 'error-fallback-' + Date.now(),
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

    // DEBUG: Render Log
    console.log(`🎨 [Board Render] Notes: ${notes.length}, Zoom: ${zoom}, Pan: ${panOffset.x},${panOffset.y}, Canvas: ${canvasRef.current ? 'Mounted' : 'Null'}`);

    const saveData = async () => {
        try {
            const updatedBoards = boards.map(b =>
                b.id === activeBoardId ? { ...b, notes, lastAccessed: Date.now() } : b
            );
            // @ts-ignore
            await window.ipcRenderer.invoke('save-boards', {
                boards: updatedBoards,
                activeBoardId
            });

            // Update preview screenshot after saving
            capturePreviewScreenshot();
        } catch (e) {
            console.error('Failed to save boards:', e);
        }
    };

    // Save global settings when they change
    useEffect(() => {
        if (boards.length > 0) {
            saveData();
        }
    }, [boards]);

    const handleWheel = useCallback((e: WheelEvent) => {
        // Check if the scroll is happening inside a note - if so, don't pan the board
        const target = e.target as HTMLElement;
        const isInsideNote = target.closest('[data-note-container]');

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
        } else if (!isInsideNote) {
            // Only pan if not scrolling inside a note
            setPanOffset(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
        // If inside a note, let the default scroll behavior happen
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
                // Calculate the canvas-space position, then subtract the offset
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

    // Helper to convert markdown-like formatting to HTML
    const convertMarkdownToHtml = (text: string): string => {
        // Convert **text** to <b>text</b>
        let html = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        // Convert *text* to <i>text</i>
        html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');
        // Make the first line a heading (larger/bolder)
        const lines = html.split('\n');
        if (lines.length > 0 && lines[0].trim()) {
            lines[0] = `<div style="font-size: 1.25em; font-weight: bold; margin-bottom: 8px;">${lines[0]}</div>`;
        }
        return lines.join('\n');
    };

    // Handler for AI-generated notes
    const addAIGeneratedNote = (content: string, type: 'text' | 'list') => {
        const processedContent = type === 'text' ? convertMarkdownToHtml(content) : content;
        const newNote: StickyNote = {
            id: generateId(),
            type: type,
            x: -panOffset.x / zoom + 100,
            y: -panOffset.y / zoom + 100,
            width: 300,
            height: 260,
            content: type === 'text' ? processedContent : '',
            color: noteConfig.color,
            paperStyle: noteConfig.paperStyle,
            attachmentStyle: noteConfig.attachmentStyle,
            font: currentFont as any,
            fontSize: 16,
            listItems: type === 'list'
                ? content.split('\n').filter(line => line.trim()).map(line => ({
                    id: generateId(),
                    text: line.replace(/^[-•*\[\]☐☑\d.)]\s*/, '').replace(/\*\*/g, '').trim(),
                    checked: line.includes('☑') || line.includes('[x]')
                }))
                : undefined
        };
        setNotes(prev => [...prev, newNote]);
        setSelectedNoteId(newNote.id);
    };

    // Handler for adding dictionary definitions as notes
    const addDictionaryNote = (word: string, partOfSpeech: string, definitions: { definition: string; example?: string }[]) => {
        const content = `<div style="font-size: 1.25em; font-weight: bold; margin-bottom: 8px;">${word} <span style="font-size: 0.75em; color: #9333ea; text-transform: uppercase;">(${partOfSpeech})</span></div>\n` +
            definitions.slice(0, 3).map((def, i) =>
                `<b>${i + 1}.</b> ${def.definition}${def.example ? `\n<i>"${def.example}"</i>` : ''}`
            ).join('\n\n');

        const newNote: StickyNote = {
            id: generateId(),
            type: 'text',
            x: -panOffset.x / zoom + 100,
            y: -panOffset.y / zoom + 100,
            width: 300,
            height: 220,
            content: content,
            color: '#E6F3FF', // Light blue for dictionary notes
            paperStyle: 'smooth',
            attachmentStyle: 'tape-blue',
            font: currentFont as any,
            fontSize: 14,
        };
        setNotes(prev => [...prev, newNote]);
        setSelectedNoteId(newNote.id);
    };

    const addNewBoard = () => {
        // Prevent double creation from React StrictMode
        if (isCreatingBoardRef.current) {
            console.log('📝 [Board] Already creating a board, skipping...');
            return;
        }

        console.log('📝 [Board] Creating new board...');
        isCreatingBoardRef.current = true;

        // Generate the new board ID upfront so we can track it
        const newBoardId = generateId();
        pendingNewBoardRef.current = newBoardId;

        // Clear the localStorage flag (set by Dashboard)
        localStorage.removeItem('pendingNewBoardCreation');

        // Clear any pending navigation ref
        navigatedBoardIdRef.current = null;
        // Reset centering for new board
        hasCenteredRef.current = null;
        // Clear notes immediately to prevent flash
        setNotes([]);

        // Use functional update to ensure we have the latest boards state
        setBoards(prevBoards => {
            // Check if this board was already added (StrictMode double call)
            if (prevBoards.some(b => b.id === newBoardId)) {
                console.log('📝 [Board] Board already exists, skipping duplicate:', newBoardId);
                return prevBoards;
            }

            // Find the next available board number by checking existing names
            let nextNumber = 1;
            const existingNumbers = prevBoards
                .map(b => {
                    const match = b.name.match(/^Board (\d+)$/);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(n => n > 0);

            while (existingNumbers.includes(nextNumber)) {
                nextNumber++;
            }

            const newBoard: Board = {
                id: newBoardId,
                name: `Board ${nextNumber}`,
                color: BOARD_COLORS[prevBoards.length % BOARD_COLORS.length],
                notes: []
            };

            console.log('📝 [Board] Created board:', newBoard.name, newBoard.id, '(existing:', existingNumbers, ')');

            return [...prevBoards, newBoard];
        });

        // Set the new board as active
        setActiveBoardId(newBoardId);

        // Reset the creating flag after a short delay
        setTimeout(() => {
            isCreatingBoardRef.current = false;
            pendingNewBoardRef.current = null;
        }, 100);
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
        if (e.button !== 0) return;
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

        // Handle paste on the board canvas - creates new notes
        const handlePaste = (e: ClipboardEvent) => {
            // Don't intercept if user is typing in a note (contentEditable or input)
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.getAttribute('contenteditable') === 'true' ||
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA'
            )) {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            // Calculate center of current view
            const rect = canvasRef.current?.getBoundingClientRect();
            const centerX = rect ? (-panOffset.x + rect.width / 2) / zoom : 200;
            const centerY = rect ? (-panOffset.y + rect.height / 2) / zoom : 200;

            // Check for images first
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const base64 = event.target?.result as string;

                            // Create an Image to get dimensions
                            const img = new Image();
                            img.onload = () => {
                                const maxSize = 350;
                                let width = img.naturalWidth;
                                let height = img.naturalHeight;

                                // Scale down if too large, maintaining aspect ratio
                                if (width > maxSize || height > maxSize) {
                                    if (width > height) {
                                        height = (height / width) * maxSize;
                                        width = maxSize;
                                    } else {
                                        width = (width / height) * maxSize;
                                        height = maxSize;
                                    }
                                }

                                // Add padding for the note chrome
                                const noteWidth = Math.max(150, width + 20);
                                const noteHeight = Math.max(100, height + 20);

                                const newNote: StickyNote = {
                                    id: generateId(),
                                    type: 'image',
                                    x: centerX - noteWidth / 2,
                                    y: centerY - noteHeight / 2,
                                    width: noteWidth,
                                    height: noteHeight,
                                    content: '',
                                    color: COLORS[0].value,
                                    paperStyle: 'smooth',
                                    attachmentStyle: 'tape-orange',
                                    font: 'modern',
                                    fontSize: 16,
                                    imageUrl: base64
                                };
                                setNotes(prev => [...prev, newNote]);
                                setSelectedNoteId(newNote.id);
                            };
                            img.src = base64;
                        };
                        reader.readAsDataURL(file);
                    }
                    return;
                }
            }

            // Check for text
            const text = e.clipboardData?.getData('text/plain');
            if (text && text.trim()) {
                e.preventDefault();
                const newNote: StickyNote = {
                    id: generateId(),
                    type: 'text',
                    x: centerX - 125,
                    y: centerY - 100,
                    width: 250,
                    height: 200,
                    content: text,
                    color: noteConfig.color,
                    paperStyle: noteConfig.paperStyle,
                    attachmentStyle: noteConfig.attachmentStyle,
                    font: currentFont as any,
                    fontSize: 16
                };
                setNotes(prev => [...prev, newNote]);
                setSelectedNoteId(newNote.id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('paste', handlePaste);
        };
    }, [selectedNoteId, panOffset, zoom, noteConfig, currentFont]);

    const getBackgroundStyle = () => {
        const isDarkMode = document.documentElement.classList.contains('dark');

        if (currentBackground.pattern === 'grid') {
            return {
                backgroundImage: isDarkMode
                    ? 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)'
                    : 'linear-gradient(rgba(100, 100, 100, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(100, 100, 100, 0.15) 1px, transparent 1px)',
                backgroundSize: '30px 30px'
            };
        } else if (currentBackground.pattern === 'dots') {
            return {
                backgroundImage: isDarkMode
                    ? 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 2px, transparent 2px)'
                    : 'radial-gradient(circle, rgba(100, 100, 100, 0.2) 2px, transparent 2px)',
                backgroundSize: '25px 25px'
            };
        } else if (currentBackground.pattern === 'cork') {
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
        } else if (currentBackground.pattern === 'linen') {
            return {
                backgroundImage: isDarkMode
                    ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,.06) 2px, rgba(255,255,255,.06) 4px)'
                    : 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,.03) 2px, rgba(0,0,0,.03) 4px)',
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
            <div className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 relative z-10 rounded-t-3xl">
                <input
                    value={activeBoard?.name || ''}
                    onChange={(e) => setBoards(prev => prev.map(b =>
                        b.id === activeBoardId ? { ...b, name: e.target.value } : b
                    ))}
                    className="text-2xl font-bold bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-100"
                />

                <motion.button
                    onClick={() => setShowBoardSidebar(true)}
                    className="bg-[var(--accent-primary)] text-white p-3 rounded-full shadow-lg hover:opacity-90 transition-opacity"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <Folder className="w-6 h-6" />
                </motion.button>
            </div>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className={clsx(
                    "flex-1 relative overflow-hidden rounded-b-3xl mb-2 mx-0",
                    currentBackground.value,
                    isPanning && "cursor-grabbing"
                )}
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
                                onMouseDown={(e: any) => handleNoteMouseDown(e, note.id)}
                                onResizeStart={(e: any) => handleResizeStart(e, note.id)}
                                onDelete={() => deleteNote(note.id)}
                            />
                        ) : (
                            <StickyNoteComponent
                                key={note.id}
                                note={note}
                                isSelected={selectedNoteId === note.id}
                                onMouseDown={(e: any) => handleNoteMouseDown(e, note.id)}
                                onResizeStart={(e: any) => handleResizeStart(e, note.id)}
                                onDelete={() => deleteNote(note.id)}
                                onChange={(updates: any) => setNotes(prev => prev.map(n =>
                                    n.id === note.id ? { ...n, ...updates } : n
                                ))}
                                onContextMenu={(e: any) => {
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
                    value={currentFont}
                    onChange={(e) => setBoards(prev => prev.map(b =>
                        b.id === activeBoardId ? { ...b, font: e.target.value } : b
                    ))}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 border-none focus:outline-none cursor-pointer"
                >
                    {FONTS.map(font => (
                        <option key={font.value} value={font.value}>{font.name}</option>
                    ))}
                </select>

                {/* Background Selector */}
                <select
                    value={BACKGROUNDS.findIndex(b => b.name === currentBackground.name)}
                    onChange={(e) => setBoards(prev => prev.map(b =>
                        b.id === activeBoardId ? { ...b, background: BACKGROUNDS[parseInt(e.target.value)] } : b
                    ))}
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
                            className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-700 shadow-2xl z-50 overflow-y-auto"
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
                                    className="w-12 h-12 mb-4 bg-[var(--accent-primary)]/80 text-gray-800 dark:text-white rounded-full font-medium hover:bg-[var(--accent-primary)] hover:scale-105 transition-all shadow-md flex items-center justify-center text-2xl"
                                >
                                    +
                                </button>

                                <div className="space-y-3">
                                    {boards
                                        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
                                        .map(board => (
                                            <BoardCard
                                                key={board.id}
                                                board={board}
                                                isActive={board.id === activeBoardId}
                                                onClick={() => {
                                                    // Clear navigation ref since user is manually switching
                                                    navigatedBoardIdRef.current = null;
                                                    setBoards(prev => prev.map(b =>
                                                        b.id === board.id ? { ...b, lastAccessed: Date.now() } : b
                                                    ));
                                                    setActiveBoardId(board.id);
                                                    setNotes(board.notes);
                                                    setShowBoardSidebar(false);
                                                }}
                                                onColorChange={(color: any) => setBoards(prev => prev.map(b =>
                                                    b.id === board.id ? { ...b, color } : b
                                                ))}
                                                onNameChange={(name: any) => setBoards(prev => prev.map(b =>
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
                    onSelectNote={(id: any) => {
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
                            {/* Custom color picker */}
                            <label
                                className="w-full aspect-square rounded-full hover:scale-110 transition-transform border border-gray-300 dark:border-gray-600 cursor-pointer flex items-center justify-center bg-gray-100 dark:bg-gray-700"
                                title="Custom Color"
                            >
                                <Pipette className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <input
                                    type="color"
                                    value={notes.find(n => n.id === contextMenu.noteId)?.color || '#FFF8DC'}
                                    onChange={(e) => {
                                        setNotes(prev => prev.map(n => n.id === contextMenu.noteId ? { ...n, color: e.target.value } : n));
                                    }}
                                    className="opacity-0 absolute w-0 h-0"
                                />
                            </label>
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
                        className="w-full px-2 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                    >
                        Delete Note
                    </button>
                </div>
            )}

            {showDictionary && <DictionaryModal onClose={() => setShowDictionary(false)} onAddDefinition={addDictionaryNote} />}
            {showAIDraft && <AIDraftModal onClose={() => setShowAIDraft(false)} onCreateNote={addAIGeneratedNote} />}
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
                "relative w-full h-48 cursor-pointer group transition-all mb-6 overflow-visible",
                isActive && "scale-105",
                !isActive && "opacity-70"
            )}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Back Layer (Folder Body + Tab) */}
            <div
                className="absolute inset-0 top-3 rounded-2xl rounded-tl-none transition-colors shadow-sm border-0"
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
                initial={{ top: '1.5rem', bottom: '1rem', scale: 0.95, opacity: 0 }}
                animate={{
                    top: isHovered ? '0.5rem' : '1.5rem',
                    bottom: '1rem',
                    scale: isHovered ? 1 : 0.95,
                    opacity: isHovered ? 1 : 0
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
            <div className="absolute inset-x-0 bottom-0 z-20 overflow-visible" style={{ height: isHovered ? '45%' : '75%', transition: 'height 0.3s' }}>
                {/* Background with trapezoid shape - slightly wider than container */}
                <motion.div
                    className="absolute shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)]"
                    style={{
                        backgroundColor: board.color,
                        top: 0,
                        bottom: 0,
                        left: '-5%',
                        right: '-5%',
                        borderRadius: '1rem',
                    }}
                    animate={{
                        clipPath: isHovered
                            ? 'polygon(0% 0%, 100% 0%, 92% 92%, 8% 92%)'
                            : 'polygon(4.5% 0%, 95.5% 0%, 91% 92%, 9% 92%)'
                    }}
                    transition={{ duration: 0.3 }}
                />

                {/* Content layer (stays normal) */}
                <div className="relative z-10 h-full flex flex-col justify-end p-5 rounded-b-2xl">
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
                        <p className="text-sm text-gray-700 font-medium opacity-80">
                            {board.notes.length} notes
                        </p>
                    </div>
                </div>
            </div>


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
                            {/* Custom color picker */}
                            <label
                                className={clsx(
                                    "w-6 h-6 rounded-full transition-transform hover:scale-110 border border-gray-300 dark:border-gray-600 cursor-pointer flex items-center justify-center bg-gray-100 dark:bg-gray-700",
                                    !BOARD_COLORS.includes(board.color) && "ring-2 ring-offset-1 ring-gray-400"
                                )}
                                title="Custom Color"
                            >
                                <Pipette className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                <input
                                    type="color"
                                    value={board.color}
                                    onChange={(e) => {
                                        onColorChange(e.target.value);
                                    }}
                                    className="opacity-0 absolute w-0 h-0"
                                />
                            </label>
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



function StickyNoteComponent({ note, isSelected, onMouseDown, onResizeStart, onDelete, onChange, onContextMenu }: any) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentEditableRef = useRef<HTMLDivElement>(null);

    // Set initial content only once when mounted or when note.id changes
    useEffect(() => {
        if (contentEditableRef.current && note.type === 'text') {
            // Only set if the content is different (initial load or switching notes)
            if (contentEditableRef.current.innerHTML !== note.content) {
                contentEditableRef.current.innerHTML = note.content || '';
            }
        }
    }, [note.id]); // Only run when note ID changes, not content

    // Handle text formatting shortcuts
    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Stop propagation for all keys to prevent parent handlers from interfering
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    document.execCommand('bold', false);
                    break;
                case 'i':
                    e.preventDefault();
                    document.execCommand('italic', false);
                    break;
                case 'u':
                    e.preventDefault();
                    document.execCommand('underline', false);
                    break;
            }
        }
    };

    // Sync content changes from contentEditable - only on blur to avoid cursor jumping
    const handleContentChange = () => {
        if (contentEditableRef.current) {
            onChange({ content: contentEditableRef.current.innerHTML });
        }
    };


    // Handle paste - supports images and text
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        // Check for images first
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        // Insert image at cursor position
                        document.execCommand('insertHTML', false, `<img src="${base64}" style="max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px;" />`);
                        handleContentChange();
                    };
                    reader.readAsDataURL(file);
                }
                return;
            }
        }

        // For text, let it paste normally but sync after
        setTimeout(handleContentChange, 0);
    };


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
            case 'modern': return "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
            case 'serif': return "'Playfair Display', 'Georgia', 'Times New Roman', serif";
            case 'handwritten': return "'Architects Daughter', 'Comic Sans MS', cursive";
            case 'script': return "'Architects Daughter', 'Brush Script MT', cursive";
            default: return "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
        }
    };

    const getPaperCSS = () => {
        const isLined = note.paperStyle === 'lined';
        const isGrid = note.paperStyle === 'grid';
        return {
            backgroundImage: isLined
                ? `linear-gradient(to right, transparent 0, transparent 29px, rgba(231, 76, 60, 0.4) 29px, rgba(231, 76, 60, 0.4) 31px, transparent 31px),
                   repeating-linear-gradient(to bottom, transparent 0, transparent 22px, #d1d5db 22px, #d1d5db 24px)`
                : isGrid
                    ? 'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)'
                    : 'none',
            backgroundSize: isGrid ? '20px 20px' : 'auto',
            backgroundPosition: isLined ? '0 4px' : '0 0',
        };
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;

                // Create an Image to get dimensions and resize note
                const img = new Image();
                img.onload = () => {
                    const maxSize = 350;
                    let width = img.naturalWidth;
                    let height = img.naturalHeight;

                    // Scale down if too large, maintaining aspect ratio
                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = (height / width) * maxSize;
                            width = maxSize;
                        } else {
                            width = (width / height) * maxSize;
                            height = maxSize;
                        }
                    }

                    // Add padding for the note chrome
                    const noteWidth = Math.max(150, width + 20);
                    const noteHeight = Math.max(100, height + 20);

                    onChange({
                        imageUrl: base64,
                        width: noteWidth,
                        height: noteHeight,
                        attachmentStyle: 'tape-orange'
                    });
                };
                img.src = base64;
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
                "rounded-lg shadow-lg transition-shadow duration-150 group",
                isSelected && "ring-4 ring-[var(--accent-primary)] shadow-2xl"
            )}
            data-note-container="true"
            onWheel={(e) => e.stopPropagation()}
        >
            {/* Attachment (tape/pin) - needs to be above the note content */}
            <div className="absolute top-0 left-0 w-full pointer-events-none" style={{ zIndex: 10 }}>
                {getAttachmentStyle()}
            </div>

            {/* Drag Handle Bar - appears on hover */}
            <div
                className="absolute top-0 left-0 right-0 h-6 cursor-move z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"
                style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
                onMouseDown={onMouseDown}
            >
                <div className="flex gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-black/30" />
                    <div className="w-1 h-1 rounded-full bg-black/30" />
                    <div className="w-1 h-1 rounded-full bg-black/30" />
                    <div className="w-1 h-1 rounded-full bg-black/30" />
                    <div className="w-1 h-1 rounded-full bg-black/30" />
                    <div className="w-1 h-1 rounded-full bg-black/30" />
                </div>
            </div>

            {/* Menu Settings Button */}
            <button
                className="absolute top-2 left-2 p-2 rounded-lg bg-black/30 text-white hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all z-30 shadow-md backdrop-blur-sm"
                onClick={(e) => {
                    e.stopPropagation();
                    onContextMenu(e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="Note Settings"
            >
                <Pencil className="w-4 h-4" />
            </button>


            <div
                className={clsx(
                    "w-full h-full rounded-lg relative",
                    note.type === 'text' ? 'p-0 overflow-hidden' : 'p-4 overflow-auto custom-scrollbar'
                )}
                style={{
                    backgroundColor: note.color,
                    ...(note.type !== 'text' ? getPaperCSS() : {}),
                    ...(note.type !== 'text' ? {
                        paddingLeft: note.paperStyle === 'lined' ? '45px' : '16px',
                        paddingTop: note.paperStyle === 'lined' ? '32px' : '16px'
                    } : {})
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
                                        "flex-1 bg-transparent border-none focus:outline-none text-gray-800",
                                        item.checked && "line-through opacity-50"
                                    )}
                                    style={{ fontFamily: getFontFamily(), fontSize: `${note.fontSize}px` }}
                                    placeholder="List item..."
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
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
                            className="w-full px-3 py-2 bg-white/50 rounded border border-gray-300 focus:outline-none text-gray-800 placeholder-gray-500"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                        {note.linkUrl && (
                            <button
                                className="text-blue-700 hover:underline text-sm flex items-center gap-1 font-medium"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // @ts-ignore
                                    window.ipcRenderer?.invoke('open-external', note.linkUrl);
                                }}
                            >
                                <LinkIcon className="w-3 h-3" />
                                Open Link
                            </button>
                        )}
                        <textarea
                            value={note.content}
                            onChange={(e) => onChange({ content: e.target.value })}
                            className="w-full h-32 bg-transparent border-none focus:outline-none resize-none text-gray-800"
                            style={{ fontFamily: getFontFamily(), fontSize: `${note.fontSize}px` }}
                            placeholder="Add notes about this link..."
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : note.type === 'audio' ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <Mic className="w-12 h-12 text-gray-400" />
                        <p className="text-sm text-gray-500">Audio recording coming soon</p>
                    </div>
                ) : (
                    <div
                        ref={contentEditableRef}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        className="w-full h-full bg-transparent border-none focus:outline-none text-gray-800 overflow-auto custom-scrollbar"
                        style={{
                            fontFamily: getFontFamily(),
                            fontSize: `${note.fontSize}px`,
                            lineHeight: note.paperStyle === 'lined' ? '24px' : '1.5',
                            ...getPaperCSS(),
                            paddingLeft: note.paperStyle === 'lined' ? '45px' : '16px',
                            paddingTop: note.paperStyle === 'lined' ? '28px' : '16px',
                            backgroundAttachment: 'local',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        data-placeholder="Type here..."
                    />
                )}
            </div>

            {/* Delete and Resize controls - show on hover */}
            <motion.button
                onClick={onDelete}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute -top-3 -right-3 bg-red-400/80 text-white rounded-full p-2 shadow-md hover:bg-red-500/90 transition-all opacity-0 group-hover:opacity-100 z-30"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <X className="w-4 h-4" />
            </motion.button>

            <motion.div
                onMouseDown={onResizeStart}
                className="absolute -bottom-3 -right-3 bg-[var(--accent-primary)] text-white rounded-full p-2 shadow-lg cursor-nwse-resize hover:opacity-90 transition-all opacity-0 group-hover:opacity-100 z-30"
                whileHover={{ scale: 1.1 }}
            >
                <div className="w-4 h-4 flex items-center justify-center">⤡</div>
            </motion.div>
        </div>
    );
}

// Minimum dimensions for calculator to maintain usability
const CALCULATOR_MIN_WIDTH = 220;
const CALCULATOR_MIN_HEIGHT = 320;

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

    // Enforce minimum dimensions - if too small, lock to minimum
    const effectiveWidth = Math.max(note.width, CALCULATOR_MIN_WIDTH);
    const effectiveHeight = Math.max(note.height, CALCULATOR_MIN_HEIGHT);

    return (
        <motion.div
            style={{
                position: 'absolute',
                left: note.x,
                top: note.y,
                width: effectiveWidth,
                height: effectiveHeight,
                minWidth: CALCULATOR_MIN_WIDTH,
                minHeight: CALCULATOR_MIN_HEIGHT,
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
                <div className="mb-4 flex-shrink-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400 h-6 overflow-hidden truncate">{equation || ' '}</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-right truncate">{display}</div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 flex-1 min-h-0">
                    {['C', '(', ')', '/'].map(btn => (
                        <button key={btn} onClick={() => handleInput(btn)} className="py-2 bg-gray-200 dark:bg-gray-600 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm">{btn}</button>
                    ))}
                    {['7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+'].map(btn => (
                        <button key={btn} onClick={() => handleInput(btn)} className={clsx("py-2 rounded-lg font-medium transition-colors text-sm", /\d/.test(btn) ? "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200" : "bg-purple-500 text-white hover:bg-purple-600")}>{btn}</button>
                    ))}
                    <button onClick={() => handleInput('0')} className="col-span-2 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">0</button>
                    <button onClick={() => handleInput('.')} className="py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">.</button>
                    <button onClick={() => handleInput('=')} className="py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors text-sm">=</button>
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

// Helper function to strip HTML tags from content
function stripHtmlTags(html: string): string {
    if (!html) return '';
    // Create a temporary element to parse HTML and extract text
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// Helper function to get searchable text from a note
function getSearchableText(note: StickyNote): string {
    const parts: string[] = [];

    // Add main content (strip HTML for text notes)
    if (note.content) {
        parts.push(stripHtmlTags(note.content));
    }

    // Add list items for checklist notes
    if (note.type === 'list' && note.listItems) {
        note.listItems.forEach(item => {
            if (item.text) {
                parts.push(item.text);
            }
        });
    }

    // Add link URL if present
    if (note.linkUrl) {
        parts.push(note.linkUrl);
    }

    return parts.join(' ').toLowerCase();
}

// Helper function to get display text for a note
function getNoteDisplayText(note: StickyNote): string {
    if (note.type === 'list' && note.listItems && note.listItems.length > 0) {
        // For checklists, show the items as a preview
        return note.listItems.map(item => `${item.checked ? '☑' : '☐'} ${item.text}`).slice(0, 3).join(', ') + (note.listItems.length > 3 ? '...' : '');
    }
    if (note.type === 'image') {
        return '[Image Note]';
    }
    if (note.type === 'link') {
        return note.linkUrl || stripHtmlTags(note.content) || '[Link Note]';
    }
    if (note.type === 'calculator') {
        return '[Calculator]';
    }
    // For text notes, strip HTML tags
    return stripHtmlTags(note.content) || 'Empty note';
}

function SearchModal({ onClose, notes, onSelectNote }: any) {
    const [query, setQuery] = useState('');
    const queryLower = query.toLowerCase();
    const filtered = notes.filter((n: StickyNote) => getSearchableText(n).includes(queryLower));

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
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{getNoteDisplayText(note)}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

interface DictionaryResult {
    word: string;
    phonetic?: string;
    phonetics?: { text?: string; audio?: string }[];
    meanings: {
        partOfSpeech: string;
        definitions: {
            definition: string;
            example?: string;
            synonyms?: string[];
        }[];
    }[];
}

interface DictionaryModalProps {
    onClose: () => void;
    onAddDefinition: (word: string, partOfSpeech: string, definitions: { definition: string; example?: string }[]) => void;
}

function DictionaryModal({ onClose, onAddDefinition }: DictionaryModalProps) {
    const [word, setWord] = useState('');
    const [result, setResult] = useState<DictionaryResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchWord = async () => {
        if (!word.trim()) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // Using Free Dictionary API - no external dependencies, works in sandboxed apps
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`);

            if (!response.ok) {
                if (response.status === 404) {
                    setError(`No definition found for "${word}". Try checking the spelling.`);
                } else {
                    setError('Failed to fetch definition. Please try again.');
                }
                return;
            }

            const data = await response.json();
            if (data && data.length > 0) {
                setResult(data[0]);
            } else {
                setError('No definition found.');
            }
        } catch (err) {
            setError('Dictionary service unavailable. This may be a network issue - please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            searchWord();
        }
    };

    const handleAddMeaning = (meaning: DictionaryResult['meanings'][0]) => {
        if (result) {
            onAddDefinition(result.word, meaning.partOfSpeech, meaning.definitions);
            onClose();
        }
    };

    return (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
            <motion.div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col" initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-purple-500" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Dictionary</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
                </div>

                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter a word..."
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                    />
                    <button
                        onClick={searchWord}
                        disabled={isLoading || !word.trim()}
                        className="px-4 py-2.5 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Search className="w-4 h-4" />
                        )}
                        Search
                    </button>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm mb-4">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="mb-4">
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result.word}</h3>
                            {result.phonetic && (
                                <p className="text-gray-500 dark:text-gray-400 italic">{result.phonetic}</p>
                            )}
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Click a meaning to add it to your board:</p>

                        <div className="space-y-4">
                            {result.meanings.map((meaning, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleAddMeaning(meaning)}
                                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 border-2 border-transparent transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                                            {meaning.partOfSpeech}
                                        </p>
                                        <span className="text-xs text-gray-400 group-hover:text-purple-500 transition-colors">Click to add →</span>
                                    </div>
                                    <ol className="space-y-2">
                                        {meaning.definitions.slice(0, 3).map((def, defIdx) => (
                                            <li key={defIdx} className="text-sm text-gray-700 dark:text-gray-300">
                                                <span className="font-medium">{defIdx + 1}.</span> {def.definition}
                                                {def.example && (
                                                    <p className="text-gray-500 dark:text-gray-400 italic mt-1 ml-4">
                                                        "{def.example}"
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!result && !error && !isLoading && (
                    <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                        <div className="text-center">
                            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Enter a word to look up its definition</p>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

interface AIDraftModalProps {
    onClose: () => void;
    onCreateNote: (content: string, type: 'text' | 'list') => void;
}

function AIDraftModal({ onClose, onCreateNote }: AIDraftModalProps) {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [noteType, setNoteType] = useState<'text' | 'list'>('text');

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setError(null);
        setGeneratedContent(null);

        try {
            // @ts-ignore
            const result = await window.ipcRenderer?.invoke('generate-ai-note-content', prompt, noteType);

            if (result?.error === 'API_KEY_MISSING') {
                setError('Please configure your AI API key in Settings → AI Configuration.');
                return;
            }

            if (result?.error) {
                const errorMsg = result.message || 'Failed to generate content. Please check your API key and try again.';
                if (errorMsg.includes('region') || errorMsg.includes('location')) {
                    setError('This AI service is not available in your region. Please switch to Perplexity in Settings.');
                } else {
                    setError(errorMsg);
                }
                return;
            }

            if (result?.content) {
                setGeneratedContent(result.content);
            } else {
                setError('AI failed to generate content. Please try rephrasing your request.');
            }
        } catch (err: any) {
            console.error('AI Draft error:', err);
            setError('An error occurred. Please check your API key and internet connection.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreateNote = () => {
        if (generatedContent) {
            onCreateNote(generatedContent, noteType);
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    return (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
            <motion.div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col" initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">AI Draft</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {!generatedContent ? (
                    <>
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm mb-4">
                                {error}
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Note Type</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setNoteType('text')}
                                    className={clsx(
                                        "flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                                        noteType === 'text' ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                    )}
                                >
                                    <MessageSquare className="w-4 h-4" /> Text
                                </button>
                                <button
                                    onClick={() => setNoteType('list')}
                                    className={clsx(
                                        "flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                                        noteType === 'list' ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                    )}
                                >
                                    <List className="w-4 h-4" /> Checklist
                                </button>
                            </div>
                        </div>

                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={noteType === 'list' ? "e.g., 'Create a packing list for a beach vacation'" : "e.g., 'Write a meeting summary about project updates'"}
                            className="w-full h-32 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mb-4"
                            autoFocus
                        />

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Generate
                                </>
                            )}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto mb-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2">
                                    Generated {noteType === 'list' ? 'Checklist' : 'Note'}
                                </p>
                                <div
                                    className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap ai-preview-content"
                                    dangerouslySetInnerHTML={{
                                        __html: noteType === 'text'
                                            ? generatedContent
                                                .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
                                                .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>')
                                                .split('\n')
                                                .map((line, i) => i === 0 && line.trim()
                                                    ? `<div style="font-size: 1.15em; font-weight: bold; margin-bottom: 6px;">${line}</div>`
                                                    : line)
                                                .join('\n')
                                            : generatedContent
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setGeneratedContent(null);
                                    setPrompt('');
                                }}
                                className="flex-1 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={handleCreateNote}
                                className="flex-1 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Create Note
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}
