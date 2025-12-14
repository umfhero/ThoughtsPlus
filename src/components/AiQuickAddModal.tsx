import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X, Check, Repeat, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { Note } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface AiQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (note: Note, date: Date) => void;
}

export function AiQuickAddModal({ isOpen, onClose, onSave }: AiQuickAddModalProps) {
    const { accentColor } = useTheme();

    // AI Note State
    const [aiInput, setAiInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiProposedNote, setAiProposedNote] = useState<{ note: Note, date: Date, options: string[], recurrence?: any } | null>(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRecurring, setIsRecurring] = useState(false);
    const [generateDescriptions, setGenerateDescriptions] = useState(() => {
        const saved = localStorage.getItem('feature-toggles');
        if (saved) {
            const features = JSON.parse(saved);
            return features.aiDescriptions ?? true; // Default to true to match Settings
        }
        return true; // Default to true to match Settings
    });

    // Listen for feature toggle changes from Settings
    useEffect(() => {
        const handleFeatureToggleChange = (event: CustomEvent) => {
            const features = event.detail;
            if (features.aiDescriptions !== undefined) {
                setGenerateDescriptions(features.aiDescriptions);
            }
        };

        window.addEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);

        return () => {
            window.removeEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);
        };
    }, []);

    // Reload state from localStorage when modal opens
    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('feature-toggles');
            if (saved) {
                const features = JSON.parse(saved);
                if (features.aiDescriptions !== undefined) {
                    setGenerateDescriptions(features.aiDescriptions);
                }
            }
        }
    }, [isOpen]);

    // --- AI Note Logic ---
    const handleAiSubmit = async () => {
        if (!aiInput.trim()) return;

        setIsAiProcessing(true);
        setErrorMessage(null);
        try {
            // @ts-ignore
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 60000)
            );

            // @ts-ignore
            const resultPromise = window.ipcRenderer.invoke('parse-natural-language-note', aiInput, generateDescriptions);

            const result = await Promise.race([resultPromise, timeoutPromise]);

            if (result?.error === 'API_KEY_MISSING') {
                setErrorMessage('Please configure your Gemini API key in Settings to use AI features.');
                return;
            }

            if (result?.error) {
                setErrorMessage(result.message || 'Failed to generate note. Please check your API key and try again.');
                return;
            }

            if (result && result.title && result.date) {
                const { title, description, time, importance, date, descriptionOptions, recurrence } = result;
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
                    importance: importance || 'misc',
                    recurrence: recurrence || undefined
                };

                // Auto-detect if recurring
                if (recurrence) {
                    setIsRecurring(true);
                }

                setAiProposedNote({ note, date: targetDate, options: validOptions, recurrence });
                setSelectedOptionIndex(0);
            } else {
                setErrorMessage('AI failed to parse note. Please try rephrasing your request.');
            }
        } catch (error: any) {
            console.error("Error processing AI note:", error);
            if (error.message === 'Request timeout') {
                setErrorMessage('Request timed out. The AI service may be slow or unavailable. Please try again.');
            } else {
                setErrorMessage('An error occurred while generating the note. Please check your API key and internet connection.');
            }
        } finally {
            setIsAiProcessing(false);
        }
    };

    const confirmAiNote = async () => {
        console.log('🔵 confirmAiNote called');
        if (aiProposedNote) {
            console.log('🔵 aiProposedNote exists:', {
                title: aiProposedNote.note.title,
                hasRecurrence: !!aiProposedNote.note.recurrence,
                recurrenceType: aiProposedNote.note.recurrence?.type,
                recurrenceCount: aiProposedNote.note.recurrence?.count
            });

            try {
                console.log('🔵 Calling onSave...');
                await onSave(aiProposedNote.note, aiProposedNote.date);
                console.log('✅ onSave completed successfully');

                console.log('🔵 Calling resetAndClose...');
                resetAndClose();
                console.log('✅ resetAndClose completed');
            } catch (error) {
                console.error('❌ Error in confirmAiNote:', error);
            }
        } else {
            console.log('⚠️ No aiProposedNote to save');
        }
    };

    const resetAndClose = () => {
        setAiInput('');
        setAiProposedNote(null);
        setErrorMessage(null);
        setIsRecurring(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={resetAndClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/60 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
                        <Sparkles className="w-5 h-5" style={{ color: accentColor }} /> AI Quick Note
                    </div>
                    <button onClick={resetAndClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!aiProposedNote ? (
                        <div className="space-y-4">
                            {errorMessage && (
                                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                                    {errorMessage}
                                </div>
                            )}
                            <textarea
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                placeholder="e.g., 'Meeting with team next Monday at 10am'"
                                className="w-full h-40 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 resize-none font-medium"
                                style={{ '--tw-ring-color': `${accentColor}50` } as any}
                                autoFocus
                                spellCheck={true}
                            />

                            {/* AI Descriptions Toggle Switch */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" style={{ color: accentColor }} />
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">AI Note Descriptions</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Generate detailed descriptions (uses more tokens)</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        const newValue = !generateDescriptions;
                                        setGenerateDescriptions(newValue);

                                        // Update localStorage to sync with Settings
                                        const saved = localStorage.getItem('feature-toggles');
                                        const features = saved ? JSON.parse(saved) : {};
                                        features.aiDescriptions = newValue;
                                        localStorage.setItem('feature-toggles', JSON.stringify(features));

                                        // Dispatch event to notify other components
                                        window.dispatchEvent(new CustomEvent('feature-toggles-changed', { detail: features }));
                                    }}
                                    className="w-10 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none"
                                    style={{ backgroundColor: generateDescriptions ? accentColor : undefined }}
                                >
                                    <motion.div
                                        layout
                                        className={clsx(
                                            "w-4 h-4 rounded-full shadow-md",
                                            generateDescriptions ? "bg-white" : "bg-gray-300 dark:bg-gray-600"
                                        )}
                                        animate={{ x: generateDescriptions ? 16 : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </button>
                            </div>

                            <button
                                onClick={handleAiSubmit}
                                disabled={!aiInput.trim() || isAiProcessing}
                                className="w-full py-4 rounded-xl text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                                style={{
                                    backgroundColor: accentColor,
                                    boxShadow: `0 10px 25px -5px ${accentColor}30`
                                }}
                            >
                                {isAiProcessing ? <Sparkles className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                {isAiProcessing ? 'Processing AI...' : 'Add Note'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                                <div className="flex flex-col gap-4 mb-4">
                                    <input
                                        type="text"
                                        value={aiProposedNote.note.title}
                                        onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, title: e.target.value } })}
                                        className="font-bold text-gray-900 dark:text-gray-100 text-xl bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none px-1 w-full transition-colors"
                                        style={{ borderBottomColor: 'transparent' }}
                                        onFocus={(e) => e.target.style.borderBottomColor = accentColor}
                                        onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
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
                                            className="bg-white/60 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 font-medium"
                                            style={{ '--tw-ring-color': accentColor } as any}
                                        />
                                        <input
                                            type="time"
                                            value={aiProposedNote.note.time}
                                            onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, time: e.target.value } })}
                                            className="bg-white/60 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 font-medium cursor-pointer"
                                            style={{ colorScheme: 'light', '--tw-ring-color': accentColor } as any}
                                        />
                                        <select
                                            value={aiProposedNote.note.importance}
                                            onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, importance: e.target.value as any } })}
                                            className="border-2 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer"
                                            style={{
                                                backgroundColor: aiProposedNote.note.importance === 'high' ? '#fee2e2' :
                                                    aiProposedNote.note.importance === 'medium' ? '#fef3c7' :
                                                        aiProposedNote.note.importance === 'low' ? '#dbeafe' : '#f3f4f6',
                                                borderColor: aiProposedNote.note.importance === 'high' ? '#ef4444' :
                                                    aiProposedNote.note.importance === 'medium' ? '#f59e0b' :
                                                        aiProposedNote.note.importance === 'low' ? '#3b82f6' : '#9ca3af',
                                                color: aiProposedNote.note.importance === 'high' ? '#991b1b' :
                                                    aiProposedNote.note.importance === 'medium' ? '#92400e' :
                                                        aiProposedNote.note.importance === 'low' ? '#1e40af' : '#374151'
                                            }}
                                        >
                                            <option value="low">Low Priority</option>
                                            <option value="medium">Medium Priority</option>
                                            <option value="high">High Priority</option>
                                            <option value="misc">Miscellaneous</option>
                                        </select>
                                    </div>

                                    {/* Recurring Toggle */}
                                    {aiProposedNote.recurrence && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={() => {
                                                    setIsRecurring(!isRecurring);
                                                    if (!isRecurring) {
                                                        // Enable recurring
                                                        setAiProposedNote({
                                                            ...aiProposedNote,
                                                            note: {
                                                                ...aiProposedNote.note,
                                                                recurrence: aiProposedNote.recurrence
                                                            }
                                                        });
                                                    } else {
                                                        // Disable recurring
                                                        setAiProposedNote({
                                                            ...aiProposedNote,
                                                            note: {
                                                                ...aiProposedNote.note,
                                                                recurrence: undefined
                                                            }
                                                        });
                                                    }
                                                }}
                                                className={clsx(
                                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                                    isRecurring
                                                        ? "text-white"
                                                        : "bg-white/60 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
                                                )}
                                                style={isRecurring ? { backgroundColor: accentColor } : undefined}
                                            >
                                                <Repeat className="w-4 h-4" />
                                                {isRecurring ? 'Recurring' : 'Make Recurring'}
                                            </button>
                                            {isRecurring && (
                                                <span className="text-xs font-medium" style={{ color: accentColor }}>
                                                    {aiProposedNote.recurrence.type.charAt(0).toUpperCase() + aiProposedNote.recurrence.type.slice(1)}
                                                    {aiProposedNote.recurrence.count && ` (${aiProposedNote.recurrence.count}x)`}
                                                    {aiProposedNote.recurrence.endDate && ` until ${format(parseISO(aiProposedNote.recurrence.endDate), 'MMM d, yyyy')}`}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {aiProposedNote.options && aiProposedNote.options.length > 0 && (
                                        <>
                                            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: accentColor }}>AI-Suggested Descriptions (click to select):</p>
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
                                                            ? "bg-gray-100 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 shadow-sm"
                                                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                                                    )}
                                                    style={selectedOptionIndex === idx ? { borderColor: accentColor } : undefined}
                                                >
                                                    {option}
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    <p className="text-xs font-bold uppercase tracking-wider mb-1 mt-4" style={{ color: accentColor }}>Or write your own:</p>
                                    <textarea
                                        value={aiProposedNote.note.description}
                                        onChange={(e) => setAiProposedNote({ ...aiProposedNote, note: { ...aiProposedNote.note, description: e.target.value } })}
                                        className="w-full h-24 bg-white/60 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 resize-none"
                                        style={{ '--tw-ring-color': accentColor } as any}
                                        placeholder="Add or edit description..."
                                        spellCheck={true}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setAiProposedNote(null)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold transition-all">
                                    Back
                                </button>
                                <button
                                    onClick={confirmAiNote}
                                    className="flex-1 py-3 rounded-xl text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                                    style={{
                                        backgroundColor: accentColor,
                                        boxShadow: `0 10px 25px -5px ${accentColor}30`
                                    }}
                                >
                                    <Check className="w-5 h-5" /> Confirm & Add
                                </button>
                            </div>
                        </div>
                    )
                    }
                </div>
            </motion.div>
        </div>
    );
}

