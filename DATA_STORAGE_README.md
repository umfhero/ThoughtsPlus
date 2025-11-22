# Calendar Plus - Data Storage Configuration

## 📍 Default Save Location

All data is now saved to your OneDrive folder for automatic cloud sync:

```
C:\Users\umfhe\OneDrive - Middlesex University\CalendarPlus\
```

## 📦 What Gets Saved

### 1. **Notes Data** (`calendar-data.json`)

- All calendar notes with dates, times, descriptions, summaries
- Note importance levels (low, medium, high, misc)
- Automatically synced across all devices via OneDrive

### 2. **Performance Stats** (`fortnite-stats-history.json`)

- **Baseline stats**: Your initial 2 million minutes played plus accumulated data
- **Weekly tracking**: Prevents duplicate additions across devices
- **Deduplication logic**: Uses ISO week numbers (e.g., `2025-W47`) to ensure each week's data is only added once
- Even if you access from multiple devices, the same week won't be counted twice
- Historical snapshots for trend analysis

### 3. **Global Settings** (`settings.json` in OneDrive folder)

**Synced across all devices:**

- Theme preferences
- Data path location
- Any app-wide settings

### 4. **Device-Specific Settings** (local storage)

**Stored per device, NOT synced:**

- Dashboard divider position (desktop vs laptop can have different layouts)
- Device-specific UI preferences
- Stored in: `%APPDATA%\calendar-plus\device-settings.json`

### 5. **Auto-Launch Settings**

- Run on startup preference
- Managed by Windows, stored in registry

## 🔄 How Deduplication Works

### Stats Collection (Weekly)

When you refresh stats from the API:

1. System calculates current ISO week number (e.g., Week 47 of 2025)
2. Checks if `2025-W47` already exists in `weeklyData`
3. **If NEW**: Adds the week's data and updates all-time totals
4. **If EXISTS**: Uses cached data, doesn't add duplicates
5. All-time stats are recalculated from weekly data only

**Example:**

- Desktop adds 6,209 minutes for Week 47 → Total: 2,006,209
- Laptop checks Week 47 → Already exists → Keeps total at 2,006,209 ✓
- Next week (Week 48) → New data added → Total: 2,006,209 + new data

### Data Structure

```json
{
  "weeklyData": {
    "2025-W47": {
      "date": "2025-11-22",
      "minutesPlayed": 6209,
      "uniquePlayers": 1388,
      "favorites": 109,
      "plays": 2500
    },
    "2025-W48": { ... }
  },
  "allTime": {
    "minutesPlayed": 2006209,
    "uniquePlayers": 100250,
    "favorites": 109,
    "plays": 128074
  },
  "snapshots": [ ... ]
}
```

## 🖥️ Multi-Device Support

### Same Settings Everywhere (OneDrive)

- ✅ Notes and events
- ✅ Performance stats (with deduplication)
- ✅ Theme preferences
- ✅ Data folder location

### Different Settings Per Device (Local)

- ✅ Dashboard divider position
- ✅ UI layout preferences
- ✅ Device-specific customizations

## 🛠️ Settings Management

### In the App:

1. Go to **Settings** page
2. **Data Storage** section shows current save location
3. **Change Location** button lets you pick a different folder
4. **Run on Startup** toggle for auto-launch

### Manual File Access:

- **Synced Data**: `C:\Users\umfhe\OneDrive - Middlesex University\CalendarPlus\`
- **Local Settings**: `%APPDATA%\calendar-plus\`

## 🔐 Data Safety

1. **OneDrive Backup**: All important data automatically backed up
2. **Version History**: OneDrive keeps file versions
3. **Multi-Device**: Access from any device with OneDrive
4. **Atomic Writes**: Files written safely to prevent corruption
5. **Error Handling**: Graceful fallbacks if OneDrive unavailable

## 📝 Notes

- First launch will create the OneDrive folder structure automatically
- If OneDrive folder doesn't exist, it will be created
- Week-based deduplication ensures consistency across devices
- Divider positions remain device-specific for optimal UX
- Stats refresh is safe to run from any device, any time

## 🚀 Future Enhancements

Consider these for later:

- Conflict resolution UI for manual overrides
- Export/Import functionality
- Backup scheduler
- Data encryption for sensitive notes
