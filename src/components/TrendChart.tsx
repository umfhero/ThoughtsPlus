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

interface TrendChartProps {
  data: DailyStat[];
}

type TimeRange = '1W' | '1M' | 'ALL';

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [range, setRange] = useState<TimeRange>('1M');
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

  const filteredData = useMemo(() => {
    if (range === 'ALL') return data;
    
    const now = new Date();
    const daysToSubtract = range === '1W' ? 14 : 30; // 1W shows 2 weeks for comparison
    const cutoffDate = new Date(now.setDate(now.getDate() - daysToSubtract));

    return data.filter(item => new Date(item.date) >= cutoffDate);
  }, [data, range]);

  // Calculate trend for the selected range
  const trendPercentage = useMemo(() => {
    if (filteredData.length < 2) return 0;
    const first = filteredData[0].totalActive;
    const last = filteredData[filteredData.length - 1].totalActive;
    return ((last - first) / first) * 100;
  }, [filteredData]);

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col">
      <div className="flex justify-between items-center mb-4 px-2">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Active Players Trend</h3>
          <div className="flex items-center gap-2">
             <span className={clsx(
               "text-xs font-bold",
               trendPercentage >= 0 ? "text-green-500" : "text-red-500"
             )}>
               {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
             </span>
             <span className="text-xs text-gray-400">in selected period</span>
          </div>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setRange('1W')}
            className={clsx(
              "px-2 py-1 rounded-md text-xs font-medium transition-colors",
              range === '1W' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            2W
          </button>
          <button
            onClick={() => setRange('1M')}
            className={clsx(
              "px-2 py-1 rounded-md text-xs font-medium transition-colors",
              range === '1M' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            1M
          </button>
          {containerWidth > 400 && (
            <button
              onClick={() => setRange('ALL')}
              className={clsx(
                "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                range === 'ALL' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              ALL
            </button>
          )}
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
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis 
              dataKey="displayDate" 
              stroke="#9ca3af" 
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis 
              stroke="#9ca3af" 
              tick={{ fill: '#9ca3af', fontSize: 10 }}
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
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
