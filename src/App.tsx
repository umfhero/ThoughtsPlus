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

export type Page = 'dashboard' | 'calendar' | 'stats' | 'settings' | 'drawing' | 'github';

export interface Note {
    id: string;
    title: string;
    description: string;
    summary?: string;
    time: string;
    importance: 'low' | 'medium' | 'high' | 'misc';
}

export interface NotesData {
    [date: string]: Note[];
}

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [notes, setNotes] = useState<NotesData>({});
    const [isLoading, setIsLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [userName] = useState("Majid");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [drawingRefreshTrigger, setDrawingRefreshTrigger] = useState(0);

    useEffect(() => {
        loadNotes();
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

    const saveNotesToBackend = async (newNotes: NotesData) => {
        // @ts-ignore
        const currentData = await window.ipcRenderer.invoke('get-data');
        // @ts-ignore
        await window.ipcRenderer.invoke('save-data', { ...currentData, notes: newNotes });
    };

    const handleSaveDrawing = async (dataUrl: string) => {
        try {
            // @ts-ignore
            const currentData = await window.ipcRenderer.invoke('get-drawing');
            let tabs = [];
            if (currentData) {
                if (Array.isArray(currentData.tabs)) {
                    tabs = currentData.tabs;
                } else if (typeof currentData === 'string') {
                    tabs = [{
                        id: Math.random().toString(36).substring(2, 9),
                        name: 'My Drawing',
                        emoji: '🎨',
                        color: '#3B82F6',
                        canvasData: currentData,
                        objects: []
                    }];
                }
            }

            const newTab = {
                id: Math.random().toString(36).substring(2, 9),
                name: 'Quick Drawing',
                emoji: '⚡',
                color: '#F59E0B',
                canvasData: dataUrl,
                objects: []
            };

            const updatedTabs = [...tabs, newTab];

            // @ts-ignore
            await window.ipcRenderer.invoke('save-drawing', { tabs: updatedTabs, activeTabId: newTab.id });
            setDrawingRefreshTrigger(prev => prev + 1);
        } catch (e) {
            console.error("Failed to save drawing", e);
        }
    };



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
                            {currentPage === 'drawing' && <DrawingPage refreshTrigger={drawingRefreshTrigger} />}
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
                onSaveDrawing={handleSaveDrawing}
            />

            <ShortcutsOverlay currentPage={currentPage} />
        </div>
    );
}

export default App;