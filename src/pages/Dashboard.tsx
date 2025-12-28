import { CustomWidgetContainer } from '../components/CustomWidgetContainer';
import { AddCustomWidgetModal } from '../components/AddCustomWidgetModal';
import { getWidgetConfigs, deleteWidgetConfig } from '../utils/customWidgetManager';
import { CustomWidgetConfig } from '../types';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { ArrowUpRight, Loader, Circle, Search, Filter, Activity as ActivityIcon, CheckCircle2, Sparkles, X, Plus, MousePointerClick, Merge, Trash2, Repeat, Folder, Clock, XCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { NotesData, Note } from '../types';
import clsx from 'clsx';
import TaskTrendChart from '../components/TaskTrendChart';
import { useNotification } from '../contexts/NotificationContext';
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
    isEditMode: boolean;
    setIsEditMode: (isEditMode: boolean) => void;
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function Dashboard({ notes, onNavigateToNote, userName, onUpdateNote, onOpenAiModal, isLoading = false, isSidebarCollapsed = false, isEditMode, setIsEditMode }: DashboardProps) {
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
        github: true,
        aiDescriptions: !import.meta.env.DEV // false in dev, true in production
    });
    const { isSuppressed } = useNotification();
    const [blockSize, setBlockSize] = useState(12);
    const githubContributionsRef = useRef<HTMLDivElement>(null);

    // Board Preview State - Now stores up to 3 most recently accessed boards
    type BoardPreview = {
        id: string;
        name: string;
        color: string;
        noteCount: number;
        lastAccessed: number;
        previewImage: string | null;
    };
    const [recentBoards, setRecentBoards] = useState<BoardPreview[]>([]);

    // Edit Mode State
    const [customConfigs, setCustomConfigs] = useState<CustomWidgetConfig[]>([]);
    const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);

    const refreshCustomWidgets = () => {
        setCustomConfigs(getWidgetConfigs());
    };

    useEffect(() => {
        refreshCustomWidgets();
    }, []);

    const handleDeleteCustomWidget = (id: string) => {
        if (confirm('Are you sure you want to delete this widget?')) {
            deleteWidgetConfig(id);
            refreshCustomWidgets();
            // Remove from layout
            setDashboardLayout(prev => prev.map(row => ({
                ...row,
                widgets: row.widgets.filter(w => w !== id)
            })).filter(row => row.widgets.length > 0));
            // Remove from hidden
            setHiddenWidgets(prev => prev.filter(w => w !== id));
        }
    };

    const handleCustomWidgetSaved = () => {
        refreshCustomWidgets();
        // The new widget is saved in localStorage, but we need to add it to the layout or hidden list.
        // Since we don't know the ID here easily without passing it back, let's just reload configs.
        // Actually, let's make AddCustomWidgetModal return the new ID or config, but for now, 
        // we can just find the new one.
        const configs = getWidgetConfigs();
        const allWidgetIds = new Set([...dashboardLayout.flatMap(r => r.widgets), ...hiddenWidgets]);

        configs.forEach(c => {
            if (!allWidgetIds.has(c.id)) {
                // New widget found, add to layout
                setDashboardLayout(prev => [
                    ...prev,
                    { id: `row-${Date.now()}`, widgets: [c.id] }
                ]);
            }
        });
    };

    // New grid-based layout structure
    // Each row can contain 1-2 widgets
    type DashboardRow = {
        id: string;
        widgets: string[]; // 1-2 widget IDs
        widthRatio?: number; // For 2-widget rows: left widget width percentage (0-100)
        height?: number; // Optional shared height for the row
    };

    const [dashboardLayout, setDashboardLayout] = useState<DashboardRow[]>(() => {
        const saved = localStorage.getItem('dashboard_layout_v2');
        if (saved) {
            return JSON.parse(saved);
        }
        // Default layout: each widget in its own row
        return [
            { id: 'row-1', widgets: ['briefing'] },
            { id: 'row-2', widgets: ['main_content'] },
            { id: 'row-3', widgets: ['github'] },
            { id: 'row-4', widgets: ['fortnite'] },
            { id: 'row-5', widgets: ['board'] }
        ];
    });

    const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const [showEditTip, setShowEditTip] = useState(false);
    const [use24Hour, setUse24Hour] = useState<boolean>(() => {
        const saved = localStorage.getItem('dashboard_use24HourTime');
        return saved === 'true';
    });
    const [trendTimeRange, setTrendTimeRange] = useState<'1W' | '1M' | 'ALL'>(() => {
        const saved = localStorage.getItem('taskTrendChart-timeRange');
        return (saved as '1W' | '1M' | 'ALL') || '1W';
    });

    // Debug logging
    useEffect(() => {
        console.log('🎯 Dashboard Layout State:', dashboardLayout);
        console.log('👁️ Hidden Widgets:', hiddenWidgets);
        console.log('✏️ Edit Mode:', isEditMode);
    }, [dashboardLayout, hiddenWidgets, isEditMode]);

    // Load saved hidden widgets
    useEffect(() => {
        const savedHidden = localStorage.getItem('dashboard_hidden_widgets');
        if (savedHidden) {
            setHiddenWidgets(JSON.parse(savedHidden));
        }

        // Check if edit tip has been shown
        const tipShown = localStorage.getItem('dashboard_edit_tip_shown');
        if (!tipShown && !isSuppressed) {
            setTimeout(() => setShowEditTip(true), 2000);
        }
    }, [isSuppressed]);

    // Save layout on change
    useEffect(() => {
        localStorage.setItem('dashboard_layout_v2', JSON.stringify(dashboardLayout));
    }, [dashboardLayout]);

    useEffect(() => {
        localStorage.setItem('dashboard_hidden_widgets', JSON.stringify(hiddenWidgets));
    }, [hiddenWidgets]);

    const handleLongPressStart = () => {
        longPressTimer.current = setTimeout(() => {
            setIsEditMode(true);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 800);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    const toggleTimeFormat = () => {
        setUse24Hour(prev => {
            const newValue = !prev;
            localStorage.setItem('dashboard_use24HourTime', String(newValue));
            return newValue;
        });
    };

    const toggleWidgetVisibility = (widgetId: string) => {
        if (hiddenWidgets.includes(widgetId)) {
            // Unhide: Remove from hidden, add as new row
            setHiddenWidgets(prev => prev.filter(id => id !== widgetId));
            setDashboardLayout(prev => [...prev, { id: `row-${Date.now()}`, widgets: [widgetId] }]);
        } else {
            // Hide: Remove from all rows
            setDashboardLayout(prev =>
                prev.map(row => ({
                    ...row,
                    widgets: row.widgets.filter(w => w !== widgetId)
                })).filter(row => row.widgets.length > 0)
            );
            setHiddenWidgets(prev => [...prev, widgetId]);
        }
    };

    // Move widget to combine with another (side-by-side)
    const combineWidgets = (widgetId: string, targetRowId: string) => {
        const targetRow = dashboardLayout.find(r => r.id === targetRowId);
        if (!targetRow || targetRow.widgets.length >= 2 || targetRow.widgets.includes(widgetId)) return;

        setDashboardLayout(prev => {
            // Remove widget from current row
            const withoutWidget = prev.map(row => ({
                ...row,
                widgets: row.widgets.filter(w => w !== widgetId)
            })).filter(row => row.widgets.length > 0);

            // Add to target row
            return withoutWidget.map(row => {
                if (row.id === targetRowId) {
                    return { ...row, widgets: [...row.widgets, widgetId], widthRatio: 50, height: 500 };
                }
                return row;
            });
        });
    };

    // Separate widget to its own row
    const separateWidget = (widgetId: string, rowId: string) => {
        setDashboardLayout(prev => {
            const newLayout: DashboardRow[] = [];
            prev.forEach(row => {
                if (row.id === rowId && row.widgets.includes(widgetId)) {
                    if (row.widgets.length === 2) {
                        // Split into two rows
                        const otherWidget = row.widgets.find(w => w !== widgetId);
                        newLayout.push({ id: `row-${Date.now()}-1`, widgets: [otherWidget!] });
                        newLayout.push({ id: `row-${Date.now()}-2`, widgets: [widgetId] });
                    } else {
                        newLayout.push(row);
                    }
                } else {
                    newLayout.push(row);
                }
            });
            return newLayout;
        });
    };

    // Completion Modal State
    const [completionModal, setCompletionModal] = useState<{
        isOpen: boolean;
        noteId: string;
        dateKey: string;
        currentCompleted: boolean;
        noteTitle: string;
    }>({
        isOpen: false,
        noteId: '',
        dateKey: '',
        currentCompleted: false,
        noteTitle: ''
    });

    // Combine Widget State
    const [combiningWidget, setCombiningWidget] = useState<string | null>(null);


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

    // Load board data for preview widget
    useEffect(() => {
        const loadBoardData = async () => {
            try {
                // @ts-ignore
                const response = await window.ipcRenderer.invoke('get-boards');
                let boards: any[] = [];

                if (Array.isArray(response)) {
                    boards = response;
                } else if (response && response.boards && Array.isArray(response.boards)) {
                    boards = response.boards;
                }

                if (boards.length > 0) {
                    // Sort by most recently accessed and take top 3
                    const sortedBoards = [...boards].sort((a: any, b: any) =>
                        (b.lastAccessed || 0) - (a.lastAccessed || 0)
                    ).slice(0, 3);

                    // Load preview images for each board
                    const boardPreviews: BoardPreview[] = sortedBoards.map((board: any) => {
                        let previewImage: string | null = null;
                        try {
                            // Try to get individual board preview from localStorage
                            const savedPreview = localStorage.getItem(`boardPreviewImage_${board.id}`);
                            if (savedPreview) {
                                const parsed = JSON.parse(savedPreview);
                                previewImage = parsed.image;
                            } else {
                                // Fallback to the old single preview format
                                const legacyPreview = localStorage.getItem('boardPreviewImage');
                                if (legacyPreview) {
                                    const parsed = JSON.parse(legacyPreview);
                                    if (parsed.boardId === board.id) {
                                        previewImage = parsed.image;
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Failed to load board preview image:', e);
                        }

                        return {
                            id: board.id,
                            name: board.name,
                            color: board.color,
                            noteCount: board.notes?.length || 0,
                            lastAccessed: board.lastAccessed || Date.now(),
                            previewImage
                        };
                    });

                    setRecentBoards(boardPreviews);
                }
            } catch (e) {
                console.error('Failed to load board data for preview:', e);
            }
        };
        loadBoardData();
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
            setIsEventsHeightDragging(false);
            setIsTrendsHeightDragging(false);
            setIsBriefingHeightDragging(false);
            setIsGithubHeightDragging(false);
            setIsStatsHeightDragging(false);
        };

        if (isDragging || isEventsHeightDragging || isTrendsHeightDragging || isBriefingHeightDragging || isGithubHeightDragging || isStatsHeightDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isEventsHeightDragging, isTrendsHeightDragging, isBriefingHeightDragging, isGithubHeightDragging, isStatsHeightDragging, leftWidth, panelHeight]);

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
                const [hours, minutes] = note.time.split(':').map(Number);
                const eventDateTime = new Date(date);
                eventDateTime.setHours(hours, minutes, 0, 0);

                const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const isToday = eventDate.getTime() === todayStart.getTime();
                const isOverdue = eventDateTime.getTime() < now.getTime();

                const effectiveNote = { ...note };
                if (isToday && effectiveNote.importance !== 'high') {
                    effectiveNote.importance = 'high';
                }

                allEvents.push({ date: eventDateTime, note: effectiveNote, isOverdue, dateKey: dateStr });
            });
        });

        // Group by seriesId
        const seriesMap = new Map();
        const singleEvents: typeof allEvents = [];

        allEvents.forEach(event => {
            if (event.note.seriesId) {
                if (!seriesMap.has(event.note.seriesId)) {
                    seriesMap.set(event.note.seriesId, []);
                }
                seriesMap.get(event.note.seriesId).push(event);
            } else {
                singleEvents.push(event);
            }
        });

        const displayEvents: any[] = [];

        // Add grouped recurring events
        seriesMap.forEach((instances: typeof allEvents) => {
            const sorted = instances.sort((a, b) => a.date.getTime() - b.date.getTime());
            // Use first uncompleted instance as representative, or the last one if all completed
            const first = sorted.find(i => !i.note.completed) || sorted[sorted.length - 1];
            const completed = instances.filter(i => i.note.completed).length;

            displayEvents.push({
                ...first,
                isRecurringSeries: true,
                seriesInstances: sorted,
                completedCount: completed,
                totalCount: instances.length
            });
        });

        displayEvents.push(...singleEvents);

        return displayEvents.sort((a, b) => {
            const timeDiff = a.date.getTime() - b.date.getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.note.title.localeCompare(b.note.title);
        });
    };

    const allUpcomingEvents = getAllUpcomingEvents();

    // Toggle task completion
    const handleToggleComplete = async (noteId: string, dateKey: string, currentCompleted: boolean, event?: any) => {
        if (event?.isRecurringSeries && event?.seriesInstances) {
            // Find next uncompleted instance
            const nextUncompleted = event.seriesInstances.find((i: any) => !i.note.completed);

            if (nextUncompleted && !currentCompleted) {
                // Complete the next instance
                const updatedNotes = { ...notes };
                const noteIndex = updatedNotes[nextUncompleted.dateKey].findIndex(
                    (n: Note) => n.id === nextUncompleted.note.id
                );

                if (noteIndex !== -1) {
                    updatedNotes[nextUncompleted.dateKey][noteIndex] = {
                        ...updatedNotes[nextUncompleted.dateKey][noteIndex],
                        completed: true
                    };

                    onUpdateNote(updatedNotes[nextUncompleted.dateKey][noteIndex], nextUncompleted.date);

                    // Show confetti
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
            }
        } else {
            const dayNotes = notes[dateKey] || [];
            const noteToUpdate = dayNotes.find(n => n.id === noteId);

            if (!noteToUpdate) return;

            // Just toggle completion status
            // Default to "On Time" (completedLate: false) when marking as complete
            // Clear missed flag when uncompleting
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

    // Mark task as missed explicitly
    const handleMarkMissed = (noteId: string, dateKey: string) => {
        const dayNotes = notes[dateKey] || [];
        const noteToUpdate = dayNotes.find(n => n.id === noteId);

        if (!noteToUpdate) return;

        const updatedNote = {
            ...noteToUpdate,
            missed: true,
            completed: false,
            completedLate: undefined
        };

        onUpdateNote(updatedNote, parseISO(dateKey));
    };

    // Complete task late (overdue tasks)
    const handleCompleteLate = (noteId: string, dateKey: string) => {
        const dayNotes = notes[dateKey] || [];
        const noteToUpdate = dayNotes.find(n => n.id === noteId);

        if (!noteToUpdate) return;

        const updatedNote = {
            ...noteToUpdate,
            completed: true,
            completedLate: true,
            missed: false
        };

        onUpdateNote(updatedNote, parseISO(dateKey));

        // Small confetti for late completion
        confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.7 },
            colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
            scalar: 0.6
        });
    };

    // Calculate overdue time
    const getOverdueTime = (eventDate: Date) => {
        const now = new Date();
        const diff = now.getTime() - eventDate.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d overdue`;
        if (hours > 0) return `${hours}h overdue`;
        if (minutes > 0) return `${minutes}m overdue`;
        return 'Just now';
    };

    const confirmCompletion = (isLate: boolean) => {
        const { noteId, dateKey } = completionModal;
        if (!noteId || !dateKey) return;

        const dayNotes = notes[dateKey] || [];
        const noteToUpdate = dayNotes.find(n => n.id === noteId);

        if (noteToUpdate) {
            const updatedNote = {
                ...noteToUpdate,
                completed: true,
                completedLate: isLate
            };
            onUpdateNote(updatedNote, parseISO(dateKey));

            if (!isLate) {
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
        }

        setCompletionModal(prev => ({ ...prev, isOpen: false }));
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
            // Tasks tab: all incomplete, non-missed tasks (including overdue)
            return filtered.filter(e => !e.note.completed && !e.note.missed);
        } else if (eventTab === 'completed') {
            return filtered.filter(e => e.note.completed === true);
        } else {
            // Missed tab: explicitly marked as missed
            return filtered.filter(e => e.note.missed === true);
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
            // At the start of the briefing fetch logic
            // In dev mode, skip AI briefing unless explicitly enabled in Settings
            if (import.meta.env.DEV) {
                const devBriefingEnabled = localStorage.getItem('dev_enable_ai_briefing') === 'true';
                if (!devBriefingEnabled) {
                    setAiSummary("AI briefing disabled in dev mode. Enable in Settings → AI Configuration.");
                    return;
                }
            }

            const shouldAutoGenerate = localStorage.getItem('disable_auto_briefing') !== 'true';
            if (!shouldAutoGenerate) {
                console.log('Auto-briefing disabled in Dev Tools');
                return;
            }

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
            // EXCEPT for rate limit errors - those should be cached to avoid wasting quota
            else if (eventsHash === cachedHash && cachedSummary &&
                !cachedSummary.startsWith("Sorry, I couldn't generate") &&
                !cachedSummary.includes("Error") &&
                !cachedSummary.includes("AI cap limit reached")) {
                setAiSummary(cachedSummary);
                return;
            }

            // If we have a rate limit error cached, keep showing it and don't retry
            if (cachedSummary && (cachedSummary.includes("rate limit") || cachedSummary.includes("quota"))) {
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
            } catch (error: any) {
                console.error("Failed to get AI summary:", error);

                // Check if this is a rate limit error
                const errorMessage = error?.message || error?.toString() || '';
                if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('429')) {
                    const rateLimitMsg = "Daily API quota reached. Briefing will refresh tomorrow.";
                    setAiSummary(rateLimitMsg);
                    localStorage.setItem('dashboard_ai_summary', rateLimitMsg);
                } else if (!aiSummary) {
                    setAiSummary("Unable to generate briefing at this time.");
                }
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
                return <strong key={index} className="font-bold" style={{ color: accentColor }}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const renderWidget = (id: string, overrideHeight?: number) => {
        if (id.startsWith('custom_')) {
            const config = customConfigs.find(c => c.id === id);
            if (config) {
                return (
                    <div style={{ height: overrideHeight ? `${overrideHeight}px` : '350px' }}>
                        <CustomWidgetContainer
                            config={config}
                            onDelete={() => handleDeleteCustomWidget(id)}
                            isEditMode={isEditMode}
                        />
                    </div>
                );
            }
        }

        switch (id) {
            case 'briefing':
                return (
                    <motion.div
                        ref={briefingRef}
                        style={{ height: overrideHeight ? `${overrideHeight}px` : (briefingHeight ? `${briefingHeight}px` : 'auto') }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="p-6 md:p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative flex flex-col overflow-hidden"
                    >
                        <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Your briefing</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-white dark:from-gray-800 dark:to-gray-900 border border-indigo-100/50 dark:border-gray-700 min-h-[80px] flex items-center flex-1 overflow-y-auto custom-scrollbar">
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

                        {/* Resize Handle for Briefing */}
                        {!overrideHeight && (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-b-[2rem] transition-colors group/handle z-20"
                                onMouseDown={(e) => { handleLongPressEnd(); handleBriefingHeightMouseDown(e); }}
                            >
                                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                            </div>
                        )}
                    </motion.div>
                );
            case 'main_content':
                return (
                    <>
                        <div ref={containerRef} style={{ height: overrideHeight ? `${overrideHeight}px` : (isMobile ? 'auto' : `${panelHeight}px`) }} className={clsx("flex select-none", isMobile ? "flex-col gap-6" : "flex-row gap-0")}>
                            {/* Upcoming Events - Resizable Left Column */}
                            <motion.div
                                style={{
                                    width: isMobile ? '100%' : `${leftWidth}%`,
                                    height: isMobile ? `${eventsHeight}px` : `${panelHeight}px`
                                }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="p-6 md:p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 transition-colors flex flex-col h-full relative group shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            {(() => {
                                                const today = new Date();
                                                const rangeStart = new Date(today);
                                                const rangeEnd = new Date(today);
                                                if (trendTimeRange === '1W') {
                                                    rangeStart.setDate(rangeStart.getDate() - 7);
                                                    rangeEnd.setDate(rangeEnd.getDate() + 7);
                                                } else if (trendTimeRange === '1M') {
                                                    rangeStart.setDate(rangeStart.getDate() - 30);
                                                    rangeEnd.setDate(rangeEnd.getDate() + 30);
                                                }
                                                const filteredEvents = trendTimeRange === 'ALL'
                                                    ? upcomingEvents
                                                    : upcomingEvents.filter(e => {
                                                        const eventDate = new Date(e.date);
                                                        return eventDate >= rangeStart && eventDate <= rangeEnd;
                                                    });
                                                const rangeLabel = trendTimeRange === '1W' ? 'this week' : trendTimeRange === '1M' ? 'this month' : 'total';
                                                return `${filteredEvents.length} events ${rangeLabel}`;
                                            })()}
                                        </p>
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
                                        {upcomingEvents.filter(e => !e.note.completed && !e.note.missed).length} Tasks
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
                                        {upcomingEvents.filter(e => e.note.completed === true).length} Completed
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
                                        {upcomingEvents.filter(e => e.note.missed === true).length} Missed
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

                                <div className="space-y-4 flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar [&::-webkit-scrollbar-button]:hidden">
                                    {filteredEventsForTab.length === 0 ? (
                                        <p className="text-gray-400 dark:text-gray-500 text-sm">
                                            {eventTab === 'upcoming' ? 'No tasks.' : eventTab === 'completed' ? 'No completed events.' : 'No missed events.'}
                                        </p>
                                    ) : (
                                        <AnimatePresence mode="popLayout">
                                            {filteredEventsForTab.slice(0, 10).map((event) => {
                                                const { date, note, dateKey } = event;
                                                return (
                                                    <motion.div
                                                        key={note.id}
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.8, x: 50 }}
                                                        transition={{
                                                            duration: 0.2,
                                                            layout: { duration: 0.2 }
                                                        }}
                                                        whileHover={{
                                                            scale: 1.02,
                                                            zIndex: 10,
                                                            transition: { duration: 0.1, ease: "easeOut" }
                                                        }}
                                                        className={clsx(
                                                            "p-3 rounded-xl border transition-all relative overflow-hidden",
                                                            note.completed
                                                                ? note.completedLate
                                                                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50"
                                                                    : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50"
                                                                : note.missed
                                                                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50"
                                                                    : event.isOverdue
                                                                        ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm"
                                                                        : importanceColors[note.importance as keyof typeof importanceColors]
                                                        )}
                                                    >
                                                        {/* Overdue Alert Banner */}
                                                        {event.isOverdue && !note.completed && !note.missed && (
                                                            <div className="absolute top-0 left-0 right-0 h-6 bg-red-500 text-white text-[10px] font-bold px-3 flex items-center justify-between z-10">
                                                                <span>OVERDUE</span>
                                                                <span>{getOverdueTime(date)}</span>
                                                            </div>
                                                        )}

                                                        <div className={clsx("flex items-start gap-3", event.isOverdue && !note.completed && !note.missed && "pt-6")}>
                                                            {/* Checkboxes Container */}
                                                            <div className="flex flex-col gap-1 mt-0.5 flex-shrink-0">
                                                                {/* Completion Checkbox */}
                                                                <motion.button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (event.isOverdue && !note.completed) {
                                                                            // Overdue task - complete as late
                                                                            handleCompleteLate(note.id, dateKey);
                                                                        } else {
                                                                            handleToggleComplete(note.id, dateKey, note.completed || false, event);
                                                                        }
                                                                    }}
                                                                    whileTap={{ scale: 0.8 }}
                                                                    className={clsx(
                                                                        "transition-all",
                                                                        note.completed
                                                                            ? note.completedLate
                                                                                ? "text-amber-500 hover:text-amber-600"
                                                                                : "text-green-500 hover:text-green-600"
                                                                            : "text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500"
                                                                    )}
                                                                    title={event.isOverdue && !note.completed ? "Mark as completed (late)" : "Mark as completed"}
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

                                                                {/* Missed Checkbox - only show for overdue, non-completed tasks */}
                                                                {event.isOverdue && !note.completed && (
                                                                    <motion.button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMarkMissed(note.id, dateKey);
                                                                        }}
                                                                        whileTap={{ scale: 0.8 }}
                                                                        className="text-red-400 hover:text-red-500 transition-all"
                                                                        title="Mark as missed"
                                                                    >
                                                                        <XCircle className="w-5 h-5" />
                                                                    </motion.button>
                                                                )}
                                                            </div>

                                                            <div
                                                                className="flex-1 cursor-pointer"
                                                                onClick={() => onNavigateToNote(date, note.id)}
                                                            >
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={clsx(
                                                                            "font-bold text-sm",
                                                                            note.completed && "line-through text-gray-500 dark:text-gray-400"
                                                                        )}>
                                                                            {note.title}
                                                                        </span>
                                                                        {/* @ts-ignore */}
                                                                        {event.isRecurringSeries && (
                                                                            <div className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700" style={{ color: accentColor }}>
                                                                                <Repeat className="w-3 h-3" />
                                                                                {/* @ts-ignore */}
                                                                                <span className="font-semibold">{event.completedCount}/{event.totalCount}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
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
                                                                                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                                                                                        : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                                                                                )}
                                                                            >
                                                                                {note.completedLate ? 'Late' : 'On Time'}
                                                                            </button>
                                                                        ) : !event.isOverdue ? (
                                                                            <div className="text-[10px] opacity-60 font-semibold">
                                                                                {getCountdown(date, note.time)}
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-start gap-2 text-xs opacity-80">
                                                                    {!note.completed && (
                                                                        <Circle className={clsx("w-2 h-2 mt-[3px] flex-shrink-0 fill-current", importanceIconColors[note.importance as keyof typeof importanceIconColors])} />
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
                                                );
                                            })}
                                        </AnimatePresence>
                                    )}
                                </div>

                                {/* Resize Handle for Events */}
                                {isMobile && (
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-b-[2rem] transition-colors group/handle z-20"
                                        onMouseDown={(e) => { handleLongPressEnd(); handleEventsHeightMouseDown(e); }}
                                    >
                                        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                                    </div>
                                )}
                            </motion.div>

                            {/* Resizable Handle */}
                            {!isMobile && (
                                <div className="relative flex items-center" style={{ height: `${panelHeight}px` }}>
                                    {/* WIDTH Slider (Vertical) */}
                                    <div
                                        className="hidden md:flex w-4 h-full items-center justify-center cursor-col-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-full transition-colors group mx-1"
                                        onMouseDown={(e) => { handleLongPressEnd(); handleMouseDown(e); }}
                                    >
                                        <div className="h-12 w-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                                    </div>

                                    {/* HEIGHT Slider (Horizontal at bottom) */}
                                    <div
                                        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-2 h-4 w-16 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-full transition-colors group/height z-30"
                                        onMouseDown={(e) => {
                                            handleLongPressEnd();
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const startY = e.clientY;
                                            const startHeight = panelHeight;
                                            let currentHeight = startHeight;

                                            const handleMouseMove = (moveEvent: MouseEvent) => {
                                                const deltaY = moveEvent.clientY - startY;
                                                currentHeight = Math.max(250, Math.min(800, startHeight + deltaY));
                                                setPanelHeight(currentHeight);
                                                setEventsHeight(currentHeight);
                                                setTrendsHeight(currentHeight);
                                                // Update the main_content row height in dashboard layout so other widgets move
                                                setDashboardLayout(prev => prev.map(r =>
                                                    r.widgets.includes('main_content') ? { ...r, height: currentHeight } : r
                                                ));
                                            };

                                            const handleMouseUp = () => {
                                                document.removeEventListener('mousemove', handleMouseMove);
                                                document.removeEventListener('mouseup', handleMouseUp);
                                                // Save the height
                                                // @ts-ignore
                                                window.ipcRenderer.invoke('save-device-setting', 'dashboardPanelHeight', currentHeight.toString());
                                            };

                                            document.addEventListener('mousemove', handleMouseMove);
                                            document.addEventListener('mouseup', handleMouseUp);
                                        }}
                                    >
                                        <div className="w-8 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                                    </div>
                                </div>
                            )}

                            {/* Weekly Trends Graph - Resizable Right Column */}
                            {/* Weekly Trends Graph - Resizable Right Column */}
                            <motion.div
                                style={{
                                    width: isMobile ? '100%' : `calc(${100 - leftWidth}% - 1.5rem)`,
                                    height: isMobile ? `${trendsHeight}px` : `${panelHeight}px`
                                }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col h-full transition-colors relative"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Task trends</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                        <ArrowUpRight className="w-4 h-4" />
                                    </div>
                                </div>

                                {/* Task Completion Trend Graph */}
                                <div className="flex-1 w-full min-h-0">
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

                                {/* Resize Handle for Trends */}
                                {isMobile && (
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize rounded-b-[2rem] transition-colors group/handle z-20"
                                        style={{ backgroundColor: 'transparent' }}
                                        onMouseDown={(e) => { handleLongPressEnd(); handleTrendsHeightMouseDown(e); }}
                                    >
                                        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        {/* Shared Height Resize Handle Removed */}
                    </>
                );
            case 'github':
                if (!enabledFeatures.github) return null;
                return (
                    <motion.div
                        ref={githubCardRef}
                        style={{ height: overrideHeight ? `${overrideHeight}px` : (githubHeight ? `${githubHeight}px` : 'auto') }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.22 }}
                        className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative flex flex-col overflow-hidden"
                    >
                        <div className="flex items-center justify-between mb-6 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">GitHub activity</p>
                            </div>
                            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
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

                        {/* Resize Handle for Github */}
                        {!overrideHeight && (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-b-[2rem] transition-colors group/handle z-20"
                                onMouseDown={(e) => { handleLongPressEnd(); handleGithubHeightMouseDown(e); }}
                            >
                                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                            </div>
                        )}
                    </motion.div>
                );
            case 'fortnite':
                if (!enabledFeatures.stats || creatorCodes.length === 0) return null;
                return (
                    <motion.div
                        ref={statsRef}
                        style={{ height: overrideHeight ? `${overrideHeight}px` : (statsHeight ? `${statsHeight}px` : 'auto') }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative overflow-hidden transition-colors"
                    >
                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Fortnite Creative ({creatorCodes.length} maps)</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={loadStats}
                                    className="px-4 py-2 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-gray-200 dark:border-gray-600 shadow-lg shadow-gray-100 dark:shadow-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                    Refresh
                                </motion.button>
                                <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                    <ActivityIcon className="w-4 h-4" />
                                </div>
                            </div>
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

                        {/* Resize Handle for Stats */}
                        {!overrideHeight && (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize rounded-b-[2rem] transition-colors group/handle z-20"
                                onMouseDown={(e) => { handleLongPressEnd(); handleStatsHeightMouseDown(e); }}
                            >
                                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                            </div>
                        )}
                    </motion.div>
                );
            case 'board':
                // Format time ago
                const getTimeAgo = (timestamp: number) => {
                    const now = Date.now();
                    const diff = now - timestamp;
                    const minutes = Math.floor(diff / 60000);
                    const hours = Math.floor(diff / 3600000);
                    const days = Math.floor(diff / 86400000);

                    if (days > 0) return `${days}d ago`;
                    if (hours > 0) return `${hours}h ago`;
                    if (minutes > 0) return `${minutes}m ago`;
                    return 'Just now';
                };

                // Helper component for individual board preview card
                const BoardPreviewCard = ({ board, isMain = false }: { board: BoardPreview; isMain?: boolean }) => {
                    // Capture the board ID to avoid closure issues
                    const boardId = board.id;
                    const handleClick = () => {
                        console.log('🔵 [Dashboard] Opening board:', boardId, board.name);
                        localStorage.setItem('pendingBoardNavigation', boardId);
                        window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: 'drawing' }));
                    };

                    return (
                        <div className="flex flex-col h-full">
                            {/* Board info header */}
                            <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
                                <div className="min-w-0 flex-1">
                                    <h3 className={`font-semibold text-gray-800 dark:text-gray-100 truncate ${isMain ? 'text-sm' : 'text-xs'}`}>
                                        {board.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        <span className="text-[10px]">{board.noteCount} note{board.noteCount !== 1 ? 's' : ''}</span>
                                        <span className="flex items-center gap-1 text-[10px]">
                                            <Clock className="w-2.5 h-2.5" />
                                            {getTimeAgo(board.lastAccessed)}
                                        </span>
                                    </div>
                                </div>
                                <ArrowUpRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            </div>

                            {/* Board preview image - fills remaining space */}
                            <div
                                className="relative rounded-xl cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg overflow-hidden group flex-1"
                                style={{
                                    backgroundColor: '#F5F1E8',
                                    minHeight: isMain ? '100px' : '75px',
                                }}
                                onClick={handleClick}
                            >
                                {board.previewImage ? (
                                    <img
                                        src={board.previewImage}
                                        alt={`${board.name} preview`}
                                        className="w-full h-full object-cover absolute inset-0"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                                        <Folder className={`${isMain ? 'w-6 h-6' : 'w-4 h-4'} text-gray-400 mb-1`} />
                                        <p className="text-gray-500 dark:text-gray-400 text-[10px] text-center px-2">
                                            {board.noteCount > 0 ? 'Click to preview' : 'Empty'}
                                        </p>
                                    </div>
                                )}

                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 px-2 py-1 rounded-full shadow-lg">
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-200">Open</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                };

                // Calculate layout based on number of boards
                const boardCount = recentBoards.length;

                return (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="p-4 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 relative flex flex-col overflow-hidden"
                        style={{ height: overrideHeight ? `${overrideHeight}px` : 'auto', minHeight: '220px' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Boards</p>
                                {boardCount > 0 && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">({boardCount})</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        // Set a flag so Board.tsx knows to skip loading the previous board
                                        localStorage.setItem('pendingNewBoardCreation', 'true');
                                        window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: 'drawing' }));
                                        setTimeout(() => {
                                            window.dispatchEvent(new CustomEvent('create-new-board'));
                                        }, 300);
                                    }}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Create New Board"
                                >
                                    <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                </button>
                                <div className="p-2 rounded-xl" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                    <Folder className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        {/* Board previews */}
                        {boardCount > 0 ? (
                            <div className="flex-1 flex gap-3 min-h-0">
                                {boardCount === 1 ? (
                                    // Single board - full width and height
                                    <div className="flex-1 flex flex-col">
                                        <BoardPreviewCard board={recentBoards[0]} isMain={true} />
                                    </div>
                                ) : boardCount === 2 ? (
                                    // Two boards - split evenly
                                    <>
                                        <div className="flex-1 flex flex-col">
                                            <BoardPreviewCard board={recentBoards[0]} isMain={true} />
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <BoardPreviewCard board={recentBoards[1]} isMain={true} />
                                        </div>
                                    </>
                                ) : (
                                    // Three boards - main on left, two stacked on right
                                    <>
                                        <div className="flex-[1.3] flex flex-col min-w-0">
                                            <BoardPreviewCard board={recentBoards[0]} isMain={true} />
                                        </div>
                                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                                            <div className="flex-1 flex flex-col">
                                                <BoardPreviewCard board={recentBoards[1]} isMain={false} />
                                            </div>
                                            <div className="flex-1 flex flex-col">
                                                <BoardPreviewCard board={recentBoards[2]} isMain={false} />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            // No boards - show create button
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                                    style={{ backgroundColor: `${accentColor}15` }}
                                >
                                    <Folder className="w-7 h-7" style={{ color: accentColor }} />
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">No boards yet</p>
                                <button
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: 'drawing' }));
                                    }}
                                    className="py-2 px-4 rounded-xl text-white font-medium text-sm flex items-center gap-2 transition-colors"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Board
                                </button>
                            </div>
                        )}
                    </motion.div>
                );
            default:
                return null;
        }
    };

    const handleRowHeightMouseDown = (e: React.MouseEvent, row: DashboardRow) => {
        e.preventDefault();
        const startY = e.clientY;
        const container = e.currentTarget.parentElement as HTMLElement;
        const startHeight = container?.offsetHeight || 0;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const newHeight = Math.max(200, startHeight + deltaY);

            // Update row height
            setDashboardLayout(prev => prev.map(r =>
                r.id === row.id ? { ...r, height: newHeight } : r
            ));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className="p-4 md:p-4 space-y-6 md:space-y-6 h-full overflow-y-auto custom-scrollbar">
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

                </div>
                <div className="text-left md:text-right">
                    <h2
                        className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 tracking-tighter cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={toggleTimeFormat}
                        title={`Click to switch to ${use24Hour ? '12-hour' : '24-hour'} format`}
                    >
                        {format(time, use24Hour ? 'HH:mm' : 'h:mm a')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mt-1 md:mt-2 text-base md:text-lg">
                        {format(time, 'EEEE, MMMM do')}
                    </p>
                </div>
            </div>

            {/* Draggable Dashboard Grid Layout */}
            <Reorder.Group
                axis="y"
                values={dashboardLayout}
                onReorder={(newLayout) => {
                    setDashboardLayout(newLayout);
                }}
                className="space-y-6 md:space-y-8"
                style={{
                    transform: isEditMode ? 'scale(0.95)' : 'none',
                    transformOrigin: 'top center',
                    transition: 'transform 0.3s ease'
                }}
            >
                {dashboardLayout.map((row) => {
                    // Filter out hidden widgets from this row
                    const visibleWidgets = row.widgets.filter(w => !hiddenWidgets.includes(w));
                    if (visibleWidgets.length === 0) {
                        return null;
                    }

                    return (
                        <Reorder.Item
                            key={row.id}
                            value={row}
                            dragListener={isEditMode}
                            className="relative"
                        >
                            <div
                                className={clsx("relative", isEditMode && "shake-animation")}
                                onMouseDown={handleLongPressStart}
                                onMouseUp={handleLongPressEnd}
                                onTouchStart={handleLongPressStart}
                                onTouchEnd={handleLongPressEnd}
                                onMouseLeave={handleLongPressEnd}
                            >
                                {/* Row Container */}
                                {visibleWidgets.length === 1 ? (
                                    // Single widget row
                                    <div className="relative" style={{ height: row.height ? `${row.height}px` : 'auto' }}>
                                        {isEditMode && (
                                            <>
                                                <div className="absolute -top-3 -right-3 z-50 flex gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCombiningWidget(visibleWidgets[0] === combiningWidget ? null : visibleWidgets[0]);
                                                        }}
                                                        className={clsx(
                                                            "p-2 rounded-full shadow-sm border transition-all duration-200",
                                                            combiningWidget === visibleWidgets[0]
                                                                ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white"
                                                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-200 dark:hover:border-green-800"
                                                        )}
                                                        title="Combine with another widget"
                                                    >
                                                        <Merge className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            console.log(`🗑️ Hiding widget: ${visibleWidgets[0]}`);
                                                            toggleWidgetVisibility(visibleWidgets[0]);
                                                        }}
                                                        className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full shadow-sm hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-all duration-200"
                                                        title="Hide widget"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Combine Menu Overlay */}
                                                {combiningWidget === visibleWidgets[0] && (
                                                    <div className="absolute top-10 right-0 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]">
                                                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase px-2 py-1 mb-1">Combine with...</p>
                                                        {dashboardLayout
                                                            .filter(r => r.id !== row.id && r.widgets.length === 1)
                                                            .map(r => (
                                                                <button
                                                                    key={r.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        combineWidgets(combiningWidget, r.id);
                                                                        setCombiningWidget(null);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 capitalize"
                                                                >
                                                                    {r.widgets[0].replace('_', ' ')}
                                                                </button>
                                                            ))}
                                                        {dashboardLayout.filter(r => r.id !== row.id && r.widgets.length === 1).length === 0 && (
                                                            <div className="px-3 py-2 text-sm text-gray-400 italic">No other widgets available</div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {renderWidget(visibleWidgets[0], row.height)}

                                        {/* Row Resize Handle - Hidden for main_content */}
                                        {visibleWidgets[0] !== 'main_content' && (
                                            <div
                                                className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-b-[2rem] transition-colors group/handle z-30"
                                                onMouseDown={(e) => { handleLongPressEnd(); handleRowHeightMouseDown(e, row); }}
                                            >
                                                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // 2-Widget Row (Side by Side)
                                    <div className="relative flex gap-4 h-[500px]" style={{ height: row.height ? `${row.height}px` : '500px' }}>
                                        {isEditMode && (
                                            <>
                                                <button
                                                    onClick={() => separateWidget(visibleWidgets[0], row.id)}
                                                    className="absolute -top-3 left-[48%] z-50 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full shadow-sm hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200"
                                                    title="Separate widgets"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleWidgetVisibility(visibleWidgets[1])}
                                                    className="absolute -top-3 -right-3 z-50 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full shadow-sm hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-all duration-200"
                                                    title="Hide right widget"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleWidgetVisibility(visibleWidgets[0])}
                                                    className="absolute -top-3 -left-3 z-50 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full shadow-sm hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-all duration-200"
                                                    title="Hide left widget"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        {/* Left Widget */}
                                        <div style={{ width: `${row.widthRatio || 50}%` }} className="h-full relative">
                                            {renderWidget(visibleWidgets[0], row.height || 500)}
                                        </div>

                                        {/* Width Resizer */}
                                        <div
                                            className="w-4 cursor-col-resize flex items-center justify-center hover:bg-blue-500/20 rounded z-40 transition-colors"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                const startX = e.clientX;
                                                const startRatio = row.widthRatio || 50;
                                                const container = e.currentTarget.parentElement;
                                                if (!container) return;

                                                const containerWidth = container.offsetWidth;

                                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                                    const deltaX = moveEvent.clientX - startX;
                                                    const deltaPercent = (deltaX / containerWidth) * 100;
                                                    const newRatio = Math.max(20, Math.min(80, startRatio + deltaPercent));

                                                    setDashboardLayout(prev => prev.map(r =>
                                                        r.id === row.id ? { ...r, widthRatio: newRatio } : r
                                                    ));
                                                };

                                                const handleMouseUp = () => {
                                                    document.removeEventListener('mousemove', handleMouseMove);
                                                    document.removeEventListener('mouseup', handleMouseUp);
                                                };

                                                document.addEventListener('mousemove', handleMouseMove);
                                                document.addEventListener('mouseup', handleMouseUp);
                                            }}
                                        >
                                            <div className="w-1 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
                                        </div>

                                        {/* Right Widget */}
                                        <div style={{ width: `${100 - (row.widthRatio || 50)}%` }} className="h-full relative">
                                            {renderWidget(visibleWidgets[1], row.height || 500)}
                                        </div>

                                        {/* Row Height Resize Handle */}
                                        <div
                                            className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-row-resize hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-b-[2rem] transition-colors group/handle z-30"
                                            onMouseDown={(e) => { handleLongPressEnd(); handleRowHeightMouseDown(e, row); }}
                                        >
                                            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors shadow-sm" style={{ '--tw-bg-opacity': 1 } as any} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>

            {/* Edit Mode Controls */}
            <AnimatePresence>
                {isEditMode && (
                    <>
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.9 }}
                            className="fixed bottom-24 right-8 z-50 flex flex-col items-end gap-4 w-auto max-w-sm"
                        >
                            {/* Hidden Widgets List */}
                            {hiddenWidgets.length > 0 && (
                                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 text-center uppercase tracking-wider">Add Widgets</h3>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {hiddenWidgets.map(widgetId => (
                                            <button
                                                key={widgetId}
                                                onClick={() => toggleWidgetVisibility(widgetId)}
                                                className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span className="capitalize">{widgetId.replace('_', ' ')}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setIsAddWidgetModalOpen(true)}
                                className="px-6 py-3 bg-blue-600 text-white rounded-full font-bold shadow-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Create Custom Widget
                            </button>
                        </motion.div>

                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => setIsEditMode(false)}
                            className="fixed bottom-8 right-8 z-50 px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold shadow-xl hover:scale-105 transition-transform"
                        >
                            Done
                        </motion.button>
                    </>
                )}
            </AnimatePresence>

            <AddCustomWidgetModal
                isOpen={isAddWidgetModalOpen}
                onClose={() => setIsAddWidgetModalOpen(false)}
                onSave={handleCustomWidgetSaved}
            />

            {/* Edit Mode Tip Notification */}
            <AnimatePresence>
                {showEditTip && !isEditMode && !isSuppressed && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 50, x: '-50%' }}
                        className="fixed bottom-8 left-1/2 z-40 bg-gray-900 dark:bg-white text-white dark:text-gray-900 pl-4 pr-3 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md bg-opacity-90 max-w-sm w-auto whitespace-nowrap border border-gray-800 dark:border-gray-200"
                    >
                        <MousePointerClick className="w-5 h-5 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold">Customize Dashboard</span>
                            <span className="text-[10px] opacity-80 uppercase tracking-wide">Press & Hold to Edit</span>
                        </div>
                        <div className="w-px h-8 bg-white/20 dark:bg-black/10 mx-1" />
                        <button
                            onClick={() => {
                                setShowEditTip(false);
                                localStorage.setItem('dashboard_edit_tip_shown', 'true');
                            }}
                            className="p-1.5 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

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
