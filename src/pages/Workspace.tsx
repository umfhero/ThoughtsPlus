import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTree, ContentArea, NerdbookEditor, BoardEditor } from '../components/workspace';
import {
    WorkspaceFile,
    WorkspaceFolder,
    WorkspaceData,
    FileType,
    RecentFile,
    FILE_EXTENSIONS,
} from '../types/workspace';
import {
    validateFileName,
    validateFolderName,
    getDescendants,
} from '../utils/workspace';
import {
    loadWorkspace,
    saveWorkspace,
    addToRecentFiles,
    createDebouncedSave,
} from '../utils/workspaceStorage';
import {
    runMigrationWithResult,
    ExistingData,
    BoardForMigration,
} from '../utils/workspaceMigration';
import { Page, NerdNotebook, QuickNote } from '../types';

/**
 * Loads existing data (nerdbooks, boards, quick notes) for migration
 * This function fetches data from the existing storage mechanisms
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
async function loadExistingDataForMigration(): Promise<ExistingData> {
    const existingData: ExistingData = {
        nerdbooks: [],
        boards: [],
        quickNotes: [],
    };

    try {
        // Load nerdbooks and quick notes from main data store
        // @ts-ignore - ipcRenderer is exposed via preload
        const mainData = await window.ipcRenderer.invoke('get-data');

        if (mainData) {
            // Extract nerdbooks
            if (mainData.nerdbooks?.notebooks && Array.isArray(mainData.nerdbooks.notebooks)) {
                existingData.nerdbooks = mainData.nerdbooks.notebooks as NerdNotebook[];
                console.log('[Migration] Found', existingData.nerdbooks.length, 'nerdbooks');
            }

            // Extract quick notes (notebookNotes)
            if (mainData.notebookNotes && Array.isArray(mainData.notebookNotes)) {
                existingData.quickNotes = mainData.notebookNotes as QuickNote[];
                console.log('[Migration] Found', existingData.quickNotes.length, 'quick notes');
            }
        }

        // Load boards from separate storage
        // @ts-ignore - ipcRenderer is exposed via preload
        const boardsResponse = await window.ipcRenderer.invoke('get-boards');

        if (boardsResponse) {
            // Handle both array and object response structures
            let boards: BoardForMigration[] = [];
            if (Array.isArray(boardsResponse)) {
                boards = boardsResponse;
            } else if (boardsResponse.boards && Array.isArray(boardsResponse.boards)) {
                boards = boardsResponse.boards;
            }
            existingData.boards = boards;
            console.log('[Migration] Found', existingData.boards.length, 'boards');
        }
    } catch (error) {
        console.error('[Migration] Error loading existing data:', error);
    }

    return existingData;
}

interface WorkspacePageProps {
    setPage: (page: Page) => void;
    onSidebarTransition?: (visible: boolean) => void;
}

/**
 * WorkspacePage component - Main IDE-style workspace interface
 * Integrates FileTree sidebar and ContentArea with workspace state management.
 * 
 * Requirements: 2.1, 4.3, 6.1, 6.3, 6.4
 */
