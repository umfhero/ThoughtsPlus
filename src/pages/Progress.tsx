import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Calendar, Sparkles, AlertCircle, ThumbsUp, ChevronDown, ChevronRight, HelpCircle, X, Crown, Flame, Target, PieChart, ArrowUpRight, Search, Filter, Circle, CheckCircle2, Flag, Trash2 } from 'lucide-react';
import { NotesData, Note, MilestonesData, LifeChaptersData, SnapshotsData, Snapshot } from '../types';
import TaskTrendChart from '../components/TaskTrendChart';
import { useTheme } from '../contexts/ThemeContext';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList
} from 'recharts';
import clsx from 'clsx';
import { format, startOfWeek, endOfWeek, parseISO, isThisWeek, getWeek, addWeeks, getMonth, getYear } from 'date-fns';
import confetti from 'canvas-confetti';

interface ProgressPageProps {
    notes: NotesData;
    milestones?: MilestonesData;
    lifeChapters?: LifeChaptersData;
    snapshots?: SnapshotsData;
    onAddSnapshot?: (snapshot: Snapshot) => void;
    onDeleteSnapshot?: (snapshotId: string) => void;
    isSidebarCollapsed?: boolean;
    onUpdateNote?: (note: Note, date: Date) => void;
}

interface WeekData {
    weekNumber: number;
    weekLabel: string;
    dateRange: string;
    startDate: Date;
    endDate: Date;
    totalTasks: number;
    completedTasks: number;
    lateTasks: number;
    missedTasks: number;
    completionRate: number;
    score: number;
    isCurrentWeek: boolean;
    weekScore: number;
    isEmpty: boolean;
    month: number;
    year: number;
}

interface MonthGroup {
    month: number;
    year: number;
    monthName: string;
    weeks: WeekData[];
    totalTasks: number;
    completedTasks: number;
    avgRate: number;
}

