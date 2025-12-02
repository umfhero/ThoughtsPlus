import { Activity } from 'react-activity-calendar';

const CACHE_KEY = 'github_contributions_cache';

interface CachedData {
    timestamp: number;
    data: { [year: number]: Activity[] };
}

export async function fetchGithubContributions(username: string, year: number): Promise<Activity[]> {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const { data } = JSON.parse(cached) as CachedData;
        const currentYear = new Date().getFullYear();

        // If cached data exists for this year and it's not expired (or it's a past year), use it
        // Exception: Always fetch current year if cache is older than 1 hour? 
        // User said: "preload all... Don't use a preload for the current day contribution"
        // So we should always refresh the current year, but maybe use cache for past years.
        
        if (data[year]) {
            if (year !== currentYear) {
                return data[year];
            }
            // For current year, if cache is fresh enough (e.g. 1 hour), use it?
            // User said "Don't use a preload for the current day contribution".
            // This implies we should fetch fresh data for the current year.
            // But we can still return cached data immediately and update in background if we wanted, 
            // but here we'll just fetch fresh for current year.
        }
    }

    try {
        const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=${year}`);
        if (!response.ok) {
            throw new Error('Failed to fetch contributions');
        }
        
        const json = await response.json();
        const activities: Activity[] = json.contributions.map((day: any) => ({
            date: day.date,
            count: day.count,
            level: day.level
        }));

        // Update cache
        const currentCache = localStorage.getItem(CACHE_KEY);
        let newCacheData: { [year: number]: Activity[] } = {};
        
        if (currentCache) {
            const parsed = JSON.parse(currentCache);
            newCacheData = parsed.data;
        }

        newCacheData[year] = activities;

        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: newCacheData
        }));

        return activities;
    } catch (error) {
        console.error('Error fetching Github contributions:', error);
        return [];
    }
}

export function getCachedContributions(year: number): Activity[] | null {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const { data } = JSON.parse(cached) as CachedData;
        return data[year] || null;
    }
    return null;
}
