import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ArrowUpRight, ListTodo, Loader, Circle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { NotesData, Note } from '../App';
import clsx from 'clsx';
import { BASELINE_STATS, processStatsData, StatsData as HistoricalStatsData } from '../utils/statsManager';
import TrendChart from '../components/TrendChart';
import MaizSticker from '../assets/MaizStudioSticker.png';
import ActivityCalendar, { Activity } from 'react-activity-calendar';
import { useTheme } from '../contexts/ThemeContext';
import { fetchGithubContributions } from '../utils/github';

interface DashboardProps {
    notes: NotesData;
    onNavigateToNote: (date: Date, noteId: string) => void;
    userName: string;
    onAddNote: (note: Note, date: Date) => void;
    isLoading?: boolean;
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function Dashboard({ notes, onNavigateToNote, userName, isLoading = false }: DashboardProps) {
    const [time, setTime] = useState(new Date());
    // @ts-ignore
    const [stats, setStats] = useState<any>(null);
    const [historicalStats, setHistoricalStats] = useState<HistoricalStatsData | null>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(() => localStorage.getItem('dashboard_ai_summary'));
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Analyzing your schedule...");
    const [eventTab, setEventTab] = useState<'upcoming' | 'notCompleted'>('upcoming');
    const [contributions, setContributions] = useState<Activity[]>([]);
    const { accentColor, theme } = useTheme();

    useEffect(() => {
        fetchGithubContributions('umfhero', new Date().getFullYear()).then(setContributions);
    }, []);

    const loadingMessages = [
        "Pretending to understand your abbreviations...",
        "Hallucinating... I mean, summarizing...",
        "99% done (the other 1% is making up this percentage)...",
        "Overcomplicating what could've been a bullet list...",
        "Loading your life's lore..."
    ];

    // Effect for loading messages
    useEffect(() => {
        if (!isBriefingLoading) return;
        let index = 0;
        setLoadingMessage(loadingMessages[0]);
        const interval = setInterval(() => {
            index = (index + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[index]);
        }, 2000);
        return () => clearInterval(interval);
    }, [isBriefingLoading]);

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
                
                // Create a copy to avoid mutation
                const effectiveNote = { ...note };
                
                // Auto-upgrade to high priority if due today
                if (isToday && effectiveNote.importance !== 'high') {
                    effectiveNote.importance = 'high';
                }
                
                // Include all future events and overdue events
                allEvents.push({ date: eventDateTime, note: effectiveNote, isOverdue });
            });
        });
        
        // Stable sort
        return allEvents.sort((a, b) => {
            const timeDiff = a.date.getTime() - b.date.getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.note.title.localeCompare(b.note.title);
        });
    };

    const upcomingEvents = getUpcomingEvents();

    // Effect to generate AI summary
    useEffect(() => {
        const fetchBriefing = async () => {
            // If loading, do nothing (wait for data)
            if (isLoading) return;

            // If we have no notes, just set default message and return
            // Do NOT clear cache here, as this might be just the initial loading state
            if (upcomingEvents.length === 0) {
                 setAiSummary("No upcoming events scheduled. Enjoy your free time!");
                 return;
            }

            const eventsHash = JSON.stringify(upcomingEvents.map(e => ({
                id: e.note.id,
                title: e.note.title,
                time: e.note.time,
                date: format(e.date, 'yyyy-MM-dd'),
                importance: e.note.importance
            })));
            
            const cachedHash = localStorage.getItem('dashboard_events_hash');
            const cachedSummary = localStorage.getItem('dashboard_ai_summary');

            // If data hasn't changed and we have a summary, use it and don't fetch
            if (eventsHash === cachedHash && cachedSummary) {
                setAiSummary(cachedSummary);
                return;
            }

            setIsBriefingLoading(true);

            try {
                // @ts-ignore
                const summary = await window.ipcRenderer.invoke('generate-ai-overview', upcomingEvents);
                setAiSummary(summary);
                localStorage.setItem('dashboard_ai_summary', summary);
                localStorage.setItem('dashboard_events_hash', eventsHash);
            } catch (error) {
                console.error("Failed to get AI summary:", error);
                if (!aiSummary) setAiSummary("Unable to generate briefing at this time.");
            } finally {
                setIsBriefingLoading(false);
            }
        };

        fetchBriefing();
        
        // Update every hour
        const interval = setInterval(fetchBriefing, 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, [notes, isLoading]); // Re-run when notes change

    const importanceColors = {
        low: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30',
        medium: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/30',
        high: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30',
        misc: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
    };

    const importanceDots = {
        low: 'bg-green-500',
        medium: 'bg-orange-500',
        high: 'bg-red-500',
        misc: 'bg-blue-500'
    };

    const importanceIconColors = {
        low: 'text-green-500',
        medium: 'text-orange-500',
        high: 'text-red-500',
        misc: 'text-blue-500'
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

    const renderFormattedText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-bold text-indigo-700 dark:text-indigo-400">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
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

            {/* Overview Section: Event Summary */}
            <div className="grid grid-cols-1 gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            <ListTodo className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Overview</p>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Your Briefing</h3>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-900 border border-indigo-100 dark:border-gray-700 min-h-[100px] flex items-center">
                        <AnimatePresence mode="wait">
                            {isBriefingLoading ? (
                                <motion.div 
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-3 text-indigo-600 w-full"
                                >
                                    <Loader className="w-5 h-5 animate-spin flex-shrink-0" />
                                    <motion.p 
                                        key={loadingMessage}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="text-sm font-medium"
                                    >
                                        {loadingMessage}
                                    </motion.p>
                                </motion.div>
                            ) : (
                                <motion.p 
                                    key="content"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed font-medium text-justify w-full"
                                >
                                    {aiSummary ? renderFormattedText(aiSummary) : "Analyzing your schedule..."}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
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
                                    <div className="flex items-start gap-2 text-xs opacity-80">
                                        <Circle className={clsx("w-2 h-2 mt-[3px] flex-shrink-0 fill-current", importanceIconColors[note.importance])} />
                                        <span className="break-words">
                                            {note.description || 'No description'}
                                        </span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Resizable Handle */}
                <div
                    className="hidden md:flex w-4 items-center justify-center cursor-col-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-full transition-colors group mx-1"
                    onMouseDown={handleMouseDown}
                >
                    <div className="h-12 w-1 bg-gray-200 dark:bg-gray-600 rounded-full group-hover:bg-blue-400 transition-colors shadow-sm" />
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

            {/* Github Contributions Graph */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-400 dark:text-gray-300 uppercase tracking-wider">Github Activity</p>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Contributions</h3>
                    </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex justify-center">
                    <ActivityCalendar 
                        data={contributions}
                        colorScheme={theme}
                        theme={(() => {
                            const rgb = hexToRgb(accentColor);
                            if (!rgb) return undefined;
                            const { r, g, b } = rgb;
                            return {
                                light: ['#ebedf0', `rgba(${r}, ${g}, ${b}, 0.4)`, `rgba(${r}, ${g}, ${b}, 0.6)`, `rgba(${r}, ${g}, ${b}, 0.8)`, `rgba(${r}, ${g}, ${b}, 1)`],
                                dark: ['#161b22', `rgba(${r}, ${g}, ${b}, 0.4)`, `rgba(${r}, ${g}, ${b}, 0.6)`, `rgba(${r}, ${g}, ${b}, 0.8)`, `rgba(${r}, ${g}, ${b}, 1)`],
                            };
                        })()}
                        labels={{
                            totalCount: '{{count}} contributions in {{year}}',
                        }}
                        blockSize={12}
                        blockMargin={4}
                        fontSize={12}
                        showWeekdayLabels
                        hideTotalCount
                        hideColorLegend
                    />
                </div>
            </motion.div>

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
        </div>
    );
}
