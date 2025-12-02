import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { Note } from '../App';

interface AiQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (note: Note, date: Date) => void;
}

export function AiQuickAddModal({ isOpen, onClose, onSave }: AiQuickAddModalProps) {
    const [aiInput, setAiInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiProposedNote, setAiProposedNote] = useState<{ note: Note, date: Date, options: string[] } | null>(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

    const handleAiSubmit = async () => {
        if (!aiInput.trim()) return;

        setIsAiProcessing(true);
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('parse-natural-language-note', aiInput);
            
            if (result) {
                const { title, description, time, importance, date, options } = result;
                
                // Parse date from result (assuming ISO string or similar)
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
            setAiInput('');
            setAiProposedNote(null);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-white/60 dark:border-gray-700"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-blue-500" />
                                AI Quick Add
                            </h3>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>

                        {!aiProposedNote ? (
                            <div className="space-y-4">
                                <textarea
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                    placeholder="e.g., 'Meeting with team next Monday at 10am'"
                                    className="w-full h-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                />
                                <button
                                    onClick={handleAiSubmit}
                                    disabled={!aiInput.trim() || isAiProcessing}
                                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAiProcessing ? 'Processing...' : 'Generate Event'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <div className="flex flex-col gap-3 mb-4">
                                        <input 
                                            type="text" 
                                            value={aiProposedNote.note.title}
                                            onChange={(e) => setAiProposedNote({
                                                ...aiProposedNote,
                                                note: { ...aiProposedNote.note, title: e.target.value }
                                            })}
                                            className="font-bold text-blue-900 dark:text-blue-100 text-lg bg-transparent border-b border-blue-200 dark:border-blue-700 focus:border-blue-500 focus:outline-none px-1 w-full"
                                            placeholder="Event Title"
                                        />
                                        
                                        <div className="flex gap-2 flex-wrap">
                                            <input 
                                                type="date"
                                                value={format(aiProposedNote.date, 'yyyy-MM-dd')}
                                                onChange={(e) => {
                                                    if (!e.target.value) return;
                                                    const newDate = parseISO(e.target.value);
                                                    setAiProposedNote({
                                                        ...aiProposedNote,
                                                        date: newDate
                                                    });
                                                }}
                                                className="bg-white/50 dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1 text-sm text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <input 
                                                type="time"
                                                value={aiProposedNote.note.time}
                                                onChange={(e) => setAiProposedNote({
                                                    ...aiProposedNote,
                                                    note: { ...aiProposedNote.note, time: e.target.value }
                                                })}
                                                className="bg-white/50 dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1 text-sm text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <select
                                                value={aiProposedNote.note.importance}
                                                onChange={(e) => setAiProposedNote({
                                                    ...aiProposedNote,
                                                    note: { ...aiProposedNote.note, importance: e.target.value as any }
                                                })}
                                                className="bg-white/50 dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1 text-sm text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                <option value="low">Low Priority</option>
                                                <option value="medium">Medium Priority</option>
                                                <option value="high">High Priority</option>
                                                <option value="misc">Miscellaneous</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Select Base Description:</p>
                                        {aiProposedNote.options.map((option, idx) => (
                                            <div 
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedOptionIndex(idx);
                                                    setAiProposedNote({
                                                        ...aiProposedNote,
                                                        note: { ...aiProposedNote.note, description: option }
                                                    });
                                                }}
                                                className={clsx(
                                                    "p-3 rounded-lg border text-sm cursor-pointer transition-all",
                                                    selectedOptionIndex === idx
                                                        ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-100"
                                                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-200 dark:hover:border-blue-700"
                                                )}
                                            >
                                                {option}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setAiProposedNote(null)}
                                        className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={confirmAiNote}
                                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-500/30"
                                    >
                                        Confirm & Add
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
