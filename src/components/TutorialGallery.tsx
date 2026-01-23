import { motion } from 'framer-motion';
import { X, Play, BookOpen, Zap, Code, Calendar, Layout, Clock, Sparkles, Keyboard } from 'lucide-react';
import { TUTORIAL_CONFIGS, TUTORIAL_CATEGORIES } from '../utils/tutorialConfigs';
import clsx from 'clsx';

interface TutorialGalleryProps {
    onClose: () => void;
    onStartTutorial: (tutorialId: string) => void;
}

const TUTORIAL_ICONS: Record<string, any> = {
    quickCapture: Zap,
    workspace: BookOpen,
    nerdbook: Code,
    calendar: Calendar,
    board: Layout,
    timer: Clock,
    aiFeatures: Sparkles,
    shortcuts: Keyboard
};

export function TutorialGallery({ onClose, onStartTutorial }: TutorialGalleryProps) {
    const handleStartTutorial = (tutorialId: string) => {
        onClose(); // Close the gallery
        onStartTutorial(tutorialId); // Notify parent to start tutorial
    };

    const isCompleted = (tutorialId: string) => {
        const completed = JSON.parse(localStorage.getItem('completed-tutorials') || '[]');
        return completed.includes(tutorialId);
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
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-gray-200 dark:border-gray-700"
            >
                {/* Header */}
                <div className="bg-gray-50 dark:bg-gray-900 p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                                <BookOpen className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Interactive Tutorials</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                        Select a tutorial to begin an interactive walkthrough
                    </p>
                </div>

                {/* Tutorial Grid */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
                    {TUTORIAL_CATEGORIES.map((category) => (
                        <div key={category.id} className="mb-8 last:mb-0">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                                {category.name}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {category.tutorials.map((tutorialId) => {
                                    const config = TUTORIAL_CONFIGS[tutorialId];
                                    const Icon = TUTORIAL_ICONS[tutorialId] || BookOpen;
                                    const completed = isCompleted(tutorialId);

                                    return (
                                        <motion.button
                                            key={tutorialId}
                                            onClick={() => handleStartTutorial(tutorialId)}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className={clsx(
                                                "relative p-4 rounded-xl border text-left transition-all group",
                                                completed
                                                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700"
                                                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                                            )}
                                        >
                                            {/* Completed badge */}
                                            {completed && (
                                                <div className="absolute top-2 right-2 px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                    Done
                                                </div>
                                            )}

                                            {/* Icon */}
                                            <div className={clsx(
                                                "w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors",
                                                completed
                                                    ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                                                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600"
                                            )}>
                                                <Icon className="w-6 h-6" />
                                            </div>

                                            {/* Title */}
                                            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                                                {config.title}
                                            </h4>

                                            {/* Description */}
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                                {config.description}
                                            </p>

                                            {/* Steps count */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                                    {config.steps.length} steps
                                                </span>
                                                <div className={clsx(
                                                    "flex items-center gap-1 text-sm font-semibold transition-colors",
                                                    completed
                                                        ? "text-green-600 dark:text-green-400"
                                                        : "text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                                                )}>
                                                    <Play className="w-4 h-4" />
                                                    {completed ? 'Review' : 'Start'}
                                                </div>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Help text */}
                    <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                            Select any tutorial above to begin learning
                        </p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
