import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, PenTool, FileText, Eraser, Download, Trash2, ArrowDownRight, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { Note } from '../App';

interface AiQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (note: Note, date: Date) => void;
    onSaveDrawing: (dataUrl: string) => void;
}

// Minimal Canvas Object for Quick Drawing
interface QuickCanvasObject {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
}

export function AiQuickAddModal({ isOpen, onClose, onSave, onSaveDrawing }: AiQuickAddModalProps) {
    const [mode, setMode] = useState<'note' | 'drawing'>('note');

    // AI Note State
    const [aiInput, setAiInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiProposedNote, setAiProposedNote] = useState<{ note: Note, date: Date, options: string[] } | null>(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

    // Quick Drawing State
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingObjects, setDrawingObjects] = useState<QuickCanvasObject[]>([]);
    const [drawColor, setDrawColor] = useState('#3B82F6');
    const [drawTool, setDrawTool] = useState<'pen' | 'eraser'>('pen');

    // --- AI Note Logic ---
    const handleAiSubmit = async () => {
        if (!aiInput.trim()) return;

        setIsAiProcessing(true);
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('parse-natural-language-note', aiInput);

            if (result) {
                const { title, description, time, importance, date, options } = result;
                const targetDate = date ? new Date(date) : new Date();

                const note: Note = {
                    id: Date.now().toString(),
                    title,
                    description: options && options.length > 0 ? options[0] : description,
                    time: time || '09:00',
                    importance: importance || 'misc'
                };

                setAiProposedNote({ note, date: targetDate, options: options || [description] });
                setSelectedOptionIndex(0);
            } else {
                console.error("AI failed to parse note");
            }
        } catch (error) {
            console.error("Error processing AI note:", error);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const confirmAiNote = () => {
        if (aiProposedNote) {
            onSave(aiProposedNote.note, aiProposedNote.date);
            resetAndClose();
        }
    };

    const resetAndClose = () => {
        setAiInput('');
        setAiProposedNote(null);
        setDrawingObjects([]);
        // Clear canvas
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, 800, 600);
        onClose();
    };

    // --- Quick Drawing Logic ---
    const startDrawing = (e: React.MouseEvent) => {
        if (drawTool === 'pen') {
            setIsDrawing(true);
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                const rect = canvasRef.current!.getBoundingClientRect();
                ctx.beginPath();
                ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                ctx.strokeStyle = drawColor;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
            }
        }
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        const rect = canvasRef.current.getBoundingClientRect();
        if (ctx) {
            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, 800, 600);
        setDrawingObjects([]);
    };

    const saveDrawingAsNote = () => {
        // Convert canvas + text objects to a data URL
        if (canvasRef.current) {
            // Composite text
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.font = '16px sans-serif';
                ctx.fillStyle = '#000';
                drawingObjects.forEach(obj => {
                    ctx.fillText(obj.text, obj.x, obj.y + 16); // basic render
                });
            }
            const dataUrl = canvasRef.current.toDataURL();

            // Save as drawing
            onSaveDrawing(dataUrl);
            resetAndClose();
        }
    };

    // Paste Logic for Drawing
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            if (mode !== 'drawing') return;
            // Only handle if text is pasted and target isn't an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            e.preventDefault();
            const text = e.clipboardData?.getData('text');
            if (text) {
                // "Sorted and filtered" - split by lines, remove empty
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                // Add objects staggered
                const newObjects = lines.map((line, i) => ({
                    id: Math.random().toString(36),
                    text: line,
                    x: 50 + (i * 20) % 300,
                    y: 50 + (i * 40),
                    color: '#000'
                }));

                setDrawingObjects(prev => [...prev, ...newObjects]);
            }
        };

        // We need to attach to window or document, but only when modal open
        if (isOpen) {
            document.addEventListener('paste', handlePaste);
        }
        return () => document.removeEventListener('paste', handlePaste);
    }, [isOpen, mode]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/60 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden"
                    >
                        {/* Header & Tabs */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 gap-1">
                                <button
                                    onClick={() => setMode('note')}
                                    className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", mode === 'note' ? "bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900")}
                                >
                                    <Sparkles className="w-4 h-4" /> Quick Note
                                </button>
                                <button
                                    onClick={() => setMode('drawing')}
                                    className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", mode === 'drawing' ? "bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900")}
                                >
                                    <PenTool className="w-4 h-4" /> Quick Drawing
                                </button>
                            </div>
                            <button onClick={resetAndClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {mode === 'note' ? (
                                !aiProposedNote ? (
                                    <div className="space-y-4">
                                        <textarea
                                            value={aiInput}
                                            onChange={(e) => setAiInput(e.target.value)}
                                            placeholder="e.g., 'Meeting with team next Monday at 10am'"
                                            className="w-full h-40 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-medium"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleAiSubmit}
                                            disabled={!aiInput.trim() || isAiProcessing}
                                            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                        >
                                            {isAiProcessing ? <Sparkles className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                            {isAiProcessing ? 'Processing AI...' : 'Generate Magic Event'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
                                            <div className="flex flex-col gap-4 mb-4">
                                                <input
                                                    type="text"
                                                    value={aiProposedNote.note.title}
                                                    onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, title: e.target.value } })}
                                                    className="font-bold text-blue-900 dark:text-blue-100 text-xl bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-500 focus:outline-none px-1 w-full transition-colors"
                                                    placeholder="Event Title"
                                                />
                                                <div className="flex gap-2 flex-wrap">
                                                    <input
                                                        type="date"
                                                        value={format(aiProposedNote.date, 'yyyy-MM-dd')}
                                                        onChange={(e) => {
                                                            if (!e.target.value) return;
                                                            setAiProposedNote({ ...aiProposedNote, date: parseISO(e.target.value) });
                                                        }}
                                                        className="bg-white/60 dark:bg-gray-800/60 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 text-sm text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                                    />
                                                    <input
                                                        type="time"
                                                        value={aiProposedNote.note.time}
                                                        onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, time: e.target.value } })}
                                                        className="bg-white/60 dark:bg-gray-800/60 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 text-sm text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                                    />
                                                    <select
                                                        value={aiProposedNote.note.importance}
                                                        onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, importance: e.target.value as any } })}
                                                        className="bg-white/60 dark:bg-gray-800/60 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 text-sm text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                                    >
                                                        <option value="low">Low Priority</option>
                                                        <option value="medium">Medium Priority</option>
                                                        <option value="high">High Priority</option>
                                                        <option value="misc">Miscellaneous</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Select Description Style:</p>
                                                {aiProposedNote.options.map((option, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            setSelectedOptionIndex(idx);
                                                            setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, description: option } });
                                                        }}
                                                        className={clsx(
                                                            "p-3 rounded-lg border text-sm cursor-pointer transition-all leading-relaxed",
                                                            selectedOptionIndex === idx
                                                                ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-500 text-blue-900 dark:text-blue-100 shadow-sm"
                                                                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-200 dark:hover:border-blue-700"
                                                        )}
                                                    >
                                                        {option}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setAiProposedNote(null)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold transition-all">
                                                Back
                                            </button>
                                            <button onClick={confirmAiNote} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                                                <Check className="w-5 h-5" /> Confirm & Add
                                            </button>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="h-full flex flex-col gap-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm text-gray-500 italic">
                                            Ctrl+V to paste & sort text chunks
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={clearCanvas} className="p-2 hover:bg-red-50 text-red-500 rounded-lg text-sm flex items-center gap-1"><Trash2 className="w-4 h-4" /> Clear</button>
                                            <button onClick={saveDrawingAsNote} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2"><Download className="w-4 h-4" /> Save to Notes</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-crosshair shadow-inner">
                                        <canvas
                                            ref={canvasRef}
                                            width={600}
                                            height={400}
                                            className="w-full h-full block touch-none"
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                        />
                                        {drawingObjects.map(obj => (
                                            <div
                                                key={obj.id}
                                                className="absolute bg-yellow-100 dark:bg-yellow-900/50 p-2 rounded shadow border border-yellow-200 dark:border-yellow-700 text-xs font-mono max-w-[200px] break-words pointer-events-none"
                                                style={{ left: obj.x, top: obj.y, color: obj.color }}
                                            >
                                                {obj.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
