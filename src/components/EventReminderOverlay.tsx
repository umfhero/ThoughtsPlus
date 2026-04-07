import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Clock, Calendar, ChevronRight, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Note } from '../types';

export interface ReminderAlert {
    id: string;
    noteId: string;
    date: string; // YYYY-MM-DD
    note: Note;
    triggeredAt: number; // timestamp
}

interface EventReminderOverlayProps {
    alerts: ReminderAlert[];
    onDismiss: (alertId: string) => void;
    onDismissAll: () => void;
    onViewEvent: (date: string, noteId: string) => void;
    isSidebarCollapsed?: boolean;
}

const importanceColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    high: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', dot: '#ef4444' },
    medium: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', dot: '#f59e0b' },
    low: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', dot: '#22c55e' },
    misc: { bg: 'bg-gray-50 dark:bg-gray-700/20', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-600 dark:text-gray-400', dot: '#9ca3af' },
};

function formatEventTime(time: string): string {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const use24 = localStorage.getItem('dashboard_use24HourTime') === 'true';
    if (use24) return time;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatReminderLabel(note: Note): string {
    const mins = (note as any)._triggerMinutes ?? (Array.isArray(note.reminder) ? note.reminder[0] : note.reminder);
    if (mins === 0) return 'Event starting now';
    if (mins === 1) return 'Event in 1 minute';
    if (mins != null && mins < 60) return `Event in ${mins} minutes`;
    if (mins === 60) return 'Event in 1 hour';
    if (mins != null && mins > 60 && mins < 1440) return `Event in ${Math.round(mins / 60)} hours`;
    if (mins === 1440) return 'Event in 1 day';
    return 'Event reminder';
}

export function EventReminderOverlay({ alerts, onDismiss, onDismissAll, onViewEvent, isSidebarCollapsed = false }: EventReminderOverlayProps) {
    const { accentColor } = useTheme();
    const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

    // Auto-expand the first alert
    useEffect(() => {
        if (alerts.length === 1) {
            setExpandedAlert(alerts[0].id);
        }
    }, [alerts.length]);

    const visibleAlerts = alerts.slice(0, 5); // Show max 5 at once

    return (
        <AnimatePresence>
            {visibleAlerts.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -100, scale: 0.9, left: '50%', x: '-50%' }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        x: isSidebarCollapsed ? '-50%' : 'calc(-50% + 105px)'
                    }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed top-4 left-1/2 z-[9997] w-auto min-w-80 max-w-md"
                >
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Animated accent bar */}
                        <motion.div
                            className="h-1 w-full"
                            style={{ backgroundColor: accentColor }}
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />

                        <div className="p-4">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-3">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.15, 1],
                                        rotate: [0, 8, -8, 0],
                                    }}
                                    transition={{
                                        duration: 0.6,
                                        repeat: Infinity,
                                        repeatDelay: 2
                                    }}
                                    className="p-2.5 rounded-xl"
                                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                                >
                                    <Bell className="w-5 h-5" />
                                </motion.div>

                                <div className="flex-1">
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                        {visibleAlerts.length === 1 ? 'Event Reminder' : `${alerts.length} Reminder${alerts.length !== 1 ? 's' : ''}`}
                                    </h3>
                                    {visibleAlerts.length === 1 && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatReminderLabel(visibleAlerts[0].note)}
                                        </p>
                                    )}
                                </div>

                                {alerts.length > 1 && (
                                    <button
                                        onClick={onDismissAll}
                                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        Dismiss all
                                    </button>
                                )}
                            </div>

                            {/* Alert cards */}
                            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                                {visibleAlerts.map((alert, index) => {
                                    const colors = importanceColors[alert.note.importance] || importanceColors.misc;
                                    const isExpanded = expandedAlert === alert.id || visibleAlerts.length === 1;

                                    return (
                                        <motion.div
                                            key={alert.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20, height: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}
                                        >
                                            <div
                                                className="flex items-center gap-3 p-3 cursor-pointer"
                                                onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                                            >
                                                {/* Importance dot */}
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: colors.dot }}
                                                />

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                        {alert.note.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Clock className="w-3 h-3 text-gray-400" />
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {formatEventTime(alert.note.time)}
                                                        </span>
                                                        {visibleAlerts.length > 1 && (
                                                            <span className={`text-xs ${colors.text}`}>
                                                                {formatReminderLabel(alert.note)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDismiss(alert.id);
                                                    }}
                                                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                                                >
                                                    <X className="w-4 h-4 text-gray-400" />
                                                </button>
                                            </div>

                                            {/* Expanded details */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="px-3 pb-3 space-y-2">
                                                            {alert.note.description && (
                                                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 pl-5">
                                                                    {alert.note.description}
                                                                </p>
                                                            )}
                                                            <div className="flex gap-2 pl-5">
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onViewEvent(alert.date, alert.noteId);
                                                                        onDismiss(alert.id);
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                                                                    style={{ backgroundColor: accentColor }}
                                                                >
                                                                    <Calendar className="w-3 h-3" />
                                                                    View Event
                                                                    <ChevronRight className="w-3 h-3" />
                                                                </motion.button>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onDismiss(alert.id);
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                    Dismiss
                                                                </motion.button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Show count if more than 5 */}
                            {alerts.length > 5 && (
                                <p className="text-xs text-gray-400 text-center mt-2">
                                    +{alerts.length - 5} more reminder{alerts.length - 5 !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
