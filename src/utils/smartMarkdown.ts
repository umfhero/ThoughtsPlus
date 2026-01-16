/**
 * Smart Markdown Editing Utilities
 * Provides intuitive shortcuts and auto-formatting for markdown cells
 */

export interface TextareaSelection {
    start: number;
    end: number;
    text: string;
}

export interface SmartMarkdownResult {
    newContent: string;
    newCursorStart: number;
    newCursorEnd: number;
}

/**
 * Get current selection info from textarea
 */
export function getSelection(textarea: HTMLTextAreaElement): TextareaSelection {
    return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
        text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    };
}

/**
 * Get the current line info
 */
export function getCurrentLine(content: string, cursorPos: number): {
    lineStart: number;
    lineEnd: number;
    lineContent: string;
    lineNumber: number;
} {
    const beforeCursor = content.substring(0, cursorPos);
    const afterCursor = content.substring(cursorPos);

    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineEndOffset = afterCursor.indexOf('\n');
    const lineEnd = lineEndOffset === -1 ? content.length : cursorPos + lineEndOffset;
    const lineContent = content.substring(lineStart, lineEnd);
    const lineNumber = beforeCursor.split('\n').length - 1;

    return { lineStart, lineEnd, lineContent, lineNumber };
}

/**
 * Check if text is wrapped with a pattern (e.g., **bold**)
 */
function isWrappedWith(text: string, wrapper: string): boolean {
    return text.startsWith(wrapper) && text.endsWith(wrapper) && text.length > wrapper.length * 2;
}

/**
 * Unwrap text from a pattern
 */
function unwrap(text: string, wrapper: string): string {
    return text.substring(wrapper.length, text.length - wrapper.length);
}

/**
 * Wrap text with a pattern
 */
function wrap(text: string, wrapper: string): string {
    return `${wrapper}${text}${wrapper}`;
}

/**
 * Toggle bold formatting (Ctrl+B)
 * - Plain text → **bold**
 * - **bold** → ## heading
 * - ## heading → ### heading (up to ######)
 * - ###### heading → plain text
 */
