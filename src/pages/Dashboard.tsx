import { motion } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, ArrowUpRight, ListTodo, GripVertical } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { format, isAfter, parseISO } from 'date-fns';
import { NotesData, Note } from '../App';
import clsx from 'clsx';
import { BASELINE_STATS, processStatsData, StatsData as HistoricalStatsData } from '../utils/statsManager';
import TrendChart from '../components/TrendChart';

interface DashboardProps {
    notes: NotesData;
    onNavigateToNote: (date: Date, noteId: string) => void;
    userName: string;
    onAddNote: (note: Note, date: Date) => void;
}

export function Dashboard({ notes, onNavigateToNote, userName }: DashboardProps) {
    const [time, setTime] = useState(new Date());
    // @ts-ignore
    const [stats, setStats] = useState<any>(null);
    const [historicalStats, setHistoricalStats] = useState<HistoricalStatsData | null>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    
    // Resizable layout state
    const [leftWidth, setLeftWidth] = useState(66); // Percentage
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedWidth = localStorage.getItem('dashboardLeftWidth');
        if (savedWidth) {
            setLeftWidth(parseFloat(savedWidth));
        }
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;
            
            const containerRect = containerRef.current.getBoundingClientRect();
            const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            
            // Limit width between 30% and 70%
            if (newLeftWidth >= 30 && newLeftWidth <= 70) {
                setLeftWidth(newLeftWidth);
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                localStorage.setItem('dashboardLeftWidth', leftWidth.toString());
            }
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, leftWidth]);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        loadStats();
        const hData = processStatsData();
        setHistoricalStats(hData);
        return () => clearInterval(timer);
    }, []);

    const loadStats = async () => {
        console.log('📊 loadStats called - fetching creator stats...');
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-creator-stats');
            console.log('📊 Received stats data:', data);
            setStats(data);
            console.log('📊 Stats state updated');
        } catch (e) {
            console.error("❌ Failed to load stats", e);
        }
    };

    // Get upcoming events
    const getUpcomingEvents = () => {
        const allEvents: { date: Date; note: Note }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        Object.entries(notes).forEach(([dateStr, dayNotes]) => {
            const date = parseISO(dateStr);
            if (isAfter(date, today) || date.getTime() === today.getTime()) {
                dayNotes.forEach(note => {
                    allEvents.push({ date, note });
                });
            }
        });
        return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
    };

    const upcomingEvents = getUpcomingEvents();

    // Effect to generate AI summary of upcoming events (scheduled at 10am and 1am)
    useEffect(() => {
        const generateSummary = async () => {
            if (upcomingEvents.length > 0) {
                const eventsText = upcomingEvents.map(({ date, note }) =>
                    `${format(date, 'MMM d, yyyy')} at ${note.time}: ${note.title} (${note.importance} priority)`
                ).join('\n');

                const prompt = `You are a helpful personal assistant. Create a brief, encouraging daily briefing for ${userName} based on their upcoming events. Keep it conversational and motivating (2-3 sentences max).\n\nUpcoming events:\n${eventsText}\n\nBriefing:`;

                try {
                    // @ts-ignore
                    const summary = await window.ipcRenderer.invoke('summarize-text', prompt);
                    setAiSummary(summary);
                    // Store the summary with timestamp
                    localStorage.setItem('lastSummary', summary);
                    localStorage.setItem('lastSummaryTime', new Date().toISOString());
                } catch (error) {
                    console.error("Failed to get AI summary:", error);
                    setAiSummary("Your schedule is looking good! Stay focused on your upcoming tasks.");
                }
            } else {
                setAiSummary("No upcoming events scheduled. Enjoy your free time and stay productive!");
            }
        };

        const shouldGenerateSummary = () => {
            const lastSummaryTime = localStorage.getItem('lastSummaryTime');
            if (!lastSummaryTime) return true;

            const lastGenerated = new Date(lastSummaryTime);
            const now = new Date();
            const hourNow = now.getHours();

            // Check if we've crossed a generation threshold (10am or 1am)
            const lastHour = lastGenerated.getHours();
            const isMorningTime = hourNow >= 10 && lastHour < 10;
            const isNightTime = hourNow >= 1 && hourNow < 10 && lastHour >= 10;

            return isMorningTime || isNightTime || (now.getTime() - lastGenerated.getTime() > 12 * 60 * 60 * 1000);
        };

        // Load cached summary or generate new one
        const cachedSummary = localStorage.getItem('lastSummary');
        if (cachedSummary && !shouldGenerateSummary()) {
            setAiSummary(cachedSummary);
        } else {
            generateSummary();
        }

        // Set up interval to check every hour if we need to regenerate
        const interval = setInterval(() => {
            if (shouldGenerateSummary()) {
                generateSummary();
            }
        }, 60 * 60 * 1000); // Check every hour

        return () => clearInterval(interval);
    }, [upcomingEvents.length, userName]);

    const importanceColors = {
        low: 'bg-green-50 text-green-700 border-green-100',
        medium: 'bg-orange-50 text-orange-700 border-orange-100',
        high: 'bg-red-50 text-red-700 border-red-100',
        misc: 'bg-blue-50 text-blue-700 border-blue-100'
    };

    const importanceDots = {
        low: 'bg-green-500',
        medium: 'bg-orange-500',
        high: 'bg-red-500',
        misc: 'bg-blue-500'
    };

    const getGreeting = () => {
        const hour = time.getHours();
        const firstName = userName.split(' ')[0] || 'User';
        if (hour < 12) return `Good Morning, ${firstName}`;
        if (hour < 18) return `Good Afternoon, ${firstName}`;
        return `Good Evening, ${firstName}`;
    };

    return (
        <div className="p-10 space-y-10 h-full overflow-y-auto custom-scrollbar">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl font-bold text-gray-800 mb-3 tracking-tight"
                    >
                        {getGreeting()}
                    </motion.h1>
                    <p className="text-gray-500 text-lg">Here's your daily overview.</p>
                </div>
                <div className="text-right">
                    <h2 className="text-6xl font-bold text-gray-900 tracking-tighter">
                        {format(time, 'h:mm a')}
                    </h2>
                    <p className="text-gray-500 font-medium mt-2 text-lg">
                        {format(time, 'EEEE, MMMM do')}
                    </p>
                </div>
            </div>

            {/* Quick Stats Grid - Resizable */}
            <div ref={containerRef} className="flex flex-col md:flex-row gap-8 h-96 select-none">
                {/* Upcoming Events - Resizable Left Column */}
                <motion.div
                    style={{ width: `${leftWidth}%` }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ y: -5 }}
                    className="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col h-full relative group"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-blue-50 text-blue-600">
                            <CalendarIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Upcoming</p>
                            <h3 className="text-3xl font-bold text-gray-800">{upcomingEvents.length} Events</h3>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {upcomingEvents.length === 0 ? (
                            <p className="text-gray-400 text-sm">No upcoming events.</p>
                        ) : (
                            upcomingEvents.map(({ date, note }) => (
                                <motion.div
                                    key={note.id}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => onNavigateToNote(date, note.id)}
                                    className={clsx(
                                        "p-3 rounded-xl border cursor-pointer transition-colors",
                                        importanceColors[note.importance]
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-sm">{note.title}</span>
                                        <span className="text-xs opacity-70">{format(date, 'MMM d')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs opacity-80">
                                        <div className={clsx("w-1.5 h-1.5 rounded-full", importanceDots[note.importance])} />
                                        <span className="truncate">
                                            {note.summary || note.description || 'No description'}
                                        </span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Resizable Handle */}
                <div
                    className="hidden md:flex w-4 items-center justify-center cursor-col-resize hover:bg-gray-100 rounded-full transition-colors group"
                    onMouseDown={handleMouseDown}
                >
                    <div className="h-12 w-1 bg-gray-300 rounded-full group-hover:bg-blue-400 transition-colors" />
                </div>

                {/* Weekly Trends Graph - Resizable Right Column */}
                <motion.div
                    style={{ width: `${100 - leftWidth}%` }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ y: -5 }}
                    className="p-8 rounded-[2rem] bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 shadow-xl shadow-purple-200/50 flex flex-col h-full"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-purple-100 text-purple-600">
                            <ArrowUpRight className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Weekly Trends</p>
                            <h3 className="text-2xl font-bold text-gray-800">Performance</h3>
                        </div>
                    </div>

                    {/* Trend Graph */}
                    <div className="flex-1 w-full min-h-0">
                        {historicalStats && historicalStats.trendData.length > 0 ? (
                            <TrendChart data={historicalStats.trendData} />
                        ) : (
                            <div className="h-full flex items-center justify-center bg-white/50 rounded-xl border-2 border-dashed border-purple-200">
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-500">Trend Graph</p>
                                    <p className="text-xs text-gray-400 mt-1">No historical data available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Fortnite Creator Stats - Full Width Below */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                whileHover={{ y: -5 }}
                className="p-8 rounded-[2rem] bg-gradient-to-br from-white to-gray-50 border border-white/60 shadow-xl shadow-gray-200/50 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-2xl bg-purple-50 text-purple-600">
                            <Clock className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Fortnite Creative</p>
                            <h3 className="text-3xl font-bold text-gray-800">Live Stats (8 Maps)</h3>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={loadStats}
                        className="px-6 py-3 rounded-xl bg-white border border-gray-100 shadow-lg shadow-gray-100 text-sm font-bold text-gray-700 hover:text-blue-600 transition-colors"
                    >
                        Refresh Data
                    </motion.button>
                </div>

                <div className="grid grid-cols-4 gap-6 relative z-10">
                    <div className="p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400">Total Minutes Played</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {BASELINE_STATS.totalMinutesPlayed.toLocaleString()}
                        </p>
                        <div className="mt-2 text-xs text-gray-400">
                            <span>Across all maps</span>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400">Unique Players</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {BASELINE_STATS.totalUniquePlayers.toLocaleString()}
                        </p>
                        <div className="mt-2 text-xs text-gray-400">
                            <span>Total reach</span>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400">Total Favorites</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {BASELINE_STATS.totalFavorites.toLocaleString()}
                        </p>
                        <div className="mt-2 text-xs text-gray-400">
                            <span>Community love</span>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400">Total Plays</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {BASELINE_STATS.totalLifetimePlays.toLocaleString()}
                        </p>
                        <div className="mt-2 text-xs text-gray-400">
                            <span>Game sessions</span>
                        </div>
                    </div>
                </div>
            </motion.div>


            {/* Bottom Section: Event Summary */}
            <div className="grid grid-cols-1 gap-8">
                {/* Event Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/50"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
                            <ListTodo className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Overview</p>
                            <h3 className="text-2xl font-bold text-gray-800">Your Briefing</h3>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100">
                        <p className="text-lg text-gray-700 leading-relaxed font-medium">
                            {aiSummary || "Analyzing your schedule..."}
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
