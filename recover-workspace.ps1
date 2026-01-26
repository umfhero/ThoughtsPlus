# Workspace Recovery Script
# This script scans the workspace folder and rebuilds the workspace metadata

$workspaceDir = "C:\Users\umfhe\Desktop\ThoughtsPlusDevFolder\workspace"
$dataFile = "C:\Users\umfhe\Desktop\ThoughtsPlusDevFolder\calendar-data.json"

Write-Host "=== Workspace Recovery Script ===" -ForegroundColor Cyan
Write-Host "Scanning workspace directory: $workspaceDir" -ForegroundColor Yellow

# Load existing data
$data = Get-Content $dataFile | ConvertFrom-Json

# Scan for workspace files
$files = Get-ChildItem $workspaceDir -Recurse -File -Include "*.exec", "*.brd", "*.nt", "*.nbm", "*.deck"

Write-Host "Found $($files.Count) workspace files" -ForegroundColor Green

# Build file list
$workspaceFiles = @()
$folders = @()

# Check for Quick Notes folder
$quickNotesPath = Join-Path $workspaceDir "Quick Notes"
if (Test-Path $quickNotesPath) {
    $quickNotesFolderId = [guid]::NewGuid().ToString()
    $folders += @{
        id                 = $quickNotesFolderId
        name               = "Quick Notes"
        parentId           = $null
        createdAt          = (Get-Date).ToUniversalTime().ToString("o")
        updatedAt          = (Get-Date).ToUniversalTime().ToString("o")
        isQuickNotesFolder = $true
    }
    Write-Host "Found Quick Notes folder" -ForegroundColor Green
}

foreach ($file in $files) {
    $ext = $file.Extension.ToLower()
    $type = switch ($ext) {
        ".exec" { "exec" }
        ".brd" { "board" }
        ".nt" { "note" }
        ".nbm" { "nbm" }
        ".deck" { "flashcards" }
        default { $null }
    }
    
    if ($type) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        $parentId = $null
        
        # Check if file is in Quick Notes folder
        if ($file.DirectoryName -eq $quickNotesPath) {
            $parentId = $quickNotesFolderId
        }
        
        $workspaceFiles += @{
            id        = [guid]::NewGuid().ToString()
            name      = $name
            type      = $type
            parentId  = $parentId
            createdAt = $file.CreationTime.ToUniversalTime().ToString("o")
            updatedAt = $file.LastWriteTime.ToUniversalTime().ToString("o")
            contentId = [guid]::NewGuid().ToString()
            filePath  = $file.FullName
        }
        
        Write-Host "  - $name ($type)" -ForegroundColor Gray
    }
}

# Update workspace data
$data.workspace.files = $workspaceFiles
$data.workspace.folders = $folders
$data.workspace.migrationComplete = $true
$data.workspace.fileBasedMigrationComplete = $true

# Backup original file
$backupFile = "$dataFile.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $dataFile $backupFile
Write-Host "`nBackup created: $backupFile" -ForegroundColor Yellow

# Save updated data
$data | ConvertTo-Json -Depth 10 | Set-Content $dataFile

Write-Host "`nWorkspace metadata rebuilt successfully!" -ForegroundColor Green
Write-Host "Recovered $($workspaceFiles.Count) files" -ForegroundColor Green
Write-Host "`nPlease restart the application to see your files." -ForegroundColor Cyan
