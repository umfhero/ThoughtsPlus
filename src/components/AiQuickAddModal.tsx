import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { Note } from '../App';

interface AiQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (note: Note, date: Date) => void;
}

export function AiQuickAddModal({ isOpen, onClose, onSave }: AiQuickAddModalProps) {
    // AI Note State
    const [aiInput, setAiInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiProposedNote, setAiProposedNote] = useState<{ note: Note, date: Date, options: string[] } | null>(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

    // --- AI Note Logic ---
    const handleAiSubmit = async () => {
        if (!aiInput.trim()) return;

        setIsAiProcessing(true);
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('parse-natural-language-note', aiInput);

            if (result) {
                const { title, description, time, importance, date, descriptionOptions } = result;
                const targetDate = date ? new Date(date) : new Date();

                // Use descriptionOptions from backend, fallback to description or empty array
                let validOptions: string[] = [];
                if (descriptionOptions && Array.isArray(descriptionOptions) && descriptionOptions.length > 0) {
                    // Filter out empty options and use them
                    validOptions = descriptionOptions.filter((opt: string) => opt && opt.trim().length > 0);
                }
                
                // If no valid options, use description as fallback
                if (validOptions.length === 0 && description && description.trim()) {
                    validOptions = [description];
                }

                const note: Note = {
                    id: Date.now().toString(),
                    title,
                    description: validOptions.length > 0 ? validOptions[0] : '',
                    time: time || '09:00',
                    importance: importance || 'misc'
                };

                setAiProposedNote({ note, date: targetDate, options: validOptions });
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
        onClose();
    };

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
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <div className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
                                <Sparkles className="w-5 h-5 text-blue-600" /> AI Quick Note
                            </div>
                            <button onClick={resetAndClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {!aiProposedNote ? (
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
                                            {isAiProcessing ? 'Processing AI...' : 'Add Note'}
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
                                                {aiProposedNote.options && aiProposedNote.options.length > 0 && (
                                                    <>
                                                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">AI-Suggested Descriptions (click to select):</p>
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
                                                    </>
                                                )}
                                                
                                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 mt-4">Or write your own:</p>
                                                <textarea
                                                    value={aiProposedNote.note.description}
                                                    onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, description: e.target.value } })}
                                                    className="w-full h-24 bg-white/60 dark:bg-gray-800/60 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                    placeholder="Add or edit description..."
                                                />
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
                            }
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
