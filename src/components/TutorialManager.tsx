import { useEffect, useRef } from 'react';
import Shepherd from 'shepherd.js';
import type { Tour } from 'shepherd.js';
import '../styles/shepherd-theme.css';
import { Page } from '../types';

interface TutorialManagerProps {
    activeTutorialId: string | null;
    onComplete: () => void;
    onNavigate: (page: Page) => void;
}

export function TutorialManager({ activeTutorialId, onComplete, onNavigate }: TutorialManagerProps) {
    const tourRef = useRef<Tour | null>(null);

    useEffect(() => {
        if (!activeTutorialId) {
            // Clean up any existing tour
            if (tourRef.current) {
                tourRef.current.complete();
                tourRef.current = null;
            }
            return;
        }

        // Create new tour
        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                cancelIcon: {
                    enabled: true
                },
                classes: 'shepherd-theme-custom',
                scrollTo: { behavior: 'smooth', block: 'center' }
            }
        });

        tourRef.current = tour;

        // Handle tour completion
        tour.on('complete', () => {
            // Mark as completed
            const completed = JSON.parse(localStorage.getItem('completed-tutorials') || '[]');
            if (!completed.includes(activeTutorialId)) {
                completed.push(activeTutorialId);
                localStorage.setItem('completed-tutorials', JSON.stringify(completed));
            }
            onComplete();
        });

        // Handle tour cancellation
        tour.on('cancel', () => {
            onComplete();
        });

        // Load tutorial steps based on ID
        loadTutorialSteps(tour, activeTutorialId, onNavigate);

        // Start the tour
        tour.start();

        return () => {
            if (tour) {
                tour.complete();
            }
        };
    }, [activeTutorialId, onComplete, onNavigate]);

    return null; // This component doesn't render anything
}

function loadTutorialSteps(tour: Tour, tutorialId: string, onNavigate: (page: Page) => void) {
    switch (tutorialId) {
        case 'quickCapture':
            addQuickCaptureTutorial(tour, onNavigate);
            break;
        case 'workspace':
            addWorkspaceTutorial(tour, onNavigate);
            break;
        case 'calendar':
            addCalendarTutorial(tour, onNavigate);
            break;
        case 'timer':
            addTimerTutorial(tour, onNavigate);
            break;
        case 'board':
            addBoardTutorial(tour, onNavigate);
            break;
        case 'shortcuts':
            addShortcutsTutorial(tour);
            break;
        default:
            // Generic tutorial
            tour.addStep({
                id: 'intro',
                title: '🎓 Tutorial',
                text: 'This tutorial is coming soon!',
                buttons: [
                    {
                        text: 'Close',
                        action: tour.complete
                    }
                ]
            });
    }
}

function addQuickCaptureTutorial(tour: Tour, onNavigate: (page: Page) => void) {
    tour.addStep({
        id: 'quick-capture-intro',
        title: '⚡ Quick Capture',
        text: 'Quick Capture is the fastest way to save thoughts. Press <kbd>Ctrl+Shift+N</kbd> from anywhere to open it instantly.',
        buttons: [
            {
                text: 'Skip',
                classes: 'shepherd-button-secondary',
                action: tour.cancel
            },
            {
                text: 'Next',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'quick-capture-usage',
        title: '⚡ How to Use',
        text: 'When Quick Capture opens:<br>1. Type your thought<br>2. Press <kbd>Enter</kbd> or <kbd>ESC</kbd> to save and close<br><br>Your note is automatically saved to the "Quick Notes" folder.',
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Next',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'quick-capture-workspace',
        title: '📁 Find Your Notes',
        text: 'Let\'s go to Workspace to see where your quick notes are stored.',
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Go to Workspace',
                classes: 'shepherd-button-primary',
                action: () => {
                    onNavigate('workspace');
                    setTimeout(() => tour.next(), 500);
                }
            }
        ]
    });

    tour.addStep({
        id: 'quick-capture-folder',
        title: '📂 Quick Notes Folder',
        text: 'Your quick notes are stored here. Remember: these are just a buffer for quick thoughts. Come back later to organize them into proper note structures.',
        attachTo: {
            element: '[data-tutorial="quick-notes-folder"]',
            on: 'right'
        },
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Finish',
                classes: 'shepherd-button-primary',
                action: tour.complete
            }
        ]
    });
}

function addWorkspaceTutorial(tour: Tour, onNavigate: (page: Page) => void) {
    // Navigate to workspace first
    onNavigate('workspace');

    tour.addStep({
        id: 'workspace-intro',
        title: '📁 Welcome to Workspace',
        text: 'Workspace is where all your notes, boards, and files live. Think of it as your personal file system for thoughts.',
        buttons: [
            {
                text: 'Skip',
                classes: 'shepherd-button-secondary',
                action: tour.cancel
            },
            {
                text: 'Start Tour',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'workspace-sidebar',
        title: '🗂️ File Tree',
        text: 'Navigate your files and folders here. Click any file to open it in the editor.',
        attachTo: {
            element: '[data-tutorial="workspace-sidebar"]',
            on: 'right'
        },
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Next',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'workspace-create',
        title: '➕ Create Notes',
        text: 'Click here to create new note structures:<br>• <strong>.md</strong> - Standard markdown notes<br>• <strong>.nerdbook</strong> - Code execution<br>• <strong>.nbm</strong> - Visual boards<br>• <strong>.exec</strong> - Structured notes',
        attachTo: {
            element: '[data-tutorial="create-note-btn"]',
            on: 'bottom'
        },
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Next',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'workspace-linking',
        title: '🔗 Link Notes',
        text: 'Type <kbd>@</kbd> in any note to link to other notes. This creates connections you can visualize in the graph view.',
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Finish',
                classes: 'shepherd-button-primary',
                action: tour.complete
            }
        ]
    });
}

