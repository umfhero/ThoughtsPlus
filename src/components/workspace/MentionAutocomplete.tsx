/**
 * MentionAutocomplete Component
 * Dropdown for selecting files when typing @ mentions
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode, PenTool, FileText, Link } from 'lucide-react';
import { MentionSuggestion } from '../../utils/noteLinking';
import { useTheme } from '../../contexts/ThemeContext';
import { FileType } from '../../types/workspace';
import clsx from 'clsx';

// Get icon for file type
const getFileIcon = (type: FileType) => {
    switch (type) {
        case 'exec': return FileCode;
        case 'board': return PenTool;
        case 'note': return FileText;
        default: return FileCode;
    }
};

// Get label for file type
const getFileTypeLabel = (type: FileType) => {
    switch (type) {
        case 'exec': return 'Notebook';
        case 'board': return 'Board';
        case 'note': return 'Note';
        default: return 'File';
    }
};

interface MentionAutocompleteProps {
    isOpen: boolean;
    suggestions: MentionSuggestion[];
    selectedIndex: number;
    position: { top: number; left: number };
    onSelect: (suggestion: MentionSuggestion) => void;
    onClose: () => void;
    onNavigate: (direction: 'up' | 'down') => void;
}

export function MentionAutocomplete({
    isOpen,
    suggestions,
    selectedIndex,
    position,
    onSelect,
    onClose,
    onNavigate: _onNavigate,
}: MentionAutocompleteProps) {
    const { accentColor } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<HTMLButtonElement>(null);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedRef.current && containerRef.current) {
            selectedRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        }
    }, [selectedIndex]);

    // Handle click outside to close
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen || suggestions.length === 0) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={clsx(
                    "absolute z-50 w-72 max-h-64 overflow-y-auto",
                    "bg-white dark:bg-gray-800 rounded-lg shadow-lg",
                    "border border-gray-200 dark:border-gray-700"
                )}
                style={{
                    top: position.top,
                    left: position.left,
                }}
            >
                <div className="p-1">
                    <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Link className="w-3 h-3" />
                        Link to file
                    </div>
                    {suggestions.map((suggestion, index) => {
                        const Icon = getFileIcon(suggestion.file.type);
                        const typeLabel = getFileTypeLabel(suggestion.file.type);

                        return (
                            <button
                                key={suggestion.file.id}
                                ref={index === selectedIndex ? selectedRef : null}
                                onClick={() => onSelect(suggestion)}
                                className={clsx(
                                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                                    "transition-colors duration-100",
                                    index === selectedIndex
                                        ? "bg-gray-100 dark:bg-gray-700"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                )}
                                style={index === selectedIndex ? {
                                    backgroundColor: `${accentColor}15`,
                                } : undefined}
                            >
                                <Icon
                                    className="w-4 h-4 flex-shrink-0"
                                    style={{ color: accentColor }}
                                />
                                <span className="truncate text-sm text-gray-700 dark:text-gray-200 flex-1">
                                    {suggestion.displayName}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {typeLabel}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
