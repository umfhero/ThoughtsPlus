import { useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { AiQuickAddModal } from './components/AiQuickAddModal';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { SetupWizard } from './components/SetupWizard';
import { useNotification } from './contexts/NotificationContext';
import { TimerProvider } from './contexts/TimerContext';
import { TimerAlertOverlay, TimerMiniIndicator } from './components/TimerAlertOverlay';
import { QuickTimerModal } from './components/QuickTimerModal';
import { DevPage } from './pages/Dev';
import { Page, Note, NotesData } from './types';
import { DashboardLayoutProvider, useDashboardLayout } from './contexts/DashboardLayoutContext';

// Lazy load pages for better performance
const CalendarPage = lazy(() => import('./pages/Calendar').then(m => ({ default: m.CalendarPage })));
const StatsPage = lazy(() => import('./pages/Stats').then(m => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })));
const BoardPage = lazy(() => import('./pages/Board').then(m => ({ default: m.BoardPage })));
const GithubPage = lazy(() => import('./pages/Github').then(m => ({ default: m.GithubPage })));
const TimerPage = lazy(() => import('./pages/Timer').then(m => ({ default: m.TimerPage })));
const ProgressPage = lazy(() => import('./pages/Progress').then(m => ({ default: m.ProgressPage })));

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
    const [isLoading, setIsLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);
    const [checkingSetup, setCheckingSetup] = useState(true);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [userName, setUserName] = useState("User");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isQuickTimerOpen, setIsQuickTimerOpen] = useState(false);
    const { addNotification } = useNotification();

    // Global Edit Mode
    const [isEditMode, setIsEditMode] = useState(false);

    // Dev Mode State
    const [showDev, setShowDev] = useState(false);
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

        // Listen for companion mode changes
        const handleCompanionModeChange = (event: CustomEvent) => {
            setCompanionMode(event.detail);
        };
        window.addEventListener('companion-mode-changed', handleCompanionModeChange as EventListener);

        return () => {
            window.removeEventListener('companion-mode-changed', handleCompanionModeChange as EventListener);
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

                // Check Auto Launch
                // @ts-ignore
                const autoLaunch = await window.ipcRenderer.invoke('get-auto-launch');
                if (!autoLaunch) {
                    setTimeout(() => {
                        addNotification({
                            title: 'Run on Startup',
                            message: 'Enable auto-launch to never miss your schedule.',
                            type: 'info',
                            duration: 10000,
                            action: {
                                label: 'Enable',
                                onClick: () => setCurrentPage('settings')
                            }
                        });
                    }, 4000);
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
            console.log('👤 Loaded username:', name);
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
            console.log('🔄 Data path changed event received:', event.detail);
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
                if (isAiModalOpen) {
                    setIsAiModalOpen(false);
                } else if (isQuickTimerOpen) {
                    setIsQuickTimerOpen(false);
                } else {
                    setIsSidebarCollapsed(true);
                }
            }

            if (e.key === 'Control') {
                if (currentPage !== 'drawing' && currentPage !== 'settings' && currentPage !== 'dev') {
                    setIsSidebarCollapsed(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAiModalOpen, isQuickTimerOpen, currentPage, showDev]);

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
            console.log('📥 Loaded notes data:', data);
            console.log('📊 Notes keys:', data?.notes ? Object.keys(data.notes) : 'No notes');
            if (data && data.notes) {
                setNotes(data.notes);
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
            console.log('🟢 Creating notes map...');
            let newNotesMap = { ...notes };

            // Generate a seriesId if this is a recurring note
            const seriesId = note.recurrence ? crypto.randomUUID() : undefined;
            console.log('🟢 SeriesId:', seriesId);

            // Add the first instance with seriesId
            const firstNote = { ...note, seriesId };
            if (!newNotesMap[dateKey]) newNotesMap[dateKey] = [];
            newNotesMap[dateKey].push(firstNote);
            console.log('🟢 First note added to', dateKey);

            // Handle recurring notes
            if (note.recurrence) {
                console.log('🟢 Processing recurring notes...');
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
                console.log(`🟢 Created ${count + 1} recurring instances`);
            }

            console.log('🟢 Setting notes state...');
            setNotes(newNotesMap);

            console.log('🟢 Saving to backend...');
            try {
                await saveNotesToBackend(newNotesMap);
                console.log('✅ Backend save completed');
            } catch (error) {
                console.error('❌ Backend save failed:', error);
            }
        }

        console.log('🟢 Showing notification...');
        addNotification({
            title: 'Note Added',
            message: `"${note.title}" has been added to your calendar.`,
            type: 'success',
            duration: 3000
        });
        console.log('✅ handleAddNote completed');
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
                isQuickTimerOpen={isQuickTimerOpen}
                setIsQuickTimerOpen={setIsQuickTimerOpen}
                handleNavigateToNote={handleNavigateToNote}
                handleMonthSelect={handleMonthSelect}
                handleAddNote={handleAddNote}
                handleUpdateNote={handleUpdateNote}
                setIsSetupDemoMode={setIsSetupDemoMode}
                setShowSetup={setShowSetup}
                companionMode={companionMode}
            />
        </TimerProvider>
        </DashboardLayoutProvider>
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
    isQuickTimerOpen: boolean;
    setIsQuickTimerOpen: (value: boolean) => void;
    handleNavigateToNote: (date: Date, noteId: string) => void;
    handleMonthSelect: (monthIndex: number) => void;
    handleAddNote: (note: Note, date: Date) => void;
    handleUpdateNote: (note: Note, date: Date) => void;
    setIsSetupDemoMode: (value: boolean) => void;
    setShowSetup: (value: boolean) => void;
    companionMode: boolean;
}

function AppContent(props: AppContentProps) {
    const { effectiveSidebarIconOnly } = useDashboardLayout();
    const {
        currentPage, setCurrentPage, activeNotes, activeUserName, 
        isSidebarCollapsed, setIsSidebarCollapsed, showDev, isEditMode, 
        setIsEditMode, isLoading, currentMonth, setCurrentMonth, 
        selectedDate, setNotes, isMockMode, setIsMockMode,
        isAiModalOpen, setIsAiModalOpen, isQuickTimerOpen, setIsQuickTimerOpen,
        handleNavigateToNote, handleMonthSelect, handleAddNote, handleUpdateNote,
        setIsSetupDemoMode, setShowSetup, companionMode
    } = props;

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden selection:bg-blue-500/30 font-sans transition-colors">
            {/* Custom Title Bar Drag Region */}
            <div className="absolute top-0 left-0 w-full h-8 z-50 app-drag-region" style={{ WebkitAppRegion: 'drag' } as any} />

            <div className="relative z-20 flex w-full h-full pt-8">
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

                <main className="flex-1 h-full relative overflow-hidden">
                    <div className="h-full py-4 pr-4 pl-2">
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
                                    />
                                )}
                                {currentPage === 'stats' && <StatsPage isSidebarCollapsed={isSidebarCollapsed} />}
                                {currentPage === 'drawing' && <BoardPage />}
                                {currentPage === 'github' && <GithubPage isMockMode={isMockMode} isSidebarCollapsed={isSidebarCollapsed} />}
                                {currentPage === 'timer' && <TimerPage isSidebarCollapsed={isSidebarCollapsed} />}
                                {currentPage === 'progress' && <ProgressPage notes={activeNotes} isSidebarCollapsed={isSidebarCollapsed} onUpdateNote={handleUpdateNote} />}
                                {currentPage === 'settings' && <SettingsPage />}
                                {currentPage === 'dev' && (
                                    <DevPage
                                        isMockMode={isMockMode}
                                        toggleMockMode={() => setIsMockMode(!isMockMode)}
                                        onForceSetup={() => {
                                            setIsSetupDemoMode(true);
                                            setShowSetup(true);
                                        }}
                                    />
                                )}
                            </Suspense>
                        </div>
                    </div>
                </main>
            </div>

            <AiQuickAddModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                onSave={handleAddNote}
            />

            <ShortcutsOverlay currentPage={currentPage} />

            {/* Timer overlays - visible on all pages */}
            <TimerAlertOverlay isSidebarCollapsed={isSidebarCollapsed} />

            {/* Quick Timer Modal */}
            <QuickTimerModal
                isOpen={isQuickTimerOpen}
                onClose={() => setIsQuickTimerOpen(false)}
            />
            <TimerMiniIndicator isSidebarCollapsed={isSidebarCollapsed} />

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
        </div>
    );
}

export default App;