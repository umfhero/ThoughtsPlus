import React, { useMemo } from 'react';
import { Activity } from 'react-activity-calendar';

interface GithubActivity3DProps {
    data: Activity[];
    theme?: 'light' | 'dark' | 'custom';
    accentColor?: string;
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function GithubActivity3D({ data, theme = 'light', accentColor = '#216e39' }: GithubActivity3DProps) {
    // Process data into weeks (columns)
    const processedData = useMemo(() => {
        const weeks: (Activity | null)[][] = [];
        const monthLabels: { weekIndex: number, label: string }[] = [];

        if (data.length === 0) return { weeks, monthLabels };

        const startDate = new Date(data[0].date);
        const startDay = startDate.getDay();

        let currentWeek: (Activity | null)[] = Array(7).fill(null);
        let dataIndex = 0;
        let lastMonth = -1;

        // Fill first week
        for (let i = startDay; i < 7 && dataIndex < data.length; i++) {
            const day = data[dataIndex++];
            const date = new Date(day.date);
            const month = date.getMonth();

            // Check for month change
            if (month !== lastMonth) {
                if (dataIndex > 7) { // Skip label on very first week if it's awkward, or keep it.
                    monthLabels.push({
                        weekIndex: 0,
                        label: date.toLocaleString('default', { month: 'short' })
                    });
                }
                lastMonth = month;
            }

            currentWeek[i] = day;
        }
        weeks.push(currentWeek);

        // Fill remaining weeks
        let weekIndex = 1;
        while (dataIndex < data.length) {
            const week = Array(7).fill(null);
            for (let i = 0; i < 7 && dataIndex < data.length; i++) {
                const day = data[dataIndex++];
                const date = new Date(day.date);
                const month = date.getMonth();

                if (month !== lastMonth && i === 0) { // Only mark month if it starts near beginning of week for cleaner look? Or anywhere.
                    // Actually, usually month labels are placed when the month *starts*.
                    // Let's just place it if it's a new month.
                    monthLabels.push({
                        weekIndex: weekIndex,
                        label: date.toLocaleString('default', { month: 'short' })
                    });
                    lastMonth = month;
                }

                week[i] = day;
            }
            weeks.push(week);
            weekIndex++;
        }

        return { weeks, monthLabels };
    }, [data]);

    const { weeks, monthLabels } = processedData;

    // Calculate Max Commits for Scaling
    const maxCommits = useMemo(() => {
        return Math.max(...data.map(d => d.count), 1); // Avoid div by 0
    }, [data]);

    // Dynamic Palette based on Accent Color
    const colors = useMemo(() => {
        const isDark = theme === 'dark';
        const rgb = hexToRgb(accentColor);
        const bg = isDark ? { r: 13, g: 17, b: 23 } : { r: 235, g: 237, b: 240 }; // GitHub BG colors

        // Fallback
        if (!rgb) {
            return {
                0: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                1: '#9be9a8', 2: '#40c463', 3: '#30a14e', 4: '#216e39'
            };
        }

        const mix = (c1: { r: number, g: number, b: number }, c2: { r: number, g: number, b: number }, weight: number) => {
            return `rgb(${Math.round(c1.r * weight + c2.r * (1 - weight))}, ${Math.round(c1.g * weight + c2.g * (1 - weight))}, ${Math.round(c1.b * weight + c2.b * (1 - weight))})`;
        };

        const { r, g, b } = rgb;
        const target = { r, g, b };

        // Generate SOLID distinct colors by mixing accent with background
        return {
            0: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
            1: mix(target, bg, 0.3),
            2: mix(target, bg, 0.55),
            3: mix(target, bg, 0.8),
            4: `rgb(${r}, ${g}, ${b})`
        };
    }, [theme, accentColor]);

    return (
        <div className="w-full overflow-x-auto overflow-y-hidden perspective-container p-4 min-h-[400px] flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <style>{`
                .perspective-container {
                    perspective: 3000px;
                    overflow: visible !important;
                }
                .isometric-grid {
                    transform-style: preserve-3d;
                    transform: rotateX(60deg) rotateZ(45deg) scale(0.6);
                    display: flex;
                    align-items: center; 
                    position: relative;
                }
                
                .column {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-right: 4px; 
                    transform-style: preserve-3d;
                    position: relative;
                }
                
                .cube-base {
                    width: 16px;
                    height: 16px;
                    position: relative;
                    transform-style: preserve-3d;
                    transition: transform 0.2s ease-out;
                }
                
                /* Ground shadow/placeholder - Glassy & Transparent for 0 commits */
                .cube-base:before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-color: var(--color);
                    border-radius: 2px;
                    transform: translateZ(0);
                    will-change: transform;
                    border: 1px solid rgba(0,0,0,0.05); /* Subtle border for 0 commit days */
                }
                .dark .cube-base:before {
                    border-color: rgba(255,255,255,0.05);
                }

                .cube-base:hover {
                     transform: translateZ(10px);
                }

                .face {
                    position: absolute;
                    backface-visibility: hidden;
                    /* Use slight outline of same color to seal seams instead of box-shadow/border */
                    outline: 1px solid transparent;
                    transition: height 0.3s ease, width 0.3s ease, transform 0.3s ease;
                }
                
                /* Top Face */
                .face-top {
                    width: 100%;
                    height: 100%;
                    background-color: var(--color);
                    transform: translateZ(var(--h));
                    transform-style: preserve-3d;
                    /* Lighting */
                    background: linear-gradient(to bottom right, rgba(255,255,255,0.15), rgba(0,0,0,0.05));
                    background-color: var(--color);
                }
                
                /* Side Faces - Solid with lighting */
                .face-south {
                    width: 100%;
                    height: var(--h);
                    background-color: var(--color);
                    filter: brightness(0.85); 
                    bottom: 0;
                    left: 0;
                    transform-origin: bottom;
                    transform: rotateX(-90deg); 
                }
                
                .face-east {
                    width: var(--h);
                    height: 100%;
                    background-color: var(--color);
                    filter: brightness(0.65); 
                    right: 0;
                    top: 0;
                    transform-origin: right;
                    transform: rotateY(90deg);
                }
                
                .tooltip {
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s;
                    will-change: opacity;
                }
                .cube-base:hover .tooltip {
                    opacity: 1;
                }
                
                /* Month Markers */
                .month-marker {
                    position: absolute;
                    bottom: -40px; /* Drop down */
                    left: 50%;
                    /* Transform handled inline */
                    font-size: 14px; 
                    font-weight: 800;
                    color: #4b5563;
                    white-space: nowrap;
                    pointer-events: none;
                    text-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                .dark .month-marker {
                    color: #9ca3af;
                }
                
                .dashed-line {
                    position: absolute;
                    bottom: -5px; /* connect to grid bottom */
                    left: 50%;
                    width: 2px;
                    height: 60px; /* Longer drop */
                    border-left: 2px dashed rgba(0,0,0,0.3);
                    transform: translateX(20px) translateZ(0); /* Match text shift */
                    transform-origin: top;
                }
                .dark .dashed-line {
                    border-left-color: rgba(255,255,255,0.3);
                }

           `}</style>

            <div className="isometric-grid">
                {weeks.map((week, wIndex) => {
                    const monthLabel = monthLabels.find(m => m.weekIndex === wIndex);

                    return (
                        <div key={`week-${wIndex}`} className="column">
                            {/* Render Month Marker if this week starts a month */}
                            {monthLabel && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    /* We want to attach it to the "bottom" in 3D space. 
                                       Since flex-direction is column, the bottom of this div is the "end" of the week (Saturday).
                                       But in the image, markers are along the X-axis (weeks axis). 
                                       Actually, markers should be at the START of the week? 
                                       Let's put it at the bottom of the column (Saturday) and project down?
                                       Or "left" of the column?
                                       Let's try putting it at the last day (Saturday) position.
                                    */
                                    height: '1px',
                                    zIndex: 0
                                }}>
                                    <div className="dashed-line" style={{
                                        height: '60px',
                                        top: '100%',
                                        transform: 'translateX(6px) translateY(10px)' // Adjustment to align with grid edge
                                    }} />
                                    <div className="month-marker" style={{
                                        top: '100%',
                                        marginTop: '60px',
                                        transform: 'translateX(20px) rotateZ(-45deg) rotateX(-60deg) scale(2.5) scaleY(1.5)' // 2.5x Size + 50% Taller
                                    }}>
                                        {monthLabel.label}
                                    </div>
                                </div>
                            )}

                            {week.map((day, dIndex) => {
                                if (!day) return <div key={`empty-${dIndex}`} className="cube-base opacity-0" />;

                                let h = 2;
                                if (day.count > 0) {
                                    // Scale linear mapping
                                    const ratio = Math.min(day.count / Math.max(maxCommits, 1), 1);
                                    h = Math.max(12, ratio * 100);
                                }

                                const color = colors[day.level as keyof typeof colors];

                                // Only active days (level > 0) get the 3D faces
                                const isActive = day.level > 0;

                                return (
                                    <div
                                        key={day.date}
                                        className="cube-base"
                                        style={{
                                            '--h': `${h}px`,
                                            '--color': color,
                                            zIndex: (wIndex * 100) + dIndex
                                        } as React.CSSProperties}
                                    >
                                        {isActive && (
                                            <>
                                                <div className="face face-south" />
                                                <div className="face face-east" />
                                                <div className="face face-top" />
                                            </>
                                        )}

                                        <div className="tooltip absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-[10000]"
                                            style={{ transform: `translateZ(${h + 30}px) rotateZ(-45deg) rotateX(-60deg)` }}>
                                            <span className="font-bold">{day.count}</span> on {day.date}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
