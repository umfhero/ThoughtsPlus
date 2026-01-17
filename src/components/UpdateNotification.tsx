import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getAppVersion } from '../utils/version';
import logoPng from '../assets/Thoughts+.png';

interface UpdateInfo {
    available: boolean;
    latestVersion: string;
    currentVersion: string;
}

const CHECK_INTERVAL = 1000 * 60 * 60 * 4; // Every 4 hours
const DISMISS_KEY = 'update_notification_dismissed';
const LAST_CHECK_KEY = 'update_last_check';

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

// Microsoft Store App ID
const MS_STORE_APP_ID = '9NB8VZFWNV81';

// Fetch version from GitHub version.json (always works, synced daily)
async function fetchGitHubVersion(): Promise<string | null> {
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

// Fetch version directly from Microsoft Store API (with GitHub fallback)
async function fetchMicrosoftStoreVersion(): Promise<string | null> {
    try {
        const response = await fetch(
            `https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${MS_STORE_APP_ID}?market=US&locale=en-US&deviceFamily=Windows.Desktop`,
            { cache: 'no-store' }
        );

        if (!response.ok) {
            console.log('[UpdateCheck] MS Store API error, trying GitHub fallback');
            return await fetchGitHubVersion();
        }

        const data = await response.json();

        // Try to extract version from the Notes field
        // Format is typically "vX.X.X - Description" at the start
        const notes = data?.Payload?.Notes?.[0] || '';

        // Match "vX.X.X" at the start of the notes (e.g., "v5.7.1 - The board functionality...")
        const versionMatch = notes.match(/^v(\d+\.\d+\.\d+)/i);

        if (versionMatch && versionMatch[1]) {
            console.log('[UpdateCheck] Found MS Store version:', versionMatch[1]);
            return versionMatch[1];
        }

        // Fallback: try to get from Skus or other fields
        const skus = data?.Payload?.Skus || [];
        for (const sku of skus) {
            if (sku?.Properties?.Version) {
                console.log('[UpdateCheck] Found version from SKU:', sku.Properties.Version);
                return sku.Properties.Version;
            }
        }

        console.log('[UpdateCheck] Could not extract from Store, trying GitHub');
        return await fetchGitHubVersion();
    } catch (err) {
        console.error('[UpdateCheck] Error fetching from MS Store, trying GitHub:', err);
        return await fetchGitHubVersion();
    }
}

export function UpdateNotification({ isSidebarCollapsed = false }: { isSidebarCollapsed?: boolean }) {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const { accentColor } = useTheme();

    useEffect(() => {
        checkForUpdates();

        // Set up periodic check
        const interval = setInterval(checkForUpdates, CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    // Listen for force show event from Dev tools
    useEffect(() => {
        const handleForceShow = async () => {
            try {
                // Fetch the real latest version from Microsoft Store
                const latestVersion = await fetchMicrosoftStoreVersion();
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
            // Check if we've checked recently
            const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
            const now = Date.now();

            if (lastCheck && now - parseInt(lastCheck) < CHECK_INTERVAL) {
                // Use cached result if we checked recently and user dismissed
                const dismissed = localStorage.getItem(DISMISS_KEY);
                if (dismissed) {
                    const dismissedData = JSON.parse(dismissed);
                    // Only stay dismissed if it's for the same version
                    if (dismissedData.version && dismissedData.timestamp) {
                        return;
                    }
                }
            }

            // Fetch latest version directly from Microsoft Store
            const latestVersion = await fetchMicrosoftStoreVersion();

            if (!latestVersion) {
                console.log('[UpdateCheck] No version found from MS Store');
                return;
            }

            // Get current version
            const currentVersion = await getAppVersion();

            // Save check timestamp
            localStorage.setItem(LAST_CHECK_KEY, now.toString());

            // Check if update is available
            if (isNewerVersion(latestVersion, currentVersion)) {
                // Check if user already dismissed this version
                const dismissed = localStorage.getItem(DISMISS_KEY);
                if (dismissed) {
                    const dismissedData = JSON.parse(dismissed);
                    if (dismissedData.version === latestVersion) {
                        // Already dismissed this version
                        return;
                    }
                }

                setUpdateInfo({
                    available: true,
                    latestVersion,
                    currentVersion
                });
                setIsVisible(true);
            }
        } catch (error) {
            console.error('[UpdateCheck] Error checking for updates:', error);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        if (updateInfo) {
            // Remember that user dismissed this version
            localStorage.setItem(DISMISS_KEY, JSON.stringify({
                version: updateInfo.latestVersion,
                timestamp: Date.now()
            }));
        }
    };

    const handleUpdate = () => {
        // @ts-ignore - Electron API
        window.ipcRenderer?.invoke('open-external', 'ms-windows-store://downloadsandupdates');
        handleDismiss();
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
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleUpdate}
                                    className="flex-1 py-3 px-4 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <Download className="w-4 h-4" />
                                    Update Now
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleDismiss}
                                    className="py-3 px-4 rounded-xl font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Later
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
