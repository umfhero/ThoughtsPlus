import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode, PenTool, Trash2, X, FolderOpen, FileUp } from 'lucide-react';
import clsx from 'clsx';
import { RecentFile, FileType, WorkspaceSession, WorkspaceFile } from '../../types/workspace';

interface WelcomeViewProps {
    recentFiles: RecentFile[];
    sessions: WorkspaceSession[];
    files: WorkspaceFile[];
    onFileSelect: (fileId: string) => void;
    onFileCreate: (type: FileType) => void;
    onSessionRestore: (session: WorkspaceSession) => void;
    onSessionDelete: (sessionId: string) => void;
    onOpenExternalFile?: () => void;
}

/**
 * WelcomeView component displays when no file is selected.
 * Shows recent files list, saved sessions, and quick action buttons for creating new files.
 * Styled to match VS Code welcome screen aesthetic.
 */
export function WelcomeView({
    recentFiles,
    sessions,
    files,
    onFileSelect,
    onFileCreate,
    onSessionRestore,
    onSessionDelete,
    onOpenExternalFile,
}: WelcomeViewProps) {
    const [activeTab, setActiveTab] = useState<'recent' | 'sessions'>('recent');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [dataFolderPath, setDataFolderPath] = useState<string>('');

    // Get data folder path on mount
    useEffect(() => {
        const getPath = async () => {
            try {
                // @ts-ignore
                const path = await window.ipcRenderer?.invoke('get-data-folder-path');
                if (path) setDataFolderPath(path);
            } catch (e) {
                console.error('Failed to get data folder path:', e);
            }
        };
        getPath();
    }, []);

    // Get file names for session preview
    const getSessionFileNames = (session: WorkspaceSession): string[] => {
        return session.openTabs
            .map(tabId => files.find(f => f.id === tabId)?.name)
            .filter((name): name is string => !!name)
            .slice(0, 3);
    };

    // Open data folder in file explorer
    const handleOpenDataFolder = async () => {
        try {
            // @ts-ignore
            await window.ipcRenderer?.invoke('open-data-folder');
        } catch (e) {
            console.error('Failed to open data folder:', e);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col p-10 overflow-y-auto"
        >
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-light text-gray-800 dark:text-gray-100 mb-1">
                    ThoughtsPlus Notes
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nerd Notes Evolved
                </p>
            </div>

            {/* Two column layout */}
            <div className="flex gap-16 flex-1">
                {/* Left column - Start */}
                <div className="min-w-[200px]">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                        Start
                    </h2>
                    <div className="space-y-1">
                        <button
                            onClick={() => onFileCreate('exec')}
                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm py-1"
                        >
                            <FileCode className="w-4 h-4" />
                            New Notebook...
                        </button>
                        <button
                            onClick={() => onFileCreate('board')}
                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm py-1"
                        >
                            <PenTool className="w-4 h-4" />
                            New Board...
                        </button>
                        <div className="h-3" />
                        <button
                            onClick={handleOpenDataFolder}
                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm py-1"
                        >
                            <FolderOpen className="w-4 h-4" />
                            Open Data Folder...
                        </button>
                        {onOpenExternalFile && (
                            <button
                                onClick={onOpenExternalFile}
                                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm py-1"
                            >
                                <FileUp className="w-4 h-4" />
                                Open File...
                            </button>
                        )}
                    </div>

                    {/* Data location info */}
                    {dataFolderPath && (
                        <div className="mt-8">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                                Data Location
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 break-all leading-relaxed">
                                {dataFolderPath}
                            </p>
                        </div>
                    )}
                </div>

                {/* Right column - Recent/Sessions */}
                <div className="flex-1 max-w-lg">
                    {/* Tabs */}
                    <div className="flex items-center gap-6 mb-4">
                        <button
                            onClick={() => setActiveTab('recent')}
                            className={clsx(
                                'text-sm font-medium transition-colors',
                                activeTab === 'recent'
                                    ? 'text-gray-700 dark:text-gray-300'
                                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                            )}
                        >
                            Recent
                        </button>
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={clsx(
                                'text-sm font-medium transition-colors flex items-center gap-1.5',
                                activeTab === 'sessions'
                                    ? 'text-gray-700 dark:text-gray-300'
                                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                            )}
                        >
                            Sessions
                            {sessions.length > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 dark:bg-gray-700">
                                    {sessions.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Content */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'recent' && (
                            <motion.div
                                key="recent"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                className="space-y-0.5"
                            >
                                {recentFiles.length > 0 ? (
                                    recentFiles.map((file) => {
                                        // Extract directory from filePath for display
                                        const displayPath = file.filePath
                                            ? file.filePath.replace(/\\/g, '/').split('/').slice(-2, -1)[0] || ''
                                            : file.path;

                                        return (
                                            <button
                                                key={file.id}
                                                onClick={() => onFileSelect(file.id)}
                                                className="w-full flex items-baseline gap-3 py-1 text-left group"
                                            >
                                                <span className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate shrink-0">
                                                    {file.name}
                                                </span>
                                                <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                                    {file.fileName}{displayPath ? ` — ${displayPath}` : ''}
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="py-4">
                                        <p className="text-sm text-gray-400 dark:text-gray-500">
                                            No recent files
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'sessions' && (
                            <motion.div
                                key="sessions"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                className="space-y-0.5"
                            >
                                {sessions.length > 0 ? (
                                    sessions.map((session) => {
                                        const fileNames = getSessionFileNames(session);
                                        const extraCount = session.openTabs.length - fileNames.length;

                                        return (
                                            <div key={session.id} className="group relative flex items-center">
                                                <button
                                                    onClick={() => onSessionRestore(session)}
                                                    className="flex-1 flex items-baseline gap-3 py-1 text-left"
                                                >
                                                    <span className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate shrink-0">
                                                        {session.name}
                                                    </span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                                        {fileNames.join(', ')}
                                                        {extraCount > 0 && ` +${extraCount}`}
                                                    </span>
                                                </button>

                                                {/* Delete button */}
                                                {deleteConfirm === session.id ? (
                                                    <div className="flex items-center gap-1 ml-2">
                                                        <button
                                                            onClick={() => {
                                                                onSessionDelete(session.id);
                                                                setDeleteConfirm(null);
                                                            }}
                                                            className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteConfirm(session.id);
                                                        }}
                                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all ml-2"
                                                        title="Delete session"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-4">
                                        <p className="text-sm text-gray-400 dark:text-gray-500">
                                            No saved sessions
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            Save tabs using the save icon in the tab bar
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

export default WelcomeView;
