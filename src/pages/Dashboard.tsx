import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, ArrowUpRight, ListTodo } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { NotesData, Note } from '../App';
import clsx from 'clsx';
import { BASELINE_STATS, processStatsData, StatsData as HistoricalStatsData } from '../utils/statsManager';
import TrendChart from '../components/TrendChart';
import MaizSticker from '../assets/MaizStudioSticker.png';

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
    const [eventTab, setEventTab] = useState<'upcoming' | 'notCompleted'>('upcoming');

    const convertTo12Hour = (time24: string): string => {
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const getCountdown = (targetDate: Date, eventTime: string): string => {
        const now = new Date();
        
        // Parse event time and create full datetime
        const [hours, minutes] = eventTime.split(':').map(Number);
        const eventDateTime = new Date(targetDate);
        eventDateTime.setHours(hours, minutes, 0, 0);
        
        // Set both dates to start of day for calendar day comparison
        const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        
        const dayDiff = Math.round((targetStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
        
        if (eventDateTime.getTime() < now.getTime()) return 'Past event';
        
        // Check if it's today
        if (dayDiff === 0) {
            const hoursDiff = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursDiff < 1) {
                const minutesDiff = Math.round(hoursDiff * 60);
                if (minutesDiff < 1) return 'Now';
                return `${minutesDiff} minute${minutesDiff !== 1 ? 's' : ''} left`;
            }
            if (hoursDiff < 24) {
                const wholeHours = Math.floor(hoursDiff);
                return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''} left`;
            }
            return 'Today';
        }
        
        if (dayDiff === 1) return 'Tomorrow';
        if (dayDiff === 2) return '2 days';
        if (dayDiff < 7) return `${dayDiff} days`;
        
        const weeks = Math.floor(dayDiff / 7);
        const remainingDays = dayDiff % 7;
        
        if (dayDiff < 30) {
            if (remainingDays === 0) {
                return `${weeks} week${weeks !== 1 ? 's' : ''}`;
            }
            return `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''} left`;
        }
        
        const months = Math.floor(dayDiff / 30);
        if (months === 1) return '1 month away';
        return `${months} months away`;
    };
    
    // Resizable layout state
    const [leftWidth, setLeftWidth] = useState(66); // Percentage
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadSavedWidth = async () => {
            try {
                // @ts-ignore
                const savedWidth = await window.ipcRenderer.invoke('get-device-setting', 'dashboardLeftWidth');
                if (savedWidth) {
                    setLeftWidth(parseFloat(savedWidth));
                }
            } catch (e) {
                console.error('Failed to load divider position', e);
            }
        };
        loadSavedWidth();
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
                // Save to device-specific settings
                // @ts-ignore
                window.ipcRenderer.invoke('save-device-setting', 'dashboardLeftWidth', leftWidth.toString());
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
        const allEvents: { date: Date; note: Note; isOverdue: boolean }[] = [];
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        Object.entries(notes).forEach(([dateStr, dayNotes]) => {
            const date = parseISO(dateStr);
            dayNotes.forEach(note => {
                // Parse the note's time and create full datetime
                const [hours, minutes] = note.time.split(':').map(Number);
                const eventDateTime = new Date(date);
                eventDateTime.setHours(hours, minutes, 0, 0);
                
                const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const isToday = eventDate.getTime() === todayStart.getTime();
                const isOverdue = eventDateTime.getTime() < now.getTime();
                
                // Auto-upgrade to high priority if due today
                if (isToday && note.importance !== 'high') {
                    note.importance = 'high';
                }
                
                // Include all future events and overdue events
                allEvents.push({ date: eventDateTime, note, isOverdue });
            });
        });
        return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
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

    const formatCompactNumber = (num: number) => {
        return new Intl.NumberFormat('en-US', {
            notation: "compact",
            maximumFractionDigits: 1
        }).format(num);
    };

    return (
        <div className="p-10 space-y-10 h-full overflow-y-auto custom-scrollbar">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl font-bold text-gray-800 dark:text-gray-100 mb-3 tracking-tight"
                    >
                        {getGreeting()}
                    </motion.h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Here's your daily overview.</p>
                </div>
                <div className="text-right">
                    <h2 className="text-6xl font-bold text-gray-900 dark:text-gray-100 tracking-tighter">
                        {format(time, 'h:mm a')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 text-lg">
                        {format(time, 'EEEE, MMMM do')}
                    </p>
                </div>
            </div>

            {/* Quick Stats Grid - Resizable */}
            <div ref={containerRef} className="flex flex-col md:flex-row h-96 select-none">
                {/* Upcoming Events - Resizable Left Column */}
                <motion.div
                    style={{ width: `${leftWidth}%` }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
                    }}
                    className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col h-full relative group transition-colors"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/30" style={{ color: 'var(--accent-primary)' }}>
                            <CalendarIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-300 uppercase tracking-wider">Events</p>
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{upcomingEvents.length} Total</h3>
                        </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setEventTab('upcoming')}
                            className={clsx(
                                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                eventTab === 'upcoming'
                                    ? "bg-white dark:bg-gray-700 shadow-md"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            style={eventTab === 'upcoming' ? { color: 'var(--accent-primary)' } : undefined}
                        >
                            Upcoming ({upcomingEvents.filter(e => !e.isOverdue).length})
                        </button>
                        <button
                            onClick={() => setEventTab('notCompleted')}
                            className={clsx(
                                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                eventTab === 'notCompleted'
                                    ? "bg-white dark:bg-gray-700 shadow-md"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            style={eventTab === 'notCompleted' ? { color: 'var(--accent-primary)' } : undefined}
                        >
                            Not Completed ({upcomingEvents.filter(e => e.isOverdue).length})
                        </button>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {upcomingEvents.filter(e => eventTab === 'upcoming' ? !e.isOverdue : e.isOverdue).length === 0 ? (
                            <p className="text-gray-400 dark:text-gray-500 text-sm">{eventTab === 'upcoming' ? 'No upcoming events.' : 'No overdue events.'}</p>
                        ) : (
                            upcomingEvents.filter(e => eventTab === 'upcoming' ? !e.isOverdue : e.isOverdue).slice(0, 10).map(({ date, note }) => (
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
                                        <div className="text-right">
                                            <div className="text-xs opacity-70">{format(date, 'MMM d')} {convertTo12Hour(note.time)}</div>
                                            <div className="text-[10px] opacity-60 font-semibold">{getCountdown(date, note.time)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs opacity-80">
                                        <div className={clsx("w-1.5 h-1.5 rounded-full", importanceDots[note.importance])} />
                                        <span className="break-words">
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
                    className="hidden md:flex w-4 items-center justify-center cursor-col-resize hover:bg-gray-50/50 rounded-full transition-colors group mx-1"
                    onMouseDown={handleMouseDown}
                >
                    <div className="h-12 w-1 bg-gray-200 rounded-full group-hover:bg-blue-400 transition-colors shadow-sm" />
                </div>

                {/* Weekly Trends Graph - Resizable Right Column */}
                <motion.div
                    style={{ width: `calc(${100 - leftWidth}% - 1.5rem)` }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                        boxShadow: '0 20px 60px rgba(147, 51, 234, 0.2)'
                    }}
                    className="p-8 rounded-[2rem] bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800 shadow-xl flex flex-col h-full transition-colors"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <ArrowUpRight className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-300 uppercase tracking-wider">Weekly Trends</p>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Performance</h3>
                        </div>
                    </div>

                    {/* Trend Graph */}
                    <div className="flex-1 w-full min-h-0">
                        {historicalStats && historicalStats.trendData.length > 0 ? (
                            <TrendChart data={historicalStats.trendData} />
                        ) : (
                            <div className="h-full flex items-center justify-center bg-white/50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-700">
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-300">Trend Graph</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">No historical data available</p>
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
                whileHover={{ 
                    y: -8, 
                    scale: 1.01,
                    boxShadow: '0 25px 70px rgba(0, 0, 0, 0.15)'
                }}
                className="p-8 rounded-[2rem] bg-gradient-to-br from-white to-yellow-50/30 dark:from-gray-800 dark:to-purple-900/20 border border-white/60 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative overflow-hidden transition-colors"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl pointer-events-none z-0" />

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-2xl bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm border border-purple-100 dark:border-purple-800">
                            <img src={MaizSticker} alt="Maiz Studio" className="w-16 h-16 object-contain" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fortnite Creative</p>
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Live Stats (8 Maps)</h3>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={loadStats}
                        className="px-6 py-3 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-gray-200 dark:border-gray-600 shadow-lg shadow-gray-100 dark:shadow-gray-900 text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        Refresh Data
                    </motion.button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 relative z-10">
                    <div className="p-6 rounded-2xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm shadow-sm border border-gray-100 dark:border-gray-600">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-300">Total Minutes Played</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white">
                            <span className="hidden xl:inline">{(BASELINE_STATS.totalMinutesPlayed + (stats?.fortnite?.raw?.minutesPlayed || 0)).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(BASELINE_STATS.totalMinutesPlayed + (stats?.fortnite?.raw?.minutesPlayed || 0))}</span>
                        </p>
                        <div className="mt-2 text-xs text-gray-400 dark:text-gray-400">
                            <span>Across all maps</span>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm shadow-sm border border-gray-100 dark:border-gray-600">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-300">Unique Players</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white">
                            <span className="hidden xl:inline">{(BASELINE_STATS.totalUniquePlayers + (stats?.fortnite?.raw?.uniquePlayers || 0)).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(BASELINE_STATS.totalUniquePlayers + (stats?.fortnite?.raw?.uniquePlayers || 0))}</span>
                        </p>
                        <div className="mt-2 text-xs text-gray-400 dark:text-gray-400">
                            <span>Total reach</span>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm shadow-sm border border-gray-100 dark:border-gray-600">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-300">Total Favorites</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white">
                            <span className="hidden xl:inline">{(BASELINE_STATS.totalFavorites + (stats?.fortnite?.raw?.favorites || 0)).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(BASELINE_STATS.totalFavorites + (stats?.fortnite?.raw?.favorites || 0))}</span>
                        </p>
                        <div className="mt-2 text-xs text-gray-400 dark:text-gray-400">
                            <span>Community love</span>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm shadow-sm border border-gray-100 dark:border-gray-600">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-300">Total Plays</p>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white">
                            <span className="hidden xl:inline">{(BASELINE_STATS.totalLifetimePlays + (stats?.fortnite?.raw?.plays || 0)).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(BASELINE_STATS.totalLifetimePlays + (stats?.fortnite?.raw?.plays || 0))}</span>
                        </p>
                        <div className="mt-2 text-xs text-gray-400 dark:text-gray-400">
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
