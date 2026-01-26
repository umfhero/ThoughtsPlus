import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, ExternalLink, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { FileType } from '../../types/workspace';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker - use HTTPS to match CSP
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
    filePath: string;
    fileType: FileType;
    fileName: string;
}

export function DocumentViewer({ filePath, fileType, fileName }: DocumentViewerProps) {
    const [content, setContent] = useState<string>('');
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Detect theme
    useEffect(() => {
        const checkTheme = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };

        checkTheme();

        // Watch for theme changes
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        loadDocument();
    }, [filePath, fileType]);

    const loadDocument = async () => {
        setLoading(true);
        setError(null);
        setContent('');
        setHtmlContent('');
        setPdfData(null);

        try {
            if (fileType === 'pdf') {
                // Load PDF as buffer
                // @ts-ignore - Electron API
                const result = await window.ipcRenderer?.invoke('read-pdf-file', filePath);
                if (result?.success && result.data) {
                    // Create a new Uint8Array to avoid detached buffer issues
                    const buffer = new Uint8Array(result.data);
                    setPdfData(buffer);
                } else {
                    setError(result?.error || 'Failed to load PDF');
                }
            } else if (fileType === 'docx') {
                // Convert DOCX to HTML
                // @ts-ignore - Electron API
                const result = await window.ipcRenderer?.invoke('convert-docx-to-html', filePath);
                if (result?.success && result.html) {
                    setHtmlContent(result.html);
                } else {
                    setError(result?.error || 'Failed to convert DOCX');
                }
            } else if (fileType === 'xlsx') {
                // Convert XLSX to HTML
                // @ts-ignore - Electron API
                const result = await window.ipcRenderer?.invoke('convert-xlsx-to-html', filePath);
                if (result?.success && result.html) {
                    setHtmlContent(result.html);
                } else {
                    setError(result?.error || 'Failed to convert XLSX');
                }
            } else if (fileType === 'txt' || fileType === 'md') {
                // Load text content
                // @ts-ignore - Electron API
                const result = await window.ipcRenderer?.invoke('load-workspace-file', filePath);
                if (result?.success !== false && result?.content) {
                    setContent(typeof result.content === 'string' ? result.content : '');
                } else {
                    setError(result?.error || 'Failed to load text file');
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load document');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenExternal = async () => {
        try {
            // @ts-ignore - Electron API
            await window.ipcRenderer?.invoke('open-external-file', filePath);
        } catch (err) {
            console.error('Failed to open external file:', err);
        }
    };

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    // Memoize the PDF file object to prevent unnecessary reloads
    const pdfFile = useMemo(() => {
        if (!pdfData) return null;
        return { data: pdfData };
    }, [pdfData]);

    const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
    const textColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-300';
    const toolbarBg = isDarkMode ? 'bg-gray-800' : 'bg-gray-100';
    const buttonBg = isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300';

    if (loading) {
        return (
            <div className={`flex items-center justify-center h-full ${bgColor}`}>
                <div className={textColor}>Loading document...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center h-full gap-4 ${bgColor}`}>
                <AlertCircle className="w-12 h-12 text-red-400" />
                <div className={textColor}>{error}</div>
                <button
                    onClick={handleOpenExternal}
                    className={`px-4 py-2 ${buttonBg} ${textColor} rounded flex items-center gap-2`}
                >
                    <ExternalLink className="w-4 h-4" />
                    Open in Default App
                </button>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full ${bgColor}`}>
            {/* Toolbar */}
            <div className={`flex items-center justify-between px-4 py-2 ${toolbarBg} border-b ${borderColor}`}>
                <div className="flex items-center gap-2">
                    <FileText className={`w-4 h-4 ${textColor}`} />
                    <span className={`text-sm ${textColor}`}>{fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                    {fileType === 'pdf' && numPages > 0 && (
                        <div className="flex items-center gap-2 mr-4">
                            <button
                                onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                                disabled={pageNumber <= 1}
                                className={`p-1 ${buttonBg} ${textColor} rounded disabled:opacity-50`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className={`text-sm ${textColor}`}>
                                {pageNumber} / {numPages}
                            </span>
                            <button
                                onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                                disabled={pageNumber >= numPages}
                                className={`p-1 ${buttonBg} ${textColor} rounded disabled:opacity-50`}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleOpenExternal}
                        className={`px-3 py-1 text-sm ${buttonBg} ${textColor} rounded flex items-center gap-2`}
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open in Default App
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4">
                {fileType === 'txt' || fileType === 'md' ? (
                    <pre className={`${textColor} whitespace-pre-wrap font-mono text-sm`}>
                        {content}
                    </pre>
                ) : fileType === 'pdf' && pdfFile ? (
                    <div className="flex justify-center">
                        <Document
                            file={pdfFile}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={<div className={textColor}>Loading PDF...</div>}
                            error={<div className="text-red-400">Failed to load PDF</div>}
                        >
                            <Page
                                pageNumber={pageNumber}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                                className={isDarkMode ? 'pdf-dark' : 'pdf-light'}
                            />
                        </Document>
                    </div>
                ) : fileType === 'docx' && htmlContent ? (
                    <div
                        className={`prose max-w-none ${isDarkMode ? 'prose-invert' : ''}`}
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                ) : fileType === 'xlsx' && htmlContent ? (
                    <div
                        className={`document-preview ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                ) : fileType === 'image' ? (
                    <div className="flex items-center justify-center h-full">
                        <img
                            src={`file://${filePath}`}
                            alt={fileName}
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <FileText className={`w-16 h-16 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                        <div className={`${textColor} text-center`}>
                            <p className="mb-2">Preview not available for {fileType.toUpperCase()} files</p>
                            <p className="text-sm">Click "Open in Default App" to view this document</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
