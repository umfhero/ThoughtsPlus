import { motion } from 'framer-motion';
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { TreeNode, FILE_ICONS } from '../../types/workspace';
import { getFileDisplayName } from '../../utils/workspace';
import { WorkspaceFile } from '../../types/workspace';

interface FileTreeNodeProps {
    node: TreeNode;
    depth: number;
    isSelected: boolean;
    isExpanded?: boolean;
    onSelect: () => void;
    onToggle?: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
}

/**
 * FileTreeNode component renders a single file or folder in the file tree.
 * - Files display with type-specific icons and full name with extension
 * - Folders display with expand/collapse toggle and folder icons
 * - Supports selection highlighting, context menu, and drag-and-drop
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6
 */
export function FileTreeNode({
    node,
    depth,
    isSelected,
    isExpanded = false,
    onSelect,
    onToggle,
    onContextMenu,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}: FileTreeNodeProps) {
    const isFolder = node.type === 'folder';
    const paddingLeft = depth * 16 + 8; // 16px per depth level + 8px base

    // Get the appropriate icon for the node
    const getIcon = () => {
        if (isFolder) {
            return isExpanded ? (
                <FolderOpen className="w-4 h-4 text-yellow-500 dark:text-yellow-400 shrink-0" />
            ) : (
                <Folder className="w-4 h-4 text-yellow-500 dark:text-yellow-400 shrink-0" />
            );
        }

        // File icon based on type
        if (node.fileType) {
            const IconComponent = FILE_ICONS[node.fileType];
            const iconColors: Record<string, string> = {
                exec: 'text-blue-500 dark:text-blue-400',
                board: 'text-purple-500 dark:text-purple-400',
                note: 'text-green-500 dark:text-green-400',
            };
            return (
                <IconComponent
                    className={clsx('w-4 h-4 shrink-0', iconColors[node.fileType])}
                />
            );
        }

        return null;
    };

    // Get display name for the node
    const getDisplayName = () => {
        if (isFolder) {
            return node.name;
        }

        // For files, create a WorkspaceFile-like object to get display name
        if (node.fileType) {
            const fileObj: WorkspaceFile = {
                id: node.id,
                name: node.name,
                type: node.fileType,
                parentId: node.parentId,
                createdAt: node.createdAt,
                updatedAt: node.updatedAt,
                contentId: node.contentId || '',
            };
            return getFileDisplayName(fileObj);
        }

        return node.name;
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder && onToggle) {
            onToggle();
        } else {
            onSelect();
        }
    };

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder && onToggle) {
            onToggle();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="select-none"
        >
            <div
                draggable
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onClick={handleClick}
                onContextMenu={onContextMenu}
                style={{ paddingLeft }}
                className={clsx(
                    'flex items-center gap-2 py-1.5 pr-2 rounded-lg cursor-pointer transition-colors duration-150',
                    'hover:bg-gray-100 dark:hover:bg-gray-700/50',
                    isSelected && 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                    isSelected && 'border-l-2 border-blue-500 dark:border-blue-400',
                    !isSelected && 'text-gray-700 dark:text-gray-300'
                )}
            >
                {/* Expand/Collapse chevron for folders */}
                {isFolder ? (
                    <button
                        onClick={handleChevronClick}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        )}
                    </button>
                ) : (
                    // Spacer for files to align with folder names
                    <div className="w-4" />
                )}

                {/* Icon */}
                {getIcon()}

                {/* Name */}
                <span className="text-sm truncate flex-1" title={getDisplayName()}>
                    {getDisplayName()}
                </span>
            </div>
        </motion.div>
    );
}

export default FileTreeNode;
