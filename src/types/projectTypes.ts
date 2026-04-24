/**
 * Project metadata types for the Projects dashboard widget.
 * Projects link workspace folders to trackable timelines.
 */

export interface ProjectMeta {
    id: string;
    folderId: string;       // Workspace folder ID
    folderName: string;     // Display name (synced from folder)
    title: string;          // Project title (editable)
    description: string;    // Project description
    startDate: string;      // ISO date string (YYYY-MM-DD)
    endDate: string;        // ISO date string (YYYY-MM-DD)
    status: 'active' | 'completed' | 'paused';
    color: string;          // Accent color for the project card
    createdAt: string;      // ISO date string
    updatedAt: string;      // ISO date string
}

export interface ProjectsData {
    projects: ProjectMeta[];
}

/**
 * Calculate progress percentage for a project based on dates.
 * Returns 0-100 (can exceed 100 if overdue).
 */
export function calculateProjectProgress(startDate: string, endDate: string): number {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();

    if (now <= start) return 0;
    if (now >= end) return 100;

    const total = end - start;
    const elapsed = now - start;
    return Math.round((elapsed / total) * 100);
}

/**
 * Get remaining days for a project.
 * Negative values mean overdue.
 */
export function getProjectDaysRemaining(endDate: string): number {
    const end = new Date(endDate).getTime();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffMs = end - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format a time remaining string for display.
 */
export function formatTimeRemaining(endDate: string): string {
    const days = getProjectDaysRemaining(endDate);

    if (days < 0) {
        const absDays = Math.abs(days);
        if (absDays === 1) return 'Overdue by 1 day';
        if (absDays < 7) return `Overdue by ${absDays} days`;
        const weeks = Math.floor(absDays / 7);
        return `Overdue by ${weeks} week${weeks !== 1 ? 's' : ''}`;
    }

    if (days === 0) return 'Due today';
    if (days === 1) return '1 day left';
    if (days < 7) return `${days} days left`;
    if (days < 30) {
        const weeks = Math.floor(days / 7);
        const remainingDays = days % 7;
        if (remainingDays === 0) return `${weeks} week${weeks !== 1 ? 's' : ''} left`;
        return `${weeks}w ${remainingDays}d left`;
    }
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (remainingDays === 0) return `${months} month${months !== 1 ? 's' : ''} left`;
    return `${months}mo ${remainingDays}d left`;
}
