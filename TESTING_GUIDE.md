# Testing Guide - Fresh User Testing

## Problem: Data Persists After Uninstall

When testing as a "fresh user", simply uninstalling and reinstalling the app **does NOT** clear all data. This is because device settings are stored in Windows AppData, which survives app uninstallation.

## Data Storage Locations

The app stores data in two separate locations:

### 1. Global Settings & Calendar Data (Synced)

- **Location**: User-selected folder (usually OneDrive or Documents)
- **Contains**:
  - `calendar-data.json` - All your calendar events and notes
  - `settings.json` - Theme, accent color, global preferences
- **Persists**: YES - Only deleted if you manually delete the folder

### 2. Device Settings (Local - Not Synced)

- **Location**: `%AppData%\Roaming\thoughts-plus\device-settings.json`
- **Full Path**: `C:\Users\<YourUsername>\AppData\Roaming\thoughts-plus\`
- **Contains**:
  - `setupComplete` flag - Whether onboarding wizard was completed
  - API keys (Gemini)
  - GitHub credentials
  - Creator codes (Fortnite)
  - Window position/size preferences
- **Persists**: YES - Survives app uninstall (standard Windows behavior)

## How to Test as a Fresh User

To properly test the app as a completely new user, you need to clear **both** locations:

### Method 1: Delete AppData Folder (Recommended)

1. Close Thoughts+ app completely
2. Press `Win + R` to open Run dialog
3. Type `%AppData%` and press Enter
4. Navigate to `Roaming\thoughts-plus`
5. Delete the entire `thoughts-plus` folder
6. Uninstall the app (if reinstalling)
7. Reinstall and launch - onboarding should appear

### Method 2: Use PowerShell Command

```powershell
# Close app first, then run:
Remove-Item -Recurse -Force "$env:APPDATA\thoughts-plus"
```

### Method 3: Test on Different Windows User Profile

1. Create a new Windows user account
2. Log into that account
3. Install and test the app there
4. Note: OneDrive won't exist on fresh profiles unless configured

## What Each Test Scenario Validates

### Fresh Install Test (After clearing AppData)

- Onboarding wizard appears correctly
- Logo displays on welcome screen
- Data location selection works
- Layout selection page scrolls properly
- Settings show correct data path from wizard
- Stats feature is disabled by default

### Upgrade Test (Keep AppData)

- Existing settings preserved
- No onboarding shown
- Data migrates correctly
- All preferences maintained

## Known Testing Issues

### Issue 1: Data Location Mismatch (FIXED in v5.6.0)

**Problem**: Set location to Desktop in onboarding, but Settings shows OneDrive
**Root Cause**: Settings page loaded `currentDataPath` before wizard completed
**Solution**: Added `data-path-changed` event listener to reload path after wizard

### Issue 2: Skips Onboarding After Reinstall

**Problem**: Uninstall/reinstall bypasses onboarding wizard
**Root Cause**: `deviceSettings.setupComplete` flag persists in AppData
**Solution**: User must manually clear AppData folder for fresh test (see above)

## Testing Checklist

Before submitting to Microsoft Store, verify:

- [ ] Fresh install shows onboarding wizard
- [ ] Logo displays correctly on welcome screen
- [ ] Data location in wizard matches Settings page
- [ ] Layout selection page scrolls (not cut off)
- [ ] Stats feature disabled by default
- [ ] No blank white screen on launch
- [ ] System fonts render correctly
- [ ] Error boundary catches crashes
- [ ] AppData persists across reinstalls (expected behavior)
- [ ] Can manually reset by clearing AppData folder

## Developer Notes

### Why AppData Persists

This is **standard Windows application behavior**. Examples:

- VS Code settings survive reinstall
- Chrome bookmarks survive reinstall
- Discord tokens survive reinstall

Windows uninstallers only remove:

- Program Files installation directory
- Start Menu shortcuts
- Registry entries

They do NOT remove:

- `%AppData%\Roaming\<appname>`
- `%LocalAppData%\<appname>`
- User Documents/OneDrive data

### Architecture Decision

We use this two-location strategy intentionally:

1. **Device Settings** (AppData) - Device-specific, not synced
2. **Global Settings** (OneDrive/Documents) - Synced across devices

This allows users to:

- Install on multiple computers
- Share calendar data via OneDrive
- Keep API keys device-specific (security)
- Maintain per-device preferences (window size, etc.)
