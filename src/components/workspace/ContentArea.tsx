import { motion } from 'framer-motion';
import { WelcomeView } from './WelcomeView';
import { TextNoteEditor } from './TextNoteEditor';
import {
    WorkspaceFile,
    RecentFile,
    FileType,
} from '../../types/workspace';

interface ContentAreaProps {
    selectedFile: WorkspaceFile | null;
    recentFiles: RecentFile[];
    files: WorkspaceFile[];
    onFileSelect: (fileId: string) => void;
    onFileCreate: (type: FileType) => void;
    onContentChange: (fileId: string, content: string) => void;
    onOpenExternalFile?: () => void;
    // Content for the currently selected file
    fileContent?: string;
    // Render props for external editors (Nerdbook, Board, etc.)
    renderNerdbookEditor?: (contentId: string, filePath?: string) => React.ReactNode;
    renderBoardEditor?: (contentId: string, filePath?: string) => React.ReactNode;
    renderNodeMapEditor?: (contentId: string, filePath?: string) => React.ReactNode;
    renderFlashcardsEditor?: (contentId: string, filePath?: string) => React.ReactNode;
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
    files,
    onFileSelect,
    onFileCreate,
    onContentChange,
    onOpenExternalFile,
    fileContent = '',
    renderNerdbookEditor,
    renderBoardEditor,
    renderNodeMapEditor,
    renderFlashcardsEditor,
}: ContentAreaProps) {

    // Show welcome view when no file is selected
    if (!selectedFile) {
        return (
            <div className="h-full bg-gray-50 dark:bg-gray-900">
                <WelcomeView
                    recentFiles={recentFiles}
                    files={files}
                    onFileSelect={onFileSelect}
                    onFileCreate={onFileCreate}
                    onOpenExternalFile={onOpenExternalFile}
                />
            </div>
        );
    }

    // Render the appropriate editor based on file type
    const renderEditor = () => {
        switch (selectedFile.type) {
            case 'exec':
                // Render Nerdbook editor for .exec files
                if (renderNerdbookEditor) {
                    return renderNerdbookEditor(selectedFile.contentId, selectedFile.filePath);
                }
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p>Nerdbook editor not available</p>
                    </div>
                );

            case 'board':
                // Render Board editor for .board files
                if (renderBoardEditor) {
                    return renderBoardEditor(selectedFile.contentId, selectedFile.filePath);
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

            case 'nbm':
                // Render NodeMapEditor for .nbm files
                if (renderNodeMapEditor) {
                    return renderNodeMapEditor(selectedFile.contentId, selectedFile.filePath);
                }
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p>Node Map editor not available</p>
                    </div>
                );

            case 'flashcards':
                // Render FlashcardsEditor for .deck files
                if (renderFlashcardsEditor) {
                    return renderFlashcardsEditor(selectedFile.contentId, selectedFile.filePath);
                }
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p>Flashcards editor not available</p>
                    </div>
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
            {/* Editor Container - no header, tabs are in TabBar now */}
            <div className="flex-1 overflow-hidden">
                {renderEditor()}
            </div>
        </motion.div>
    );
}

export default ContentArea;
