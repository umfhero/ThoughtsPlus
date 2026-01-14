import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Edit2, Check, X, ChevronDown,
    Code, Save, Scissors,
    Clipboard, Play, Square, Copy, ArrowUp, ArrowDown, RotateCcw,
    Sun, Moon, Palette, Monitor
} from 'lucide-react';
import { NerdNotebook, NerdCell, NerdCellType } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import clsx from 'clsx';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';

type CodeTheme = 'auto' | 'dark' | 'light';
type CellMode = 'command' | 'edit';

interface NerdbookEditorProps {
    /** The content ID that references the notebook in storage */
    contentId: string;
    /** Callback when notebook is updated */
    onNotebookChange?: (notebook: NerdNotebook) => void;
}

/**
 * NerdbookEditor component - A Jupyter-style notebook editor for the workspace.
 * Accepts a contentId prop to load/save notebook content via workspace content reference.
 * 
 * Requirements: 8.1
 */
export function NerdbookEditor({ contentId, onNotebookChange }: NerdbookEditorProps) {
    const { accentColor, theme } = useTheme();
    const [notebook, setNotebook] = useState<NerdNotebook | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
    const [cellMode, setCellMode] = useState<CellMode>('command');
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const [clipboard, setClipboard] = useState<NerdCell | null>(null);
    const [deletedCells, setDeletedCells] = useState<{ cell: NerdCell; index: number }[]>([]);
    const [pendingDelete, setPendingDelete] = useState(false);
    const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const [pyodideLoading, setPyodideLoading] = useState(false);
    const [pyodideReady, setPyodideReady] = useState(false);
    const pyodideRef = useRef<any>(null);

    // Code theme setting
    const [codeTheme, setCodeTheme] = useState<CodeTheme>(() => {
        const saved = localStorage.getItem('nerdbook-code-theme');
        return (saved as CodeTheme) || 'auto';
    });
    const [showCodeThemeDropdown, setShowCodeThemeDropdown] = useState(false);
    const codeThemeDropdownRef = useRef<HTMLDivElement>(null);

    const useCodeDarkTheme = useMemo(() => {
        if (codeTheme === 'dark') return true;
        if (codeTheme === 'light') return false;
        return theme === 'dark';
    }, [codeTheme, theme]);

    // Save code theme preference
    useEffect(() => {
        localStorage.setItem('nerdbook-code-theme', codeTheme);
    }, [codeTheme]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (codeThemeDropdownRef.current && !codeThemeDropdownRef.current.contains(e.target as Node)) {
                setShowCodeThemeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load notebook data based on contentId
    useEffect(() => {
        const loadNotebook = async () => {
            setIsLoading(true);
            try {
                // @ts-ignore
                const data = await window.ipcRenderer.invoke('get-data');
                if (data?.nerdbooks?.notebooks) {
                    const found = data.nerdbooks.notebooks.find((n: NerdNotebook) => n.id === contentId);
                    if (found) {
                        // Clear outputs when loading
                        const clearedCells = found.cells.map((c: NerdCell) => ({
                            ...c,
                            output: undefined,
                            isExecuting: false,
                            executionError: undefined
                        }));
                        setNotebook({ ...found, cells: clearedCells });
                        if (clearedCells.length > 0) {
                            setSelectedCellId(clearedCells[0].id);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load notebook:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadNotebook();
    }, [contentId]);


    // Save notebook to backend
    const saveNotebook = useCallback(async (updatedNotebook: NerdNotebook) => {
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-data');
            const nerdbooks = data?.nerdbooks || { notebooks: [] };
            const updatedNotebooks = nerdbooks.notebooks.map((n: NerdNotebook) =>
                n.id === updatedNotebook.id ? updatedNotebook : n
            );
            // @ts-ignore
            await window.ipcRenderer.invoke('save-data', {
                ...data,
                nerdbooks: { ...nerdbooks, notebooks: updatedNotebooks }
            });
            onNotebookChange?.(updatedNotebook);
        } catch (error) {
            console.error('Failed to save notebook:', error);
        }
    }, [onNotebookChange]);

    // Debounced save
    useEffect(() => {
        if (!notebook) return;
        const timeout = setTimeout(() => {
            saveNotebook(notebook);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [notebook, saveNotebook]);

    // Get selected cell index
    const getSelectedCellIndex = useCallback(() => {
        if (!notebook || !selectedCellId) return -1;
        return notebook.cells.findIndex(c => c.id === selectedCellId);
    }, [notebook, selectedCellId]);

    // Add a new cell
    const handleAddCell = useCallback((type: NerdCellType, position: 'above' | 'below' = 'below', atCellId?: string) => {
        if (!notebook) return;

        const newCell: NerdCell = {
            id: crypto.randomUUID(),
            type,
            content: '',
            createdAt: new Date().toISOString(),
        };

        const targetCellId = atCellId || selectedCellId;
        const currentIndex = targetCellId
            ? notebook.cells.findIndex(c => c.id === targetCellId)
            : getSelectedCellIndex();
        let insertIndex = position === 'above' ? currentIndex : currentIndex + 1;
        if (insertIndex < 0) insertIndex = notebook.cells.length;

        const newCells = [
            ...notebook.cells.slice(0, insertIndex),
            newCell,
            ...notebook.cells.slice(insertIndex)
        ];

        const updatedNotebook = {
            ...notebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        };
        setNotebook(updatedNotebook);
        setSelectedCellId(newCell.id);
        setCellMode('edit');
    }, [notebook, selectedCellId, getSelectedCellIndex]);

    // Update a cell's content
    const handleUpdateCell = useCallback((cellId: string, content: string) => {
        if (!notebook) return;

        const updatedCells = notebook.cells.map(cell =>
            cell.id === cellId
                ? { ...cell, content, updatedAt: new Date().toISOString() }
                : cell
        );

        setNotebook({
            ...notebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        });
    }, [notebook]);

    // Delete a cell
    const handleDeleteCell = useCallback((cellId: string) => {
        if (!notebook || notebook.cells.length <= 1) return;

        const cellIndex = notebook.cells.findIndex(c => c.id === cellId);
        const cellToDelete = notebook.cells[cellIndex];

        setDeletedCells(prev => [...prev, { cell: cellToDelete, index: cellIndex }]);

        const updatedCells = notebook.cells.filter(c => c.id !== cellId);
        const updatedNotebook = {
            ...notebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        };
        setNotebook(updatedNotebook);

        if (cellIndex < updatedCells.length) {
            setSelectedCellId(updatedCells[cellIndex].id);
        } else if (updatedCells.length > 0) {
            setSelectedCellId(updatedCells[updatedCells.length - 1].id);
        }
        setCellMode('command');
    }, [notebook]);

    // Undo cell deletion
    const handleUndoDelete = useCallback(() => {
        if (!notebook || deletedCells.length === 0) return;

        const { cell, index } = deletedCells[deletedCells.length - 1];
        setDeletedCells(prev => prev.slice(0, -1));

        const newCells = [
            ...notebook.cells.slice(0, index),
            cell,
            ...notebook.cells.slice(index)
        ];

        setNotebook({
            ...notebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        });
        setSelectedCellId(cell.id);
    }, [notebook, deletedCells]);

    // Move cell up/down
    const handleMoveCell = useCallback((cellId: string, direction: 'up' | 'down') => {
        if (!notebook) return;

        const cellIndex = notebook.cells.findIndex(c => c.id === cellId);
        if (direction === 'up' && cellIndex === 0) return;
        if (direction === 'down' && cellIndex === notebook.cells.length - 1) return;

        const newCells = [...notebook.cells];
        const targetIndex = direction === 'up' ? cellIndex - 1 : cellIndex + 1;
        [newCells[cellIndex], newCells[targetIndex]] = [newCells[targetIndex], newCells[cellIndex]];

        setNotebook({
            ...notebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        });
    }, [notebook]);

    // Change cell type
    const handleChangeCellType = useCallback((cellId: string, newType: NerdCellType) => {
        if (!notebook) return;

        const updatedCells = notebook.cells.map(cell =>
            cell.id === cellId
                ? { ...cell, type: newType, updatedAt: new Date().toISOString() }
                : cell
        );

        setNotebook({
            ...notebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        });
    }, [notebook]);

    // Cut cell
    const handleCutCell = useCallback(() => {
        if (!notebook || !selectedCellId) return;
        const cell = notebook.cells.find(c => c.id === selectedCellId);
        if (cell) {
            setClipboard({ ...cell });
            handleDeleteCell(selectedCellId);
        }
    }, [notebook, selectedCellId, handleDeleteCell]);

    // Copy cell
    const handleCopyCell = useCallback(() => {
        if (!notebook || !selectedCellId) return;
        const cell = notebook.cells.find(c => c.id === selectedCellId);
        if (cell) {
            setClipboard({ ...cell });
        }
    }, [notebook, selectedCellId]);

    // Paste cell
    const handlePasteCell = useCallback(() => {
        if (!notebook || !clipboard) return;

        const newCell: NerdCell = {
            ...clipboard,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };

        const currentIndex = getSelectedCellIndex();
        const insertIndex = currentIndex >= 0 ? currentIndex + 1 : notebook.cells.length;

        const newCells = [
            ...notebook.cells.slice(0, insertIndex),
            newCell,
            ...notebook.cells.slice(insertIndex)
        ];

        setNotebook({
            ...notebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        });
        setSelectedCellId(newCell.id);
    }, [notebook, clipboard, getSelectedCellIndex]);

    // Select cell above/below
    const selectAdjacentCell = useCallback((direction: 'up' | 'down') => {
        if (!notebook) return;
        const currentIndex = getSelectedCellIndex();
        if (currentIndex < 0) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < notebook.cells.length) {
            setSelectedCellId(notebook.cells[newIndex].id);
        }
    }, [notebook, getSelectedCellIndex]);

    // Save notebook title
    const handleSaveTitle = () => {
        if (!notebook || !titleInput.trim()) return;

        setNotebook({
            ...notebook,
            title: titleInput.trim(),
            updatedAt: new Date().toISOString(),
        });
        setEditingTitle(false);
    };

    // Auto-resize textarea
    const autoResizeTextarea = (textarea: HTMLTextAreaElement | null) => {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Detect language from code content
    const detectLanguage = useCallback((content: string): string => {
        const firstLine = content.trim().split('\n')[0].toLowerCase();

        if (firstLine.includes('// javascript') || firstLine.includes('// js')) return 'javascript';
        if (firstLine.includes('// typescript') || firstLine.includes('// ts')) return 'typescript';
        if (firstLine.includes('# python') || firstLine.includes('# py')) return 'python';
        if (firstLine.includes('// css')) return 'css';
        if (firstLine.includes('// sql')) return 'sql';
        if (firstLine.includes('# bash') || firstLine.includes('# shell')) return 'bash';

        if (content.includes('import React') || content.includes('useState') || content.includes('const ') && content.includes('=>')) return 'javascript';
        if (content.includes('interface ') || content.includes(': string') || content.includes(': number')) return 'typescript';
        if (content.includes('def ') || content.includes('print(') || content.includes('import ') && !content.includes('from \'')) return 'python';
        if (content.includes('SELECT ') || content.includes('FROM ') || content.includes('WHERE ')) return 'sql';
        if (content.includes('{') && content.includes(':') && content.includes(';') && !content.includes('function')) return 'css';

        return 'javascript';
    }, []);

    // Get Prism language class
    const getPrismLanguage = (lang: string): string => {
        const langMap: { [key: string]: string } = {
            'javascript': 'javascript',
            'js': 'javascript',
            'typescript': 'typescript',
            'ts': 'typescript',
            'python': 'python',
            'py': 'python',
            'css': 'css',
            'json': 'json',
            'markdown': 'markdown',
            'md': 'markdown',
            'bash': 'bash',
            'shell': 'bash',
            'sql': 'sql',
            'jsx': 'jsx',
            'tsx': 'tsx',
        };
        return langMap[lang.toLowerCase()] || 'javascript';
    };

    // Syntax highlight code
    const highlightCode = useCallback((code: string, language: string): string => {
        const lang = getPrismLanguage(language);
        try {
            if (Prism.languages[lang]) {
                return Prism.highlight(code, Prism.languages[lang], lang);
            }
            return code;
        } catch {
            return code;
        }
    }, []);


    // Load Pyodide for Python execution
    const loadPyodide = useCallback(async () => {
        if (pyodideRef.current) return pyodideRef.current;

        setPyodideLoading(true);
        try {
            if (!(window as any).loadPyodide) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
                    script.async = true;
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('Failed to load Pyodide script.'));
                    document.body.appendChild(script);
                });
            }

            // @ts-ignore
            const pyodide = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            pyodideRef.current = pyodide;
            setPyodideReady(true);
            return pyodide;
        } catch (error) {
            console.error('Failed to load Pyodide:', error);
            return null;
        } finally {
            setPyodideLoading(false);
        }
    }, []);

    // Run a code cell
    const handleRunCell = useCallback(async (cellId: string) => {
        if (!notebook) return;

        const cell = notebook.cells.find(c => c.id === cellId);
        if (!cell || cell.type !== 'code') return;

        const textareaEl = textareaRefs.current[cellId];
        const currentContent = textareaEl?.value || cell.content;

        const detectedLang = detectLanguage(currentContent);
        const isPython = ['python', 'py'].includes(detectedLang.toLowerCase());
        const isNonExecutable = ['bash', 'shell', 'sql', 'css'].includes(detectedLang.toLowerCase());

        if (isNonExecutable) {
            setNotebook(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    cells: prev.cells.map(c =>
                        c.id === cellId
                            ? {
                                ...c,
                                output: `[${detectedLang.toUpperCase()}] This language cannot be executed in the browser.`,
                                isExecuting: false,
                                executionError: false,
                                updatedAt: new Date().toISOString()
                            }
                            : c
                    ),
                    updatedAt: new Date().toISOString(),
                };
            });
            return;
        }

        setNotebook(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                cells: prev.cells.map(c =>
                    c.id === cellId ? { ...c, isExecuting: true, output: undefined } : c
                ),
            };
        });

        let output = '';
        let hasError = false;

        if (isPython) {
            try {
                let pyodide = pyodideRef.current;
                if (!pyodide) {
                    output = 'Downloading Python runtime...';
                    setNotebook(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            cells: prev.cells.map(c =>
                                c.id === cellId ? { ...c, output } : c
                            ),
                        };
                    });

                    pyodide = await loadPyodide();
                    if (!pyodide) {
                        throw new Error('Failed to load Python runtime');
                    }
                }

                let code = currentContent;
                if (code.startsWith('# python')) {
                    code = code.replace(/^# python\s*\n?/, '');
                }

                await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
                `);

                const result = await pyodide.runPythonAsync(code);
                const stdout = await pyodide.runPythonAsync('sys.stdout.getvalue()');
                const stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');

                if (stderr) {
                    output = stderr;
                    hasError = true;
                } else if (stdout) {
                    output = stdout;
                } else if (result !== undefined && result !== null) {
                    output = String(result);
                } else {
                    output = '(No output)';
                }
            } catch (error: any) {
                hasError = true;
                output = `[PYTHON ERROR] ${error.message}`;
            }
        } else {
            const outputs: string[] = [];
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;

            console.log = (...args) => {
                outputs.push(args.map(a =>
                    typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
                ).join(' '));
            };
            console.error = (...args) => {
                outputs.push(`[ERROR] ${args.map(a =>
                    typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
                ).join(' ')}`);
            };
            console.warn = (...args) => {
                outputs.push(`[WARN] ${args.map(a =>
                    typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
                ).join(' ')}`);
            };

            try {
                const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                const fn = new AsyncFunction(currentContent);
                const result = await fn();

                if (result !== undefined) {
                    outputs.push(`>> ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
                }

                output = outputs.join('\n') || '(No output)';
            } catch (error: any) {
                hasError = true;
                output = outputs.length > 0
                    ? outputs.join('\n') + '\n\n' + `[ERROR] ${error.message}`
                    : `[ERROR] ${error.message}`;
            } finally {
                console.log = originalLog;
                console.error = originalError;
                console.warn = originalWarn;
            }
        }

        setNotebook(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                cells: prev.cells.map(c =>
                    c.id === cellId
                        ? {
                            ...c,
                            content: currentContent,
                            output: output,
                            isExecuting: false,
                            executionError: hasError,
                            updatedAt: new Date().toISOString()
                        }
                        : c
                ),
                updatedAt: new Date().toISOString(),
            };
        });
    }, [notebook, detectLanguage, loadPyodide]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!notebook) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInTextarea = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
            const isContentEditable = target.getAttribute('contenteditable') === 'true';

            // Save shortcut
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                e.stopPropagation();
                saveNotebook(notebook);
                return;
            }

            // Escape - enter command mode
            if (e.key === 'Escape') {
                e.preventDefault();
                setCellMode('command');
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                return;
            }

            // Enter - enter edit mode
            if (e.key === 'Enter' && cellMode === 'command' && !isInTextarea && !isContentEditable) {
                e.preventDefault();
                setCellMode('edit');
                if (selectedCellId && textareaRefs.current[selectedCellId]) {
                    textareaRefs.current[selectedCellId]?.focus();
                }
                return;
            }

            // Command mode shortcuts
            if (cellMode === 'command' && !isInTextarea && !isContentEditable) {
                switch (e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        handleAddCell('code', 'above');
                        break;
                    case 'b':
                        e.preventDefault();
                        handleAddCell('code', 'below');
                        break;
                    case 'd':
                        if (pendingDelete) {
                            e.preventDefault();
                            if (selectedCellId) handleDeleteCell(selectedCellId);
                            setPendingDelete(false);
                        } else {
                            setPendingDelete(true);
                            setTimeout(() => setPendingDelete(false), 500);
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        if (selectedCellId) handleChangeCellType(selectedCellId, 'code');
                        break;
                    case 'm':
                        e.preventDefault();
                        if (selectedCellId) handleChangeCellType(selectedCellId, 'markdown');
                        break;
                    case 'z':
                        e.preventDefault();
                        handleUndoDelete();
                        break;
                    case 'c':
                        e.preventDefault();
                        handleCopyCell();
                        break;
                    case 'x':
                        e.preventDefault();
                        handleCutCell();
                        break;
                    case 'v':
                        e.preventDefault();
                        handlePasteCell();
                        break;
                    case 'arrowup':
                    case 'k':
                        e.preventDefault();
                        selectAdjacentCell('up');
                        break;
                    case 'arrowdown':
                    case 'j':
                        e.preventDefault();
                        selectAdjacentCell('down');
                        break;
                }
            }

            // Edit mode shortcuts
            if (cellMode === 'edit') {
                if (e.shiftKey && e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedCellId) {
                        const currentCell = notebook.cells.find(c => c.id === selectedCellId);
                        if (currentCell?.type === 'code') {
                            handleRunCell(selectedCellId);
                        }
                    }
                    const currentIndex = getSelectedCellIndex();
                    if (currentIndex < notebook.cells.length - 1) {
                        setSelectedCellId(notebook.cells[currentIndex + 1].id);
                    } else {
                        handleAddCell('code', 'below');
                    }
                    return;
                }

                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedCellId) {
                        const currentCell = notebook.cells.find(c => c.id === selectedCellId);
                        if (currentCell?.type === 'code') {
                            handleRunCell(selectedCellId);
                        }
                    }
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [
        notebook, cellMode, selectedCellId, pendingDelete, saveNotebook,
        handleAddCell, handleDeleteCell, handleChangeCellType, handleUndoDelete,
        handleCopyCell, handleCutCell, handlePasteCell, selectAdjacentCell,
        getSelectedCellIndex, handleRunCell
    ]);

    // Render markdown preview
    const renderMarkdownPreview = (content: string) => {
        let html = content
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-sm font-mono">$1</code>')
            .replace(/\n/gim, '<br />');
        return html;
    };

    // Toolbar button component
    const ToolbarButton = ({ icon: Icon, label, onClick, disabled = false, title }: {
        icon: any;
        label?: string;
        onClick: () => void;
        disabled?: boolean;
        title: string;
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={clsx(
                "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                disabled
                    ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
            title={title}
        >
            <Icon className="w-4 h-4" />
            {label && <span className="hidden md:inline">{label}</span>}
        </button>
    );

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading notebook...</div>
            </div>
        );
    }

    if (!notebook) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Notebook not found</div>
            </div>
        );
    }


    return (
        <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-1">
                        <ToolbarButton icon={Save} onClick={() => saveNotebook(notebook)} title="Save (Ctrl+S)" />
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                        <ToolbarButton icon={Plus} onClick={() => handleAddCell('code', 'below')} title="Add cell below (B)" />
                        <ToolbarButton icon={Scissors} onClick={handleCutCell} disabled={!selectedCellId} title="Cut cell (X)" />
                        <ToolbarButton icon={Copy} onClick={handleCopyCell} disabled={!selectedCellId} title="Copy cell (C)" />
                        <ToolbarButton icon={Clipboard} onClick={handlePasteCell} disabled={!clipboard} title="Paste cell (V)" />
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                        <ToolbarButton icon={ArrowUp} onClick={() => selectedCellId && handleMoveCell(selectedCellId, 'up')} disabled={!selectedCellId || getSelectedCellIndex() === 0} title="Move cell up" />
                        <ToolbarButton icon={ArrowDown} onClick={() => selectedCellId && handleMoveCell(selectedCellId, 'down')} disabled={!selectedCellId || getSelectedCellIndex() === notebook.cells.length - 1} title="Move cell down" />
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                        <ToolbarButton icon={RotateCcw} onClick={handleUndoDelete} disabled={deletedCells.length === 0} title="Undo delete (Z)" />
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                        {/* Code Theme Dropdown */}
                        <div className="relative" ref={codeThemeDropdownRef}>
                            <button
                                onClick={() => setShowCodeThemeDropdown(!showCodeThemeDropdown)}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-colors",
                                    "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
                                    "text-gray-600 dark:text-gray-300"
                                )}
                                title="Code theme"
                            >
                                <div className="flex items-center gap-0.5">
                                    <Palette className="w-3.5 h-3.5" />
                                    <Code className="w-3 h-3" />
                                </div>
                                <span className="text-xs">
                                    {codeTheme === 'auto' ? 'Auto' : codeTheme === 'dark' ? 'Dark' : 'Light'}
                                </span>
                                <ChevronDown className="w-3 h-3" />
                            </button>

                            <AnimatePresence>
                                {showCodeThemeDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
                                    >
                                        <button
                                            onClick={() => { setCodeTheme('auto'); setShowCodeThemeDropdown(false); }}
                                            className={clsx(
                                                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                                                codeTheme === 'auto' && "bg-gray-100 dark:bg-gray-700"
                                            )}
                                        >
                                            <Monitor className="w-4 h-4" />
                                            <span>Auto (System)</span>
                                            {codeTheme === 'auto' && <Check className="w-3 h-3 ml-auto" style={{ color: accentColor }} />}
                                        </button>
                                        <button
                                            onClick={() => { setCodeTheme('dark'); setShowCodeThemeDropdown(false); }}
                                            className={clsx(
                                                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                                                codeTheme === 'dark' && "bg-gray-100 dark:bg-gray-700"
                                            )}
                                        >
                                            <Moon className="w-4 h-4" />
                                            <span>Always Dark</span>
                                            {codeTheme === 'dark' && <Check className="w-3 h-3 ml-auto" style={{ color: accentColor }} />}
                                        </button>
                                        <button
                                            onClick={() => { setCodeTheme('light'); setShowCodeThemeDropdown(false); }}
                                            className={clsx(
                                                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                                                codeTheme === 'light' && "bg-gray-100 dark:bg-gray-700"
                                            )}
                                        >
                                            <Sun className="w-4 h-4" />
                                            <span>Always Light</span>
                                            {codeTheme === 'light' && <Check className="w-3 h-3 ml-auto" style={{ color: accentColor }} />}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Notebook Title */}
                    <div className="flex items-center gap-3">
                        {editingTitle ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveTitle();
                                        if (e.key === 'Escape') setEditingTitle(false);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 text-sm font-medium"
                                    style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveTitle}
                                    className="p-1.5 rounded-lg text-white"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setEditingTitle(false)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setTitleInput(notebook.title);
                                    setEditingTitle(true);
                                }}
                                className="flex items-center gap-2 group text-sm"
                            >
                                <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                                    {notebook.title}
                                </span>
                                <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        )}

                        {/* Mode indicator */}
                        <div
                            className={clsx(
                                "px-2 py-1 rounded text-xs font-medium",
                                cellMode === 'command'
                                    ? "text-white"
                                    : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                            )}
                            style={cellMode === 'command' ? {
                                backgroundColor: `${accentColor}20`,
                                color: accentColor
                            } : undefined}
                        >
                            {cellMode === 'command' ? 'Command' : 'Edit'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Cells Container */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="w-full max-w-[95%] xl:max-w-[90%] mx-auto py-6 px-2">
                    <AnimatePresence>
                        {notebook.cells.map((cell, index) => {
                            const isSelected = selectedCellId === cell.id;
                            const isEditing = isSelected && cellMode === 'edit';

                            return (
                                <motion.div
                                    key={cell.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="group relative flex mb-2"
                                    onClick={() => {
                                        setSelectedCellId(cell.id);
                                        if (cellMode === 'edit') {
                                            textareaRefs.current[cell.id]?.focus();
                                        }
                                    }}
                                >
                                    {/* Left side - Execution count */}
                                    <div className="flex-shrink-0 w-16 flex items-start justify-end pr-2 pt-2">
                                        {cell.type === 'code' && (
                                            <span className="text-xs font-mono text-gray-400">
                                                [{index + 1}]:
                                            </span>
                                        )}
                                    </div>

                                    {/* Selection indicator bar */}
                                    <div
                                        className={clsx(
                                            "w-1 rounded-full mr-2 transition-colors",
                                            !isSelected && "bg-transparent group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                                        )}
                                        style={{
                                            backgroundColor: isSelected
                                                ? cellMode === 'command'
                                                    ? accentColor
                                                    : '#22c55e'
                                                : undefined
                                        }}
                                    />

                                    {/* Cell Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* Code cell header */}
                                        {cell.type === 'code' && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                    {detectLanguage(cell.content)}
                                                </span>
                                                {['python', 'py'].includes(detectLanguage(cell.content).toLowerCase()) && (
                                                    <span className={clsx(
                                                        "text-xs px-2 py-0.5 rounded",
                                                        pyodideLoading
                                                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                                                            : pyodideReady
                                                                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                                                : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                                                    )}>
                                                        {pyodideLoading ? "Loading Python..." : pyodideReady ? "Python Ready" : "Python (click Run)"}
                                                    </span>
                                                )}
                                                {/* Run button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRunCell(cell.id);
                                                    }}
                                                    disabled={cell.isExecuting}
                                                    className={clsx(
                                                        "p-1 rounded transition-colors",
                                                        cell.isExecuting
                                                            ? "text-gray-400 cursor-not-allowed"
                                                            : "text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                    )}
                                                    title="Run cell (Ctrl+Enter)"
                                                >
                                                    {cell.isExecuting ? (
                                                        <Square className="w-4 h-4" />
                                                    ) : (
                                                        <Play className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        {isEditing ? (
                                            <textarea
                                                ref={(el) => {
                                                    textareaRefs.current[cell.id] = el;
                                                    if (el) autoResizeTextarea(el);
                                                }}
                                                value={cell.content}
                                                onChange={(e) => {
                                                    handleUpdateCell(cell.id, e.target.value);
                                                    autoResizeTextarea(e.target);
                                                }}
                                                placeholder={
                                                    cell.type === 'markdown'
                                                        ? "Write markdown here..."
                                                        : cell.type === 'code'
                                                            ? "// Write code here..."
                                                            : "Start typing..."
                                                }
                                                className={clsx(
                                                    "w-full resize-none focus:outline-none",
                                                    cell.type === 'code'
                                                        ? clsx(
                                                            "font-mono text-sm rounded-lg px-4 py-3",
                                                            useCodeDarkTheme
                                                                ? "bg-gray-900 text-gray-100 placeholder-gray-500"
                                                                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                                        )
                                                        : "bg-transparent py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                                )}
                                                autoFocus
                                            />
                                        ) : (
                                            <div
                                                className={clsx(
                                                    "min-h-[2rem] cursor-text",
                                                    cell.type !== 'code' && "py-2",
                                                    !cell.content && "text-gray-400 italic"
                                                )}
                                                onClick={() => {
                                                    setSelectedCellId(cell.id);
                                                    setCellMode('edit');
                                                }}
                                            >
                                                {cell.content ? (
                                                    cell.type === 'markdown' ? (
                                                        <div
                                                            className="prose dark:prose-invert prose-sm max-w-none"
                                                            dangerouslySetInnerHTML={{
                                                                __html: renderMarkdownPreview(cell.content)
                                                            }}
                                                        />
                                                    ) : cell.type === 'code' ? (
                                                        <pre className={clsx(
                                                            "rounded-lg px-4 py-3 overflow-x-auto font-mono text-sm",
                                                            useCodeDarkTheme
                                                                ? "bg-gray-900 text-gray-100"
                                                                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                                        )}>
                                                            <code
                                                                dangerouslySetInnerHTML={{
                                                                    __html: highlightCode(cell.content, detectLanguage(cell.content))
                                                                }}
                                                            />
                                                        </pre>
                                                    ) : (
                                                        <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                                            {cell.content}
                                                        </div>
                                                    )
                                                ) : (
                                                    <span>Click to edit...</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Cell output */}
                                        {cell.output && (
                                            <div className={clsx(
                                                "mt-2 rounded-lg px-4 py-3 font-mono text-sm overflow-x-auto",
                                                cell.executionError
                                                    ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                                                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                                            )}>
                                                <pre className="whitespace-pre-wrap">{cell.output}</pre>
                                            </div>
                                        )}
                                    </div>

                                    {/* Cell actions (visible on hover) */}
                                    <div className="flex-shrink-0 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 pt-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCell(cell.id);
                                            }}
                                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Delete cell"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Add cell button at bottom */}
                    <div className="flex justify-center mt-4">
                        <button
                            onClick={() => handleAddCell('code', 'below')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add cell
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NerdbookEditor;
