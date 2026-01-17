import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Check, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface TableEditorProps {
    isOpen: boolean;
    onClose: () => void;
    initialMarkdown: string;
    onSave: (markdown: string) => void;
}

interface TableData {
    headers: string[];
    rows: string[][];
}

// Parse markdown table to structured data
function parseMarkdownTable(markdown: string): TableData | null {
    const lines = markdown.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;

    const headerLine = lines[0];
    const separatorLine = lines[1];

    // Check if it's a valid table (has separator with dashes)
    if (!separatorLine.includes('-')) return null;

    const headers = headerLine.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);

    const rows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);
        if (cells.length > 0) {
            // Ensure row has same number of cells as headers
            while (cells.length < headers.length) cells.push('');
            rows.push(cells.slice(0, headers.length));
        }
    }

    return { headers, rows };
}

// Convert structured data back to markdown table
function toMarkdownTable(data: TableData): string {
    const { headers, rows } = data;
    if (headers.length === 0) return '';

    // Header row
    const headerRow = '| ' + headers.join(' | ') + ' |';

    // Separator row
    const separator = '| ' + headers.map(() => '--------').join(' | ') + ' |';

    // Data rows
    const dataRows = rows.map(row => {
        // Ensure row has same length as headers
        const paddedRow = [...row];
        while (paddedRow.length < headers.length) paddedRow.push('');
        return '| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |';
    });

    return [headerRow, separator, ...dataRows].join('\n');
}

// Parse pasted content (Excel/Google Sheets format: tab-separated)
function parsePastedContent(text: string): TableData | null {
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;

    // Detect delimiter (tab for Excel/Sheets, comma for CSV)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';

    const allRows = lines.map(line =>
        line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''))
    );

    if (allRows.length === 0 || allRows[0].length === 0) return null;

    // First row as headers
    const headers = allRows[0];
    const rows = allRows.slice(1);

    return { headers, rows };
}

