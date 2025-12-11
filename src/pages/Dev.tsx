import { useNotification } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { AlertTriangle, CheckCircle, Info, AlertCircle, ToggleLeft, ToggleRight, Trash2, RefreshCw, Rocket, Bell, MousePointerClick } from 'lucide-react';

interface DevPageProps {
    isMockMode: boolean;
    toggleMockMode: () => void;
    onForceSetup: () => void;
}

export function DevPage({ isMockMode, toggleMockMode, onForceSetup }: DevPageProps) {
    const { addNotification } = useNotification();
    const { accentColor } = useTheme();

    const testNotifications = [
        {
            type: 'success',
            title: 'Success Notification',
            message: 'This is a test success notification.',
            icon: CheckCircle,
            color: 'text-green-500'
        },
        {
            type: 'info',
            title: 'Info Notification',
            message: 'This is a test info notification.',
            icon: Info,
            color: 'text-blue-500'
        },
        {
            type: 'warning',
            title: 'Warning Notification',
            message: 'This is a test warning notification.',
            icon: AlertTriangle,
            color: 'text-yellow-500'
        },
        {
            type: 'error',
            title: 'Error Notification',
            message: 'This is a test error notification.',
            icon: AlertCircle,
            color: 'text-red-500'
        }
    ];

    const appNotifications = [
        {
            title: 'Setup Required',
            message: 'Please configure your API Key in settings to enable AI features.',
            type: 'warning',
            action: { label: 'Go to Settings', onClick: () => { } }
        },
        {
            title: 'GitHub Integration',
            message: 'Connect your GitHub account to track your contributions.',
            type: 'info',
            action: { label: 'Connect', onClick: () => { } }
        },
        {
            title: 'Run on Startup',
            message: 'Enable auto-launch to never miss your schedule.',
            type: 'info',
            action: { label: 'Enable', onClick: () => { } }
        },
        {
            title: 'Customize Dashboard',
            message: 'Press & Hold to Edit your dashboard layout.',
            type: 'info',
            icon: MousePointerClick
        },
        {
            title: 'Quick Tip',
            message: 'Press Ctrl+M anywhere to create a quick note instantly.',
            type: 'info'
        },
        {
            title: 'Note Added',
            message: '"Team Meeting" has been added to your calendar.',
            type: 'success'
        },
        {
            title: 'Settings Saved',
            message: 'User name updated successfully.',
            type: 'success'
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

    const triggerAppNotification = (notif: any) => {
        addNotification({
            ...notif,
            duration: 5000
        });
    };

    const clearLocalStorage = () => {
        if (confirm('Are you sure you want to clear all local storage? This will reset feature toggles and other local settings.')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const resetSetup = async () => {
        if (confirm('Are you sure you want to reset the setup wizard?')) {
            // @ts-ignore
            await window.ipcRenderer.invoke('reset-setup');
            window.location.reload();
        }
    };

    return (
        <div className="h-full p-8 overflow-y-auto">
            <h1 className="text-3xl font-bold mb-8">Developer Tools</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-7xl mx-auto">
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

                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Generic Types</h3>
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
                                    <notif.icon size={20} className={notif.color} />
                                    <span className="font-medium capitalize">{notif.type}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">App Scenarios</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {appNotifications.map((notif, index) => (
                                <button
                                    key={index}
                                    onClick={() => triggerAppNotification(notif)}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors text-left"
                                >
                                    <Bell size={16} className="text-gray-500" />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{notif.title}</div>
                                        <div className="text-xs opacity-70 truncate">{notif.message}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Dashboard Tools */}
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-6 border border-blue-200 dark:border-blue-800/30 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">Dashboard Tools</h2>
                    <div className="space-y-4">
                        <button
                            onClick={() => {
                                localStorage.removeItem('dashboard_order');
                                localStorage.removeItem('dashboard_hidden_widgets');
                                addNotification({
                                    title: 'Layout Reset',
                                    message: 'Dashboard layout has been reset to default.',
                                    type: 'success',
                                    duration: 3000
                                });
                            }}
                            className="w-full flex items-center gap-3 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30 bg-white/50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-blue-600 dark:text-blue-400"
                        >
                            <RefreshCw size={20} />
                            <div className="text-left">
                                <div className="font-medium">Reset Layout</div>
                                <div className="text-xs opacity-80">Restores default widget order and visibility</div>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                localStorage.removeItem('dashboard_edit_tip_shown');
                                addNotification({
                                    title: 'Tip Reset',
                                    message: 'Edit mode tip will appear next time you visit Dashboard.',
                                    type: 'info',
                                    duration: 3000
                                });
                            }}
                            className="w-full flex items-center gap-3 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30 bg-white/50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-blue-600 dark:text-blue-400"
                        >
                            <MousePointerClick size={20} />
                            <div className="text-left">
                                <div className="font-medium">Reset "Edit Tip" History</div>
                                <div className="text-xs opacity-80">Forces the "Press & Hold" helper to show again</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-6 border border-red-200 dark:border-red-800/30 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Danger Zone</h2>
                    <div className="space-y-4">
                        <button
                            onClick={onForceSetup}
                            className="w-full flex items-center gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800/30 bg-white/50 dark:bg-gray-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                        >
                            <Rocket size={20} />
                            <div className="text-left">
                                <div className="font-medium">Force Onboarding (Demo Mode)</div>
                                <div className="text-xs opacity-80">Launch the setup wizard safely without overwriting your settings</div>
                            </div>
                        </button>

                        <button
                            onClick={clearLocalStorage}
                            className="w-full flex items-center gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800/30 bg-white/50 dark:bg-gray-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                        >
                            <Trash2 size={20} />
                            <div className="text-left">
                                <div className="font-medium">Clear All Local Storage</div>
                                <div className="text-xs opacity-80">Resets EVERYTHING: features, settings, dashboard, etc.</div>
                            </div>
                        </button>

                        <button
                            onClick={resetSetup}
                            className="w-full flex items-center gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800/30 bg-white/50 dark:bg-gray-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                        >
                            <RefreshCw size={20} />
                            <div className="text-left">
                                <div className="font-medium">Reset Setup Wizard</div>
                                <div className="text-xs opacity-80">Forces the setup wizard to run again on next launch</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
