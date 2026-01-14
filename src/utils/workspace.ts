import {
    WorkspaceFile,
    WorkspaceFolder,
    FileType,
    FILE_EXTENSIONS,
    INVALID_FILENAME_CHARS_REGEX,
    FileNameValidation,
    TreeNode,
} from '../types/workspace';

/**
 * Returns the display name for a file in "name.extension" format
 * @param file - The workspace file
 * @returns The formatted display name (e.g., "project-notes.exec")
 */
export function getFileDisplayName(file: WorkspaceFile): string {
    return `${file.name}${FILE_EXTENSIONS[file.type]}`;
}

/**
 * Validates a file name for creation or rename operations
 * Checks for:
 * 1. Non-empty name
 * 2. No invalid characters
 * 3. Uniqueness within the same folder for the same file type
 * 
 * @param name - The proposed file name (without extension)
 * @param type - The file type
 * @param parentId - The parent folder ID (null for root)
 * @param existingFiles - All existing files in the workspace
 * @param excludeFileId - Optional file ID to exclude (for rename operations)
 * @returns Validation result with isValid flag and optional error message
 */
export function validateFileName(
    name: string,
    type: FileType,
    parentId: string | null,
    existingFiles: WorkspaceFile[],
    excludeFileId?: string
): FileNameValidation {
    // Check for empty name
    const trimmedName = name.trim();
    if (!trimmedName) {
        return { isValid: false, error: 'File name cannot be empty' };
    }

    // Check for invalid characters
    if (INVALID_FILENAME_CHARS_REGEX.test(trimmedName)) {
        return {
            isValid: false,
            error: 'File name cannot contain: / \\ : * ? " < > |',
        };
    }

    // Check for uniqueness within the same folder and same type
    const duplicate = existingFiles.find(
        (file) =>
            file.id !== excludeFileId &&
            file.parentId === parentId &&
            file.name.toLowerCase() === trimmedName.toLowerCase() &&
            file.type === type
    );

    if (duplicate) {
        return {
            isValid: false,
            error: `A file named "${trimmedName}${FILE_EXTENSIONS[type]}" already exists in this folder`,
        };
    }

    return { isValid: true };
}


/**
 * Validates a folder name for creation or rename operations
 * Checks for:
 * 1. Non-empty name
 * 2. No invalid characters
 * 3. Uniqueness within the same parent folder
 * 
 * @param name - The proposed folder name
 * @param parentId - The parent folder ID (null for root)
 * @param existingFolders - All existing folders in the workspace
 * @param excludeFolderId - Optional folder ID to exclude (for rename operations)
 * @returns Validation result with isValid flag and optional error message
 */
export function validateFolderName(
    name: string,
    parentId: string | null,
    existingFolders: WorkspaceFolder[],
    excludeFolderId?: string
): FileNameValidation {
    // Check for empty name
    const trimmedName = name.trim();
    if (!trimmedName) {
        return { isValid: false, error: 'Folder name cannot be empty' };
    }

    // Check for invalid characters
    if (INVALID_FILENAME_CHARS_REGEX.test(trimmedName)) {
        return {
            isValid: false,
            error: 'Folder name cannot contain: / \\ : * ? " < > |',
        };
    }

    // Check for uniqueness within the same parent folder
    const duplicate = existingFolders.find(
        (folder) =>
            folder.id !== excludeFolderId &&
            folder.parentId === parentId &&
            folder.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
        return {
            isValid: false,
            error: `A folder named "${trimmedName}" already exists in this location`,
        };
    }

    return { isValid: true };
}

/**
 * Builds a hierarchical tree structure from flat arrays of files and folders
 * 
 * @param files - All workspace files
 * @param folders - All workspace folders
 * @returns Array of root-level TreeNodes with nested children
 */
export function buildTreeStructure(
    files: WorkspaceFile[],
    folders: WorkspaceFolder[]
): TreeNode[] {
    // Create a map for quick lookup
    const folderMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // First, create TreeNodes for all folders
    for (const folder of folders) {
        const node: TreeNode = {
            id: folder.id,
            name: folder.name,
            type: 'folder',
            parentId: folder.parentId,
            children: [],
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
        };
        folderMap.set(folder.id, node);
    }

    // Build folder hierarchy
    for (const folder of folders) {
        const node = folderMap.get(folder.id)!;
        if (folder.parentId === null) {
            rootNodes.push(node);
        } else {
            const parentNode = folderMap.get(folder.parentId);
            if (parentNode) {
                parentNode.children.push(node);
            } else {
                // Parent doesn't exist, treat as root
                rootNodes.push(node);
            }
        }
    }

    // Add files to their respective folders or root
    for (const file of files) {
        const fileNode: TreeNode = {
            id: file.id,
            name: file.name,
            type: 'file',
            fileType: file.type,
            parentId: file.parentId,
            children: [],
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
            contentId: file.contentId,
        };

        if (file.parentId === null) {
            rootNodes.push(fileNode);
        } else {
            const parentNode = folderMap.get(file.parentId);
            if (parentNode) {
                parentNode.children.push(fileNode);
            } else {
                // Parent doesn't exist, treat as root
                rootNodes.push(fileNode);
            }
        }
    }

    // Sort children: folders first, then files, alphabetically within each group
    const sortNodes = (nodes: TreeNode[]): void => {
        nodes.sort((a, b) => {
            // Folders come before files
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            // Alphabetical within same type
            return a.name.localeCompare(b.name);
        });

        // Recursively sort children
        for (const node of nodes) {
            if (node.children.length > 0) {
                sortNodes(node.children);
            }
        }
    };

    sortNodes(rootNodes);

    return rootNodes;
}

/**
 * Gets all descendant files and folders of a given folder (for cascading delete)
 * 
 * @param folderId - The folder ID to get descendants for
 * @param files - All workspace files
 * @param folders - All workspace folders
 * @returns Object containing arrays of descendant file IDs and folder IDs
 */
export function getDescendants(
    folderId: string,
    files: WorkspaceFile[],
    folders: WorkspaceFolder[]
): { fileIds: string[]; folderIds: string[] } {
    const fileIds: string[] = [];
    const folderIds: string[] = [];

    // Build a map of folder children for efficient lookup
    const childFoldersMap = new Map<string, WorkspaceFolder[]>();
    for (const folder of folders) {
        const parentId = folder.parentId ?? '__root__';
        if (!childFoldersMap.has(parentId)) {
            childFoldersMap.set(parentId, []);
        }
        childFoldersMap.get(parentId)!.push(folder);
    }

    // Build a map of files by parent folder
    const filesByParentMap = new Map<string, WorkspaceFile[]>();
    for (const file of files) {
        const parentId = file.parentId ?? '__root__';
        if (!filesByParentMap.has(parentId)) {
            filesByParentMap.set(parentId, []);
        }
        filesByParentMap.get(parentId)!.push(file);
    }

    // Recursive function to collect descendants
    const collectDescendants = (currentFolderId: string): void => {
        // Add direct child files
        const childFiles = filesByParentMap.get(currentFolderId) ?? [];
        for (const file of childFiles) {
            fileIds.push(file.id);
        }

        // Add direct child folders and recurse
        const childFolders = childFoldersMap.get(currentFolderId) ?? [];
        for (const folder of childFolders) {
            folderIds.push(folder.id);
            collectDescendants(folder.id);
        }
    };

    collectDescendants(folderId);

    return { fileIds, folderIds };
}