export function toggleBold(content: string, selection: TextareaSelection): SmartMarkdownResult {
    const { start, end, text } = selection;
    const { lineStart, lineEnd, lineContent } = getCurrentLine(content, start);

    // If there's a selection
    if (text.length > 0) {
        // Check if selection is already bold
        if (isWrappedWith(text, '**')) {
            // Convert to heading
            const unwrapped = unwrap(text, '**');
            const newText = `## ${unwrapped}`;
            return {
                newContent: content.substring(0, start) + newText + content.substring(end),
                newCursorStart: start,
                newCursorEnd: start + newText.length
            };
        }

        // Check if it's a heading - increase level
        const headingMatch = text.match(/^(#{1,5})\s+(.+)$/);
        if (headingMatch) {
            const currentLevel = headingMatch[1].length;
            if (currentLevel < 6) {
                const newText = `${'#'.repeat(currentLevel + 1)} ${headingMatch[2]}`;
                return {
                    newContent: content.substring(0, start) + newText + content.substring(end),
                    newCursorStart: start,
                    newCursorEnd: start + newText.length
                };
            } else {
                // Max heading level reached, convert back to plain text
                const newText = headingMatch[2];
                return {
                    newContent: content.substring(0, start) + newText + content.substring(end),
                    newCursorStart: start,
                    newCursorEnd: start + newText.length
                };
            }
        }

        // Plain text - make bold
        const newText = wrap(text, '**');
        return {
            newContent: content.substring(0, start) + newText + content.substring(end),
            newCursorStart: start,
            newCursorEnd: start + newText.length
        };
    }

    // No selection - check current line for heading
    const lineHeadingMatch = lineContent.match(/^(#{1,6})\s+(.+)$/);
    if (lineHeadingMatch) {
        const currentLevel = lineHeadingMatch[1].length;
        if (currentLevel < 6) {
            const newLine = `${'#'.repeat(currentLevel + 1)} ${lineHeadingMatch[2]}`;
            return {
                newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
                newCursorStart: start + 1,
                newCursorEnd: start + 1
            };
        } else {
            // Remove heading
            const newLine = lineHeadingMatch[2];
            return {
                newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
                newCursorStart: lineStart + newLine.length,
                newCursorEnd: lineStart + newLine.length
            };
        }
    }

    // Insert bold markers at cursor
    const newContent = content.substring(0, start) + '****' + content.substring(end);
    return {
        newContent,
        newCursorStart: start + 2,
        newCursorEnd: start + 2
    };
}

/**
 * Toggle italic formatting (Ctrl+I)
 */
export function toggleItalic(content: string, selection: TextareaSelection): SmartMarkdownResult {
    const { start, end, text } = selection;

    if (text.length > 0) {
        // Check if already italic (but not bold)
        if (isWrappedWith(text, '*') && !isWrappedWith(text, '**')) {
            const newText = unwrap(text, '*');
            return {
                newContent: content.substring(0, start) + newText + content.substring(end),
                newCursorStart: start,
                newCursorEnd: start + newText.length
            };
        }

        // Make italic
        const newText = wrap(text, '*');
        return {
            newContent: content.substring(0, start) + newText + content.substring(end),
            newCursorStart: start,
            newCursorEnd: start + newText.length
        };
    }

    // Insert italic markers at cursor
    const newContent = content.substring(0, start) + '**' + content.substring(end);
    return {
        newContent,
        newCursorStart: start + 1,
        newCursorEnd: start + 1
    };
}

/**
 * Toggle strikethrough (Ctrl+Shift+S)
 */
export function toggleStrikethrough(content: string, selection: TextareaSelection): SmartMarkdownResult {
    const { start, end, text } = selection;

    if (text.length > 0) {
        if (isWrappedWith(text, '~~')) {
            const newText = unwrap(text, '~~');
            return {
                newContent: content.substring(0, start) + newText + content.substring(end),
                newCursorStart: start,
                newCursorEnd: start + newText.length
            };
        }

        const newText = wrap(text, '~~');
        return {
            newContent: content.substring(0, start) + newText + content.substring(end),
            newCursorStart: start,
            newCursorEnd: start + newText.length
        };
    }

    const newContent = content.substring(0, start) + '~~~~' + content.substring(end);
    return {
        newContent,
        newCursorStart: start + 2,
        newCursorEnd: start + 2
    };
}

/**
 * Toggle inline code (Ctrl+`)
 */
export function toggleInlineCode(content: string, selection: TextareaSelection): SmartMarkdownResult {
    const { start, end, text } = selection;

    if (text.length > 0) {
        if (isWrappedWith(text, '`')) {
            const newText = unwrap(text, '`');
            return {
                newContent: content.substring(0, start) + newText + content.substring(end),
                newCursorStart: start,
                newCursorEnd: start + newText.length
            };
        }

        const newText = wrap(text, '`');
        return {
            newContent: content.substring(0, start) + newText + content.substring(end),
            newCursorStart: start,
            newCursorEnd: start + newText.length
        };
    }

    const newContent = content.substring(0, start) + '``' + content.substring(end);
    return {
        newContent,
        newCursorStart: start + 1,
        newCursorEnd: start + 1
    };
}


/**
 * Handle Enter key for smart list continuation
 * Returns null if no special handling needed
 */
export function handleEnterKey(content: string, cursorPos: number): SmartMarkdownResult | null {
    const { lineStart, lineContent } = getCurrentLine(content, cursorPos);

    // Check for checkbox list FIRST (- [ ] item, - [x] item) - must be before unordered list
    const checkboxMatch = lineContent.match(/^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/);
    if (checkboxMatch) {
        const [, indent, bullet, , text] = checkboxMatch;

        // If line is empty (just the checkbox), remove it
        if (text.trim() === '') {
            const newContent = content.substring(0, lineStart) + content.substring(lineStart + lineContent.length);
            return {
                newContent,
                newCursorStart: lineStart,
                newCursorEnd: lineStart
            };
        }

        // Continue with unchecked checkbox
        const newLine = `\n${indent}${bullet} [ ] `;
        const newContent = content.substring(0, cursorPos) + newLine + content.substring(cursorPos);
        return {
            newContent,
            newCursorStart: cursorPos + newLine.length,
            newCursorEnd: cursorPos + newLine.length
        };
    }

    // Check for unordered list (- item, * item, + item)
    const unorderedMatch = lineContent.match(/^(\s*)([-*+])\s+(.*)$/);
    if (unorderedMatch) {
        const [, indent, bullet, text] = unorderedMatch;

        // If line is empty (just the bullet), remove it and continue without list
        if (text.trim() === '') {
            const newContent = content.substring(0, lineStart) + content.substring(lineStart + lineContent.length);
            return {
                newContent,
                newCursorStart: lineStart,
                newCursorEnd: lineStart
            };
        }

        // Continue the list
        const newLine = `\n${indent}${bullet} `;
        const newContent = content.substring(0, cursorPos) + newLine + content.substring(cursorPos);
        return {
            newContent,
            newCursorStart: cursorPos + newLine.length,
            newCursorEnd: cursorPos + newLine.length
        };
    }

    // Check for ordered list (1. item, 2. item, etc.)
    const orderedMatch = lineContent.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
        const [, indent, num, text] = orderedMatch;

        // If line is empty, remove it
        if (text.trim() === '') {
            const newContent = content.substring(0, lineStart) + content.substring(lineStart + lineContent.length);
            return {
                newContent,
                newCursorStart: lineStart,
                newCursorEnd: lineStart
            };
        }

        // Continue with next number
        const nextNum = parseInt(num) + 1;
        const newLine = `\n${indent}${nextNum}. `;
        const newContent = content.substring(0, cursorPos) + newLine + content.substring(cursorPos);
        return {
            newContent,
            newCursorStart: cursorPos + newLine.length,
            newCursorEnd: cursorPos + newLine.length
        };
    }

    // Check for blockquote (> text)
    const blockquoteMatch = lineContent.match(/^(\s*)(>+)\s*(.*)$/);
    if (blockquoteMatch) {
        const [, indent, quotes, text] = blockquoteMatch;

        // If line is empty, remove blockquote
        if (text.trim() === '') {
            const newContent = content.substring(0, lineStart) + content.substring(lineStart + lineContent.length);
            return {
                newContent,
                newCursorStart: lineStart,
                newCursorEnd: lineStart
            };
        }

        // Continue blockquote
        const newLine = `\n${indent}${quotes} `;
        const newContent = content.substring(0, cursorPos) + newLine + content.substring(cursorPos);
        return {
            newContent,
            newCursorStart: cursorPos + newLine.length,
            newCursorEnd: cursorPos + newLine.length
        };
    }

    return null; // No special handling
}

/**
 * Handle Tab key for list indentation
 */
export function handleTabKey(content: string, cursorPos: number, shiftKey: boolean): SmartMarkdownResult | null {
    const { lineStart, lineEnd, lineContent } = getCurrentLine(content, cursorPos);

    // Check if we're in a list
    const listMatch = lineContent.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (!listMatch) return null;

    if (shiftKey) {
        // Outdent - remove up to 2 spaces from start
        const spacesToRemove = lineContent.match(/^(\s{1,2})/);
        if (spacesToRemove) {
            const newLine = lineContent.substring(spacesToRemove[1].length);
            const removedLength = spacesToRemove[1].length;
            return {
                newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
                newCursorStart: Math.max(lineStart, cursorPos - removedLength),
                newCursorEnd: Math.max(lineStart, cursorPos - removedLength)
            };
        }
    } else {
        // Indent - add 2 spaces
        const newLine = '  ' + lineContent;
        return {
            newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
            newCursorStart: cursorPos + 2,
            newCursorEnd: cursorPos + 2
        };
    }

    return null;
}

/**
 * Insert a link (Ctrl+K)
 */
export function insertLink(content: string, selection: TextareaSelection): SmartMarkdownResult {
    const { start, end, text } = selection;

    if (text.length > 0) {
        // Wrap selection as link text
        const newText = `[${text}](url)`;
        return {
            newContent: content.substring(0, start) + newText + content.substring(end),
            newCursorStart: start + text.length + 3, // Position at "url"
            newCursorEnd: start + text.length + 6
        };
    }

    // Insert empty link
    const newText = '[link text](url)';
    return {
        newContent: content.substring(0, start) + newText + content.substring(end),
        newCursorStart: start + 1, // Position at "link text"
        newCursorEnd: start + 10
    };
}

/**
 * Insert checkbox
 */
export function insertCheckbox(content: string, cursorPos: number): SmartMarkdownResult {
    const { lineStart, lineContent } = getCurrentLine(content, cursorPos);

    // If line already has content, add checkbox at start
    if (lineContent.trim().length > 0) {
        // Check if already a checkbox
        if (lineContent.match(/^(\s*)[-*+]\s+\[[ x]\]/)) {
            return { newContent: content, newCursorStart: cursorPos, newCursorEnd: cursorPos };
        }

        // Check if it's a list item, convert to checkbox
        const listMatch = lineContent.match(/^(\s*)([-*+])\s+(.*)$/);
        if (listMatch) {
            const [, indent, bullet, text] = listMatch;
            const newLine = `${indent}${bullet} [ ] ${text}`;
            return {
                newContent: content.substring(0, lineStart) + newLine + content.substring(lineStart + lineContent.length),
                newCursorStart: cursorPos + 4, // Account for "[ ] "
                newCursorEnd: cursorPos + 4
            };
        }

        // Add checkbox before content
        const newLine = `- [ ] ${lineContent}`;
        return {
            newContent: content.substring(0, lineStart) + newLine + content.substring(lineStart + lineContent.length),
            newCursorStart: cursorPos + 6,
            newCursorEnd: cursorPos + 6
        };
    }

    // Empty line - insert checkbox
    const newText = '- [ ] ';
    return {
        newContent: content.substring(0, cursorPos) + newText + content.substring(cursorPos),
        newCursorStart: cursorPos + newText.length,
        newCursorEnd: cursorPos + newText.length
    };
}

/**
 * Insert unordered list
 */
export function insertList(content: string, cursorPos: number): SmartMarkdownResult {
    const { lineStart, lineContent } = getCurrentLine(content, cursorPos);

    if (lineContent.trim().length > 0) {
        // Check if already a list
        if (lineContent.match(/^(\s*)[-*+]\s/)) {
            return { newContent: content, newCursorStart: cursorPos, newCursorEnd: cursorPos };
        }

        const newLine = `- ${lineContent}`;
        return {
            newContent: content.substring(0, lineStart) + newLine + content.substring(lineStart + lineContent.length),
            newCursorStart: cursorPos + 2,
            newCursorEnd: cursorPos + 2
        };
    }

    const newText = '- ';
    return {
        newContent: content.substring(0, cursorPos) + newText + content.substring(cursorPos),
        newCursorStart: cursorPos + newText.length,
        newCursorEnd: cursorPos + newText.length
    };
}

/**
 * Insert numbered list
 */
export function insertNumberedList(content: string, cursorPos: number): SmartMarkdownResult {
    const { lineStart, lineContent } = getCurrentLine(content, cursorPos);

    if (lineContent.trim().length > 0) {
        if (lineContent.match(/^(\s*)\d+\.\s/)) {
            return { newContent: content, newCursorStart: cursorPos, newCursorEnd: cursorPos };
        }

        const newLine = `1. ${lineContent}`;
        return {
            newContent: content.substring(0, lineStart) + newLine + content.substring(lineStart + lineContent.length),
            newCursorStart: cursorPos + 3,
            newCursorEnd: cursorPos + 3
        };
    }

    const newText = '1. ';
    return {
        newContent: content.substring(0, cursorPos) + newText + content.substring(cursorPos),
        newCursorStart: cursorPos + newText.length,
        newCursorEnd: cursorPos + newText.length
    };
}

/**
 * Insert code block
 */
export function insertCodeBlock(content: string, selection: TextareaSelection): SmartMarkdownResult {
    const { start, end, text } = selection;

    if (text.length > 0) {
        const newText = `\`\`\`\n${text}\n\`\`\``;
        return {
            newContent: content.substring(0, start) + newText + content.substring(end),
            newCursorStart: start + 4, // After opening ```\n
            newCursorEnd: start + 4 + text.length
        };
    }

    const newText = '```\n\n```';
    return {
        newContent: content.substring(0, start) + newText + content.substring(end),
        newCursorStart: start + 4, // Position inside code block
        newCursorEnd: start + 4
    };
}

/**
 * Insert horizontal rule
 */
export function insertHorizontalRule(content: string, cursorPos: number): SmartMarkdownResult {
    const { lineStart, lineContent } = getCurrentLine(content, cursorPos);

    // If on empty line, just insert
    if (lineContent.trim() === '') {
        const newText = '---\n';
        return {
            newContent: content.substring(0, lineStart) + newText + content.substring(lineStart + lineContent.length),
            newCursorStart: lineStart + newText.length,
            newCursorEnd: lineStart + newText.length
        };
    }

    // Insert after current line
    const lineEnd = lineStart + lineContent.length;
    const newText = '\n\n---\n';
    return {
        newContent: content.substring(0, lineEnd) + newText + content.substring(lineEnd),
        newCursorStart: lineEnd + newText.length,
        newCursorEnd: lineEnd + newText.length
    };
}

/**
 * Insert blockquote
 */
export function insertBlockquote(content: string, selection: TextareaSelection): SmartMarkdownResult {
    const { start, end, text } = selection;
    const { lineStart, lineContent } = getCurrentLine(content, start);

    if (text.length > 0) {
        // Quote each line of selection
        const lines = text.split('\n');
        const quotedLines = lines.map(line => `> ${line}`).join('\n');
        return {
            newContent: content.substring(0, start) + quotedLines + content.substring(end),
            newCursorStart: start,
            newCursorEnd: start + quotedLines.length
        };
    }

    if (lineContent.trim().length > 0) {
        // Quote current line
        const newLine = `> ${lineContent}`;
        const lineEnd = lineStart + lineContent.length;
        return {
            newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
            newCursorStart: start + 2,
            newCursorEnd: start + 2
        };
    }

    const newText = '> ';
    return {
        newContent: content.substring(0, start) + newText + content.substring(end),
        newCursorStart: start + newText.length,
        newCursorEnd: start + newText.length
    };
}

// Context menu action types
export type ContextMenuAction =
    | 'bold'
    | 'italic'
    | 'strikethrough'
    | 'code'
    | 'link'
    | 'checkbox'
    | 'list'
    | 'numbered-list'
    | 'code-block'
    | 'blockquote'
    | 'horizontal-rule'
    | 'heading-1'
    | 'heading-2'
    | 'heading-3';

/**
 * Execute a context menu action
 */
export function executeContextMenuAction(
    action: ContextMenuAction,
    content: string,
    selection: TextareaSelection
): SmartMarkdownResult {
    const { start } = selection;
    const { lineStart, lineEnd, lineContent } = getCurrentLine(content, start);

    switch (action) {
        case 'bold':
            return toggleBold(content, selection);
        case 'italic':
            return toggleItalic(content, selection);
        case 'strikethrough':
            return toggleStrikethrough(content, selection);
        case 'code':
            return toggleInlineCode(content, selection);
        case 'link':
            return insertLink(content, selection);
        case 'checkbox':
            return insertCheckbox(content, start);
        case 'list':
            return insertList(content, start);
        case 'numbered-list':
            return insertNumberedList(content, start);
        case 'code-block':
            return insertCodeBlock(content, selection);
        case 'blockquote':
            return insertBlockquote(content, selection);
        case 'horizontal-rule':
            return insertHorizontalRule(content, start);
        case 'heading-1': {
            const newLine = `# ${lineContent.replace(/^#+\s*/, '')}`;
            return {
                newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
                newCursorStart: lineStart + newLine.length,
                newCursorEnd: lineStart + newLine.length
            };
        }
        case 'heading-2': {
            const newLine = `## ${lineContent.replace(/^#+\s*/, '')}`;
            return {
                newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
                newCursorStart: lineStart + newLine.length,
                newCursorEnd: lineStart + newLine.length
            };
        }
        case 'heading-3': {
            const newLine = `### ${lineContent.replace(/^#+\s*/, '')}`;
            return {
                newContent: content.substring(0, lineStart) + newLine + content.substring(lineEnd),
                newCursorStart: lineStart + newLine.length,
                newCursorEnd: lineStart + newLine.length
            };
        }
        default:
            return { newContent: content, newCursorStart: start, newCursorEnd: selection.end };
    }
}
