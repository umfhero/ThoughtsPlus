import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import clsx from 'clsx';
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { NotesData } from '../types';
import { format, parseISO } from 'date-fns';

interface TaskTrendChartProps {
  notes: NotesData;
}

type TimeRange = '1W' | '1M' | 'ALL';

interface TaskPoint {
  taskIndex: number;
  score: number | null; // Actual score (null for projections)
  projectedScore: number | null; // Projected score for upcoming
  displayScore: number; // The score to display on chart (actual or projected)
  date: string;
  displayDate: string;
  taskTitle: string;
  wasCompleted: boolean;
  wasMissed: boolean;
  isProjection: boolean;
  segmentColor: string | null; // Color of line from previous point to this point
  segmentDashed: boolean; // Whether segment should be dashed
  dotColor: string | null; // Color of dot at this point
}

const TaskTrendChart: React.FC<TaskTrendChartProps> = ({ notes }) => {
  const [range, setRange] = useState<TimeRange>('1W');
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [animationKey, setAnimationKey] = useState(0);

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
  };

  // Build chart data - task by task points
  const { chartData, summaryStats } = useMemo(() => {
    const today = new Date();
    const now = new Date();

    // Get all dates with tasks, sorted chronologically
    const allDates = Object.keys(notes)
      .filter(dateKey => notes[dateKey] && notes[dateKey].length > 0)
      .sort();

    if (allDates.length === 0) {
      return {
        chartData: [],
        summaryStats: { totalTasks: 0, completedTasks: 0, missedTasks: 0, overallRate: 0, earlyCount: 0, lateCount: 0 }
      };
    }

    // Filter by range
    let filteredDates = allDates;
    const rangeStart = new Date(today);
    const rangeEnd = new Date(today);

    if (range === '1W') {
      rangeStart.setDate(rangeStart.getDate() - 7);
      rangeEnd.setDate(rangeEnd.getDate() + 7);
      filteredDates = allDates.filter(d => {
        const date = new Date(d);
        return date >= rangeStart && date <= rangeEnd;
      });
    } else if (range === '1M') {
      rangeStart.setDate(rangeStart.getDate() - 30);
      rangeEnd.setDate(rangeEnd.getDate() + 30);
      filteredDates = allDates.filter(d => {
        const date = new Date(d);
        return date >= rangeStart && date <= rangeEnd;
      });
    }

    if (filteredDates.length === 0) {
      return {
        chartData: [],
        summaryStats: { totalTasks: 0, completedTasks: 0, missedTasks: 0, overallRate: 0, earlyCount: 0, lateCount: 0 }
      };
    }

    // Collect all tasks in chronological order
    interface Task {
      date: string;
      displayDate: string;
      title: string;
      time: string;
      completed: boolean;
      completedLate?: boolean;
      isPast: boolean;
    }

    const tasks: Task[] = [];
    filteredDates.forEach(dateKey => {
      const dayNotes = notes[dateKey] || [];
      dayNotes.forEach(note => {
        const [hours, minutes] = note.time.split(':').map(Number);
        const taskDateTime = new Date(parseISO(dateKey));
        taskDateTime.setHours(hours, minutes, 0, 0);
        const isPast = taskDateTime.getTime() < now.getTime();

        tasks.push({
          date: dateKey,
          displayDate: format(parseISO(dateKey), 'MMM d'),
          title: note.title,
          time: note.time,
          completed: note.completed || false,
          completedLate: note.completedLate,
          isPast,
        });
      });
    });

    // Sort by date and time
    tasks.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

    // Build points - one per task
    let score = 0;
    let completedTasks = 0;
    let missedTasks = 0;
    let earlyCount = 0;
    let lateCount = 0;

    const points: TaskPoint[] = [];

    // Starting point at 0
    points.push({
      taskIndex: 0,
      score: 0,
      projectedScore: null,
      displayScore: 0,
      date: tasks[0]?.date || '',
      displayDate: 'Start',
      taskTitle: 'Start',
      wasCompleted: false,
      wasMissed: false,
      isProjection: false,
      segmentColor: null,
      segmentDashed: false,
      dotColor: null,
      greenScore: null,
      redScore: null,
    } as any);

    let lastActualIndex = 0;
    let lastActualScore = 0;

    tasks.forEach((task, index) => {
      const taskNum = index + 1;
      const isMissed = task.isPast && !task.completed;
      const prevScore = score;

      // Update score: +1 for completed, -1 for missed, 0 for upcoming
      if (task.completed) {
        score += 1;
        completedTasks++;

        // Check timing
        const [hours, minutes] = task.time.split(':').map(Number);
        const taskDateTime = new Date(parseISO(task.date));
        taskDateTime.setHours(hours, minutes, 0, 0);
        const daysDiff = Math.floor((taskDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 1) earlyCount++;
        else if (task.completedLate) lateCount++;
      } else if (isMissed) {
        score -= 1;
        missedTasks++;
      }

      const isActual = task.isPast || task.completed;
      if (isActual) {
        lastActualIndex = taskNum;
        lastActualScore = score;
      }

      // Determine segment color based on movement
      const scoreDiff = score - prevScore;
      let segmentColor: string | null = null;
      let segmentDashed = false;
      let dotColor: string | null = null;

      if (isActual) {
        // Actual task - green if up, red if down
        if (scoreDiff > 0) {
          segmentColor = '#10b981'; // Green
          dotColor = '#10b981';
        } else if (scoreDiff < 0) {
          segmentColor = '#f43f5e'; // Red
          dotColor = '#f43f5e';
        } else {
          segmentColor = '#9ca3af'; // Gray for flat
          dotColor = '#9ca3af';
        }
      } else {
        // Projection - gray dashed
        segmentColor = '#d1d5db';
        segmentDashed = true;
        dotColor = null; // No dot for projections
      }

      // Set projectedScore: for projected tasks, calculate from last actual; for last actual task, set to its score to enable connection
      const projectedScore = !isActual
        ? (lastActualScore + (taskNum - lastActualIndex))
        : (isActual && index < tasks.length - 1 && !tasks[index + 1]?.isPast && !tasks[index + 1]?.completed ? score : null);

      // Update previous point to include the appropriate color score for segment rendering
      if (points.length > 0 && isActual) {
        const prevPoint = points[points.length - 1];
        if (scoreDiff > 0) {
          // Upward segment - add green to previous point
          (prevPoint as any).greenScore = prevScore;
        } else if (scoreDiff < 0) {
          // Downward segment - add red to previous point
          (prevPoint as any).redScore = prevScore;
        }
      }

      const point: TaskPoint = {
        taskIndex: taskNum,
        score: isActual ? score : null,
        projectedScore,
        displayScore: isActual ? score : projectedScore!,
        date: task.date,
        displayDate: task.displayDate,
        taskTitle: task.title,
        wasCompleted: task.completed,
        wasMissed: isMissed,
        isProjection: !isActual,
        segmentColor,
        segmentDashed,
        dotColor,
        // Add current point's colored scores
        greenScore: isActual && scoreDiff > 0 ? score : null,
        redScore: isActual && scoreDiff < 0 ? score : null,
      } as any;

      points.push(point);
    });

    const totalTasks = tasks.length;
    const overallRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      chartData: points,
      summaryStats: {
        totalTasks,
        completedTasks,
        missedTasks,
        overallRate,
        earlyCount,
        lateCount
      }
    };
  }, [notes, range]);

  // Re-trigger animation when data changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [chartData]);

  // Trigger confetti when 100% completion
  useEffect(() => {
    // Trigger re-animation when data changes
    setAnimationKey(prev => prev + 1);
  }, [summaryStats.completedTasks, summaryStats.totalTasks, summaryStats.missedTasks]);

  const getRateColor = (rate: number) => {
    if (rate >= 70) return { text: 'text-emerald-500', bg: 'bg-emerald-500', hex: '#10b981' };
    if (rate >= 40) return { text: 'text-amber-500', bg: 'bg-amber-500', hex: '#f59e0b' };
    return { text: 'text-rose-500', bg: 'bg-rose-500', hex: '#f43f5e' };
  };

  const colors = getRateColor(summaryStats.overallRate);

  // Get trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const firstScore = chartData[0].score ?? 0;
    const lastScore = chartData[chartData.length - 1].score ?? 0;
    const diff = lastScore - firstScore;
    return diff > 0 ? 1 : diff < 0 ? -1 : 0;
  }, [chartData]);

  const gradientId = `areaGradient-${animationKey}`;
  const projectedGradientId = `projectedGradient-${animationKey}`;

  if (summaryStats.totalTasks === 0) {
    return (
      <div ref={containerRef} className="h-full w-full flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl mb-2">📊</div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No tasks yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Add events to track your progress</p>
      </div>
    );
  }

  const isPerfect = summaryStats.completedTasks === summaryStats.totalTasks && summaryStats.missedTasks === 0;

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-1 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className={clsx("text-3xl font-bold tracking-tight", isPerfect ? "text-emerald-500" : colors.text)}>
              {summaryStats.overallRate}%
            </span>
            {isPerfect && (
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            )}
            {trend !== 0 && !isPerfect && (
              <div className={clsx(
                "flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                trend > 0
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
              )}>
                {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{summaryStats.completedTasks} done</span>
            {summaryStats.missedTasks > 0 && (
              <span className="text-rose-500">• {summaryStats.missedTasks} missed</span>
            )}
            {summaryStats.earlyCount > 0 && (
              <span className="text-cyan-500">• {summaryStats.earlyCount} early</span>
            )}
            {summaryStats.lateCount > 0 && (
              <span className="text-amber-500">• {summaryStats.lateCount} late</span>
            )}
          </div>
        </div>
        <div className="flex bg-gray-100/80 dark:bg-gray-700/80 rounded-lg p-0.5">
          {['1W', '1M', 'ALL'].filter(r => containerWidth > 280 || r !== 'ALL').map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r as TimeRange)}
              className={clsx(
                "px-2 py-0.5 rounded text-[11px] font-medium transition-all",
                range === r
                  ? "bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-gray-100"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 mt-2">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-400">No tasks in this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              key={animationKey}
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id={projectedGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d1d5db" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`${gradientId}-green`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`${gradientId}-red`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* Projected area first (gray) - fills the entire projection */}
              <Area
                type="monotone"
                dataKey="projectedScore"
                stroke="none"
                fill={`url(#${projectedGradientId})`}
                isAnimationActive={false}
                connectNulls={true}
                baseValue="dataMin"
              />

              {/* Green area - upward movements */}
              <Area
                type="monotone"
                dataKey="greenScore"
                stroke="none"
                fill={`url(#${gradientId}-green)`}
                isAnimationActive={false}
                connectNulls={true}
                baseValue="dataMin"
              />

              {/* Red area - downward movements */}
              <Area
                type="monotone"
                dataKey="redScore"
                stroke="none"
                fill={`url(#${gradientId}-red)`}
                isAnimationActive={false}
                connectNulls={true}
                baseValue="dataMin"
              />

              {/* Main line with custom segment rendering */}
              <Line
                type="monotone"
                dataKey="displayScore"
                stroke="transparent"
                strokeWidth={0}
                dot={false}
                isAnimationActive={false}
                shape={(props: any) => {
                  const { points } = props;
                  if (!points || points.length < 2) return <></>;

                  // Generate smooth curved path using catmull-rom or monotone cubic
                  const generateSmoothPath = (p1: any, p2: any) => {
                    // Simple quadratic bezier for smooth curves
                    const dx = p2.x - p1.x;

                    // Control point offset (adjust this for curve smoothness)
                    const smoothness = Math.min(Math.abs(dx) * 0.2, 20);

                    // Create smooth curve
                    return `M ${p1.x},${p1.y} C ${p1.x + smoothness},${p1.y} ${p2.x - smoothness},${p2.y} ${p2.x},${p2.y}`;
                  };

                  return (
                    <g>
                      {points.map((point: any, index: number) => {
                        if (index === 0) return null;

                        const prevPoint = points[index - 1];
                        const currentData = chartData[index];

                        if (!currentData || !currentData.segmentColor) return null;

                        const path = generateSmoothPath(prevPoint, point);

                        return (
                          <path
                            key={`segment-${index}`}
                            d={path}
                            fill="none"
                            stroke={currentData.segmentColor}
                            strokeWidth={3}
                            strokeDasharray={currentData.segmentDashed ? "5 5" : undefined}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      })}
                    </g>
                  );
                }}
              />

              {/* Dots at each actual point */}
              <Line
                type="monotone"
                dataKey="displayScore"
                stroke="transparent"
                strokeWidth={0}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!payload.dotColor) return null;

                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={payload.dotColor}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  );
                }}
                isAnimationActive={false}
              />

              <XAxis
                dataKey="taskIndex"
                stroke="transparent"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                label={{ value: 'Tasks', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 10 }}
              />
              <YAxis
                domain={[
                  (dataMin: number) => {
                    // Ensure we always include 0 in the domain for proper gradient rendering
                    const min = Math.floor(dataMin);
                    return min >= 0 ? 0 : min - 1;
                  },
                  (dataMax: number) => {
                    // Pad the top slightly for better visuals
                    return Math.ceil(dataMax) + 1;
                  }
                ]}
                stroke="transparent"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={35}
                label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
              />
              <Tooltip
                wrapperStyle={{ outline: 'none' }}
                contentStyle={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
                content={(props: any) => {
                  const { payload } = props;
                  if (!payload || !payload[0]) return null;

                  const data = payload[0].payload as TaskPoint;

                  if (data.isProjection) {
                    return (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 p-4 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 min-w-[220px]">
                        <div className="font-semibold text-gray-800 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-2 flex items-center gap-2">
                          <span className="truncate">{data.taskTitle}</span>
                        </div>
                        <div className="text-xs space-y-2">
                          <div className="flex justify-between gap-4 items-center">
                            <span className="text-gray-500 dark:text-gray-400">Status:</span>
                            <span className="text-blue-500 dark:text-blue-400 font-semibold flex items-center gap-1">
                              Upcoming
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 items-center">
                            <span className="text-gray-500 dark:text-gray-400">Projected Score:</span>
                            <span className="text-gray-700 dark:text-gray-200 font-bold text-sm">{data.projectedScore}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 italic text-xs bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2">
                            Complete this task to add <span className="font-bold text-emerald-500">+1</span> to your score
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const statusText = data.wasCompleted ? 'Completed' : data.wasMissed ? 'Missed' : 'Pending';
                  const statusColor = data.wasCompleted
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : data.wasMissed
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-gray-500 dark:text-gray-400';

                  return (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 p-4 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 min-w-[240px]">
                      <div className="font-semibold text-gray-800 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-3 flex items-center gap-2">
                        <span className="truncate">{data.taskTitle}</span>
                      </div>
                      <div className="text-xs space-y-2">
                        <div className="flex justify-between gap-4 items-center">
                          <span className="text-gray-500 dark:text-gray-400">Status:</span>
                          <span className={`${statusColor} font-semibold`}>{statusText}</span>
                        </div>
                        <div className="flex justify-between gap-4 items-center">
                          <span className="text-gray-500 dark:text-gray-400">Current Score:</span>
                          <span className="text-gray-700 dark:text-gray-200 font-bold text-sm">{data.score}</span>
                        </div>
                        <div className="flex justify-between gap-4 items-center">
                          <span className="text-gray-500 dark:text-gray-400">Date:</span>
                          <span className="text-gray-700 dark:text-gray-200 font-medium">{data.displayDate}</span>
                        </div>
                        {data.wasCompleted && (
                          <div className="mt-3 pt-3 border-t-2 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 rounded-lg p-2.5" style={{ borderTopColor: '#10b981', borderTopWidth: '2px' }}>
                            <div className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                              <span>Great job! You earned <span className="font-bold text-emerald-500">+1</span> point</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom status */}
      <div className="flex items-center justify-between px-1 pt-2 border-t border-gray-100/50 dark:border-gray-700/30 mt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span className="text-[9px] text-gray-400">Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
            <span className="text-[9px] text-gray-400">Missed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-gray-300 border-t-2 border-dashed border-gray-300"></div>
            <span className="text-[9px] text-gray-400">Ideal</span>
          </div>
        </div>
        <div className={clsx(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
          isPerfect
            ? "bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-900/30 dark:to-cyan-900/30 text-emerald-600 dark:text-emerald-400"
            : summaryStats.overallRate >= 70
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              : summaryStats.overallRate >= 40
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                : "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
        )}>
          {isPerfect ? 'Perfect!' :
            summaryStats.overallRate >= 70 ? 'On fire!' :
              summaryStats.overallRate >= 40 ? 'Keep going' : '📈 Room to grow'}
        </div>
      </div>
    </div>
  );
};

export default TaskTrendChart;
