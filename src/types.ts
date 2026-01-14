export type Page = 'dashboard' | 'calendar' | 'stats' | 'settings' | 'drawing' | 'github' | 'dev' | 'custom' | 'timer' | 'progress' | 'notebook';

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
    output?: string; // For code cells: execution output
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
