import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { DashboardLayoutProvider } from './contexts/DashboardLayoutContext'
import { ErrorBoundary } from './components/ErrorBoundary'

// Log startup for debugging APPX issues
console.log('[App] ThoughtsPlus starting...');
console.log('[App] Location:', window.location.href);
console.log('[App] User Agent:', navigator.userAgent);

// Check if IPC is available
if (typeof window !== 'undefined') {
    // @ts-ignore
    console.log('[App] IPC Available:', !!window.ipcRenderer);
}

// Initialize saved font preference immediately on startup
// This ensures fonts are applied before React renders
const initializeFont = () => {
    const savedFont = localStorage.getItem('app-font');
    if (savedFont) {
        let fontStack: string;
        switch (savedFont) {
            case 'Playfair Display':
                fontStack = "'Playfair Display', 'Georgia', 'Times New Roman', serif";
                break;
            case 'Architects Daughter':
                fontStack = "'Architects Daughter', 'Comic Sans MS', cursive";
                break;
            case 'Inter':
                fontStack = "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                break;
            case 'Poppins':
                fontStack = "'Poppins', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                break;
            case 'CustomFont':
                fontStack = "'CustomFont', 'Segoe UI', sans-serif";
                break;
            case 'Outfit':
            default:
                fontStack = "'Outfit', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                break;
        }
        document.documentElement.style.setProperty('--app-font', fontStack);
        document.body.style.fontFamily = fontStack;
        console.log('[Font] Font initialized:', savedFont);
    }
};

initializeFont();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ThemeProvider>
                <NotificationProvider>
                    <DashboardLayoutProvider>
                        <App />
                    </DashboardLayoutProvider>
                </NotificationProvider>
            </ThemeProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
