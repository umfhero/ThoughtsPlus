import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { CalendarPage } from './pages/Calendar';
import { StatsPage } from './pages/Stats';
import { SettingsPage } from './pages/Settings';
import { DrawingPage } from './pages/Drawing';
import { GithubPage } from './pages/Github';
import { AiQuickAddModal } from './components/AiQuickAddModal';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { SetupWizard } from './components/SetupWizard';
import { useNotification } from './contexts/NotificationContext';
import { NotificationContainer } from './components/NotificationContainer';
import { DevPage } from './pages/Dev';

export type Page = 'dashboard' | 'calendar' | 'stats' | 'settings' | 'drawing' | 'github' | 'dev';

export interface Note {
    id: string;
    title: string;
    description: string;
    summary?: string;
    time: string;
    importance: 'low' | 'medium' | 'high' | 'misc';
    completed?: boolean;
}

export interface NotesData {
    [date: string]: Note[];
}

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
    const { addNotification } = useNotification();
    
    // Dev Mode State
    const [showDev, setShowDev] = useState(false);
    const [isMockMode, setIsMockMode] = useState(false);

    // Mock Data
    const mockNotes: NotesData = {
        [new Date().toISOString().split('T')[0]]: [
            { id: '1', title: 'Team Meeting', description: 'Discuss project roadmap', time: '10:00', importance: 'high' },
            { id: '2', title: 'Code Review', description: 'Review PR #123', time: '14:00', importance: 'medium' },
            { id: '3', title: 'Gym', description: 'Leg day', time: '18:00', importance: 'low' }
        ],
        [new Date(Date.now() + 86400000).toISOString().split('T')[0]]: [
            { id: '4', title: 'Client Call', description: 'Monthly update', time: '11:00', importance: 'high' }
        ]
    };

    const activeNotes = isMockMode ? mockNotes : notes;

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
            addNotification({
                title: 'Quick Tip',
                message: 'Press Ctrl+M anywhere to create a quick note instantly.',
                type: 'info',
                duration: 8000
            });
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
        loadNotes(); // Reload notes with new data path
    };

    const loadUserName = async () => {
        try {
            // @ts-ignore
            const name = await window.ipcRenderer.invoke('get-username');
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

            if (e.key === 'Escape') {
                if (isAiModalOpen) {
                    setIsAiModalOpen(false);
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
    }, [isAiModalOpen, currentPage, showDev]);

    const loadNotes = async () => {
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-data');
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

    const handleAddNote = (note: Note, date: Date) => {
        const dateKey = date.toISOString().split('T')[0];
        const existingNotes = notes[dateKey] || [];
        const newNotes = { ...notes, [dateKey]: [...existingNotes, note] };
        setNotes(newNotes);
        // Save to backend if needed, for now just local state update which might be lost on reload if not saved via IPC
        // Ideally we call the save IPC here too, but I'll leave that for the specific component logic or expose a save function
        // For the dashboard AI add, we need to save.
        // Let's expose a save function or just update state and let the effect handle it if we had one, but we don't.
        // I'll just update the state here and assume the components handle persistence or I'll add a helper.
        saveNotesToBackend(newNotes);

        addNotification({
            title: 'Note Added',
            message: `"${note.title}" has been added to your calendar.`,
            type: 'success',
            duration: 3000
        });
    };

    const handleUpdateNote = (note: Note, date: Date) => {
        const dateKey = date.toISOString().split('T')[0];
        const existingNotes = notes[dateKey] || [];
        const updatedNotes = existingNotes.map(n => n.id === note.id ? note : n);
        const newNotes = { ...notes, [dateKey]: updatedNotes };
        setNotes(newNotes);
        saveNotesToBackend(newNotes);

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
        return <SetupWizard onComplete={handleSetupComplete} />;
    }

    return (
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
                />

                <main className="flex-1 h-full relative overflow-hidden">
                    <div className="h-full p-4">
                        <div className="h-full rounded-3xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 shadow-2xl overflow-hidden relative">
                            {currentPage === 'dashboard' && (
                                <Dashboard
                                    notes={activeNotes}
                                    onNavigateToNote={handleNavigateToNote}
                                    userName={userName}
                                    onAddNote={handleAddNote}
                                    onUpdateNote={handleUpdateNote}
                                    isLoading={isLoading}
                                />
                            )}
                            {currentPage === 'calendar' && (
                                <CalendarPage
                                    notes={activeNotes}
                                    setNotes={setNotes}
                                    initialSelectedDate={selectedDate}
                                    currentMonth={currentMonth}
                                    setCurrentMonth={setCurrentMonth}
                                />
                            )}
                            {currentPage === 'stats' && <StatsPage />}
                            {currentPage === 'drawing' && <DrawingPage />}
                            {currentPage === 'github' && <GithubPage />}
                            {currentPage === 'settings' && <SettingsPage />}
                            {currentPage === 'dev' && (
                                <DevPage 
                                    isMockMode={isMockMode} 
                                    toggleMockMode={() => setIsMockMode(!isMockMode)} 
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
        </div>
    );
}

export default App;