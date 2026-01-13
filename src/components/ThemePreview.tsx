import { CustomThemeColors } from '../contexts/ThemeContext';

interface ThemePreviewProps {
    mode: 'light' | 'dark' | 'custom';
    accent: string;
    colors?: CustomThemeColors;
    font: string;
    sidebarIconOnly?: boolean;
}

// Need clsx for dynamic classes
import clsx from 'clsx';

export function ThemePreview({ mode, accent, colors, font, sidebarIconOnly = false }: ThemePreviewProps) {
    // Determine colors based on mode
    let bg: string;
    let textMain: string;
    let textMuted: string;
    let border: string;
    let sidebarBg: string;
    let cardBg: string;

    if (mode === 'custom' && colors) {
        bg = colors.backgroundColor;
        textMain = colors.textColor;
        // Calculate muted text as a lighter/darker version of main text
        textMuted = colors.textColor + '99'; // Add transparency
        border = colors.borderColor;
        sidebarBg = colors.sidebarBackground;
        cardBg = colors.cardBackground;
    } else if (mode === 'dark') {
        bg = '#1f2937';
        textMain = '#f3f4f6';
        textMuted = '#9ca3af';
        border = '#374151';
        sidebarBg = '#111827';
        cardBg = '#1f2937';
    } else {
        // Light mode
        bg = '#ffffff';
        textMain = '#111827';
        textMuted = '#6b7280';
        border = '#e5e7eb';
        sidebarBg = '#f9fafb';
        cardBg = '#ffffff';
    }

    // Ensure font is applied correctly
    const fontFamily = font === 'CustomFont' ? 'var(--app-font)' : `"${font}", sans-serif`;

    return (
        <div
            className="w-full h-full min-h-[140px] rounded-xl overflow-hidden border shadow-sm flex transition-all"
            style={{ backgroundColor: bg, borderColor: border, fontFamily }}
        >
            {/* Sidebar */}
            <div
                className="h-full border-r p-3 flex flex-col gap-3 transition-all"
                style={{
                    backgroundColor: sidebarBg,
                    borderColor: border,
                    width: sidebarIconOnly ? '40px' : '80px',
                    alignItems: sidebarIconOnly ? 'center' : 'flex-start'
                }}
            >
                <div className="flex items-center gap-2 mb-2">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: accent }}
                    />
                </div>
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={clsx(
                            "h-2 rounded-full opacity-50",
                            sidebarIconOnly ? "w-2" : "w-12"
                        )}
                        style={{ backgroundColor: textMuted }}
                    />
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 flex flex-col gap-3">
                {/* Header */}
                <div className="flex justify-between items-center mb-1">
                    <div
                        className="h-3 w-24 rounded-full"
                        style={{ backgroundColor: textMain, opacity: 0.8 }}
                    />
                    <div
                        className="h-6 w-6 rounded-full"
                        style={{ backgroundColor: textMuted, opacity: 0.2 }}
                    />
                </div>

                {/* Card */}
                <div
                    className="flex-1 rounded-lg border border-dashed p-3"
                    style={{
                        borderColor: border,
                        backgroundColor: mode === 'custom' && colors
                            ? cardBg
                            : (mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)')
                    }}
                >
                    <div className="flex gap-3 mb-3">
                        <div
                            className="w-8 h-8 rounded-lg"
                            style={{ backgroundColor: accent, opacity: 0.2 }}
                        />
                        <div className="flex-1">
                            <div
                                className="text-[10px] font-bold mb-0.5 leading-tight"
                                style={{ color: textMain }}
                            >
                                Meeting with Team
                            </div>
                            <div
                                className="text-[8px] opacity-70 leading-tight"
                                style={{ color: textMuted }}
                            >
                                Discuss prompt...
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div
                            className="h-2 w-full rounded-full opacity-40"
                            style={{ backgroundColor: textMuted }}
                        />
                        <div
                            className="h-2 w-5/6 rounded-full opacity-40"
                            style={{ backgroundColor: textMuted }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
