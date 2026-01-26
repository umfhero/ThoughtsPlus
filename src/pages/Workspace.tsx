import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTree, ContentArea, NerdbookEditor, BoardEditor, TabBar, LinkedNotesGraph, ImageGallery, ConnectionsPanel, NodeMapEditor, FlashcardsGallery, AiFlashcardGenerator } from '../components/workspace';
import {
    WorkspaceFile,
    WorkspaceFolder,
    WorkspaceData,
    FileType,
    RecentFile,
    FILE_EXTENSIONS,
    detectFileType,
    isDocumentType,
} from '../types/workspace';
import {
    validateFileName,
    validateFileMove,
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
    const [lastExpandedFolderId, setLastExpandedFolderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [noteContents, setNoteContents] = useState<Record<string, string>>({});
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [sidebarManuallyToggled, setSidebarManuallyToggled] = useState(false);

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
    const [showLinkedNotesGraph, setShowLinkedNotesGraph] = useState(false);
    const [showImageGallery, setShowImageGallery] = useState(false);
    const [connectionsModalFile, setConnectionsModalFile] = useState<WorkspaceFile | null>(null);
    const [nodeMapRefreshKey, setNodeMapRefreshKey] = useState(0); // Increment to force NodeMapEditor reload
    const [showAiFlashcardGenerator, setShowAiFlashcardGenerator] = useState(false);
    const [aiFlashcardInitialFileId, setAiFlashcardInitialFileId] = useState<string | undefined>(undefined);

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
                        // Also migrate boards to individual files
                        // @ts-ignore
                        const boardMigrationResult = await window.ipcRenderer?.invoke('migrate-boards-to-files');

                        if (boardMigrationResult?.success && boardMigrationResult.files?.length > 0) {
                            // Update workspace files with the new file paths
                            const updatedFiles = migrationResult.workspaceData.files.map(file => {
                                if (file.type === 'board') {
                                    const migratedFile = boardMigrationResult.files.find(
                                        (mf: { id: string; filePath: string }) => mf.id === file.contentId
                                    );
                                    if (migratedFile) {
                                        return { ...file, filePath: migratedFile.filePath };
                                    }
                                }
                                return file;
                            });
                            migrationResult.workspaceData.files = updatedFiles;
                        }

                        // Also migrate notebooks to individual files
                        // @ts-ignore
                        const notebookMigrationResult = await window.ipcRenderer?.invoke('migrate-notebooks-to-files');

                        if (notebookMigrationResult?.success && notebookMigrationResult.files?.length > 0) {
                            // Update workspace files with the new file paths
                            const updatedFiles = migrationResult.workspaceData.files.map(file => {
                                if (file.type === 'exec') {
                                    const migratedFile = notebookMigrationResult.files.find(
                                        (mf: { id: string; filePath: string }) => mf.id === file.contentId
                                    );
                                    if (migratedFile) {
                                        return { ...file, filePath: migratedFile.filePath };
                                    }
                                }
                                return file;
                            });
                            migrationResult.workspaceData.files = updatedFiles;
                        }

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
                    // Migration already complete, but check if any files are missing filePath
                    // This handles files created before file-based storage was implemented
                    const filesWithoutPath = data.files.filter(f =>
                        !f.filePath && (f.type === 'board' || f.type === 'exec' || f.type === 'note')
                    );

                    if (filesWithoutPath.length > 0) {
                        console.log(`[Workspace] Found ${filesWithoutPath.length} files without filePath:`,
                            filesWithoutPath.map(f => ({ name: f.name, type: f.type, id: f.id, contentId: f.contentId }))
                        );

                        // @ts-ignore
                        const migrationResult = await window.ipcRenderer?.invoke('migrate-workspace-files-to-disk',
                            filesWithoutPath.map(f => ({
                                id: f.id,
                                contentId: f.contentId,
                                name: f.name,
                                type: f.type,
                                parentId: f.parentId // Include parentId to determine if it's in Quick Notes folder
                            }))
                        );

                        if (migrationResult?.success && migrationResult.files?.length > 0) {
                            // Update workspace files with the new file paths
                            const updatedFiles = data.files.map(file => {
                                const migratedFile = migrationResult.files.find(
                                    (mf: { id: string; filePath: string }) => mf.id === file.id
                                );
                                if (migratedFile) {
                                    return { ...file, filePath: migratedFile.filePath };
                                }
                                return file;
                            });

                            const updatedData = { ...data, files: updatedFiles };
                            await saveWorkspace(updatedData);
                            setWorkspaceData(updatedData);
                            setExpandedFolders(new Set(updatedData.expandedFolders));
                            setSidebarVisible(updatedData.sidebarVisible ?? true);
                            console.log(`[Workspace] Migrated ${migrationResult.files.length} files to individual storage`);

                            // Fix any old .nt files that have JSON structure
                            const ntFiles = updatedFiles.filter(f => f.type === 'note' && f.filePath);
                            if (ntFiles.length > 0) {
                                // @ts-ignore
                                const fixResult = await window.ipcRenderer?.invoke('fix-nt-json-files',
                                    ntFiles.map(f => f.filePath)
                                );
                                if (fixResult?.success && fixResult.fixed > 0) {
                                    console.log(`[Workspace] Fixed ${fixResult.fixed} .nt files with JSON structure`);
                                }
                            }

                            return;
                        }
                    }

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

    // Auto-collapse/expand sidebar based on window width (unless manually toggled)
    useEffect(() => {
        const handleResize = () => {
            if (sidebarManuallyToggled) return; // Don't auto-toggle if user manually set it

            const width = window.innerWidth;
            if (width < 900 && sidebarVisible) {
                setSidebarVisible(false);
            } else if (width >= 900 && !sidebarVisible) {
                setSidebarVisible(true);
            }
        };

        window.addEventListener('resize', handleResize);
        // Check on mount
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [sidebarVisible, sidebarManuallyToggled]);

    // Listen for external workspace changes (e.g., quick note added)
    useEffect(() => {
        const handleWorkspaceChanged = async (event: Event) => {
            const customEvent = event as CustomEvent;
            console.log('[Workspace] Received workspace-data-changed event:', customEvent.detail);
            try {
                const data = await loadWorkspace();
                setWorkspaceData(data);
                setExpandedFolders(new Set(data.expandedFolders));
                setSidebarVisible(data.sidebarVisible ?? true);
            } catch (error) {
                console.error('[Workspace] Failed to reload workspace:', error);
            }
        };

        window.addEventListener('workspace-data-changed', handleWorkspaceChanged);
        return () => window.removeEventListener('workspace-data-changed', handleWorkspaceChanged);
    }, []);

    // Get active file
    const activeFile = useMemo(() => {
        const activeId = workspaceData.activeTabId;
        if (!activeId) return null;
        return workspaceData.files.find(f => f.id === activeId) || null;
    }, [workspaceData.activeTabId, workspaceData.files]);

    // Load note content when a .note file becomes active
    useEffect(() => {
        const loadNoteContent = async () => {
            if (!activeFile || activeFile.type !== 'note') return;

            // If we already have the content, don't reload
            if (noteContents[activeFile.id]) return;

            try {
                // First, try to load from disk if filePath exists
                if (activeFile.filePath) {
                    // @ts-ignore
                    const rawContent = await window.ipcRenderer?.invoke('load-workspace-file', activeFile.filePath);

                    if (rawContent !== null && rawContent !== undefined) {
                        let content: string = '';

                        // Handle different content types (Buffer, string, object)
                        if (typeof rawContent === 'string') {
                            content = rawContent;
                        } else if (rawContent && rawContent.type === 'Buffer' && Array.isArray(rawContent.data)) {
                            content = String.fromCharCode.apply(null, rawContent.data);
                        } else if (typeof rawContent === 'object') {
                            // IPC returns {success: true, content: "..."}
                            if (rawContent.success === false) {
                                // Load failed (file not found), fall back to notebookNotes
                                console.warn('[Workspace] File not found on disk, falling back to notebookNotes:', activeFile.filePath);
                                // Don't return here, continue to fallback below
                            } else if (rawContent.success && typeof rawContent.content === 'string') {
                                content = rawContent.content;
                                console.log('[Workspace] Loaded .nt file from disk:', activeFile.filePath);
                                setNoteContents(prev => ({ ...prev, [activeFile.id]: content }));
                                return;
                            } else {
                                // Unexpected format
                                console.warn('[Workspace] Unexpected content format:', rawContent);
                                content = '';
                            }
                        } else {
                            content = String(rawContent);
                        }

                        if (content !== '') {
                            console.log('[Workspace] Loaded .nt file from disk:', activeFile.filePath);
                            setNoteContents(prev => ({ ...prev, [activeFile.id]: content }));
                            return;
                        }
                    }
                }

                // Fallback: try to load from notebookNotes (for legacy quick notes)
                // @ts-ignore
                const data = await window.ipcRenderer?.invoke('get-data');
                if (data?.notebookNotes) {
                    // Find the QuickNote with matching id (contentId)
                    const quickNote = data.notebookNotes.find((n: any) => n.id === activeFile.contentId);
                    if (quickNote?.content) {
                        console.log('[Workspace] Loaded QuickNote content for file:', activeFile.id, 'contentId:', activeFile.contentId);
                        setNoteContents(prev => ({ ...prev, [activeFile.id]: quickNote.content }));
                    }
                }
            } catch (error) {
                console.error('[Workspace] Failed to load note content:', error);
            }
        };

        loadNoteContent();
    }, [activeFile, noteContents]);

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

                // Build virtual path in workspace tree
                let virtualPath = file.name;
                let currentParentId = file.parentId;
                while (currentParentId) {
                    const parent = workspaceData.folders.find(f => f.id === currentParentId);
                    if (parent) {
                        virtualPath = parent.name + '/' + virtualPath;
                        currentParentId = parent.parentId;
                    } else break;
                }

                const fileName = file.name + FILE_EXTENSIONS[file.type];

                return {
                    id: file.id,
                    name: file.name,
                    type: file.type,
                    lastOpened: file.updatedAt,
                    path: virtualPath,
                    filePath: file.filePath || '',
                    fileName
                };
            })
            .filter((f): f is RecentFile => f !== null)
            .slice(0, 10);
    }, [workspaceData.recentFiles, workspaceData.files, workspaceData.folders]);

    const saveWorkspaceData = useCallback(async (data: WorkspaceData) => {
        setWorkspaceData(data);
        await debouncedSave(data);
    }, [debouncedSave]);

    // Initialize file system watcher for auto-importing external files
    useEffect(() => {
        // Only start watcher after initial load is complete
        if (isLoading) return;

        let mounted = true;

        const initFileWatcher = async () => {
            try {
                // @ts-ignore - Electron API
                const result = await window.ipcRenderer?.invoke('start-workspace-watcher');
                if (result?.success && mounted) {
                    console.log('[Workspace] File watcher started:', result.watchPath);
                }

                // Don't auto-scan on startup - let user manually import if needed
                // This prevents accidentally importing files that were already tracked
            } catch (error) {
                console.error('[Workspace] Failed to initialize file watcher:', error);
            }
        };

        initFileWatcher();

        // Listen for new files detected by watcher
        const handleFileAdded = async (event: Event) => {
            if (!mounted) return;

            const customEvent = event as CustomEvent;
            const { filePath, fileName, extension } = customEvent.detail;
            console.log('[Workspace] New file detected:', fileName);

            // Detect file type from extension
            const fileType = detectFileType(fileName);
            if (!fileType) {
                console.log('[Workspace] Unsupported file type:', extension);
                return;
            }

            // Check if file already exists in workspace
            const existingFile = workspaceData.files.find(f => f.filePath === filePath);
            if (existingFile) {
                console.log('[Workspace] File already in workspace:', fileName);
                return;
            }

            // Auto-import the file
            try {
                const now = new Date().toISOString();
                const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
                const newFile: WorkspaceFile = {
                    id: crypto.randomUUID(),
                    name: baseName,
                    type: fileType,
                    parentId: null, // Add to root
                    createdAt: now,
                    updatedAt: now,
                    contentId: crypto.randomUUID(),
                    filePath: filePath,
                };

                const updatedData = {
                    ...workspaceData,
                    files: [...workspaceData.files, newFile],
                };

                await saveWorkspaceData(updatedData);
                console.log('[Workspace] Auto-imported file:', fileName);
            } catch (error) {
                console.error('[Workspace] Failed to auto-import file:', error);
            }
        };

        const handleFileDeleted = async (event: Event) => {
            if (!mounted) return;

            const customEvent = event as CustomEvent;
            const { filePath } = customEvent.detail;
            console.log('[Workspace] File deleted:', filePath);

            // Remove from workspace if it exists
            const fileToRemove = workspaceData.files.find(f => f.filePath === filePath);
            if (fileToRemove) {
                const updatedData = {
                    ...workspaceData,
                    files: workspaceData.files.filter(f => f.id !== fileToRemove.id),
                    openTabs: workspaceData.openTabs.filter(id => id !== fileToRemove.id),
                    activeTabId: workspaceData.activeTabId === fileToRemove.id ? null : workspaceData.activeTabId,
                };
                await saveWorkspaceData(updatedData);
                console.log('[Workspace] Removed deleted file from workspace');
            }
        };

        // IPC event handlers that forward to custom events
        const ipcFileAddedHandler = (_: any, data: any) => {
            window.dispatchEvent(new CustomEvent('workspace-file-added', { detail: data }));
        };

        const ipcFileDeletedHandler = (_: any, data: any) => {
            window.dispatchEvent(new CustomEvent('workspace-file-deleted', { detail: data }));
        };

        // @ts-ignore - Electron IPC events
        window.ipcRenderer?.on('workspace-file-added', ipcFileAddedHandler);

        // @ts-ignore - Electron IPC events
        window.ipcRenderer?.on('workspace-file-deleted', ipcFileDeletedHandler);

        window.addEventListener('workspace-file-added', handleFileAdded);
        window.addEventListener('workspace-file-deleted', handleFileDeleted);

        return () => {
            mounted = false;
            // @ts-ignore - Electron API
            window.ipcRenderer?.invoke('stop-workspace-watcher').catch(console.error);

            // Remove IPC listeners using 'off' method
            // @ts-ignore - Electron IPC events
            window.ipcRenderer?.off('workspace-file-added', ipcFileAddedHandler);
            // @ts-ignore - Electron IPC events
            window.ipcRenderer?.off('workspace-file-deleted', ipcFileDeletedHandler);

            // Remove custom event listeners
            window.removeEventListener('workspace-file-added', handleFileAdded);
            window.removeEventListener('workspace-file-deleted', handleFileDeleted);
        };
    }, [isLoading, workspaceData, saveWorkspaceData]);

    // Get file content for linked notes graph
    const getFileContent = useCallback(async (fileId: string): Promise<string> => {
        const file = workspaceData.files.find(f => f.id === fileId);
        if (!file) {
            console.log(`[getFileContent] File not found: ${fileId}`);
            return '';
        }

        try {
            if (file.filePath) {
                console.log(`[getFileContent] Loading file: ${file.name} (type: ${file.type}) from ${file.filePath}`);
                // @ts-ignore - Electron API
                const rawContent = await window.ipcRenderer?.invoke('load-workspace-file', file.filePath);

                // Handle different content types (Buffer, string, object)
                let content: string = '';
                if (rawContent === null || rawContent === undefined) {
                    console.log(`[getFileContent] No content returned for ${file.name}`);
                    return '';
                } else if (typeof rawContent === 'string') {
                    content = rawContent;
                } else if (rawContent && rawContent.type === 'Buffer' && Array.isArray(rawContent.data)) {
                    // Handle serialized Buffer from IPC (common in Electron)
                    content = String.fromCharCode.apply(null, rawContent.data);
                } else if (typeof rawContent === 'object') {
                    // IPC returns {success: true, content: {...}} - extract the content
                    if (rawContent.success && rawContent.content) {
                        content = typeof rawContent.content === 'string'
                            ? rawContent.content
                            : JSON.stringify(rawContent.content);
                    } else {
                        content = JSON.stringify(rawContent);
                    }
                } else {
                    content = String(rawContent);
                }

                console.log(`[getFileContent] Content for ${file.name} (first 200 chars):`, content.substring(0, 200));

                if (file.type === 'exec') {
                    // Parse notebook and extract all cell content
                    try {
                        const notebook = typeof content === 'string' ? JSON.parse(content) : content;
                        const cellContent = notebook.cells?.map((c: any) => c.content || '').join('\n') || '';
                        console.log(`[getFileContent] Extracted cell content for ${file.name}:`, cellContent.substring(0, 200));
                        return cellContent;
                    } catch (parseError) {
                        console.error(`[getFileContent] JSON parse error for ${file.name}:`, parseError);
                        return '';
                    }
                } else if (file.type === 'note') {
                    // Plain text note - might be wrapped in {success, content}
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed.success && typeof parsed.content === 'string') {
                            return parsed.content;
                        }
                    } catch {
                        // Not JSON, return as-is
                    }
                    return content;
                } else if (file.type === 'board') {
                    // Board files - extract text from elements if possible
                    try {
                        const board = typeof content === 'string' ? JSON.parse(content) : content;
                        // Extract text from board notes
                        const texts = board.notes?.filter((e: any) => e.type === 'text').map((e: any) => e.text || '').join('\n') || '';
                        return texts;
                    } catch {
                        return '';
                    }
                } else if (file.type === 'nbm') {
                    // Node map files - extract connections array
                    try {
                        const nbm = typeof content === 'string' ? JSON.parse(content) : content;
                        // Return connections as newline-separated text for parseMentions
                        if (nbm.connections && Array.isArray(nbm.connections)) {
                            return nbm.connections.join('\n');
                        }
                        return '';
                    } catch {
                        return '';
                    }
                }
                return content;
            } else {
                console.log(`[getFileContent] No filePath for file: ${file.name}`);
            }
        } catch (e) {
            console.error('Error loading file content:', e);
        }
        return '';
    }, [workspaceData.files]);

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
        setSidebarManuallyToggled(true); // User manually toggled, don't auto-resize

        // Reset manual toggle after 10 seconds to re-enable auto-resize
        setTimeout(() => {
            setSidebarManuallyToggled(false);
        }, 10000);

        saveWorkspaceData({ ...workspaceData, sidebarVisible: newVisible });
    }, [sidebarVisible, workspaceData, saveWorkspaceData]);

    const handleFolderToggle = useCallback((folderId: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
                // If closing the last expanded folder, clear it
                if (lastExpandedFolderId === folderId) {
                    setLastExpandedFolderId(null);
                }
            } else {
                newSet.add(folderId);
                // Track this as the last expanded folder
                setLastExpandedFolderId(folderId);
            }
            saveWorkspaceData({ ...workspaceData, expandedFolders: Array.from(newSet) });
            return newSet;
        });
    }, [workspaceData, saveWorkspaceData, lastExpandedFolderId]);

    const handleFileCreate = useCallback((parentId: string | null, type: FileType) => {
        // If no parent specified and we have a last expanded folder, use that
        const effectiveParentId = parentId !== null ? parentId : lastExpandedFolderId;
        setNewItemModal({ isOpen: true, parentId: effectiveParentId, type: 'file', fileType: type });
    }, [lastExpandedFolderId]);

    const handleFolderCreate = useCallback((parentId: string | null) => {
        setNewItemModal({ isOpen: true, parentId, type: 'folder' });
    }, []);
    const createFile = useCallback(async (name: string, parentId: string | null, type: FileType): Promise<string | null> => {
        const validation = validateFileName(name, type, parentId, workspaceData.files);
        if (!validation.isValid) {
            return validation.error || 'Invalid file name';
        }

        const now = new Date().toISOString();
        const contentId = crypto.randomUUID();

        // Create initial content based on file type
        let initialContent: any;
        if (type === 'exec') {
            // Create a new notebook structure
            initialContent = {
                id: contentId,
                title: name.trim(),
                cells: [{
                    id: crypto.randomUUID(),
                    type: 'code',
                    content: '',
                    createdAt: now,
                }],
                createdAt: now,
                updatedAt: now,
            };
        } else if (type === 'board') {
            // Create a new board structure matching Board interface
            initialContent = {
                id: contentId,
                name: name.trim(),
                color: '#3B82F6', // Default blue color
                notes: [], // Empty notes array (not elements!)
                createdAt: now,
                updatedAt: now,
            };
        } else if (type === 'nbm') {
            // Create a new node map structure
            initialContent = {
                nodes: [],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 }
            };
        } else if (type === 'flashcards') {
            // Create a new flashcard deck structure
            initialContent = {
                id: contentId,
                name: name.trim(),
                color: '#3B82F6',
                cards: [],
                createdAt: now,
                totalReviews: 0
            };
        } else if (type === 'note') {
            // Note type - just plain text, no JSON structure
            initialContent = '';
        } else {
            // Fallback for unknown types
            initialContent = '';
        }

        // Save to individual file
        // @ts-ignore
        const saveResult = await window.ipcRenderer?.invoke('save-workspace-file', {
            createNew: true,
            name: name.trim(),
            type,
            content: initialContent,
        });

        if (!saveResult?.success) {
            return 'Failed to create file: ' + (saveResult?.error || 'Unknown error');
        }

        const newFile: WorkspaceFile = {
            id: crypto.randomUUID(),
            name: name.trim(),
            type,
            parentId,
            createdAt: now,
            updatedAt: now,
            contentId,
            filePath: saveResult.filePath,
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
        return null; // Success
    }, [workspaceData, saveWorkspaceData, expandedFolders]);

    const createFolder = useCallback((name: string, parentId: string | null): string | null => {
        const validation = validateFolderName(name, parentId, workspaceData.folders);
        if (!validation.isValid) {
            return validation.error || 'Invalid folder name';
        }

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
        return null; // Success
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
    const handleInlineRename = useCallback(async (fileId: string, newName: string) => {
        const file = workspaceData.files.find(f => f.id === fileId);
        if (!file) return;

        const validation = validateFileName(newName, file.type, file.parentId, workspaceData.files, fileId);
        if (!validation.isValid) { alert(validation.error); return; }

        // Rename file on disk if it has a filePath
        let newFilePath = file.filePath;
        if (file.filePath) {
            // @ts-ignore
            const renameResult = await window.ipcRenderer?.invoke('rename-workspace-file', {
                oldPath: file.filePath,
                newName: newName.trim(),
                type: file.type,
            });
            if (renameResult?.success) {
                newFilePath = renameResult.newPath;
            }
        }

        const updatedFiles = workspaceData.files.map(f =>
            f.id === fileId ? { ...f, name: newName.trim(), filePath: newFilePath, updatedAt: new Date().toISOString() } : f
        );
        saveWorkspaceData({ ...workspaceData, files: updatedFiles });
    }, [workspaceData, saveWorkspaceData]);

    const executeRename = useCallback(async (newName: string) => {
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

            // Rename file on disk if it has a filePath
            let newFilePath = file.filePath;
            if (file.filePath) {
                // @ts-ignore
                const renameResult = await window.ipcRenderer?.invoke('rename-workspace-file', {
                    oldPath: file.filePath,
                    newName: newName.trim(),
                    type: file.type,
                });
                if (renameResult?.success) {
                    newFilePath = renameResult.newPath;
                }
            }

            const updatedFiles = workspaceData.files.map(f =>
                f.id === id ? { ...f, name: newName.trim(), filePath: newFilePath, updatedAt: new Date().toISOString() } : f
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

    const executeDelete = useCallback(async () => {
        if (!deleteModal) return;
        const { id, isFolder } = deleteModal;

        if (isFolder) {
            const { fileIds, folderIds } = getDescendants(id, workspaceData.files, workspaceData.folders);

            // Delete workspace files from disk (but not external document files)
            for (const fileId of fileIds) {
                const file = workspaceData.files.find(f => f.id === fileId);
                if (file?.filePath && !isDocumentType(file.type)) {
                    // Only delete actual workspace files, not external documents
                    // @ts-ignore
                    await window.ipcRenderer?.invoke('delete-workspace-file', file.filePath);
                }
            }

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
            // Delete file
            const file = workspaceData.files.find(f => f.id === id);
            if (file?.filePath) {
                if (isDocumentType(file.type)) {
                    // External document file - only remove from workspace, don't delete actual file
                    console.log('[Workspace] Removing external file from workspace (not deleting):', file.name);
                } else {
                    // Workspace file - delete from disk
                    // @ts-ignore
                    await window.ipcRenderer?.invoke('delete-workspace-file', file.filePath);
                }
            }

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
            const validation = validateFileMove(file.name, file.type, newParentId, workspaceData.files, id);
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

    const handleContentChange = useCallback(async (fileId: string, content: string) => {
        setNoteContents(prev => ({ ...prev, [fileId]: content }));

        // Find the file to get its type and contentId
        const file = workspaceData.files.find(f => f.id === fileId);

        // If it's a .note file, save to disk
        if (file?.type === 'note') {
            try {
                // Save to individual file on disk
                if (file.filePath) {
                    // @ts-ignore
                    await window.ipcRenderer?.invoke('save-workspace-file', {
                        filePath: file.filePath,
                        content: content, // Save plain text content
                        type: 'note',
                    });
                    console.log('[Workspace] Saved .nt file to disk:', file.filePath);
                }

                // Also update the notebookNotes for backward compatibility (quick notes)
                if (file.contentId) {
                    // @ts-ignore
                    const data = await window.ipcRenderer?.invoke('get-data');
                    if (data?.notebookNotes) {
                        const updatedNotes = data.notebookNotes.map((n: any) =>
                            n.id === file.contentId
                                ? { ...n, content, updatedAt: new Date().toISOString() }
                                : n
                        );
                        // @ts-ignore
                        await window.ipcRenderer?.invoke('save-data', { ...data, notebookNotes: updatedNotes });
                    }
                }
            } catch (error) {
                console.error('[Workspace] Failed to save note content:', error);
            }
        }

        const updatedFiles = workspaceData.files.map(f =>
            f.id === fileId ? { ...f, updatedAt: new Date().toISOString() } : f
        );
        saveWorkspaceData({ ...workspaceData, files: updatedFiles });
    }, [workspaceData, saveWorkspaceData]);

    // Handle opening flashcards - creates a virtual flashcards file if it doesn't exist
    const handleOpenFlashcards = useCallback(() => {
        // Check if flashcards file already exists
        const existingFlashcardsFile = workspaceData.files.find(f => f.type === 'flashcards');

        if (existingFlashcardsFile) {
            // Open existing flashcards file
            handleFileSelect(existingFlashcardsFile.id);
        } else {
            // Create a new flashcards file
            const now = new Date().toISOString();
            const newFile: WorkspaceFile = {
                id: crypto.randomUUID(),
                name: 'Flashcards',
                type: 'flashcards',
                parentId: null,
                createdAt: now,
                updatedAt: now,
                contentId: 'flashcards-main', // Virtual content ID
            };

            const newOpenTabs = [...workspaceData.openTabs, newFile.id];
            const updatedData = {
                ...workspaceData,
                files: [...workspaceData.files, newFile],
                recentFiles: addToRecentFiles(newFile.id, workspaceData.recentFiles),
                openTabs: newOpenTabs,
                activeTabId: newFile.id,
            };

            saveWorkspaceData(updatedData);
        }
    }, [workspaceData, handleFileSelect, saveWorkspaceData]);

    const handleFileCreateFromWelcome = useCallback((type: FileType) => {
        handleFileCreate(null, type);
    }, [handleFileCreate]);

    // Handle turning a note into flashcards
    const handleTurnIntoFlashcards = useCallback((fileId: string) => {
        setAiFlashcardInitialFileId(fileId);
        setShowAiFlashcardGenerator(true);
    }, []);

    // Handle folder color change
    const handleFolderColorChange = useCallback((folderId: string, color: string) => {
        const updatedFolders = workspaceData.folders.map(f =>
            f.id === folderId ? { ...f, color, updatedAt: new Date().toISOString() } : f
        );
        saveWorkspaceData({ ...workspaceData, folders: updatedFolders });
    }, [workspaceData, saveWorkspaceData]);

    // Handle AI flashcard generation
    const handleGenerateFlashcards = useCallback(async (fileIds: string[], deckName: string, cardCount: number) => {
        try {
            // Get content from all selected files
            const fileContents = await Promise.all(
                fileIds.map(async (fileId) => {
                    const content = await getFileContent(fileId);
                    const file = workspaceData.files.find(f => f.id === fileId);
                    return { fileName: file?.name || 'Unknown', content };
                })
            );

            // Combine all content
            const combinedContent = fileContents
                .map(({ fileName, content }) => `# ${fileName}\n\n${content}`)
                .join('\n\n---\n\n');

            // Call AI to generate flashcards (using minimal tokens)
            // @ts-ignore
            const result = await window.ipcRenderer?.invoke('generate-flashcards-from-content', {
                content: combinedContent,
                deckName,
                cardCount,
            });

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to generate flashcards');
            }

            // Create flashcard deck with generated cards
            const now = new Date().toISOString();
            const contentId = crypto.randomUUID();

            const flashcardDeck = {
                id: contentId,
                name: deckName,
                color: '#8B5CF6',
                cards: result.cards || [],
                createdAt: now,
                totalReviews: 0,
            };

            // Save to flashcards data
            // @ts-ignore
            const data = await window.ipcRenderer?.invoke('get-data');
            const flashcardsData = data?.flashcards || { decks: [], studySessions: [], settings: {} };
            flashcardsData.decks.push(flashcardDeck);

            // @ts-ignore
            await window.ipcRenderer?.invoke('save-data', { ...data, flashcards: flashcardsData });

            // Open flashcards view
            handleOpenFlashcards();

        } catch (error) {
            console.error('Failed to generate flashcards:', error);
            throw error;
        }
    }, [workspaceData.files, getFileContent, handleOpenFlashcards]);

    // Handle opening external file via file dialog
    const handleOpenExternalFile = useCallback(async () => {
        try {
            // @ts-ignore
            const result = await window.ipcRenderer?.invoke('open-workspace-file-dialog');

            if (!result || !result.success || result.canceled) {
                return;
            }

            const { filePath, fileName, fileType, content } = result;

            // Check if this file is already in the workspace (by path)
            const existingFile = workspaceData.files.find(f => f.filePath === filePath);
            if (existingFile) {
                // Just open the existing file
                handleFileSelect(existingFile.id);
                return;
            }

            // Create a new workspace file entry for this external file
            const now = new Date().toISOString();

            // Use the content's ID if available (for boards and notebooks)
            const contentId = content?.id || crypto.randomUUID();

            const newFile: WorkspaceFile = {
                id: crypto.randomUUID(),
                name: fileName,
                type: fileType,
                parentId: null,
                createdAt: now,
                updatedAt: now,
                contentId: contentId,
                filePath: filePath, // Store the external path
            };

            // For notebooks and boards, we need to store the content
            // For now, we'll add the file to workspace and let the editors handle loading
            const newOpenTabs = [...workspaceData.openTabs, newFile.id];
            const updatedData = {
                ...workspaceData,
                files: [...workspaceData.files, newFile],
                recentFiles: addToRecentFiles(newFile.id, workspaceData.recentFiles),
                openTabs: newOpenTabs,
                activeTabId: newFile.id,
            };

            setWorkspaceData(updatedData);
            await saveWorkspace(updatedData);

        } catch (error) {
            console.error('Failed to open external file:', error);
        }
    }, [workspaceData, handleFileSelect]);

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
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
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
                            animate={{ width: 220, opacity: 1 }}
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
                                onOpenLinkedNotesGraph={() => setShowLinkedNotesGraph(true)}
                                onOpenImageGallery={() => setShowImageGallery(true)}
                                onOpenFlashcards={handleOpenFlashcards}
                                onOpenConnections={(fileId) => {
                                    const file = workspaceData.files.find(f => f.id === fileId);
                                    if (file) setConnectionsModalFile(file);
                                }}
                                onOpenFile={handleOpenExternalFile}
                                onTurnIntoFlashcards={handleTurnIntoFlashcards}
                                onFolderColorChange={handleFolderColorChange}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    <ContentArea
                        selectedFile={activeFile}
                        recentFiles={recentFiles}
                        files={workspaceData.files}
                        onFileSelect={handleFileSelect}
                        onFileCreate={handleFileCreateFromWelcome}
                        onContentChange={handleContentChange}
                        onOpenExternalFile={handleOpenExternalFile}
                        fileContent={activeFile ? noteContents[activeFile.id] || '' : ''}
                        renderNerdbookEditor={(contentId, filePath) => (
                            <NerdbookEditor
                                contentId={contentId}
                                filePath={filePath}
                                workspaceFiles={workspaceData.files}
                                currentFileId={activeFile?.id}
                                onNavigateToNote={handleFileSelect}
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
                        renderBoardEditor={(contentId, filePath) => (
                            <BoardEditor
                                contentId={contentId}
                                filePath={filePath}
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
                        renderNodeMapEditor={(contentId, filePath) => (
                            <NodeMapEditor
                                key={`${contentId}-${nodeMapRefreshKey}`}
                                contentId={contentId}
                                filePath={filePath}
                                onSave={() => {
                                    // Trigger workspace refresh if needed
                                }}
                            />
                        )}
                        renderFlashcardsEditor={() => (
                            <FlashcardsGallery
                                onBack={() => {
                                    // Close the flashcards tab
                                    if (activeFile) {
                                        handleTabClose(activeFile.id);
                                    }
                                }}
                                onOpenAiGenerator={() => {
                                    setAiFlashcardInitialFileId(undefined);
                                    setShowAiFlashcardGenerator(true);
                                }}
                            />
                        )}
                    />
                </div>
            </div>            {/* Modals */}
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
                        onConfirm={async (name) => {
                            let error: string | null = null;

                            if (newItemModal.type === 'folder') {
                                error = createFolder(name, newItemModal.parentId);
                            } else if (newItemModal.fileType) {
                                error = await createFile(name, newItemModal.parentId, newItemModal.fileType);
                            }

                            if (!error) {
                                setNewItemModal(null);
                            }

                            return error;
                        }}
                        onCancel={() => setNewItemModal(null)}
                    />
                )}
            </AnimatePresence>

            {/* Linked Notes Graph */}
            <LinkedNotesGraph
                isOpen={showLinkedNotesGraph}
                onClose={() => setShowLinkedNotesGraph(false)}
                workspaceFiles={workspaceData.files}
                onNavigateToFile={handleFileSelect}
                getFileContent={getFileContent}
            />

            {/* Image Gallery */}
            <ImageGallery
                isOpen={showImageGallery}
                onClose={() => setShowImageGallery(false)}
            />

            {/* Connections Panel */}
            <ConnectionsPanel
                isOpen={!!connectionsModalFile}
                onClose={() => setConnectionsModalFile(null)}
                file={connectionsModalFile}
                workspaceFiles={workspaceData.files}
                getFileContent={getFileContent}
                sidebarWidth={sidebarVisible ? 220 : 0}
                onAddConnection={async (fromFileId, toFileName) => {
                    // Add @mention to the file content
                    const file = workspaceData.files.find(f => f.id === fromFileId);
                    if (!file?.filePath) {
                        console.error('[Workspace] Cannot add connection: file has no filePath');
                        throw new Error('File not saved to disk');
                    }

                    try {
                        // @ts-ignore
                        const result = await window.ipcRenderer?.invoke('add-connection-to-file', {
                            filePath: file.filePath,
                            fileType: file.type,
                            targetFileName: toFileName,
                        });
                        if (!result?.success) {
                            console.error('[Workspace] Failed to add connection:', result?.error);
                            throw new Error(result?.error || 'Failed to add connection');
                        }

                        // Update file's updatedAt timestamp to reflect the change
                        const updatedFiles = workspaceData.files.map(f =>
                            f.id === fromFileId ? { ...f, updatedAt: new Date().toISOString() } : f
                        );
                        saveWorkspaceData({ ...workspaceData, files: updatedFiles });

                        // If it's an NBM file, force the NodeMapEditor to reload
                        if (file.type === 'nbm') {
                            setNodeMapRefreshKey(prev => prev + 1);
                        }
                    } catch (e) {
                        console.error('[Workspace] Error adding connection:', e);
                        throw e;
                    }
                }}
                onRemoveConnection={async (fromFileId, mentionText) => {
                    // Remove @mention from the file content
                    const file = workspaceData.files.find(f => f.id === fromFileId);
                    if (!file?.filePath) {
                        console.error('[Workspace] Cannot remove connection: file has no filePath');
                        throw new Error('File not saved to disk');
                    }

                    try {
                        // @ts-ignore
                        const result = await window.ipcRenderer?.invoke('remove-connection-from-file', {
                            filePath: file.filePath,
                            fileType: file.type,
                            mentionText: mentionText,
                        });
                        if (!result?.success) {
                            console.error('[Workspace] Failed to remove connection:', result?.error);
                            throw new Error(result?.error || 'Failed to remove connection');
                        }

                        // Update file's updatedAt timestamp to reflect the change
                        const updatedFiles = workspaceData.files.map(f =>
                            f.id === fromFileId ? { ...f, updatedAt: new Date().toISOString() } : f
                        );
                        saveWorkspaceData({ ...workspaceData, files: updatedFiles });
                    } catch (e) {
                        console.error('[Workspace] Error removing connection:', e);
                        throw e;
                    }
                }}
            />

            {/* AI Flashcard Generator */}
            <AiFlashcardGenerator
                isOpen={showAiFlashcardGenerator}
                onClose={() => {
                    setShowAiFlashcardGenerator(false);
                    setAiFlashcardInitialFileId(undefined);
                }}
                initialFileId={aiFlashcardInitialFileId}
                workspaceFiles={workspaceData.files}
                sidebarWidth={sidebarVisible ? 220 : 0}
                onGenerate={handleGenerateFlashcards}
            />
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
    onConfirm: (name: string) => Promise<string | null>; // Returns error message or null on success
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async () => {
        if (!name.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        const errorMsg = await onConfirm(name.trim());

        if (errorMsg) {
            setError(errorMsg);
            setIsSubmitting(false);
        }
        // If no error, modal will be closed by parent
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    const getTitle = () => {
        if (type === 'folder') return 'New Folder';
        switch (fileType) {
            case 'exec': return 'New Nerdbook';
            case 'board': return 'New Board';
            case 'nbm': return 'New Node Map';
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
                    onChange={e => {
                        setName(e.target.value);
                        setError(null); // Clear error when typing
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    placeholder={type === 'folder' ? 'Folder name' : 'File name'}
                />
                {error && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                        {error}
                    </p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Press Enter to confirm · Esc to cancel
                </p>
            </motion.div>
        </motion.div>
    );
}
