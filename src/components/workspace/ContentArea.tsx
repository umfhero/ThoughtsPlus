import { motion } from 'framer-motion';
import clsx from 'clsx';
import { WelcomeView } from './WelcomeView';
import { TextNoteEditor } from './TextNoteEditor';
import {
    WorkspaceFile,
    RecentFile,
    FileType,
    FILE_ICONS,
    FILE_EXTENSIONS,
} from '../../types/workspace';

interface ContentAreaProps {
    selectedFile: WorkspaceFile | null;
    recentFiles: RecentFile[];
    onFileSelect: (fileId: string) => void;
    onFileCreate: (type: FileType) => void;
    onContentChange: (fileId: string, content: string) => void;
    // Content for the currently selected file
    fileContent?: string;
    // Render props for external editors (Nerdbook, Board)
    renderNerdbookEditor?: (contentId: string) => React.ReactNode;
    renderBoardEditor?: (contentId: string) => React.ReactNode;
}

/**
 * ContentArea component displays the appropriate editor based on the selected file type,
 * or the welcome view when no file is selected.
 * 
 * Requirements: 5.1, 8.1, 8.2, 8.3, 8.4
 */
export function ContentArea({
    selectedFile,
    recentFiles,
    onFileSelect,
    onFileCreate,
    onContentChange,
    fileContent = '',
    renderNerdbookEditor,
    renderBoardEditor,
}: ContentAreaProps) {
    // Show welcome view when no file is selected
    if (!selectedFile) {
        return (
            <div className="h-full bg-gray-50 dark:bg-gray-900">
                <WelcomeView
                    recentFiles={recentFiles}
                    onFileSelect={onFileSelect}
                    onFileCreate={onFileCreate}
                />
            </div>
        );
    }

    const FileIcon = FILE_ICONS[selectedFile.type];
    const extension = FILE_EXTENSIONS[selectedFile.type];

    // Render the appropriate editor based on file type
    const renderEditor = () => {
        switch (selectedFile.type) {
            case 'exec':
                // Render Nerdbook editor for .exec files
                if (renderNerdbookEditor) {
                    return renderNerdbookEditor(selectedFile.contentId);
                }
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p>Nerdbook editor not available</p>
                    </div>
                );

            case 'board':
                // Render Board editor for .board files
                if (renderBoardEditor) {
                    return renderBoardEditor(selectedFile.contentId);
                }
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p>Board editor not available</p>
                    </div>
                );

            case 'note':
                // Render TextNoteEditor for .note files
                return (
                    <TextNoteEditor
                        content={fileContent}
                        onChange={(content) => onContentChange(selectedFile.id, content)}
                    />
                );

            default:
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p>Unknown file type</p>
                    </div>
                );
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col bg-white dark:bg-gray-900"
        >
            {/* File Header */}
            <div
                className={clsx(
                    'flex items-center gap-2 px-4 py-2.5',
                    'border-b border-gray-200 dark:border-gray-700',
                    'bg-gray-50 dark:bg-gray-800/50'
                )}
            >
                <FileIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedFile.name}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    {extension}
                </span>
            </div>

            {/* Editor Container */}
            <div className="flex-1 overflow-hidden">
                {renderEditor()}
            </div>
        </motion.div>
    );
}

export default ContentArea;
