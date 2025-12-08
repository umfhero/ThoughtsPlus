; Calendar Plus V5.0 Installer Script
!include "MUI2.nsh"

; General Settings
Name "Calendar Plus"
OutFile "release\Calendar Plus Setup 5.0.0.exe"
InstallDir "$LOCALAPPDATA\Calendar Plus"
InstallDirRegKey HKCU "Software\CalendarPlus" "Install_Dir"
RequestExecutionLevel user

; Modern UI Configuration
!define MUI_ABORTWARNING
!define MUI_ICON "src\assets\calendar_icon_181520.ico"
!define MUI_UNICON "src\assets\calendar_icon_181520.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; Installer Section
Section "Install"
  SetOutPath "$INSTDIR"
  
  ; Copy all files from packaged app (electron-packager creates Calendar Plus-win32-x64)
  File /r "release\Calendar Plus-win32-x64\*.*"
  
  ; Create desktop shortcut
  CreateShortcut "$DESKTOP\Calendar Plus.lnk" "$INSTDIR\Calendar Plus.exe"
  
  ; Create start menu shortcuts
  CreateDirectory "$SMPROGRAMS\Calendar Plus"
  CreateShortcut "$SMPROGRAMS\Calendar Plus\Calendar Plus.lnk" "$INSTDIR\Calendar Plus.exe"
  CreateShortcut "$SMPROGRAMS\Calendar Plus\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Write registry keys
  WriteRegStr HKCU "Software\CalendarPlus" "Install_Dir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CalendarPlus" "DisplayName" "Calendar Plus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CalendarPlus" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CalendarPlus" "DisplayVersion" "5.0.0"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CalendarPlus" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CalendarPlus" "NoRepair" 1
  
  ; Add startup registry entry
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CalendarPlus" '"$INSTDIR\Calendar Plus.exe"'
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"
  
  ; Remove shortcuts
  Delete "$DESKTOP\Calendar Plus.lnk"
  RMDir /r "$SMPROGRAMS\Calendar Plus"
  
  ; Remove registry keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CalendarPlus"
  DeleteRegKey HKCU "Software\CalendarPlus"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CalendarPlus"
SectionEnd
