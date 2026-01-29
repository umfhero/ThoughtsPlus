import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { AiQuickAddModal } from './components/AiQuickAddModal';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { SetupWizard } from './components/SetupWizard';
import { QuickCaptureOverlay } from './components/QuickCaptureOverlay';
import { QuickToDoAddModal } from './components/QuickTaskAddModal';
import { useNotification } from './contexts/NotificationContext';
import { TimerProvider } from './contexts/TimerContext';
import { TimerAlertOverlay, TimerMiniIndicator } from './components/TimerAlertOverlay';
import { UpdateNotification } from './components/UpdateNotification';
import { QuickTimerModal } from './components/QuickTimerModal';
import { RatingPrompt } from './components/RatingPrompt';
import { DevPage } from './pages/Dev';
import { Page, Note, NotesData, Milestone, MilestonesData, LifeChapter, LifeChaptersData, Snapshot, SnapshotsData, QuickNote, NerdNotebook, NerdNotebooksData } from './types';
import { DashboardLayoutProvider, useDashboardLayout } from './contexts/DashboardLayoutContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ratingPrompt } from './utils/ratingPrompt';
import { TutorialManager } from './components/TutorialManager';

// Lazy load pages for better performance
const CalendarPage = lazy(() => import('./pages/Calendar').then(m => ({ default: m.CalendarPage })));
const StatsPage = lazy(() => import('./pages/Stats').then(m => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })));
const BoardPage = lazy(() => import('./pages/Board').then(m => ({ default: m.BoardPage })));
const GithubPage = lazy(() => import('./pages/Github').then(m => ({ default: m.GithubPage })));
const TimerPage = lazy(() => import('./pages/Timer').then(m => ({ default: m.TimerPage })));
const ProgressPage = lazy(() => import('./pages/Progress').then(m => ({ default: m.ProgressPage })));
const NotebookPage = lazy(() => import('./pages/Notebook').then(m => ({ default: m.NotebookPage })));
const NerdbookPage = lazy(() => import('./pages/Nerdbook').then(m => ({ default: m.NerdbookPage })));
const WorkspacePage = lazy(() => import('./pages/Workspace').then(m => ({ default: m.WorkspacePage })));
const IconGalleryPage = lazy(() => import('./pages/IconGallery'));

