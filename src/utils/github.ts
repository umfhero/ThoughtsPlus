import { Activity } from 'react-activity-calendar';

const CACHE_KEY = 'github_contributions_cache';

interface CachedData {
    timestamp: number;
    data: { [year: number]: Activity[] };
}

export async function fetchGithubContributions(username: string, year: number): Promise<Activity[]> {
    const currentYear = new Date().getFullYear();

    // For current year, always fetch fresh data to show latest commits
    // For past years, use cache if available
    if (year !== currentYear) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data } = JSON.parse(cached) as CachedData;
            if (data[year]) {
                return data[year];
            }
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

export interface Contributor {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
    contributions: number;
    type?: string;
}

const CONTRIBUTORS_CACHE_KEY = 'github_contributors_cache';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

interface ContributorsCachedData {
    timestamp: number;
    contributors: Contributor[];
}

// Filter out bot contributors
function filterOutBots(contributors: Contributor[]): Contributor[] {
    return contributors.filter(contributor => {
        // Exclude if login contains [bot]
        if (contributor.login.includes('[bot]')) {
            return false;
        }
        // Exclude if type is "Bot"
        if (contributor.type === 'Bot') {
            return false;
        }
        return true;
    });
}

export async function fetchGithubContributors(owner: string, repo: string): Promise<Contributor[]> {
    // Check cache first
    const cached = localStorage.getItem(CONTRIBUTORS_CACHE_KEY);
    if (cached) {
        const { timestamp, contributors } = JSON.parse(cached) as ContributorsCachedData;
        if (Date.now() - timestamp < CACHE_DURATION) {
            // Always filter cached data in case cache was stored before bot filtering was added
            return filterOutBots(contributors);
        }
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`);
        if (!response.ok) {
            throw new Error('Failed to fetch contributors');
        }

        const rawContributors: Contributor[] = await response.json();

        // Filter out bots before caching
        const contributors = filterOutBots(rawContributors);

        // Cache the results (already filtered)
        localStorage.setItem(CONTRIBUTORS_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            contributors
        }));

        return contributors;
    } catch (error) {
        console.error('Error fetching GitHub contributors:', error);

        // If fetch fails, return cached data even if expired
        if (cached) {
            const { contributors } = JSON.parse(cached) as ContributorsCachedData;
            return contributors;
        }

        return [];
    }
}
