import { motion } from 'framer-motion';
import { Clock, FilePlus, FileCode, PenTool, FileText } from 'lucide-react';
import clsx from 'clsx';
import { RecentFile, FileType, FILE_ICONS } from '../../types/workspace';

interface WelcomeViewProps {
    recentFiles: RecentFile[];
    onFileSelect: (fileId: string) => void;
    onFileCreate: (type: FileType) => void;
}

/**
 * WelcomeView component displays when no file is selected.
 * Shows recent files list and quick action buttons for creating new files.
 * Styled to match VS Code welcome screen aesthetic.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export function WelcomeView({
    recentFiles,
    onFileSelect,
    onFileCreate,
}: WelcomeViewProps) {
    // Format relative time for display
    const formatRelativeTime = (isoDate: string): string => {
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const quickActions: { type: FileType; label: string; description: string; icon: typeof FileCode }[] = [
        { type: 'exec', label: 'New Notebook', description: 'Create an executable notebook', icon: FileCode },
        { type: 'board', label: 'New Board', description: 'Create a whiteboard canvas', icon: PenTool },
        { type: 'note', label: 'New Note', description: 'Create a quick text note', icon: FileText },
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center p-8 overflow-y-auto"
        >
            <div className="max-w-2xl w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        Welcome to Workspace
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select a file from the sidebar or create a new one to get started
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                    <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Start
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {quickActions.map(({ type, label, description, icon: Icon }) => (
                            <motion.button
                                key={type}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onFileCreate(type)}
                                className={clsx(
                                    'flex flex-col items-start p-4 rounded-xl',
                                    'bg-white dark:bg-gray-800/50',
                                    'border border-gray-200 dark:border-gray-700',
                                    'hover:border-blue-300 dark:hover:border-blue-600',
                                    'hover:shadow-md transition-all duration-200',
                                    'text-left'
                                )}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className="w-5 h-5 text-blue-500" />
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                        {label}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {description}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Recent Files */}
                {recentFiles.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            Recent
                        </h2>
                        <div className="space-y-1">
                            {recentFiles.map((file) => {
                                const FileIcon = FILE_ICONS[file.type];
                                return (
                                    <motion.button
                                        key={file.id}
                                        whileHover={{ x: 4 }}
                                        onClick={() => onFileSelect(file.id)}
                                        className={clsx(
                                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                                            'hover:bg-gray-100 dark:hover:bg-gray-800',
                                            'transition-colors duration-150',
                                            'text-left group'
                                        )}
                                    >
                                        <FileIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                                    {file.name}
                                                </span>
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    .{file.type}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                                {file.path}
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                            {formatRelativeTime(file.lastOpened)}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty state for no recent files */}
                {recentFiles.length === 0 && (
                    <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                            <FilePlus className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No recent files yet
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Create a new file to get started
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default WelcomeView;
