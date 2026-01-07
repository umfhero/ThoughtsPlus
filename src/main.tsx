import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { DashboardLayoutProvider } from './contexts/DashboardLayoutContext'
import { ErrorBoundary } from './components/ErrorBoundary'

// Log startup for debugging APPX issues
console.log('🚀 Thoughts+ starting...');
console.log('📍 Location:', window.location.href);
console.log('🌐 User Agent:', navigator.userAgent);

// Check if IPC is available
if (typeof window !== 'undefined') {
    // @ts-ignore
    console.log('📡 IPC Available:', !!window.ipcRenderer);
}

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
