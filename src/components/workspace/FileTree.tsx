import { useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePlus, FolderPlus, Pencil, Trash2, ArrowUpDown, Share2 } from 'lucide-react';
import clsx from 'clsx';
import { FileTreeNode } from './FileTreeNode';
import { buildTreeStructure } from '../../utils/workspace';
import { WorkspaceFile, WorkspaceFolder, FileType, TreeNode } from '../../types/workspace';

// Sort options for the file tree
type SortOption = 'custom' | 'alphabetical' | 'recent';

interface FileTreeProps {
    files: WorkspaceFile[];
    folders: WorkspaceFolder[];
    selectedFileId: string | null;
    expandedFolders: Set<string>;
    onFileSelect: (fileId: string) => void;
    onFolderToggle: (folderId: string) => void;
    onFileCreate: (parentId: string | null, type: FileType) => void;
    onFolderCreate: (parentId: string | null) => void;
    onRename: (id: string, isFolder: boolean) => void;
    onDelete: (id: string, isFolder: boolean) => void;
    onMove: (id: string, newParentId: string | null, isFolder: boolean) => void;
    onReorder: (id: string, targetId: string, position: 'before' | 'after', isFolder: boolean) => void;
    onOpenLinkedNotesGraph?: () => void;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    nodeId: string | null;
    isFolder: boolean;
}

interface NewFileMenuState {
    visible: boolean;
    x: number;
    y: number;
    parentId: string | null;
}

/**
 * FileTree component renders the hierarchical file/folder structure.
 * Features:
 * - Recursive tree rendering with FileTreeNode
 * - Drag-and-drop for moving files/folders
 * - Context menu for rename, delete, move operations
 * - "New File" and "New Folder" buttons at top
 * - Back button for navigation
 * 
 * Requirements: 2.1, 2.7, 2.8, 3.2, 3.3
 */
