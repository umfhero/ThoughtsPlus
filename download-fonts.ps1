# Download Google Fonts for local bundling (APPX compatible)
# Run this script to download all required fonts
# Usage: npm run download:fonts

$fontsDir = "$PSScriptRoot\src\assets\fonts"

# Create fonts directory if it doesn't exist
if (!(Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Path $fontsDir -Force
}

Write-Host "Downloading fonts to: $fontsDir" -ForegroundColor Cyan
Write-Host "Using current Google Fonts URLs (January 2026)" -ForegroundColor Gray

# Font URLs from Google Fonts (woff2 format) - Latin subset only for smaller bundle size
# These are variable fonts that support multiple weights
$fonts = @{
    # Outfit (Latin) - Modern, clean sans-serif
    "Outfit-Latin.woff2"               = "https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtq.woff2"
    
    # Inter (Latin) - Highly readable UI font
    "Inter-Latin.woff2"                = "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2"
    
    # Poppins (Latin) - Rounded, friendly sans-serif
    "Poppins-Latin.woff2"              = "https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJfecg.woff2"
    
    # Playfair Display (Latin) - Elegant serif font (used for Focus-Centric layout)
    "PlayfairDisplay-Latin.woff2"      = "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2"
    
    # Architects Daughter (Latin) - Handwriting style font
    "ArchitectsDaughter-Regular.woff2" = "https://fonts.gstatic.com/s/architectsdaughter/v18/KtkxAKiDZI_td1Lkx62xHZHDtgO_Y-bvTYlg4-7jA-U.woff2"
}

$successCount = 0
$failCount = 0

foreach ($font in $fonts.GetEnumerator()) {
    $outPath = Join-Path $fontsDir $font.Key
    Write-Host "Downloading $($font.Key)..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $font.Value -OutFile $outPath -UseBasicParsing
        $fileSize = (Get-Item $outPath).Length / 1KB
        Write-Host "  Done: $($font.Key) ($([math]::Round($fileSize, 1)) KB)" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host "  Failed: $($font.Key) - $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Download complete!" -ForegroundColor Green
Write-Host "  Success: $successCount fonts" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "  Failed: $failCount fonts" -ForegroundColor Red
}
Write-Host "  Location: $fontsDir" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Rebuild the app: npm run build" -ForegroundColor White
Write-Host "  2. Test fonts in Settings > Appearance" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
