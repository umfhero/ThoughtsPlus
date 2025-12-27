export type Page = 'dashboard' | 'calendar' | 'stats' | 'settings' | 'drawing' | 'github' | 'dev' | 'custom' | 'timer';

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
