/**
 * Note Linking Utilities
 * Provides @ mention parsing, rendering, and autocomplete for linking notes together
 * Similar to Obsidian's linked notes feature
 */

import { WorkspaceFile } from '../types/workspace';

// Regex to match @mentions - matches @followed by text until whitespace or end
// Supports: @note-name, @"note with spaces", @'note with spaces'
export const MENTION_REGEX = /@(?:"([^"]+)"|'([^']+)'|([^\s@\[\]<>]+))/g;

// Regex to detect when user is typing a mention (for autocomplete trigger)
export const MENTION_TYPING_REGEX = /@([^\s@\[\]<>]*)$/;

export interface NoteMention {
    fullMatch: string;      // The full @mention text (e.g., @memory-forensics)
    noteName: string;       // The note name without @ (e.g., memory-forensics)
    startIndex: number;     // Start position in the content
    endIndex: number;       // End position in the content
    linkedFile?: WorkspaceFile; // The linked file if found
}

export interface MentionSuggestion {
    file: WorkspaceFile;
    displayName: string;    // Name to show in autocomplete
    matchScore: number;     // How well it matches the query (higher = better)
}

/**
 * Parse all @mentions from content
 */
export function parseMentions(content: string, workspaceFiles: WorkspaceFile[]): NoteMention[] {
    const mentions: NoteMention[] = [];
    let match;

    // Reset regex lastIndex
    MENTION_REGEX.lastIndex = 0;

    while ((match = MENTION_REGEX.exec(content)) !== null) {
        // Get the note name from whichever capture group matched
        const noteName = match[1] || match[2] || match[3];

        // Find the linked file (case-insensitive match)
        const linkedFile = workspaceFiles.find(
            f => f.name.toLowerCase() === noteName.toLowerCase()
        );

        mentions.push({
            fullMatch: match[0],
            noteName,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            linkedFile,
        });
    }

    return mentions;
}


/**
 * Get autocomplete suggestions for a partial mention query
 */
export function getMentionSuggestions(
    query: string,
    workspaceFiles: WorkspaceFile[],
    currentFileId?: string,
    maxResults: number = 8
): MentionSuggestion[] {
    const normalizedQuery = query.toLowerCase().trim();

    // Filter to all file types, excluding current file
    const eligibleFiles = workspaceFiles.filter(
        f => f.id !== currentFileId
    );

    if (!normalizedQuery) {
        // No query - return most recently updated files
        return eligibleFiles
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, maxResults)
            .map(file => ({
                file,
                displayName: file.name,
                matchScore: 1,
            }));
    }

    // Score and filter files based on query match
    const scored = eligibleFiles
        .map(file => {
            const name = file.name.toLowerCase();
            let score = 0;

            // Exact match
            if (name === normalizedQuery) {
                score = 100;
            }
            // Starts with query
            else if (name.startsWith(normalizedQuery)) {
                score = 80 + (normalizedQuery.length / name.length) * 10;
            }
            // Contains query
            else if (name.includes(normalizedQuery)) {
                score = 50 + (normalizedQuery.length / name.length) * 10;
            }
            // Fuzzy match - check if all query chars appear in order
            else {
                let queryIdx = 0;
                for (let i = 0; i < name.length && queryIdx < normalizedQuery.length; i++) {
                    if (name[i] === normalizedQuery[queryIdx]) {
                        queryIdx++;
                    }
                }
                if (queryIdx === normalizedQuery.length) {
                    score = 20 + (normalizedQuery.length / name.length) * 10;
                }
            }

            return { file, displayName: file.name, matchScore: score };
        })
        .filter(item => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, maxResults);

    return scored;
}

/**
 * Render @mentions in content as highlighted HTML spans
 * Returns HTML string with mentions wrapped in clickable spans
 */
export function renderMentionsAsHtml(
    content: string,
    workspaceFiles: WorkspaceFile[],
    accentColor: string = '#3b82f6'
): string {
    const mentions = parseMentions(content, workspaceFiles);

    if (mentions.length === 0) {
        return content;
    }

    let result = '';
    let lastIndex = 0;

    for (const mention of mentions) {
        // Add text before this mention
        result += content.substring(lastIndex, mention.startIndex);

        // Add the mention as a highlighted span
        const isValid = !!mention.linkedFile;
        const fileId = mention.linkedFile?.id || '';

        if (isValid) {
            result += `<span class="note-mention note-mention-valid" data-note-id="${fileId}" data-note-name="${mention.noteName}" style="color: ${accentColor}; cursor: pointer; font-weight: 500; background: ${accentColor}15; padding: 0 4px; border-radius: 3px; text-decoration: none;">${mention.fullMatch}</span>`;
        } else {
            result += `<span class="note-mention note-mention-invalid" data-note-name="${mention.noteName}" style="color: #9ca3af; cursor: default; font-style: italic; text-decoration: line-through;">${mention.fullMatch}</span>`;
        }

        lastIndex = mention.endIndex;
    }

    // Add remaining text
    result += content.substring(lastIndex);

    return result;
}

/**
 * Insert a mention at the cursor position, replacing any partial mention
 */
export function insertMention(
    content: string,
    cursorPosition: number,
    noteName: string
): { newContent: string; newCursorPosition: number } {
    // Find if we're in the middle of typing a mention
    const beforeCursor = content.substring(0, cursorPosition);
    const match = beforeCursor.match(MENTION_TYPING_REGEX);

    let startPos: number;
    if (match) {
        // Replace the partial mention
        startPos = cursorPosition - match[0].length;
    } else {
        // Insert at cursor
        startPos = cursorPosition;
    }

    // Format the mention - use quotes if name contains spaces
    const formattedMention = noteName.includes(' ')
        ? `@"${noteName}"`
        : `@${noteName}`;

    const newContent =
        content.substring(0, startPos) +
        formattedMention + ' ' +
        content.substring(cursorPosition);

    const newCursorPosition = startPos + formattedMention.length + 1;

    return { newContent, newCursorPosition };
}

/**
 * Check if cursor is currently in a position where mention autocomplete should show
 */
export function shouldShowMentionAutocomplete(
    content: string,
    cursorPosition: number
): { show: boolean; query: string; startPosition: number } {
    const beforeCursor = content.substring(0, cursorPosition);
    const match = beforeCursor.match(MENTION_TYPING_REGEX);

    if (match) {
        return {
            show: true,
            query: match[1] || '',
            startPosition: cursorPosition - match[0].length,
        };
    }

    return { show: false, query: '', startPosition: 0 };
}
