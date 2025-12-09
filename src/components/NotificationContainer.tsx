import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useNotification, Notification } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';

const icons = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertCircle,
};

const NotificationItem = forwardRef<HTMLDivElement, { notification: Notification }>(({ notification }, ref) => {
    const { removeNotification } = useNotification();
    const { accentColor, theme } = useTheme();
    const Icon = icons[notification.type || 'info'];

    const typeColors = {
        info: accentColor,
        success: '#22c55e', // green-500
        warning: '#eab308', // yellow-500
        error: '#ef4444',   // red-500
    };

    const notificationColor = typeColors[notification.type || 'info'];

    // Convert hex to rgba for glass effect
    const getGlassColor = (hex: string, opacity: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const glassBg = theme === 'dark' 
        ? 'rgba(30, 30, 30, 0.7)' 
        : 'rgba(255, 255, 255, 0.7)';
    
    const borderColor = getGlassColor(notificationColor, 0.3);

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 500, damping: 30 }}
            className="pointer-events-auto mb-3 w-80 overflow-hidden rounded-xl border backdrop-blur-md shadow-lg"
            style={{
                backgroundColor: glassBg,
                borderColor: borderColor,
                boxShadow: `0 4px 20px -2px ${getGlassColor(notificationColor, 0.1)}`
            }}
        >
            <div className="relative p-4">
                <div className="flex items-start gap-3">
                    <div 
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-opacity-10"
                        style={{ backgroundColor: getGlassColor(notificationColor, 0.1) }}
                    >
                        <Icon size={18} style={{ color: notificationColor }} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#fff' : '#000' }}>
                            {notification.title}
                        </h3>
                        <p className="mt-1 text-xs opacity-80" style={{ color: theme === 'dark' ? '#ccc' : '#444' }}>
                            {notification.message}
                        </p>
                        {notification.action && (
                            <button
                                onClick={() => {
                                    notification.action?.onClick();
                                    removeNotification(notification.id);
                                }}
                                className="mt-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-opacity-20"
                                style={{ 
                                    backgroundColor: getGlassColor(notificationColor, 0.1),
                                    color: notificationColor
                                }}
                            >
                                {notification.action.label}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => removeNotification(notification.id)}
                        className="shrink-0 rounded-full p-1 opacity-50 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                    >
                        <X size={14} />
                    </button>
                </div>
                
                {/* Progress bar for timed notifications */}
                {notification.duration !== 0 && (
                    <motion.div
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: (notification.duration || 5000) / 1000, ease: "linear" }}
                        className="absolute bottom-0 left-0 h-0.5"
                        style={{ backgroundColor: notificationColor, opacity: 0.5 }}
                    />
                )}
            </div>
        </motion.div>
    );
});

export function NotificationContainer() {
    const { notifications } = useNotification();

    return (
        <div className="fixed right-4 top-4 z-[9999] flex flex-col items-end pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                ))}
            </AnimatePresence>
        </div>
    );
}
