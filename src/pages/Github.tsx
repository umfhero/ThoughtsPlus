import { useState, useEffect, useRef } from 'react';
import { Github, Star, GitFork, ExternalLink, Code, Loader, Box, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';
import { ActivityCalendar, Activity } from 'react-activity-calendar';
import { useTheme } from '../contexts/ThemeContext';
import { fetchGithubContributions } from '../utils/github';
import { GithubActivity3D } from '../components/GithubActivity3D';
import clsx from 'clsx';

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

interface Repo {
    id: number;
    name: string;
    description: string;
    html_url: string;
    stargazers_count: number;
    forks_count: number;
    language: string;
    updated_at: string;
}

interface UserProfile {
    login: string;
    avatar_url: string;
    html_url: string;
    public_repos: number;
    followers: number;
    following: number;
    bio: string;
    name: string;
}

export function GithubPage({ isMockMode, isSidebarCollapsed = false }: { isMockMode?: boolean, isSidebarCollapsed?: boolean }) {
    const [repos, setRepos] = useState<Repo[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [readme, setReadme] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [contributions, setContributions] = useState<Activity[]>([]);
    const [githubUsername, setGithubUsername] = useState<string>('');
    const { accentColor, theme } = useTheme();
    const [blockSize, setBlockSize] = useState(12);
    const githubContributionsRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'2d' | '3d'>(() => {
        return (localStorage.getItem('githubViewMode') as '2d' | '3d') || '2d';
    });

    useEffect(() => {
        localStorage.setItem('githubViewMode', viewMode);
    }, [viewMode]);

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const sidebarWidth = isSidebarCollapsed ? 0 : 240;
            const availableWidth = window.innerWidth - sidebarWidth;
            setIsMobile(availableWidth < 900);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [isSidebarCollapsed]);

    const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

    // Mock Data
    const mockProfile: UserProfile = {
        login: "torvalds",
        avatar_url: "https://avatars.githubusercontent.com/u/1024025?v=4",
        html_url: "https://github.com/torvalds",
        public_repos: 6,
        followers: 195000,
        following: 0,
        bio: "Creator of Linux and Git",
        name: "Linus Torvalds"
    };

    const mockRepos: Repo[] = [
        { id: 1, name: "linux", description: "Linux kernel source tree", html_url: "https://github.com/torvalds/linux", stargazers_count: 165000, forks_count: 52000, language: "C", updated_at: new Date().toISOString() },
        { id: 2, name: "git", description: "Git Source Code Mirror - This is a publish-only repository but pull requests can be turned into patches to the mailing list", html_url: "https://github.com/git/git", stargazers_count: 48000, forks_count: 25000, language: "C", updated_at: new Date().toISOString() },
        { id: 3, name: "subsurface-for-dirk", description: "Subsurface divelog", html_url: "https://github.com/torvalds/subsurface-for-dirk", stargazers_count: 1200, forks_count: 400, language: "C", updated_at: new Date().toISOString() },
        { id: 4, name: "pesconvert", description: "PES to embroidery file converter", html_url: "https://github.com/torvalds/pesconvert", stargazers_count: 800, forks_count: 100, language: "C", updated_at: new Date().toISOString() },
    ];

    const generateMockContributions = (year: number) => {
        const data: Activity[] = [];
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);

        for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
            const count = Math.random() > 0.7 ? Math.floor(Math.random() * 10) : 0;
            const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 9 ? 3 : 4;
            data.push({
                date: d.toISOString().split('T')[0],
                count,
                level
            });
        }
        return data;
    };

    useEffect(() => {
        const updateSize = () => {
            if (githubContributionsRef.current) {
                const containerWidth = githubContributionsRef.current.clientWidth;
                const availableWidth = containerWidth - 48; // Padding buffer
                const weeks = 53;
                const margin = 4;
                const calculatedSize = Math.floor((availableWidth / weeks) - margin);
                setBlockSize(Math.max(2, Math.min(calculatedSize, 28)));
            }
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        if (githubContributionsRef.current) {
            observer.observe(githubContributionsRef.current);
        }
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (isMockMode) {
            setGithubUsername("torvalds");
            setProfile(mockProfile);
            setRepos(mockRepos);
            setContributions(generateMockContributions(selectedYear));
            setLoading(false);
            setError(null);
        } else {
            loadGithubUsername();
        }
    }, [isMockMode, selectedYear]);

    useEffect(() => {
        if (!isMockMode && githubUsername) {
            // First try to load cached data for this username
            const cachedProfile = localStorage.getItem(`github_profile_${githubUsername}`);
            const cachedRepos = localStorage.getItem(`github_repos_${githubUsername}`);
            const cachedReadme = localStorage.getItem(`github_readme_${githubUsername}`);

            if (cachedProfile && cachedRepos) {
                setProfile(JSON.parse(cachedProfile));
                setRepos(JSON.parse(cachedRepos));
                if (cachedReadme) setReadme(cachedReadme);
                setLoading(false); // Show cached data immediately
            }

            // Then fetch fresh data in background
            fetchGithubData();
        }
    }, [githubUsername, isMockMode]);

    useEffect(() => {
        if (!isMockMode && profile) {
            loadContributions(selectedYear);
        }
    }, [selectedYear, profile, isMockMode]);

    const loadGithubUsername = async () => {
        try {
            // @ts-ignore
            const username = await window.ipcRenderer.invoke('get-github-username');
            if (username) {
                setGithubUsername(username);
            } else {
                setError('Please configure your GitHub username in Settings');
                setLoading(false);
            }
        } catch (err) {
            setError('Failed to load GitHub configuration');
            setLoading(false);
        }
    };

    const loadContributions = async (year: number) => {
        if (!profile || !githubUsername) return;
        const data = await fetchGithubContributions(githubUsername, year);
        setContributions(data);
    };

    useEffect(() => {
        if (contributions.length > 0 && githubContributionsRef.current && selectedYear === new Date().getFullYear()) {
            const scrollToEnd = () => {
                const container = githubContributionsRef.current;
                if (container) {
                    const maxScroll = container.scrollWidth - container.clientWidth;
                    if (maxScroll > 0) {
                        container.scrollLeft = maxScroll;
                    }
                }
            };

            const observer = new MutationObserver(() => {
                scrollToEnd();
            });

            observer.observe(githubContributionsRef.current, {
                childList: true,
                subtree: true,
            });

            setTimeout(scrollToEnd, 100);
            setTimeout(scrollToEnd, 300);
            setTimeout(scrollToEnd, 500);

            return () => observer.disconnect();
        }
    }, [contributions, selectedYear]);

    const fetchGithubData = async () => {
        if (!githubUsername) {
            setError('Please configure your GitHub username in Settings');
            setLoading(false);
            return;
        }

        try {
            // Only set loading true if we don't have profile data yet
            if (!profile) setLoading(true);
            setError(null);

            // Get user-configured token
            // @ts-ignore
            const token = await window.ipcRenderer.invoke('get-github-token');
            const headers: HeadersInit = { 'Accept': 'application/vnd.github.html' };
            if (token) {
                headers['Authorization'] = `token ${token}`;
            }

            const [userRes, reposRes, readmeRes] = await Promise.all([
                fetch(`https://api.github.com/users/${githubUsername}`, token ? { headers: { 'Authorization': `token ${token}` } } : undefined),
                fetch(`https://api.github.com/users/${githubUsername}/repos?sort=updated&per_page=100`, token ? { headers: { 'Authorization': `token ${token}` } } : undefined),
                fetch(`https://api.github.com/repos/${githubUsername}/${githubUsername}/readme`, { headers })
            ]);

            if (!userRes.ok || !reposRes.ok) throw new Error('Failed to fetch Github data');

            const userData = await userRes.json();
            const reposData = await reposRes.json();

            // Filter out profile repo (username/username)
            const filteredRepos = reposData.filter((repo: Repo) => repo.name !== githubUsername);

            setProfile(userData);
            setRepos(filteredRepos);

            if (readmeRes.ok) {
                const readmeHtml = await readmeRes.text();
                setReadme(readmeHtml);
                localStorage.setItem(`github_readme_${githubUsername}`, readmeHtml);
            }

            // Cache the data
            localStorage.setItem(`github_profile_${githubUsername}`, JSON.stringify(userData));
            localStorage.setItem(`github_repos_${githubUsername}`, JSON.stringify(filteredRepos));

        } catch (err) {
            setError('Failed to load Github data. Please check your username and internet connection.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-md">
                    <Github className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">GitHub Not Configured</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => {
                            // Navigate to settings - dispatch event
                            window.dispatchEvent(new CustomEvent('navigate-to-settings'));
                        }}
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-gray-500/20"
                    >
                        Go to Settings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-4 h-full overflow-y-auto space-y-6 md:space-y-8">
            <style>{`
                .github-readme p:first-of-type img {
                    display: inline-block !important;
                    margin: 0 4px 4px 0 !important;
                }
                .github-readme img {
                    max-width: 100%;
                    height: auto;
                }
                .github-readme {
                    font-size: 0.9em;
                }
            `}</style>

            {/* Profile Header */}
            {profile && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 md:p-8 shadow-xl border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 mb-6 md:mb-8">
                        <img
                            src={profile.avatar_url}
                            alt={profile.login}
                            className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-blue-100 dark:border-blue-900"
                        />
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                {profile.name || profile.login}
                                <a href={profile.html_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">{profile.bio}</p>
                            <div className="flex flex-wrap gap-4 md:gap-6 mt-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 dark:text-white">{profile.public_repos}</span>
                                    <span className="text-gray-500">Repositories</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 dark:text-white">{profile.followers}</span>
                                    <span className="text-gray-500">Followers</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 dark:text-white">{profile.following}</span>
                                    <span className="text-gray-500">Following</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contributions Graph */}
                    <div className="mb-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Contributions</h2>
                                <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex items-center">
                                    <button
                                        onClick={() => setViewMode('2d')}
                                        className={clsx("p-1.5 rounded-md transition-all", viewMode === '2d'
                                            ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-500'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}
                                        title="2D View"
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('3d')}
                                        className={clsx("p-1.5 rounded-md transition-all", viewMode === '3d'
                                            ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-500'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}
                                        title="3D Skyline View"
                                    >
                                        <Box className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {years.map(year => (
                                    <button
                                        key={year}
                                        onClick={() => setSelectedYear(year)}
                                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedYear === year
                                            ? 'text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            }`}
                                        style={selectedYear === year ? { backgroundColor: accentColor } : undefined}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {viewMode === '3d' ? (
                            <div className="overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                {contributions.length > 0 ? (
                                    <GithubActivity3D data={contributions} theme={theme as any} accentColor={accentColor} />
                                ) : (
                                    <div className="flex items-center justify-center p-12 text-gray-400 dark:text-gray-500">
                                        <Loader className="w-6 h-6 animate-spin mr-2" />
                                        <span>Loading contributions...</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div ref={githubContributionsRef} className="overflow-x-auto thin-scrollbar pb-2 rounded-xl bg-white dark:bg-gray-800 p-4 border border-gray-100 dark:border-gray-700 min-h-[160px]">
                                {contributions.length > 0 ? (
                                    <div className="flex justify-center min-w-full p-4">
                                        <ActivityCalendar
                                            data={contributions}
                                            colorScheme={theme === 'custom' ? 'light' : theme}
                                            theme={(() => {
                                                const rgb = hexToRgb(accentColor);
                                                if (!rgb) return undefined;
                                                const { r, g, b } = rgb;
                                                return {
                                                    light: ['#ebedf0', `rgba(${r}, ${g}, ${b}, 0.4)`, `rgba(${r}, ${g}, ${b}, 0.6)`, `rgba(${r}, ${g}, ${b}, 0.8)`, `rgba(${r}, ${g}, ${b}, 1)`],
                                                    dark: ['#161b22', `rgba(${r}, ${g}, ${b}, 0.4)`, `rgba(${r}, ${g}, ${b}, 0.6)`, `rgba(${r}, ${g}, ${b}, 0.8)`, `rgba(${r}, ${g}, ${b}, 1)`],
                                                };
                                            })()}
                                            blockSize={blockSize}
                                            blockMargin={4}
                                            fontSize={12}
                                            showWeekdayLabels
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center text-gray-400 dark:text-gray-500">
                                        <Loader className="w-6 h-6 animate-spin mr-2" />
                                        <span>Loading contributions...</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {contributions.length > 0 && (
                            <div className="flex items-center justify-between mt-2 px-4">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {contributions.reduce((sum, day) => sum + day.count, 0)} contributions in {selectedYear}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>Less</span>
                                    <div className="flex gap-1">
                                        {theme === 'dark' ? (
                                            <>
                                                <div className="w-3 h-3 rounded-sm bg-[#161b22]"></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(${hexToRgb(accentColor)?.r}, ${hexToRgb(accentColor)?.g}, ${hexToRgb(accentColor)?.b}, 0.4)` }}></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(${hexToRgb(accentColor)?.r}, ${hexToRgb(accentColor)?.g}, ${hexToRgb(accentColor)?.b}, 0.6)` }}></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(${hexToRgb(accentColor)?.r}, ${hexToRgb(accentColor)?.g}, ${hexToRgb(accentColor)?.b}, 0.8)` }}></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: accentColor }}></div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-3 h-3 rounded-sm bg-[#ebedf0]"></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(${hexToRgb(accentColor)?.r}, ${hexToRgb(accentColor)?.g}, ${hexToRgb(accentColor)?.b}, 0.4)` }}></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(${hexToRgb(accentColor)?.r}, ${hexToRgb(accentColor)?.g}, ${hexToRgb(accentColor)?.b}, 0.6)` }}></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(${hexToRgb(accentColor)?.r}, ${hexToRgb(accentColor)?.g}, ${hexToRgb(accentColor)?.b}, 0.8)` }}></div>
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: accentColor }}></div>
                                            </>
                                        )}
                                    </div>
                                    <span>More</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Readme Section */}
                    {readme && (
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                            <div
                                className="github-readme prose dark:prose-invert max-w-none prose-headings:no-underline prose-a:no-underline [&_.anchor]:hidden [&_img]:opacity-0 [&_img]:transition-opacity [&_img.loaded]:opacity-100"
                                dangerouslySetInnerHTML={{ __html: readme }}
                                onLoad={(e) => {
                                    const target = e.target as HTMLElement;
                                    const images = target.querySelectorAll('img');
                                    images.forEach(img => {
                                        img.addEventListener('load', () => img.classList.add('loaded'));
                                        img.addEventListener('error', () => {
                                            img.style.display = 'none';
                                            console.warn('Failed to load image:', img.src);
                                        });
                                        if (img.complete) img.classList.add('loaded');
                                    });
                                }}
                            />
                        </div>
                    )}
                </motion.div>
            )}

            {/* Repos Grid */}
            <div className={clsx("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3")}>
                {repos.map((repo, index) => (
                    <motion.a
                        key={repo.id}
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <Github className="w-6 h-6" />
                            </div>
                            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4" />
                                    <span className="text-sm font-medium">{repo.stargazers_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <GitFork className="w-4 h-4" />
                                    <span className="text-sm font-medium">{repo.forks_count}</span>
                                </div>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {repo.name}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2 h-10">
                            {repo.description || 'No description available'}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <Code className="w-4 h-4" />
                                <span>{repo.language || 'Unknown'}</span>
                            </div>
                            <span className="text-xs text-gray-400">
                                {new Date(repo.updated_at).toLocaleDateString()}
                            </span>
                        </div>
                    </motion.a>
                ))}
            </div>
        </div>
    );
}
