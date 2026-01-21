import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Play, Upload, CheckCircle, XCircle,
    ChevronLeft, Trash2, Sparkles, FileText, Pencil
} from 'lucide-react';
import { FlashCard, FlashcardDeck, FlashcardsData } from '../../types';

interface FlashcardsGalleryProps {
    onBack: () => void;
}

// Default flashcard settings
const DEFAULT_SETTINGS: FlashcardsData['settings'] = {
    dailyNewCards: 20,
    dailyReviewCards: 100,
    showHints: true,
    autoPlayAudio: false,
    reviewOrder: 'random'
};

// SM-2 Algorithm implementation
function calculateNextReview(card: FlashCard, rating: number): Partial<FlashCard> {
    let { easeFactor, interval, repetitions } = card;

    if (rating < 3) {
        repetitions = 0;
        interval = 1;
    } else {
        if (repetitions === 0) interval = 1;
        else if (repetitions === 1) interval = 6;
        else interval = Math.round(interval * easeFactor);
        repetitions++;
    }

    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
        easeFactor,
        interval,
        repetitions,
        nextReviewDate: nextReviewDate.toISOString(),
        lastReviewDate: new Date().toISOString()
    };
}

function createCard(front: string, back: string, source?: FlashCard['source']): FlashCard {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        front,
        back,
        createdAt: now,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: now,
        source
    };
}

const DECK_COLORS = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
    '#06B6D4', '#6366F1', '#F43F5E', '#84CC16', '#14B8A6'
];

