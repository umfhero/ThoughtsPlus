import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Custom theme color configuration
export interface CustomThemeColors {
    backgroundColor: string;
    textColor: string;
    sidebarBackground: string;
    borderColor: string;
    cardBackground: string;
}

// Saved theme structure with all required fields
export interface SavedTheme {
    id: string;
    name: string;
    accentColor: string;
    colors: CustomThemeColors;
    font: string;
    createdAt: string;
}

// Extended theme type to include 'custom'
export type ThemeType = 'light' | 'dark' | 'custom';

interface ThemeContextType {
    theme: ThemeType;
    accentColor: string;
    setTheme: (theme: ThemeType) => void;
    setAccentColor: (color: string) => void;
    appIcon: string;
    setAppIcon: (icon: string) => void;
    // Custom theme state
    customThemeColors: CustomThemeColors;
    setCustomThemeColors: (colors: Partial<CustomThemeColors>) => void;
    savedThemes: SavedTheme[];
    // Custom theme management functions
    saveCurrentTheme: (name: string) => void;
    loadTheme: (id: string) => void;
    deleteTheme: (id: string) => void;
    updateTheme: (id: string) => void;
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

// Default custom theme colors for light mode
export const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
    backgroundColor: '#ffffff',
    textColor: '#111827',
    sidebarBackground: '#f9fafb',
    borderColor: '#e5e7eb',
    cardBackground: '#ffffff',
};

// Default custom theme colors for dark mode
export const DEFAULT_DARK_CUSTOM_COLORS: CustomThemeColors = {
    backgroundColor: '#111827',
    textColor: '#f3f4f6',
    sidebarBackground: '#1f2937',
    borderColor: '#374151',
    cardBackground: '#1f2937',
};

// Storage keys
const CUSTOM_THEMES_STORAGE_KEY = 'custom-themes';
const ACTIVE_THEME_ID_KEY = 'active-custom-theme-id';

// Helper to generate unique ID
const generateThemeId = (): string => {
    return `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to generate unique theme name with numeric suffix if needed
export const generateUniqueThemeName = (baseName: string, existingThemes: SavedTheme[]): string => {
    const existingNames = existingThemes.map(t => t.name);
    if (!existingNames.includes(baseName)) {
        return baseName;
    }

    let counter = 2;
    let newName = `${baseName} (${counter})`;
    while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName} (${counter})`;
    }
    return newName;
};

// Helper to serialize themes to JSON
export const serializeThemes = (themes: SavedTheme[]): string => {
    return JSON.stringify(themes);
};

// Helper to deserialize themes from JSON
export const deserializeThemes = (json: string): SavedTheme[] => {
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidSavedTheme);
    } catch {
        return [];
    }
};

// Validate that a theme has all required fields
export const isValidSavedTheme = (theme: unknown): theme is SavedTheme => {
    if (!theme || typeof theme !== 'object') return false;
    const t = theme as Record<string, unknown>;
    return (
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        typeof t.accentColor === 'string' &&
        typeof t.font === 'string' &&
        typeof t.createdAt === 'string' &&
        t.colors !== null &&
        typeof t.colors === 'object' &&
        typeof (t.colors as Record<string, unknown>).backgroundColor === 'string' &&
        typeof (t.colors as Record<string, unknown>).textColor === 'string' &&
        typeof (t.colors as Record<string, unknown>).sidebarBackground === 'string' &&
        typeof (t.colors as Record<string, unknown>).borderColor === 'string' &&
        typeof (t.colors as Record<string, unknown>).cardBackground === 'string'
    );
};

// Helper to determine if theme should fallback to light after deletion
export interface DeleteThemeResult {
    updatedThemes: SavedTheme[];
    shouldFallbackToLight: boolean;
    newActiveThemeId: string | null;
}

export const computeDeleteThemeResult = (
    themes: SavedTheme[],
    themeIdToDelete: string,
    activeThemeId: string | null
): DeleteThemeResult => {
    const updatedThemes = themes.filter(t => t.id !== themeIdToDelete);
    const shouldFallbackToLight = activeThemeId === themeIdToDelete;
    const newActiveThemeId = shouldFallbackToLight ? null : activeThemeId;

    return {
        updatedThemes,
        shouldFallbackToLight,
        newActiveThemeId,
    };
};

// CSS variable names for custom theme colors
export const CUSTOM_THEME_CSS_VARIABLES = {
    backgroundColor: '--custom-bg',
    textColor: '--custom-text',
    sidebarBackground: '--custom-sidebar',
    borderColor: '--custom-border',
    cardBackground: '--custom-card',
} as const;

