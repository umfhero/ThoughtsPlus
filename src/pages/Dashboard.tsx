import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ArrowUpRight, ListTodo, Loader, Circle, Search, Filter, Activity as ActivityIcon, CheckCircle2, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { NotesData, Note } from '../types';
import clsx from 'clsx';
import TaskTrendChart from '../components/TaskTrendChart';
import { ActivityCalendar, Activity } from 'react-activity-calendar';
import { useTheme } from '../contexts/ThemeContext';
import { fetchGithubContributions } from '../utils/github';
import confetti from 'canvas-confetti';

interface DashboardProps {
    notes: NotesData;
    onNavigateToNote: (date: Date, noteId: string) => void;
    userName: string;
    onAddNote: (note: Note, date: Date) => void;
    onUpdateNote: (note: Note, date: Date) => void;
    onOpenAiModal: () => void;
    isLoading?: boolean;
    isSidebarCollapsed?: boolean;
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function Dashboard({ notes, onNavigateToNote, userName, onUpdateNote, onOpenAiModal, isLoading = false, isSidebarCollapsed = false }: DashboardProps) {
    const [time, setTime] = useState(new Date());
    // @ts-ignore
    const [stats, setStats] = useState<any>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(() => localStorage.getItem('dashboard_ai_summary'));
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Analyzing your schedule...");
    const [eventTab, setEventTab] = useState<'upcoming' | 'completed' | 'notCompleted'>('upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterImportance, setFilterImportance] = useState<string>('all');
    const [contributions, setContributions] = useState<Activity[]>([]);
    const [githubUsername, setGithubUsername] = useState<string>('');
    const [creatorCodes, setCreatorCodes] = useState<string[]>([]);
    const { accentColor, theme } = useTheme();
    const [enabledFeatures, setEnabledFeatures] = useState({
        calendar: true,
        drawing: true,
        stats: true,
        github: true
    });
    const [blockSize, setBlockSize] = useState(12);
    const githubContributionsRef = useRef<HTMLDivElement>(null);
    
    // Completion Modal State
    const [completionModal, setCompletionModal] = useState<{
        isOpen: boolean;
        noteId: string;
        dateKey: string;
        noteTitle: string;
    }>({ isOpen: false, noteId: '', dateKey: '', noteTitle: '' });

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
        // Load feature toggles
        const loadFeatureToggles = () => {
            const saved = localStorage.getItem('feature-toggles');
            if (saved) {
                setEnabledFeatures(JSON.parse(saved));
            }
        };
        loadFeatureToggles();

        // Load GitHub username
        const loadGithubUsername = async () => {
            try {
                // @ts-ignore
                const username = await window.ipcRenderer.invoke('get-github-username');
                if (username) {
                    setGithubUsername(username);
                }
            } catch (err) {
                console.error('Failed to load GitHub username', err);
            }
        };

        // Load Creator Codes
        const loadCreatorCodes = async () => {
            try {
                // @ts-ignore
                const codes = await window.ipcRenderer.invoke('get-creator-codes');
                if (codes) {
                    setCreatorCodes(codes);
                }
            } catch (err) {
                console.error('Failed to load creator codes', err);
            }
        };

        loadGithubUsername();
        loadCreatorCodes();

        // Listen for feature toggle changes
        const handleFeatureToggleChange = (event: CustomEvent) => {
            setEnabledFeatures(event.detail);
        };
        window.addEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);

        return () => {
            window.removeEventListener('feature-toggles-changed', handleFeatureToggleChange as EventListener);
        };
    }, []);

    useEffect(() => {
        if (enabledFeatures.github && githubUsername) {
            fetchGithubContributions(githubUsername, new Date().getFullYear()).then((data) => {
                setContributions(data);
            });
        }
    }, [enabledFeatures.github, githubUsername]);

    // Separate effect to handle scrolling after contributions are rendered
    useEffect(() => {
        if (contributions.length > 0 && githubContributionsRef.current) {
            const scrollToCurrentMonth = () => {
                if (githubContributionsRef.current) {
                    const container = githubContributionsRef.current;
                    console.log('Container details:', {
                        scrollWidth: container.scrollWidth,
                        clientWidth: container.clientWidth,
                        scrollLeft: container.scrollLeft,
                        currentMonth: new Date().getMonth(),
                        hasOverflow: container.scrollWidth > container.clientWidth
                    });
                    
                    if (container.scrollWidth > container.clientWidth) {
                        // For December (last month), scroll to the very end
                        const maxScroll = container.scrollWidth - container.clientWidth;
                        console.log('Attempting scroll to:', maxScroll);
                        
                        // Try multiple methods
                        container.scrollLeft = maxScroll;
                        container.scrollTo({ left: maxScroll, behavior: 'auto' });
                        
                        // Verify it worked
                        setTimeout(() => {
                            console.log('After scroll, scrollLeft is:', container.scrollLeft);
                        }, 100);
                    }
                }
            };

            // Try immediate scroll first
            scrollToCurrentMonth();

            // Use MutationObserver to detect when the calendar SVG is rendered
            const observer = new MutationObserver((mutations) => {
                // Only scroll if we detect actual content changes
                if (mutations.some(m => m.addedNodes.length > 0)) {
                    scrollToCurrentMonth();
                }
            });

            if (githubContributionsRef.current) {
                observer.observe(githubContributionsRef.current, {
                    childList: true,
                    subtree: true
                });
            }

            // Also try with delays as fallback
            const timeouts = [100, 300, 600, 1000, 1500, 2500].map(delay => 
                setTimeout(scrollToCurrentMonth, delay)
            );

            return () => {
                observer.disconnect();
                timeouts.forEach(clearTimeout);
            };
        }
    }, [contributions]);

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
    const [panelHeight, setPanelHeight] = useState(384); // Pixels (default h-96 = 24rem = 384px)
    const [eventsHeight, setEventsHeight] = useState(384);
    const [trendsHeight, setTrendsHeight] = useState(384);
    
    const [isDragging, setIsDragging] = useState(false);
    const [isHeightDragging, setIsHeightDragging] = useState(false); // For desktop shared height
    const [isEventsHeightDragging, setIsEventsHeightDragging] = useState(false); // For mobile events height
    const [isTrendsHeightDragging, setIsTrendsHeightDragging] = useState(false); // For mobile trends height
    
    const [briefingHeight, setBriefingHeight] = useState<number | undefined>(undefined);
    const [githubHeight, setGithubHeight] = useState<number | undefined>(undefined);
    const [statsHeight, setStatsHeight] = useState<number | undefined>(undefined);

    const [isBriefingHeightDragging, setIsBriefingHeightDragging] = useState(false);
    const [isGithubHeightDragging, setIsGithubHeightDragging] = useState(false);
    const [isStatsHeightDragging, setIsStatsHeightDragging] = useState(false);

    const briefingRef = useRef<HTMLDivElement>(null);
    const githubCardRef = useRef<HTMLDivElement>(null);
    const statsRef = useRef<HTMLDivElement>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const sidebarWidth = isSidebarCollapsed ? 0 : 240;
            const availableWidth = window.innerWidth - sidebarWidth;
            // If available width is tight, switch to mobile layout
            setIsMobile(availableWidth < 900); 
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isSidebarCollapsed]);

    useEffect(() => {
        const loadSavedSettings = async () => {
            try {
                // @ts-ignore
                const savedWidth = await window.ipcRenderer.invoke('get-device-setting', 'dashboardLeftWidth');
                if (savedWidth) {
                    setLeftWidth(parseFloat(savedWidth));
                }
                // @ts-ignore
                const savedHeight = await window.ipcRenderer.invoke('get-device-setting', 'dashboardPanelHeight');
                if (savedHeight) {
                    setPanelHeight(parseFloat(savedHeight));
                }
            } catch (e) {
                console.error('Failed to load dashboard settings', e);
            }
        };
        loadSavedSettings();
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        e.preventDefault();
    };

    const handleHeightMouseDown = (e: React.MouseEvent) => {
        setIsHeightDragging(true);
        e.preventDefault();
    };

    const handleEventsHeightMouseDown = (e: React.MouseEvent) => {
        setIsEventsHeightDragging(true);
        e.preventDefault();
    };

    const handleTrendsHeightMouseDown = (e: React.MouseEvent) => {
        setIsTrendsHeightDragging(true);
        e.preventDefault();
    };

    const handleBriefingHeightMouseDown = (e: React.MouseEvent) => {
        if (briefingRef.current && briefingHeight === undefined) {
            setBriefingHeight(briefingRef.current.offsetHeight);
        }
        setIsBriefingHeightDragging(true);
        e.preventDefault();
    };

    const handleGithubHeightMouseDown = (e: React.MouseEvent) => {
        if (githubCardRef.current && githubHeight === undefined) {
            setGithubHeight(githubCardRef.current.offsetHeight);
        }
        setIsGithubHeightDragging(true);
        e.preventDefault();
    };

    const handleStatsHeightMouseDown = (e: React.MouseEvent) => {
        if (statsRef.current && statsHeight === undefined) {
            setStatsHeight(statsRef.current.offsetHeight);
        }
        setIsStatsHeightDragging(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                
                // Limit width between 30% and 70%
                if (newLeftWidth >= 30 && newLeftWidth <= 70) {
                    setLeftWidth(newLeftWidth);
                }
            }
            
            if (isHeightDragging && containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const newHeight = e.clientY - containerRect.top;
                
                // Limit height between 250px and 600px
                if (newHeight >= 250 && newHeight <= 600) {
                    setPanelHeight(newHeight);
                    setEventsHeight(newHeight);
                    setTrendsHeight(newHeight);
                }
            }

            if (isEventsHeightDragging) {
                setEventsHeight(prev => {
                    const newH = prev + e.movementY;
                    return Math.max(200, Math.min(newH, 1200));
                });
            }

            if (isTrendsHeightDragging) {
                setTrendsHeight(prev => {
                    const newH = prev + e.movementY;
                    return Math.max(200, Math.min(newH, 1200));
                });
            }

            if (isBriefingHeightDragging) {
                setBriefingHeight(prev => {
                    const current = prev || (briefingRef.current?.offsetHeight || 200);
                    const newH = current + e.movementY;
                    return Math.max(150, Math.min(newH, 1200));
                });
            }

            if (isGithubHeightDragging) {
                setGithubHeight(prev => {
                    const current = prev || (githubCardRef.current?.offsetHeight || 200);
                    const newH = current + e.movementY;
                    return Math.max(200, Math.min(newH, 1200));
                });
            }

            if (isStatsHeightDragging) {
                setStatsHeight(prev => {
                    const current = prev || (statsRef.current?.offsetHeight || 200);
                    const newH = current + e.movementY;
                    return Math.max(200, Math.min(newH, 1200));
                });
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                // Save to device-specific settings
                // @ts-ignore
                window.ipcRenderer.invoke('save-device-setting', 'dashboardLeftWidth', leftWidth.toString());
            }
            if (isHeightDragging) {
                setIsHeightDragging(false);
                // @ts-ignore
                window.ipcRenderer.invoke('save-device-setting', 'dashboardPanelHeight', panelHeight.toString());
            }
            setIsEventsHeightDragging(false);
            setIsTrendsHeightDragging(false);
            setIsBriefingHeightDragging(false);
            setIsGithubHeightDragging(false);
            setIsStatsHeightDragging(false);
        };

        if (isDragging || isHeightDragging || isEventsHeightDragging || isTrendsHeightDragging || isBriefingHeightDragging || isGithubHeightDragging || isStatsHeightDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isHeightDragging, isEventsHeightDragging, isTrendsHeightDragging, isBriefingHeightDragging, isGithubHeightDragging, isStatsHeightDragging, leftWidth, panelHeight]);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        loadStats();
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
    const getAllUpcomingEvents = () => {
        const allEvents: { date: Date; note: Note; isOverdue: boolean; dateKey: string }[] = [];
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
                allEvents.push({ date: eventDateTime, note: effectiveNote, isOverdue, dateKey: dateStr });
            });
        });
        
        // Stable sort
        return allEvents.sort((a, b) => {
            const timeDiff = a.date.getTime() - b.date.getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.note.title.localeCompare(b.note.title);
        });
    };

    const allUpcomingEvents = getAllUpcomingEvents();

    // Toggle task completion
    const handleToggleComplete = async (noteId: string, dateKey: string, currentCompleted: boolean) => {
        const dayNotes = notes[dateKey] || [];
        const noteToUpdate = dayNotes.find(n => n.id === noteId);
        
        if (!noteToUpdate) return;

        // Just toggle completion status
        // Default to "On Time" (completedLate: false) when marking as complete
        const updatedNote = { 
            ...noteToUpdate, 
            completed: !currentCompleted,
            completedLate: !currentCompleted ? false : undefined 
        };
        
        onUpdateNote(updatedNote, parseISO(dateKey));
        
        // Trigger confetti if completing
        if (!currentCompleted) {
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const colors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

            const frame = () => {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.8 },
                    colors: colors
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.8 },
                    colors: colors
                });

                if (Date.now() < animationEnd) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
    };

    // Toggle Late Status
    const handleToggleLate = (noteId: string, dateKey: string, currentLate: boolean) => {
        const dayNotes = notes[dateKey] || [];
        const noteToUpdate = dayNotes.find(n => n.id === noteId);
        
        if (!noteToUpdate) return;

        const updatedNote = { 
            ...noteToUpdate, 
            completedLate: !currentLate
        };
        
        onUpdateNote(updatedNote, parseISO(dateKey));
    };

    // Filter events based on tab
    const getFilteredEvents = () => {
        let filtered = allUpcomingEvents.filter(event => {
            const matchesSearch = event.note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  event.note.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filterImportance === 'all' || event.note.importance === filterImportance;
            return matchesSearch && matchesFilter;
        });

        if (eventTab === 'upcoming') {
            return filtered.filter(e => !e.isOverdue && !e.note.completed);
        } else if (eventTab === 'completed') {
            return filtered.filter(e => e.note.completed === true);
        } else {
            // notCompleted - overdue and not marked completed
            return filtered.filter(e => e.isOverdue && !e.note.completed);
        }
    };

    const upcomingEvents = allUpcomingEvents.filter(event => {
        const matchesSearch = event.note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              event.note.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterImportance === 'all' || event.note.importance === filterImportance;
        return matchesSearch && matchesFilter;
    });

    const filteredEventsForTab = getFilteredEvents();

    // Effect to generate AI summary
    useEffect(() => {
        const fetchBriefing = async () => {
            // If loading, do nothing (wait for data)
            if (isLoading) return;

            // If we have no notes, just set default message and return
            // Do NOT clear cache here, as this might be just the initial loading state
            if (allUpcomingEvents.length === 0) {
                 setAiSummary("No upcoming events scheduled. Enjoy your free time!");
                 return;
            }

            const eventsHash = JSON.stringify(allUpcomingEvents.map(e => ({
                id: e.note.id,
                title: e.note.title,
                time: e.note.time,
                date: format(e.date, 'yyyy-MM-dd'),
                importance: e.note.importance,
                completed: e.note.completed,
                completedLate: e.note.completedLate
            })));
            
            const cachedHash = localStorage.getItem('dashboard_events_hash');
            const cachedSummary = localStorage.getItem('dashboard_ai_summary');

            // If cache was cleared (e.g., API key was just saved), force refresh
            if (!cachedSummary) {
                // Continue to fetch new briefing
            }
            // If data hasn't changed and we have a summary, use it and don't fetch
            // BUT if the cached summary is an error message, ignore it and retry
            else if (eventsHash === cachedHash && cachedSummary && !cachedSummary.startsWith("Sorry, I couldn't generate") && !cachedSummary.includes("Error")) {
                setAiSummary(cachedSummary);
                return;
            }

            setIsBriefingLoading(true);

            try {
                // Filter events for AI context
                const now = new Date();
                const relevantEvents = allUpcomingEvents.filter(event => {
                    const eventDate = new Date(event.date);
                    const diffHours = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                    
                    const isFuture = diffHours > 0;
                    const isRecentPast = diffHours > -168 && diffHours <= 0; // Last 7 days
                    const isOverdue = diffHours <= 0 && !event.note.completed;
                    
                    if (isFuture && diffHours < 24 * 14) return true; // Next 14 days
                    if (isRecentPast) return true;
                    if (isOverdue) return true;
                    
                    return false;
                });

                // @ts-ignore
                const summary = await window.ipcRenderer.invoke('generate-ai-overview', relevantEvents, userName);
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
        <div className="p-4 md:p-10 space-y-6 md:space-y-10 h-full overflow-y-auto custom-scrollbar">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-2 md:mb-3 tracking-tight"
                    >
                        {getGreeting()}
                    </motion.h1>
                    <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">Here's your daily overview.</p>
                </div>
                <div className="text-left md:text-right">
                    <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 tracking-tighter">
                        {format(time, 'h:mm a')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mt-1 md:mt-2 text-base md:text-lg">
                        {format(time, 'EEEE, MMMM do')}
                    </p>
                </div>
            </div>

            {/* Overview Section: Event Summary */}
            <div className="grid grid-cols-1 gap-6 md:gap-8">
                <motion.div
                    ref={briefingRef}
                    style={{ height: isMobile && briefingHeight ? `${briefingHeight}px` : 'auto' }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 md:p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative flex flex-col overflow-hidden"
                >
                    <div className="flex items-center gap-4 mb-6 flex-shrink-0">
                        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            <ListTodo className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Overview</p>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Your Briefing</h3>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-900 border border-indigo-100 dark:border-gray-700 min-h-[100px] flex items-center flex-1 overflow-y-auto custom-scrollbar">
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

                    {/* Mobile Resize Handle for Briefing */}
                    {isMobile && (
                        <div
                            className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-indigo-50/50 dark:hover:bg-indigo-700/50 rounded-b-[2rem] transition-colors group/handle"
                            onMouseDown={handleBriefingHeightMouseDown}
                        >
                            <div className="w-12 h-1 bg-indigo-200 dark:bg-indigo-600 rounded-full group-hover/handle:bg-indigo-400 transition-colors shadow-sm" />
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Quick Stats Grid - Resizable */}
            <div ref={containerRef} style={{ height: isMobile ? 'auto' : `${panelHeight}px` }} className={clsx("flex select-none", isMobile ? "flex-col gap-6" : "flex-row gap-0")}>
                {/* Upcoming Events - Resizable Left Column */}
                <motion.div
                    style={{ 
                        width: isMobile ? '100%' : `${leftWidth}%`,
                        height: isMobile ? `${eventsHeight}px` : '100%'
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
                    }}
                    className="p-6 md:p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col h-full relative group transition-colors"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 md:p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/30" style={{ color: 'var(--accent-primary)' }}>
                                <CalendarIcon className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-400 dark:text-gray-300 uppercase tracking-wider">Events</p>
                                <h3 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">{upcomingEvents.length} Total</h3>
                            </div>
                        </div>
                        <button
                            onClick={onOpenAiModal}
                            className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors group/btn"
                            title="AI Quick Note"
                        >
                            <Sparkles className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        <button
                            onClick={() => setEventTab('upcoming')}
                            className={clsx(
                                "flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                eventTab === 'upcoming'
                                    ? "bg-white dark:bg-gray-700 shadow-md"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            style={eventTab === 'upcoming' ? { color: 'var(--accent-primary)' } : undefined}
                        >
                            Upcoming ({upcomingEvents.filter(e => !e.isOverdue && !e.note.completed).length})
                        </button>
                        <button
                            onClick={() => setEventTab('completed')}
                            className={clsx(
                                "flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                eventTab === 'completed'
                                    ? "bg-white dark:bg-gray-700 shadow-md"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            style={eventTab === 'completed' ? { color: 'var(--accent-primary)' } : undefined}
                        >
                            Completed ({upcomingEvents.filter(e => e.note.completed === true).length})
                        </button>
                        <button
                            onClick={() => setEventTab('notCompleted')}
                            className={clsx(
                                "flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                eventTab === 'notCompleted'
                                    ? "bg-white dark:bg-gray-700 shadow-md"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            style={eventTab === 'notCompleted' ? { color: 'var(--accent-primary)' } : undefined}
                        >
                            Missed ({upcomingEvents.filter(e => e.isOverdue && !e.note.completed).length})
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Search events..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-800 dark:text-gray-200"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select
                                value={filterImportance}
                                onChange={(e) => setFilterImportance(e.target.value)}
                                className="w-full sm:w-auto pl-9 pr-8 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer text-gray-800 dark:text-gray-200"
                            >
                                <option value="all">All</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                                <option value="misc">Misc</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {filteredEventsForTab.length === 0 ? (
                            <p className="text-gray-400 dark:text-gray-500 text-sm">
                                {eventTab === 'upcoming' ? 'No upcoming events.' : eventTab === 'completed' ? 'No completed events.' : 'No missed events.'}
                            </p>
                        ) : (
                            <AnimatePresence mode="popLayout">
                            {filteredEventsForTab.slice(0, 10).map(({ date, note, dateKey }) => (
                                <motion.div
                                    key={note.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, x: 50 }}
                                    transition={{ 
                                        duration: 0.3,
                                        layout: { duration: 0.3 }
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    className={clsx(
                                        "p-3 rounded-xl border transition-colors",
                                        note.completed ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50" : importanceColors[note.importance]
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Completion Checkbox */}
                                        <motion.button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleComplete(note.id, dateKey, note.completed || false);
                                            }}
                                            whileTap={{ scale: 0.8 }}
                                            className={clsx(
                                                "mt-0.5 flex-shrink-0 transition-all",
                                                note.completed 
                                                    ? "text-green-500 hover:text-green-600" 
                                                    : "text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500"
                                            )}
                                        >
                                            <motion.div
                                                initial={false}
                                                animate={note.completed ? { scale: [1, 1.3, 1], rotate: [0, 10, 0] } : { scale: 1 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {note.completed ? (
                                                    <CheckCircle2 className="w-5 h-5" />
                                                ) : (
                                                    <Circle className="w-5 h-5" />
                                                )}
                                            </motion.div>
                                        </motion.button>
                                        
                                        <div 
                                            className="flex-1 cursor-pointer"
                                            onClick={() => onNavigateToNote(date, note.id)}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={clsx(
                                                    "font-bold text-sm",
                                                    note.completed && "line-through text-gray-500 dark:text-gray-400"
                                                )}>
                                                    {note.title}
                                                </span>
                                                <div className="text-right flex flex-col items-end gap-1">
                                                    <div className="text-xs opacity-70">{format(date, 'MMM d')} {convertTo12Hour(note.time)}</div>
                                                    
                                                    {note.completed ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleLate(note.id, dateKey, note.completedLate || false);
                                                            }}
                                                            className={clsx(
                                                                "text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                                                                note.completedLate 
                                                                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50" 
                                                                    : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                                                            )}
                                                        >
                                                            {note.completedLate ? 'Late' : 'On Time'}
                                                        </button>
                                                    ) : (
                                                        <div className="text-[10px] opacity-60 font-semibold">
                                                            {getCountdown(date, note.time)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2 text-xs opacity-80">
                                                {!note.completed && (
                                                    <Circle className={clsx("w-2 h-2 mt-[3px] flex-shrink-0 fill-current", importanceIconColors[note.importance])} />
                                                )}
                                                <span className={clsx(
                                                    "break-words",
                                                    note.completed && "text-gray-500 dark:text-gray-400"
                                                )}>
                                                    {note.description || 'No description'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            </AnimatePresence>
                        )}
                    </div>

                    {/* Mobile Resize Handle for Events */}
                    {isMobile && (
                        <div
                            className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-b-[2rem] transition-colors group/handle"
                            onMouseDown={handleEventsHeightMouseDown}
                        >
                            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full group-hover/handle:bg-blue-400 transition-colors shadow-sm" />
                        </div>
                    )}
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
                    style={{ 
                        width: isMobile ? '100%' : `calc(${100 - leftWidth}% - 1.5rem)`,
                        height: isMobile ? `${trendsHeight}px` : '100%'
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                        boxShadow: '0 20px 60px rgba(147, 51, 234, 0.2)'
                    }}
                    className="p-8 rounded-[2rem] bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800 shadow-xl flex flex-col h-full transition-colors relative"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <ArrowUpRight className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-300 uppercase tracking-wider">Task Trends</p>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Completion Rate</h3>
                        </div>
                    </div>

                    {/* Task Completion Trend Graph */}
                    <div className="flex-1 w-full min-h-0">
                        {Object.keys(notes).length === 0 ? (
                            <div className="h-full flex items-center justify-center bg-white/50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-700">
                                <div className="text-center py-6 px-4">
                                    <ArrowUpRight className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3 mx-auto" />
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">No Tasks Yet</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Add some events to see your completion trends</p>
                                </div>
                            </div>
                        ) : (
                            <TaskTrendChart notes={notes} />
                        )}
                    </div>

                    {/* Mobile Resize Handle for Trends */}
                    {isMobile && (
                        <div
                            className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-purple-50/50 dark:hover:bg-purple-700/50 rounded-b-[2rem] transition-colors group/handle"
                            onMouseDown={handleTrendsHeightMouseDown}
                        >
                            <div className="w-12 h-1 bg-purple-200 dark:bg-purple-600 rounded-full group-hover/handle:bg-purple-400 transition-colors shadow-sm" />
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Height Resize Handle (Desktop Only) */}
            {!isMobile && (
                <div
                    className="flex items-center justify-center h-3 cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-full transition-colors group"
                    onMouseDown={handleHeightMouseDown}
                    style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}
                >
                    <div 
                        className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" 
                        style={{ 
                            backgroundColor: isHeightDragging ? 'var(--accent-primary)' : undefined 
                        }}
                    />
                </div>
            )}

            {/* Github Contributions Graph */}
            {enabledFeatures.github && (
            <motion.div
                ref={githubCardRef}
                style={{ height: isMobile && githubHeight ? `${githubHeight}px` : 'auto' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative flex flex-col overflow-hidden"
            >
                <div className="flex items-center gap-4 mb-6 flex-shrink-0">
                    <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-400 dark:text-gray-300 uppercase tracking-wider">Github Activity</p>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Contributions</h3>
                    </div>
                </div>
                <div 
                    ref={githubContributionsRef}
                    className="overflow-x-auto overflow-y-hidden rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 min-h-[156px] thin-scrollbar flex-shrink-0"
                    style={{ 
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {!githubUsername ? (
                        <div className="flex flex-col items-center justify-center text-center py-6">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">GitHub not configured</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Add your GitHub username in Settings to view contributions</p>
                        </div>
                    ) : contributions.length > 0 ? (
                        <div className="flex justify-center min-w-full px-4 pt-4 pb-2">
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
                {contributions.length > 0 && githubUsername && (
                    <div className="flex items-center justify-between mt-2 px-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {contributions.reduce((sum, day) => sum + day.count, 0)} contributions in {new Date().getFullYear()}
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

                {/* Mobile Resize Handle for Github */}
                {isMobile && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-b-[2rem] transition-colors group/handle"
                        onMouseDown={handleGithubHeightMouseDown}
                    >
                        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full group-hover/handle:bg-gray-400 transition-colors shadow-sm" />
                    </div>
                )}
            </motion.div>
            )}

            {/* Fortnite Creator Stats - Full Width Below */}
            {enabledFeatures.stats && creatorCodes.length > 0 && (
            <motion.div
                ref={statsRef}
                style={{ height: isMobile && statsHeight ? `${statsHeight}px` : 'auto' }}
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
                        <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm border border-purple-100 dark:border-purple-800">
                            <ActivityIcon className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fortnite Creative</p>
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Live Stats ({creatorCodes.length} Maps)</h3>
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
                            <span className="hidden xl:inline">{(stats?.fortnite?.raw?.minutesPlayed || 0).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(stats?.fortnite?.raw?.minutesPlayed || 0)}</span>
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
                            <span className="hidden xl:inline">{(stats?.fortnite?.raw?.uniquePlayers || 0).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(stats?.fortnite?.raw?.uniquePlayers || 0)}</span>
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
                            <span className="hidden xl:inline">{(stats?.fortnite?.raw?.favorites || 0).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(stats?.fortnite?.raw?.favorites || 0)}</span>
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
                            <span className="hidden xl:inline">{(stats?.fortnite?.raw?.plays || 0).toLocaleString()}</span>
                            <span className="xl:hidden">{formatCompactNumber(stats?.fortnite?.raw?.plays || 0)}</span>
                        </p>
                        <div className="mt-2 text-xs text-gray-400 dark:text-gray-400">
                            <span>Game sessions</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Resize Handle for Stats */}
                {isMobile && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-purple-50/50 dark:hover:bg-purple-700/50 rounded-b-[2rem] transition-colors group/handle z-20"
                        onMouseDown={handleStatsHeightMouseDown}
                    >
                        <div className="w-12 h-1 bg-purple-200 dark:bg-purple-600 rounded-full group-hover/handle:bg-purple-400 transition-colors shadow-sm" />
                    </div>
                )}
            </motion.div>
            )}

            {/* Completion Confirmation Modal */}
            <AnimatePresence>
                {completionModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-700"
                        >
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Task Completed?
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                Did you complete <span className="font-semibold text-gray-900 dark:text-white">"{completionModal.noteTitle}"</span> on time?
                            </p>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={() => confirmCompletion(false)}
                                    className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Yes, On Time
                                </button>
                                <button
                                    onClick={() => confirmCompletion(true)}
                                    className="flex-1 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl font-medium transition-colors"
                                >
                                    No, Late
                                </button>
                            </div>
                            <button 
                                onClick={() => setCompletionModal(prev => ({ ...prev, isOpen: false }))}
                                className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}