function addCalendarTutorial(tour: Tour, onNavigate: (page: Page) => void) {
    onNavigate('calendar');

    tour.addStep({
        id: 'calendar-intro',
        title: '📅 Smart Calendar',
        text: 'ThoughtsPlus has a built-in calendar with natural language processing. No plugins needed!',
        buttons: [
            {
                text: 'Skip',
                classes: 'shepherd-button-secondary',
                action: tour.cancel
            },
            {
                text: 'Start Tour',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'calendar-quick-add',
        title: '⚡ Quick Add',
        text: 'Press <kbd>Ctrl+M</kbd> anywhere to open Quick Add. Type naturally like "meeting with John next Tuesday at 3pm" and it will parse the event automatically.',
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Next',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'calendar-recurring',
        title: '🔄 Recurring Events',
        text: 'Create recurring events by typing "every Monday" or "daily at 9am". The calendar handles all the repetition for you.',
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Finish',
                classes: 'shepherd-button-primary',
                action: tour.complete
            }
        ]
    });
}

function addTimerTutorial(tour: Tour, onNavigate: (page: Page) => void) {
    onNavigate('timer');

    tour.addStep({
        id: 'timer-intro',
        title: '⏱️ Focus Timer',
        text: 'The timer helps you stay focused with Pomodoro-style work sessions.',
        buttons: [
            {
                text: 'Skip',
                classes: 'shepherd-button-secondary',
                action: tour.cancel
            },
            {
                text: 'Start Tour',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'timer-input',
        title: '🔢 Microwave-Style Input',
        text: 'Type numbers like a microwave:<br>• "25" = 25 minutes<br>• "130" = 1 hour 30 minutes<br><br>Super fast and intuitive!',
        attachTo: {
            element: '[data-tutorial="timer-input"]',
            on: 'bottom'
        },
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Next',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'timer-background',
        title: '🎯 Background Timer',
        text: 'The timer runs in the background even when you minimize the app. You\'ll get a notification when it completes.',
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Finish',
                classes: 'shepherd-button-primary',
                action: tour.complete
            }
        ]
    });
}

function addBoardTutorial(tour: Tour, onNavigate: (page: Page) => void) {
    onNavigate('drawing');

    tour.addStep({
        id: 'board-intro',
        title: '🎨 Visual Boards',
        text: 'Boards are infinite canvases where you can place sticky notes, draw, and organize visually.',
        buttons: [
            {
                text: 'Skip',
                classes: 'shepherd-button-secondary',
                action: tour.cancel
            },
            {
                text: 'Start Tour',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'board-canvas',
        title: '📝 Add Notes',
        text: 'Double-click anywhere on the canvas to create a sticky note. Drag notes around to organize your thoughts visually.',
        attachTo: {
            element: '[data-tutorial="board-canvas"]',
            on: 'top'
        },
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Next',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'board-drawing',
        title: '✏️ Drawing Tools',
        text: 'Use the drawing tools to sketch diagrams, connect ideas, or add visual elements to your board.',
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Finish',
                classes: 'shepherd-button-primary',
                action: tour.complete
            }
        ]
    });
}

function addShortcutsTutorial(tour: Tour) {
    tour.addStep({
        id: 'shortcuts-intro',
        title: '⌨️ Keyboard Shortcuts',
        text: 'ThoughtsPlus is designed for keyboard-driven workflows. Here are the essential shortcuts:',
        buttons: [
            {
                text: 'Skip',
                classes: 'shepherd-button-secondary',
                action: tour.cancel
            },
            {
                text: 'Show Me',
                classes: 'shepherd-button-primary',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'shortcuts-list',
        title: '⌨️ Essential Shortcuts',
        text: `
            <div style="line-height: 1.8;">
                <strong>Quick Actions:</strong><br>
                • <kbd>Ctrl+Shift+N</kbd> - Quick Capture<br>
                • <kbd>Ctrl+Shift+T</kbd> - Quick Timer<br>
                • <kbd>Ctrl+M</kbd> - Calendar Quick Add<br>
                <br>
                <strong>Navigation:</strong><br>
                • <kbd>Ctrl+P</kbd> - Quick Search<br>
                • <kbd>Ctrl+/</kbd> - View All Shortcuts<br>
                <br>
                <strong>Editor:</strong><br>
                • <kbd>Ctrl+Enter</kbd> - Run code cell<br>
                • <kbd>ESC</kbd> - Close overlays
            </div>
        `,
        buttons: [
            {
                text: 'Back',
                classes: 'shepherd-button-secondary',
                action: tour.back
            },
            {
                text: 'Got it!',
                classes: 'shepherd-button-primary',
                action: tour.complete
            }
        ]
    });
}
