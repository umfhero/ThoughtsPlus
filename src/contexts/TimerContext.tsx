import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';

export interface TimerHistoryItem {
    id: string;
    duration: number; // in seconds
    label?: string;
    completedAt: Date;
    type: 'timer' | 'stopwatch';
}

interface ActiveTimer {
    id: string;
    type: 'timer' | 'stopwatch';
    duration: number; // total duration for timer, elapsed for stopwatch
    remaining: number; // remaining for timer, elapsed for stopwatch
    label?: string;
    isRunning: boolean;
    startedAt: Date;
}

interface TimerContextType {
    activeTimer: ActiveTimer | null;
    history: TimerHistoryItem[];
    isAlertVisible: boolean;

    // Timer actions
    startTimer: (seconds: number, label?: string) => void;
    startStopwatch: (label?: string) => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: () => void;
    dismissAlert: () => void;
    clearHistory: () => void;
    deleteHistoryItem: (id: string) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

// Audio for timer alert
const createBeepSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();

        // Beep pattern
        setTimeout(() => gainNode.gain.value = 0, 150);
        setTimeout(() => gainNode.gain.value = 0.3, 300);
        setTimeout(() => gainNode.gain.value = 0, 450);
        setTimeout(() => gainNode.gain.value = 0.3, 600);
        setTimeout(() => gainNode.gain.value = 0, 750);
        setTimeout(() => {
            oscillator.stop();
            audioContext.close();
        }, 800);
    } catch (e) {
        console.log('Audio not available');
    }
};

