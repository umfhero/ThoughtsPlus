import { motion } from 'framer-motion';
import { FileCode, PenTool, FolderOpen, FileUp, Brain } from 'lucide-react';
import { RecentFile, FileType, WorkspaceFile } from '../../types/workspace';

interface WelcomeViewProps {
    recentFiles: RecentFile[];
    files: WorkspaceFile[];
    onFileSelect: (fileId: string) => void;
    onFileCreate: (type: FileType) => void;
    onOpenExternalFile?: () => void;
}

/**
 * WelcomeView component displays when no file is selected.
 * Shows recent files list and quick action buttons for creating new files.
 * Styled to match VS Code welcome screen aesthetic.
 */
export function WelcomeView({
    recentFiles,
    onFileSelect,
    onFileCreate,
    onOpenExternalFile,
}: WelcomeViewProps) {
    // Open data folder in file explorer
    const handleOpenDataFolder = async () => {
        try {
            // @ts-ignore
            await window.ipcRenderer?.invoke('open-data-folder');
        } catch (e) {
            console.error('Failed to open data folder:', e);
        }
    };

    // Extract folder path from full file path (remove filename)
    const getFolderPath = (filePath: string): string => {
        if (!filePath) return '';
        // Replace backslashes with forward slashes for consistency, then get directory
        const normalized = filePath.replace(/\\/g, '/');
        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex items-center justify-center overflow-y-auto"
        >
            <div className="flex flex-col p-10 max-w-3xl w-full">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-light text-gray-800 dark:text-gray-100 mb-1">
                        ThoughtsPlus Notes
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Nerd Notes Evolved
                    </p>
                </div>

                {/* Two column layout - stacks on small screens */}
                <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
                    {/* Left column - Start */}
                    <div className="min-w-[180px]">
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
                            <button
                                onClick={() => onFileCreate('flashcards')}
                                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm py-1"
                            >
                                <Brain className="w-4 h-4" />
                                New Flashcard Deck...
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
                    </div>

                    {/* Right column - Recent */}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                            Recent
                        </h2>
                        <div className="space-y-0.5">
                            {recentFiles.length > 0 ? (
                                recentFiles.map((file) => {
                                    const folderPath = getFolderPath(file.filePath);

                                    return (
                                        <button
                                            key={file.id}
                                            onClick={() => onFileSelect(file.id)}
                                            className="w-full flex items-baseline gap-3 py-1 text-left group"
                                        >
                                            <span className="text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                                                {file.name}
                                            </span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate min-w-0">
                                                {folderPath || file.path}
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
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default WelcomeView;
