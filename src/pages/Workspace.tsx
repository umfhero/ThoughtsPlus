import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTree, ContentArea, NerdbookEditor, BoardEditor, TabBar } from '../components/workspace';
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
    cancelDebouncedSave,
} from '../utils/workspaceStorage';
import {
    runMigrationWithResult,
    ExistingData,
    BoardForMigration,
} from '../utils/workspaceMigration';
import { Page, NerdNotebook, QuickNote } from '../types';

/**
 * Loads existing data (nerdbooks, boards, quick notes) for migration
 */
async function loadExistingDataForMigration(): Promise<ExistingData> {
    const existingData: ExistingData = {
        nerdbooks: [],
        boards: [],
        quickNotes: [],
    };

    try {
        // @ts-ignore - ipcRenderer is exposed via preload
        const mainData = await window.ipcRenderer.invoke('get-data');

        if (mainData) {
            if (mainData.nerdbooks?.notebooks && Array.isArray(mainData.nerdbooks.notebooks)) {
                existingData.nerdbooks = mainData.nerdbooks.notebooks as NerdNotebook[];
            }
            if (mainData.notebookNotes && Array.isArray(mainData.notebookNotes)) {
                existingData.quickNotes = mainData.notebookNotes as QuickNote[];
            }
        }

        // @ts-ignore - ipcRenderer is exposed via preload
        const boardsResponse = await window.ipcRenderer.invoke('get-boards');

        if (boardsResponse) {
            let boards: BoardForMigration[] = [];
            if (Array.isArray(boardsResponse)) {
                boards = boardsResponse;
            } else if (boardsResponse.boards && Array.isArray(boardsResponse.boards)) {
                boards = boardsResponse.boards;
            }
            existingData.boards = boards;
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
        openTabs: [],
        activeTabId: null,
        sidebarVisible: true,
        migrationComplete: false,
    });

    // UI state
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [noteContents, setNoteContents] = useState<Record<string, string>>({});
    const [sidebarVisible, setSidebarVisible] = useState(true);

    // Modal state
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

    const debouncedSave = useMemo(() => createDebouncedSave('workspace'), []);

    // Load workspace data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await loadWorkspace();

                if (!data.migrationComplete) {
                    const existingData = await loadExistingDataForMigration();
                    const migrationResult = runMigrationWithResult(existingData, data);

                    if (migrationResult.success) {
                        await saveWorkspace(migrationResult.workspaceData);
                        setWorkspaceData(migrationResult.workspaceData);
                        setExpandedFolders(new Set(migrationResult.workspaceData.expandedFolders));
                        setSidebarVisible(migrationResult.workspaceData.sidebarVisible ?? true);
                    } else {
                        setWorkspaceData(data);
                        setExpandedFolders(new Set(data.expandedFolders));
                        setSidebarVisible(data.sidebarVisible ?? true);
                    }
                } else {
                    setWorkspaceData(data);
                    setExpandedFolders(new Set(data.expandedFolders));
                    setSidebarVisible(data.sidebarVisible ?? true);
                }
            } catch (error) {
                console.error('Failed to load workspace:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        onSidebarTransition?.(true);
        return () => onSidebarTransition?.(false);
    }, [onSidebarTransition]);

    // Get active file
    const activeFile = useMemo(() => {
        const activeId = workspaceData.activeTabId;
        if (!activeId) return null;
        return workspaceData.files.find(f => f.id === activeId) || null;
    }, [workspaceData.activeTabId, workspaceData.files]);

    // Get open tab files
    const openTabFiles = useMemo(() => {
        return workspaceData.openTabs
            .map(id => workspaceData.files.find(f => f.id === id))
            .filter((f): f is WorkspaceFile => f !== null);
    }, [workspaceData.openTabs, workspaceData.files]);

    // Build recent files list
    const recentFiles: RecentFile[] = useMemo(() => {
        return workspaceData.recentFiles
            .map(fileId => {
                const file = workspaceData.files.find(f => f.id === fileId);
                if (!file) return null;

                let path = file.name + FILE_EXTENSIONS[file.type];
                let currentParentId = file.parentId;
                while (currentParentId) {
                    const parent = workspaceData.folders.find(f => f.id === currentParentId);
                    if (parent) {
                        path = parent.name + '/' + path;
                        currentParentId = parent.parentId;
                    } else break;
                }

                return { id: file.id, name: file.name, type: file.type, lastOpened: file.updatedAt, path };
            })
            .filter((f): f is RecentFile => f !== null)
            .slice(0, 10);
    }, [workspaceData.recentFiles, workspaceData.files, workspaceData.folders]);

    const saveWorkspaceData = useCallback(async (data: WorkspaceData) => {
        setWorkspaceData(data);
        await debouncedSave(data);
    }, [debouncedSave]);

    // Handle file selection - opens in tab
    const handleFileSelect = useCallback((fileId: string) => {
        const openTabs = workspaceData.openTabs.includes(fileId)
            ? workspaceData.openTabs
            : [...workspaceData.openTabs, fileId];

        const updatedRecentFiles = addToRecentFiles(fileId, workspaceData.recentFiles);
        saveWorkspaceData({
            ...workspaceData,
            openTabs,
            activeTabId: fileId,
            recentFiles: updatedRecentFiles,
        });
    }, [workspaceData, saveWorkspaceData]);

    // Handle tab close
    const handleTabClose = useCallback((fileId: string) => {
        const newOpenTabs = workspaceData.openTabs.filter(id => id !== fileId);
        let newActiveTabId = workspaceData.activeTabId;

        if (workspaceData.activeTabId === fileId) {
            const closedIndex = workspaceData.openTabs.indexOf(fileId);
            newActiveTabId = newOpenTabs[closedIndex] || newOpenTabs[closedIndex - 1] || null;
        }

        saveWorkspaceData({
            ...workspaceData,
            openTabs: newOpenTabs,
            activeTabId: newActiveTabId,
        });
    }, [workspaceData, saveWorkspaceData]);

    // Handle tab reorder (drag and drop)
    const handleReorderTabs = useCallback((newOrder: string[]) => {
        saveWorkspaceData({
            ...workspaceData,
            openTabs: newOrder,
        });
    }, [workspaceData, saveWorkspaceData]);

    // Handle sidebar toggle
    const handleToggleSidebar = useCallback(() => {
        const newVisible = !sidebarVisible;
        setSidebarVisible(newVisible);
        saveWorkspaceData({ ...workspaceData, sidebarVisible: newVisible });
    }, [sidebarVisible, workspaceData, saveWorkspaceData]);

    const handleFolderToggle = useCallback((folderId: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) newSet.delete(folderId);
            else newSet.add(folderId);
            saveWorkspaceData({ ...workspaceData, expandedFolders: Array.from(newSet) });
            return newSet;
        });
    }, [workspaceData, saveWorkspaceData]);

    const handleFileCreate = useCallback((parentId: string | null, type: FileType) => {
        setNewItemModal({ isOpen: true, parentId, type: 'file', fileType: type });
    }, []);

    const handleFolderCreate = useCallback((parentId: string | null) => {
        setNewItemModal({ isOpen: true, parentId, type: 'folder' });
    }, []);


    const createFile = useCallback((name: string, parentId: string | null, type: FileType) => {
        const validation = validateFileName(name, type, parentId, workspaceData.files);
        if (!validation.isValid) { alert(validation.error); return false; }

        const now = new Date().toISOString();
        const newFile: WorkspaceFile = {
            id: crypto.randomUUID(),
            name: name.trim(),
            type,
            parentId,
            createdAt: now,
            updatedAt: now,
            contentId: crypto.randomUUID(),
        };

        const newOpenTabs = [...workspaceData.openTabs, newFile.id];
        saveWorkspaceData({
            ...workspaceData,
            files: [...workspaceData.files, newFile],
            recentFiles: addToRecentFiles(newFile.id, workspaceData.recentFiles),
            openTabs: newOpenTabs,
            activeTabId: newFile.id,
        });

        if (parentId && !expandedFolders.has(parentId)) {
            setExpandedFolders(prev => new Set([...prev, parentId]));
        }
        return true;
    }, [workspaceData, saveWorkspaceData, expandedFolders]);

    const createFolder = useCallback((name: string, parentId: string | null) => {
        const validation = validateFolderName(name, parentId, workspaceData.folders);
        if (!validation.isValid) { alert(validation.error); return false; }

        const now = new Date().toISOString();
        const newFolder: WorkspaceFolder = {
            id: crypto.randomUUID(),
            name: name.trim(),
            parentId,
            createdAt: now,
            updatedAt: now,
        };

        saveWorkspaceData({ ...workspaceData, folders: [...workspaceData.folders, newFolder] });
        if (parentId && !expandedFolders.has(parentId)) {
            setExpandedFolders(prev => new Set([...prev, parentId]));
        }
        return true;
    }, [workspaceData, saveWorkspaceData, expandedFolders]);

    const handleRename = useCallback((id: string, isFolder: boolean) => {
        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (folder) setRenameModal({ isOpen: true, id, isFolder: true, currentName: folder.name });
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (file) setRenameModal({ isOpen: true, id, isFolder: false, currentName: file.name });
        }
    }, [workspaceData]);

    // Inline rename from content area
    const handleInlineRename = useCallback((fileId: string, newName: string) => {
        const file = workspaceData.files.find(f => f.id === fileId);
        if (!file) return;

        const validation = validateFileName(newName, file.type, file.parentId, workspaceData.files, fileId);
        if (!validation.isValid) { alert(validation.error); return; }

        const updatedFiles = workspaceData.files.map(f =>
            f.id === fileId ? { ...f, name: newName.trim(), updatedAt: new Date().toISOString() } : f
        );
        saveWorkspaceData({ ...workspaceData, files: updatedFiles });
    }, [workspaceData, saveWorkspaceData]);

    const executeRename = useCallback((newName: string) => {
        if (!renameModal) return;
        const { id, isFolder } = renameModal;

        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (!folder) return;
            const validation = validateFolderName(newName, folder.parentId, workspaceData.folders, id);
            if (!validation.isValid) { alert(validation.error); return; }
            const updatedFolders = workspaceData.folders.map(f =>
                f.id === id ? { ...f, name: newName.trim(), updatedAt: new Date().toISOString() } : f
            );
            saveWorkspaceData({ ...workspaceData, folders: updatedFolders });
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (!file) return;
            const validation = validateFileName(newName, file.type, file.parentId, workspaceData.files, id);
            if (!validation.isValid) { alert(validation.error); return; }
            const updatedFiles = workspaceData.files.map(f =>
                f.id === id ? { ...f, name: newName.trim(), updatedAt: new Date().toISOString() } : f
            );
            saveWorkspaceData({ ...workspaceData, files: updatedFiles });
        }
        setRenameModal(null);
    }, [renameModal, workspaceData, saveWorkspaceData]);

    const handleDelete = useCallback((id: string, isFolder: boolean) => {
        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (folder) setDeleteModal({ isOpen: true, id, isFolder: true, name: folder.name });
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (file) setDeleteModal({ isOpen: true, id, isFolder: false, name: file.name + FILE_EXTENSIONS[file.type] });
        }
    }, [workspaceData]);

    const executeDelete = useCallback(() => {
        if (!deleteModal) return;
        const { id, isFolder } = deleteModal;

        if (isFolder) {
            const { fileIds, folderIds } = getDescendants(id, workspaceData.files, workspaceData.folders);
            const updatedFiles = workspaceData.files.filter(f => !fileIds.includes(f.id));
            const updatedFolders = workspaceData.folders.filter(f => f.id !== id && !folderIds.includes(f.id));
            const updatedRecentFiles = workspaceData.recentFiles.filter(fId => !fileIds.includes(fId));
            const updatedOpenTabs = workspaceData.openTabs.filter(fId => !fileIds.includes(fId));
            let newActiveTabId = workspaceData.activeTabId;
            if (newActiveTabId && fileIds.includes(newActiveTabId)) {
                newActiveTabId = updatedOpenTabs[0] || null;
            }

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
                openTabs: updatedOpenTabs,
                activeTabId: newActiveTabId,
                expandedFolders: Array.from(expandedFolders).filter(fId => fId !== id && !folderIds.includes(fId)),
            });
        } else {
            const updatedFiles = workspaceData.files.filter(f => f.id !== id);
            const updatedRecentFiles = workspaceData.recentFiles.filter(fId => fId !== id);
            const updatedOpenTabs = workspaceData.openTabs.filter(fId => fId !== id);
            let newActiveTabId = workspaceData.activeTabId;
            if (newActiveTabId === id) {
                newActiveTabId = updatedOpenTabs[0] || null;
            }

            saveWorkspaceData({
                ...workspaceData,
                files: updatedFiles,
                recentFiles: updatedRecentFiles,
                openTabs: updatedOpenTabs,
                activeTabId: newActiveTabId,
            });
        }
        setDeleteModal(null);
    }, [deleteModal, workspaceData, expandedFolders, saveWorkspaceData]);

    const handleMove = useCallback((id: string, newParentId: string | null, isFolder: boolean) => {
        if (isFolder) {
            const folder = workspaceData.folders.find(f => f.id === id);
            if (!folder) return;
            if (newParentId) {
                const { folderIds } = getDescendants(id, workspaceData.files, workspaceData.folders);
                if (newParentId === id || folderIds.includes(newParentId)) {
                    alert('Cannot move a folder into itself or its descendants');
                    return;
                }
            }
            const validation = validateFolderName(folder.name, newParentId, workspaceData.folders, id);
            if (!validation.isValid) { alert(validation.error); return; }
            const updatedFolders = workspaceData.folders.map(f =>
                f.id === id ? { ...f, parentId: newParentId, updatedAt: new Date().toISOString() } : f
            );
            saveWorkspaceData({ ...workspaceData, folders: updatedFolders });
        } else {
            const file = workspaceData.files.find(f => f.id === id);
            if (!file) return;
            const validation = validateFileName(file.name, file.type, newParentId, workspaceData.files, id);
            if (!validation.isValid) { alert(validation.error); return; }
            const updatedFiles = workspaceData.files.map(f =>
                f.id === id ? { ...f, parentId: newParentId, updatedAt: new Date().toISOString() } : f
            );
            saveWorkspaceData({ ...workspaceData, files: updatedFiles });
        }
        if (newParentId && !expandedFolders.has(newParentId)) {
            setExpandedFolders(prev => new Set([...prev, newParentId]));
        }
    }, [workspaceData, expandedFolders, saveWorkspaceData]);


    const handleReorder = useCallback((id: string, targetId: string, position: 'before' | 'after', isFolder: boolean) => {
        const draggedItem = isFolder
            ? workspaceData.folders.find(f => f.id === id)
            : workspaceData.files.find(f => f.id === id);
        const targetItem = workspaceData.folders.find(f => f.id === targetId)
            || workspaceData.files.find(f => f.id === targetId);

        if (!draggedItem || !targetItem) return;

        const draggedParentId = 'type' in draggedItem && draggedItem.type ? (draggedItem as WorkspaceFile).parentId : (draggedItem as WorkspaceFolder).parentId;
        const targetParentId = 'type' in targetItem && targetItem.type ? (targetItem as WorkspaceFile).parentId : (targetItem as WorkspaceFolder).parentId;

        if (draggedParentId !== targetParentId) {
            handleMove(id, targetParentId, isFolder);
            return;
        }

        const siblingFiles = workspaceData.files.filter(f => f.parentId === draggedParentId);
        const siblingFolders = workspaceData.folders.filter(f => f.parentId === draggedParentId);

        type SiblingItem = { id: string; sortOrder?: number; isFolder: boolean };
        const siblings: SiblingItem[] = [
            ...siblingFolders.map(f => ({ id: f.id, sortOrder: f.sortOrder, isFolder: true })),
            ...siblingFiles.map(f => ({ id: f.id, sortOrder: f.sortOrder, isFolder: false })),
        ].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

        const filteredSiblings = siblings.filter(s => s.id !== id);
        const targetIndex = filteredSiblings.findIndex(s => s.id === targetId);
        if (targetIndex === -1) return;

        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        filteredSiblings.splice(insertIndex, 0, { id, sortOrder: undefined, isFolder });

        const newSortOrders = new Map<string, number>();
        filteredSiblings.forEach((item, index) => newSortOrders.set(item.id, (index + 1) * 1000));

        const updatedFiles = workspaceData.files.map(f => {
            const newOrder = newSortOrders.get(f.id);
            return newOrder !== undefined ? { ...f, sortOrder: newOrder, updatedAt: new Date().toISOString() } : f;
        });
        const updatedFolders = workspaceData.folders.map(f => {
            const newOrder = newSortOrders.get(f.id);
            return newOrder !== undefined ? { ...f, sortOrder: newOrder, updatedAt: new Date().toISOString() } : f;
        });

        saveWorkspaceData({ ...workspaceData, files: updatedFiles, folders: updatedFolders });
    }, [workspaceData, saveWorkspaceData, handleMove]);

    const handleBack = useCallback(async () => {
        cancelDebouncedSave('workspace');
        await saveWorkspace({ ...workspaceData, expandedFolders: Array.from(expandedFolders), sidebarVisible });
        setPage('dashboard');
    }, [workspaceData, expandedFolders, sidebarVisible, setPage]);

    const handleContentChange = useCallback((fileId: string, content: string) => {
        setNoteContents(prev => ({ ...prev, [fileId]: content }));
        const updatedFiles = workspaceData.files.map(f =>
            f.id === fileId ? { ...f, updatedAt: new Date().toISOString() } : f
        );
        saveWorkspaceData({ ...workspaceData, files: updatedFiles });
    }, [workspaceData, saveWorkspaceData]);

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
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 rounded-3xl overflow-hidden">
            {/* Tab Bar */}
            <TabBar
                openTabs={openTabFiles}
                activeTabId={workspaceData.activeTabId}
                sidebarVisible={sidebarVisible}
                onTabSelect={handleFileSelect}
                onTabClose={handleTabClose}
                onToggleSidebar={handleToggleSidebar}
                onBack={handleBack}
                onRename={handleInlineRename}
                onReorderTabs={handleReorderTabs}
            />

            {/* Main content area */}
            <div className="flex-1 flex min-h-0">
                {/* File Tree Sidebar */}
                <AnimatePresence initial={false}>
                    {sidebarVisible && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 256, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex-shrink-0 overflow-hidden"
                        >
                            <FileTree
                                files={workspaceData.files}
                                folders={workspaceData.folders}
                                selectedFileId={workspaceData.activeTabId}
                                expandedFolders={expandedFolders}
                                onFileSelect={handleFileSelect}
                                onFolderToggle={handleFolderToggle}
                                onFileCreate={handleFileCreate}
                                onFolderCreate={handleFolderCreate}
                                onRename={handleRename}
                                onDelete={handleDelete}
                                onMove={handleMove}
                                onReorder={handleReorder}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    <ContentArea
                        selectedFile={activeFile}
                        recentFiles={recentFiles}
                        onFileSelect={handleFileSelect}
                        onFileCreate={handleFileCreateFromWelcome}
                        onContentChange={handleContentChange}
                        fileContent={activeFile ? noteContents[activeFile.id] || '' : ''}
                        renderNerdbookEditor={(contentId) => (
                            <NerdbookEditor
                                contentId={contentId}
                                onNotebookChange={(notebook) => {
                                    if (activeFile && notebook.title !== activeFile.name) {
                                        const updatedFiles = workspaceData.files.map(f =>
                                            f.id === activeFile.id
                                                ? { ...f, name: notebook.title, updatedAt: new Date().toISOString() }
                                                : f
                                        );
                                        saveWorkspaceData({ ...workspaceData, files: updatedFiles });
                                    }
                                }}
                            />
                        )}
                        renderBoardEditor={(contentId) => (
                            <BoardEditor
                                contentId={contentId}
                                onNameChange={(name) => {
                                    if (activeFile && name !== activeFile.name) {
                                        const updatedFiles = workspaceData.files.map(f =>
                                            f.id === activeFile.id
                                                ? { ...f, name: name, updatedAt: new Date().toISOString() }
                                                : f
                                        );
                                        saveWorkspaceData({ ...workspaceData, files: updatedFiles });
                                    }
                                }}
                            />
                        )}
                    />
                </div>
            </div>

            {/* Modals */}
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

            <AnimatePresence>
                {newItemModal?.isOpen && (
                    <NewItemModal
                        type={newItemModal.type}
                        fileType={newItemModal.fileType}
                        onConfirm={(name) => {
                            if (newItemModal.type === 'folder') createFolder(name, newItemModal.parentId);
                            else if (newItemModal.fileType) createFile(name, newItemModal.parentId, newItemModal.fileType);
                            setNewItemModal(null);
                        }}
                        onCancel={() => setNewItemModal(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}


// Rename Modal - Enter to confirm, Esc to cancel
function RenameModal({
    currentName,
    isFolder,
    onConfirm,
    onCancel,
}: {
    currentName: string;
    isFolder: boolean;
    onConfirm: (name: string) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(currentName);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) {
            onConfirm(name.trim());
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-72"
                onClick={e => e.stopPropagation()}
            >
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Rename {isFolder ? 'folder' : 'file'}
                </p>
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={isFolder ? 'Folder name' : 'File name'}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Press Enter to confirm · Esc to cancel
                </p>
            </motion.div>
        </motion.div>
    );
}

// Delete Modal
function DeleteModal({
    name,
    isFolder,
    onConfirm,
    onCancel,
}: {
    name: string;
    isFolder: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Delete {isFolder ? 'Folder' : 'File'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Are you sure you want to delete "{name}"?
                    {isFolder && ' This will also delete all contents inside.'}
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 rounded-md transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// New Item Modal
function NewItemModal({
    type,
    fileType,
    onConfirm,
    onCancel,
}: {
    type: 'file' | 'folder';
    fileType?: FileType;
    onConfirm: (name: string) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) {
            onConfirm(name.trim());
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    const getTitle = () => {
        if (type === 'folder') return 'New Folder';
        switch (fileType) {
            case 'exec': return 'New Nerdbook';
            case 'board': return 'New Board';
            case 'note': return 'New Note';
            default: return 'New File';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-72"
                onClick={e => e.stopPropagation()}
            >
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {getTitle()}
                </p>
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={type === 'folder' ? 'Folder name' : 'File name'}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Press Enter to confirm · Esc to cancel
                </p>
            </motion.div>
        </motion.div>
    );
}
