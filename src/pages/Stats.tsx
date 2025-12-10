import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, TrendingUp, Calendar } from 'lucide-react';
import { processStatsData, StatsData as HistoricalStatsData } from '../utils/statsManager';
import TrendChart from '../components/TrendChart';
import clsx from 'clsx';

export function StatsPage({ isSidebarCollapsed = false }: { isSidebarCollapsed?: boolean }) {
    const [historicalStats, setHistoricalStats] = useState<HistoricalStatsData | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const sidebarWidth = isSidebarCollapsed ? 0 : 240;
            const availableWidth = window.innerWidth - sidebarWidth;
            setIsMobile(availableWidth < 900);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [isSidebarCollapsed]);

    useEffect(() => {
        const hData = processStatsData();
        setHistoricalStats(hData);
    }, []);

    return (
        <div className="p-10 space-y-10 h-full overflow-y-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Creator Stats</h1>
                    <p className="text-gray-500 dark:text-gray-400">Historical analysis and live metrics</p>
                </div>
            </div>

            {/* Baseline Stats Grid */}
            <div className={clsx("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4")}>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50"
                >
                    <div className="flex items-center gap-3 mb-4 text-blue-600 dark:text-blue-400">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                            <Users className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-700 dark:text-gray-300">Unique Players</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {historicalStats && historicalStats.trendData.length > 0 
                            ? historicalStats.trendData.reduce((sum, day) => sum + day.totalActive, 0).toLocaleString()
                            : '—'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">From CSV data analysis</p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50"
                >
                    <div className="flex items-center gap-3 mb-4 text-purple-600 dark:text-purple-400">
                        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-700 dark:text-gray-300">Monthly Players</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {historicalStats && historicalStats.trendData.length > 0
                            ? historicalStats.trendData.slice(-30).reduce((sum, day) => sum + day.totalActive, 0).toLocaleString()
                            : '—'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last 30 days from CSV</p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50"
                >
                    <div className="flex items-center gap-3 mb-4 text-green-600 dark:text-green-400">
                        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-700 dark:text-gray-300">Weekly Players</h3>
                    </div>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{historicalStats?.currentWeeklyActive.toLocaleString() || '0'}</p>
                        {historicalStats && (
                            <span className={`text-sm font-bold mb-1 ${historicalStats.weeklyGrowth >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {historicalStats.weeklyGrowth > 0 ? '+' : ''}{historicalStats.weeklyGrowth.toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active in last 7 days</p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50"
                >
                    <div className="flex items-center gap-3 mb-4 text-orange-600 dark:text-orange-400">
                        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-700 dark:text-gray-300">Total Data Points</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {historicalStats && historicalStats.trendData.length > 0
                            ? historicalStats.trendData.length.toLocaleString()
                            : '—'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Days of recorded data</p>
                </motion.div>
            </div>

            {/* Trend Chart Section */}
            {historicalStats && historicalStats.trendData.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col" style={{ height: '400px' }}
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <TrendingUp className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Player Activity Trend</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Weekly player engagement</p>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <TrendChart data={historicalStats.trendData} />
                    </div>
                </motion.div>
            )}
        </div>
    );
}