export function FileTree({
    files,
    folders,
    selectedFileId,
    expandedFolders,
    onFileSelect,
    onFolderToggle,
    onFileCreate,
    onFolderCreate,
    onRename,
    onDelete,
    onMove,
    onReorder,
    onOpenLinkedNotesGraph,
}: FileTreeProps) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        nodeId: null,
        isFolder: false,
    });

    const [newFileMenu, setNewFileMenu] = useState<NewFileMenuState>({
        visible: false,
        x: 0,
        y: 0,
        parentId: null,
    });

    const [draggedItem, setDraggedItem] = useState<{ id: string; isFolder: boolean } | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
    const [dragOverItem, setDragOverItem] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
    const [sortOption, setSortOption] = useState<SortOption>(() => {
        // Load from localStorage
        const saved = localStorage.getItem('workspace-sort-option');
        return (saved as SortOption) || 'custom';
    });
    const [showSortMenu, setShowSortMenu] = useState(false);

    const treeContainerRef = useRef<HTMLDivElement>(null);

    // Build tree structure from flat arrays
    const unsortedTreeNodes = buildTreeStructure(files, folders);

    // Sort tree nodes based on selected option
    const sortNodes = useCallback((nodes: TreeNode[]): TreeNode[] => {
        const sorted = [...nodes];

        switch (sortOption) {
            case 'alphabetical':
                sorted.sort((a, b) => {
                    // Folders first, then files
                    if (a.type === 'folder' && b.type !== 'folder') return -1;
                    if (a.type !== 'folder' && b.type === 'folder') return 1;
                    return a.name.localeCompare(b.name);
                });
                break;
            case 'recent':
                sorted.sort((a, b) => {
                    // Folders first, then files
                    if (a.type === 'folder' && b.type !== 'folder') return -1;
                    if (a.type !== 'folder' && b.type === 'folder') return 1;
                    // Sort by updatedAt (most recent first)
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                });
                break;
            case 'custom':
            default:
                // Sort by sortOrder (lower = higher in list), folders first
                sorted.sort((a, b) => {
                    // Folders first, then files
                    if (a.type === 'folder' && b.type !== 'folder') return -1;
                    if (a.type !== 'folder' && b.type === 'folder') return 1;
                    // Then by sortOrder
                    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
                    if (orderA !== orderB) return orderA - orderB;
                    // Fallback to creation time
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });
                break;
        }

        // Recursively sort children
        return sorted.map(node => ({
            ...node,
            children: node.children.length > 0 ? sortNodes(node.children) : node.children,
        }));
    }, [sortOption]);

    const treeNodes = useMemo(() => sortNodes(unsortedTreeNodes), [unsortedTreeNodes, sortNodes]);

    // Handle sort option change
    const handleSortChange = useCallback((option: SortOption) => {
        setSortOption(option);
        localStorage.setItem('workspace-sort-option', option);
        setShowSortMenu(false);
    }, []);

    // Close context menu when clicking outside
    const handleContainerClick = useCallback(() => {
        if (contextMenu.visible) {
            setContextMenu(prev => ({ ...prev, visible: false }));
        }
        if (newFileMenu.visible) {
            setNewFileMenu(prev => ({ ...prev, visible: false }));
        }
        if (showSortMenu) {
            setShowSortMenu(false);
        }
    }, [contextMenu.visible, newFileMenu.visible, showSortMenu]);

    // Handle context menu for nodes
    const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string, isFolder: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            nodeId,
            isFolder,
        });
        setNewFileMenu(prev => ({ ...prev, visible: false }));
    }, []);

    // Handle new file button click
    const handleNewFileClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setNewFileMenu({
            visible: true,
            x: rect.left,
            y: rect.bottom + 4,
            parentId: null, // Root level
        });
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, []);

    // Handle new folder button click
    const handleNewFolderClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onFolderCreate(null); // Root level
    }, [onFolderCreate]);

    // Drag and drop handlers
    const handleDragStart = useCallback((e: React.DragEvent, nodeId: string, isFolder: boolean) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', nodeId);
        setDraggedItem({ id: nodeId, isFolder });
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Don't allow dropping on itself or its descendants
        if (draggedItem && draggedItem.id !== targetFolderId) {
            setDragOverFolder(targetFolderId);
        }
    }, [draggedItem]);

    // Handle drag over for reordering (determines before/after position)
    const handleDragOverItem = useCallback((e: React.DragEvent, targetId: string, targetIsFolder: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        if (!draggedItem || draggedItem.id === targetId) return;

        // If dragging over a folder, always allow dropping into it
        if (targetIsFolder) {
            setDragOverFolder(targetId);
            setDragOverItem(null);
            return;
        }

        // Only allow reordering in custom sort mode
        if (sortOption !== 'custom') {
            return;
        }

        // Get the target element's bounding rect
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY < midY ? 'before' : 'after';

        setDragOverItem({ id: targetId, position });
        setDragOverFolder(null);
    }, [draggedItem, sortOption]);

    const handleDrop = useCallback((e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();

        if (draggedItem && draggedItem.id !== targetFolderId) {
            onMove(draggedItem.id, targetFolderId, draggedItem.isFolder);
        }

        setDraggedItem(null);
        setDragOverFolder(null);
        setDragOverItem(null);
    }, [draggedItem, onMove]);

    // Handle drop for reordering
    const handleDropOnItem = useCallback((e: React.DragEvent, targetId: string, targetIsFolder: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedItem || draggedItem.id === targetId) {
            setDraggedItem(null);
            setDragOverFolder(null);
            setDragOverItem(null);
            return;
        }

        // If dropping on a folder (dragOverFolder is set), move into folder
        if (targetIsFolder && dragOverFolder === targetId) {
            onMove(draggedItem.id, targetId, draggedItem.isFolder);
        }
        // In custom sort mode with dragOverItem, do reorder
        else if (sortOption === 'custom' && dragOverItem && dragOverItem.id === targetId) {
            onReorder(draggedItem.id, targetId, dragOverItem.position, draggedItem.isFolder);
        }

        setDraggedItem(null);
        setDragOverFolder(null);
        setDragOverItem(null);
    }, [draggedItem, dragOverFolder, dragOverItem, sortOption, onMove, onReorder]);

    const handleDragEnd = useCallback(() => {
        setDraggedItem(null);
        setDragOverFolder(null);
        setDragOverItem(null);
    }, []);

    // Recursive render function for tree nodes
    const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
        const isFolder = node.type === 'folder';
        const isExpanded = expandedFolders.has(node.id);
        const isSelected = !isFolder && selectedFileId === node.id;
        const isDragOver = dragOverFolder === node.id;
        const isDragOverBefore = dragOverItem?.id === node.id && dragOverItem.position === 'before';
        const isDragOverAfter = dragOverItem?.id === node.id && dragOverItem.position === 'after';

        return (
            <div key={node.id}>
                {/* Drop indicator line - before */}
                {isDragOverBefore && sortOption === 'custom' && (
                    <div className="h-0.5 bg-blue-500 rounded-full mx-2 -mb-0.5" />
                )}

                <div className={clsx(isDragOver && isFolder && 'bg-blue-100 dark:bg-blue-900/40 rounded-lg')}>
                    <FileTreeNode
                        node={node}
                        depth={depth}
                        isSelected={isSelected}
                        isExpanded={isExpanded}
                        onSelect={() => !isFolder && onFileSelect(node.id)}
                        onToggle={() => isFolder && onFolderToggle(node.id)}
                        onContextMenu={(e) => handleContextMenu(e, node.id, isFolder)}
                        onDragStart={(e) => handleDragStart(e, node.id, isFolder)}
                        onDragOver={(e) => handleDragOverItem(e, node.id, isFolder)}
                        onDrop={(e) => handleDropOnItem(e, node.id, isFolder)}
                        onDragEnd={handleDragEnd}
                    />
                </div>

                {/* Drop indicator line - after */}
                {isDragOverAfter && sortOption === 'custom' && (
                    <div className="h-0.5 bg-blue-500 rounded-full mx-2 -mt-0.5" />
                )}

                {/* Render children if folder is expanded */}
                <AnimatePresence>
                    {isFolder && isExpanded && node.children.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            {node.children.map(child => renderNode(child, depth + 1))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div
            className="h-full flex flex-col bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700"
            onClick={handleContainerClick}
        >
            {/* Header with title and sort */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">Explorer</span>

                {/* Graph view button */}
                {onOpenLinkedNotesGraph && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenLinkedNotesGraph();
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="View Linked Notes Graph"
                    >
                        <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                )}

                {/* Sort button */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowSortMenu(!showSortMenu);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Sort files"
                    >
                        <ArrowUpDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>

                    {/* Sort dropdown */}
                    <AnimatePresence>
                        {showSortMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.1 }}
                                className="absolute right-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {[
                                    { value: 'custom' as SortOption, label: 'Custom' },
                                    { value: 'alphabetical' as SortOption, label: 'Alphabetical' },
                                    { value: 'recent' as SortOption, label: 'Recently Edited' },
                                ].map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => handleSortChange(value)}
                                        className={clsx(
                                            'w-full px-3 py-2 text-sm text-left transition-colors',
                                            sortOption === value
                                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 p-2 border-b border-gray-100 dark:border-gray-700/50">
                <button
                    onClick={handleNewFileClick}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="New File"
                >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>New File</span>
                </button>
                <button
                    onClick={handleNewFolderClick}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="New Folder"
                >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>New Folder</span>
                </button>
            </div>

            {/* Tree container */}
            <div
                ref={treeContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar"
                onDragOver={(e) => handleDragOver(e, null)}
                onDrop={(e) => handleDrop(e, null)}
            >
                {treeNodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            No files yet
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Create a new file or folder to get started
                        </p>
                    </div>
                ) : (
                    treeNodes.map(node => renderNode(node))
                )}
            </div>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu.visible && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onRename={() => {
                            if (contextMenu.nodeId) {
                                onRename(contextMenu.nodeId, contextMenu.isFolder);
                            }
                            setContextMenu(prev => ({ ...prev, visible: false }));
                        }}
                        onDelete={() => {
                            if (contextMenu.nodeId) {
                                onDelete(contextMenu.nodeId, contextMenu.isFolder);
                            }
                            setContextMenu(prev => ({ ...prev, visible: false }));
                        }}
                        onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
                    />
                )}
            </AnimatePresence>

            {/* New File Type Menu */}
            <AnimatePresence>
                {newFileMenu.visible && (
                    <NewFileTypeMenu
                        x={newFileMenu.x}
                        y={newFileMenu.y}
                        onSelect={(type) => {
                            onFileCreate(newFileMenu.parentId, type);
                            setNewFileMenu(prev => ({ ...prev, visible: false }));
                        }}
                        onClose={() => setNewFileMenu(prev => ({ ...prev, visible: false }))}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}


/**
 * Context menu for file/folder operations
 */
function ContextMenu({
    x,
    y,
    onRename,
    onDelete,
    onClose,
}: {
    x: number;
    y: number;
    onRename: () => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    return createPortal(
        <>
            {/* Invisible backdrop to catch clicks outside */}
            <div
                className="fixed inset-0 z-[9998]"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="fixed z-[9999] min-w-[140px] py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
                style={{ left: x, top: y }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onRename}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <Pencil className="w-4 h-4" />
                    <span>Rename</span>
                </button>
                <button
                    onClick={onDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                </button>
            </motion.div>
        </>,
        document.body
    );
}

/**
 * Menu for selecting new file type
 */
function NewFileTypeMenu({
    x,
    y,
    onSelect,
    onClose,
}: {
    x: number;
    y: number;
    onSelect: (type: FileType) => void;
    onClose: () => void;
}) {
    const fileTypes: { type: FileType; label: string; description: string }[] = [
        { type: 'exec', label: 'Notebook (.exec)', description: 'Executable notebook' },
        { type: 'board', label: 'Board (.board)', description: 'Whiteboard canvas' },
        { type: 'note', label: 'Note (.note)', description: 'Quick text note' },
    ];

    return createPortal(
        <>
            {/* Invisible backdrop to catch clicks outside */}
            <div
                className="fixed inset-0 z-[9998]"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.1 }}
                className="fixed z-[9999] min-w-[180px] py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
                style={{ left: x, top: y }}
                onClick={(e) => e.stopPropagation()}
            >
                {fileTypes.map(({ type, label, description }) => (
                    <button
                        key={type}
                        onClick={() => onSelect(type)}
                        className="w-full flex flex-col items-start px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {description}
                        </span>
                    </button>
                ))}
            </motion.div>
        </>,
        document.body
    );
}

export default FileTree;
