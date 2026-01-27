import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getAppVersion } from '../utils/version';
import logoPng from '../assets/ThoughtsPlus.png';

interface UpdateInfo {
    available: boolean;
    latestVersion: string;
    currentVersion: string;
}

const CHECK_INTERVAL = 1000 * 60 * 60 * 4; // Every 4 hours
const LAST_CHECK_KEY = 'update_last_check';
const UPDATE_AVAILABLE_KEY = 'update_available_info'; // Cache update info

// Compare version strings (returns true if v1 > v2)
function isNewerVersion(v1: string, v2: string): boolean {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return true;
        if (p1 < p2) return false;
    }
    return false;
}

// Fetch version from GitHub version.json
async function fetchLatestVersion(): Promise<string | null> {
    try {
        const response = await fetch(
            'https://raw.githubusercontent.com/umfhero/ThoughtsPlus/main/version.json',
            { cache: 'no-store' }
        );

        if (!response.ok) {
            console.log('[UpdateCheck] Failed to fetch from GitHub');
            return null;
        }

        const data = await response.json();
        const version = data?.msstore_version;

        if (version) {
            console.log('[UpdateCheck] Found version from GitHub:', version);
            return version;
        }

        return null;
    } catch (err) {
        console.error('[UpdateCheck] Error fetching from GitHub:', err);
        return null;
    }
}

export function UpdateNotification({ isSidebarCollapsed = false }: { isSidebarCollapsed?: boolean }) {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const { accentColor } = useTheme();

    useEffect(() => {
        // Check cached update info first (instant display on startup)
        const cachedUpdate = localStorage.getItem(UPDATE_AVAILABLE_KEY);
        if (cachedUpdate) {
            try {
                const cached = JSON.parse(cachedUpdate);
                // Only show if the cached version is actually newer than current
                getAppVersion().then(currentVersion => {
                    if (isNewerVersion(cached.latestVersion, currentVersion)) {
                        setUpdateInfo(cached);
                        setIsVisible(true);
                        console.log('[UpdateCheck] Showing cached update notification');
                    } else {
                        // Clear stale cache if we're already on the latest version
                        console.log('[UpdateCheck] Already on latest version, clearing cache');
                        localStorage.removeItem(UPDATE_AVAILABLE_KEY);
                    }
                });
            } catch (e) {
                console.error('[UpdateCheck] Failed to parse cached update:', e);
            }
        }

        // Then check for updates (will update cache if needed)
        checkForUpdates();

        // Set up periodic check
        const interval = setInterval(checkForUpdates, CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    // Listen for force show event from Dev tools
    useEffect(() => {
        const handleForceShow = async () => {
            try {
                // Fetch the real latest version from GitHub
                const latestVersion = await fetchLatestVersion();
                const currentVersion = await getAppVersion();

                setUpdateInfo({
                    available: true,
                    latestVersion: latestVersion || 'New Version',
                    currentVersion
                });
                setIsVisible(true);
            } catch (err) {
                console.error('[UpdateCheck] Force show failed:', err);
            }
        };

        window.addEventListener('force-show-update-notification', handleForceShow);
        return () => window.removeEventListener('force-show-update-notification', handleForceShow);
    }, []);

    const checkForUpdates = async () => {
        try {
            // Check if we've checked recently to avoid excessive API calls
            const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
            const now = Date.now();

            if (lastCheck && now - parseInt(lastCheck) < CHECK_INTERVAL) {
                console.log('[UpdateCheck] Skipping check - checked recently');
                return;
            }

            // Fetch latest version from GitHub
            const latestVersion = await fetchLatestVersion();

            if (!latestVersion) {
                console.log('[UpdateCheck] No version found from GitHub');
                return;
            }

            // Get current version
            const currentVersion = await getAppVersion();

            // Save check timestamp
            localStorage.setItem(LAST_CHECK_KEY, now.toString());

            // Check if update is available
            if (isNewerVersion(latestVersion, currentVersion)) {
                const updateData = {
                    available: true,
                    latestVersion,
                    currentVersion
                };

                // Cache the update info so it shows on every startup
                localStorage.setItem(UPDATE_AVAILABLE_KEY, JSON.stringify(updateData));

                setUpdateInfo(updateData);
                setIsVisible(true);
            } else {
                // No update available, clear cache
                localStorage.removeItem(UPDATE_AVAILABLE_KEY);
            }
        } catch (error) {
            console.error('[UpdateCheck] Error checking for updates:', error);
        }
    };

    const handleUpdate = () => {
        // @ts-ignore - Electron API
        window.ipcRenderer?.invoke('open-external', 'ms-windows-store://downloadsandupdates');
        // Don't hide the notification - let it persist until they actually update
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // Clear the cached update info so it doesn't show again until next check
        localStorage.removeItem(UPDATE_AVAILABLE_KEY);
    };

    return (
        <AnimatePresence>
            {isVisible && updateInfo && (
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
                        {/* Animated accent color bar */}
                        <motion.div
                            className="h-1 w-full"
                            style={{ backgroundColor: accentColor }}
                            animate={{
                                opacity: [1, 0.7, 1],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeInOut'
                            }}
                        />

                        <div className="p-4">
                            <div className="flex items-center gap-4">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.05, 1],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                    }}
                                    className="p-2 rounded-xl"
                                    style={{ backgroundColor: `${accentColor}15` }}
                                >
                                    <img src={logoPng} alt="ThoughtsPlus" className="w-8 h-8" />
                                </motion.div>

                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Update Available!
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        v{updateInfo.latestVersion} is ready to install
                                    </p>
                                </div>

                                <button
                                    onClick={handleDismiss}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    aria-label="Dismiss"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            <div className="mt-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleUpdate}
                                    className="w-full py-3 px-4 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <Download className="w-4 h-4" />
                                    Update Now
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