// Preload function to load pages in background
const preloadPages = () => {
    // Delay preloading to not interfere with initial render
    setTimeout(() => {
        import('./pages/Calendar');
        import('./pages/Settings');
        import('./pages/Progress');
    }, 1000);

    setTimeout(() => {
        import('./pages/Board');
        import('./pages/Github');
        import('./pages/Timer');
        import('./pages/Stats');
    }, 2000);
};

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [notes, setNotes] = useState<NotesData>({});


    const [milestones, setMilestones] = useState<MilestonesData>({});
    const [lifeChapters, setLifeChapters] = useState<LifeChaptersData>({ chapters: [] });
    const [snapshots, setSnapshots] = useState<SnapshotsData>({});
    const [notebookNotes, setNotebookNotes] = useState<QuickNote[]>([]);
    const [nerdbooks, setNerdbooks] = useState<NerdNotebooksData>({ notebooks: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);
    const [checkingSetup, setCheckingSetup] = useState(true);
    const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
    const [wasWindowHiddenBeforeQuickCapture, setWasWindowHiddenBeforeQuickCapture] = useState(false);
    const [isQuickTodoOpen, setIsQuickTodoOpen] = useState(false);
    const [wasWindowHiddenBeforeQuickTodo, setWasWindowHiddenBeforeQuickTodo] = useState(false);
    const [showRatingPrompt, setShowRatingPrompt] = useState(false);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [userName, setUserName] = useState("User");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isQuickTimerOpen, setIsQuickTimerOpen] = useState(false);
    const [wasWindowHiddenBeforeAiQuickAdd, setWasWindowHiddenBeforeAiQuickAdd] = useState(false);
    const [wasWindowHiddenBeforeQuickTimer, setWasWindowHiddenBeforeQuickTimer] = useState(false);
    const { addNotification } = useNotification();

    // Tutorial State
    const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);

    // Global Edit Mode
    const [isEditMode, setIsEditMode] = useState(false);

    // Dev Mode State - Auto-enabled in development, hidden in production
    const [showDev, setShowDev] = useState(() => import.meta.env.DEV);
    const [isMockMode, setIsMockMode] = useState(() => {
        return localStorage.getItem('dev_mock_mode') === 'true';
    });
    const [isSetupDemoMode, setIsSetupDemoMode] = useState(false);

    // Companion Mode State
    const [companionMode, setCompanionMode] = useState(() => {
        return localStorage.getItem('companion-mode') === 'true';
    });

    // Sync mock mode to localStorage
    useEffect(() => {
        localStorage.setItem('dev_mock_mode', String(isMockMode));
    }, [isMockMode]);

    // Mock Data - designed to show green (completed), orange (late), red (missed), and predictive line
    const [mockNotesState, setMockNotesState] = useState<NotesData>({
        // T-5: Completed on time (Green)
        [new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]]: [
            { id: '1', title: 'Sprint Planning', description: 'Weekly sprint setup.', time: '09:00', importance: 'high', completed: true }
        ],
        // T-4: Completed on time (Green)
        [new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0]]: [
            { id: '2', title: 'Team Standup', description: 'Daily sync.', time: '10:00', importance: 'medium', completed: true }
        ],
        // T-3: Completed LATE (Orange)
        [new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]]: [
            { id: '3', title: 'Project Kickoff', description: 'Initial planning phase.', time: '09:00', importance: 'high', completed: true, completedLate: true }
        ],
        // T-2: Missed (Red)
        [new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]]: [
            { id: '4', title: 'Submit Report', description: 'Weekly progress report.', time: '17:00', importance: 'medium', missed: true }
        ],
        // T-1: Completed LATE (Orange)
        [new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0]]: [
            { id: '5', title: 'Code Review', description: 'Review pull requests.', time: '14:00', importance: 'low', completed: true, completedLate: true }
        ],
        // Today: Upcoming tasks
        [new Date().toISOString().split('T')[0]]: [
            { id: '6', title: 'Team Meeting', description: 'Sync up with team.', time: '10:00', importance: 'medium' },
            { id: '7', title: 'Client Call', description: 'Discuss requirements.', time: '14:00', importance: 'high' }
        ],
        // Tomorrow: Upcoming
        [new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0]]: [
            { id: '8', title: 'Design Review', description: 'Check new mockups.', time: '11:00', importance: 'high' }
        ],
        // Day after tomorrow: Upcoming
        [new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]]: [
            { id: '9', title: 'Update Documentation', description: 'API docs.', time: '15:00', importance: 'low' },
            { id: '10', title: 'Release Planning', description: 'Prepare for v2.0.', time: '16:00', importance: 'medium' }
        ]
    });

    const activeNotes = isMockMode ? mockNotesState : notes;
    const activeUserName = isMockMode ? "David Smith" : userName;

    // Auto-collapse sidebar on mobile
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsSidebarCollapsed(true);
            }
        };

        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Preload pages when Dashboard is active
    useEffect(() => {
        preloadPages();
    }, []);

    useEffect(() => {
        checkFirstRun();
        loadNotes();
        loadUserName();
        loadNotebookNotes();

        // Increment session count for rating prompt
        ratingPrompt.incrementSession();

        // Listen for companion mode changes
        const handleCompanionModeChange = (event: CustomEvent) => {
            setCompanionMode(event.detail);
        };
        window.addEventListener('companion-mode-changed', handleCompanionModeChange as EventListener);

        // Listen for quick capture trigger from main process (global hotkey)
        // @ts-ignore
        const handleOpenQuickCapture = (_event: any, data?: { wasHidden?: boolean }) => {
            console.log('[QuickCapture] Event received from main process, wasHidden:', data?.wasHidden);
            setIsQuickCaptureOpen(true);
            setWasWindowHiddenBeforeQuickCapture(data?.wasHidden || false);
        };
        // @ts-ignore
        window.ipcRenderer?.on('open-quick-capture', handleOpenQuickCapture);

        // Listen for quick to-do trigger from main process (global hotkey)
        // @ts-ignore
        const handleOpenQuickTodo = (_event: any, data?: { wasHidden?: boolean }) => {
            console.log('[QuickTodo] Event received from main process, wasHidden:', data?.wasHidden);
            setIsQuickTodoOpen(true);
            setWasWindowHiddenBeforeQuickTodo(data?.wasHidden || false);
        };
        // @ts-ignore
        window.ipcRenderer?.on('open-quick-todo', handleOpenQuickTodo);

        // Listen for quick timer trigger from main process (global hotkey)
        // @ts-ignore
        const handleOpenQuickTimer = (_event: any, data?: { wasHidden?: boolean }) => {
            console.log('[QuickTimer] Event received from main process, wasHidden:', data?.wasHidden);
            setIsQuickTimerOpen(true);
            setWasWindowHiddenBeforeQuickTimer(data?.wasHidden || false);
        };
        // @ts-ignore
        window.ipcRenderer?.on('open-quick-timer', handleOpenQuickTimer);

        // Listen for AI quick add trigger from main process (global hotkey)
        // @ts-ignore
        const handleOpenAiQuickAdd = (_event: any, data?: { wasHidden?: boolean }) => {
            console.log('[AiQuickAdd] Event received from main process, wasHidden:', data?.wasHidden);
            setIsAiModalOpen(true);
            setWasWindowHiddenBeforeAiQuickAdd(data?.wasHidden || false);
        };
        // @ts-ignore
        window.ipcRenderer?.on('open-ai-quick-add', handleOpenAiQuickAdd);

        return () => {
            window.removeEventListener('companion-mode-changed', handleCompanionModeChange as EventListener);
            // @ts-ignore
            window.ipcRenderer?.off('open-quick-capture', handleOpenQuickCapture);
            // @ts-ignore
            window.ipcRenderer?.off('open-quick-todo', handleOpenQuickTodo);
            // @ts-ignore
            window.ipcRenderer?.off('open-quick-timer', handleOpenQuickTimer);
            // @ts-ignore
            window.ipcRenderer?.off('open-ai-quick-add', handleOpenAiQuickAdd);
        };
    }, []);

    useEffect(() => {
        const checkSettings = async () => {
            // Wait a bit for app to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                // Check API Key
                // @ts-ignore
                const apiKey = await window.ipcRenderer.invoke('get-api-key');
                if (!apiKey) {
                    addNotification({
                        title: 'Setup Required',
                        message: 'Please configure your API Key in settings to enable AI features.',
                        type: 'warning',
                        duration: 10000,
                        action: {
                            label: 'Go to Settings',
                            onClick: () => setCurrentPage('settings')
                        }
                    });
                }

                // Check GitHub
                // @ts-ignore
                const ghUser = await window.ipcRenderer.invoke('get-github-username');
                if (!ghUser) {
                    setTimeout(() => {
                        addNotification({
                            title: 'GitHub Integration',
                            message: 'Connect your GitHub account to track your contributions.',
                            type: 'info',
                            duration: 10000,
                            action: {
                                label: 'Connect',
                                onClick: () => setCurrentPage('settings')
                            }
                        });
                    }, 2000);
                }
            } catch (error) {
                console.error("Error checking settings for notifications:", error);
            }
        };

        if (!showSetup && !checkingSetup) {
            checkSettings();
        }

        // Quick Note Reminder (2 minutes after startup)
        const timer = setTimeout(() => {
            if (!localStorage.getItem('quick_tip_shown')) {
                addNotification({
                    title: 'Quick Tip',
                    message: 'Press Ctrl+M anywhere to create a quick note instantly.',
                    type: 'info',
                    duration: 8000
                });
                localStorage.setItem('quick_tip_shown', 'true');
            }
        }, 120000); // 2 minutes

        return () => clearTimeout(timer);
    }, [showSetup, checkingSetup]);

    const checkFirstRun = async () => {
        try {
            // @ts-ignore
            const setupComplete = await window.ipcRenderer.invoke('get-setup-complete');
            setShowSetup(!setupComplete);
        } catch (err) {
            console.error('Failed to check setup status', err);
        } finally {
            setCheckingSetup(false);
        }
    };

    const handleSetupComplete = () => {
        setShowSetup(false);
        if (isSetupDemoMode) {
            setIsSetupDemoMode(false);
            return;
        }
        loadNotes(); // Reload notes with new data path
    };

    const loadUserName = async () => {
        try {
            // @ts-ignore
            const name = await window.ipcRenderer.invoke('get-username');
            console.log('[User] Loaded username:', name);
            if (name) {
                setUserName(name);
            }
        } catch (err) {
            console.error('Failed to load username', err);
        }
    };

    // Listen for user name changes
    useEffect(() => {
        const handleUserNameChange = () => {
            loadUserName();
        };
        window.addEventListener('user-name-changed', handleUserNameChange);
        return () => {
            window.removeEventListener('user-name-changed', handleUserNameChange);
        };
    }, []);

    // Listen for data path changes
    useEffect(() => {
        const handleDataPathChange = (event: any) => {
            console.log('[Data] Data path changed event received:', event.detail);
            loadNotes(); // Reload notes from new location
        };
        window.addEventListener('data-path-changed', handleDataPathChange);
        return () => {
            window.removeEventListener('data-path-changed', handleDataPathChange);
        };
    }, []);

    // Auto-hide scrollbar logic
    useEffect(() => {
        let scrollTimeout: NodeJS.Timeout;

        const handleScroll = () => {
            document.body.classList.add('is-scrolling');
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                document.body.classList.remove('is-scrolling');
            }, 2000);
        };

        // Use capture: true to catch scroll events from all elements
        window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll, { capture: true });
            clearTimeout(scrollTimeout);
            document.body.classList.remove('is-scrolling');
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                setShowDev(prev => !prev);
                if (!showDev) {
                    addNotification({ title: 'Dev Mode', message: 'Developer tools enabled.', type: 'info' });
                }
            }

            if (e.ctrlKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                setIsAiModalOpen(true);
            }

            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                setIsQuickTimerOpen(true);
            }

            if (e.key === 'Escape') {
                if (isQuickCaptureOpen) {
                    // Let QuickCaptureOverlay handle its own ESC
                    return;
                } else if (isAiModalOpen) {
                    setIsAiModalOpen(false);
                } else if (isQuickTimerOpen) {
                    setIsQuickTimerOpen(false);
                } else {
                    setIsSidebarCollapsed(true);
                }
            }

            if (e.key === 'Control') {
                if (currentPage !== 'drawing' && currentPage !== 'settings' && currentPage !== 'dev' && currentPage !== 'workspace') {
                    setIsSidebarCollapsed(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAiModalOpen, isQuickTimerOpen, isQuickCaptureOpen, currentPage, showDev]);

    // Handle custom navigation events from widgets
    useEffect(() => {
        const handleNavigateEvent = (e: CustomEvent) => {
            const page = e.detail as Page;
            if (page) {
                setCurrentPage(page);
            }
        };
        window.addEventListener('navigate-to-page', handleNavigateEvent as EventListener);
        return () => window.removeEventListener('navigate-to-page', handleNavigateEvent as EventListener);
    }, []);

    const loadNotes = async () => {
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-data');
            console.log('[Notes] Loaded notes data:', data);
            console.log('[Notes] Notes keys:', data?.notes ? Object.keys(data.notes) : 'No notes');
            if (data && data.notes) {
                setNotes(data.notes);
            }
            if (data && data.milestones) {
                setMilestones(data.milestones);
            }
            if (data && data.lifeChapters) {
                setLifeChapters(data.lifeChapters);
            }
            if (data && data.snapshots) {
                setSnapshots(data.snapshots);
            }
            if (data && data.notebookNotes) {
                setNotebookNotes(data.notebookNotes);
            }
            if (data && data.nerdbooks) {
                setNerdbooks(data.nerdbooks);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleNavigateToNote = (date: Date) => {
        setSelectedDate(date);
        setCurrentPage('calendar');
        setCurrentMonth(date);
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(monthIndex);
        setCurrentMonth(newDate);
        setCurrentPage('calendar');
    };

    const handleAddNote = async (note: Note, date: Date) => {
        console.log('🟢 handleAddNote called:', {
            title: note.title,
            hasRecurrence: !!note.recurrence,
            recurrenceType: note.recurrence?.type,
            recurrenceCount: note.recurrence?.count
        });

        const dateKey = date.toISOString().split('T')[0];

        if (isMockMode) {
            const existingNotes = mockNotesState[dateKey] || [];
            const newNotes = { ...mockNotesState, [dateKey]: [...existingNotes, note] };
            setMockNotesState(newNotes);
        } else {
            console.log('[Note] Creating notes map...');
            let newNotesMap = { ...notes };

            // Generate a seriesId if this is a recurring note
            const seriesId = note.recurrence ? crypto.randomUUID() : undefined;
            console.log('[Note] SeriesId:', seriesId);

            // Add the first instance with seriesId
            const firstNote = { ...note, seriesId };
            if (!newNotesMap[dateKey]) newNotesMap[dateKey] = [];
            newNotesMap[dateKey].push(firstNote);
            console.log('[Note] First note added to', dateKey);

            // Handle recurring notes
            if (note.recurrence) {
                console.log('[Note] Processing recurring notes...');
                let currentDate = date;
                let count = 0;
                const r = note.recurrence;
                const limit = r.count || 10;
                const endDate = r.endDate ? new Date(r.endDate) : null;

                // Create additional instances
                while (count < limit - 1) { // -1 because we already added the first one
                    // Calculate next date based on recurrence type
                    if (r.type === 'daily') {
                        currentDate = new Date(currentDate);
                        currentDate.setDate(currentDate.getDate() + 1);
                    } else if (r.type === 'weekly') {
                        currentDate = new Date(currentDate);
                        currentDate.setDate(currentDate.getDate() + 7);
                    } else if (r.type === 'fortnightly') {
                        currentDate = new Date(currentDate);
                        currentDate.setDate(currentDate.getDate() + 14);
                    } else if (r.type === 'monthly') {
                        currentDate = new Date(currentDate);
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }

                    if (endDate && currentDate > endDate) break;

                    const dk = currentDate.toISOString().split('T')[0];
                    if (!newNotesMap[dk]) newNotesMap[dk] = [];
                    newNotesMap[dk].push({ ...note, id: crypto.randomUUID(), seriesId });
                    count++;
                }
                console.log(`[Note] Created ${count + 1} recurring instances`);
            }

            console.log('[Note] Setting notes state...');
            setNotes(newNotesMap);

            console.log('[Note] Saving to backend...');
            try {
                await saveNotesToBackend(newNotesMap);
                console.log('[Note] Backend save completed');
            } catch (error) {
                console.error('[Note] Backend save failed:', error);
            }
        }

        console.log('[Note] Showing notification...');
        addNotification({
            title: 'Note Added',
            message: `"${note.title}" has been added to your calendar.`,
            type: 'success',
            duration: 3000
        });
        console.log('[Note] handleAddNote completed');
    };

    const handleUpdateNote = (note: Note, date: Date) => {
        const dateKey = date.toISOString().split('T')[0];

        if (isMockMode) {
            const existingNotes = mockNotesState[dateKey] || [];
            const updatedNotes = existingNotes.map(n => n.id === note.id ? note : n);
            const newNotes = { ...mockNotesState, [dateKey]: updatedNotes };
            setMockNotesState(newNotes);
        } else {
            const existingNotes = notes[dateKey] || [];
            const updatedNotes = existingNotes.map(n => n.id === note.id ? note : n);
            const newNotes = { ...notes, [dateKey]: updatedNotes };
            setNotes(newNotes);
            saveNotesToBackend(newNotes);
        }

        // Track task completion for rating prompt (if task was marked as completed)
        if (note.completed && !isMockMode) {
            ratingPrompt.trackTaskCompletion();

            // Check if we should show rating prompt after this positive action
            if (ratingPrompt.shouldShowPrompt()) {
                // Delay showing prompt slightly so it doesn't interrupt the completion flow
                setTimeout(() => {
                    setShowRatingPrompt(true);
                }, 2000);
            }
        }

        addNotification({
            title: 'Note Updated',
            message: 'Your changes have been saved.',
            type: 'success',
            duration: 3000
        });
    };

    const saveNotesToBackend = async (newNotes: NotesData) => {
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, notes: newNotes });
    };

    const saveMilestonesToBackend = async (newMilestones: MilestonesData) => {
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, milestones: newMilestones });
    };

    const handleAddMilestone = async (milestone: Milestone) => {
        const dateKey = milestone.date;
        const newMilestones = { ...milestones };
        if (!newMilestones[dateKey]) newMilestones[dateKey] = [];
        newMilestones[dateKey].push(milestone);
        setMilestones(newMilestones);
        await saveMilestonesToBackend(newMilestones);
        addNotification({
            title: 'Milestone Added',
            message: `"${milestone.title}" has been added.`,
            type: 'success',
            duration: 3000
        });
    };

    const handleUpdateMilestone = async (milestone: Milestone) => {
        const dateKey = milestone.date;
        const newMilestones = { ...milestones };
        if (newMilestones[dateKey]) {
            newMilestones[dateKey] = newMilestones[dateKey].map(m =>
                m.id === milestone.id ? milestone : m
            );
            setMilestones(newMilestones);
            await saveMilestonesToBackend(newMilestones);
        }
    };

    const handleDeleteMilestone = async (milestoneId: string, dateKey: string) => {
        const newMilestones = { ...milestones };
        if (newMilestones[dateKey]) {
            newMilestones[dateKey] = newMilestones[dateKey].filter(m => m.id !== milestoneId);
            if (newMilestones[dateKey].length === 0) delete newMilestones[dateKey];
            setMilestones(newMilestones);
            await saveMilestonesToBackend(newMilestones);
            addNotification({
                title: 'Milestone Deleted',
                message: 'The milestone has been removed.',
                type: 'info',
                duration: 3000
            });
        }
    };

    const saveLifeChaptersToBackend = async (data: LifeChaptersData) => {
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, lifeChapters: data });
    };

    const handleAddLifeChapter = async (chapter: LifeChapter) => {
        const newChapters = { ...lifeChapters, chapters: [...lifeChapters.chapters, chapter] };
        setLifeChapters(newChapters);
        await saveLifeChaptersToBackend(newChapters);
    };

    const handleDeleteLifeChapter = async (chapterId: string) => {
        const newChapters = {
            ...lifeChapters,
            chapters: lifeChapters.chapters.filter(c => c.id !== chapterId)
        };
        setLifeChapters(newChapters);
        await saveLifeChaptersToBackend(newChapters);
    };

    const saveSnapshotsToBackend = async (data: SnapshotsData) => {
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, snapshots: data });
    };

    const handleAddSnapshot = async (snapshot: Snapshot) => {
        const newSnapshots = { ...snapshots, [snapshot.id]: snapshot };
        setSnapshots(newSnapshots);
        await saveSnapshotsToBackend(newSnapshots);
    };

    const handleDeleteSnapshot = async (snapshotId: string) => {
        const newSnapshots = { ...snapshots };
        delete newSnapshots[snapshotId];
        setSnapshots(newSnapshots);
        await saveSnapshotsToBackend(newSnapshots);
    };

    // Notebook Notes Functions
    const loadNotebookNotes = async () => {
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-data');
            if (data && data.notebookNotes) {
                setNotebookNotes(data.notebookNotes);
            }
        } catch (err) {
            console.error('Failed to load notebook notes:', err);
        }
    };

    const saveNotebookNotesToBackend = async (notes: QuickNote[]) => {
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, notebookNotes: notes });
    };

    const handleAddQuickNote = async (note: QuickNote) => {
        const newNotes = [note, ...notebookNotes];
        setNotebookNotes(newNotes);
        await saveNotebookNotesToBackend(newNotes);

        // Also add to workspace as a .note file inside "Quick Notes" folder
        try {
            // @ts-ignore
            const workspaceData = await window.ipcRenderer.invoke('get-workspace');
            if (workspaceData) {
                const now = new Date();
                const nowISO = now.toISOString();

                // Find or create the "Quick Notes" folder
                const QUICK_NOTES_FOLDER_NAME = 'Quick Notes';
                let quickNotesFolder = workspaceData.folders?.find(
                    (f: any) => f.name === QUICK_NOTES_FOLDER_NAME && f.parentId === null
                );

                let updatedFolders = workspaceData.folders || [];

                if (!quickNotesFolder) {
                    // Create the Quick Notes folder
                    quickNotesFolder = {
                        id: crypto.randomUUID(),
                        name: QUICK_NOTES_FOLDER_NAME,
                        parentId: null,
                        createdAt: nowISO,
                        updatedAt: nowISO,
                        isQuickNotesFolder: true, // Special flag for icon
                    };
                    updatedFolders = [...updatedFolders, quickNotesFolder];
                }

                // Generate a name based on date/time (e.g., "15 Jan, 10.48 AM")
                const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase().replace(':', '.');
                let fileName = `${dateStr}, ${timeStr}`;

                // Ensure unique name by adding counter if needed (only check within Quick Notes folder)
                const existingNames = workspaceData.files?.filter(
                    (f: any) => f.type === 'note' && f.parentId === quickNotesFolder.id
                ).map((f: any) => f.name) || [];
                let finalName = fileName;
                let counter = 1;
                while (existingNames.includes(finalName)) {
                    finalName = `${fileName} (${counter})`;
                    counter++;
                }

                const newFile = {
                    id: crypto.randomUUID(),
                    name: finalName,
                    type: 'note',
                    parentId: quickNotesFolder.id, // Inside Quick Notes folder
                    createdAt: nowISO,
                    updatedAt: nowISO,
                    contentId: note.id, // Link to the QuickNote
                    filePath: undefined as string | undefined, // Will be set after saving
                };

                // Save the note content to disk as a .nt file in the Quick Notes subfolder
                // @ts-ignore
                const saveResult = await window.ipcRenderer?.invoke('save-workspace-file', {
                    createNew: true,
                    name: finalName,
                    type: 'note',
                    content: note.content, // Save the actual note content as plain text
                    folderName: 'Quick Notes', // Save in Quick Notes subfolder
                });

                if (saveResult?.success && saveResult.filePath) {
                    // Add filePath to the workspace file entry
                    newFile.filePath = saveResult.filePath;
                    console.log('[QuickCapture] Saved quick note to disk:', saveResult.filePath);
                } else {
                    console.warn('[QuickCapture] Failed to save quick note to disk, will use legacy storage');
                }

                const updatedWorkspace = {
                    ...workspaceData,
                    folders: updatedFolders,
                    files: [...(workspaceData.files || []), newFile],
                    recentFiles: [newFile.id, ...(workspaceData.recentFiles || []).slice(0, 9)],
                    expandedFolders: workspaceData.expandedFolders?.includes(quickNotesFolder.id)
                        ? workspaceData.expandedFolders
                        : [...(workspaceData.expandedFolders || []), quickNotesFolder.id],
                };

                // @ts-ignore
                await window.ipcRenderer.invoke('save-workspace', updatedWorkspace);

                // Dispatch custom event to notify WorkspacePage to refresh
                window.dispatchEvent(new CustomEvent('workspace-data-changed', {
                    detail: { action: 'quick-note-added', fileId: newFile.id }
                }));
                console.log('[QuickCapture] Dispatched workspace-data-changed event');
            }
        } catch (err) {
            console.error('Failed to add quick note to workspace:', err);
        }

        addNotification({
            title: 'Note Captured',
            message: 'Quick note saved to Notebook & Workspace.',
            type: 'success',
            duration: 2000
        });
    };

    const handleUpdateQuickNote = async (note: QuickNote) => {
        const newNotes = notebookNotes.map(n => n.id === note.id ? note : n);
        setNotebookNotes(newNotes);
        await saveNotebookNotesToBackend(newNotes);
    };

    const handleDeleteQuickNote = async (noteId: string) => {
        const newNotes = notebookNotes.filter(n => n.id !== noteId);
        setNotebookNotes(newNotes);
        await saveNotebookNotesToBackend(newNotes);
        addNotification({
            title: 'Note Deleted',
            message: 'The note has been removed from your Notebook.',
            type: 'info',
            duration: 2000
        });
    };

    // Nerdbook Functions
    const saveNerdbooksToBackend = async (data: NerdNotebooksData) => {
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, nerdbooks: data });
    };

    const handleAddNerdbook = async (notebook: NerdNotebook) => {
        const newData = {
            ...nerdbooks,
            notebooks: [...nerdbooks.notebooks, notebook],
            activeNotebookId: notebook.id,
        };
        setNerdbooks(newData);
        await saveNerdbooksToBackend(newData);
    };

    const handleUpdateNerdbook = async (notebook: NerdNotebook) => {
        const newData = {
            ...nerdbooks,
            notebooks: nerdbooks.notebooks.map(n => n.id === notebook.id ? notebook : n),
        };
        setNerdbooks(newData);
        await saveNerdbooksToBackend(newData);
    };

    const handleDeleteNerdbook = async (notebookId: string) => {
        const newData = {
            ...nerdbooks,
            notebooks: nerdbooks.notebooks.filter(n => n.id !== notebookId),
        };
        setNerdbooks(newData);
        await saveNerdbooksToBackend(newData);
        addNotification({
            title: 'Notebook Deleted',
            message: 'The notebook has been removed.',
            type: 'info',
            duration: 2000
        });
    };

    // Listen for tutorial start events from Settings
    useEffect(() => {
        const handleStartTutorial = (event: CustomEvent) => {
            const { tutorialId } = event.detail;
            setActiveTutorialId(tutorialId);
        };

        window.addEventListener('start-tutorial', handleStartTutorial as EventListener);
        return () => window.removeEventListener('start-tutorial', handleStartTutorial as EventListener);
    }, []);

    if (checkingSetup) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    if (showSetup) {
        return <SetupWizard onComplete={handleSetupComplete} isDemoMode={isSetupDemoMode} />;
    }

    return (
        <LanguageProvider>
            <DashboardLayoutProvider>
                <TimerProvider>
                    <AppContent
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        activeNotes={activeNotes}
                        activeUserName={activeUserName}
                        isSidebarCollapsed={isSidebarCollapsed}
                        setIsSidebarCollapsed={setIsSidebarCollapsed}
                        showDev={showDev}
                        isEditMode={isEditMode}
                        setIsEditMode={setIsEditMode}
                        isLoading={isLoading}
                        currentMonth={currentMonth}
                        setCurrentMonth={setCurrentMonth}
                        selectedDate={selectedDate}
                        setNotes={setNotes}
                        isMockMode={isMockMode}
                        setIsMockMode={setIsMockMode}
                        isAiModalOpen={isAiModalOpen}
                        setIsAiModalOpen={setIsAiModalOpen}
                        wasWindowHiddenBeforeAiQuickAdd={wasWindowHiddenBeforeAiQuickAdd}
                        setWasWindowHiddenBeforeAiQuickAdd={setWasWindowHiddenBeforeAiQuickAdd}
                        isQuickTimerOpen={isQuickTimerOpen}
                        setIsQuickTimerOpen={setIsQuickTimerOpen}
                        wasWindowHiddenBeforeQuickTimer={wasWindowHiddenBeforeQuickTimer}
                        setWasWindowHiddenBeforeQuickTimer={setWasWindowHiddenBeforeQuickTimer}
                        handleNavigateToNote={handleNavigateToNote}
                        handleMonthSelect={handleMonthSelect}
                        handleAddNote={handleAddNote}
                        handleUpdateNote={handleUpdateNote}
                        setIsSetupDemoMode={setIsSetupDemoMode}
                        setShowSetup={setShowSetup}
                        companionMode={companionMode}
                        milestones={milestones}
                        handleAddMilestone={handleAddMilestone}
                        handleUpdateMilestone={handleUpdateMilestone}
                        handleDeleteMilestone={handleDeleteMilestone}
                        lifeChapters={lifeChapters}
                        handleAddLifeChapter={handleAddLifeChapter}
                        handleDeleteLifeChapter={handleDeleteLifeChapter}
                        snapshots={snapshots}
                        handleAddSnapshot={handleAddSnapshot}
                        handleDeleteSnapshot={handleDeleteSnapshot}
                        notebookNotes={notebookNotes}
                        isQuickCaptureOpen={isQuickCaptureOpen}
                        setIsQuickCaptureOpen={setIsQuickCaptureOpen}
                        wasWindowHiddenBeforeQuickCapture={wasWindowHiddenBeforeQuickCapture}
                        setWasWindowHiddenBeforeQuickCapture={setWasWindowHiddenBeforeQuickCapture}
                        isQuickTodoOpen={isQuickTodoOpen}
                        setIsQuickTodoOpen={setIsQuickTodoOpen}
                        wasWindowHiddenBeforeQuickTodo={wasWindowHiddenBeforeQuickTodo}
                        setWasWindowHiddenBeforeQuickTodo={setWasWindowHiddenBeforeQuickTodo}
                        handleAddQuickNote={handleAddQuickNote}
                        handleUpdateQuickNote={handleUpdateQuickNote}
                        handleDeleteQuickNote={handleDeleteQuickNote}
                        nerdbooks={nerdbooks}
                        handleAddNerdbook={handleAddNerdbook}
                        handleUpdateNerdbook={handleUpdateNerdbook}
                        handleDeleteNerdbook={handleDeleteNerdbook}
                        showRatingPrompt={showRatingPrompt}
                        setShowRatingPrompt={setShowRatingPrompt}
                        activeTutorialId={activeTutorialId}
                        setActiveTutorialId={setActiveTutorialId}
                    />
                </TimerProvider>
            </DashboardLayoutProvider>
        </LanguageProvider>
    );
}

