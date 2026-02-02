/**
 * Web Export Modal
 * 
 * Allows users to export their data for use in the web version of ThoughtsPlus.
 * Supports:
 * - JSON file download
 * - QR code generation (chunked for large data)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Download,
    QrCode,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Check,
    Info,
    Smartphone,
    Monitor,
    Copy,
    ExternalLink,
    PlayCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { compressAndChunk, generateQRData, getCompressedSize, QRChunk } from '../utils/qrChunker';
import { useTheme } from '../contexts/ThemeContext';
import { getAppVersion } from '../utils/version';
import clsx from 'clsx';

interface WebExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ExportData {
    exportVersion: number;
    exportedAt: string;
    appVersion: string;
    data: {
        calendar: Record<string, any[]>;
        workspace: {
            files: any[];
            folders: any[];
        };
        flashcards: any;
        settings: {
            theme: string;
            accentColor: string;
            language: string;
        };
    };
}

export function WebExportModal({ isOpen, onClose }: WebExportModalProps) {
    const { accentColor, theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [exportData, setExportData] = useState<ExportData | null>(null);
    const [qrChunks, setQrChunks] = useState<QRChunk[]>([]);
    const [currentQrIndex, setCurrentQrIndex] = useState(0);
    const [qrDataUrls, setQrDataUrls] = useState<string[]>([]);
    const [mode, setMode] = useState<'select' | 'json' | 'qr'>('select');
    const [copied, setCopied] = useState(false);
    const [fullscreenQr, setFullscreenQr] = useState(false);
    const [autoRotate, setAutoRotate] = useState(false);

    // Generate export data when modal opens
    useEffect(() => {
        if (isOpen && !exportData) {
            generateExportData();
        }
    }, [isOpen]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setExportData(null);
            setQrChunks([]);
            setQrDataUrls([]);
            setCurrentQrIndex(0);
            setMode('select');
            setLoading(false);
        }
    }, [isOpen]);

    // Generate QR codes when chunks are ready
    useEffect(() => {
        if (mode === 'qr' && qrChunks.length > 0) {
            generateQRCodes();
        }
    }, [mode, qrChunks]);

    // Auto-rotation effect for QR codes
    useEffect(() => {
        if (autoRotate && qrChunks.length > 1) {
            const interval = setInterval(() => {
                setCurrentQrIndex(prev => {
                    const next = prev + 1;
                    return next >= qrChunks.length ? 0 : next;
                });
            }, 3000); // Cycle every 3 seconds
            return () => clearInterval(interval);
        }
    }, [autoRotate, qrChunks.length]);

    const generateExportData = async () => {
        setLoading(true);
        console.log('[WebExport] Starting export data generation...');
        try {
            // Fetch all necessary data via IPC
            // @ts-ignore
            const calendarData = await window.ipcRenderer.invoke('get-data');
            console.log('[WebExport] Calendar data loaded:', calendarData ? 'success' : 'empty');

            // Workspace data excluded from export
            const workspaceResult = { files: [], folders: [] };
            // console.log('[WebExport] Workspace data loaded:', workspaceResult?.files?.length || 0, 'files,', workspaceResult?.folders?.length || 0, 'folders');

            // Flashcards excluded from export
            const flashcardsData = { decks: [] };
            // console.log('[WebExport] Flashcards loaded:', flashcardsData?.decks?.length || 0, 'decks');

            const appVersion = await getAppVersion();
            console.log('[WebExport] App version:', appVersion);

            // Transform workspace files to export format
            const workspaceFiles = (workspaceResult?.files || []).map((file: any) => ({
                id: file.id,
                name: file.name,
                type: file.type,
                parentId: file.parentId,
                content: typeof file.content === 'object' ? JSON.stringify(file.content) : file.content
            }));

            const workspaceFolders = workspaceResult?.folders || [];

            const data: ExportData = {
                exportVersion: 1,
                exportedAt: new Date().toISOString(),
                appVersion,
                data: {
                    calendar: calendarData?.notes || {},
                    workspace: {
                        files: workspaceFiles,
                        folders: workspaceFolders
                    },
                    flashcards: flashcardsData,
                    settings: {
                        theme: theme,
                        accentColor: accentColor,
                        language: 'en'
                    }
                }
            };

            console.log('[WebExport] Export data generated. Calendar dates:', Object.keys(data.data.calendar).length);
            console.log('[WebExport] Export size:', (JSON.stringify(data).length / 1024).toFixed(1), 'KB');

            setExportData(data);

            // For QR mode, create a "lite" export with only calendar + settings
            // This keeps QR codes to a minimal count for quick scanning
            const liteData: ExportData = {
                exportVersion: 1,
                exportedAt: data.exportedAt,
                appVersion: data.appVersion,
                data: {
                    calendar: calendarData?.notes || {},
                    workspace: {
                        files: [], // Excluded - use JSON for workspace
                        folders: []
                    },
                    flashcards: { decks: [] }, // Excluded - use JSON for flashcards
                    settings: data.data.settings
                }
            };

            // Pre-generate chunks for QR mode (using lite data)
            console.log('[WebExport] Generating QR chunks (lite mode - calendar + settings only)...');
            console.log('[WebExport] Lite export size:', (JSON.stringify(liteData).length / 1024).toFixed(1), 'KB');
            const chunks = compressAndChunk(liteData);
            console.log('[WebExport] Generated', chunks.length, 'QR chunks');
            setQrChunks(chunks);
        } catch (error) {
            console.error('[WebExport] Failed to generate export data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateQRCodes = async () => {
        const dataUrls: string[] = [];

        for (const chunk of qrChunks) {
            const qrData = generateQRData(chunk);
            try {
                const url = await QRCode.toDataURL(qrData, {
                    width: 768,  // Larger size for better mobile scanning
                    margin: 3,   // Increased margin for better scanning reliability
                    color: {
                        dark: theme === 'dark' ? '#ffffff' : '#000000',
                        light: theme === 'dark' ? '#1f2937' : '#ffffff'
                    },
                    errorCorrectionLevel: 'H'  // High error correction for best scanning reliability
                });
                dataUrls.push(url);
                console.log(`[WebExport] Generated QR code ${dataUrls.length}/${qrChunks.length}`);
            } catch (err) {
                console.error('[WebExport] Failed to generate QR code:', err);
            }
        }

        console.log(`[WebExport] QR code generation complete: ${dataUrls.length} codes`);
        setQrDataUrls(dataUrls);
    };

    const downloadJSON = () => {
        if (!exportData) return;

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `thoughtsplus-branch-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const copyWebLink = () => {
        navigator.clipboard.writeText('https://thoughtsplus.me/app/');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openWebApp = () => {
        // @ts-ignore
        window.ipcRenderer.invoke('open-external', 'https://thoughtsplus.me/app/');
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <QrCode className="w-5 h-5" style={{ color: accentColor }} />
                                Export for Web
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Access your data on any device at thoughtsplus.me/app
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                                    Preparing export data...
                                </p>
                            </div>
                        ) : mode === 'select' ? (
                            <div className="space-y-4">
                                {/* Info Banner */}
                                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                                    <div className="text-sm text-blue-700 dark:text-blue-300">
                                        <p className="font-medium mb-1">How it works:</p>
                                        <ol className="list-decimal list-inside space-y-1 text-xs">
                                            <li>Export your data from this app</li>
                                            <li>Import it on the web at thoughtsplus.me/app</li>
                                            <li>Access your calendar anywhere!</li>
                                        </ol>
                                    </div>
                                </div>

                                {/* Export Options */}
                                <div className="space-y-3">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Choose export method:
                                    </p>

                                    {/* JSON Export */}
                                    <button
                                        onClick={() => setMode('json')}
                                        className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all text-left flex items-start gap-4 group"
                                    >
                                        <div
                                            className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 group-hover:scale-105 transition-transform"
                                            style={{ backgroundColor: `${accentColor}20` }}
                                        >
                                            <Monitor className="w-6 h-6" style={{ color: accentColor }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                                                    Download JSON File
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">
                                                    20%
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                <strong>Full export:</strong> Calendar and settings
                                            </p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                Transfers all your data
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
                                    </button>

                                    {/* QR Export */}
                                    <button
                                        onClick={() => setMode('qr')}
                                        className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all text-left flex items-start gap-4 group"
                                    >
                                        <div
                                            className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 group-hover:scale-105 transition-transform"
                                            style={{ backgroundColor: `${accentColor}20` }}
                                        >
                                            <Smartphone className="w-6 h-6" style={{ color: accentColor }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                                                    Generate QR Codes
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">
                                                    20%
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                <strong>Quick sync:</strong> Calendar and settings only
                                            </p>
                                            {qrChunks.length > 0 && (
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                                    {qrChunks.length} QR code{qrChunks.length > 1 ? 's' : ''} ({getCompressedSize(qrChunks)})
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
                                    </button>
                                </div>

                                {/* Quick Link */}
                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                        Web app link:
                                    </p>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300 truncate">
                                            thoughtsplus.me/app
                                        </div>
                                        <button
                                            onClick={copyWebLink}
                                            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                                        >
                                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={openWebApp}
                                            className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-sm font-medium"
                                            style={{ color: accentColor }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : mode === 'json' ? (
                            <div className="space-y-4">
                                {/* Back Button */}
                                <button
                                    onClick={() => setMode('select')}
                                    className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Back
                                </button>

                                {/* JSON Preview */}
                                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                                            Export Summary
                                        </h4>
                                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                            Ready
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <div className="flex justify-between">
                                            <span>Calendar Events:</span>
                                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                                {Object.values(exportData?.data.calendar || {}).flat().length}
                                            </span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                                            <span>Export Size:</span>
                                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                                {exportData ? (JSON.stringify(exportData).length / 1024).toFixed(1) : '0'} KB
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Download Button */}
                                <button
                                    onClick={downloadJSON}
                                    className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <Download className="w-5 h-5" />
                                    Download Branch File
                                </button>

                                {/* Instructions */}
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        <strong>Next step:</strong> Go to thoughtsplus.me/app and click "Import from Desktop" to upload this file.
                                    </p>
                                </div>
                            </div>
                        ) : mode === 'qr' ? (
                            <div className="space-y-4">
                                {/* Back Button */}
                                <button
                                    onClick={() => setMode('select')}
                                    className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Back
                                </button>

                                {/* QR Display */}
                                <div className="flex flex-col items-center">
                                    {qrDataUrls.length > 0 ? (
                                        <>
                                            <div
                                                className="relative cursor-pointer group"
                                                onClick={() => setFullscreenQr(true)}
                                                title="Click to enlarge for scanning"
                                            >
                                                <img
                                                    src={qrDataUrls[currentQrIndex]}
                                                    alt={`QR Code ${currentQrIndex + 1} of ${qrChunks.length}`}
                                                    className="w-80 h-80 rounded-xl border-2 border-gray-200 dark:border-gray-600 transition-transform group-hover:scale-[1.02]"
                                                    style={{ imageRendering: 'pixelated' }}
                                                />
                                                {/* Badge moved to bottom to avoid blocking QR corners */}
                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md"
                                                    style={{ backgroundColor: accentColor }}
                                                >
                                                    {currentQrIndex + 1}/{qrChunks.length}
                                                </div>
                                                {/* Click me tag - always visible */}
                                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] font-medium shadow-md">
                                                    Click to enlarge
                                                </div>
                                            </div>

                                            {/* Auto-rotate toggle */}
                                            {qrChunks.length > 1 && (
                                                <div className="mt-3">
                                                    <button
                                                        onClick={() => setAutoRotate(!autoRotate)}
                                                        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mx-auto"
                                                    >
                                                        {autoRotate ? (
                                                            <>
                                                                <PlayCircle className="w-4 h-4" style={{ color: accentColor }} />
                                                                Auto-rotating...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <PlayCircle className="w-4 h-4" />
                                                                Start Auto-Rotate
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Navigation */}
                                            {qrChunks.length > 1 && (
                                                <div className="flex items-center gap-4 mt-4">
                                                    <button
                                                        onClick={() => setCurrentQrIndex(i => Math.max(0, i - 1))}
                                                        disabled={currentQrIndex === 0}
                                                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                                    </button>
                                                    <div className="flex gap-1.5">
                                                        {qrChunks.map((_, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setCurrentQrIndex(idx)}
                                                                className={clsx(
                                                                    "w-2.5 h-2.5 rounded-full transition-all",
                                                                    idx === currentQrIndex
                                                                        ? ""
                                                                        : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                                                                )}
                                                                style={{
                                                                    backgroundColor: idx === currentQrIndex ? accentColor : undefined
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => setCurrentQrIndex(i => Math.min(qrChunks.length - 1, i + 1))}
                                                        disabled={currentQrIndex === qrChunks.length - 1}
                                                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-64 h-64 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Instructions */}
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        <strong>Instructions:</strong> Open thoughtsplus.me/app on your phone, go to Settings, and tap "Scan QR Code".
                                        {qrChunks.length > 1 && ` Scan all ${qrChunks.length} QR codes in order, or use auto-rotate to continuously scan.`}
                                    </p>
                                </div>

                                {/* Fallback Download */}
                                <button
                                    onClick={downloadJSON}
                                    className="w-full py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download JSON Instead
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* Footer Warning */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                        <p className="text-[11px] text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                                <strong>Note:</strong> Changes made on the web version will not sync back to this app.
                                The web version is a "branch" of your data.
                            </span>
                        </p>
                    </div>
                </motion.div>

                {/* Fullscreen QR Overlay */}
                {fullscreenQr && qrDataUrls.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-8"
                        onClick={() => setFullscreenQr(false)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setFullscreenQr(false)}
                            className="absolute top-4 right-4 p-3 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        </button>

                        {/* QR Code - Large for scanning */}
                        <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                            <img
                                src={qrDataUrls[currentQrIndex]}
                                alt={`QR Code ${currentQrIndex + 1} of ${qrChunks.length}`}
                                className="rounded-2xl border-4 border-gray-200 dark:border-gray-700 shadow-2xl"
                                style={{
                                    width: '420px',
                                    height: '420px',
                                    imageRendering: 'pixelated'  // Crisp pixel display
                                }}
                            />

                            {/* Counter */}
                            <div
                                className="mt-6 px-6 py-2 rounded-full text-lg font-bold text-white shadow-lg"
                                style={{ backgroundColor: accentColor }}
                            >
                                QR {currentQrIndex + 1} of {qrChunks.length}
                            </div>

                            {/* Navigation for fullscreen */}
                            {qrChunks.length > 1 && (
                                <div className="flex items-center gap-6 mt-6">
                                    <button
                                        onClick={() => setCurrentQrIndex(i => Math.max(0, i - 1))}
                                        disabled={currentQrIndex === 0}
                                        className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-8 h-8 text-gray-600 dark:text-gray-300" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentQrIndex(i => Math.min(qrChunks.length - 1, i + 1))}
                                        disabled={currentQrIndex === qrChunks.length - 1}
                                        className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-8 h-8 text-gray-600 dark:text-gray-300" />
                                    </button>
                                </div>
                            )}

                            {/* Hint */}
                            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                                Tap anywhere outside to close
                            </p>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence >
    );
}
