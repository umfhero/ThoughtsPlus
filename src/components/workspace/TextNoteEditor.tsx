import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface TextNoteEditorProps {
    content: string;
    onChange: (content: string) => void;
    autoSaveDelay?: number;
}

/**
 * TextNoteEditor component provides a simple textarea-based editor for .note files.
 * Features auto-save on content change with debounce.
 * 
 * Requirements: 8.3
 */
export function TextNoteEditor({
    content,
    onChange,
    autoSaveDelay = 500,
}: TextNoteEditorProps) {
    const [localContent, setLocalContent] = useState(content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync local content when prop changes (e.g., switching files)
    useEffect(() => {
        setLocalContent(content);
    }, [content]);

    // Auto-resize textarea to fit content
    const autoResize = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.max(textarea.scrollHeight, 200)}px`;
        }
    }, []);

    // Resize on content change
    useEffect(() => {
        autoResize();
    }, [localContent, autoResize]);

    // Resize on window resize
    useEffect(() => {
        window.addEventListener('resize', autoResize);
        return () => window.removeEventListener('resize', autoResize);
    }, [autoResize]);

    // Handle content change with debounced auto-save
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setLocalContent(newContent);

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(() => {
            onChange(newContent);
        }, autoSaveDelay);
    }, [onChange, autoSaveDelay]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Save immediately on blur
    const handleBlur = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        if (localContent !== content) {
            onChange(localContent);
        }
    }, [localContent, content, onChange]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col"
        >
            <textarea
                ref={textareaRef}
                value={localContent}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Start typing your note..."
                className={clsx(
                    'flex-1 w-full p-6 resize-none',
                    'bg-transparent',
                    'text-gray-800 dark:text-gray-200',
                    'placeholder-gray-400 dark:placeholder-gray-500',
                    'focus:outline-none',
                    'font-mono text-sm leading-relaxed',
                    'min-h-[200px]'
                )}
                spellCheck
            />
        </motion.div>
    );
}

export default TextNoteEditor;
