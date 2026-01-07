import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ error, errorInfo });

        // Try to log to main process for debugging
        try {
            // @ts-ignore
            window.ipcRenderer?.invoke('log-error', {
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack
            });
        } catch (e) {
            console.error('Failed to send error to main process:', e);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    backgroundColor: '#1f2937',
                    color: '#f3f4f6',
                    minHeight: '100vh',
                    boxSizing: 'border-box'
                }}>
                    <h1 style={{ color: '#ef4444', marginBottom: '16px', fontSize: '24px' }}>
                        ⚠️ Something went wrong
                    </h1>
                    <p style={{ marginBottom: '24px', color: '#9ca3af' }}>
                        The app encountered an unexpected error. This has been logged for debugging.
                    </p>

                    <div style={{
                        backgroundColor: '#374151',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '24px'
                    }}>
                        <h2 style={{ fontSize: '14px', marginBottom: '8px', color: '#fbbf24' }}>
                            Error Details:
                        </h2>
                        <pre style={{
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: '#f87171',
                            margin: 0
                        }}>
                            {this.state.error?.message}
                        </pre>
                    </div>

                    {this.state.error?.stack && (
                        <details style={{ marginBottom: '24px' }}>
                            <summary style={{ cursor: 'pointer', color: '#60a5fa', marginBottom: '8px' }}>
                                Stack Trace
                            </summary>
                            <pre style={{
                                backgroundColor: '#374151',
                                padding: '16px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: '#d1d5db',
                                maxHeight: '200px',
                                overflow: 'auto'
                            }}>
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            🔄 Reload App
                        </button>
                        <button
                            onClick={() => {
                                try {
                                    // @ts-ignore
                                    window.ipcRenderer?.invoke('open-dev-tools');
                                } catch (e) {
                                    console.error('Failed to open dev tools:', e);
                                }
                            }}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#4b5563',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            🔧 Open DevTools
                        </button>
                    </div>

                    <p style={{ marginTop: '24px', fontSize: '12px', color: '#6b7280' }}>
                        If this problem persists, please report it with the error details above.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
