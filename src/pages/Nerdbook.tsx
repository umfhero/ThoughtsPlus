import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronUp, ChevronDown,
    Type, Code, FileText, Sparkles, FolderOpen, Clock, Save, Scissors,
    Clipboard, Play, Square, Copy, ArrowUp, ArrowDown, RotateCcw, Terminal,
    Sun, Moon, Palette, Monitor
} from 'lucide-react';
import { NerdNotebook, NerdCell, NerdCellType, Page } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme for syntax highlighting
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

// Code theme options
type CodeTheme = 'auto' | 'dark' | 'light';

interface NerdbookPageProps {
    notebooks: NerdNotebook[];
    onAddNotebook: (notebook: NerdNotebook) => void;
    onUpdateNotebook: (notebook: NerdNotebook) => void;
    onDeleteNotebook: (notebookId: string) => void;
    setPage: (page: Page) => void;
}

type NerdbookView = 'list' | 'editor';
type CellMode = 'command' | 'edit';

// Color palette for notebooks
const NOTEBOOK_COLORS = [
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#f43f5e', // Rose
    '#84cc16', // Lime
];

export function NerdbookPage({
    notebooks,
    onAddNotebook,
    onUpdateNotebook,
    onDeleteNotebook,
    setPage
}: NerdbookPageProps) {
    const { accentColor, theme } = useTheme();
    const [currentView, setCurrentView] = useState<NerdbookView>('list');
    const [activeNotebook, setActiveNotebook] = useState<NerdNotebook | null>(null);
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
    const [cellMode, setCellMode] = useState<CellMode>('command');
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [clipboard, setClipboard] = useState<NerdCell | null>(null);
    const [deletedCells, setDeletedCells] = useState<{ cell: NerdCell; index: number }[]>([]);
    const [pendingDelete, setPendingDelete] = useState(false); // For 'dd' shortcut
    const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const [pyodideLoading, setPyodideLoading] = useState(false);
    const [pyodideReady, setPyodideReady] = useState(false);
    const pyodideRef = useRef<any>(null);

    // Code theme setting: 'auto' follows system theme, 'dark' always dark, 'light' always light
    const [codeTheme, setCodeTheme] = useState<CodeTheme>(() => {
        const saved = localStorage.getItem('nerdbook-code-theme');
        return (saved as CodeTheme) || 'auto';
    });
    const [showCodeThemeDropdown, setShowCodeThemeDropdown] = useState(false);
    const codeThemeDropdownRef = useRef<HTMLDivElement>(null);

    // Determine if code cells should use dark theme
    const useCodeDarkTheme = useMemo(() => {
        if (codeTheme === 'dark') return true;
        if (codeTheme === 'light') return false;
        return theme === 'dark'; // 'auto' follows system theme
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

    // Clear all outputs when opening a notebook (fresh start each time)
    useEffect(() => {
        if (activeNotebook && currentView === 'editor') {
            // Clear outputs when entering editor
            const hasOutputs = activeNotebook.cells.some(c => c.output);
            if (hasOutputs) {
                const clearedCells = activeNotebook.cells.map(c => ({
                    ...c,
                    output: undefined,
                    isExecuting: false,
                    executionError: undefined
                }));
                setActiveNotebook({
                    ...activeNotebook,
                    cells: clearedCells
                });
            }
        }
    }, [currentView]); // Only trigger when view changes

    // Create a new notebook
    const handleCreateNotebook = () => {
        const newNotebook: NerdNotebook = {
            id: crypto.randomUUID(),
            title: 'Untitled Notebook',
            cells: [
                {
                    id: crypto.randomUUID(),
                    type: 'code',
                    content: '',
                    createdAt: new Date().toISOString(),
                }
            ],
            createdAt: new Date().toISOString(),
            color: NOTEBOOK_COLORS[Math.floor(Math.random() * NOTEBOOK_COLORS.length)],
        };
        onAddNotebook(newNotebook);
        setActiveNotebook(newNotebook);
        setCurrentView('editor');
        setSelectedCellId(newNotebook.cells[0].id);
        setCellMode('edit');
    };

    // Create a test notebook with sample content
    const handleCreateTestNotebook = () => {
        const testNotebook: NerdNotebook = {
            id: crypto.randomUUID(),
            title: '🧪 Test Notebook - Sample Content',
            cells: [
                {
                    id: crypto.randomUUID(),
                    type: 'markdown',
                    content: `# Welcome to Nerdbook! 🚀

This is a **test notebook** with sample content for testing the Jupyter-style interface.

## Keyboard Shortcuts

### Command Mode (Escape)
- \`a\` - Insert cell above
- \`b\` - Insert cell below
- \`dd\` - Delete cell
- \`y\` - Change to code
- \`m\` - Change to markdown
- \`c\` - Copy cell
- \`x\` - Cut cell
- \`v\` - Paste cell
- \`z\` - Undo delete
- \`↑/k\` - Select above
- \`↓/j\` - Select below

### Edit Mode (Enter)
- \`Shift+Enter\` - Run & next
- \`Ctrl+Enter\` - Run & stay
- \`Alt+Enter\` - Run & insert below`,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: crypto.randomUUID(),
                    type: 'code',
                    content: `// JavaScript Code Example
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate first 10 Fibonacci numbers
const results = [];
for (let i = 0; i < 10; i++) {
    results.push(fibonacci(i));
}

console.log("Fibonacci sequence:", results);
// Output: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: crypto.randomUUID(),
                    type: 'markdown',
                    content: `## Data Visualization Ideas

Here are some things you could implement:

1. **Charts** - Line, bar, pie charts using libraries like Chart.js
2. **Tables** - Render data as formatted tables
3. **Diagrams** - Flowcharts, sequence diagrams with Mermaid.js
4. **Math** - LaTeX rendering with KaTeX or MathJax

### Example Mermaid Diagram (future feature)
\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
\`\`\``,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: crypto.randomUUID(),
                    type: 'code',
                    content: `// Python-style pseudocode
# Data processing example

data = [
    { "name": "Alice", "score": 95 },
    { "name": "Bob", "score": 87 },
    { "name": "Charlie", "score": 92 },
    { "name": "Diana", "score": 88 }
]

# Calculate average
total = sum(item["score"] for item in data)
average = total / len(data)

print(f"Average score: {average}")
# Output: Average score: 90.5`,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    content: `This is a plain TEXT cell. It's useful for quick notes without any formatting.

You can use it for:
• Scratch notes
• Quick thoughts
• Raw data
• Temporary storage`,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: crypto.randomUUID(),
                    type: 'code',
                    content: `# python
# Matplotlib Scatter Plot Example (Jupyter-style)
# Note: Python execution requires a Python kernel - this is for visual comparison

from matplotlib import pyplot as plt
import numpy as np

# Generate 100 random data points along 3 dimensions
x, y, scale = np.random.randn(3, 100)
fig, ax = plt.subplots()

# Map each onto a scatterplot we'll create with Matplotlib
ax.scatter(x=x, y=y, c=scale, s=np.abs(scale)*500)
ax.set(title="Some random data, created with JupyterLab!")
plt.show()`,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: crypto.randomUUID(),
                    type: 'code',
                    content: `// ASCII Art Diagram Example
/*
    ┌─────────────┐     ┌─────────────┐
    │   Input     │────▶│  Process    │
    └─────────────┘     └──────┬──────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Output     │
                        └──────────────┘
*/

// Simple state machine
const States = {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error'
};

let currentState = States.IDLE;
console.log(\`Current state: \${currentState}\`);`,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: crypto.randomUUID(),
                    type: 'markdown',
                    content: `---

## 🎯 Try These Tests

1. **Select cells** - Click on different cells
2. **Edit mode** - Press \`Enter\` to edit a cell
3. **Command mode** - Press \`Escape\` to go back
4. **Add cells** - Press \`b\` to add below, \`a\` to add above
5. **Delete cell** - Press \`d\` twice quickly
6. **Change type** - Press \`y\` for code, \`m\` for markdown
7. **Navigate** - Use arrow keys or \`j\`/\`k\`
8. **Copy/Paste** - Use \`c\` to copy, \`v\` to paste

---

*Happy coding! 🎉*`,
                    createdAt: new Date().toISOString(),
                },
            ],
            createdAt: new Date().toISOString(),
            color: '#8b5cf6', // Purple for test notebook
        };
        onAddNotebook(testNotebook);
        setActiveNotebook(testNotebook);
        setCurrentView('editor');
        setSelectedCellId(testNotebook.cells[0].id);
        setCellMode('command');
    };

    // Open a notebook for editing
    const handleOpenNotebook = (notebook: NerdNotebook) => {
        setActiveNotebook(notebook);
        setCurrentView('editor');
        if (notebook.cells.length > 0) {
            setSelectedCellId(notebook.cells[0].id);
        }
        setCellMode('command');
    };

    // Get selected cell index
    const getSelectedCellIndex = useCallback(() => {
        if (!activeNotebook || !selectedCellId) return -1;
        return activeNotebook.cells.findIndex(c => c.id === selectedCellId);
    }, [activeNotebook, selectedCellId]);

    // Add a new cell
    const handleAddCell = useCallback((type: NerdCellType, position: 'above' | 'below' = 'below', atCellId?: string) => {
        if (!activeNotebook) return;

        const newCell: NerdCell = {
            id: crypto.randomUUID(),
            type,
            content: '',
            createdAt: new Date().toISOString(),
        };

        // Use provided cell id or fall back to selected cell
        const targetCellId = atCellId || selectedCellId;
        const currentIndex = targetCellId
            ? activeNotebook.cells.findIndex(c => c.id === targetCellId)
            : getSelectedCellIndex();
        let insertIndex = position === 'above' ? currentIndex : currentIndex + 1;
        if (insertIndex < 0) insertIndex = activeNotebook.cells.length;

        const newCells = [
            ...activeNotebook.cells.slice(0, insertIndex),
            newCell,
            ...activeNotebook.cells.slice(insertIndex)
        ];

        const updatedNotebook = {
            ...activeNotebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setSelectedCellId(newCell.id);
        setCellMode('edit');
    }, [activeNotebook, selectedCellId, getSelectedCellIndex, onUpdateNotebook]);

    // Update a cell's content
    const handleUpdateCell = useCallback((cellId: string, content: string) => {
        if (!activeNotebook) return;

        const updatedCells = activeNotebook.cells.map(cell =>
            cell.id === cellId
                ? { ...cell, content, updatedAt: new Date().toISOString() }
                : cell
        );

        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
    }, [activeNotebook]);

    // Delete a cell
    const handleDeleteCell = useCallback((cellId: string) => {
        if (!activeNotebook || activeNotebook.cells.length <= 1) return;

        const cellIndex = activeNotebook.cells.findIndex(c => c.id === cellId);
        const cellToDelete = activeNotebook.cells[cellIndex];

        // Store for undo
        setDeletedCells(prev => [...prev, { cell: cellToDelete, index: cellIndex }]);

        const updatedCells = activeNotebook.cells.filter(c => c.id !== cellId);
        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);

        // Select next cell or previous if at end
        if (cellIndex < updatedCells.length) {
            setSelectedCellId(updatedCells[cellIndex].id);
        } else if (updatedCells.length > 0) {
            setSelectedCellId(updatedCells[updatedCells.length - 1].id);
        }
        setCellMode('command');
    }, [activeNotebook, onUpdateNotebook]);

    // Undo cell deletion
    const handleUndoDelete = useCallback(() => {
        if (!activeNotebook || deletedCells.length === 0) return;

        const { cell, index } = deletedCells[deletedCells.length - 1];
        setDeletedCells(prev => prev.slice(0, -1));

        const newCells = [
            ...activeNotebook.cells.slice(0, index),
            cell,
            ...activeNotebook.cells.slice(index)
        ];

        const updatedNotebook = {
            ...activeNotebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setSelectedCellId(cell.id);
    }, [activeNotebook, deletedCells, onUpdateNotebook]);

    // Duplicate cell
    const handleDuplicateCell = useCallback((cellId: string) => {
        if (!activeNotebook) return;

        const cellIndex = activeNotebook.cells.findIndex(c => c.id === cellId);
        const cellToDuplicate = activeNotebook.cells[cellIndex];

        const newCell: NerdCell = {
            ...cellToDuplicate,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };

        const newCells = [
            ...activeNotebook.cells.slice(0, cellIndex + 1),
            newCell,
            ...activeNotebook.cells.slice(cellIndex + 1)
        ];

        const updatedNotebook = {
            ...activeNotebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setSelectedCellId(newCell.id);
    }, [activeNotebook, onUpdateNotebook]);

    // Move cell up/down
    const handleMoveCell = useCallback((cellId: string, direction: 'up' | 'down') => {
        if (!activeNotebook) return;

        const cellIndex = activeNotebook.cells.findIndex(c => c.id === cellId);
        if (direction === 'up' && cellIndex === 0) return;
        if (direction === 'down' && cellIndex === activeNotebook.cells.length - 1) return;

        const newCells = [...activeNotebook.cells];
        const targetIndex = direction === 'up' ? cellIndex - 1 : cellIndex + 1;
        [newCells[cellIndex], newCells[targetIndex]] = [newCells[targetIndex], newCells[cellIndex]];

        const updatedNotebook = {
            ...activeNotebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
    }, [activeNotebook, onUpdateNotebook]);

    // Change cell type
    const handleChangeCellType = useCallback((cellId: string, newType: NerdCellType) => {
        if (!activeNotebook) return;

        const updatedCells = activeNotebook.cells.map(cell =>
            cell.id === cellId
                ? { ...cell, type: newType, updatedAt: new Date().toISOString() }
                : cell
        );

        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
    }, [activeNotebook, onUpdateNotebook]);

    // Cut cell
    const handleCutCell = useCallback(() => {
        if (!activeNotebook || !selectedCellId) return;
        const cell = activeNotebook.cells.find(c => c.id === selectedCellId);
        if (cell) {
            setClipboard({ ...cell });
            handleDeleteCell(selectedCellId);
        }
    }, [activeNotebook, selectedCellId, handleDeleteCell]);

    // Copy cell
    const handleCopyCell = useCallback(() => {
        if (!activeNotebook || !selectedCellId) return;
        const cell = activeNotebook.cells.find(c => c.id === selectedCellId);
        if (cell) {
            setClipboard({ ...cell });
        }
    }, [activeNotebook, selectedCellId]);

    // Paste cell
    const handlePasteCell = useCallback(() => {
        if (!activeNotebook || !clipboard) return;

        const newCell: NerdCell = {
            ...clipboard,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };

        const currentIndex = getSelectedCellIndex();
        const insertIndex = currentIndex >= 0 ? currentIndex + 1 : activeNotebook.cells.length;

        const newCells = [
            ...activeNotebook.cells.slice(0, insertIndex),
            newCell,
            ...activeNotebook.cells.slice(insertIndex)
        ];

        const updatedNotebook = {
            ...activeNotebook,
            cells: newCells,
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setSelectedCellId(newCell.id);
    }, [activeNotebook, clipboard, getSelectedCellIndex, onUpdateNotebook]);

    // Select cell above/below
    const selectAdjacentCell = useCallback((direction: 'up' | 'down') => {
        if (!activeNotebook) return;
        const currentIndex = getSelectedCellIndex();
        if (currentIndex < 0) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < activeNotebook.cells.length) {
            setSelectedCellId(activeNotebook.cells[newIndex].id);
        }
    }, [activeNotebook, getSelectedCellIndex]);

    // Save notebook title
    const handleSaveTitle = () => {
        if (!activeNotebook || !titleInput.trim()) return;

        const updatedNotebook = {
            ...activeNotebook,
            title: titleInput.trim(),
            updatedAt: new Date().toISOString(),
        };
        setActiveNotebook(updatedNotebook);
        onUpdateNotebook(updatedNotebook);
        setEditingTitle(false);
    };

    // Auto-save on blur or when navigating away
    const handleSaveNotebook = useCallback(() => {
        if (activeNotebook) {
            onUpdateNotebook(activeNotebook);
        }
    }, [activeNotebook, onUpdateNotebook]);

    // Debounce save
    useEffect(() => {
        if (!activeNotebook) return;
        const timeout = setTimeout(() => {
            handleSaveNotebook();
        }, 1000);
        return () => clearTimeout(timeout);
    }, [activeNotebook, handleSaveNotebook]);

    // Auto-resize textarea
    const autoResizeTextarea = (textarea: HTMLTextAreaElement | null) => {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Detect language from code content
    const detectLanguage = useCallback((content: string): string => {
        const firstLine = content.trim().split('\n')[0].toLowerCase();

        // Check for explicit language hints
        if (firstLine.includes('// javascript') || firstLine.includes('// js')) return 'javascript';
        if (firstLine.includes('// typescript') || firstLine.includes('// ts')) return 'typescript';
        if (firstLine.includes('# python') || firstLine.includes('# py')) return 'python';
        if (firstLine.includes('// css')) return 'css';
        if (firstLine.includes('// sql')) return 'sql';
        if (firstLine.includes('# bash') || firstLine.includes('# shell')) return 'bash';

        // Auto-detect based on patterns
        if (content.includes('import React') || content.includes('useState') || content.includes('const ') && content.includes('=>')) return 'javascript';
        if (content.includes('interface ') || content.includes(': string') || content.includes(': number')) return 'typescript';
        if (content.includes('def ') || content.includes('print(') || content.includes('import ') && !content.includes('from \'')) return 'python';
        if (content.includes('SELECT ') || content.includes('FROM ') || content.includes('WHERE ')) return 'sql';
        // More specific CSS detection - must have selector patterns and no JS keywords
        if (content.includes('{') && content.includes(':') && content.includes(';') &&
            !content.includes('function') && !content.includes('const') && !content.includes('let') &&
            !content.includes('var') && !content.includes('=>') && !content.includes('return')) return 'css';

        // Default to JavaScript
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
            // Check if script is already loaded, if not inject it
            if (!(window as any).loadPyodide) {
                console.log('Fetching Pyodide script from CDN...');
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
                    script.async = true;
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('Failed to load Pyodide script. Please check your internet connection.'));
                    document.body.appendChild(script);
                });
            }

            console.log('Initializing Pyodide...');
            // @ts-ignore - Pyodide loaded from CDN
            const pyodide = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            pyodideRef.current = pyodide;
            setPyodideReady(true);
            console.log('Pyodide loaded successfully');
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
        if (!activeNotebook) return;

        const cellIndex = activeNotebook.cells.findIndex(c => c.id === cellId);
        const cell = activeNotebook.cells[cellIndex];
        if (!cell || cell.type !== 'code') return;

        // Get the latest content - check textarea ref first (for when editing)
        const textareaEl = textareaRefs.current[cellId];
        const currentContent = textareaEl?.value || cell.content;

        // Detect language
        const detectedLang = detectLanguage(currentContent);
        const isPython = ['python', 'py'].includes(detectedLang.toLowerCase());
        const isNonExecutable = ['bash', 'shell', 'sql', 'css'].includes(detectedLang.toLowerCase());

        // Handle non-executable languages
        if (isNonExecutable) {
            setActiveNotebook(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    cells: prev.cells.map(c =>
                        c.id === cellId
                            ? {
                                ...c,
                                output: `[${detectedLang.toUpperCase()}] This language cannot be executed in the browser.\nOnly JavaScript and Python code can be run.`,
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

        // Set executing state immediately
        setActiveNotebook(prev => {
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
            // Execute Python with Pyodide
            try {
                let pyodide = pyodideRef.current;
                if (!pyodide) {
                    output = 'Downloading Python runtime (first run only)...';
                    setActiveNotebook(prev => {
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

                // Remove the "# python" hint if present
                let code = currentContent;
                if (code.startsWith('# python')) {
                    code = code.replace(/^# python\s*\n?/, '');
                }

                // Detect and install required packages
                const importRegex = /(?:from|import)\s+(\w+)/g;
                const imports = new Set<string>();
                let match;
                while ((match = importRegex.exec(code)) !== null) {
                    imports.add(match[1]);
                }

                // Common packages that need to be installed
                const installablePackages = ['numpy', 'matplotlib', 'pandas', 'scipy', 'scikit-learn', 'pillow'];
                const packagesToInstall = [...imports].filter(pkg => installablePackages.includes(pkg));

                if (packagesToInstall.length > 0) {
                    output = `Installing packages: ${packagesToInstall.join(', ')}...`;
                    setActiveNotebook(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            cells: prev.cells.map(c =>
                                c.id === cellId ? { ...c, output } : c
                            ),
                        };
                    });

                    // Install packages using micropip
                    await pyodide.loadPackage('micropip');
                    const micropip = pyodide.pyimport('micropip');
                    for (const pkg of packagesToInstall) {
                        try {
                            await micropip.install(pkg);
                        } catch (e) {
                            console.warn(`Failed to install ${pkg}:`, e);
                        }
                    }
                }

                // Redirect stdout
                await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
                `);

                // Check if matplotlib is being used and set up for inline display
                const usesMpl = imports.has('matplotlib') || code.includes('plt.') || code.includes('pyplot');
                if (usesMpl) {
                    await pyodide.runPythonAsync(`
import matplotlib
matplotlib.use('AGG')  # Use non-interactive backend
import matplotlib.pyplot as plt
import base64
from io import BytesIO

# Store original show function
_original_show = plt.show

def _capture_plot():
    """Capture current figure as base64 PNG"""
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='white')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    buf.close()
    plt.close('all')
    return f'[IMG:data:image/png;base64,{img_base64}]'

def _custom_show(*args, **kwargs):
    """Custom show that captures and prints the plot"""
    result = _capture_plot()
    print(result)

plt.show = _custom_show
                    `);
                }

                // Run the user's code
                const result = await pyodide.runPythonAsync(code);

                // Get stdout
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
            // Execute JavaScript
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
                // eslint-disable-next-line no-new-func
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

        // Update cell with output
        setActiveNotebook(prev => {
            if (!prev) return prev;
            const updatedNotebook = {
                ...prev,
                cells: prev.cells.map(c =>
                    c.id === cellId
                        ? {
                            ...c,
                            content: currentContent, // Update content in case it was edited
                            output: output,
                            isExecuting: false,
                            executionError: hasError,
                            updatedAt: new Date().toISOString()
                        }
                        : c
                ),
                updatedAt: new Date().toISOString(),
            };
            onUpdateNotebook(updatedNotebook);
            return updatedNotebook;
        });
    }, [activeNotebook, onUpdateNotebook, detectLanguage, loadPyodide]);

    // Clear cell output
    const handleClearOutput = useCallback((cellId: string) => {
        if (!activeNotebook) return;

        const updatedCells = activeNotebook.cells.map(c =>
            c.id === cellId
                ? { ...c, output: undefined, executionError: undefined }
                : c
        );

        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
        };
        setActiveNotebook(updatedNotebook);
    }, [activeNotebook]);

    // Stop cell execution (marks as not executing - actual interruption is limited in browser)
    const handleStopCell = useCallback((cellId: string) => {
        if (!activeNotebook) return;

        const updatedCells = activeNotebook.cells.map(c =>
            c.id === cellId
                ? { ...c, isExecuting: false, output: '(Execution stopped)', executionError: true }
                : c
        );

        const updatedNotebook = {
            ...activeNotebook,
            cells: updatedCells,
        };
        setActiveNotebook(updatedNotebook);
    }, [activeNotebook]);

    // Global keyboard shortcuts - block defaults and implement custom
    // Using capture: true to intercept events BEFORE App.tsx's handlers
    useEffect(() => {
        if (currentView !== 'editor' || !activeNotebook) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInTextarea = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
            const isContentEditable = target.getAttribute('contenteditable') === 'true';

            // ALWAYS stop propagation for navigation shortcuts when on Nerdbook page
            // This prevents Sidebar.tsx from handling these and navigating away
            if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
                // Check if user has text selected (e.g. in terminal output or code)
                // If so, let native copy/cut work and don't stop propagation
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    // Allow native clipboard operations for selected text
                    return;
                }

                // Always stop propagation to prevent global handlers from navigating
                e.stopPropagation();

                // In command mode (and no text selected), handle cell clipboard operations
                if (cellMode === 'command') {
                    e.preventDefault();
                    if (e.key.toLowerCase() === 'c') handleCopyCell();
                    if (e.key.toLowerCase() === 'x') handleCutCell();
                    if (e.key.toLowerCase() === 'v') handlePasteCell();
                    return;
                }
                // In edit mode (textarea focused), allow native clipboard to work
                return;
            }

            // Block Ctrl+M (AI Quick Add) on this page - we'll use 'm' for markdown cell type
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                e.stopPropagation();
                // In command mode, this will be handled by the 'm' shortcut below
                return;
            }

            // Block Ctrl+Enter (Quick Timer) - we use it for run cell
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                // Run cell handled in edit mode section below
            }

            // Save shortcut
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                e.stopPropagation();
                handleSaveNotebook();
                return;
            }

            // Escape - enter command mode
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setCellMode('command');
                // Blur any focused textarea
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                return;
            }

            // Enter - enter edit mode (only in command mode and not in input)
            if (e.key === 'Enter' && cellMode === 'command' && !isInTextarea && !isContentEditable) {
                e.preventDefault();
                e.stopPropagation();
                setCellMode('edit');
                // Focus the selected cell's textarea
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
                        e.stopPropagation();
                        handleAddCell('code', 'above');
                        break;
                    case 'b':
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddCell('code', 'below');
                        break;
                    case 'd':
                        e.stopPropagation();
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
                        e.stopPropagation();
                        if (selectedCellId) handleChangeCellType(selectedCellId, 'code');
                        break;
                    case 'm':
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedCellId) handleChangeCellType(selectedCellId, 'markdown');
                        break;
                    case 'z':
                        e.preventDefault();
                        e.stopPropagation();
                        handleUndoDelete();
                        break;
                    case 'arrowup':
                    case 'k':
                        e.preventDefault();
                        e.stopPropagation();
                        selectAdjacentCell('up');
                        break;
                    case 'arrowdown':
                    case 'j':
                        e.preventDefault();
                        e.stopPropagation();
                        selectAdjacentCell('down');
                        break;
                }
            }

            // Edit mode shortcuts
            if (cellMode === 'edit') {
                // Shift+Enter - run and select next
                if (e.shiftKey && e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Run the current cell
                    if (selectedCellId) {
                        const currentCell = activeNotebook.cells.find(c => c.id === selectedCellId);
                        if (currentCell?.type === 'code') {
                            handleRunCell(selectedCellId);
                        }
                    }
                    // Move to next cell
                    const currentIndex = getSelectedCellIndex();
                    if (currentIndex < activeNotebook.cells.length - 1) {
                        setSelectedCellId(activeNotebook.cells[currentIndex + 1].id);
                    } else {
                        // Add new cell at end
                        handleAddCell('code', 'below');
                    }
                    return;
                }

                // Ctrl+Enter - run and stay
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Run the current cell and stay
                    if (selectedCellId) {
                        const currentCell = activeNotebook.cells.find(c => c.id === selectedCellId);
                        if (currentCell?.type === 'code') {
                            handleRunCell(selectedCellId);
                        }
                    }
                    return;
                }

                // Alt+Enter - run and insert new below
                if (e.altKey && e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Run the current cell
                    if (selectedCellId) {
                        const currentCell = activeNotebook.cells.find(c => c.id === selectedCellId);
                        if (currentCell?.type === 'code') {
                            handleRunCell(selectedCellId);
                        }
                    }
                    handleAddCell('code', 'below');
                    return;
                }
            }
        };

        // Using capture: true ensures our handler fires BEFORE App.tsx's handlers
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [
        currentView, activeNotebook, cellMode, selectedCellId, pendingDelete,
        handleCopyCell, handleCutCell, handlePasteCell, handleSaveNotebook,
        handleAddCell, handleDeleteCell, handleChangeCellType, handleUndoDelete,
        selectAdjacentCell, getSelectedCellIndex, handleRunCell
    ]);

    // Format relative time
    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Filter notebooks
    const filteredNotebooks = useMemo(() => {
        if (!searchQuery.trim()) return notebooks;
        const query = searchQuery.toLowerCase();
        return notebooks.filter(nb =>
            nb.title.toLowerCase().includes(query) ||
            nb.cells.some(cell => cell.content.toLowerCase().includes(query))
        );
    }, [notebooks, searchQuery]);

    // Sorted notebooks (most recent first)
    const sortedNotebooks = useMemo(() => {
        return [...filteredNotebooks].sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt).getTime();
            return bTime - aTime;
        });
    }, [filteredNotebooks]);

    // Render markdown preview (simple version)
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

    // Cell type icons
    const getCellTypeIcon = (type: NerdCellType) => {
        switch (type) {
            case 'markdown': return FileText;
            case 'code': return Code;
            case 'text': default: return Type;
        }
    };

    // Cell type labels (kept for potential future use in UI)
    void function getCellTypeLabel(type: NerdCellType) {
        switch (type) {
            case 'markdown': return 'Markdown';
            case 'code': return 'Code';
            case 'text': default: return 'Text';
        }
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

    // Cell action button component
    const CellActionButton = ({ icon: Icon, onClick, title }: {
        icon: any;
        onClick: () => void;
        title: string;
    }) => (
        <button
            onMouseDown={(e) => {
                e.preventDefault(); // Prevent focus loss from textarea
                e.stopPropagation();
                onClick();
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title={title}
        >
            <Icon className="w-4 h-4" />
        </button>
    );

    return (
        <div ref={containerRef} className="h-screen flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
            <AnimatePresence mode="wait">
                {currentView === 'list' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full flex flex-col space-y-6 p-6"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setPage('notebook')}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Back to Notebook"
                                >
                                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                                <div
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                                    style={{ backgroundColor: accentColor, boxShadow: `0 10px 15px -3px ${accentColor}40` }}
                                >
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nerdbook</h1>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {notebooks.length} {notebooks.length === 1 ? 'notebook' : 'notebooks'}
                                    </p>
                                </div>
                            </div>

                            {/* Create Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCreateTestNotebook}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all hover:scale-105 hover:shadow-lg bg-purple-500 text-white"
                                    title="Create a test notebook with sample content"
                                >
                                    <span>🧪</span>
                                    <span>Test Notebook</span>
                                </button>
                                <button
                                    onClick={handleCreateNotebook}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-all hover:scale-105 hover:shadow-lg"
                                    style={{ backgroundColor: accentColor, boxShadow: `0 4px 12px ${accentColor}40` }}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>New Notebook</span>
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search notebooks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 pl-11 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 text-sm"
                                style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                            />
                            <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        {/* Notebooks Grid */}
                        <div className="flex-1 overflow-y-auto thin-scrollbar">
                            {sortedNotebooks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div
                                        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                                        style={{ backgroundColor: `${accentColor}15` }}
                                    >
                                        <Sparkles className="w-10 h-10" style={{ color: accentColor }} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {searchQuery ? 'No notebooks found' : 'No notebooks yet'}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
                                        {searchQuery
                                            ? 'Try a different search term'
                                            : 'Create your first Nerdbook to start capturing ideas with rich text, code, and diagrams!'
                                        }
                                    </p>
                                    {!searchQuery && (
                                        <button
                                            onClick={handleCreateNotebook}
                                            className="px-4 py-2 rounded-xl text-white font-medium transition-all hover:scale-105"
                                            style={{ backgroundColor: accentColor }}
                                        >
                                            Create Notebook
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sortedNotebooks.map((notebook, index) => (
                                        <motion.div
                                            key={notebook.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="group relative"
                                        >
                                            <button
                                                onClick={() => handleOpenNotebook(notebook)}
                                                className={clsx(
                                                    "w-full text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700",
                                                    "p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                                                )}
                                            >
                                                {/* Color accent bar */}
                                                <div
                                                    className="w-10 h-1 rounded-full mb-3"
                                                    style={{ backgroundColor: notebook.color || accentColor }}
                                                />

                                                <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                                                    {notebook.title}
                                                </h3>

                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                                                    {notebook.cells[0]?.content.slice(0, 100) || 'Empty notebook'}
                                                </p>

                                                <div className="flex items-center justify-between text-xs text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatRelativeTime(notebook.updatedAt || notebook.createdAt)}
                                                    </span>
                                                    <span>{notebook.cells.length} cells</span>
                                                </div>
                                            </button>

                                            {/* Delete button (hidden, shows on hover) */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (deleteConfirmId === notebook.id) {
                                                        onDeleteNotebook(notebook.id);
                                                        setDeleteConfirmId(null);
                                                    } else {
                                                        setDeleteConfirmId(notebook.id);
                                                        setTimeout(() => setDeleteConfirmId(null), 3000);
                                                    }
                                                }}
                                                className={clsx(
                                                    "absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                                                    deleteConfirmId === notebook.id
                                                        ? "bg-red-500 text-white"
                                                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-red-100 hover:text-red-500"
                                                )}
                                                title={deleteConfirmId === notebook.id ? "Click again to confirm" : "Delete notebook"}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full flex flex-col overflow-hidden"
                    >
                        {/* Sticky Top Toolbar - Jupyter Style */}
                        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2 overflow-hidden">
                                <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
                                    {/* Back button */}
                                    <button
                                        onClick={() => {
                                            handleSaveNotebook();
                                            setCurrentView('list');
                                            setActiveNotebook(null);
                                        }}
                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        title="Back to list"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    </button>

                                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                                    {/* Toolbar Actions */}
                                    <ToolbarButton icon={Save} onClick={handleSaveNotebook} title="Save (Ctrl+S)" />

                                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                                    <ToolbarButton icon={Plus} onClick={() => handleAddCell('code', 'below')} title="Add cell below (B)" />
                                    <ToolbarButton icon={Scissors} onClick={handleCutCell} disabled={!selectedCellId} title="Cut cell (X)" />
                                    <ToolbarButton icon={Copy} onClick={handleCopyCell} disabled={!selectedCellId} title="Copy cell (C)" />
                                    <ToolbarButton icon={Clipboard} onClick={handlePasteCell} disabled={!clipboard} title="Paste cell (V)" />

                                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                                    <ToolbarButton icon={ArrowUp} onClick={() => selectedCellId && handleMoveCell(selectedCellId, 'up')} disabled={!selectedCellId || getSelectedCellIndex() === 0} title="Move cell up" />
                                    <ToolbarButton icon={ArrowDown} onClick={() => selectedCellId && handleMoveCell(selectedCellId, 'down')} disabled={!selectedCellId || getSelectedCellIndex() === (activeNotebook?.cells.length || 0) - 1} title="Move cell down" />

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
                                                setTitleInput(activeNotebook?.title || '');
                                                setEditingTitle(true);
                                            }}
                                            className="flex items-center gap-2 group text-sm"
                                        >
                                            <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                                                {activeNotebook?.title}
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

                        {/* Cells Container - Jupyter Style */}
                        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                            <div className="w-full max-w-[95%] xl:max-w-[90%] mx-auto py-6 px-2">
                                <AnimatePresence>
                                    {activeNotebook?.cells.map((cell, index) => {
                                        const isSelected = selectedCellId === cell.id;
                                        const isEditing = isSelected && cellMode === 'edit';
                                        void getCellTypeIcon(cell.type); // Icon available for future use

                                        return (
                                            <motion.div
                                                key={cell.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="group relative flex mb-2"
                                                onClick={(e) => {
                                                    // Don't select cell if user is selecting text
                                                    const selection = window.getSelection();
                                                    if (selection && selection.toString().length > 0) {
                                                        return;
                                                    }

                                                    setSelectedCellId(cell.id);
                                                    if (cellMode === 'edit') {
                                                        textareaRefs.current[cell.id]?.focus();
                                                    }
                                                }}
                                            >
                                                {/* Left side - Execution count, selection indicator & actions */}
                                                <div className="flex-shrink-0 flex items-start gap-0.5 pt-2">
                                                    {/* Execution count for code cells */}
                                                    <div className="w-10 flex items-center justify-end pr-1">
                                                        {cell.type === 'code' && (
                                                            <span className="text-xs font-mono text-gray-400">
                                                                [{index + 1}]:
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Left-side action buttons - always visible */}
                                                    <div className="flex items-center gap-0.5">
                                                        {cell.type === 'code' && (
                                                            cell.isExecuting ? (
                                                                <CellActionButton
                                                                    icon={Square}
                                                                    onClick={() => handleStopCell(cell.id)}
                                                                    title="Stop execution"
                                                                />
                                                            ) : (
                                                                <CellActionButton
                                                                    icon={Play}
                                                                    onClick={() => handleRunCell(cell.id)}
                                                                    title="Run cell (Shift+Enter)"
                                                                />
                                                            )
                                                        )}
                                                        <CellActionButton
                                                            icon={Copy}
                                                            onClick={() => handleDuplicateCell(cell.id)}
                                                            title="Duplicate cell"
                                                        />
                                                        <CellActionButton
                                                            icon={ChevronUp}
                                                            onClick={() => handleMoveCell(cell.id, 'up')}
                                                            title="Move cell up"
                                                        />
                                                        <CellActionButton
                                                            icon={ChevronDown}
                                                            onClick={() => handleMoveCell(cell.id, 'down')}
                                                            title="Move cell down"
                                                        />
                                                        <CellActionButton
                                                            icon={Plus}
                                                            onClick={() => {
                                                                handleAddCell('code', 'below', cell.id);
                                                            }}
                                                            title="Insert cell below"
                                                        />
                                                    </div>
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
                                                                : '#22c55e' // green-500 for edit mode
                                                            : undefined
                                                    }}
                                                />

                                                {/* Cell Content */}
                                                <div className="flex-1 min-w-0">
                                                    {/* Code cell header with language badge */}
                                                    {cell.type === 'code' && (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                                {detectLanguage(cell.content)}
                                                            </span>
                                                            {/* Python status indicator */}
                                                            {['python', 'py'].includes(detectLanguage(cell.content).toLowerCase()) && (
                                                                <span className={clsx(
                                                                    "text-xs px-2 py-0.5 rounded",
                                                                    pyodideLoading
                                                                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                                                                        : pyodideReady
                                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                                                            : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                                                                )}>
                                                                    {pyodideLoading ? "Loading Python..." : pyodideReady ? "Python Ready" : "Python (click Run to load)"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isEditing ? (
                                                        // Edit mode - regular textarea for all cell types
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
                                                            onBlur={handleSaveNotebook}
                                                            placeholder={
                                                                cell.type === 'markdown'
                                                                    ? "Write markdown here... (# Heading, **bold**, *italic*, `code`)"
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
                                                        // View mode - syntax highlighted for code, rendered for markdown
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
                                                                            className={clsx(
                                                                                `language-${detectLanguage(cell.content)}`,
                                                                                !useCodeDarkTheme && "prism-light"
                                                                            )}
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: highlightCode(cell.content, detectLanguage(cell.content))
                                                                            }}
                                                                        />
                                                                    </pre>
                                                                ) : (
                                                                    <pre className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">{cell.content}</pre>
                                                                )
                                                            ) : (
                                                                'Click to edit...'
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Output display for code cells */}
                                                    {cell.type === 'code' && cell.output && (
                                                        <div className="mt-2">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                                    <Terminal className="w-3 h-3" />
                                                                    <span>Output</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRunCell(cell.id);
                                                                        }}
                                                                        className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-medium"
                                                                    >
                                                                        Re-run
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleClearOutput(cell.id);
                                                                        }}
                                                                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                                                    >
                                                                        Close
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div
                                                                className={clsx(
                                                                    "rounded-lg px-4 py-3 overflow-auto",
                                                                    "max-h-[500px]", // Increased for images
                                                                    "select-text cursor-text",
                                                                    useCodeDarkTheme
                                                                        ? clsx(
                                                                            "bg-gray-900",
                                                                            cell.executionError
                                                                                ? "border border-red-500/50 text-red-400"
                                                                                : "text-green-400"
                                                                        )
                                                                        : clsx(
                                                                            "bg-gray-100",
                                                                            cell.executionError
                                                                                ? "border border-red-500/50 text-red-600"
                                                                                : "text-green-600"
                                                                        )
                                                                )}
                                                                style={{ userSelect: 'text' }}
                                                            >
                                                                {/* Render output with image support */}
                                                                {cell.output.split('\n').map((line, idx) => {
                                                                    // Check for embedded image
                                                                    const imgMatch = line.match(/\[IMG:(data:image\/[^;]+;base64,[^\]]+)\]/);
                                                                    if (imgMatch) {
                                                                        return (
                                                                            <img
                                                                                key={idx}
                                                                                src={imgMatch[1]}
                                                                                alt="Plot output"
                                                                                className="max-w-full rounded my-2"
                                                                                style={{ maxHeight: '400px' }}
                                                                            />
                                                                        );
                                                                    }
                                                                    return (
                                                                        <pre
                                                                            key={idx}
                                                                            className="font-mono text-sm whitespace-pre-wrap break-words select-text"
                                                                            style={{ userSelect: 'text' }}
                                                                        >{line}</pre>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right side - Cell type selector & delete (visible on hover/selection) */}
                                                <div className={clsx(
                                                    "flex-shrink-0 flex items-start gap-0.5 ml-2 pt-1 transition-opacity",
                                                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )}>
                                                    {/* Cell Type Selector */}
                                                    <select
                                                        value={cell.type}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            handleChangeCellType(cell.id, e.target.value as NerdCellType);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="px-1.5 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 border-none focus:outline-none text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                        title="Cell type"
                                                    >
                                                        <option value="code">Code</option>
                                                        <option value="markdown">Markdown</option>
                                                        <option value="text">Text</option>
                                                    </select>
                                                    {activeNotebook.cells.length > 1 && (
                                                        <CellActionButton
                                                            icon={Trash2}
                                                            onClick={() => handleDeleteCell(cell.id)}
                                                            title="Delete cell (D D)"
                                                        />
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>

                                {/* Quick add button at bottom */}
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => handleAddCell('code', 'below')}
                                    className="w-full py-3 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-all flex items-center justify-center gap-2 mt-4"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="text-sm">Add cell</span>
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
