import { TutorialConfig } from '../components/InteractiveTutorial';

export const TUTORIAL_CONFIGS: Record<string, TutorialConfig> = {
    quickCapture: {
        id: 'quick-capture',
        title: 'Quick Capture Tutorial',
        description: 'Learn how to instantly capture thoughts from anywhere',
        steps: [
            {
                id: 'intro',
                title: 'Welcome to Quick Capture!',
                description: 'Quick Capture is the fastest way to save thoughts without interrupting your workflow. Press Ctrl+Shift+N from anywhere to open it.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'hotkey',
                title: 'Try the Global Hotkey',
                description: 'Press Ctrl+Shift+N right now to see Quick Capture appear. It works even when ThoughtsPlus is minimized!',
                position: 'center',
                action: 'none'
            },
            {
                id: 'typing',
                title: 'Type Your Thought',
                description: 'When Quick Capture opens, just start typing. Your note is automatically saved to the "Quick Notes" folder in your Workspace.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'escape',
                title: 'Close with ESC',
                description: 'Press ESC to instantly close Quick Capture and return to what you were doing. Your note is already saved!',
                position: 'center',
                action: 'none'
            }
        ]
    },

    workspace: {
        id: 'workspace',
        title: 'Workspace Tutorial',
        description: 'Master the file-based note organization system',
        steps: [
            {
                id: 'intro',
                title: 'Welcome to Workspace!',
                description: 'Workspace is where all your notes, boards, and files live. Think of it like a file explorer for your thoughts.',
                targetSelector: '[data-tutorial="workspace-sidebar"]',
                position: 'right',
                action: 'none'
            },
            {
                id: 'file-tree',
                title: 'Navigate Your Files',
                description: 'Use the file tree on the left to browse folders and files. Click any file to open it in the editor.',
                targetSelector: '[data-tutorial="file-tree"]',
                position: 'right',
                action: 'none'
            },
            {
                id: 'create-note',
                title: 'Create a New Note',
                description: 'Click the "+" button to create a new note. You can create text notes (.md), boards (.nbm), or nerdbooks (.nerdbook).',
                targetSelector: '[data-tutorial="create-note-btn"]',
                position: 'bottom',
                action: 'none'
            },
            {
                id: 'editor',
                title: 'Edit Your Notes',
                description: 'The main editor area shows your active file. Changes are auto-saved as you type.',
                targetSelector: '[data-tutorial="content-area"]',
                position: 'left',
                action: 'none'
            },
            {
                id: 'linking',
                title: 'Link Notes Together',
                description: 'Type @ to mention other notes and create connections. Use the graph view to visualize your linked notes.',
                targetSelector: '[data-tutorial="content-area"]',
                position: 'left',
                action: 'none'
            }
        ]
    },

    nerdbook: {
        id: 'nerdbook',
        title: 'Nerdbook Tutorial',
        description: 'Learn to execute code directly in your notes',
        steps: [
            {
                id: 'intro',
                title: 'What is a Nerdbook?',
                description: 'Nerdbooks let you write and execute Python or JavaScript code directly in your notes - like Jupyter notebooks!',
                position: 'center',
                action: 'none'
            },
            {
                id: 'create',
                title: 'Create a Nerdbook',
                description: 'Go to Workspace and create a new file with the .nerdbook extension. Or use the "New Nerdbook" button.',
                targetSelector: '[data-tutorial="create-note-btn"]',
                position: 'bottom',
                action: 'none'
            },
            {
                id: 'code-cell',
                title: 'Add Code Cells',
                description: 'Click "Add Code Cell" to insert executable code blocks. Choose Python or JavaScript as your language.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'execute',
                title: 'Run Your Code',
                description: 'Click the "Run" button or press Ctrl+Enter to execute the code cell. Results appear below the cell.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'markdown',
                title: 'Mix Code and Notes',
                description: 'Add markdown cells between code cells to document your work. Perfect for tutorials, experiments, and data analysis!',
                position: 'center',
                action: 'none'
            }
        ]
    },

    calendar: {
        id: 'calendar',
        title: 'Calendar Tutorial',
        description: 'Master the smart calendar with NLP quick add',
        steps: [
            {
                id: 'intro',
                title: 'Smart Calendar',
                description: 'ThoughtsPlus has a built-in calendar with natural language processing. No plugins needed!',
                targetSelector: '[data-tutorial="calendar-view"]',
                position: 'center',
                action: 'none'
            },
            {
                id: 'quick-add',
                title: 'Quick Add with NLP',
                description: 'Press Ctrl+M anywhere to open Quick Add. Type naturally like "meeting with John next Tuesday at 3pm" and it will parse the event.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'recurring',
                title: 'Recurring Events',
                description: 'Create recurring events by typing "every Monday" or "daily at 9am". The calendar handles all the repetition.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'late-tracking',
                title: 'Late Tracking',
                description: 'The calendar tracks when you complete tasks late and shows you patterns. Perfect for improving time management!',
                targetSelector: '[data-tutorial="late-tracker"]',
                position: 'bottom',
                action: 'none'
            }
        ]
    },

    board: {
        id: 'board',
        title: 'Board Tutorial',
        description: 'Create visual boards with sticky notes and drawings',
        steps: [
            {
                id: 'intro',
                title: 'Visual Boards',
                description: 'Boards are infinite canvases where you can place sticky notes, draw, and organize visually.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'create-board',
                title: 'Create a Board',
                description: 'Go to the Board page or create a .nbm file in Workspace. Each board is saved as a file.',
                targetSelector: '[data-tutorial="board-canvas"]',
                position: 'center',
                action: 'none'
            },
            {
                id: 'add-note',
                title: 'Add Sticky Notes',
                description: 'Double-click anywhere on the canvas to create a sticky note. Drag it around to organize your thoughts.',
                targetSelector: '[data-tutorial="board-canvas"]',
                position: 'center',
                action: 'none'
            },
            {
                id: 'drawing',
                title: 'Draw on the Canvas',
                description: 'Use the drawing tools to sketch diagrams, connect ideas, or add visual elements to your board.',
                targetSelector: '[data-tutorial="drawing-tools"]',
                position: 'bottom',
                action: 'none'
            },
            {
                id: 'colors',
                title: 'Customize Colors',
                description: 'Change sticky note colors to categorize ideas. Use different colors for different types of information.',
                position: 'center',
                action: 'none'
            }
        ]
    },

    timer: {
        id: 'timer',
        title: 'Focus Timer Tutorial',
        description: 'Use the microwave-style timer for focused work sessions',
        steps: [
            {
                id: 'intro',
                title: 'Focus Timer',
                description: 'The timer helps you stay focused with Pomodoro-style work sessions. It tracks your productivity over time.',
                targetSelector: '[data-tutorial="timer-page"]',
                position: 'center',
                action: 'none'
            },
            {
                id: 'microwave-input',
                title: 'Microwave-Style Input',
                description: 'Type numbers like a microwave: "25" = 25 minutes, "130" = 1 hour 30 minutes. Super fast!',
                targetSelector: '[data-tutorial="timer-input"]',
                position: 'bottom',
                action: 'none'
            },
            {
                id: 'start',
                title: 'Start Your Session',
                description: 'Click Start or press Enter to begin. The timer runs in the background even if you minimize the app.',
                targetSelector: '[data-tutorial="timer-start"]',
                position: 'bottom',
                action: 'none'
            },
            {
                id: 'history',
                title: 'Track Your Progress',
                description: 'View your session history to see how much focused time you\'ve accumulated. Great for motivation!',
                targetSelector: '[data-tutorial="timer-history"]',
                position: 'top',
                action: 'none'
            }
        ]
    },

    aiFeatures: {
        id: 'ai-features',
        title: 'AI Features Tutorial',
        description: 'Learn how to use AI-powered features',
        steps: [
            {
                id: 'intro',
                title: 'AI-Powered Features',
                description: 'ThoughtsPlus includes optional AI features to help you organize and generate content. You need an API key to use them.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'setup',
                title: 'Setup API Key',
                description: 'Go to Settings > AI Configuration to add your Gemini, OpenAI, or Perplexity API key. The app validates it for you.',
                targetSelector: '[data-tutorial="ai-settings"]',
                position: 'right',
                action: 'none'
            },
            {
                id: 'dashboard-summary',
                title: 'Dashboard AI Summary',
                description: 'The Dashboard shows an AI-generated summary of your upcoming events and tasks. It updates automatically.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'note-structure',
                title: 'Generate Note Structure',
                description: 'When creating a note, use the AI button to generate a structured outline based on your topic.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'flashcards',
                title: 'AI Flashcards',
                description: 'In Workspace, select text and use "Generate Flashcards" to create study cards automatically.',
                position: 'center',
                action: 'none'
            }
        ]
    },

    shortcuts: {
        id: 'shortcuts',
        title: 'Keyboard Shortcuts Tutorial',
        description: 'Master the keyboard shortcuts for maximum productivity',
        steps: [
            {
                id: 'intro',
                title: 'Keyboard Shortcuts',
                description: 'ThoughtsPlus is designed for keyboard-driven workflows. Here are the essential shortcuts.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'quick-capture',
                title: 'Ctrl+Shift+N - Quick Capture',
                description: 'Open Quick Capture from anywhere. This is the most important shortcut!',
                position: 'center',
                action: 'none'
            },
            {
                id: 'quick-timer',
                title: 'Ctrl+Shift+T - Quick Timer',
                description: 'Start a focus timer without opening the Timer page. Type duration and press Enter.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'calendar-add',
                title: 'Ctrl+M - Calendar Quick Add',
                description: 'Add calendar events with natural language from anywhere in the app.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'search',
                title: 'Ctrl+P - Quick Search',
                description: 'Search across all your notes and files instantly.',
                position: 'center',
                action: 'none'
            },
            {
                id: 'view-all',
                title: 'View All Shortcuts',
                description: 'Press Ctrl+/ to see all available shortcuts anytime. You can also customize them in Settings!',
                position: 'center',
                action: 'none'
            }
        ]
    }
};

export const TUTORIAL_CATEGORIES = [
    {
        id: 'getting-started',
        name: 'Getting Started',
        tutorials: ['quickCapture', 'workspace', 'shortcuts']
    },
    {
        id: 'core-features',
        name: 'Core Features',
        tutorials: ['calendar', 'board', 'timer']
    },
    {
        id: 'advanced',
        name: 'Advanced Features',
        tutorials: ['nerdbook', 'aiFeatures']
    }
];
