import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PanelLeftClose, PanelLeft, Home } from 'lucide-react';
import clsx from 'clsx';
import { WorkspaceFile, FILE_ICONS, FILE_EXTENSIONS } from '../../types/workspace';

interface TabBarProps {
    openTabs: WorkspaceFile[];
    activeTabId: string | null;
    sidebarVisible: boolean;
    onTabSelect: (fileId: string) => void;
    onTabClose: (fileId: string) => void;
    onToggleSidebar: () => void;
    onBack: () => void;
    onRename?: (fileId: string, newName: string) => void;
    onReorderTabs?: (newOrder: string[]) => void;
}

/**
 * TabBar component displays open file tabs like an IDE.
 * Features:
 * - Horizontal scrollable tabs
 * - Close button on each tab
 * - Active tab highlighting with visual connection to content
 * - Sidebar toggle button
 * - Back to dashboard button
 * - Double-click to rename active tab
 * - Drag to reorder tabs
 */
export function TabBar({
    openTabs,
    activeTabId,
    sidebarVisible,
    onTabSelect,
    onTabClose,
    onToggleSidebar,
    onBack,
    onRename,
    onReorderTabs,
}: TabBarProps) {
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<{ tabId: string; side: 'left' | 'right' } | null>(null);

    // Scroll active tab into view
    useEffect(() => {
        if (activeTabId && tabsContainerRef.current) {
            const activeTab = tabsContainerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
            if (activeTab) {
                activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        }
    }, [activeTabId]);

    // Focus input when editing starts
    useEffect(() => {
        if (editingTabId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingTabId]);

    const handleDoubleClick = (file: WorkspaceFile) => {
        setEditingTabId(file.id);
        setEditName(file.name);
    };

    const handleConfirmEdit = () => {
        if (editingTabId && editName.trim() && onRename) {
            const file = openTabs.find(f => f.id === editingTabId);
            if (file && editName.trim() !== file.name) {
                onRename(editingTabId, editName.trim());
            }
        }
        setEditingTabId(null);
        setEditName('');
    };

    const handleCancelEdit = () => {
        setEditingTabId(null);
        setEditName('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirmEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, fileId: string) => {
        setDraggedTabId(fileId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', fileId);
    };

    const handleDragOver = (e: React.DragEvent, fileId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedTabId || draggedTabId === fileId) {
            setDropPosition(null);
            return;
        }

        // Determine if we're on the left or right half of the tab
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const side = e.clientX < midpoint ? 'left' : 'right';

        setDropPosition({ tabId: fileId, side });
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only clear if we're actually leaving the tab area
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
            // Don't clear immediately - let dragOver on another tab set the new position
        }
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedTabId || draggedTabId === targetId || !onReorderTabs || !dropPosition) return;

        const currentOrder = openTabs.map(t => t.id);
        const draggedIndex = currentOrder.indexOf(draggedTabId);
        const targetIndex = currentOrder.indexOf(targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Calculate the final insert position based on original indices
            let insertIndex: number;

            if (dropPosition.side === 'left') {
                // Insert before the target
                insertIndex = targetIndex;
            } else {
                // Insert after the target
                insertIndex = targetIndex + 1;
            }

            // Adjust if dragging from before the insert point
            if (draggedIndex < insertIndex) {
                insertIndex--;
            }

            // Create new order by removing and inserting
            const newOrder = currentOrder.filter(id => id !== draggedTabId);
            newOrder.splice(insertIndex, 0, draggedTabId);
            onReorderTabs(newOrder);
        }

        setDraggedTabId(null);
        setDropPosition(null);
    };

    const handleContainerDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        // Only set drop position if not over a tab (for dropping at the very end)
        const target = e.target as HTMLElement;
        const isOverTab = target.closest('[data-tab-id]');

        if (!isOverTab && draggedTabId && openTabs.length > 0) {
            const lastTab = openTabs[openTabs.length - 1];
            if (lastTab.id !== draggedTabId) {
                setDropPosition({ tabId: lastTab.id, side: 'right' });
            }
        }
    };

    const handleContainerDrop = (e: React.DragEvent) => {
        e.preventDefault();

        // Check if we're dropping on empty space (not on a tab)
        const target = e.target as HTMLElement;
        const isOverTab = target.closest('[data-tab-id]');

        if (isOverTab) return; // Let the tab's drop handler handle it

        if (!draggedTabId || !onReorderTabs) return;

        // Move to end
        const currentOrder = openTabs.map(t => t.id);
        const draggedIndex = currentOrder.indexOf(draggedTabId);

        if (draggedIndex !== -1 && draggedIndex !== currentOrder.length - 1) {
            const newOrder = currentOrder.filter(id => id !== draggedTabId);
            newOrder.push(draggedTabId);
            onReorderTabs(newOrder);
        }

        setDraggedTabId(null);
        setDropPosition(null);
    };

    const handleDragEnd = () => {
        setDraggedTabId(null);
        setDropPosition(null);
    };

    return (
        <div className="flex items-stretch bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {/* Left controls */}
            <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700">
                {/* Back to dashboard button */}
                <button
                    onClick={onBack}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Back to Dashboard"
                >
                    <Home className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>

                {/* Sidebar toggle button */}
                <button
                    onClick={onToggleSidebar}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
                >
                    {sidebarVisible ? (
                        <PanelLeftClose className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    ) : (
                        <PanelLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    )}
                </button>
            </div>

            <div
                ref={tabsContainerRef}
                className="flex-1 flex items-end overflow-x-auto scrollbar-none"
                onDragOver={handleContainerDragOver}
                onDrop={handleContainerDrop}
            >
                <AnimatePresence initial={false}>
                    {openTabs.map((file, index) => {
                        const FileIcon = FILE_ICONS[file.type];
                        const isActive = file.id === activeTabId;
                        const isEditing = file.id === editingTabId;
                        const isDragging = file.id === draggedTabId;
                        const showLeftIndicator = dropPosition?.tabId === file.id && dropPosition.side === 'left';
                        const showRightIndicator = dropPosition?.tabId === file.id && dropPosition.side === 'right';
                        const isLastTab = index === openTabs.length - 1;

                        return (
                            <motion.div
                                key={file.id}
                                data-tab-id={file.id}
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.15 }}
                                draggable={!isEditing}
                                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, file.id)}
                                onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, file.id)}
                                onDragLeave={(e) => handleDragLeave(e as unknown as React.DragEvent)}
                                onDrop={(e) => handleDrop(e as unknown as React.DragEvent, file.id)}
                                onDragEnd={handleDragEnd}
                                className={clsx(
                                    'group relative flex items-center gap-1.5 px-3 py-1.5 min-w-0 cursor-pointer',
                                    isActive
                                        ? 'bg-white dark:bg-gray-900 rounded-t-lg border-t border-l border-r border-gray-200 dark:border-gray-700 -mb-px z-10'
                                        : 'bg-transparent hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-t-md mb-0',
                                    isDragging && 'opacity-50'
                                )}
                                onClick={() => !isEditing && onTabSelect(file.id)}
                                onDoubleClick={() => handleDoubleClick(file)}
                            >
                                {/* Left drop indicator */}
                                {showLeftIndicator && (
                                    <div className="absolute -left-0.5 top-1 bottom-1 w-1 bg-blue-500 rounded-full z-20" />
                                )}

                                {/* Right drop indicator */}
                                {showRightIndicator && (
                                    <div className="absolute -right-0.5 top-1 bottom-1 w-1 bg-blue-500 rounded-full z-20" />
                                )}

                                <FileIcon className={clsx(
                                    'w-3.5 h-3.5 flex-shrink-0',
                                    file.type === 'exec' && 'text-blue-500 dark:text-blue-400',
                                    file.type === 'board' && 'text-purple-500 dark:text-purple-400',
                                    file.type === 'note' && 'text-green-500 dark:text-green-400'
                                )} />

                                {isEditing ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onBlur={handleConfirmEdit}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs bg-white dark:bg-gray-700 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
                                    />
                                ) : (
                                    <span className={clsx(
                                        'text-xs truncate max-w-[140px] whitespace-nowrap',
                                        isActive
                                            ? 'text-gray-800 dark:text-gray-200'
                                            : 'text-gray-600 dark:text-gray-400'
                                    )}>
                                        {file.name}{FILE_EXTENSIONS[file.type]}
                                    </span>
                                )}

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabClose(file.id);
                                    }}
                                    className={clsx(
                                        'p-0.5 rounded flex-shrink-0 transition-colors',
                                        'opacity-0 group-hover:opacity-100',
                                        isActive && 'opacity-100',
                                        'hover:bg-gray-200 dark:hover:bg-gray-600'
                                    )}
                                    title="Close tab"
                                >
                                    <X className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default TabBar;
