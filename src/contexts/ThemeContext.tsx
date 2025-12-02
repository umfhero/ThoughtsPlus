import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ThemeContextType {
    theme: 'light' | 'dark';
    accentColor: string;
    setTheme: (theme: 'light' | 'dark') => void;
    setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const accentColors = {
    blue: { primary: 'rgb(59, 130, 246)', secondary: 'rgb(37, 99, 235)', light: 'rgb(219, 234, 254)', darkPrimary: 'rgb(96, 165, 250)' },
    purple: { primary: 'rgb(168, 85, 247)', secondary: 'rgb(147, 51, 234)', light: 'rgb(243, 232, 255)', darkPrimary: 'rgb(192, 132, 252)' },
    green: { primary: 'rgb(34, 197, 94)', secondary: 'rgb(22, 163, 74)', light: 'rgb(220, 252, 231)', darkPrimary: 'rgb(74, 222, 128)' },
    pink: { primary: 'rgb(236, 72, 153)', secondary: 'rgb(219, 39, 119)', light: 'rgb(252, 231, 243)', darkPrimary: 'rgb(244, 114, 182)' },
    orange: { primary: 'rgb(249, 115, 22)', secondary: 'rgb(234, 88, 12)', light: 'rgb(255, 237, 213)', darkPrimary: 'rgb(251, 146, 60)' },
    red: { primary: 'rgb(239, 68, 68)', secondary: 'rgb(220, 38, 38)', light: 'rgb(254, 226, 226)', darkPrimary: 'rgb(248, 113, 113)' },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<'light' | 'dark'>('light');
    const [accentColor, setAccentColorState] = useState('#3b82f6'); // Default blue hex
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // Load theme from settings
        const loadTheme = async () => {
            try {
                const savedTheme = await window.ipcRenderer?.invoke('get-global-setting', 'theme');
                const savedAccent = await window.ipcRenderer?.invoke('get-global-setting', 'accentColor');
                
                if (savedTheme === 'light' || savedTheme === 'dark') {
                    setThemeState(savedTheme);
                }
                if (savedAccent) setAccentColorState(savedAccent);
            } catch (e) {
                console.log('Using default light theme');
            } finally {
                setIsInitialized(true);
            }
        };
        loadTheme();
    }, []);

    useEffect(() => {
        if (!isInitialized) return;
        
        // Apply theme to root element
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);

        // Apply accent color CSS variables
        // Check if it's a hex color or preset name
        if (accentColor.startsWith('#')) {
            // Custom hex color
            document.documentElement.style.setProperty('--accent-primary', accentColor);
            document.documentElement.style.setProperty('--accent-secondary', accentColor);
            document.documentElement.style.setProperty('--accent-light', accentColor + '20'); // Add transparency
        } else {
            // Preset color
            const colors = accentColors[accentColor as keyof typeof accentColors] || accentColors.blue;
            document.documentElement.style.setProperty('--accent-primary', theme === 'dark' ? colors.darkPrimary : colors.primary);
            document.documentElement.style.setProperty('--accent-secondary', colors.secondary);
            document.documentElement.style.setProperty('--accent-light', colors.light);
        }
    }, [theme, accentColor, isInitialized]);

    const setTheme = async (newTheme: 'light' | 'dark') => {
        setThemeState(newTheme);
        try {
            await window.ipcRenderer?.invoke('save-global-setting', 'theme', newTheme);
        } catch (e) {
            console.error('Failed to save theme', e);
        }
    };

    const setAccentColor = async (color: string) => {
        setAccentColorState(color);
        try {
            await window.ipcRenderer?.invoke('save-global-setting', 'accentColor', color);
        } catch (e) {
            console.error('Failed to save accent color', e);
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, accentColor, setTheme, setAccentColor }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}

export const ACCENT_COLORS = {
    blue: 'Blue',
    purple: 'Purple',
    green: 'Green',
    pink: 'Pink',
    orange: 'Orange',
    red: 'Red',
};