// Helper to compute what CSS variables should be set for a custom theme
export interface CustomThemeCSSVariables {
    '--custom-bg': string;
    '--custom-text': string;
    '--custom-sidebar': string;
    '--custom-border': string;
    '--custom-card': string;
}

export const computeCustomThemeCSSVariables = (colors: CustomThemeColors): CustomThemeCSSVariables => {
    return {
        '--custom-bg': colors.backgroundColor,
        '--custom-text': colors.textColor,
        '--custom-sidebar': colors.sidebarBackground,
        '--custom-border': colors.borderColor,
        '--custom-card': colors.cardBackground,
    };
};

// Helper to verify all custom theme colors are applied to CSS variables
export const verifyThemeColorsApplied = (
    savedTheme: SavedTheme,
    getCSSVariable: (name: string) => string
): boolean => {
    const expectedVariables = computeCustomThemeCSSVariables(savedTheme.colors);

    // Check each CSS variable matches the expected value
    for (const [varName, expectedValue] of Object.entries(expectedVariables)) {
        const actualValue = getCSSVariable(varName);
        if (actualValue !== expectedValue) {
            return false;
        }
    }

    // Also verify accent color is applied
    const accentValue = getCSSVariable('--accent-primary');
    if (accentValue !== savedTheme.accentColor && !accentValue.includes('rgb')) {
        // Allow for preset colors which are in rgb format
        return false;
    }

    return true;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeType>('light');
    const [accentColor, setAccentColorState] = useState('#3b82f6'); // Default blue hex
    const [isInitialized, setIsInitialized] = useState(false);

    // Custom theme state
    const [customThemeColors, setCustomThemeColorsState] = useState<CustomThemeColors>(DEFAULT_CUSTOM_COLORS);
    const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
    const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
    const [currentFont, setCurrentFont] = useState<string>('Inter');
    const [appIcon, setAppIconState] = useState<string>('ThoughtsPlus');

    useEffect(() => {
        // Load theme from settings
        const loadTheme = async () => {
            try {
                const savedTheme = await window.ipcRenderer?.invoke('get-global-setting', 'theme');
                const savedAccent = await window.ipcRenderer?.invoke('get-global-setting', 'accentColor');
                const savedFont = await window.ipcRenderer?.invoke('get-global-setting', 'font');
                const savedIcon = await window.ipcRenderer?.invoke('get-app-icon');

                // Load custom themes from storage
                const savedCustomThemes = await window.ipcRenderer?.invoke('get-global-setting', CUSTOM_THEMES_STORAGE_KEY);
                if (savedCustomThemes) {
                    const themes = deserializeThemes(savedCustomThemes);
                    setSavedThemes(themes);
                }

                // Load active custom theme ID
                const savedActiveThemeId = await window.ipcRenderer?.invoke('get-global-setting', ACTIVE_THEME_ID_KEY);
                if (savedActiveThemeId) {
                    setActiveThemeId(savedActiveThemeId);
                }

                // Load custom theme colors
                const savedCustomColors = await window.ipcRenderer?.invoke('get-global-setting', 'customThemeColors');
                if (savedCustomColors) {
                    try {
                        const colors = JSON.parse(savedCustomColors);
                        setCustomThemeColorsState({ ...DEFAULT_CUSTOM_COLORS, ...colors });
                    } catch {
                        // Use defaults if parsing fails
                    }
                }

                if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'custom') {
                    setThemeState(savedTheme);
                }
                if (savedAccent) setAccentColorState(savedAccent);
                if (savedFont) setCurrentFont(savedFont);
                if (savedIcon) setAppIconState(savedIcon);
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
        document.documentElement.classList.remove('light', 'dark', 'custom');
        document.documentElement.classList.add(theme === 'custom' ? 'custom' : theme);

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
            document.documentElement.style.setProperty('--accent-primary', theme === 'dark' || theme === 'custom' ? colors.darkPrimary : colors.primary);
            document.documentElement.style.setProperty('--accent-secondary', colors.secondary);
            document.documentElement.style.setProperty('--accent-light', colors.light);
        }

        // Apply custom theme colors when custom theme is active
        if (theme === 'custom') {
            // Set CSS variables for custom theme colors
            document.documentElement.style.setProperty('--custom-bg', customThemeColors.backgroundColor);
            document.documentElement.style.setProperty('--custom-text', customThemeColors.textColor);
            document.documentElement.style.setProperty('--custom-sidebar', customThemeColors.sidebarBackground);
            document.documentElement.style.setProperty('--custom-border', customThemeColors.borderColor);
            document.documentElement.style.setProperty('--custom-card', customThemeColors.cardBackground);
        } else {
            // Clear custom theme CSS variables when not using custom theme
            document.documentElement.style.removeProperty('--custom-bg');
            document.documentElement.style.removeProperty('--custom-text');
            document.documentElement.style.removeProperty('--custom-sidebar');
            document.documentElement.style.removeProperty('--custom-border');
            document.documentElement.style.removeProperty('--custom-card');
        }
    }, [theme, accentColor, customThemeColors, isInitialized]);

    const setTheme = async (newTheme: ThemeType) => {
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

    const setAppIcon = async (icon: string) => {
        setAppIconState(icon);
        try {
            await window.ipcRenderer?.invoke('set-app-icon', icon);
        } catch (e) {
            console.error('Failed to save app icon', e);
        }
    };

    // Set custom theme colors (partial update)
    const setCustomThemeColors = async (colors: Partial<CustomThemeColors>) => {
        const newColors = { ...customThemeColors, ...colors };
        setCustomThemeColorsState(newColors);
        try {
            await window.ipcRenderer?.invoke('save-global-setting', 'customThemeColors', JSON.stringify(newColors));
        } catch (e) {
            console.error('Failed to save custom theme colors', e);
        }
    };

    // Save current theme configuration with a name
    const saveCurrentTheme = async (name: string) => {
        const uniqueName = generateUniqueThemeName(name, savedThemes);
        const newTheme: SavedTheme = {
            id: generateThemeId(),
            name: uniqueName,
            accentColor: accentColor,
            colors: { ...customThemeColors },
            font: currentFont,
            createdAt: new Date().toISOString(),
        };

        const updatedThemes = [...savedThemes, newTheme];
        setSavedThemes(updatedThemes);
        setActiveThemeId(newTheme.id);

        try {
            await window.ipcRenderer?.invoke('save-global-setting', CUSTOM_THEMES_STORAGE_KEY, serializeThemes(updatedThemes));
            await window.ipcRenderer?.invoke('save-global-setting', ACTIVE_THEME_ID_KEY, newTheme.id);
        } catch (e) {
            console.error('Failed to save theme', e);
        }
    };

    // Load a saved theme by ID
    const loadTheme = async (id: string) => {
        const themeToLoad = savedThemes.find(t => t.id === id);
        if (!themeToLoad) return;

        setThemeState('custom');
        setAccentColorState(themeToLoad.accentColor);
        setCustomThemeColorsState(themeToLoad.colors);
        setCurrentFont(themeToLoad.font);
        setActiveThemeId(id);

        try {
            await window.ipcRenderer?.invoke('save-global-setting', 'theme', 'custom');
            await window.ipcRenderer?.invoke('save-global-setting', 'accentColor', themeToLoad.accentColor);
            await window.ipcRenderer?.invoke('save-global-setting', 'customThemeColors', JSON.stringify(themeToLoad.colors));
            await window.ipcRenderer?.invoke('save-global-setting', 'font', themeToLoad.font);
            await window.ipcRenderer?.invoke('save-global-setting', ACTIVE_THEME_ID_KEY, id);
        } catch (e) {
            console.error('Failed to load theme', e);
        }
    };

    // Delete a saved theme by ID
    const deleteTheme = async (id: string) => {
        const updatedThemes = savedThemes.filter(t => t.id !== id);
        setSavedThemes(updatedThemes);

        // If deleting the active theme, revert to light
        if (activeThemeId === id) {
            setThemeState('light');
            setActiveThemeId(null);
            try {
                await window.ipcRenderer?.invoke('save-global-setting', 'theme', 'light');
                await window.ipcRenderer?.invoke('save-global-setting', ACTIVE_THEME_ID_KEY, null);
            } catch (e) {
                console.error('Failed to revert theme', e);
            }
        }

        try {
            await window.ipcRenderer?.invoke('save-global-setting', CUSTOM_THEMES_STORAGE_KEY, serializeThemes(updatedThemes));
        } catch (e) {
            console.error('Failed to delete theme', e);
        }
    };

    // Update an existing saved theme with current settings
    const updateTheme = async (id: string) => {
        const updatedThemes = savedThemes.map(t => {
            if (t.id === id) {
                return {
                    ...t,
                    accentColor: accentColor,
                    colors: { ...customThemeColors },
                    font: currentFont,
                };
            }
            return t;
        });

        setSavedThemes(updatedThemes);

        try {
            await window.ipcRenderer?.invoke('save-global-setting', CUSTOM_THEMES_STORAGE_KEY, serializeThemes(updatedThemes));
        } catch (e) {
            console.error('Failed to update theme', e);
        }
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            accentColor,
            setTheme,
            setAccentColor,
            appIcon,
            setAppIcon,
            customThemeColors,
            setCustomThemeColors,
            savedThemes,
            saveCurrentTheme,
            loadTheme,
            deleteTheme,
            updateTheme,
        }}>
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
