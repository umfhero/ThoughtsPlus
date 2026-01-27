; Calendar Plus V5.0 Installer Script
!include "MUI2.nsh"

; General Settings
Name "Thoughts+"
OutFile "release\ThoughtsPlus Setup 5.5.0.exe"
InstallDir "$LOCALAPPDATA\ThoughtsPlus"
InstallDirRegKey HKCU "Software\ThoughtsPlus" "Install_Dir"
RequestExecutionLevel user

; Modern UI Configuration
!define MUI_ABORTWARNING
!define MUI_ICON "src\assets\ThoughtsPlus.png"
!define MUI_UNICON "src\assets\ThoughtsPlus.png"

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
  File /r "release\thoughts-plus-win32-x64\*.*"
  
  ; Create desktop shortcut
  CreateShortcut "$DESKTOP\Thoughts+.lnk" "$INSTDIR\ThoughtsPlus.exe"
  
  ; Create start menu shortcuts
  CreateDirectory "$SMPROGRAMS\ThoughtsPlus"
  CreateShortcut "$SMPROGRAMS\ThoughtsPlus\Thoughts+.lnk" "$INSTDIR\ThoughtsPlus.exe"
  CreateShortcut "$SMPROGRAMS\ThoughtsPlus\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Write registry keys
  WriteRegStr HKCU "Software\ThoughtsPlus" "Install_Dir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ThoughtsPlus" "DisplayName" "Thoughts+"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ThoughtsPlus" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ThoughtsPlus" "DisplayVersion" "5.5.0"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ThoughtsPlus" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ThoughtsPlus" "NoRepair" 1
  
  ; Add startup registry entry
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ThoughtsPlus" '"$INSTDIR\ThoughtsPlus.exe"'
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"
  
  ; Remove shortcuts
  Delete "$DESKTOP\Thoughts+.lnk"
  RMDir /r "$SMPROGRAMS\ThoughtsPlus"
  
  ; Remove registry keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ThoughtsPlus"
  DeleteRegKey HKCU "Software\ThoughtsPlus"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ThoughtsPlus"
SectionEnd