export function FlashcardsGallery({ onBack }: FlashcardsGalleryProps) {
    const [flashcardsData, setFlashcardsData] = useState<FlashcardsData>({
        decks: [],
        studySessions: [],
        settings: DEFAULT_SETTINGS
    });
    const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
    const [isStudying, setIsStudying] = useState(false);
    const [showCreateDeck, setShowCreateDeck] = useState(false);
    const [showAddCards, setShowAddCards] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);

    // Load flashcards data
    useEffect(() => {
        const loadData = async () => {
            try {
                // @ts-ignore
                const data = await window.ipcRenderer?.invoke('get-data');
                if (data?.flashcards) {
                    setFlashcardsData(data.flashcards);
                }
            } catch (err) {
                console.error('Failed to load flashcards:', err);
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    // Save flashcards data
    const saveData = useCallback(async (newData: FlashcardsData) => {
        try {
            // @ts-ignore
            const currentData = await window.ipcRenderer?.invoke('get-data');
            // @ts-ignore
            await window.ipcRenderer?.invoke('save-data', { ...currentData, flashcards: newData });
            setFlashcardsData(newData);
        } catch (err) {
            console.error('Failed to save flashcards:', err);
        }
    }, []);

    // Create new deck
    const handleCreateDeck = (name: string, description?: string) => {
        const newDeck: FlashcardDeck = {
            id: crypto.randomUUID(),
            name,
            description,
            color: DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)],
            cards: [],
            createdAt: new Date().toISOString(),
            totalReviews: 0
        };
        const newData = { ...flashcardsData, decks: [...flashcardsData.decks, newDeck] };
        saveData(newData);
        setShowCreateDeck(false);
        setSelectedDeck(newDeck);
    };

    // Delete deck
    const handleDeleteDeck = (deckId: string) => {
        const newData = {
            ...flashcardsData,
            decks: flashcardsData.decks.filter(d => d.id !== deckId)
        };
        saveData(newData);
        if (selectedDeck?.id === deckId) setSelectedDeck(null);
    };

    // Update deck
    const handleUpdateDeck = useCallback((updatedDeck: FlashcardDeck) => {
        const newData = {
            ...flashcardsData,
            decks: flashcardsData.decks.map(d =>
                d.id === updatedDeck.id ? updatedDeck : d
            )
        };
        saveData(newData);
        setSelectedDeck(updatedDeck);
    }, [flashcardsData, saveData]);

    // Import deck from Anki export
    const handleImportDeck = (importedDeck: FlashcardDeck) => {
        const newData = { ...flashcardsData, decks: [...flashcardsData.decks, importedDeck] };
        saveData(newData);
        setShowImport(false);
        setSelectedDeck(importedDeck);
    };

    // Get cards due for review
    const getDueCards = (deck: FlashcardDeck) => {
        const now = new Date();
        return deck.cards.filter(card => new Date(card.nextReviewDate) <= now);
    };

    // Get new cards (never reviewed)
    const getNewCards = (deck: FlashcardDeck) => {
        return deck.cards.filter(card => card.repetitions === 0);
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full" />
            </div>
        );
    }

    return (
        <div className="h-full bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden">
            <AnimatePresence mode="wait">
                {isStudying && selectedDeck ? (
                    <StudyMode
                        key="study"
                        deck={selectedDeck}
                        onClose={() => setIsStudying(false)}
                        onUpdateDeck={handleUpdateDeck}
                    />
                ) : selectedDeck ? (
                    <DeckView
                        key="deck"
                        deck={selectedDeck}
                        onBack={() => setSelectedDeck(null)}
                        onStudy={() => setIsStudying(true)}
                        onAddCards={() => setShowAddCards(true)}
                        onDeleteDeck={() => handleDeleteDeck(selectedDeck.id)}
                        onUpdateDeck={handleUpdateDeck}
                        getDueCards={getDueCards}
                        getNewCards={getNewCards}
                    />
                ) : (
                    <DeckGalleryView
                        key="gallery"
                        decks={flashcardsData.decks}
                        onSelectDeck={setSelectedDeck}
                        onStudyDeck={(deck) => {
                            setSelectedDeck(deck);
                            setIsStudying(true);
                        }}
                        onCreateDeck={() => setShowCreateDeck(true)}
                        onImport={() => setShowImport(true)}
                        onBack={onBack}
                        getDueCards={getDueCards}
                        getNewCards={getNewCards}
                        onFileDropped={(file) => {
                            setDroppedFile(file);
                            setShowImport(true);
                        }}
                        onDeleteDeck={handleDeleteDeck}
                        onUpdateDeck={handleUpdateDeck}
                    />
                )}
            </AnimatePresence>

            {/* Create Deck Modal */}
            <AnimatePresence>
                {showCreateDeck && (
                    <CreateDeckModal
                        onClose={() => setShowCreateDeck(false)}
                        onCreate={handleCreateDeck}
                    />
                )}
            </AnimatePresence>

            {/* Add Cards Modal */}
            <AnimatePresence>
                {showAddCards && selectedDeck && (
                    <AddCardsModal
                        deck={selectedDeck}
                        onClose={() => setShowAddCards(false)}
                        onAddCards={(cards) => {
                            const updatedDeck = {
                                ...selectedDeck,
                                cards: [...selectedDeck.cards, ...cards],
                                updatedAt: new Date().toISOString()
                            };
                            handleUpdateDeck(updatedDeck);
                            setShowAddCards(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Import Modal */}
            <AnimatePresence>
                {showImport && (
                    <ImportModal
                        onClose={() => {
                            setShowImport(false);
                            setDroppedFile(null);
                        }}
                        onImport={handleImportDeck}
                        initialFile={droppedFile}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Deck Gallery View - The main landing page for flashcards
function DeckGalleryView({ decks, onSelectDeck, onStudyDeck, onCreateDeck, onImport, onBack, getDueCards, getNewCards, onFileDropped, onDeleteDeck, onUpdateDeck }: {
    decks: FlashcardDeck[];
    onSelectDeck: (deck: FlashcardDeck) => void;
    onStudyDeck: (deck: FlashcardDeck) => void;
    onCreateDeck: () => void;
    onImport: () => void;
    onBack: () => void;
    getDueCards: (deck: FlashcardDeck) => FlashCard[];
    getNewCards: (deck: FlashcardDeck) => FlashCard[];
    onFileDropped: (file: File) => void;
    onDeleteDeck: (deckId: string) => void;
    onUpdateDeck: (deck: FlashcardDeck) => void;
}) {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [hoveredDeck, setHoveredDeck] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; deckId: string } | null>(null);
    const [renamingDeck, setRenamingDeck] = useState<{ id: string; name: string } | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if we're leaving the main container
        if (e.currentTarget === e.target) {
            setIsDraggingOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            // Pass the file to parent and open import modal
            onFileDropped(files[0]);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, deckId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, deckId });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            <AnimatePresence>
                {isDraggingOver && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-500 rounded-2xl flex items-center justify-center pointer-events-none"
                    >
                        <div className="text-center">
                            <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">Drop to import flashcards</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Supports .apkg, .txt, .csv files</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Flashcards</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Master any topic with spaced repetition</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onImport}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    >
                        <Upload className="w-4 h-4" />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={onCreateDeck}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Deck</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 p-6 pb-0">
                {[
                    { label: 'Total Decks', value: decks.length, color: '#3B82F6' },
                    { label: 'Total Cards', value: decks.reduce((sum, d) => sum + d.cards.length, 0), color: '#8B5CF6' },
                    { label: 'Due Today', value: decks.reduce((sum, d) => sum + getDueCards(d).length, 0), color: '#F59E0B' },
                    { label: 'New Cards', value: decks.reduce((sum, d) => sum + getNewCards(d).length, 0), color: '#10B981' },
                ].map(stat => (
                    <div key={stat.label} className="p-4 rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty state or deck grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {decks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No flashcard decks yet</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md">
                            Create your first deck to start learning with spaced repetition. You can create cards manually, generate them with AI, or import from Anki.
                        </p>

                        {/* Preview Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-8 max-w-2xl">
                            {[1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="p-5 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 relative overflow-hidden"
                                >
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
                                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-3 justify-center">
                            <button
                                onClick={onCreateDeck}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Create from Scratch</span>
                            </button>
                            <button
                                onClick={onImport}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                            >
                                <Upload className="w-5 h-5" />
                                <span>Import from Anki</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        {decks.map(deck => {
                            const dueCount = getDueCards(deck).length;
                            const newCount = getNewCards(deck).length;
                            const isHovered = hoveredDeck === deck.id;

                            return (
                                <motion.div
                                    key={deck.id}
                                    className="relative group"
                                    onMouseEnter={() => setHoveredDeck(deck.id)}
                                    onMouseLeave={() => setHoveredDeck(null)}
                                    onContextMenu={(e) => handleContextMenu(e, deck.id)}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <motion.button
                                        onClick={() => onSelectDeck(deck)}
                                        className="w-full p-5 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800/50 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700 transition-all text-left relative overflow-hidden"
                                        whileHover={{ scale: 1.03, y: -4 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            boxShadow: isHovered ? '0 10px 30px -10px rgba(0,0,0,0.2)' : '0 2px 8px -2px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {/* Subtle gradient overlay */}
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{
                                                background: `linear-gradient(135deg, ${deck.color}10 0%, transparent 100%)`
                                            }}
                                        ></div>

                                        <div className="relative z-10">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2 text-xs">
                                                    {dueCount > 0 && (
                                                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                                            {dueCount} due
                                                        </span>
                                                    )}
                                                    {newCount > 0 && (
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                            {newCount} new
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Color indicator */}
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: deck.color }}
                                                ></div>
                                            </div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{deck.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                                {deck.description || `${deck.cards.length} cards`}
                                            </p>
                                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                                                <span>{deck.cards.length} cards</span>
                                                <span>{deck.totalReviews} reviews</span>
                                            </div>
                                        </div>
                                    </motion.button>

                                    {/* Hover preview */}
                                    <AnimatePresence>
                                        {isHovered && deck.cards.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="absolute left-0 right-0 top-full mt-2 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-20 pointer-events-none"
                                            >
                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview:</p>
                                                <div className="space-y-1">
                                                    {deck.cards.slice(0, 3).map((card, idx) => (
                                                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                                            • {card.front}
                                                        </div>
                                                    ))}
                                                    {deck.cards.length > 3 && (
                                                        <div className="text-xs text-gray-400 italic">
                                                            +{deck.cards.length - 3} more cards
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                const deck = decks.find(d => d.id === contextMenu.deckId);
                                if (deck) {
                                    onStudyDeck(deck);
                                }
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 flex items-center gap-2"
                        >
                            <Play className="w-4 h-4" />
                            Study Deck
                        </button>
                        <button
                            onClick={() => {
                                const deck = decks.find(d => d.id === contextMenu.deckId);
                                if (deck) {
                                    setRenamingDeck({ id: deck.id, name: deck.name });
                                }
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 flex items-center gap-2"
                        >
                            <Pencil className="w-4 h-4" />
                            Rename
                        </button>
                        <button
                            onClick={() => {
                                onDeleteDeck(contextMenu.deckId);
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Deck
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Rename Modal */}
            <AnimatePresence>
                {renamingDeck && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setRenamingDeck(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Rename Deck</h2>
                            <input
                                type="text"
                                value={renamingDeck.name}
                                onChange={(e) => setRenamingDeck({ ...renamingDeck, name: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && renamingDeck.name.trim()) {
                                        const deck = decks.find(d => d.id === renamingDeck.id);
                                        if (deck) {
                                            onUpdateDeck({ ...deck, name: renamingDeck.name.trim() });
                                        }
                                        setRenamingDeck(null);
                                    } else if (e.key === 'Escape') {
                                        setRenamingDeck(null);
                                    }
                                }}
                                className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setRenamingDeck(null)}
                                    className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (renamingDeck.name.trim()) {
                                            const deck = decks.find(d => d.id === renamingDeck.id);
                                            if (deck) {
                                                onUpdateDeck({ ...deck, name: renamingDeck.name.trim() });
                                            }
                                            setRenamingDeck(null);
                                        }
                                    }}
                                    disabled={!renamingDeck.name.trim()}
                                    className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
                                >
                                    Rename
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Deck View Component
function DeckView({ deck, onBack, onStudy, onAddCards, onDeleteDeck, onUpdateDeck, getDueCards, getNewCards }: {
    deck: FlashcardDeck;
    onBack: () => void;
    onStudy: () => void;
    onAddCards: () => void;
    onDeleteDeck: () => void;
    onUpdateDeck: (deck: FlashcardDeck) => void;
    getDueCards: (deck: FlashcardDeck) => FlashCard[];
    getNewCards: (deck: FlashcardDeck) => FlashCard[];
}) {
    const dueCards = getDueCards(deck);
    const newCards = getNewCards(deck);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cardId: string } | null>(null);
    const [editingCard, setEditingCard] = useState<{ id: string; front: string; back: string } | null>(null);

    const handleDeleteCard = (cardId: string) => {
        // Delete card immediately without confirmation
        onUpdateDeck({
            ...deck,
            cards: deck.cards.filter(c => c.id !== cardId),
            updatedAt: new Date().toISOString()
        });
    };

    const handleEditCard = (cardId: string) => {
        const card = deck.cards.find(c => c.id === cardId);
        if (card) {
            setEditingCard({ id: card.id, front: card.front, back: card.back });
        }
        setContextMenu(null);
    };

    const handleSaveEdit = () => {
        if (!editingCard) return;

        onUpdateDeck({
            ...deck,
            cards: deck.cards.map(c =>
                c.id === editingCard.id
                    ? { ...c, front: editingCard.front, back: editingCard.back }
                    : c
            ),
            updatedAt: new Date().toISOString()
        });
        setEditingCard(null);
    };

    const handleContextMenu = (e: React.MouseEvent, cardId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, cardId });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">{deck.name}</h1>
                    {deck.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{deck.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onAddCards}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Cards</span>
                    </button>
                    {(dueCards.length > 0 || newCards.length > 0) && (
                        <button
                            onClick={onStudy}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                        >
                            <Play className="w-4 h-4" />
                            <span>Study ({dueCards.length + Math.min(newCards.length, 10)})</span>
                        </button>
                    )}
                    <button
                        onClick={onDeleteDeck}
                        className="p-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete Deck"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 p-6">
                {[
                    { label: 'Total', value: deck.cards.length, color: '#6366F1' },
                    { label: 'Due', value: dueCards.length, color: '#F59E0B' },
                    { label: 'New', value: newCards.length, color: '#10B981' },
                    { label: 'Reviews', value: deck.totalReviews, color: '#8B5CF6' },
                ].map(stat => (
                    <div key={stat.label} className="p-3 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Cards List */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
                {deck.cards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">No cards in this deck yet</p>
                        <button
                            onClick={onAddCards}
                            className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                        >
                            Add Your First Card
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {deck.cards.map(card => (
                            <div
                                key={card.id}
                                className="p-4 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer group"
                                onContextMenu={(e) => handleContextMenu(e, card.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{card.front}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{card.back}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span>EF: {card.easeFactor.toFixed(1)}</span>
                                        <span>Int: {card.interval}d</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Context Menu */}
                <AnimatePresence>
                    {contextMenu && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => handleEditCard(contextMenu.cardId)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 flex items-center gap-2"
                            >
                                <Pencil className="w-4 h-4" />
                                Edit Card
                            </button>
                            <button
                                onClick={() => {
                                    handleDeleteCard(contextMenu.cardId);
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Card
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Edit Modal */}
                <AnimatePresence>
                    {editingCard && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                            onClick={() => setEditingCard(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Card</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Front (Question)</label>
                                        <textarea
                                            value={editingCard.front}
                                            onChange={(e) => setEditingCard({ ...editingCard, front: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Back (Answer)</label>
                                        <textarea
                                            value={editingCard.back}
                                            onChange={(e) => setEditingCard({ ...editingCard, back: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        onClick={() => setEditingCard(null)}
                                        className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// Study Mode Component
function StudyMode({ deck, onClose, onUpdateDeck }: {
    deck: FlashcardDeck;
    onClose: () => void;
    onUpdateDeck: (deck: FlashcardDeck) => void;
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [studyCards, setStudyCards] = useState<FlashCard[]>([]);
    const [stats, setStats] = useState({ correct: 0, total: 0 });

    useEffect(() => {
        const now = new Date();
        const dueCards = deck.cards.filter(c => new Date(c.nextReviewDate) <= now);
        const newCards = deck.cards.filter(c => c.repetitions === 0).slice(0, 10);
        const allCards = [...dueCards, ...newCards.filter(c => !dueCards.find(d => d.id === c.id))];
        setStudyCards(allCards.sort(() => Math.random() - 0.5));
    }, [deck]);

    const currentCard = studyCards[currentIndex];

    const handleRating = (rating: number) => {
        if (!currentCard) return;

        const updates = calculateNextReview(currentCard, rating);
        const updatedCard = { ...currentCard, ...updates };

        const updatedDeck = {
            ...deck,
            cards: deck.cards.map(c => c.id === currentCard.id ? updatedCard : c),
            totalReviews: deck.totalReviews + 1,
            lastStudied: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        onUpdateDeck(updatedDeck);
        setStats(prev => ({ correct: prev.correct + (rating >= 3 ? 1 : 0), total: prev.total + 1 }));

        if (currentIndex < studyCards.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setShowAnswer(false);
        } else {
            onClose();
        }
    };

    if (!currentCard) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Session Complete!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{stats.correct}/{stats.total} correct</p>
                <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-xl text-white"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col p-6"
        >
            {/* Progress */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex-1 mx-4">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-300"
                            style={{
                                width: `${((currentIndex + 1) / studyCards.length) * 100}%`,
                                backgroundColor: 'var(--accent-primary)'
                            }}
                        />
                    </div>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {currentIndex + 1}/{studyCards.length}
                </span>
            </div>

            {/* Card */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Subtle pattern background */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundSize: '60px 60px'
                }}></div>

                <motion.div
                    key={currentCard.id + (showAnswer ? '-back' : '-front')}
                    initial={{ rotateY: showAnswer ? -90 : 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    className="w-full max-w-xl p-8 rounded-2xl bg-white dark:bg-gray-800 shadow-xl text-center relative z-10"
                >
                    <p className="text-2xl font-medium text-gray-900 dark:text-white">
                        {showAnswer ? currentCard.back : currentCard.front}
                    </p>
                    {currentCard.hint && !showAnswer && (
                        <p className="mt-4 text-sm text-gray-400">Hint: {currentCard.hint}</p>
                    )}
                </motion.div>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-4 pt-6">
                {!showAnswer ? (
                    <button
                        onClick={() => setShowAnswer(true)}
                        className="px-8 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 text-lg font-medium"
                    >
                        Show Answer
                    </button>
                ) : (
                    <div className="flex gap-3 w-full max-w-2xl">
                        {[
                            { label: 'Again', rating: 1, description: '<1m' },
                            { label: 'Hard', rating: 2, description: '<10m' },
                            { label: 'Good', rating: 3, description: '4d' },
                            { label: 'Easy', rating: 4, description: '7d' },
                        ].map(btn => (
                            <button
                                key={btn.label}
                                onClick={() => handleRating(btn.rating)}
                                className="flex-1 px-4 py-4 rounded-xl font-medium transition-all hover:scale-[1.02] border group relative overflow-hidden"
                                style={{
                                    backgroundColor: btn.rating === 1 ? 'rgba(239, 68, 68, 0.08)' :
                                        btn.rating === 2 ? 'rgba(245, 158, 11, 0.08)' :
                                            btn.rating === 3 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                    borderColor: btn.rating === 1 ? 'rgba(239, 68, 68, 0.2)' :
                                        btn.rating === 2 ? 'rgba(245, 158, 11, 0.2)' :
                                            btn.rating === 3 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                    color: btn.rating === 1 ? '#EF4444' :
                                        btn.rating === 2 ? '#F59E0B' :
                                            btn.rating === 3 ? '#10B981' : '#3B82F6'
                                }}
                            >
                                <div className="flex flex-col items-center gap-1 relative z-10">
                                    <span className="text-sm font-semibold">{btn.label}</span>
                                    <span className="text-xs opacity-60">{btn.description}</span>
                                </div>
                                {/* Hover overlay */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{
                                        backgroundColor: btn.rating === 1 ? 'rgba(239, 68, 68, 0.05)' :
                                            btn.rating === 2 ? 'rgba(245, 158, 11, 0.05)' :
                                                btn.rating === 3 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(59, 130, 246, 0.05)'
                                    }}
                                ></div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// Create Deck Modal
function CreateDeckModal({ onClose, onCreate }: {
    onClose: () => void;
    onCreate: (name: string, description?: string) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create New Deck</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g., Spanish Vocabulary"
                            className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="What is this deck for?"
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => name.trim() && onCreate(name.trim(), description.trim() || undefined)}
                        disabled={!name.trim()}
                        className="px-4 py-2 rounded-xl text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                        Create
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Add Cards Modal
function AddCardsModal({ deck, onClose, onAddCards }: {
    deck: FlashcardDeck;
    onClose: () => void;
    onAddCards: (cards: FlashCard[]) => void;
}) {
    const [mode, setMode] = useState<'manual' | 'ai'>('manual');
    const [front, setFront] = useState('');
    const [back, setBack] = useState('');
    const [topic, setTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleAddManual = () => {
        if (front.trim() && back.trim()) {
            onAddCards([createCard(front.trim(), back.trim(), { type: 'manual' })]);
            setFront('');
            setBack('');
        }
    };

    const handleGenerateFromTopic = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        try {
            // @ts-ignore
            const response = await window.ipcRenderer?.invoke('ai-generate-flashcards', {
                type: 'topic',
                content: topic,
                count: 10
            });
            if (response?.cards) {
                const cards = response.cards.map((c: any) =>
                    createCard(c.front, c.back, { type: 'ai-topic', topic: topic.trim() })
                );
                onAddCards(cards);
            }
        } catch (err) {
            console.error('Failed to generate cards:', err);
        }
        setIsGenerating(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Cards to {deck.name}</h2>

                {/* Mode switcher */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setMode('manual')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors ${mode === 'manual'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>Manual</span>
                    </button>
                    <button
                        onClick={() => setMode('ai')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors ${mode === 'ai'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>AI Generate</span>
                    </button>
                </div>

                {mode === 'manual' ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Front (Question)</label>
                            <textarea
                                value={front}
                                onChange={e => setFront(e.target.value)}
                                placeholder="Enter the question or prompt"
                                rows={3}
                                className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Back (Answer)</label>
                            <textarea
                                value={back}
                                onChange={e => setBack(e.target.value)}
                                placeholder="Enter the answer"
                                rows={3}
                                className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                            />
                        </div>
                        <div className="flex justify-between">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                            >
                                Done
                            </button>
                            <button
                                onClick={handleAddManual}
                                disabled={!front.trim() || !back.trim()}
                                className="px-4 py-2 rounded-xl text-white disabled:opacity-50"
                                style={{ backgroundColor: 'var(--accent-primary)' }}
                            >
                                Add Card
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic</label>
                            <input
                                type="text"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                placeholder="e.g., World War II, Organic Chemistry, JavaScript"
                                className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI will generate 10 flashcards about this topic</p>
                        </div>
                        <div className="flex justify-between">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateFromTopic}
                                disabled={!topic.trim() || isGenerating}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white disabled:opacity-50"
                                style={{ backgroundColor: 'var(--accent-primary)' }}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Generate Cards</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

// Import Modal
function ImportModal({ onClose, onImport, initialFile }: {
    onClose: () => void;
    onImport: (deck: FlashcardDeck) => void;
    initialFile?: File | null;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);

    const parseAnkiExport = (content: string): { name: string; cards: FlashCard[] } | null => {
        try {
            const lines = content.split('\n').filter(line => line.trim());
            const cards: FlashCard[] = [];

            // Check if first line is a CSV header
            const firstLine = lines[0];
            const hasHeader = firstLine.toLowerCase().includes('front') && firstLine.toLowerCase().includes('back');
            const startIndex = hasHeader ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i];

                // Try tab-separated first (Anki format)
                if (line.includes('\t')) {
                    const parts = line.split('\t');
                    if (parts.length >= 2) {
                        cards.push(createCard(parts[0].trim(), parts[1].trim(), { type: 'anki-import' }));
                    }
                }
                // Try CSV format (comma-separated with optional quotes)
                else if (line.includes(',')) {
                    // Simple CSV parser that handles quoted fields
                    const parts: string[] = [];
                    let current = '';
                    let inQuotes = false;

                    for (let j = 0; j < line.length; j++) {
                        const char = line[j];

                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            parts.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    parts.push(current.trim()); // Add last part

                    if (parts.length >= 2) {
                        // Remove surrounding quotes if present
                        const front = parts[0].replace(/^["']|["']$/g, '').trim();
                        const back = parts[1].replace(/^["']|["']$/g, '').trim();
                        if (front && back) {
                            cards.push(createCard(front, back, { type: 'anki-import' }));
                        }
                    }
                }
            }

            if (cards.length === 0) return null;
            return { name: 'Imported Deck', cards };
        } catch {
            return null;
        }
    };

    const handleFileSelect = async (file: File) => {
        setError(null);
        setIsLoading(true);
        setLoadingProgress(0);

        try {
            // Check if it's an .apkg file (Anki package)
            if (file.name.endsWith('.apkg')) {
                setLoadingProgress(20);
                // @ts-ignore - Call IPC handler to parse .apkg file
                const result = await window.ipcRenderer?.invoke('parse-anki-package', file.path);

                if (!result || !result.success) {
                    setError(result?.error || 'Failed to parse Anki package. The file may be corrupted.');
                    setIsLoading(false);
                    return;
                }

                setLoadingProgress(60);

                if (!result.cards || result.cards.length === 0) {
                    setError('No cards found in the Anki package.');
                    setIsLoading(false);
                    return;
                }

                setLoadingProgress(80);

                // Convert to FlashCard format and decode HTML entities
                const cards: FlashCard[] = result.cards.map((card: any) => {
                    // Decode HTML entities and clean up text
                    const decodeHTML = (html: string) => {
                        if (!html) return '';
                        const txt = document.createElement('textarea');
                        txt.innerHTML = html;
                        return txt.value.replace(/<[^>]*>/g, '').trim(); // Remove HTML tags
                    };

                    return createCard(
                        decodeHTML(card.front || ''),
                        decodeHTML(card.back || ''),
                        { type: 'anki-import' }
                    );
                }).filter((card: FlashCard) => card.front && card.back); // Filter out empty cards

                if (cards.length === 0) {
                    setError('No valid cards found after processing.');
                    setIsLoading(false);
                    return;
                }

                const newDeck: FlashcardDeck = {
                    id: crypto.randomUUID(),
                    name: result.deckName || file.name.replace(/\.[^/.]+$/, '') || 'Imported Deck',
                    color: DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)],
                    cards: cards,
                    createdAt: new Date().toISOString(),
                    totalReviews: 0
                };

                setLoadingProgress(100);
                setTimeout(() => {
                    onImport(newDeck);
                    setIsLoading(false);
                }, 300);
            } else {
                // Handle text file (tab-separated)
                setLoadingProgress(30);
                const content = await file.text();
                setLoadingProgress(60);

                const result = parseAnkiExport(content);

                if (!result || result.cards.length === 0) {
                    setError('Could not parse file. Make sure it\'s a valid Anki text export (tab-separated) or .apkg file.');
                    setIsLoading(false);
                    return;
                }

                setLoadingProgress(80);

                const newDeck: FlashcardDeck = {
                    id: crypto.randomUUID(),
                    name: file.name.replace(/\.[^/.]+$/, '') || 'Imported Deck',
                    color: DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)],
                    cards: result.cards,
                    createdAt: new Date().toISOString(),
                    totalReviews: 0
                };

                setLoadingProgress(100);
                setTimeout(() => {
                    onImport(newDeck);
                    setIsLoading(false);
                }, 300);
            }
        } catch (err) {
            console.error('Import error:', err);
            setError('Failed to read file. Please try again.');
            setIsLoading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    // Auto-process file if provided via drag-and-drop on main page
    useEffect(() => {
        if (initialFile) {
            handleFileSelect(initialFile);
        }
    }, [initialFile]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={!isLoading ? onClose : undefined}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Import Flashcards</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Import from Anki (.apkg) or text export (.txt, .csv)
                </p>

                {isLoading ? (
                    <div className="py-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 relative">
                            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
                            <div
                                className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"
                                style={{ animationDuration: '1s' }}
                            ></div>
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Preparing cards...
                        </p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${loadingProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {loadingProgress}%
                        </p>
                    </div>
                ) : (
                    <>
                        <div
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600'
                                }`}
                        >
                            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                Drag and drop file here, or
                            </p>
                            <label className="inline-block px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer text-gray-700 dark:text-gray-300 text-sm">
                                <input
                                    type="file"
                                    accept=".txt,.csv,.apkg"
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileSelect(file);
                                    }}
                                />
                                Browse Files
                            </label>
                        </div>

                        {error && (
                            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full mt-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                        >
                            Cancel
                        </button>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}

export default FlashcardsGallery;