export function WorkspacePage({
    setPage,
    onSidebarTransition,
}: WorkspacePageProps) {
    // Workspace data state
    const [workspaceData, setWorkspaceData] = useState<WorkspaceData>({
        files: [],
        folders: [],
        recentFiles: [],
        expandedFolders: [],
        migrationComplete: false,
    });

    // UI state
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [noteContents, setNoteContents] = useState<Record<string, string>>({});

    // Rename/Delete modal state
    const [renameModal, setRenameModal] = useState<{
        isOpen: boolean;
        id: string;
        isFolder: boolean;
        currentName: string;
    } | null>(null);
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        id: string;
        isFolder: boolean;
        name: string;
    } | null>(null);
    const [newItemModal, setNewItemModal] = useState<{
        isOpen: boolean;
        parentId: string | null;
        type: 'file' | 'folder';
        fileType?: FileType;
    } | null>(null);

    // Debounced save function
    const debouncedSave = useMemo(() => createDebouncedSave('workspace'), []);

    // Load workspace data on mount and run migration if needed
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await loadWorkspace();

                // Check if migration is needed
                if (!data.migrationComplete) {
                    console.log('[Workspace] Migration not complete, running migration...');

                    // Load existing data for migration
                    const existingData = await loadExistingDataForMigration();

                    // Run migration
                    const migrationResult = runMigrationWithResult(existingData, data);

                    if (migrationResult.success) {
                        console.log('[Workspace] Migration completed:', {
                            nerdbooks: migrationResult.migratedCounts.nerdbooks,
                            boards: migrationResult.migratedCounts.boards,
                            quickNotes: migrationResult.migratedCounts.quickNotes,
                        });

                        // Save migrated workspace data
                        await saveWorkspace(migrationResult.workspaceData);
                        setWorkspaceData(migrationResult.workspaceData);
                        setExpandedFolders(new Set(migrationResult.workspaceData.expandedFolders));
                    } else {
                        console.error('[Workspace] Migration failed:', migrationResult.error);
                        // Still set the data even if migration failed
                        setWorkspaceData(data);
                        setExpandedFolders(new Set(data.expandedFolders));
                    }
                } else {
                    setWorkspaceData(data);
                    setExpandedFolders(new Set(data.expandedFolders));
                }
            } catch (error) {
                console.error('Failed to load workspace:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Notify parent about sidebar transition on mount/unmount
    useEffect(() => {
        onSidebarTransition?.(true);
        return () => {
            onSidebarTransition?.(false);
        };
    }, [onSidebarTransition]);


    // Get selected file object
    const selectedFile = useMemo(() => {
        if (!selectedFileId) return null;
        return workspaceData.files.find(f => f.id === selectedFileId) || null;
    }, [selectedFileId, workspaceData.files]);

    // Build recent files list for WelcomeView
    const recentFiles: RecentFile[] = useMemo(() => {
        return workspaceData.recentFiles
            .map(fileId => {
                const file = workspaceData.files.find(f => f.id === fileId);
                if (!file) return null;

                // Build path
                let path = file.name + FILE_EXTENSIONS[file.type];
                let currentParentId = file.parentId;
                while (currentParentId) {
                    const parent = workspaceData.folders.find(f => f.id === currentParentId);
                    if (parent) {
                        path = parent.name + '/' + path;
                        currentParentId = parent.parentId;
                    } else {
                        break;
                    }
                }

                return {
                    id: file.id,
                    name: file.name,
                    type: file.type,
                    lastOpened: file.updatedAt,
                    path,
                };
            })
            .filter((f): f is RecentFile => f !== null)
            .slice(0, 10);
    }, [workspaceData.recentFiles, workspaceData.files, workspaceData.folders]);

    // Save workspace data with debounce
    const saveWorkspaceData = useCallback(async (data: WorkspaceData) => {
        setWorkspaceData(data);
        await debouncedSave(data);
    }, [debouncedSave]);

    // Handle file selection
    const handleFileSelect = useCallback((fileId: string) => {
        setSelectedFileId(fileId);

        // Update recent files
        const updatedRecentFiles = addToRecentFiles(fileId, workspaceData.recentFiles);
        const updatedData = {
            ...workspaceData,
            recentFiles: updatedRecentFiles,
        };
        saveWorkspaceData(updatedData);
    }, [workspaceData, saveWorkspaceData]);

    // Handle folder toggle
    const handleFolderToggle = useCallback((folderId: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }

            // Persist expanded folders
            const updatedData = {
                ...workspaceData,
                expandedFolders: Array.from(newSet),
            };
            saveWorkspaceData(updatedData);

            return newSet;
        });
    }, [workspaceData, saveWorkspaceData]);

    // Handle file creation
    const handleFileCreate = useCallback((parentId: string | null, type: FileType) => {
        setNewItemModal({
            isOpen: true,
            parentId,
            type: 'file',
            fileType: type,
        });
    }, []);

    // Handle folder creation
    const handleFolderCreate = useCallback((parentId: string | null) => {
        setNewItemModal({
            isOpen: true,
            parentId,
            type: 'folder',
        });
    }, []);

    // Create new file
    const createFile = useCallback((name: string, parentId: string | null, type: FileType) => {
        const validation = validateFileName(name, type, parentId, workspaceData.files);
        if (!validation.isValid) {
            alert(validation.error);
            return false;
        }

        const now = new Date().toISOString();
        const newFile: WorkspaceFile = {
            id: crypto.randomUUID(),
            name: name.trim(),
            type,
            parentId,
            createdAt: now,
            updatedAt: now,
            contentId: crypto.randomUUID(), // Generate content ID for storage
        };

        const updatedData = {
            ...workspaceData,
            files: [...workspaceData.files, newFile],
            recentFiles: addToRecentFiles(newFile.id, workspaceData.recentFiles),
        };

        saveWorkspaceData(updatedData);
        setSelectedFileId(newFile.id);

        // Expand parent folder if exists
        if (parentId && !expandedFolders.has(parentId)) {
            setExpandedFolders(prev => new Set([...prev, parentId]));
        }

        return true;
    }, [workspaceData, saveWorkspaceData, expandedFolders]);

    // Create new folder
    const createFolder = useCallback((name: string, parentId: string | null) => {
        const validation = validateFolderName(name, parentId, workspaceData.folders);
        if (!validation.isValid) {
            alert(validation.error);
            return false;
        }

        const now = new Date().toISOString();
        const newFolder: WorkspaceFolder = {
            id: crypto.randomUUID(),
            name: name.trim(),
            parentId,
            createdAt: now,
            updatedAt: now,
        };

        const updatedData = {
            ...workspaceData,
            folders: [...workspaceData.folders, newFolder],
        };

        saveWorkspaceData(updatedData);

        // Expand parent folder if exists
        if (parentId && !expandedFolders.has(parentId)) {
            setExpandedFolders(prev => new Set([...prev, parentId]));
        }

        return true;
    }, [workspaceData, saveWorkspaceData, expandedFolders]);


    // Handle rename
    const handleRename = useCallback((id: string, isFolder: boolean) => {
        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (folder) {
                setRenameModal({
                    isOpen: true,
                    id,
                    isFolder: true,
                    currentName: folder.name,
                });
            }
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (file) {
                setRenameModal({
                    isOpen: true,
                    id,
                    isFolder: false,
                    currentName: file.name,
                });
            }
        }
    }, [workspaceData]);

    // Execute rename
    const executeRename = useCallback((newName: string) => {
        if (!renameModal) return;

        const { id, isFolder } = renameModal;

        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (!folder) return;

            const validation = validateFolderName(newName, folder.parentId, workspaceData.folders, id);
            if (!validation.isValid) {
                alert(validation.error);
                return;
            }

            const updatedFolders = workspaceData.folders.map(f =>
                f.id === id ? { ...f, name: newName.trim(), updatedAt: new Date().toISOString() } : f
            );

            saveWorkspaceData({
                ...workspaceData,
                folders: updatedFolders,
            });
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (!file) return;

            const validation = validateFileName(newName, file.type, file.parentId, workspaceData.files, id);
            if (!validation.isValid) {
                alert(validation.error);
                return;
            }

            const updatedFiles = workspaceData.files.map(f =>
                f.id === id ? { ...f, name: newName.trim(), updatedAt: new Date().toISOString() } : f
            );

            saveWorkspaceData({
                ...workspaceData,
                files: updatedFiles,
            });
        }

        setRenameModal(null);
    }, [renameModal, workspaceData, saveWorkspaceData]);

    // Handle delete
    const handleDelete = useCallback((id: string, isFolder: boolean) => {
        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (folder) {
                setDeleteModal({
                    isOpen: true,
                    id,
                    isFolder: true,
                    name: folder.name,
                });
            }
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (file) {
                setDeleteModal({
                    isOpen: true,
                    id,
                    isFolder: false,
                    name: file.name + FILE_EXTENSIONS[file.type],
                });
            }
        }
    }, [workspaceData]);

    // Execute delete
    const executeDelete = useCallback(() => {
        if (!deleteModal) return;

        const { id, isFolder } = deleteModal;

        if (isFolder) {
            // Get all descendants
            const { fileIds, folderIds } = getDescendants(id, workspaceData.files, workspaceData.folders);

            // Remove folder and all descendants
            const updatedFiles = workspaceData.files.filter(f => !fileIds.includes(f.id));
            const updatedFolders = workspaceData.folders.filter(f => f.id !== id && !folderIds.includes(f.id));
            const updatedRecentFiles = workspaceData.recentFiles.filter(fId => !fileIds.includes(fId));

            // Clear selection if deleted file was selected
            if (selectedFileId && fileIds.includes(selectedFileId)) {
                setSelectedFileId(null);
            }

            // Remove from expanded folders
            setExpandedFolders(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                folderIds.forEach(fId => newSet.delete(fId));
                return newSet;
            });

            saveWorkspaceData({
                ...workspaceData,
                files: updatedFiles,
                folders: updatedFolders,
                recentFiles: updatedRecentFiles,
                expandedFolders: Array.from(expandedFolders).filter(fId => fId !== id && !folderIds.includes(fId)),
            });
        } else {
            // Remove single file
            const updatedFiles = workspaceData.files.filter(f => f.id !== id);
            const updatedRecentFiles = workspaceData.recentFiles.filter(fId => fId !== id);

            // Clear selection if deleted file was selected
            if (selectedFileId === id) {
                setSelectedFileId(null);
            }

            saveWorkspaceData({
                ...workspaceData,
                files: updatedFiles,
                recentFiles: updatedRecentFiles,
            });
        }

        setDeleteModal(null);
    }, [deleteModal, workspaceData, selectedFileId, expandedFolders, saveWorkspaceData]);


    // Handle move (drag and drop)
    const handleMove = useCallback((id: string, newParentId: string | null, isFolder: boolean) => {
        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (!folder) return;

            // Prevent moving folder into itself or its descendants
            if (newParentId) {
                const { folderIds } = getDescendants(id, workspaceData.files, workspaceData.folders);
                if (newParentId === id || folderIds.includes(newParentId)) {
                    alert('Cannot move a folder into itself or its descendants');
                    return;
                }
            }

            // Check for name conflict in new location
            const validation = validateFolderName(folder.name, newParentId, workspaceData.folders, id);
            if (!validation.isValid) {
                alert(validation.error);
                return;
            }

            const updatedFolders = workspaceData.folders.map(f =>
                f.id === id ? { ...f, parentId: newParentId, updatedAt: new Date().toISOString() } : f
            );

            saveWorkspaceData({
                ...workspaceData,
                folders: updatedFolders,
            });
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (!file) return;

            // Check for name conflict in new location
            const validation = validateFileName(file.name, file.type, newParentId, workspaceData.files, id);
            if (!validation.isValid) {
                alert(validation.error);
                return;
            }

            const updatedFiles = workspaceData.files.map(f =>
                f.id === id ? { ...f, parentId: newParentId, updatedAt: new Date().toISOString() } : f
            );

            saveWorkspaceData({
                ...workspaceData,
                files: updatedFiles,
            });
        }

        // Expand target folder
        if (newParentId && !expandedFolders.has(newParentId)) {
            setExpandedFolders(prev => new Set([...prev, newParentId]));
        }
    }, [workspaceData, expandedFolders, saveWorkspaceData]);

    // Handle back navigation
    const handleBack = useCallback(() => {
        // Save workspace state before leaving
        saveWorkspace({
            ...workspaceData,
            expandedFolders: Array.from(expandedFolders),
        });
        setPage('dashboard');
    }, [workspaceData, expandedFolders, setPage]);

    // Handle content change for .note files
    const handleContentChange = useCallback((fileId: string, content: string) => {
        setNoteContents(prev => ({
            ...prev,
            [fileId]: content,
        }));

        // Update file's updatedAt timestamp
        const updatedFiles = workspaceData.files.map(f =>
            f.id === fileId ? { ...f, updatedAt: new Date().toISOString() } : f
        );

        saveWorkspaceData({
            ...workspaceData,
            files: updatedFiles,
        });

        // TODO: Save note content to storage via IPC
    }, [workspaceData, saveWorkspaceData]);

    // Handle file creation from WelcomeView
    const handleFileCreateFromWelcome = useCallback((type: FileType) => {
        handleFileCreate(null, type);
    }, [handleFileCreate]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    <div className="text-xs text-gray-400">Loading workspace...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex bg-gray-50 dark:bg-gray-900 rounded-3xl overflow-hidden">
            {/* File Tree Sidebar */}
            <motion.div
                initial={{ x: -280, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -280, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-64 flex-shrink-0"
            >
                <FileTree
                    files={workspaceData.files}
                    folders={workspaceData.folders}
                    selectedFileId={selectedFileId}
                    expandedFolders={expandedFolders}
                    onFileSelect={handleFileSelect}
                    onFolderToggle={handleFolderToggle}
                    onFileCreate={handleFileCreate}
                    onFolderCreate={handleFolderCreate}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMove={handleMove}
                    onBack={handleBack}
                />
            </motion.div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                <ContentArea
                    selectedFile={selectedFile}
                    recentFiles={recentFiles}
                    onFileSelect={handleFileSelect}
                    onFileCreate={handleFileCreateFromWelcome}
                    onContentChange={handleContentChange}
                    fileContent={selectedFile ? noteContents[selectedFile.id] || '' : ''}
                    renderNerdbookEditor={(contentId) => (
                        <NerdbookEditor contentId={contentId} />
                    )}
                    renderBoardEditor={(contentId) => (
                        <BoardEditor contentId={contentId} />
                    )}
                />
            </div>


            {/* Rename Modal */}
            <AnimatePresence>
                {renameModal?.isOpen && (
                    <RenameModal
                        currentName={renameModal.currentName}
                        isFolder={renameModal.isFolder}
                        onConfirm={executeRename}
                        onCancel={() => setRenameModal(null)}
                    />
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModal?.isOpen && (
                    <DeleteModal
                        name={deleteModal.name}
                        isFolder={deleteModal.isFolder}
                        onConfirm={executeDelete}
                        onCancel={() => setDeleteModal(null)}
                    />
                )}
            </AnimatePresence>

            {/* New Item Modal */}
            <AnimatePresence>
                {newItemModal?.isOpen && (
                    <NewItemModal
                        type={newItemModal.type}
                        fileType={newItemModal.fileType}
                        onConfirm={(name) => {
                            if (newItemModal.type === 'folder') {
                                createFolder(name, newItemModal.parentId);
                            } else if (newItemModal.fileType) {
                                createFile(name, newItemModal.parentId, newItemModal.fileType);
                            }
                            setNewItemModal(null);
                        }}
                        onCancel={() => setNewItemModal(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Modal Components

interface RenameModalProps {
    currentName: string;
    isFolder: boolean;
    onConfirm: (newName: string) => void;
    onCancel: () => void;
}

function RenameModal({ currentName, isFolder, onConfirm, onCancel }: RenameModalProps) {
    const [name, setName] = useState(currentName);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onConfirm(name.trim());
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 max-w-[90vw]"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Rename {isFolder ? 'Folder' : 'File'}
                </h3>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        placeholder={isFolder ? 'Folder name' : 'File name'}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || name.trim() === currentName}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            Rename
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

interface DeleteModalProps {
    name: string;
    isFolder: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

function DeleteModal({ name, isFolder, onConfirm, onCancel }: DeleteModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 max-w-[90vw]"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Delete {isFolder ? 'Folder' : 'File'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Are you sure you want to delete "{name}"?
                    {isFolder && ' This will also delete all files and folders inside it.'}
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

interface NewItemModalProps {
    type: 'file' | 'folder';
    fileType?: FileType;
    onConfirm: (name: string) => void;
    onCancel: () => void;
}

function NewItemModal({ type, fileType, onConfirm, onCancel }: NewItemModalProps) {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onConfirm(name.trim());
        }
    };

    const getTitle = () => {
        if (type === 'folder') return 'New Folder';
        switch (fileType) {
            case 'exec': return 'New Notebook (.exec)';
            case 'board': return 'New Board (.board)';
            case 'note': return 'New Note (.note)';
            default: return 'New File';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 max-w-[90vw]"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    {getTitle()}
                </h3>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        placeholder={type === 'folder' ? 'Folder name' : 'File name (without extension)'}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

export default WorkspacePage;
