import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X, Wand2, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { NerdCell, NerdCellType } from '../types';

interface AiBackboneModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (cells: NerdCell[]) => void;
    existingContent: string;
}

export function AiBackboneModal({ isOpen, onClose, onGenerate, existingContent }: AiBackboneModalProps) {
    const { accentColor } = useTheme();
    const [userRequest, setUserRequest] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!userRequest.trim()) return;

        setIsProcessing(true);
        setErrorMessage(null);

        try {
            // @ts-ignore
            const result = await window.ipcRenderer?.invoke('generate-nerdbook-backbone', userRequest, existingContent);

            if (result?.error === 'API_KEY_MISSING') {
                setErrorMessage('Please configure your AI API key in Settings → AI Configuration.');
                setIsProcessing(false);
                return;
            }

            if (result?.error) {
                setErrorMessage(result.message || 'Failed to generate. Please try again.');
                setIsProcessing(false);
                return;
            }

            if (result?.cells && Array.isArray(result.cells)) {
                // Directly add cells without preview
                const newCells: NerdCell[] = result.cells.map((cell: { type: NerdCellType; content: string }) => ({
                    id: crypto.randomUUID(),
                    type: cell.type,
                    content: cell.content,
                    createdAt: new Date().toISOString(),
                }));
                onGenerate(newCells);
                resetAndClose();
            } else {
                setErrorMessage('AI returned an invalid response. Please try rephrasing.');
                setIsProcessing(false);
            }
        } catch (error: any) {
            console.error('AI Backbone Error:', error);
            setErrorMessage('An error occurred. Please check your API key and try again.');
            setIsProcessing(false);
        }
    };

    const resetAndClose = () => {
        setUserRequest('');
        setErrorMessage(null);
        setIsProcessing(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={resetAndClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-white/60 dark:border-gray-700 flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
                        <Wand2 className="w-4 h-4" style={{ color: accentColor }} />
                        Backbone Generator
                    </div>
                    <button
                        onClick={resetAndClose}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    {/* Info box */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                        <p className="mb-1"><strong>How it works:</strong></p>
                        <p>AI creates the structure, you do the actual work filling it in instead of having AI just do it for you.</p>
                    </div>

                    {errorMessage && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 dark:text-red-300">{errorMessage}</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                            What would you like to add?
                        </label>
                        <textarea
                            value={userRequest}
                            onChange={(e) => setUserRequest(e.target.value)}
                            placeholder="e.g.&#10;• Python variables&#10;• Loops with examples&#10;• React hooks&#10;• SQL joins"
                            className="w-full h-36 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 resize-none"
                            style={{ '--tw-ring-color': `${accentColor}50` } as any}
                            autoFocus
                            spellCheck={true}
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!userRequest.trim() || isProcessing}
                        className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: accentColor }}
                    >
                        {isProcessing ? (
                            <>
                                <Sparkles className="w-4 h-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4" />
                                Generate
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
