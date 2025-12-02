import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DailyStat } from '../utils/statsManager';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TrendChartProps {
  data: DailyStat[];
}

type TimeRange = '1M' | '1Y' | 'ALL';

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [range, setRange] = useState<TimeRange>('1M');
  const [pageOffset, setPageOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
    setPageOffset(0);
  };

  const handlePrev = () => setPageOffset(prev => prev + 1);
  const handleNext = () => setPageOffset(prev => Math.max(0, prev - 1));

  const filteredData = useMemo(() => {
    if (range === 'ALL') return data;

    const days = range === '1M' ? 30 : 365;
    
    // Anchor to the last date in the dataset, or today?
    // Let's anchor to today to show "current status"
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - (pageOffset * days));
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    return data.filter(item => {
      const d = new Date(item.date);
      return d >= startDate && d <= endDate;
    });
  }, [data, range, pageOffset]);

  const trendPercentage = useMemo(() => {
    if (filteredData.length < 2) return 0;
    const first = filteredData[0].totalActive;
    const last = filteredData[filteredData.length - 1].totalActive;
    return ((last - first) / first) * 100;
  }, [filteredData]);

  const getDateRangeLabel = () => {
    if (range === 'ALL') return 'All Time';
    if (filteredData.length === 0) return 'No Data';
    const start = new Date(filteredData[0].date);
    const end = new Date(filteredData[filteredData.length - 1].date);
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col">
      <div className="flex justify-between items-center mb-4 px-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Active Players Trend</h3>
          <div className="flex items-center gap-2">
             <span className={clsx(
               "text-xs font-bold",
               trendPercentage >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
             )}>
               {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
             </span>
             <span className="text-xs text-gray-500 dark:text-gray-400">{getDateRangeLabel()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {range !== 'ALL' && (
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button 
                onClick={handlePrev}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm rounded-md transition-all text-gray-600 dark:text-gray-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleNext}
                disabled={pageOffset === 0}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm rounded-md transition-all text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
            <button
              onClick={() => handleRangeChange('1M')}
              className={clsx(
                "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                range === '1M' ? "bg-white dark:bg-gray-600 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
              style={range === '1M' ? { color: 'var(--accent-primary)' } : undefined}
            >
              1M
            </button>
            {containerWidth > 400 && (
              <button
                onClick={() => handleRangeChange('1Y')}
                className={clsx(
                  "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  range === '1Y' ? "bg-white dark:bg-gray-600 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                )}
                style={range === '1Y' ? { color: 'var(--accent-primary)' } : undefined}
              >
                1Y
              </button>
            )}
            {containerWidth > 500 && (
              <button
                onClick={() => handleRangeChange('ALL')}
                className={clsx(
                  "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  range === 'ALL' ? "bg-white dark:bg-gray-600 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                )}
                style={range === 'ALL' ? { color: 'var(--accent-primary)' } : undefined}
              >
                ALL
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{
              top: 5,
              right: 10,
              left: -20,
              bottom: 20,
            }}
          >
            <defs>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} className="dark:stroke-gray-700" />
            <XAxis 
              dataKey="displayDate" 
              stroke="#9ca3af" 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
              dy={10}
            />
            <YAxis 
              stroke="#9ca3af" 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                color: '#1f2937',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              itemStyle={{ color: '#8b5cf6' }}
              labelStyle={{ color: '#6b7280', marginBottom: '0.25rem', fontSize: '0.75rem' }}
            />
            <Area
              type="monotone"
              dataKey="totalActive"
              stroke="#8b5cf6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorActive)"
              name="Active Players"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