// Extracted inner component to use hooks inside provider
interface AppContentProps {
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
    activeNotes: NotesData;
    activeUserName: string;
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: (value: boolean) => void;
    showDev: boolean;
    isEditMode: boolean;
    setIsEditMode: (value: boolean) => void;
    isLoading: boolean;
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;
    selectedDate: Date | null;
    setNotes: (notes: NotesData) => void;
    isMockMode: boolean;
    setIsMockMode: (value: boolean) => void;
    isAiModalOpen: boolean;
    setIsAiModalOpen: (value: boolean) => void;
    wasWindowHiddenBeforeAiQuickAdd: boolean;
    setWasWindowHiddenBeforeAiQuickAdd: (value: boolean) => void;
    isQuickTimerOpen: boolean;
    setIsQuickTimerOpen: (value: boolean) => void;
    wasWindowHiddenBeforeQuickTimer: boolean;
    setWasWindowHiddenBeforeQuickTimer: (value: boolean) => void;
    handleNavigateToNote: (date: Date, noteId: string) => void;
    handleMonthSelect: (monthIndex: number) => void;
    handleAddNote: (note: Note, date: Date) => void;
    handleUpdateNote: (note: Note, date: Date) => void;
    setIsSetupDemoMode: (value: boolean) => void;
    setShowSetup: (value: boolean) => void;
    companionMode: boolean;
    milestones: MilestonesData;
    handleAddMilestone: (milestone: Milestone) => void;
    handleUpdateMilestone: (milestone: Milestone) => void;
    handleDeleteMilestone: (milestoneId: string, dateKey: string) => void;
    lifeChapters: LifeChaptersData;
    handleAddLifeChapter: (chapter: LifeChapter) => void;
    handleDeleteLifeChapter: (chapterId: string) => void;
    snapshots: SnapshotsData;
    handleAddSnapshot: (snapshot: Snapshot) => void;
    handleDeleteSnapshot: (snapshotId: string) => void;
    notebookNotes: QuickNote[];
    isQuickCaptureOpen: boolean;
    setIsQuickCaptureOpen: (value: boolean) => void;
    wasWindowHiddenBeforeQuickCapture: boolean;
    setWasWindowHiddenBeforeQuickCapture: (value: boolean) => void;
    isQuickTodoOpen: boolean;
    setIsQuickTodoOpen: (value: boolean) => void;
    wasWindowHiddenBeforeQuickTodo: boolean;
    setWasWindowHiddenBeforeQuickTodo: (value: boolean) => void;
    handleAddQuickNote: (note: QuickNote) => void;
    handleUpdateQuickNote: (note: QuickNote) => void;
    handleDeleteQuickNote: (noteId: string) => void;
    nerdbooks: NerdNotebooksData;
    handleAddNerdbook: (notebook: NerdNotebook) => void;
    handleUpdateNerdbook: (notebook: NerdNotebook) => void;
    handleDeleteNerdbook: (notebookId: string) => void;
    showRatingPrompt: boolean;
    setShowRatingPrompt: (value: boolean) => void;
    activeTutorialId: string | null;
    setActiveTutorialId: (id: string | null) => void;
}