export function TimerProvider({ children }: { children: ReactNode }) {
    const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
    const [history, setHistory] = useState<TimerHistoryItem[]>([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [isAlertVisible, setIsAlertVisible] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const completedTimerIdRef = useRef<string | null>(null); // Track completed timer to prevent duplicates

    // Load history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('timer-history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setHistory(parsed.map((item: any) => ({
                    ...item,
                    completedAt: new Date(item.completedAt)
                })));
            } catch (e) {
                console.error('Failed to load timer history');
            }
        }
        setIsHistoryLoaded(true);
    }, []);

    // Save history to localStorage - only after initial load
    useEffect(() => {
        if (isHistoryLoaded) {
            localStorage.setItem('timer-history', JSON.stringify(history));
        }
    }, [history, isHistoryLoaded]);

    // Flash effect when timer completes
    const startFlashing = useCallback(() => {
        let isFlashing = true;
        flashIntervalRef.current = setInterval(() => {
            document.body.style.backgroundColor = isFlashing ? 'rgba(239, 68, 68, 0.1)' : '';
            isFlashing = !isFlashing;
        }, 500);

        // Stop flashing after 10 seconds
        setTimeout(() => {
            if (flashIntervalRef.current) {
                clearInterval(flashIntervalRef.current);
                document.body.style.backgroundColor = '';
            }
        }, 10000);
    }, []);

    const stopFlashing = useCallback(() => {
        if (flashIntervalRef.current) {
            clearInterval(flashIntervalRef.current);
            document.body.style.backgroundColor = '';
        }
    }, []);

    // Timer completion handler - add to history with duplicate prevention
    const handleTimerComplete = useCallback((timer: ActiveTimer) => {
        // Prevent duplicate entries by checking if we already completed this timer
        if (completedTimerIdRef.current === timer.id) {
            return;
        }
        completedTimerIdRef.current = timer.id;

        // Add to history
        const historyItem: TimerHistoryItem = {
            id: crypto.randomUUID(),
            duration: timer.duration,
            label: timer.label,
            completedAt: new Date(),
            type: timer.type
        };
        setHistory(prev => [historyItem, ...prev].slice(0, 50)); // Keep last 50

        // Show alert
        setIsAlertVisible(true);

        // Play sound
        createBeepSound();

        // Start flashing
        startFlashing();

        // Send system notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Timer Complete!', {
                body: timer.label || `${formatTime(timer.duration)} timer finished`,
                icon: '/calendar_icon_181520.png',
                requireInteraction: true
            });
        }

        // Flash taskbar (Electron)
        try {
            window.ipcRenderer?.invoke('flash-window');
        } catch (e) {
            console.log('Flash not available');
        }
    }, [startFlashing]);

    // Use ref for handleTimerComplete to avoid dependency in interval
    const handleTimerCompleteRef = useRef(handleTimerComplete);
    handleTimerCompleteRef.current = handleTimerComplete;

    // Timer tick effect
    useEffect(() => {
        if (!activeTimer?.isRunning) {
            return;
        }

        intervalRef.current = setInterval(() => {
            setActiveTimer(prev => {
                if (!prev || !prev.isRunning) return prev;

                if (prev.type === 'timer') {
                    const newRemaining = prev.remaining - 1;
                    if (newRemaining <= 0) {
                        // Timer complete - use ref to call handler
                        handleTimerCompleteRef.current(prev);
                        return null;
                    }
                    return { ...prev, remaining: newRemaining };
                } else {
                    // Stopwatch - count up
                    return { ...prev, remaining: prev.remaining + 1 };
                }
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [activeTimer?.isRunning, activeTimer?.id]);

    // Request notification permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const startTimer = useCallback((seconds: number, label?: string) => {
        // Reset completed timer tracker
        completedTimerIdRef.current = null;
        setActiveTimer({
            id: crypto.randomUUID(),
            type: 'timer',
            duration: seconds,
            remaining: seconds,
            label,
            isRunning: true,
            startedAt: new Date()
        });
        setIsAlertVisible(false);
        stopFlashing();
    }, [stopFlashing]);

    const startStopwatch = useCallback((label?: string) => {
        // Reset completed timer tracker
        completedTimerIdRef.current = null;
        setActiveTimer({
            id: crypto.randomUUID(),
            type: 'stopwatch',
            duration: 0,
            remaining: 0,
            label,
            isRunning: true,
            startedAt: new Date()
        });
        setIsAlertVisible(false);
        stopFlashing();
    }, [stopFlashing]);

    const pauseTimer = useCallback(() => {
        setActiveTimer(prev => prev ? { ...prev, isRunning: false } : null);
    }, []);

    const resumeTimer = useCallback(() => {
        setActiveTimer(prev => prev ? { ...prev, isRunning: true } : null);
    }, []);

    const stopTimer = useCallback(() => {
        if (activeTimer) {
            // Save to history when manually stopped (both timer and stopwatch)
            const elapsed = activeTimer.type === 'stopwatch'
                ? activeTimer.remaining
                : (activeTimer.duration - activeTimer.remaining);

            if (elapsed > 0) {
                const historyItem: TimerHistoryItem = {
                    id: crypto.randomUUID(),
                    duration: elapsed,
                    label: activeTimer.label,
                    completedAt: new Date(),
                    type: activeTimer.type
                };
                setHistory(prev => [historyItem, ...prev].slice(0, 50));
            }
        }
        setActiveTimer(null);
        setIsAlertVisible(false);
        stopFlashing();
    }, [activeTimer, stopFlashing]);

    const dismissAlert = useCallback(() => {
        setIsAlertVisible(false);
        stopFlashing();
    }, [stopFlashing]);

    const clearHistory = useCallback(() => {
        setHistory([]);
    }, []);

    const deleteHistoryItem = useCallback((id: string) => {
        setHistory(prev => prev.filter(item => item.id !== id));
    }, []);

    return (
        <TimerContext.Provider value={{
            activeTimer,
            history,
            isAlertVisible,
            startTimer,
            startStopwatch,
            pauseTimer,
            resumeTimer,
            stopTimer,
            dismissAlert,
            clearHistory,
            deleteHistoryItem
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimer() {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within TimerProvider');
    }
    return context;
}

// Helper function to format time
export function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeVerbose(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}
