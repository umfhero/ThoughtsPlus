# Overdue Task UI Enhancement - Implementation Plan

## Goal
Rework the events widget to show overdue tasks explicitly, and allow users to mark them as "Completed (Late)" or "Missed", with proper graph color coding.

## Current State Analysis

### Data Model (`types.ts`)
```typescript
interface Note {
    id: string;
    title: string;
    description: string;
    time: string;
    importance: 'low' | 'medium' | 'high' | 'misc';
    completed?: boolean;          // Whether task is done
    completedLate?: boolean;      // If completed, was it late?
    // ... other fields
}
```

### Current Logic
- **isOverdue**: Task's datetime is in the past (`eventDateTime < now`)
- **Missed tab**: Shows events where `isOverdue && !completed`
- **Completed tab**: Shows events where `completed === true`
- **Upcoming tab**: Shows events where `!isOverdue && !completed`

### Current Issue
When a task becomes overdue, it **automatically moves to the "Missed" tab**. Users can't easily notice this or act on it. They have to:
1. Go to Missed tab
2. Click the task's checkbox to complete it
3. Then toggle "Late" button

### Desired Behavior
1. **Overdue tasks stay visible in main view** with an "Overdue by X time" badge
2. **Two action buttons appear for overdue tasks**:
   - ✅ "Complete (Late)" - marks as completed + completedLate = true
   - ❌ "Mark Missed" - keeps completed = false (task counts as truly missed)
3. **Graph colors**:
   - 🟢 Green: Completed on time (`completed && !completedLate`)
   - 🟠 Orange: Completed late (`completed && completedLate`)
   - 🔴 Red: Missed (not completed and past deadline)
4. **Overdue task styling**: Orange background/border until resolved

---

## Implementation Steps

### Step 1: Update Dashboard Event Card Rendering
**File**: `Dashboard.tsx` (lines ~1380-1475)

**Changes**:
1. Add condition to detect overdue tasks: `isOverdue && !note.completed`
2. For overdue tasks, show:
   - Orange styling (not red since not "missed" yet)
   - "Overdue by X" time badge
   - Two buttons: "Complete (Late)" and "Mark as Missed"

### Step 2: Add Helper Function for Overdue Time Calculation
**File**: `Dashboard.tsx`

Add a helper function:
```typescript
const getOverdueTime = (eventDate: Date) => {
    const now = new Date();
    const diff = now.getTime() - eventDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}m ago`;
};
```

### Step 3: Add "Mark as Missed" Handler
**File**: `Dashboard.tsx`

Create a new function to explicitly mark a task as missed:
```typescript
const handleMarkMissed = (noteId: string, dateKey: string) => {
    // This keeps completed = false but allows us to track it
    // The task remains in its current state - not completed
    // But we could add a new field `missed?: boolean` if needed
};
```

**Note**: Currently the system treats `isOverdue && !completed` as "missed". We may need to add an explicit `missed` field if we want to distinguish between:
- Tasks that are overdue but user hasn't acted yet
- Tasks explicitly marked as "missed" by user

### Step 4: Add "Complete Late" Handler  
**File**: `Dashboard.tsx`

Create a function:
```typescript
const handleCompleteLate = (noteId: string, dateKey: string) => {
    const dayNotes = notes[dateKey] || [];
    const noteToUpdate = dayNotes.find(n => n.id === noteId);
    if (!noteToUpdate) return;
    
    const updatedNote = {
        ...noteToUpdate,
        completed: true,
        completedLate: true
    };
    onUpdateNote(updatedNote, parseISO(dateKey));
};
```

### Step 5: Update TaskTrendChart Graph Colors
**File**: `TaskTrendChart.tsx` (lines ~241-265)

Current logic determines segment color based on score change:
- Score up (+1) = Green
- Score down (-1) = Red

**Updated logic**:
- Completed on time: Green (#10b981)
- Completed late: Orange (#f59e0b)
- Missed: Red (#f43f5e)

```typescript
// In the task point creation loop
if (task.completed) {
    score += 1;
    completedTasks++;
    if (task.completedLate) {
        segmentColor = '#f59e0b'; // Orange for late
        dotColor = '#f59e0b';
        lateCount++;
    } else {
        segmentColor = '#10b981'; // Green for on-time
        dotColor = '#10b981';
        earlyCount++; // Actually "on time" count
    }
} else if (isMissed) {
    score -= 1;
    missedTasks++;
    segmentColor = '#f43f5e'; // Red
    dotColor = '#f43f5e';
}
```

### Step 6: Update Graph Legend
**File**: `TaskTrendChart.tsx` (lines ~760-774)

Add orange legend item:
```tsx
<div className="flex items-center gap-1">
    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
    <span className="text-[9px] text-gray-400">Late</span>
</div>
```

### Step 7: Update Tab Filtering Logic
**File**: `Dashboard.tsx`

Current `filteredEventsForTab` logic needs adjustment:
- **Upcoming**: `!isOverdue && !completed` (future tasks, not yet done)
- **Overdue**: NEW TAB or show in Upcoming with special styling
- **Completed**: `completed === true` (includes both on-time and late)
- **Missed**: Tasks explicitly unresolved past deadline

**Option A**: Keep 3 tabs, show overdue tasks in "Upcoming" with orange styling
**Option B**: Add 4th "Overdue" tab

→ **Recommended: Option A** - simpler, less UI clutter

---

## Files to Modify

1. **`Dashboard.tsx`**
   - Add `getOverdueTime()` helper
   - Add `handleCompleteLate()` function
   - Update event card rendering for overdue state
   - Add orange styling for overdue tasks
   - Add "Overdue by X" badge
   - Add two action buttons for overdue tasks

2. **`TaskTrendChart.tsx`**
   - Update segment color logic to use orange for late completions
   - Add orange gradient definition
   - Update legend to include "Late" indicator

3. **`types.ts`** (optional)
   - If needed, could add `missed?: boolean` field
   - Current approach: `isOverdue && !completed` = missed

---

## Testing Checklist

- [ ] Overdue tasks show with orange styling
- [ ] "Overdue by X time" badge displays correctly
- [ ] "Complete (Late)" button works and sets completedLate=true
- [ ] "Mark Missed" keeps task as not completed
- [ ] Graph shows green for on-time, orange for late, red for missed
- [ ] Graph legend includes all three colors
- [ ] Tab counts are accurate
- [ ] Existing completion/late toggle still works for already-completed tasks
