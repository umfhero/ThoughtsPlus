import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';
import clsx from 'clsx';

export interface TutorialStep {
    id: string;
    title: string;
    description: string;
    targetSelector?: string; // CSS selector for element to highlight
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    action?: 'click' | 'type' | 'none'; // Required user action
    nextOnAction?: boolean; // Auto-advance when action is completed
}

export interface TutorialConfig {
    id: string;
    title: string;
    description: string;
    steps: TutorialStep[];
}

interface InteractiveTutorialProps {
    config: TutorialConfig;
    onComplete: () => void;
    onSkip: () => void;
}

export function InteractiveTutorial({ config, onComplete, onSkip }: InteractiveTutorialProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isCompleted, setIsCompleted] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const step = config.steps[currentStep];
    const isLastStep = currentStep === config.steps.length - 1;

    useEffect(() => {
        if (step.targetSelector) {
            const element = document.querySelector(step.targetSelector);
            if (element) {
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);

                // Scroll element into view if needed
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            setTargetRect(null);
        }
    }, [currentStep, step.targetSelector]);

    const handleNext = () => {
        if (isLastStep) {
            setIsCompleted(true);
            setTimeout(() => {
                onComplete();
            }, 1000);
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        onSkip();
    };

    // Calculate tooltip position - always center
    const getTooltipPosition = () => {
        return {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
        };
    };

    return (
        <div className="fixed inset-0 z-[9999]" ref={overlayRef}>
            {/* Dark overlay with blur */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleSkip}
            />

            {/* Spotlight cutout */}
            {targetRect && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute pointer-events-none"
                    style={{
                        top: targetRect.top - 8,
                        left: targetRect.left - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 20px 4px rgba(var(--accent-primary-rgb, 59, 130, 246), 0.3)',
                        borderRadius: '12px',
                        border: '2px solid var(--accent-primary, rgb(59, 130, 246))',
                        zIndex: 10000
                    }}
                />
            )}

            {/* Tutorial tooltip */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute z-[10001] max-w-md"
                    style={getTooltipPosition()}
                >
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary, rgb(59, 130, 246))' }} />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    {step.title}
                                </h3>
                            </div>
                            <button
                                onClick={handleSkip}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Description */}
                        <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                            {step.description}
                        </p>

                        {/* Progress indicator */}
                        <div className="flex items-center gap-2 mb-4">
                            {config.steps.map((_, index) => (
                                <div
                                    key={index}
                                    className={clsx(
                                        "h-1.5 rounded-full transition-all",
                                        index === currentStep
                                            ? "flex-1"
                                            : "w-8",
                                        index <= currentStep
                                            ? "opacity-100"
                                            : "opacity-30"
                                    )}
                                    style={{
                                        backgroundColor: index <= currentStep
                                            ? 'var(--accent-primary, rgb(59, 130, 246))'
                                            : 'rgb(209, 213, 219)'
                                    }}
                                />
                            ))}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Step {currentStep + 1} of {config.steps.length}
                            </div>
                            <div className="flex items-center gap-2">
                                {currentStep > 0 && (
                                    <button
                                        onClick={handlePrevious}
                                        className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Back
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-1 text-white",
                                        isCompleted
                                            ? "bg-green-600 hover:bg-green-700"
                                            : ""
                                    )}
                                    style={!isCompleted ? {
                                        backgroundColor: 'var(--accent-primary, rgb(59, 130, 246))',
                                    } : undefined}
                                >
                                    {isCompleted ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Completed!
                                        </>
                                    ) : isLastStep ? (
                                        <>
                                            Finish
                                            <Check className="w-4 h-4" />
                                        </>
                                    ) : (
                                        <>
                                            Next
                                            <ChevronRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
