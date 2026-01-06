import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { DashboardLayoutProvider } from './contexts/DashboardLayoutContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider>
            <NotificationProvider>
                <DashboardLayoutProvider>
                    <App />
                </DashboardLayoutProvider>
            </NotificationProvider>
        </ThemeProvider>
    </React.StrictMode>,
)
