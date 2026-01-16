import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bold, Italic, Strikethrough, Code, Link, CheckSquare,
    List, ListOrdered, Quote, Minus, Heading1, Heading2, Heading3,
    FileCode
} from 'lucide-react';
import { ContextMenuAction } from '../utils/smartMarkdown';
import clsx from 'clsx';

interface MarkdownContextMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    onClose: () => void;
    onAction: (action: ContextMenuAction) => void;
}

interface MenuItem {
    action: ContextMenuAction;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    shortcut?: string;
    dividerAfter?: boolean;
}

const menuItems: MenuItem[] = [
    { action: 'bold', label: 'Bold', icon: Bold, shortcut: 'Ctrl+B' },
    { action: 'italic', label: 'Italic', icon: Italic, shortcut: 'Ctrl+I' },
    { action: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, shortcut: 'Ctrl+Shift+S' },
    { action: 'code', label: 'Inline Code', icon: Code, shortcut: 'Ctrl+`', dividerAfter: true },
    { action: 'heading-1', label: 'Heading 1', icon: Heading1 },
    { action: 'heading-2', label: 'Heading 2', icon: Heading2 },
    { action: 'heading-3', label: 'Heading 3', icon: Heading3, dividerAfter: true },
    { action: 'list', label: 'Bullet List', icon: List },
    { action: 'numbered-list', label: 'Numbered List', icon: ListOrdered },
    { action: 'checkbox', label: 'Checkbox', icon: CheckSquare, dividerAfter: true },
    { action: 'link', label: 'Link', icon: Link, shortcut: 'Ctrl+K' },
    { action: 'blockquote', label: 'Quote', icon: Quote },
    { action: 'code-block', label: 'Code Block', icon: FileCode },
    { action: 'horizontal-rule', label: 'Divider', icon: Minus },
];

export function MarkdownContextMenu({ isOpen, position, onClose, onAction }: MarkdownContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Adjust position to stay within viewport
    const adjustedPosition = { ...position };
    if (typeof window !== 'undefined' && isOpen) {
        const menuWidth = 200;
        const menuHeight = 420; // Approximate height of menu
        const padding = 10;

        // Adjust horizontal position
        if (position.x + menuWidth > window.innerWidth - padding) {
            adjustedPosition.x = Math.max(padding, window.innerWidth - menuWidth - padding);
        }
        if (position.x < padding) {
            adjustedPosition.x = padding;
        }

        // Adjust vertical position - if menu would go below viewport, show it above the click point
        if (position.y + menuHeight > window.innerHeight - padding) {
            adjustedPosition.y = Math.max(padding, position.y - menuHeight);
        }
        if (adjustedPosition.y < padding) {
            adjustedPosition.y = padding;
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px] max-h-[calc(100vh-20px)] overflow-y-auto"
                    style={{
                        left: adjustedPosition.x,
                        top: adjustedPosition.y,
                    }}
                >
                    {menuItems.map((item) => (
                        <div key={item.action}>
                            <button
                                onClick={() => {
                                    onAction(item.action);
                                    onClose();
                                }}
                                className={clsx(
                                    "w-full px-3 py-1.5 flex items-center gap-2 text-sm text-left",
                                    "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                                    "text-gray-700 dark:text-gray-300"
                                )}
                            >
                                <item.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="flex-1">{item.label}</span>
                                {item.shortcut && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {item.shortcut}
                                    </span>
                                )}
                            </button>
                            {item.dividerAfter && (
                                <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                            )}
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