export function ProgressPage({ notes, milestones = {}, lifeChapters: _lifeChapters, snapshots = {}, onAddSnapshot: _onAddSnapshot, onDeleteSnapshot: _onDeleteSnapshot, isSidebarCollapsed = false, onUpdateNote }: ProgressPageProps) {
    const [isMobile, setIsMobile] = useState(false);
    const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
    const [showScoringInfo, setShowScoringInfo] = useState(false);
    const [showStatsPanel, setShowStatsPanel] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null);
    const [trendTimeRange, setTrendTimeRange] = useState<'1D' | '1W' | '1M' | 'ALL'>(() => {
        const saved = localStorage.getItem('taskTrendChart-timeRange');
        return (saved as '1D' | '1W' | '1M' | 'ALL') || '1W';
    });
    const [use24Hour] = useState<boolean>(() => {
        const saved = localStorage.getItem('dashboard_use24HourTime');
        return saved === 'true';
    });
    const [eventTab, setEventTab] = useState<'upcoming' | 'completed' | 'missed'>('upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterImportance, setFilterImportance] = useState<string>('all');
    const { accentColor } = useTheme();
    
    // Snapshot modal state
    const [showSnapshotModal, setShowSnapshotModal] = useState(false);
    const [snapshotType, setSnapshotType] = useState<'monthly' | 'yearly'>('monthly');
    const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);
    const [snapshotContent, setSnapshotContent] = useState('');

    // Get all events from notes, filtered by time range
    const allEvents = useMemo(() => {
        const events: { date: Date; note: Note; isOverdue: boolean; dateKey: string }[] = [];
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate range based on trendTimeRange
        const rangeStart = new Date(today);
        const rangeEnd = new Date(today);

        if (trendTimeRange === '1D') {
            rangeStart.setDate(rangeStart.getDate() - 1);
            rangeEnd.setDate(rangeEnd.getDate() + 1);
        } else if (trendTimeRange === '1W') {
            rangeStart.setDate(rangeStart.getDate() - 7);
            rangeEnd.setDate(rangeEnd.getDate() + 7);
        } else if (trendTimeRange === '1M') {
            rangeStart.setDate(rangeStart.getDate() - 30);
            rangeEnd.setDate(rangeEnd.getDate() + 30);
        }

        Object.entries(notes).forEach(([dateStr, dayNotes]) => {
            const date = parseISO(dateStr);
            dayNotes.forEach(note => {
                const [hours, minutes] = note.time.split(':').map(Number);
                const eventDateTime = new Date(date);
                eventDateTime.setHours(hours, minutes, 0, 0);

                // Filter by time range (unless ALL)
                if (trendTimeRange !== 'ALL') {
                    if (eventDateTime < rangeStart || eventDateTime > rangeEnd) {
                        return;
                    }
                }

                const isOverdue = eventDateTime.getTime() < now.getTime();
                events.push({ date: eventDateTime, note, isOverdue, dateKey: dateStr });
            });
        });

        return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [notes, trendTimeRange]);

    // Filter events based on tab and search
    const filteredEvents = useMemo(() => {
        let filtered = allEvents.filter(event => {
            const matchesSearch = event.note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (event.note.description || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filterImportance === 'all' || event.note.importance === filterImportance;
            return matchesSearch && matchesFilter;
        });

        if (eventTab === 'upcoming') {
            return filtered.filter(e => !e.note.completed && !e.note.missed);
        } else if (eventTab === 'completed') {
            return filtered.filter(e => e.note.completed === true);
        } else {
            return filtered.filter(e => e.note.missed === true);
        }
    }, [allEvents, eventTab, searchQuery, filterImportance]);

    // Count events for tabs
    const eventCounts = useMemo(() => ({
        upcoming: allEvents.filter(e => !e.note.completed && !e.note.missed).length,
        completed: allEvents.filter(e => e.note.completed === true).length,
        missed: allEvents.filter(e => e.note.missed === true).length
    }), [allEvents]);

    // Debounce resize handler
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const checkMobile = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                const sidebarWidth = isSidebarCollapsed ? 0 : 240;
                const availableWidth = window.innerWidth - sidebarWidth;
                setIsMobile(availableWidth < 1100);
            }, 100); // Debounce by 100ms
        };

        checkMobile(); // Initial check
        window.addEventListener('resize', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
            clearTimeout(timeoutId);
        };
    }, [isSidebarCollapsed]);

    const toggleMonth = (monthKey: string) => {
        setCollapsedMonths(prev => {
            const next = new Set(prev);
            if (next.has(monthKey)) {
                next.delete(monthKey);
            } else {
                next.add(monthKey);
            }
            return next;
        });
    };

    // Toggle task completion
    const handleToggleComplete = (noteId: string, dateKey: string, currentCompleted: boolean) => {
        if (!onUpdateNote) return;

        const dayNotes = notes[dateKey] || [];
        const noteToUpdate = dayNotes.find(n => n.id === noteId);

        if (!noteToUpdate) return;

        const updatedNote = {
            ...noteToUpdate,
            completed: !currentCompleted,
            completedLate: !currentCompleted ? false : undefined,
            missed: !currentCompleted ? false : noteToUpdate.missed
        };

        onUpdateNote(updatedNote, parseISO(dateKey));

        // Trigger confetti if completing
        if (!currentCompleted) {
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const colors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

            const frame = () => {
                confetti({
                    particleCount: 2,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.8 },
                    colors: colors,
                    scalar: 0.7
                });
                confetti({
                    particleCount: 2,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.8 },
                    colors: colors,
                    scalar: 0.7
                });

                if (Date.now() < animationEnd) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
    };

    // Get time range label
    const getTimeRangeLabel = () => {
        switch (trendTimeRange) {
            case '1D': return 'today';
            case '1W': return 'this week';
            case '1M': return 'this month';
            case 'ALL': return 'total';
            default: return 'total';
        }
    };


    // Process notes into weekly data with continuous weeks
    const { weeklyData, monthlyGroups, currentWeek, previousWeeks, totalScore, streak, averageRate, bestStreak, isFirstStreak } = useMemo(() => {
        const now = new Date();
        const weekMap = new Map<string, WeekData>();

        // Process all notes
        Object.entries(notes).forEach(([dateStr, dayNotes]) => {
            const date = parseISO(dateStr);
            const weekStart = startOfWeek(date, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            const weekNum = getWeek(date, { weekStartsOn: 1 });

            if (!weekMap.has(weekKey)) {
                const yearSuffix = String(getYear(weekStart)).slice(-2);
                weekMap.set(weekKey, {
                    weekNumber: weekNum,
                    weekLabel: `Week ${weekNum}'${yearSuffix}`,
                    dateRange: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
                    startDate: weekStart,
                    endDate: weekEnd,
                    totalTasks: 0,
                    completedTasks: 0,
                    lateTasks: 0,
                    missedTasks: 0,
                    completionRate: 0,
                    score: 0,
                    isCurrentWeek: isThisWeek(date, { weekStartsOn: 1 }),
                    weekScore: 0,
                    isEmpty: false,
                    month: getMonth(weekStart),
                    year: getYear(weekStart)
                });
            }

            const weekData = weekMap.get(weekKey)!;

            dayNotes.forEach(note => {
                const [hours, minutes] = note.time.split(':').map(Number);
                const taskDateTime = new Date(date);
                taskDateTime.setHours(hours, minutes, 0, 0);
                const isPast = taskDateTime.getTime() < now.getTime();

                // Count ALL tasks for the week (so future weeks with tasks show up)
                weekData.totalTasks++;

                // Check if explicitly marked as missed - this takes precedence
                if (note.missed) {
                    weekData.missedTasks++;
                    weekData.weekScore -= 1;
                } else if (note.completed) {
                    weekData.completedTasks++;
                    if (note.completedLate) {
                        weekData.lateTasks++;
                        weekData.weekScore += 0.5;
                    } else {
                        weekData.weekScore += 1;
                    }
                } else if (isPast && !note.completed) {
                    // Past and not completed and not explicitly missed - auto-missed
                    weekData.missedTasks++;
                    weekData.weekScore -= 1;
                }
                // Future uncompleted tasks don't affect score yet
            });
        });

        // Get weeks with tasks, sorted by date
        const weeksWithTasks = Array.from(weekMap.values())
            .filter(w => w.totalTasks > 0)
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        if (weeksWithTasks.length === 0) {
            return {
                weeklyData: [],
                monthlyGroups: [],
                currentWeek: undefined,
                previousWeeks: [],
                totalScore: 0,
                streak: 0,
                averageRate: 0
            };
        }

        // Get first and last week with tasks (include future weeks too)
        const firstWeekWithTasks = weeksWithTasks[0].startDate;
        const lastWeekWithTasks = weeksWithTasks[weeksWithTasks.length - 1].startDate;
        const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });

        // Show up to whichever is later: current week or last week with tasks
        const lastWeekToShow = lastWeekWithTasks > currentWeekStart ? lastWeekWithTasks : currentWeekStart;

        // Build continuous week array from first week to current/last week
        const allWeeks: WeekData[] = [];
        let currentWeekPointer = new Date(firstWeekWithTasks);

        while (currentWeekPointer <= lastWeekToShow) {
            const weekStart = startOfWeek(currentWeekPointer, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(currentWeekPointer, { weekStartsOn: 1 });
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            const weekNum = getWeek(currentWeekPointer, { weekStartsOn: 1 });

            const existingWeek = weekMap.get(weekKey);

            if (existingWeek && existingWeek.totalTasks > 0) {
                allWeeks.push({
                    ...existingWeek,
                    completionRate: existingWeek.totalTasks > 0
                        ? Math.round((existingWeek.completedTasks / existingWeek.totalTasks) * 100)
                        : 0
                });
            } else {
                // Empty week
                const yearSuffix = String(getYear(weekStart)).slice(-2);
                allWeeks.push({
                    weekNumber: weekNum,
                    weekLabel: `Week ${weekNum}'${yearSuffix}`,
                    dateRange: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
                    startDate: weekStart,
                    endDate: weekEnd,
                    totalTasks: 0,
                    completedTasks: 0,
                    lateTasks: 0,
                    missedTasks: 0,
                    completionRate: 0,
                    score: 0,
                    isCurrentWeek: isThisWeek(currentWeekPointer, { weekStartsOn: 1 }),
                    weekScore: 0,
                    isEmpty: true,
                    month: getMonth(weekStart),
                    year: getYear(weekStart)
                });
            }

            currentWeekPointer = addWeeks(currentWeekPointer, 1);
        }

        // Calculate running score
        let runningScore = 0;
        allWeeks.forEach(week => {
            runningScore += week.weekScore;
            week.score = runningScore;
        });

        // Group by month for calendar view
        const monthMap = new Map<string, MonthGroup>();
        allWeeks.forEach(week => {
            const monthKey = `${week.year}-${week.month}`;
            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, {
                    month: week.month,
                    year: week.year,
                    monthName: format(new Date(week.year, week.month, 1), 'MMMM yyyy'),
                    weeks: [],
                    totalTasks: 0,
                    completedTasks: 0,
                    avgRate: 0
                });
            }
            const monthGroup = monthMap.get(monthKey)!;
            monthGroup.weeks.push(week);
            monthGroup.totalTasks += week.totalTasks;
            monthGroup.completedTasks += week.completedTasks;
        });

        // Calculate average rate for each month
        const sortedMonths = Array.from(monthMap.values())
            .map(m => ({
                ...m,
                avgRate: m.totalTasks > 0 ? Math.round((m.completedTasks / m.totalTasks) * 100) : 0
            }))
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });

        // Find current week and previous weeks
        const currentWeekData = allWeeks.find(w => w.isCurrentWeek);
        const previousWeeksData = allWeeks.filter(w => !w.isCurrentWeek && w.startDate < now && !w.isEmpty);

        // Calculate streak (consecutive weeks with >= 70% completion, only counting non-empty weeks)
        // Calculate streak (consecutive weeks with 0 missed tasks, only counting non-empty past/current weeks)
        let streakCount = 0;
        // Filter to only include weeks that have started (start date <= now)
        const validStreakWeeks = allWeeks.filter(w => !w.isEmpty && w.startDate <= now);

        for (let i = validStreakWeeks.length - 1; i >= 0; i--) {
            // Count as streak if no tasks were missed
            if (validStreakWeeks[i].missedTasks === 0) {
                streakCount++;
            } else {
                break;
            }
        }

        // Calculate BEST streak (all-time longest streak of 0 missed tasks)
        let maxStreak = 0;
        let currentRun = 0;
        // Iterate through all valid weeks chronologically
        validStreakWeeks.forEach(week => {
            if (week.missedTasks === 0) {
                currentRun++;
            } else {
                maxStreak = Math.max(maxStreak, currentRun);
                currentRun = 0;
            }
        });
        // Check finding after loop
        maxStreak = Math.max(maxStreak, currentRun);

        // Determine showing logic
        // "if its the users first streak don't show anything" -> means if we never had a break?
        // Actually, if maxStreak == streakCount, and (streakCount == validStreakWeeks.length or similar?)
        // Let's interpret "first streak" as: if the number of distinct streaks is 1.

        let streakGroups = 0;
        let isStreak = false;
        validStreakWeeks.forEach(week => {
            if (week.missedTasks === 0) {
                if (!isStreak) {
                    streakGroups++;
                    isStreak = true;
                }
            } else {
                isStreak = false;
            }
        });

        // Calculate average completion rate (only non-empty weeks)
        const nonEmptyWeeksForAvg = allWeeks.filter(w => !w.isEmpty);
        const avgRate = nonEmptyWeeksForAvg.length > 0
            ? Math.round(nonEmptyWeeksForAvg.reduce((sum, w) => sum + w.completionRate, 0) / nonEmptyWeeksForAvg.length)
            : 0;

        return {
            weeklyData: allWeeks,
            monthlyGroups: sortedMonths,
            currentWeek: currentWeekData,
            previousWeeks: previousWeeksData,
            totalScore: runningScore,
            streak: streakCount,
            bestStreak: maxStreak,
            isFirstStreak: streakGroups <= 1,
            averageRate: avgRate
        };
    }, [notes]);

    // Initialize collapsed months - all collapsed except current month
    useEffect(() => {
        if (monthlyGroups.length > 0) {
            const now = new Date();
            const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
            const allMonthKeys = monthlyGroups.map(m => `${m.year}-${m.month}`);
            const collapsedSet = new Set(allMonthKeys.filter(key => key !== currentMonthKey));
            setCollapsedMonths(collapsedSet);
        }
    }, [monthlyGroups.length]); // Only run when monthlyGroups changes

    // Calculate comparison to last week
    const lastWeek = previousWeeks[previousWeeks.length - 1];
    const weekComparison = currentWeek && lastWeek
        ? currentWeek.completionRate - lastWeek.completionRate
        : 0;

    // Get rate color
    // Get rate color
    const getRateColor = (rate: number, missedTasks: number = 0) => {
        // If there are NO missed tasks, show green (on track), unless rate is low AND there are missed tasks
        // Actually, user says: "Unless missed, it should not be red".
        // If rate is < 40% but missed is 0 (i.e. everything is pending), it should be Green (on track).
        if (missedTasks === 0) return { text: 'text-emerald-500', bg: 'bg-emerald-500', hex: '#10b981' };

        // If tasks are missed, then we use the rate logic (or maybe red if ANY missed? User said "if its missed, red")
        // But user also said "done but late orange".
        // Let's stick to rate logic for the rest, but prioritize "No Missed" = Green.

        if (rate >= 70) return { text: 'text-emerald-500', bg: 'bg-emerald-500', hex: '#10b981' };

        // If rate is low due to late tasks (but not missed), maybe orange?
        // But the first check (missedTasks === 0) handles cases where simple completion is 0 but nothing missed.
        // If we fall through here, missedTasks > 0.

        if (rate >= 40) return { text: 'text-amber-500', bg: 'bg-amber-500', hex: '#f59e0b' };

        // Low rate AND missed tasks -> Red
        return { text: 'text-rose-500', bg: 'bg-rose-500', hex: '#f43f5e' };
    };

    // Chart data (only non-empty weeks for cleaner charts) - Memoized
    const chartData = useMemo(() => weeklyData
        .filter(week => !week.isEmpty)
        .map(week => {
            const yearSuffix = String(week.year).slice(-2);
            return {
                name: `W${week.weekNumber}'${yearSuffix}`,
                fullName: week.weekLabel,
                dateRange: week.dateRange,
                completed: week.completedTasks,
                late: week.lateTasks,
                missed: week.missedTasks,
                rate: week.completionRate,
                // Give 0% weeks a minimum visible height so they show in chart
                displayRate: week.completionRate === 0 ? 3 : week.completionRate,
                score: week.score,
                weekScore: week.weekScore,
                isCurrentWeek: week.isCurrentWeek,
                year: week.year
            };
        }), [weeklyData]);

    // Snapshot generation handler with caching
    const handleGenerateSnapshot = async () => {
        if (!_onAddSnapshot) return;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        // Generate period key based on type
        const periodKey = snapshotType === 'monthly' 
            ? `monthly-${year}-${month.toString().padStart(2, '0')}`
            : `yearly-${year}`;
        
        // Check if snapshot already exists (optimization to avoid repeated API calls)
        if (snapshots[periodKey]) {
            setSnapshotContent(snapshots[periodKey].content);
            return;
        }
        
        setIsGeneratingSnapshot(true);
        
        try {
            // Check API key first
            // @ts-ignore
            const apiKey = await window.ipcRenderer.invoke('get-api-key');
            if (!apiKey) {
                alert('Please configure your API Key in settings to generate snapshots.');
                setIsGeneratingSnapshot(false);
                return;
            }
            
            // Prepare data for the period
            const startDate = snapshotType === 'monthly'
                ? new Date(year, month - 1, 1)
                : new Date(year, 0, 1);
            const endDate = snapshotType === 'monthly'
                ? new Date(year, month, 0)
                : new Date(year, 11, 31);
            
            // Get tasks from the period
            const periodTasks: { date: string; tasks: Note[] }[] = [];
            Object.entries(notes).forEach(([dateStr, tasks]) => {
                const date = parseISO(dateStr);
                if (date >= startDate && date <= endDate) {
                    periodTasks.push({ date: dateStr, tasks });
                }
            });
            
            // Calculate statistics
            const totalTasks = periodTasks.flatMap(d => d.tasks).length;
            const completedTasks = periodTasks.flatMap(d => d.tasks).filter(t => t.completed).length;
            const missedTasks = periodTasks.flatMap(d => d.tasks).filter(t => t.missed).length;
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            
            // Get milestones in period
            const periodMilestones = Object.entries(milestones)
                .filter(([dateStr]) => {
                    const date = parseISO(dateStr);
                    return date >= startDate && date <= endDate;
                })
                .flatMap(([_, ms]) => ms);
            
            // Generate AI snapshot with minimal token usage
            const prompt = `Generate a brief ${snapshotType} retrospective (max 3 sentences) for ${snapshotType === 'monthly' ? format(startDate, 'MMMM yyyy') : year}. Stats: ${totalTasks} tasks (${completionRate}% completion), ${missedTasks} missed${periodMilestones.length > 0 ? `, ${periodMilestones.length} milestones achieved` : ''}. Be concise and encouraging.`;
            
            // @ts-ignore
            const response = await window.ipcRenderer.invoke('generate-ai-text', { prompt, maxTokens: 100 });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            setSnapshotContent(response.text);
        } catch (error: any) {
            console.error('Snapshot generation error:', error);
            alert(`Failed to generate snapshot: ${error.message || 'Unknown error'}`);
        } finally {
            setIsGeneratingSnapshot(false);
        }
    };
    
    const handleSaveSnapshot = () => {
        if (!_onAddSnapshot || !snapshotContent.trim()) return;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        const dateStr = snapshotType === 'monthly'
            ? `${year}-${month.toString().padStart(2, '0')}-01`
            : `${year}-01-01`;
        
        const periodKey = snapshotType === 'monthly'
            ? `monthly-${year}-${month.toString().padStart(2, '0')}`
            : `yearly-${year}`;
        
        const snapshot: Snapshot = {
            id: periodKey,
            type: snapshotType,
            date: dateStr,
            content: snapshotContent.trim()
        };
        
        _onAddSnapshot(snapshot);
        setShowSnapshotModal(false);
        setSnapshotContent('');
    };

    // Stats Panel Content (reused for both desktop and mobile)
    const StatsContent = ({ stretch = false }: { stretch?: boolean }) => (
        <div className={clsx("flex flex-col gap-3", stretch && "h-full")}>
            {/* Current Week Card */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className={clsx("p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 relative overflow-hidden", stretch && "flex-1")}
            >
                <div className="absolute -bottom-2 -right-2 opacity-[0.07] rotate-[15deg]">
                    <Target className="w-16 h-16 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">This Week</h3>
                </div>
                <div className="flex items-end gap-2 relative z-10">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentWeek?.completionRate ?? 0}%</p>
                    {weekComparison !== 0 && (
                        <div className={clsx("flex items-center gap-0.5 text-xs font-medium mb-0.5",
                            (currentWeek?.missedTasks === 0) ? "text-emerald-500" : (weekComparison > 0 ? "text-emerald-500" : "text-rose-500")
                        )}>
                            {weekComparison > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {weekComparison > 0 ? '+' : ''}{weekComparison}%
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 relative z-10">
                    {currentWeek?.completedTasks ?? 0}/{currentWeek?.totalTasks ?? 0} tasks
                </p>
            </motion.div>

            {/* Total Score Card */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className={clsx("p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 relative overflow-hidden", stretch && "flex-1")}
            >
                <div className="absolute -bottom-2 -right-2 opacity-[0.07] rotate-[-15deg]">
                    <Crown className="w-16 h-16 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Total Score</h3>
                <p className={clsx("text-2xl font-bold relative z-10", totalScore >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {totalScore >= 0 ? '+' : ''}{totalScore.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cumulative</p>
            </motion.div>

            {/* Streak Card */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className={clsx("p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 relative overflow-hidden", stretch && "flex-1")}
            >
                <div className="absolute -bottom-4 -right-4 opacity-[0.07] rotate-[-15deg]">
                    <Flame className="w-20 h-20 text-yellow-500 dark:text-yellow-400" />
                </div>
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Streak</h3>
                <div className="flex flex-col relative z-10">
                    <div className="flex items-end gap-1">
                        <p className={clsx("text-2xl font-bold", streak > 0 ? "text-amber-500" : "text-gray-400")}>{streak}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weeks</p>
                    </div>
                    {/* Best Streak Logic */}
                    {!isFirstStreak && (
                        <div className="mt-1">
                            {streak >= (bestStreak ?? 0) && streak > 0 ? (
                                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    New Record!
                                </span>
                            ) : (bestStreak ?? 0) > 0 ? (
                                <span className="text-[10px] font-medium text-gray-400">
                                    Best: {bestStreak} Weeks
                                </span>
                            ) : null}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Average Rate Card */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className={clsx("p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 relative overflow-hidden", stretch && "flex-1")}
            >
                <div className="absolute -bottom-4 -right-4 opacity-[0.07] rotate-[-15deg]">
                    <PieChart className="w-20 h-20 text-gray-500 dark:text-gray-400" />
                </div>
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Average</h3>
                <p className={clsx("text-2xl font-bold relative z-10", getRateColor(averageRate, 0).text)}>{averageRate}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All-time</p>
            </motion.div>
        </div>
    );

    return (
        <div className="h-full flex">
            {/* Main Content */}
            <div className="flex-1 p-4 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Progress Tracker</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Weekly progress analysis</p>
                    </div>
                    {isMobile && (
                        <button
                            onClick={() => setShowStatsPanel(true)}
                            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Show stats"
                        >
                            <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Main content area - fills remaining space */}
                <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-auto">

                    {/* Calendar + Stats Row */}
                    <div className="flex gap-4">
                        {/* Monthly Calendar View */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="flex-1 p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 relative overflow-hidden"
                        >
                            <div className="absolute -top-6 -left-6 opacity-[0.04] rotate-[-15deg] pointer-events-none">
                                <Calendar className="w-40 h-40 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Progress Calendar</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Weekly overview of months with active tasks</p>
                                    </div>
                                </div>
                                {/* Legend */}
                                {/* Help Button */}
                                <div>
                                    <button
                                        onClick={() => setShowScoringInfo(true)}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 relative z-10"
                                        title="View Scoring"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {monthlyGroups.length > 0 ? (
                                <div className="space-y-6">
                                    {[...monthlyGroups].reverse().map((monthGroup, mIndex) => {
                                        const monthKey = `${monthGroup.year}-${monthGroup.month}`;
                                        const isCollapsed = collapsedMonths.has(monthKey);
                                        return (
                                            <motion.div
                                                key={monthKey}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.05 * mIndex }}
                                                className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                                            >
                                                {/* Month Header - Clickable */}
                                                <button
                                                    onClick={() => toggleMonth(monthKey)}
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {isCollapsed ? (
                                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-gray-400" />
                                                        )}
                                                        <div className="flex items-baseline gap-2">
                                                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">{monthGroup.monthName.split(' ')[0]}</h3>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">{monthGroup.year}</span>
                                                        </div>
                                                        {monthGroup.totalTasks > 0 && (
                                                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{monthGroup.completedTasks}/{monthGroup.totalTasks} tasks</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                                                            {monthGroup.weeks.filter(w => !w.isEmpty).length} {monthGroup.weeks.filter(w => !w.isEmpty).length === 1 ? 'week' : 'weeks'} with tasks
                                                        </span>
                                                        {monthGroup.totalTasks > 0 && (
                                                            <span className={clsx("text-sm font-bold px-2 py-0.5 rounded-full", getRateColor(monthGroup.avgRate, monthGroup.weeks.reduce((acc, w) => acc + w.missedTasks, 0)).text, getRateColor(monthGroup.avgRate, monthGroup.weeks.reduce((acc, w) => acc + w.missedTasks, 0)).bg + '/20')}>
                                                                {monthGroup.avgRate}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>

                                                {/* Weeks Grid - Collapsible */}
                                                {!isCollapsed && (
                                                    <div className="p-4 flex flex-wrap gap-3">
                                                        {monthGroup.weeks.map((week) => (
                                                            <div
                                                                key={week.weekLabel + week.dateRange}
                                                                onClick={() => setSelectedWeek(week)}
                                                                className={clsx(
                                                                    "p-3 rounded-xl border transition-all relative cursor-pointer hover:shadow-md",
                                                                    week.isEmpty
                                                                        ? "bg-gray-50 dark:bg-gray-700/20 border-gray-100 dark:border-gray-700 opacity-60"
                                                                        : week.isCurrentWeek
                                                                            ? "border-2"
                                                                            : "bg-gray-50/50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                                                                )}
                                                                style={{
                                                                    borderColor: week.isCurrentWeek ? '#10b981' : undefined,
                                                                    // Active weeks get 2x growth factor and larger base width (280px)
                                                                    // Empty weeks get 1x growth factor and smaller base width (180px)
                                                                    flex: week.isEmpty ? '1 1 180px' : '2 1 280px',
                                                                    minWidth: '180px',
                                                                    height: '160px' // Fixed height for uniform look
                                                                }}
                                                            >
                                                                {/* Current week indicator */}
                                                                {week.isCurrentWeek && (
                                                                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse bg-emerald-500" />
                                                                )}

                                                                {/* Week header */}
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">W{week.weekNumber}'{String(week.year).slice(-2)}</span>
                                                                    {!week.isEmpty && (
                                                                        <div className={clsx("w-2.5 h-2.5 rounded-full", getRateColor(week.completionRate, week.missedTasks).bg)} />
                                                                    )}
                                                                    {week.isEmpty && (
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-600" />
                                                                    )}
                                                                </div>

                                                                {/* Date range */}
                                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">{week.dateRange}</p>

                                                                {!week.isEmpty ? (
                                                                    <>
                                                                        {/* Completion rate */}
                                                                        <p className={clsx("text-lg font-bold", getRateColor(week.completionRate, week.missedTasks).text)}>
                                                                            {week.completionRate}%
                                                                        </p>

                                                                        {/* Task counts - completed, late, missed, pending */}
                                                                        {(() => {
                                                                            const pendingTasks = week.totalTasks - week.completedTasks - week.missedTasks;
                                                                            return (
                                                                                <>
                                                                                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                                                                                        <span className="text-emerald-500">{week.completedTasks - week.lateTasks}</span>
                                                                                        <span className="text-amber-500">{week.lateTasks}</span>
                                                                                        <span className="text-rose-500">{week.missedTasks}</span>
                                                                                        {pendingTasks > 0 && <span className="text-gray-400">{pendingTasks}</span>}
                                                                                    </div>

                                                                                    {/* Mini progress bar */}
                                                                                    <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                                        <div className="h-full flex">
                                                                                            <div className="bg-emerald-500" style={{ width: `${week.totalTasks > 0 ? ((week.completedTasks - week.lateTasks) / week.totalTasks) * 100 : 0}%` }} />
                                                                                            <div className="bg-amber-500" style={{ width: `${week.totalTasks > 0 ? (week.lateTasks / week.totalTasks) * 100 : 0}%` }} />
                                                                                            <div className="bg-rose-500" style={{ width: `${week.totalTasks > 0 ? (week.missedTasks / week.totalTasks) * 100 : 0}%` }} />
                                                                                            {/* Pending tasks shown as gray */}
                                                                                            <div className="bg-gray-300 dark:bg-gray-500" style={{ width: `${week.totalTasks > 0 ? (pendingTasks / week.totalTasks) * 100 : 0}%` }} />
                                                                                        </div>
                                                                                    </div>
                                                                                </>
                                                                            );
                                                                        })()}

                                                                        {/* Badges - show for all weeks */}
                                                                        <div className="mt-2 flex items-center gap-1 text-[10px]">
                                                                            {week.isCurrentWeek ? (
                                                                                <span className="px-1.5 py-0.5 rounded font-medium bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                                    Current
                                                                                </span>
                                                                            ) : week.completionRate === 100 && week.missedTasks === 0 ? (
                                                                                <span className="px-1.5 py-0.5 rounded font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                                                    <Sparkles className="w-3 h-3" /> Perfect
                                                                                </span>
                                                                            ) : week.missedTasks === 0 ? (
                                                                                <span className="px-1.5 py-0.5 rounded font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                                                    Good
                                                                                </span>
                                                                            ) : week.completionRate < 40 ? (
                                                                                <span className="px-1.5 py-0.5 rounded font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                                                    <AlertCircle className="w-3 h-3" /> Low
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-1.5 py-0.5 rounded font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                                                    <ThumbsUp className="w-3 h-3" /> OK
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No tasks</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                                }
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-medium">No weekly data yet</p>
                                    <p className="text-sm">Complete some tasks to see your progress!</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Stats Panel - inline with calendar */}
                        {!isMobile && (
                            <div className="w-44 shrink-0">
                                <StatsContent stretch />
                            </div>
                        )}
                    </div>

                    {/* Weekly Completion Chart */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7 }}
                        className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex-1 min-h-[200px] flex flex-col relative overflow-hidden"
                    >
                        <div className="absolute -top-6 -left-6 opacity-[0.04] rotate-[-15deg] pointer-events-none">
                            <TrendingUp className="w-40 h-40 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="flex items-center gap-4 mb-4 relative z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Weekly Completion</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Completion rate by week</p>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 20 }}>
                                        <XAxis
                                            dataKey="name"
                                            stroke="transparent"
                                            tickLine={false}
                                            axisLine={false}
                                            interval={0}
                                            tick={(props: any) => {
                                                const { x, y, payload } = props;
                                                // Find the data point for this week name to check if it's current
                                                const isCurrent = chartData.find(d => d.name === payload.value)?.isCurrentWeek;

                                                return (
                                                    <g transform={`translate(${x},${y})`}>
                                                        <text x={0} y={0} dy={16} textAnchor="middle" fill="#9ca3af" fontSize={11}>
                                                            {payload.value}
                                                        </text>
                                                        {isCurrent && (
                                                            <text x={0} y={0} dy={30} textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize={10} fontWeight="bold">
                                                                Current
                                                            </text>
                                                        )}
                                                    </g>
                                                );
                                            }}
                                        />
                                        <YAxis stroke="transparent" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                        <Tooltip
                                            cursor={false}
                                            wrapperStyle={{ outline: 'none' }}
                                            contentStyle={{ backgroundColor: 'transparent', border: 'none', padding: 0 }}
                                            content={({ payload }) => {
                                                if (!payload || !payload[0]) return null;
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 min-w-[200px]">
                                                        <div className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                                                            {data.fullName}
                                                            {data.isCurrentWeek && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Current</span>}
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{data.dateRange}</p>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500 dark:text-gray-400">Completion:</span>
                                                                <span className={clsx("font-bold", getRateColor(data.rate, data.missed).text)}>{data.rate}%</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-emerald-500">Completed:</span>
                                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{data.completed}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-amber-500">Late:</span>
                                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{data.late}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-rose-500">Missed:</span>
                                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{data.missed}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Bar
                                            dataKey="displayRate"
                                            radius={[6, 6, 0, 0]}
                                            barSize={32}
                                            activeBar={{ filter: 'brightness(0.85)' }}
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.isCurrentWeek ? '#10b981' : getRateColor(entry.rate, entry.missed).hex}
                                                    opacity={entry.isCurrentWeek ? 1 : 0.85}
                                                />
                                            ))}
                                            <LabelList
                                                dataKey="rate"
                                                position="top"
                                                fontSize={10}
                                                fill="#9ca3af"
                                                formatter={(val: any) => `${val}%`}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <p>No data available</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Events This Week + Task Trends Row (Top Row of 2x2 Grid) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Events This Week */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.8 }}
                            className="flex-1 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 min-h-[300px] flex flex-col relative overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        {allEvents.length} events {getTimeRangeLabel()}
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                    <Sparkles className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                <button
                                    onClick={() => setEventTab('upcoming')}
                                    className={clsx(
                                        "flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                        eventTab === 'upcoming'
                                            ? "bg-white dark:bg-gray-700 shadow-md"
                                            : "bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    )}
                                    style={eventTab === 'upcoming' ? { color: accentColor } : undefined}
                                >
                                    {eventCounts.upcoming} Tasks
                                </button>
                                <button
                                    onClick={() => setEventTab('completed')}
                                    className={clsx(
                                        "flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                        eventTab === 'completed'
                                            ? "bg-white dark:bg-gray-700 shadow-md"
                                            : "bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    )}
                                    style={eventTab === 'completed' ? { color: accentColor } : undefined}
                                >
                                    {eventCounts.completed} Completed
                                </button>
                                <button
                                    onClick={() => setEventTab('missed')}
                                    className={clsx(
                                        "flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                        eventTab === 'missed'
                                            ? "bg-white dark:bg-gray-700 shadow-md"
                                            : "bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    )}
                                    style={eventTab === 'missed' ? { color: accentColor } : undefined}
                                >
                                    {eventCounts.missed} Missed
                                </button>
                            </div>

                            {/* Search and Filter */}
                            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search events..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-800 dark:text-gray-200"
                                    />
                                </div>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select
                                        value={filterImportance}
                                        onChange={(e) => setFilterImportance(e.target.value)}
                                        className="w-full sm:w-auto pl-9 pr-8 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer text-gray-800 dark:text-gray-200"
                                    >
                                        <option value="all">All</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                            </div>

                            {/* Events List */}
                            <div className="space-y-3 flex-1 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
                                {filteredEvents.length === 0 ? (
                                    <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
                                        {eventTab === 'upcoming' ? 'No upcoming tasks.' : eventTab === 'completed' ? 'No completed events.' : 'No missed events.'}
                                    </p>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {filteredEvents.slice(0, 10).map((event) => {
                                            const { date, note, dateKey, isOverdue } = event;
                                            const importanceColors: Record<string, string> = {
                                                high: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50',
                                                medium: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50',
                                                low: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50',
                                            };
                                            const importanceIconColors: Record<string, string> = {
                                                high: 'text-red-500',
                                                medium: 'text-amber-500',
                                                low: 'text-green-500',
                                            };
                                            return (
                                                <motion.div
                                                    key={`${dateKey}-${note.id}`}
                                                    layout
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, x: 30 }}
                                                    transition={{ duration: 0.15 }}
                                                    className={clsx(
                                                        "p-3 rounded-xl border transition-all relative overflow-hidden",
                                                        note.completed
                                                            ? note.completedLate
                                                                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50"
                                                                : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50"
                                                            : note.missed
                                                                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50"
                                                                : isOverdue
                                                                    ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm"
                                                                    : importanceColors[note.importance] || 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                                                    )}
                                                >
                                                    {/* Overdue Alert Banner */}
                                                    {isOverdue && !note.completed && !note.missed && (
                                                        <div className="absolute top-0 left-0 right-0 h-7 bg-red-500 text-white text-xs font-bold px-3 flex items-center justify-between z-10">
                                                            <span>OVERDUE</span>
                                                        </div>
                                                    )}

                                                    <div className={clsx("flex items-start gap-3", isOverdue && !note.completed && !note.missed && "pt-7")}>
                                                        {/* Completion Checkbox */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                handleToggleComplete(note.id, dateKey, note.completed || false);
                                                            }}
                                                            className={clsx(
                                                                "p-1.5 -m-1.5 rounded-lg transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:scale-90",
                                                                note.completed
                                                                    ? note.completedLate
                                                                        ? "text-amber-500 hover:text-amber-600"
                                                                        : "text-green-500 hover:text-green-600"
                                                                    : note.missed
                                                                        ? "text-red-500"
                                                                        : "text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500"
                                                            )}
                                                            title={note.completed ? "Mark as incomplete" : "Mark as completed"}
                                                        >
                                                            {note.completed ? (
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            ) : note.missed ? (
                                                                <X className="w-5 h-5" />
                                                            ) : (
                                                                <Circle className="w-5 h-5" />
                                                            )}
                                                        </button>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={clsx(
                                                                        "font-bold text-sm",
                                                                        note.completed && "line-through text-gray-500 dark:text-gray-400"
                                                                    )}>
                                                                        {note.title}
                                                                    </span>
                                                                </div>
                                                                <div className="text-right flex flex-col items-end gap-1">
                                                                    <div className="text-xs opacity-70">{format(date, 'MMM d')} {note.time}</div>
                                                                    {note.completed ? (
                                                                        <span className={clsx(
                                                                            "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                                                                            note.completedLate
                                                                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                                                                                : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                                                        )}>
                                                                            {note.completedLate ? 'Late' : 'On Time'}
                                                                        </span>
                                                                    ) : !isOverdue ? (
                                                                        <div className="text-[10px] opacity-60 font-semibold">
                                                                            {(() => {
                                                                                const now = new Date();
                                                                                const diff = date.getTime() - now.getTime();
                                                                                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                                                                if (days === 0) return 'Today';
                                                                                if (days === 1) return 'Tomorrow';
                                                                                if (days < 7) return `${days} days`;
                                                                                const weeks = Math.floor(days / 7);
                                                                                return `${weeks} week${weeks > 1 ? 's' : ''}`;
                                                                            })()}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-start gap-2 text-xs opacity-80">
                                                                {!note.completed && (
                                                                    <Circle className={clsx("w-2 h-2 mt-[3px] flex-shrink-0 fill-current", importanceIconColors[note.importance as keyof typeof importanceIconColors])} />
                                                                )}
                                                                <span className={clsx(
                                                                    "break-words line-clamp-2",
                                                                    note.completed && "text-gray-500 dark:text-gray-400"
                                                                )}>
                                                                    {note.description || 'No description'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                )}
                            </div>
                        </motion.div>

                        {/* Task Trend Chart */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.9 }}
                            className="w-full p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 min-h-[300px] flex flex-col relative overflow-hidden"
                        >
                            <div className="absolute -top-6 -right-6 opacity-[0.04] rotate-[15deg] pointer-events-none">
                                <ArrowUpRight className="w-40 h-40 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Task trends</p>
                                </div>
                                <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="flex-1 min-h-0">
                                {Object.keys(notes).length === 0 ? (
                                    <div className="h-full flex items-center justify-center bg-white/50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                        <div className="text-center py-6 px-4">
                                            <ArrowUpRight className="w-12 h-12 mb-3 mx-auto text-gray-300 dark:text-gray-600" />
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">No Tasks Yet</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-400">Add some events to see your completion trends</p>
                                        </div>
                                    </div>
                                ) : (
                                    <TaskTrendChart
                                        notes={notes}
                                        timeRange={trendTimeRange}
                                        onTimeRangeChange={(newRange) => setTrendTimeRange(newRange)}
                                    />
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Snapshots + Milestones Row (Bottom Row of 2x2 Grid) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Snapshots Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.1 }}
                            className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 relative overflow-hidden min-h-[450px] flex flex-col"
                        >
                            <div className="absolute -top-6 -right-6 opacity-[0.04] rotate-[15deg] pointer-events-none">
                                <Target className="w-40 h-40 text-blue-500" />
                            </div>
                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 rounded-full bg-blue-500"></div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Snapshots</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Monthly & Yearly Retrospectives</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowSnapshotModal(true)}
                                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    + Create Snapshot
                                </button>
                            </div>

                            {Object.keys(snapshots).length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                                    <p className="text-gray-400 text-sm">No snapshots yet.</p>
                                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Capture your progress every month or year.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                                    {Object.values(snapshots)
                                        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()) // Newest first
                                        .map(snapshot => (
                                        <div key={snapshot.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-800 transition-colors group">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-medium text-gray-800 dark:text-gray-100">
                                                    {snapshot.type === 'monthly' 
                                                        ? format(parseISO(snapshot.date), 'MMMM yyyy')
                                                        : format(parseISO(snapshot.date), 'yyyy')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        "text-xs px-2 py-0.5 rounded-full font-medium",
                                                        snapshot.type === 'monthly' 
                                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                            : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                                    )}>
                                                        {snapshot.type === 'monthly' ? 'Monthly' : 'Yearly'}
                                                    </span>
                                                    {_onDeleteSnapshot && (
                                                        <button
                                                            onClick={() => _onDeleteSnapshot(snapshot.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-all"
                                                            title="Delete snapshot"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{snapshot.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>

                        {/* Milestones Timeline - Always show */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0 }}
                            className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 relative overflow-hidden min-h-[450px] flex flex-col"
                        >
                            <div className="absolute -top-6 -right-6 opacity-[0.04] rotate-[15deg] pointer-events-none">
                                <Flag className="w-40 h-40 text-purple-500" />
                            </div>
                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 rounded-full bg-purple-500"></div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Milestones</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Significant moments in your journey</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Flag className="w-4 h-4" />
                                    <span>{Object.values(milestones).flat().length} total</span>
                                </div>
                            </div>

                            {Object.keys(milestones).length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                                    <p className="text-gray-400 text-sm">No milestones yet.</p>
                                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Add your significant moments from the calendar.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    {Object.entries(milestones)
                                        .flatMap(([_, dayMilestones]) => dayMilestones)
                                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Oldest first
                                        .map((milestone) => {
                                            const now = new Date();
                                            let milestoneDateTime = parseISO(milestone.date);

                                            if (milestone.time) {
                                                const [hours, minutes] = milestone.time.split(':').map(Number);
                                                milestoneDateTime = new Date(milestoneDateTime);
                                                milestoneDateTime.setHours(hours, minutes, 0, 0);
                                            }

                                            const diffMs = now.getTime() - milestoneDateTime.getTime();
                                            const isPast = diffMs > 0;
                                            const absDiffMs = Math.abs(diffMs);

                                            const totalMinutes = Math.floor(absDiffMs / (1000 * 60));
                                            const totalHours = Math.floor(absDiffMs / (1000 * 60 * 60));
                                            const totalDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

                                            const days = totalDays;
                                            const hours = totalHours % 24;
                                            const minutes = totalMinutes % 60;

                                            // Format time using global setting
                                            const formatTime = (timeStr: string) => {
                                                const [h, m] = timeStr.split(':').map(Number);
                                                if (use24Hour) {
                                                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                                } else {
                                                    const period = h >= 12 ? 'PM' : 'AM';
                                                    const hours12 = h % 12 || 12;
                                                    return `${hours12}:${m.toString().padStart(2, '0')} ${period}`;
                                                }
                                            };

                                            return (
                                                <motion.div
                                                    key={milestone.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600/30 hover:border-gray-300 dark:hover:border-gray-500/50 transition-all"
                                                >
                                                    <div className="flex items-center justify-between gap-4">
                                                        {/* Left: Date and Time */}
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <Flag
                                                                className="w-5 h-5 shrink-0"
                                                                style={{ color: milestone.colour || '#8b5cf6' }}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <h3
                                                                    className="font-bold text-base truncate"
                                                                    style={{ color: milestone.colour || '#8b5cf6' }}
                                                                >
                                                                    {milestone.title}
                                                                </h3>
                                                                {milestone.description && (
                                                                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                                                                        {milestone.description}
                                                                    </p>
                                                                )}
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                    {format(parseISO(milestone.date), 'MMM d, yyyy')}
                                                                    {milestone.time && ` • ${formatTime(milestone.time)}`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Right: Time Breakdown (Stacked) */}
                                                        <div
                                                            className="text-right shrink-0"
                                                            style={{ color: milestone.colour || '#8b5cf6' }}
                                                        >
                                                            {/* Days - Bold and larger */}
                                                            {totalDays > 0 && (
                                                                <div className="text-xl font-bold leading-tight">
                                                                    {days} {days === 1 ? 'day' : 'days'}
                                                                </div>
                                                            )}
                                                            {/* Hours */}
                                                            {(totalDays > 0 ? hours > 0 : totalHours > 0) && (
                                                                <div className="text-sm font-medium opacity-80 leading-tight">
                                                                    {totalDays > 0 ? `${hours} ${hours === 1 ? 'hr' : 'hrs'}` : `${hours} ${hours === 1 ? 'hr' : 'hrs'}`}
                                                                </div>
                                                            )}
                                                            {/* Minutes - Only show if no days */}
                                                            {totalDays === 0 && totalHours > 0 && minutes > 0 && (
                                                                <div className="text-sm font-medium opacity-70 leading-tight">
                                                                    {minutes} {minutes === 1 ? 'min' : 'mins'}
                                                                </div>
                                                            )}
                                                            {/* Just minutes if less than an hour */}
                                                            {totalDays === 0 && totalHours === 0 && (
                                                                <div className="text-xl font-bold leading-tight">
                                                                    {minutes} {minutes === 1 ? 'min' : 'mins'}
                                                                </div>
                                                            )}
                                                            {/* Ago/Until label */}
                                                            <div className="text-xs opacity-60 mt-0.5">
                                                                {isPast ? 'ago' : 'until'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                </div>
                            )}
                        </motion.div>
                        {/* END_MILESTONES_SECTION */}
                    </div>


                    {/* Mobile Stats Panel - Slide out from right */}
                        {
                            isMobile && showStatsPanel && (
                                <div className="fixed inset-0 z-50" onClick={() => setShowStatsPanel(false)}>
                                    <div className="absolute inset-0 bg-black/50" />
                                    <motion.div
                                        initial={{ x: '100%' }}
                                        animate={{ x: 0 }}
                                        exit={{ x: '100%' }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                        className="absolute right-0 top-0 bottom-0 w-64 bg-gray-50 dark:bg-gray-900 p-4 shadow-2xl"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Stats</h3>
                                            <button
                                                onClick={() => setShowStatsPanel(false)}
                                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <X className="w-5 h-5 text-gray-500" />
                                            </button>
                                        </div>
                                        <StatsContent />
                                    </motion.div>
                                </div>
                            )
                        }

                        {/* Scoring Info Popup */}
                        {
                            showScoringInfo && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScoringInfo(false)}>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700 relative overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="absolute -bottom-10 -right-10 text-gray-100 dark:text-gray-700/30 pointer-events-none rotate-[-15deg]">
                                            <HelpCircle className="w-64 h-64 opacity-50" />
                                        </div>

                                        <div className="flex items-center justify-between mb-4 relative z-10">
                                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Calculations</h3>
                                            <button
                                                onClick={() => setShowScoringInfo(false)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="space-y-6 relative z-10">
                                            {/* Color Legend */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Completion Rates</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">70%+ (Good)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">40-69% (OK)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-rose-500" />
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">&lt;40% (Low)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-600" />
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">No tasks</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-gray-100 dark:bg-gray-700" />

                                            {/* Task Numbers Legend */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Task Numbers</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-emerald-500 font-bold text-sm">#</span>
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-amber-500 font-bold text-sm">#</span>
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">Late</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-rose-500 font-bold text-sm">#</span>
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">Missed</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-400 font-bold text-sm">#</span>
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">Pending</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-gray-100 dark:bg-gray-700" />

                                            {/* Scoring Points */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Point System</h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                                                <ThumbsUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm text-gray-800 dark:text-gray-200">On Time</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">Completed before due time</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-xl font-bold text-emerald-500">+1</div>
                                                    </div>

                                                    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                                                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm text-gray-800 dark:text-gray-200">Late Completion</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">Completed after due time</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-xl font-bold text-amber-500">+0.5</div>
                                                    </div>

                                                    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                                                                <X className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm text-gray-800 dark:text-gray-200">Missed Task</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">Not completed / past due</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-xl font-bold text-rose-500">-1</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            )
                        }

                        {/* Week Details Modal */}
                        {
                            selectedWeek && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedWeek(null)}>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Header */}
                                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shrink-0 z-10">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                                        {selectedWeek.weekLabel}
                                                    </h3>
                                                    <span className={clsx("px-2.5 py-0.5 rounded-full text-sm font-semibold", getRateColor(selectedWeek.completionRate, selectedWeek.missedTasks).bg + '/20', getRateColor(selectedWeek.completionRate, selectedWeek.missedTasks).text)}>
                                                        {selectedWeek.completionRate}%
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                                    {selectedWeek.dateRange} • {selectedWeek.totalTasks} Tasks
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedWeek(null)}
                                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/50">
                                            {(() => {
                                                // Get tasks for this week
                                                const weekTasks = Object.entries(notes).flatMap(([dateStr, dayNotes]) => {
                                                    const date = parseISO(dateStr);
                                                    if (date >= selectedWeek.startDate && date <= selectedWeek.endDate) {
                                                        return dayNotes.map(note => ({ ...note, date, dateStr }));
                                                    }
                                                    return [];
                                                }).sort((a, b) => {
                                                    // Sort by date then status (missed -> late -> completed -> pending)
                                                    if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() - b.date.getTime();
                                                    return 0;
                                                });

                                                const sections = {
                                                    completed: weekTasks.filter(t => t.completed && !t.completedLate),
                                                    late: weekTasks.filter(t => t.completed && t.completedLate),
                                                    missed: weekTasks.filter(t => t.missed || (!t.completed && new Date(t.date).setHours(parseInt(t.time.split(':')[0]), parseInt(t.time.split(':')[1])) < new Date().getTime())),
                                                    pending: weekTasks.filter(t => !t.completed && !t.missed && new Date(t.date).setHours(parseInt(t.time.split(':')[0]), parseInt(t.time.split(':')[1])) >= new Date().getTime())
                                                };

                                                return (
                                                    <>
                                                        {/* Stats Grid */}
                                                        <div className="grid grid-cols-4 gap-3 mb-2">
                                                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20 text-center">
                                                                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{selectedWeek.completedTasks - selectedWeek.lateTasks}</div>
                                                                <div className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wide">On Time</div>
                                                            </div>
                                                            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20 text-center">
                                                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{selectedWeek.lateTasks}</div>
                                                                <div className="text-xs font-medium text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wide">Late</div>
                                                            </div>
                                                            <div className="p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20 text-center">
                                                                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{selectedWeek.missedTasks}</div>
                                                                <div className="text-xs font-medium text-rose-600/80 dark:text-rose-400/80 uppercase tracking-wide">Missed</div>
                                                            </div>
                                                            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                                                                <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                                                                    {selectedWeek.totalTasks - selectedWeek.completedTasks - selectedWeek.missedTasks}
                                                                </div>
                                                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending</div>
                                                            </div>
                                                        </div>

                                                        {sections.completed.length > 0 && (
                                                            <section>
                                                                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                    Completed On Time
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {sections.completed.map(task => (
                                                                        <div key={task.id} className="group p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-900/50 shadow-sm transition-all flex items-start gap-3">
                                                                            <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                                                                <ThumbsUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                                                                                <p className="text-xs text-gray-400 flex items-center gap-2">
                                                                                    {format(task.date, 'EEEE, MMM d')} • {task.time}
                                                                                </p>
                                                                            </div>
                                                                            <span className="text-emerald-500 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">+1.0</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </section>
                                                        )}

                                                        {sections.late.length > 0 && (
                                                            <section>
                                                                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                                    Completed Late
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {sections.late.map(task => (
                                                                        <div key={task.id} className="group p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-900/50 shadow-sm transition-all flex items-start gap-3">
                                                                            <div className="mt-1 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                                                                <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                                                                                <p className="text-xs text-gray-400 flex items-center gap-2">
                                                                                    {format(task.date, 'EEEE, MMM d')} • {task.time}
                                                                                </p>
                                                                            </div>
                                                                            <span className="text-amber-500 font-bold text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">+0.5</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </section>
                                                        )}

                                                        {sections.missed.length > 0 && (
                                                            <section>
                                                                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                                                                    Missed Tasks
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {sections.missed.map(task => (
                                                                        <div key={task.id} className="group p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-rose-200 dark:hover:border-rose-900/50 shadow-sm transition-all flex items-start gap-3">
                                                                            <div className="mt-1 w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                                                                                <X className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                                                                                <p className="text-xs text-gray-400 flex items-center gap-2">
                                                                                    {format(task.date, 'EEEE, MMM d')} • {task.time}
                                                                                </p>
                                                                            </div>
                                                                            <span className="text-rose-500 font-bold text-xs bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-lg">-1.0</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </section>
                                                        )}

                                                        {sections.pending.length > 0 && (
                                                            <section>
                                                                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                                                                    Pending
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {sections.pending.map(task => (
                                                                        <div key={task.id} className="group p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all flex items-start gap-3">
                                                                            <div className="mt-1 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                                                <div className="w-2 h-2 rounded-full border-2 border-gray-400" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                                                                                <p className="text-xs text-gray-400 flex items-center gap-2">
                                                                                    {format(task.date, 'EEEE, MMM d')} • {task.time}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </section>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </motion.div>
                                </div>
                            )
                        }

                        {/* Snapshot Generation Modal */}
                        {showSnapshotModal && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSnapshotModal(false)}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-lg w-full border border-gray-200 dark:border-gray-700"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Create Snapshot</h3>
                                        <button
                                            onClick={() => setShowSnapshotModal(false)}
                                            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <X className="w-5 h-5 text-gray-500" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Snapshot Type
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSnapshotType('monthly')}
                                                    className={clsx(
                                                        "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                                                        snapshotType === 'monthly'
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                                    )}
                                                >
                                                    Monthly
                                                </button>
                                                <button
                                                    onClick={() => setSnapshotType('yearly')}
                                                    className={clsx(
                                                        "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                                                        snapshotType === 'yearly'
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                                    )}
                                                >
                                                    Yearly
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Retrospective Content
                                            </label>
                                            <textarea
                                                value={snapshotContent}
                                                onChange={(e) => setSnapshotContent(e.target.value)}
                                                placeholder="Click 'Generate with AI' or write your own retrospective..."
                                                className="w-full h-32 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleGenerateSnapshot}
                                                disabled={isGeneratingSnapshot}
                                                className="flex-1 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                                {isGeneratingSnapshot ? 'Generating...' : 'Generate with AI'}
                                            </button>
                                            <button
                                                onClick={handleSaveSnapshot}
                                                disabled={!snapshotContent.trim()}
                                                className="px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save
                                            </button>
                                        </div>

                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            AI-generated snapshots use minimal tokens and are cached to avoid repeated generation for the same period.
                                        </p>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                </div>
            </div>
        </div>
    );
}
