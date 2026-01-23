import { motion } from 'framer-motion';
import { X, Zap, BookOpen, Code, Calendar, Layout, Clock, Sparkles, Keyboard, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

interface TextGuideProps {
    onClose: () => void;
}

interface GuideSection {
    id: string;
    title: string;
    icon: any;
    content: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
    {
        id: 'quick-capture',
        title: 'Quick Capture',
        icon: Zap,
        content: [
            '• Press Ctrl+Shift+N from anywhere to open Quick Capture',
            '• Type your thought and press Enter or ESC to save and close instantly',
            '• Notes are automatically saved to "Quick Notes" folder in Workspace',
            '• Works even when ThoughtsPlus is minimized',
            '',
            'Note: Quick notes are a buffer for capturing thoughts quickly. They\'re not meant for writing in - come back later to polish and move them into proper note structures like .exec files, boards, or other organized notes.'
        ]
    },
    {
        id: 'workspace',
        title: 'Workspace',
        icon: BookOpen,
        content: [
            '• Navigate files using the tree on the left',
            '• Click "+" to create new note structures',
            '',
            'Note Structures (each has a different purpose):',
            '• Text Notes (.md) - Standard markdown notes for writing',
            '• Nerdbooks (.nerdbook) - Execute Python/JavaScript code in notes',
            '• Boards (.nbm) - Visual canvas with sticky notes and drawings',
            '• Exec Files (.exec) - Structured notes with markdown and code cells',
            '',
            '• Type @ to link to other notes',
            '• Use the graph view to visualize connections',
            '• All files are stored as plain text on your hard drive',
            '• Supports folders for organization'
        ]
    },
    {
        id: 'nerdbook',
        title: 'Nerdbooks (.nerdbook) - Code Execution',
        icon: Code,
        content: [
            'Structure Type: .nerdbook',
            '',
            '• Create a .nerdbook file in Workspace',
            '• Add code cells with Python or JavaScript',
            '• Click "Run" or press Ctrl+Enter to execute',
            '• Results appear below each cell',
            '• Mix code and markdown for documentation',
            '',
            'Why use Nerdbooks:',
            '• Perfect for experiments and prototyping',
            '• Create interactive tutorials',
            '• Data analysis and visualization',
            '• Test code snippets quickly',
            '• Document your code with explanations'
        ]
    },
    {
        id: 'calendar',
        title: 'Calendar',
        icon: Calendar,
        content: [
            '• Press Ctrl+M for quick add with natural language',
            '• Type "meeting with John next Tuesday at 3pm"',
            '• Create recurring events: "daily at 9am" or "every Monday"',
            '• Track late completions to improve time management',
            '• Import events from .ics files',
            '• All events stored locally'
        ]
    },
    {
        id: 'board',
        title: 'Visual Boards (.nbm)',
        icon: Layout,
        content: [
            'Structure Type: .nbm',
            '',
            '• Create .nbm files for infinite canvas boards',
            '• Double-click to add sticky notes',
            '• Drag notes to organize visually',
            '• Use drawing tools for diagrams',
            '• Change colors to categorize ideas',
            '',
            'Why use Boards:',
            '• Perfect for brainstorming sessions',
            '• Visual project planning',
            '• Mind mapping and idea organization',
            '• Sketching workflows and diagrams',
            '• Non-linear thinking and exploration'
        ]
    },
    {
        id: 'timer',
        title: 'Focus Timer',
        icon: Clock,
        content: [
            '• Press Ctrl+Shift+T for quick timer',
            '• Type numbers like a microwave: "25" = 25 min, "130" = 1h 30m',
            '• Timer runs in background even when minimized',
            '• View session history to track productivity',
            '• Get notifications when timer completes',
            '• Perfect for Pomodoro technique'
        ]
    },
    {
        id: 'ai-features',
        title: 'AI Features',
        icon: Sparkles,
        content: [
            '• Go to Settings > AI Configuration',
            '• Add Gemini, OpenAI, or Perplexity API key',
            '• Dashboard shows AI-generated summary of events',
            '• Generate note structures and outlines',
            '• Create flashcards from selected text',
            '• Optional - app works fully without AI'
        ]
    },
    {
        id: 'shortcuts',
        title: 'Keyboard Shortcuts',
        icon: Keyboard,
        content: [
            '• Ctrl+Shift+N - Quick Capture',
            '• Ctrl+Shift+T - Quick Timer',
            '• Ctrl+M - Calendar Quick Add',
            '• Ctrl+P - Quick Search',
            '• Ctrl+/ - View All Shortcuts',
            '• Ctrl+Enter - Run code cell (in Nerdbooks)',
            '• ESC - Close overlays'
        ]
    }
];

export function TextGuide({ onClose }: TextGuideProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['quick-capture']));

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const expandAll = () => {
        setExpandedSections(new Set(GUIDE_SECTIONS.map(s => s.id)));
    };

    const collapseAll = () => {
        setExpandedSections(new Set());
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-gray-200 dark:border-gray-700"
            >
                {/* Header */}
                <div className="bg-gray-50 dark:bg-gray-900 p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                                <BookOpen className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Text Guide</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                        Quick reference for all ThoughtsPlus features
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={expandAll}
                            className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium transition-colors"
                        >
                            Expand All
                        </button>
                        <button
                            onClick={collapseAll}
                            className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium transition-colors"
                        >
                            Collapse All
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)] space-y-3">
                    {GUIDE_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const isExpanded = expandedSections.has(section.id);

                        return (
                            <div
                                key={section.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                            >
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700">
                                            <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-gray-100">
                                            {section.title}
                                        </h3>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                    )}
                                </button>

                                <motion.div
                                    initial={false}
                                    animate={{
                                        height: isExpanded ? 'auto' : 0,
                                        opacity: isExpanded ? 1 : 0
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 bg-white dark:bg-gray-800 space-y-2">
                                        {section.content.map((line, index) => (
                                            <p
                                                key={index}
                                                className={clsx(
                                                    "text-sm leading-relaxed",
                                                    line.startsWith('•')
                                                        ? "text-gray-700 dark:text-gray-300"
                                                        : "text-gray-600 dark:text-gray-400 font-medium"
                                                )}
                                            >
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </motion.div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                        For interactive step-by-step tutorials, use the Visual Guide option
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}
