import { useState, useEffect } from 'react';
import { Github, Star, GitFork, ExternalLink, Code } from 'lucide-react';
import { motion } from 'framer-motion';

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

export function GithubPage() {
    const [repos, setRepos] = useState<Repo[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [readme, setReadme] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchGithubData();
    }, []);

    const fetchGithubData = async () => {
        try {
            setLoading(true);
            const [userRes, reposRes, readmeRes] = await Promise.all([
                fetch('https://api.github.com/users/umfhero'),
                fetch('https://api.github.com/users/umfhero/repos?sort=updated&per_page=100'),
                fetch('https://api.github.com/repos/umfhero/umfhero/readme', {
                    headers: { 'Accept': 'application/vnd.github.html' }
                })
            ]);

            if (!userRes.ok || !reposRes.ok) throw new Error('Failed to fetch Github data');

            const userData = await userRes.json();
            const reposData = await reposRes.json();
            
            // Filter out umfhero repo
            const filteredRepos = reposData.filter((repo: Repo) => repo.name !== 'umfhero');

            setProfile(userData);
            setRepos(filteredRepos);

            if (readmeRes.ok) {
                const readmeHtml = await readmeRes.text();
                setReadme(readmeHtml);
            }
        } catch (err) {
            setError('Failed to load Github data. Please check your internet connection.');
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
            <div className="h-full flex items-center justify-center text-red-500">
                {error}
            </div>
        );
    }

    return (
        <div className="p-10 h-full overflow-y-auto space-y-8">
            {/* Profile Header */}
            {profile && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-6">
                        <img 
                            src={profile.avatar_url} 
                            alt={profile.login} 
                            className="w-24 h-24 rounded-full border-4 border-blue-100 dark:border-blue-900"
                        />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                {profile.name || profile.login}
                                <a href={profile.html_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">{profile.bio}</p>
                            <div className="flex gap-6 mt-4 text-sm">
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
                </motion.div>
            )}

            {/* Readme Section */}
            {readme && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                    <div 
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: readme }}
                    />
                </motion.div>
            )}

            {/* Repos Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
