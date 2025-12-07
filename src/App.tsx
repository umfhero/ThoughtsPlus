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

export type Page = 'dashboard' | 'calendar' | 'stats' | 'settings' | 'drawing' | 'github';

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

    useEffect(() => {
        checkFirstRun();
        loadNotes();
        loadUserName();
    }, []);

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
                if (currentPage !== 'drawing' && currentPage !== 'settings') {
                    setIsSidebarCollapsed(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAiModalOpen, currentPage]);

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
    };

    const handleUpdateNote = (note: Note, date: Date) => {
        const dateKey = date.toISOString().split('T')[0];
        const existingNotes = notes[dateKey] || [];
        const updatedNotes = existingNotes.map(n => n.id === note.id ? note : n);
        const newNotes = { ...notes, [dateKey]: updatedNotes };
        setNotes(newNotes);
        saveNotesToBackend(newNotes);
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
                    notes={notes}
                    onMonthSelect={handleMonthSelect}
                    currentMonth={currentMonth}
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />

                <main className="flex-1 h-full relative overflow-hidden">
                    <div className="h-full p-4">
                        <div className="h-full rounded-3xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 shadow-2xl overflow-hidden relative">
                            {currentPage === 'dashboard' && (
                                <Dashboard
                                    notes={notes}
                                    onNavigateToNote={handleNavigateToNote}
                                    userName={userName}
                                    onAddNote={handleAddNote}
                                    onUpdateNote={handleUpdateNote}
                                    isLoading={isLoading}
                                />
                            )}
                            {currentPage === 'calendar' && (
                                <CalendarPage
                                    notes={notes}
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
        </div>
    );
}

export default App;