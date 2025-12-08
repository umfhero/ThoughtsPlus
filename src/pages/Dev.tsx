import { useNotification } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { AlertTriangle, CheckCircle, Info, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';

interface DevPageProps {
    isMockMode: boolean;
    toggleMockMode: () => void;
}

export function DevPage({ isMockMode, toggleMockMode }: DevPageProps) {
    const { addNotification } = useNotification();
    const { accentColor } = useTheme();

    const testNotifications = [
        {
            type: 'success',
            title: 'Success Notification',
            message: 'This is a test success notification.',
            icon: CheckCircle
        },
        {
            type: 'info',
            title: 'Info Notification',
            message: 'This is a test info notification.',
            icon: Info
        },
        {
            type: 'warning',
            title: 'Warning Notification',
            message: 'This is a test warning notification.',
            icon: AlertTriangle
        },
        {
            type: 'error',
            title: 'Error Notification',
            message: 'This is a test error notification.',
            icon: AlertCircle
        }
    ];

    const triggerNotification = (type: string) => {
        const notif = testNotifications.find(n => n.type === type);
        if (notif) {
            addNotification({
                title: notif.title,
                message: notif.message,
                type: notif.type as any,
                duration: 5000,
                action: type === 'warning' ? {
                    label: 'Action',
                    onClick: () => console.log('Action clicked')
                } : undefined
            });
        }
    };

    return (
        <div className="h-full p-8 overflow-y-auto">
            <h1 className="text-3xl font-bold mb-8">Developer Tools</h1>

            <div className="grid gap-8 max-w-2xl">
                {/* Mock Mode Toggle */}
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-6 border border-white/20 dark:border-gray-700/30 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-semibold">Mock Dashboard</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Replace real data with mock tasks for screenshots/demos.
                            </p>
                        </div>
                        <button
                            onClick={toggleMockMode}
                            className="transition-colors hover:opacity-80"
                            style={{ color: isMockMode ? accentColor : 'inherit' }}
                        >
                            {isMockMode ? <ToggleRight size={40} /> : <ToggleLeft size={40} className="text-gray-400" />}
                        </button>
                    </div>
                    {isMockMode && (
                        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle size={16} />
                            Mock mode is active. Real data is hidden but safe.
                        </div>
                    )}
                </div>

                {/* Notification Tester */}
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-6 border border-white/20 dark:border-gray-700/30 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4">Test Notifications</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {testNotifications.map((notif) => (
                            <button
                                key={notif.type}
                                onClick={() => triggerNotification(notif.type)}
                                className="flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.02] active:scale-[0.98]"
                                style={{ 
                                    borderColor: 'rgba(0,0,0,0.1)',
                                    backgroundColor: 'rgba(255,255,255,0.5)'
                                }}
                            >
                                <notif.icon size={20} className={`text-${notif.type === 'error' ? 'red' : notif.type === 'warning' ? 'yellow' : notif.type === 'success' ? 'green' : 'blue'}-500`} />
                                <span className="font-medium capitalize">{notif.type}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
