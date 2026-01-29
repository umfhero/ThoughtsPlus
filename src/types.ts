export type Page = 'dashboard' | 'calendar' | 'stats' | 'settings' | 'drawing' | 'github' | 'dev' | 'custom' | 'timer' | 'progress' | 'notebook' | 'workspace' | 'icons' | 'flashcards';

export interface QuickNote {
    id: string;
    content: string;
    createdAt: string; // ISO date string
    updatedAt?: string; // ISO date string
}

export interface NotebookData {
    notes: QuickNote[];
}

export interface CustomWidgetDataPoint {
    date: string; // ISO date string
    value: number;
}

export interface CustomWidgetConfig {
    id: string;
    title: string;
    apiUrl: string;
    refreshInterval: number; // in minutes
    isAccumulative: boolean;
    dataKey?: string; // Path to the array in the response, e.g. "data.values"
    xKey: string; // Path to the date property in the item
    yKey: string; // Path to the value property in the item
    color: string;
    icon?: string; // Lucide icon name or base64 string
    iconType?: 'lucide' | 'custom';
    headers?: Record<string, string>;
}

export interface Note {
    id: string;
    title: string;
    description: string;
    summary?: string;
    time: string;
    importance: 'low' | 'medium' | 'high' | 'misc';
    completed?: boolean;
    completedLate?: boolean;
    missed?: boolean; // Explicitly marked as missed by user
    recurrence?: {
        type: 'daily' | 'weekly' | 'fortnightly' | 'monthly';
        endDate?: string; // ISO date string
        count?: number;
    };
    seriesId?: string;
}

export interface NotesData {
    [date: string]: Note[];
}

// Task (Checklist) - separate from calendar events
export interface Task {
    id: string;
    title: string;
    description?: string;
    tags?: string[];
    completed: boolean;
    createdAt: string; // ISO date string
    completedAt?: string; // ISO date string
    order: number; // For drag-and-drop ordering
    color?: string; // Hex color for the task
}

export interface TasksData {
    tasks: Task[];
    archived: Task[]; // Deleted tasks for undo functionality
}

export interface Milestone {
    id: string;
    title: string;           // e.g., "University Start", "First Day at New Job"
    description?: string;    // Optional context
    date: string;            // ISO date string (YYYY-MM-DD)
    time?: string;           // HH:mm
    colour?: string;         // Optional hex colour for visual customisation
}

export interface MilestonesData {
    [date: string]: Milestone[];
}

export interface LifeChapter {
    id: string;
    title: string;
    startDate: string; // ISO date string YYYY-MM-DD
    endDate?: string; // ISO date string YYYY-MM-DD (optional for ongoing)
    description?: string;
    colour: string;
}

export interface LifeChaptersData {
    chapters: LifeChapter[];
}

export interface Snapshot {
    id: string;
    type: 'monthly' | 'yearly';
    date: string; // ISO date string (YYYY-MM-DD) representing the period (e.g., 2025-01-01 for Jan 2025)
    content: string;
    tags?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
}

export interface SnapshotsData {
    [periodKey: string]: Snapshot; // Key e.g., "monthly-2025-01" or "yearly-2025"
}

// Nerdbook - Cell-based note system with rich text, code, and diagrams
export type NerdCellType = 'markdown' | 'code' | 'text';

export interface NerdCell {
    id: string;
    type: NerdCellType;
    content: string;
    language?: string; // For code cells: 'javascript', 'python', 'typescript', etc.
    output?: string; // For code cells: execution output
    isExecuting?: boolean; // Whether the cell is currently running
    executionError?: boolean; // Whether the last execution had an error
    isEditing?: boolean;
    createdAt: string; // ISO date string
    updatedAt?: string; // ISO date string
}

export interface NerdNotebook {
    id: string;
    title: string;
    cells: NerdCell[];
    createdAt: string; // ISO date string
    updatedAt?: string; // ISO date string
    tags?: string[];
    color?: string; // Accent color for the notebook
}

export interface NerdNotebooksData {
    notebooks: NerdNotebook[];
    activeNotebookId?: string;
}

// Flashcard System - Spaced repetition learning with AI generation
export interface FlashCard {
    id: string;
    front: string;           // Question/prompt side
    back: string;            // Answer side
    hint?: string;           // Optional hint
    tags?: string[];         // For categorization
    createdAt: string;       // ISO date string
    updatedAt?: string;      // ISO date string
    // Spaced repetition fields (SM-2 algorithm)
    easeFactor: number;      // Difficulty multiplier (default 2.5)
    interval: number;        // Days until next review
    repetitions: number;     // Number of successful reviews in a row
    nextReviewDate: string;  // ISO date string for next review
    lastReviewDate?: string; // ISO date string of last review
    // Source tracking for AI-generated cards
    source?: {
        type: 'manual' | 'ai-folder' | 'ai-file' | 'ai-topic' | 'ai-url' | 'anki-import';
        path?: string;       // File/folder path or URL
        topic?: string;      // Topic description
    };
}

export interface FlashcardDeck {
    id: string;
    name: string;
    description?: string;
    color: string;           // Accent color for the deck
    icon?: string;           // Optional lucide icon name
    cards: FlashCard[];
    createdAt: string;       // ISO date string
    updatedAt?: string;      // ISO date string
    // Stats
    totalReviews: number;
    lastStudied?: string;    // ISO date string
    // Import metadata
    importedFrom?: {
        type: 'anki' | 'csv' | 'json';
        fileName: string;
        importDate: string;
    };
}

export interface StudySession {
    id: string;
    deckId: string;
    startedAt: string;       // ISO date string
    endedAt?: string;        // ISO date string
    cardsStudied: number;
    correctAnswers: number;
    averageTime: number;     // Average time per card in ms
}

export interface CardReview {
    cardId: string;
    rating: 0 | 1 | 2 | 3 | 4 | 5; // 0=complete fail, 5=perfect
    timeSpent: number;       // Time in ms to answer
    reviewedAt: string;      // ISO date string
}

export interface FlashcardsData {
    decks: FlashcardDeck[];
    studySessions: StudySession[];
    settings: {
        dailyNewCards: number;      // Max new cards per day
        dailyReviewCards: number;   // Max review cards per day
        showHints: boolean;
        autoPlayAudio: boolean;
        reviewOrder: 'random' | 'oldest' | 'hardest';
    };
}
