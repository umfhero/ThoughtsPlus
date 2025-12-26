import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { CalendarPage } from './pages/Calendar';
import { StatsPage } from './pages/Stats';
import { SettingsPage } from './pages/Settings';
import { BoardPage } from './pages/Board';
import { GithubPage } from './pages/Github';
import { TimerPage } from './pages/Timer';
import { AiQuickAddModal } from './components/AiQuickAddModal';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { SetupWizard } from './components/SetupWizard';
import { useNotification } from './contexts/NotificationContext';
import { NotificationContainer } from './components/NotificationContainer';
import { TimerProvider } from './contexts/TimerContext';
import { TimerAlertOverlay, TimerMiniIndicator } from './components/TimerAlertOverlay';
import { QuickTimerModal } from './components/QuickTimerModal';
import { DevPage } from './pages/Dev';
import { Page, Note, NotesData } from './types';

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
    const [isMockMode, setIsMockMode] = useState(false);
    const [isSetupDemoMode, setIsSetupDemoMode] = useState(false);

    // Mock Data
    const [mockNotesState, setMockNotesState] = useState<NotesData>({
        // T-3: Completed (Green segment start)
        [new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]]: [
            { id: '1', title: 'Project Kickoff', description: 'Initial planning phase.', time: '09:00', importance: 'high', completed: true }
        ],
        // T-2: Missed (Red segment)
        [new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]]: [
            { id: '2', title: 'Submit Report', description: 'Weekly progress report.', time: '17:00', importance: 'medium', completed: false }
        ],
        // T-1: Missed (Red segment)
        [new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0]]: [
            { id: '3', title: 'Client Call', description: 'Discuss requirements.', time: '14:00', importance: 'high', completed: false }
        ],
        // Upcoming (Predictive) - 5 tasks distributed
        [new Date().toISOString().split('T')[0]]: [ // Today
            { id: '4', title: 'Team Meeting', description: 'Sync up.', time: '10:00', importance: 'medium' },
            { id: '5', title: 'Code Review', description: 'Review PRs.', time: '14:00', importance: 'low' }
        ],
        [new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0]]: [ // Tomorrow
            { id: '6', title: 'Design Review', description: 'Check new mockups.', time: '11:00', importance: 'high' }
        ],
        [new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]]: [ // Day after tomorrow
            { id: '7', title: 'Update Documentation', description: 'API docs.', time: '15:00', importance: 'low' },
            { id: '8', title: 'Release Planning', description: 'Prepare for v2.0.', time: '16:00', importance: 'medium' }
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

    useEffect(() => {
        checkFirstRun();
        loadNotes();
        loadUserName();
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
        <TimerProvider>
            <div className="flex h-screen bg-[#F3F4F6] dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden selection:bg-blue-500/30 font-sans transition-colors">
                {/* Custom Title Bar Drag Region */}
                <div className="absolute top-0 left-0 w-full h-8 z-50 app-drag-region" style={{ WebkitAppRegion: 'drag' } as any} />

                {/* Premium Background Gradients */}
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-[120px] transition-colors" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-400/20 dark:bg-purple-600/10 blur-[120px] transition-colors" />
                </div>

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
                    />

                    <main className="flex-1 h-full relative overflow-hidden">
                        <div className="h-full py-4 pr-4 pl-2">
                            <div className="h-full rounded-3xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 shadow-2xl overflow-hidden relative">
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

                <NotificationContainer />

                {/* Timer overlays - visible on all pages */}
                <TimerAlertOverlay />

                {/* Quick Timer Modal */}
                <QuickTimerModal
                    isOpen={isQuickTimerOpen}
                    onClose={() => setIsQuickTimerOpen(false)}
                />
                <TimerMiniIndicator />
            </div>
        </TimerProvider>
    );
}

export default App;