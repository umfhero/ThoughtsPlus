import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ScrollTimePickerProps {
    /** 24-hour format "HH:mm" */
    value: string;
    onChange: (value: string) => void;
    /** Compact inline mode (no dropdown, always visible) */
    compact?: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);   // 0..59
const PERIODS = ['AM', 'PM'] as const;

/** Convert 24h "HH:mm" → { hour12, minute, period } */
function parse24(time24: string) {
    const [h24, m] = time24.split(':').map(Number);
    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let hour12 = h24 % 12;
    if (hour12 === 0) hour12 = 12;
    return { hour12, minute: m, period };
}

/** Convert { hour12, minute, period } → 24h "HH:mm" */
function to24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
    let h24 = hour12 % 12;
    if (period === 'PM') h24 += 12;
    return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Get the current time + 1 minute as 24h "HH:mm" */
export function getDefaultTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ─── Scroll Column ──────────────────────────────────────────────────────────

interface ScrollColumnProps {
    items: (string | number)[];
    selected: string | number;
    onSelect: (item: string | number) => void;
    accentColor: string;
    formatItem?: (item: string | number) => string;
}

function ScrollColumn({ items, selected, onSelect, accentColor, formatItem }: ScrollColumnProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string | number, HTMLButtonElement>>(new Map());
    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();

    const scrollToItem = useCallback((item: string | number, behavior: ScrollBehavior = 'smooth') => {
        const el = itemRefs.current.get(item);
        const container = containerRef.current;
        if (!el || !container) return;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offset = elRect.top - containerRect.top - (containerRect.height / 2) + (elRect.height / 2);
        container.scrollTo({ top: container.scrollTop + offset, behavior });
    }, []);

    // Scroll to selected item on mount and when selection changes externally
    useEffect(() => {
        if (!isUserScrolling.current) {
            scrollToItem(selected, 'auto');
        }
    }, [selected, scrollToItem]);

    const handleScroll = useCallback(() => {
        isUserScrolling.current = true;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            isUserScrolling.current = false;
            // Snap to closest item
            const container = containerRef.current;
            if (!container) return;
            const centerY = container.getBoundingClientRect().top + container.clientHeight / 2;
            let closest: { item: string | number; dist: number } | null = null;
            itemRefs.current.forEach((el, item) => {
                const rect = el.getBoundingClientRect();
                const itemCenter = rect.top + rect.height / 2;
                const dist = Math.abs(itemCenter - centerY);
                if (!closest || dist < closest.dist) {
                    closest = { item, dist };
                }
            });
            if (closest && (closest as any).item !== selected) {
                onSelect((closest as any).item);
            }
        }, 100);
    }, [selected, onSelect]);

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="relative h-[140px] overflow-y-auto hide-scrollbar"
            style={{ scrollSnapType: 'y mandatory' }}
        >
            {/* Top/bottom padding so center alignment works */}
            <div className="h-[52px]" />
            {items.map((item) => {
                const isSelected = item === selected;
                const label = formatItem ? formatItem(item) : String(item);
                return (
                    <button
                        key={item}
                        ref={(el) => { if (el) itemRefs.current.set(item, el); }}
                        onClick={() => {
                            onSelect(item);
                            scrollToItem(item);
                        }}
                        className="w-full py-1.5 text-center text-sm font-medium transition-all duration-150 rounded-lg"
                        style={{
                            scrollSnapAlign: 'center',
                            color: isSelected ? accentColor : undefined,
                            backgroundColor: isSelected ? `${accentColor}18` : undefined,
                            fontWeight: isSelected ? 700 : 400,
                            fontSize: isSelected ? '1rem' : '0.8rem',
                            opacity: isSelected ? 1 : 0.5,
                        }}
                    >
                        {label}
                    </button>
                );
            })}
            <div className="h-[52px]" />
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ScrollTimePicker({ value, onChange, compact }: ScrollTimePickerProps) {
    const { accentColor } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { hour12, minute, period } = parse24(value);

    // Close dropdown on outside click
    useEffect(() => {
        if (!isOpen || compact) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, compact]);

    const handleHourChange = (h: string | number) => onChange(to24(Number(h), minute, period));
    const handleMinuteChange = (m: string | number) => onChange(to24(hour12, Number(m), period));
    const handlePeriodChange = (p: string | number) => onChange(to24(hour12, minute, p as 'AM' | 'PM'));

    const displayTime = `${hour12}:${String(minute).padStart(2, '0')} ${period}`;

    const pickerContent = (
        <div className="flex items-stretch gap-0 select-none">
            {/* Hours column */}
            <div className="w-[52px] flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Hr</span>
                <ScrollColumn
                    items={HOURS}
                    selected={hour12}
                    onSelect={handleHourChange}
                    accentColor={accentColor}
                />
            </div>

            {/* Divider */}
            <div className="flex items-center px-0.5">
                <span className="text-lg font-bold text-gray-300 dark:text-gray-600">:</span>
            </div>

            {/* Minutes column */}
            <div className="w-[52px] flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Min</span>
                <ScrollColumn
                    items={MINUTES}
                    selected={minute}
                    onSelect={handleMinuteChange}
                    accentColor={accentColor}
                    formatItem={(m) => String(m).padStart(2, '0')}
                />
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-200 dark:bg-gray-600 mx-1.5 my-4" />

            {/* AM/PM column */}
            <div className="w-[44px] flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">&nbsp;</span>
                <div className="flex flex-col gap-1 justify-center h-[140px]">
                    {PERIODS.map((p) => (
                        <button
                            key={p}
                            onClick={() => handlePeriodChange(p)}
                            className="px-2 py-2 rounded-lg text-xs font-bold transition-all duration-150"
                            style={{
                                backgroundColor: period === p ? accentColor : undefined,
                                color: period === p ? '#fff' : undefined,
                                opacity: period === p ? 1 : 0.4,
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    if (compact) {
        return (
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-2">
                {pickerContent}
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="relative w-full">
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 cursor-pointer flex items-center gap-2"
                style={{ '--tw-ring-color': `${accentColor}33` } as any}
            >
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{displayTime}</span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl p-3 animate-in fade-in slide-in-from-top-2 duration-150">
                    {pickerContent}
                </div>
            )}
        </div>
    );
}
