import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Sparkles, Edit2, Search, Filter } from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    parseISO
} from 'date-fns';
import clsx from 'clsx';
import { NotesData, Note } from '../App';

interface CalendarPageProps {
    notes: NotesData;
    setNotes: (notes: NotesData) => void;
    initialSelectedDate: Date | null;
    initialSelectedNoteId: string | null;
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;
}

export function CalendarPage({ notes, setNotes, initialSelectedDate, currentMonth, setCurrentMonth }: Omit<CalendarPageProps, 'initialSelectedNoteId'>) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(initialSelectedDate || null);
    const [direction, setDirection] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    // Form State
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [time, setTime] = useState('09:00');
    const [importance, setImportance] = useState<Note['importance']>('misc');
    const [isGenerating, setIsGenerating] = useState(false);

    // AI Quick Add State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiProposedNote, setAiProposedNote] = useState<{ note: Note, date: Date, options: string[] } | null>(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterImportance, setFilterImportance] = useState<string>('all');

    const convertTo12Hour = (time24: string): string => {
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const getAllNotes = () => {
        const all: { date: Date, note: Note }[] = [];
        Object.entries(notes).forEach(([dateStr, dayNotes]) => {
            const date = parseISO(dateStr);
            dayNotes.forEach(note => {
                all.push({ date, note });
            });
        });
        return all.sort((a, b) => {
            const dateDiff = a.date.getTime() - b.date.getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.note.time.localeCompare(b.note.time);
        });
    };

    const isSearchActive = searchQuery.trim() !== '' || filterImportance !== 'all';

    const filteredNotes = isSearchActive ? getAllNotes().filter(({ note }) => {
        const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              note.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterImportance === 'all' || note.importance === filterImportance;
        return matchesSearch && matchesFilter;
    }) : [];

    useEffect(() => {
        if (isSearchActive) {
            setIsPanelOpen(true);
        }
    }, [isSearchActive]);

    useEffect(() => {
        if (initialSelectedDate) {
            setCurrentMonth(initialSelectedDate);
            setSelectedDate(initialSelectedDate);
            setIsPanelOpen(true);
        }
    }, [initialSelectedDate, setCurrentMonth]);

    // Reset form when date changes
    useEffect(() => {
        if (selectedDate) {
            resetForm();
        }
    }, [selectedDate]);

    const resetForm = () => {
        setEditingNoteId(null);
        setTitle('');
        setDescription('');
        setTime('09:00');
        setImportance('misc');
    };

    const loadNoteForEditing = (note: Note) => {
        setEditingNoteId(note.id);
        setTitle(note.title);
        setDescription(note.description);
        setTime(note.time);
        setImportance(note.importance);
    };

    const saveNotes = async (newNotes: NotesData) => {
        setNotes(newNotes);
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, notes: newNotes });
    };

    const handleSaveNote = async () => {
        if (!selectedDate || !title.trim()) return;

        setIsGenerating(true);
        let summary = '';
        if (description.length > 50) {
            try {
                // @ts-ignore
                summary = await window.ipcRenderer.invoke('summarize-text', description);
            } catch (e) {
                console.error(e);
            }
        }
        setIsGenerating(false);

        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        const existingNotes = notes[dateKey] || [];

        const newNote: Note = {
            id: editingNoteId || crypto.randomUUID(),
            title,
            description,
            summary: summary || undefined,
            time,
            importance
        };

        let newNotesList;
        if (editingNoteId) {
            newNotesList = existingNotes.map(n => n.id === editingNoteId ? newNote : n);
        } else {
            newNotesList = [...existingNotes, newNote];
        }

        const newNotes = { ...notes, [dateKey]: newNotesList };
        saveNotes(newNotes);
        resetForm();
    };

    const handleDeleteNote = (noteId: string, date?: Date) => {
        const targetDate = date || selectedDate;
        if (!targetDate) return;
        const dateKey = format(targetDate, 'yyyy-MM-dd');
        const existingNotes = notes[dateKey] || [];
        const newNotes = { ...notes, [dateKey]: existingNotes.filter(n => n.id !== noteId) };
        saveNotes(newNotes);
    };

    const nextMonth = () => {
        setDirection(1);
        setCurrentMonth(addMonths(currentMonth, 1));
    };

    const prevMonth = () => {
        setDirection(-1);
        setCurrentMonth(subMonths(currentMonth, 1));
    };

    const jumpToToday = () => {
        setDirection(currentMonth > new Date() ? -1 : 1);
        const today = new Date();
        setCurrentMonth(today);
        setSelectedDate(today);
        setIsPanelOpen(true);
    };

    const onDateClick = (day: Date) => {
        setSelectedDate(day);
        setIsPanelOpen(true);
        setSearchQuery('');
        setFilterImportance('all');
    };

    const handleAiSubmit = async () => {
        if (!aiInput.trim()) return;
        setIsAiProcessing(true);

        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('parse-natural-language-note', aiInput);
            
            if (result) {
                const targetDate = parseISO(result.date);
                const options = result.descriptionOptions || [result.description];
                
                const note: Note = {
                    id: crypto.randomUUID(),
                    title: result.title,
                    description: options[0], // Default to first option
                    summary: options[0],
                    time: result.time,
                    importance: result.importance
                };

                setAiProposedNote({ note, date: targetDate, options });
                setSelectedOptionIndex(0);
            } else {
                // Fallback if AI fails
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
            const dateKey = format(aiProposedNote.date, 'yyyy-MM-dd');
            const updatedNotes = { ...notes };
            if (!updatedNotes[dateKey]) updatedNotes[dateKey] = [];
            
            // Use the note exactly as it is in the state (it contains the edited values)
            const finalNote = {
                ...aiProposedNote.note
            };
            
            updatedNotes[dateKey].push(finalNote);
            saveNotes(updatedNotes);

            setAiProposedNote(null);
            setAiInput('');
            setIsAiModalOpen(false);

            if (!isSameMonth(aiProposedNote.date, currentMonth)) {
                setCurrentMonth(aiProposedNote.date);
            }
            setSelectedDate(aiProposedNote.date);
            setIsPanelOpen(true);
        }
    };

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const variants = {
        enter: (direction: number) => ({ x: direction > 0 ? 500 : -500, opacity: 0 }),
        center: { zIndex: 1, x: 0, opacity: 1 },
        exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? 500 : -500, opacity: 0 })
    };

    const importanceColors = {
        low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50',
        medium: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50',
        high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50',
        misc: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50'
    };

    return (
        <div className="h-full flex gap-6 p-8 overflow-hidden relative">
            <motion.div layout className="flex-1 flex flex-col h-full min-w-0">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-8">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                                {format(currentMonth, 'MMMM')} <span className="text-gray-400 dark:text-gray-500">{format(currentMonth, 'yyyy')}</span>
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400">Manage your events and notes</p>
                        </div>

                        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search events..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-1.5 text-sm bg-transparent border-none focus:ring-0 w-48 text-gray-700 dark:text-gray-200 placeholder-gray-400"
                                />
                            </div>
                            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                            <select
                                value={filterImportance}
                                onChange={(e) => setFilterImportance(e.target.value as any)}
                                className="text-sm bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-300 py-1.5 pr-8 cursor-pointer"
                            >
                                <option value="all">All Priority</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                                <option value="misc">Misc</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={prevMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                            <ChevronLeft className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsAiModalOpen(true)}
                            className="p-2 bg-blue-600 text-white rounded-xl transition-colors hover:bg-blue-500"
                            title="AI Quick Add"
                        >
                            <Sparkles className="w-4 h-4" />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={jumpToToday} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            Today
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={nextMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                            <ChevronRight className="w-5 h-5" />
                        </motion.button>
                    </div>
                </div>

                <div className="flex-1 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-[2rem] border border-white/60 dark:border-gray-700/60 overflow-hidden flex flex-col shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative">
                    <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-4 text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 relative overflow-hidden">
                        <AnimatePresence initial={false} custom={direction}>
                            <motion.div
                                key={currentMonth.toString()}
                                custom={direction}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                                className="absolute inset-0 grid grid-cols-7 grid-rows-6"
                            >
                                {calendarDays.map((day) => {
                                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                    const isTodayDate = isToday(day);
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const dayNotes = notes[dateKey] || [];

                                    return (
                                        <div
                                            key={day.toString()}
                                            onClick={() => onDateClick(day)}
                                            className={clsx(
                                                "relative border-b border-r border-gray-100/50 p-2 transition-all cursor-pointer group flex flex-col",
                                                !isCurrentMonth && "bg-gray-50/50 text-gray-300",
                                                isCurrentMonth && "hover:bg-white hover:shadow-lg hover:z-10",
                                                isSelected && "bg-blue-50 !border-blue-100 z-10"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={clsx(
                                                    "w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-all",
                                                    isTodayDate ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" :
                                                        isSelected ? "text-blue-600 bg-blue-100" :
                                                            isCurrentMonth ? "text-gray-700 group-hover:bg-gray-100" : "text-gray-400"
                                                )}>
                                                    {format(day, 'd')}
                                                </span>
                                                {dayNotes.length > 0 && (
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-600">
                                                        {dayNotes.length}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                {dayNotes.map((note, i) => (
                                                    <div key={i} className={clsx("text-[10px] px-1.5 py-0.5 rounded-md shadow-sm truncate border", importanceColors[note.importance || 'misc'])}>
                                                        {note.title}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>

            <AnimatePresence mode="popLayout">
                {isPanelOpen && (selectedDate || isSearchActive) && (
                    <motion.div
                        key="side-panel"
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        className="w-96 shrink-0 bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl p-6 flex flex-col h-full"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                {isSearchActive ? (
                                    <>
                                        <h3 className="text-2xl font-bold text-gray-800">Search Results</h3>
                                        <p className="text-gray-500">{filteredNotes.length} events found</p>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="text-2xl font-bold text-gray-800">{format(selectedDate!, 'EEEE')}</h3>
                                        <p className="text-gray-500">{format(selectedDate!, 'MMMM do, yyyy')}</p>
                                    </>
                                )}
                            </div>
                            <button onClick={() => setIsPanelOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-6">
                            {isSearchActive ? (
                                filteredNotes.length > 0 ? (
                                    filteredNotes.map(({ date, note }) => (
                                        <motion.div
                                            layout
                                            key={note.id}
                                            onClick={() => {
                                                setSelectedDate(date);
                                                if (!isSameMonth(date, currentMonth)) {
                                                    setCurrentMonth(date);
                                                }
                                            }}
                                            className={clsx("p-4 rounded-xl border group relative cursor-pointer hover:shadow-md transition-all", importanceColors[note.importance])}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold">{note.title}</h4>
                                                    <div className="text-xs opacity-70 mt-1 font-semibold">
                                                        {format(date, 'MMM d, yyyy')} • {convertTo12Hour(note.time)}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm opacity-80 mb-3">{note.description}</p>
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDate(date);
                                                    loadNoteForEditing(note);
                                                }} className="p-1.5 hover:bg-white/50 rounded-lg transition-colors">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteNote(note.id, date);
                                                }} className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-400">
                                        <p>No matching events found</p>
                                    </div>
                                )
                            ) : (
                                (notes[format(selectedDate, 'yyyy-MM-dd')] || []).map((note) => (
                                <motion.div
                                    layout
                                    key={note.id}
                                    className={clsx("p-4 rounded-xl border group relative", importanceColors[note.importance])}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold">{note.title}</h4>
                                        <span className="text-xs font-bold opacity-70 bg-white/50 px-2 py-1 rounded-md">{convertTo12Hour(note.time)}</span>
                                    </div>
                                    <p className="text-sm opacity-80 mb-3">{note.description}</p>
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => loadNoteForEditing(note)} className="p-1.5 hover:bg-white/50 rounded-lg transition-colors">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                            )}
                            {!isSearchActive && (!notes[format(selectedDate, 'yyyy-MM-dd')] || notes[format(selectedDate, 'yyyy-MM-dd')].length === 0) && (
                                <div className="text-center py-10 text-gray-400">
                                    <p>No events for this day</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 bg-white/50 p-4 rounded-2xl border border-white/50">
                            <input
                                type="text"
                                placeholder="Event Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <textarea
                                placeholder="Description (AI summary available for long texts)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <select
                                    value={importance}
                                    onChange={(e) => setImportance(e.target.value as any)}
                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="low">Low Priority</option>
                                    <option value="medium">Medium Priority</option>
                                    <option value="high">High Priority</option>
                                    <option value="misc">Miscellaneous</option>
                                </select>
                            </div>
                            <button
                                onClick={handleSaveNote}
                                disabled={!title.trim() || isGenerating}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? <Sparkles className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {editingNoteId ? 'Update Event' : 'Add Event'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Modal */}
            <AnimatePresence>
                {isAiModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-white/60"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-blue-500" />
                                    AI Quick Add
                                </h3>
                                <button onClick={() => setIsAiModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {!aiProposedNote ? (
                                <div className="space-y-4">
                                    <textarea
                                        value={aiInput}
                                        onChange={(e) => setAiInput(e.target.value)}
                                        placeholder="e.g., 'Meeting with team next Monday at 10am'"
                                        className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
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
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <div className="flex flex-col gap-3 mb-4">
                                            <input 
                                                type="text" 
                                                value={aiProposedNote.note.title}
                                                onChange={(e) => setAiProposedNote({
                                                    ...aiProposedNote,
                                                    note: { ...aiProposedNote.note, title: e.target.value }
                                                })}
                                                className="font-bold text-blue-900 text-lg bg-transparent border-b border-blue-200 focus:border-blue-500 focus:outline-none px-1 w-full"
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
                                                    className="bg-white/50 border border-blue-200 rounded-lg px-2 py-1 text-sm text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                                <input 
                                                    type="time"
                                                    value={aiProposedNote.note.time}
                                                    onChange={(e) => setAiProposedNote({
                                                        ...aiProposedNote,
                                                        note: { ...aiProposedNote.note, time: e.target.value }
                                                    })}
                                                    className="bg-white/50 border border-blue-200 rounded-lg px-2 py-1 text-sm text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                                <select
                                                    value={aiProposedNote.note.importance}
                                                    onChange={(e) => setAiProposedNote({
                                                        ...aiProposedNote,
                                                        note: { ...aiProposedNote.note, importance: e.target.value as any }
                                                    })}
                                                    className="bg-white/50 border border-blue-200 rounded-lg px-2 py-1 text-sm text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                                                            ? "bg-white border-blue-500 shadow-md ring-1 ring-blue-500" 
                                                            : "bg-white/50 border-blue-200 hover:bg-white hover:border-blue-300"
                                                    )}
                                                >
                                                    {option}
                                                </div>
                                            ))}
                                            
                                            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mt-4">Edit Description:</p>
                                            <textarea
                                                value={aiProposedNote.note.description}
                                                onChange={(e) => setAiProposedNote({
                                                    ...aiProposedNote,
                                                    note: { ...aiProposedNote.note, description: e.target.value }
                                                })}
                                                className="w-full h-24 bg-white border border-blue-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setAiProposedNote(null)}
                                            className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={confirmAiNote}
                                            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-500/30"
                                        >
                                            Confirm & Add
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