// Wrapper component to handle switching between Notebook and Nerdbook views
interface NotebookPageWithNerdbookProps {
    notebookNotes: QuickNote[];
    handleDeleteQuickNote: (noteId: string) => void;
    handleUpdateQuickNote: (note: QuickNote) => void;
    setCurrentPage: (page: Page) => void;
    nerdbooks: NerdNotebooksData;
    handleAddNerdbook: (notebook: NerdNotebook) => void;
    handleUpdateNerdbook: (notebook: NerdNotebook) => void;
    handleDeleteNerdbook: (notebookId: string) => void;
}

function NotebookPageWithNerdbook({
    notebookNotes,
    handleDeleteQuickNote,
    handleUpdateQuickNote,
    setCurrentPage,
    nerdbooks,
    handleAddNerdbook,
    handleUpdateNerdbook,
    handleDeleteNerdbook
}: NotebookPageWithNerdbookProps) {
    const [showNerdbook, setShowNerdbook] = useState(false);

    if (showNerdbook) {
        return (
            <NerdbookPage
                notebooks={nerdbooks.notebooks}
                onAddNotebook={handleAddNerdbook}
                onUpdateNotebook={handleUpdateNerdbook}
                onDeleteNotebook={handleDeleteNerdbook}
                setPage={(page) => {
                    if (page === 'notebook') {
                        setShowNerdbook(false);
                    } else {
                        setCurrentPage(page);
                    }
                }}
            />
        );
    }

    return (
        <NotebookPage
            notes={notebookNotes}
            onDeleteNote={handleDeleteQuickNote}
            onUpdateNote={handleUpdateQuickNote}
            setPage={setCurrentPage}
            nerdbooks={nerdbooks.notebooks}
            onOpenNerdbook={() => setShowNerdbook(true)}
        />
    );
}

