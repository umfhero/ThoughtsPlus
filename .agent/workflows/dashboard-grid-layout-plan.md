# Dashboard Grid Layout Implementation Plan

## Overview
Transform the dashboard from a simple vertical list to a flexible grid system where widgets can be:
- Placed side-by-side (max 2 per row)
- Resized with width sliders between adjacent widgets
- Resized vertically with always-visible height sliders
- Dragged to reorder rows
- Separated back to individual rows

## Data Structure

```typescript
type DashboardRow = {
    id: string;
    widgets: string[]; // 1-2 widget IDs
    widthRatio?: number; // For 2-widget rows: left widget width percentage (default: 50)
    heights?: { [widgetId: string]: number }; // Individual widget heights
};
```

## State Management

### Current State (DONE ✅)
- `dashboardLayout: DashboardRow[]` - Grid-based layout
- `combineWidgets()` - Merge widget into existing row
- `separateWidget()` - Split widget to own row

### Needed State
- Width resize handlers for each row with 2 widgets
- Height resize handlers for each widget (always visible)
- Drag state for row reordering

## Rendering Logic

### Row Structure
```
<Reorder.Group> (for rows)
  <Reorder.Item key={row.id}>
    {row.widgets.length === 1 ? (
      <SingleWidget />
    ) : (
      <TwoWidgetRow>
        <Widget1 style={{width: `${widthRatio}%`}} />
        <WidthResizer />
        <Widget2 style={{width: `${100-widthRatio}%`}} />
      </TwoWidgetRow>
    )}
    <HeightResizer />
  </Reorder.Item>
</Reorder.Group>
```

## Implementation Steps

1. ✅ Update state management (DONE)
2. ⏳ Update render logic to use dashboardLayout instead of dashboardOrder
3. ⏳ Add width resizer component for 2-widget rows
4. ⏳ Make height resizers always visible (not just mobile)
5. ⏳ Add UI controls in edit mode:
   - Button to combine widgets
   - Button to separate widgets
6. ⏳ Remove redundant height slider under main_content

## Files to Modify
- `src/pages/Dashboard.tsx` - Main implementation