export function TableEditor({ isOpen, onClose, initialMarkdown, onSave }: TableEditorProps) {
    const { accentColor } = useTheme();
    const [tableData, setTableData] = useState<TableData>({ headers: ['Column 1', 'Column 2', 'Column 3'], rows: [['', '', '']] });
    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    useEffect(() => {
        if (isOpen && initialMarkdown) {
            const parsed = parseMarkdownTable(initialMarkdown);
            if (parsed) {
                setTableData(parsed);
            } else {
                // Try parsing as pasted content
                const pasted = parsePastedContent(initialMarkdown);
                if (pasted) {
                    setTableData(pasted);
                }
            }
        }
    }, [isOpen, initialMarkdown]);

    // Handle paste event anywhere in the modal
    const handlePaste = useCallback((e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text');
        if (!text) return;

        const parsed = parsePastedContent(text);
        if (parsed && parsed.headers.length > 1) {
            e.preventDefault();
            setTableData(parsed);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('paste', handlePaste);
            return () => document.removeEventListener('paste', handlePaste);
        }
    }, [isOpen, handlePaste]);

    const updateHeader = (index: number, value: string) => {
        setTableData(prev => ({
            ...prev,
            headers: prev.headers.map((h, i) => i === index ? value : h)
        }));
    };

    const updateCell = (rowIndex: number, colIndex: number, value: string) => {
        setTableData(prev => ({
            ...prev,
            rows: prev.rows.map((row, ri) =>
                ri === rowIndex
                    ? row.map((cell, ci) => ci === colIndex ? value : cell)
                    : row
            )
        }));
    };

    const addColumn = () => {
        setTableData(prev => ({
            headers: [...prev.headers, `Column ${prev.headers.length + 1}`],
            rows: prev.rows.map(row => [...row, ''])
        }));
    };

    const removeColumn = (index: number) => {
        if (tableData.headers.length <= 1) return;
        setTableData(prev => ({
            headers: prev.headers.filter((_, i) => i !== index),
            rows: prev.rows.map(row => row.filter((_, i) => i !== index))
        }));
    };

    const addRow = () => {
        setTableData(prev => ({
            ...prev,
            rows: [...prev.rows, new Array(prev.headers.length).fill('')]
        }));
    };

    const removeRow = (index: number) => {
        if (tableData.rows.length <= 1) return;
        setTableData(prev => ({
            ...prev,
            rows: prev.rows.filter((_, i) => i !== index)
        }));
    };

    const moveRow = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= tableData.rows.length) return;

        setTableData(prev => {
            const newRows = [...prev.rows];
            [newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
            return { ...prev, rows: newRows };
        });
    };

    const moveColumn = (index: number, direction: 'left' | 'right') => {
        const newIndex = direction === 'left' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= tableData.headers.length) return;

        setTableData(prev => {
            const newHeaders = [...prev.headers];
            [newHeaders[index], newHeaders[newIndex]] = [newHeaders[newIndex], newHeaders[index]];

            const newRows = prev.rows.map(row => {
                const newRow = [...row];
                [newRow[index], newRow[newIndex]] = [newRow[newIndex], newRow[index]];
                return newRow;
            });

            return { headers: newHeaders, rows: newRows };
        });
    };

    const handleSave = () => {
        const markdown = toMarkdownTable(tableData);
        onSave(markdown);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number, isHeader: boolean) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
            const nextRow = isHeader ? 0 : rowIndex;

            if (nextCol >= 0 && nextCol < tableData.headers.length) {
                const key = isHeader ? `header-${nextCol}` : `cell-${nextRow}-${nextCol}`;
                inputRefs.current[key]?.focus();
            } else if (!isHeader) {
                // Move to next/prev row
                const targetRow = e.shiftKey ? rowIndex - 1 : rowIndex + 1;
                const targetCol = e.shiftKey ? tableData.headers.length - 1 : 0;
                if (targetRow >= 0 && targetRow < tableData.rows.length) {
                    inputRefs.current[`cell-${targetRow}-${targetCol}`]?.focus();
                }
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isHeader && rowIndex < tableData.rows.length - 1) {
                inputRefs.current[`cell-${rowIndex + 1}-${colIndex}`]?.focus();
            } else if (!isHeader && rowIndex === tableData.rows.length - 1) {
                addRow();
                setTimeout(() => {
                    inputRefs.current[`cell-${rowIndex + 1}-${colIndex}`]?.focus();
                }, 50);
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Table</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Paste from Excel/Sheets or edit cells directly
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Table Editor */}
                        <div className="p-4 overflow-auto max-h-[60vh]">
                            <div className="min-w-max">
                                <table className="w-full border-collapse">
                                    {/* Column Controls */}
                                    <thead>
                                        <tr>
                                            <th className="w-10"></th>
                                            {tableData.headers.map((_, colIndex) => (
                                                <th key={colIndex} className="px-1 pb-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => moveColumn(colIndex, 'left')}
                                                            disabled={colIndex === 0}
                                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                                                        >
                                                            <ArrowLeft className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => removeColumn(colIndex)}
                                                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                                            title="Remove column"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => moveColumn(colIndex, 'right')}
                                                            disabled={colIndex === tableData.headers.length - 1}
                                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                                                        >
                                                            <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="w-10">
                                                <button
                                                    onClick={addColumn}
                                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    title="Add column"
                                                >
                                                    <Plus className="w-4 h-4 text-gray-500" />
                                                </button>
                                            </th>
                                        </tr>
                                        {/* Headers */}
                                        <tr>
                                            <th className="w-10"></th>
                                            {tableData.headers.map((header, colIndex) => (
                                                <th key={colIndex} className="p-1">
                                                    <input
                                                        ref={el => inputRefs.current[`header-${colIndex}`] = el}
                                                        type="text"
                                                        value={header}
                                                        onChange={(e) => updateHeader(colIndex, e.target.value)}
                                                        onKeyDown={(e) => handleKeyDown(e, -1, colIndex, true)}
                                                        className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:border-blue-500 dark:focus:border-blue-400 font-semibold text-center outline-none transition-colors"
                                                        placeholder={`Header ${colIndex + 1}`}
                                                    />
                                                </th>
                                            ))}
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    {/* Body */}
                                    <tbody>
                                        {tableData.rows.map((row, rowIndex) => (
                                            <tr key={rowIndex} className="group">
                                                <td className="w-10 pr-2">
                                                    <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => moveRow(rowIndex, 'up')}
                                                            disabled={rowIndex === 0}
                                                            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                                                        >
                                                            <ArrowUp className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => removeRow(rowIndex)}
                                                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                                            title="Remove row"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => moveRow(rowIndex, 'down')}
                                                            disabled={rowIndex === tableData.rows.length - 1}
                                                            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                                                        >
                                                            <ArrowDown className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                                {row.map((cell, colIndex) => (
                                                    <td key={colIndex} className="p-1">
                                                        <input
                                                            ref={el => inputRefs.current[`cell-${rowIndex}-${colIndex}`] = el}
                                                            type="text"
                                                            value={cell}
                                                            onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex, false)}
                                                            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors"
                                                            placeholder="..."
                                                        />
                                                    </td>
                                                ))}
                                                <td className="w-10"></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Add Row Button */}
                                <button
                                    onClick={addRow}
                                    className="mt-2 w-full py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Row
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Tip: Paste from Excel or Google Sheets to import data
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 rounded-xl text-white font-medium transition-colors flex items-center gap-2"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <Check className="w-4 h-4" />
                                    Apply Changes
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