function AppContent(props: AppContentProps) {
    const { effectiveSidebarIconOnly } = useDashboardLayout();
    const { addNotification } = useNotification();
    const {
        currentPage, setCurrentPage, activeNotes, activeUserName,
        isSidebarCollapsed, setIsSidebarCollapsed, showDev, isEditMode,
        setIsEditMode, isLoading, currentMonth, setCurrentMonth,
        selectedDate, setNotes, isMockMode, setIsMockMode,
        isAiModalOpen, setIsAiModalOpen, wasWindowHiddenBeforeAiQuickAdd, setWasWindowHiddenBeforeAiQuickAdd,
        isQuickTimerOpen, setIsQuickTimerOpen, wasWindowHiddenBeforeQuickTimer, setWasWindowHiddenBeforeQuickTimer,
        handleNavigateToNote, handleMonthSelect, handleAddNote, handleUpdateNote,
        setIsSetupDemoMode, setShowSetup, companionMode,

        milestones, handleAddMilestone, handleUpdateMilestone, handleDeleteMilestone,
        lifeChapters, handleAddLifeChapter, handleDeleteLifeChapter,
        snapshots, handleAddSnapshot, handleDeleteSnapshot,
        notebookNotes, isQuickCaptureOpen, setIsQuickCaptureOpen,
        wasWindowHiddenBeforeQuickCapture, setWasWindowHiddenBeforeQuickCapture,
        isQuickTodoOpen, setIsQuickTodoOpen,
        wasWindowHiddenBeforeQuickTodo, setWasWindowHiddenBeforeQuickTodo,
        handleAddQuickNote, handleUpdateQuickNote, handleDeleteQuickNote,
        nerdbooks, handleAddNerdbook, handleUpdateNerdbook, handleDeleteNerdbook,
        showRatingPrompt, setShowRatingPrompt,
        activeTutorialId, setActiveTutorialId
    } = props;

    // Check if we're on workspace page - it needs full width layout
    const isWorkspacePage = currentPage === 'workspace';

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden selection:bg-blue-500/30 font-sans transition-colors">
            {/* Custom Title Bar Drag Region */}
            <div className="absolute top-0 left-0 w-full h-8 z-50 app-drag-region" style={{ WebkitAppRegion: 'drag' } as any} />

            <div className="relative z-20 flex w-full h-full pt-8">
                {/* Hide main sidebar when on workspace page - workspace has its own sidebar */}
                <AnimatePresence mode="wait">
                    {!isWorkspacePage && (
                        <motion.div
                            key="main-sidebar"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <Sidebar
                                currentPage={currentPage}
                                setPage={setCurrentPage}
                                notes={activeNotes}
                                onMonthSelect={handleMonthSelect}
                                currentMonth={currentMonth}
                                isCollapsed={isSidebarCollapsed}
                                toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                showDev={showDev}
                                isEditMode={isEditMode}
                                isIconOnly={effectiveSidebarIconOnly}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <main className="flex-1 h-full relative overflow-hidden">
                    <div className={`h-full ${isWorkspacePage ? '' : 'py-4 pr-4 pl-2'}`}>
                        <div className="h-full overflow-hidden relative">
                            <Suspense fallback={
                                <div className="flex h-full items-center justify-center">
                                    <div className="animate-pulse flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                                        <div className="text-xs text-gray-400">Loading...</div>
                                    </div>
                                </div>
                            }>
                                {currentPage === 'dashboard' && (
                                    <Dashboard
                                        notes={activeNotes}
                                        onNavigateToNote={handleNavigateToNote}
                                        userName={activeUserName}
                                        onAddNote={handleAddNote}
                                        onUpdateNote={handleUpdateNote}
                                        onOpenAiModal={() => setIsAiModalOpen(true)}
                                        isLoading={isLoading}
                                        isSidebarCollapsed={isSidebarCollapsed}
                                        isEditMode={isEditMode}
                                        setIsEditMode={setIsEditMode}
                                    />
                                )}
                                {currentPage === 'calendar' && (
                                    <CalendarPage
                                        notes={activeNotes}
                                        setNotes={setNotes}
                                        initialSelectedDate={selectedDate}
                                        currentMonth={currentMonth}
                                        setCurrentMonth={setCurrentMonth}
                                        isSidebarCollapsed={isSidebarCollapsed}
                                        milestones={milestones}
                                        onAddMilestone={handleAddMilestone}
                                        onUpdateMilestone={handleUpdateMilestone}
                                        onDeleteMilestone={handleDeleteMilestone}
                                        lifeChapters={lifeChapters}
                                        onAddLifeChapter={handleAddLifeChapter}
                                        onDeleteLifeChapter={handleDeleteLifeChapter}
                                    />
                                )}
                                {currentPage === 'stats' && <StatsPage isSidebarCollapsed={isSidebarCollapsed} />}
                                {currentPage === 'drawing' && <BoardPage />}
                                {currentPage === 'github' && <GithubPage isMockMode={isMockMode} isSidebarCollapsed={isSidebarCollapsed} />}
                                {currentPage === 'timer' && <TimerPage isSidebarCollapsed={isSidebarCollapsed} />}
                                {currentPage === 'progress' && (
                                    <ProgressPage
                                        notes={activeNotes}
                                        milestones={milestones}
                                        lifeChapters={lifeChapters}
                                        snapshots={snapshots}
                                        onAddSnapshot={handleAddSnapshot}
                                        onDeleteSnapshot={handleDeleteSnapshot}
                                        isSidebarCollapsed={isSidebarCollapsed}
                                        onUpdateNote={handleUpdateNote}
                                    />
                                )}
                                {currentPage === 'notebook' && (
                                    <NotebookPageWithNerdbook
                                        notebookNotes={notebookNotes}
                                        handleDeleteQuickNote={handleDeleteQuickNote}
                                        handleUpdateQuickNote={handleUpdateQuickNote}
                                        setCurrentPage={setCurrentPage}
                                        nerdbooks={nerdbooks}
                                        handleAddNerdbook={handleAddNerdbook}
                                        handleUpdateNerdbook={handleUpdateNerdbook}
                                        handleDeleteNerdbook={handleDeleteNerdbook}
                                    />
                                )}
                                {currentPage === 'workspace' && (
                                    <WorkspacePage
                                        setPage={setCurrentPage}
                                        onSidebarTransition={(visible) => {
                                            // When entering workspace, collapse main sidebar
                                            // When exiting, restore it
                                            if (visible) {
                                                setIsSidebarCollapsed(true);
                                            } else {
                                                setIsSidebarCollapsed(false);
                                            }
                                        }}
                                    />
                                )}
                                {currentPage === 'settings' && <SettingsPage />}
                                {currentPage === 'dev' && (
                                    <DevPage
                                        isMockMode={isMockMode}
                                        toggleMockMode={() => setIsMockMode(!isMockMode)}
                                        onForceSetup={() => {
                                            setIsSetupDemoMode(true);
                                            setShowSetup(true);
                                        }}
                                        onForceSnapshot={() => {
                                            // Generate a test snapshot
                                            const now = new Date();
                                            const snapshot: Snapshot = {
                                                id: crypto.randomUUID(),
                                                type: 'monthly',
                                                date: now.toISOString().split('T')[0],
                                                content: 'This is a test snapshot generated from Dev Tools. Use this to test the snapshot display and functionality.',
                                                tags: ['test', 'dev'],
                                                sentiment: 'neutral'
                                            };
                                            handleAddSnapshot(snapshot);
                                        }}
                                        onForceRatingPrompt={() => {
                                            setShowRatingPrompt(true);
                                        }}
                                        activeTutorialId={activeTutorialId}
                                        setActiveTutorialId={setActiveTutorialId}
                                    />
                                )}
                                {currentPage === 'icons' && <IconGalleryPage />}
                            </Suspense>
                        </div>
                    </div>
                </main>
            </div>

            <AiQuickAddModal
                isOpen={isAiModalOpen}
                onClose={() => {
                    setIsAiModalOpen(false);
                    setWasWindowHiddenBeforeAiQuickAdd(false);
                }}
                onSave={handleAddNote}
                wasTriggeredFromHidden={wasWindowHiddenBeforeAiQuickAdd}
            />

            <ShortcutsOverlay currentPage={currentPage} />

            {/* Timer overlays - visible on all pages */}
            <TimerAlertOverlay isSidebarCollapsed={isSidebarCollapsed} />

            {/* Update notification - checks for new versions */}
            <UpdateNotification isSidebarCollapsed={isSidebarCollapsed} />

            {/* Quick Timer Modal */}
            <QuickTimerModal
                isOpen={isQuickTimerOpen}
                onClose={() => {
                    setIsQuickTimerOpen(false);
                    setWasWindowHiddenBeforeQuickTimer(false);
                }}
                wasTriggeredFromHidden={wasWindowHiddenBeforeQuickTimer}
            />
            <TimerMiniIndicator isSidebarCollapsed={isSidebarCollapsed} />

            {/* Quick Capture Overlay - triggered by global hotkey */}
            <QuickCaptureOverlay
                isOpen={isQuickCaptureOpen}
                onClose={() => {
                    setIsQuickCaptureOpen(false);
                    setWasWindowHiddenBeforeQuickCapture(false);
                }}
                onSaveNote={handleAddQuickNote}
                wasTriggeredFromHidden={wasWindowHiddenBeforeQuickCapture}
            />

            {/* Quick To-Do Modal - triggered by global hotkey */}
            <QuickToDoAddModal
                isOpen={isQuickTodoOpen}
                onClose={() => {
                    setIsQuickTodoOpen(false);
                    setWasWindowHiddenBeforeQuickTodo(false);
                }}
                onSaveTask={async (task) => {
                    try {
                        // Load existing todos from backend
                        // @ts-ignore
                        const data = await window.ipcRenderer.invoke('get-todos');
                        const existingTodos = data?.todos || [];

                        // Create new todo at the top (order 0)
                        const newTodo = {
                            id: `todo-${Date.now()}`,
                            ...task,
                            createdAt: new Date().toISOString(),
                            order: 0,
                        };

                        // Reorder existing todos and add new one at the top
                        const reorderedTodos = existingTodos.map((todo: any) => ({ ...todo, order: todo.order + 1 }));
                        const updatedTodos = [newTodo, ...reorderedTodos];

                        // Save to backend (tasks.json)
                        // @ts-ignore
                        await window.ipcRenderer.invoke('save-todos', updatedTodos);

                        // Dispatch event to notify Dashboard to reload
                        window.dispatchEvent(new CustomEvent('todos-changed'));

                        // Show notification
                        addNotification({
                            title: 'To-Do Added',
                            message: `"${task.title}" has been added to your checklist.`,
                            type: 'success',
                            duration: 3000
                        });
                    } catch (err) {
                        console.error('Failed to save todo:', err);
                        addNotification({
                            title: 'Error',
                            message: 'Failed to save to-do. Please try again.',
                            type: 'error',
                            duration: 3000
                        });
                    }
                }}
                wasTriggeredFromHidden={wasWindowHiddenBeforeQuickTodo}
            />

            {/* Rating Prompt - shown after positive user experiences */}
            {showRatingPrompt && (
                <RatingPrompt onClose={() => setShowRatingPrompt(false)} />
            )}

            {/* Companion Pet */}
            {companionMode && (
                <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="fixed bottom-6 right-6 z-40 pointer-events-none select-none"
                >
                    <motion.div
                        animate={{
                            y: [0, -10, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="text-6xl drop-shadow-lg"
                    >
                        🐱
                    </motion.div>
                </motion.div>
            )}

            {/* Tutorial Manager - handles interactive tutorials */}
            <TutorialManager
                activeTutorialId={activeTutorialId}
                onComplete={() => setActiveTutorialId(null)}
                onNavigate={(page) => setCurrentPage(page)}
            />
        </div>
    );
}

export default App;