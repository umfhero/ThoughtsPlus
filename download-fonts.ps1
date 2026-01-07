# Download Google Fonts for local bundling
# Run this script to download all required fonts

$fontsDir = "$PSScriptRoot\src\assets\fonts"

# Create fonts directory if it doesn't exist
if (!(Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Path $fontsDir -Force
}

Write-Host "Downloading fonts to: $fontsDir" -ForegroundColor Cyan

# Font URLs from Google Fonts (woff2 format)
$fonts = @{
    # Outfit
    "Outfit-Light.woff2"               = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2"
    "Outfit-Regular.woff2"             = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC0C4G-EiAou6Y.woff2"
    "Outfit-Medium.woff2"              = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1O4G-EiAou6Y.woff2"
    "Outfit-SemiBold.woff2"            = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC114G-EiAou6Y.woff2"
    "Outfit-Bold.woff2"                = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC10IG-EiAou6Y.woff2"
    
    # Playfair Display
    "PlayfairDisplay-Regular.woff2"    = "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtXK-F2qC0s.woff2"
    "PlayfairDisplay-Medium.woff2"     = "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vXDXbtXK-F2qC0s.woff2"
    "PlayfairDisplay-SemiBold.woff2"   = "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKebunDXbtXK-F2qC0s.woff2"
    "PlayfairDisplay-Bold.woff2"       = "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKe2unDXbtXK-F2qC0s.woff2"
    
    # Inter
    "Inter-Light.woff2"                = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.woff2"
    "Inter-Regular.woff2"              = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.woff2"
    "Inter-Medium.woff2"               = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Bg-4.woff2"
    "Inter-SemiBold.woff2"             = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZhrib2Bg-4.woff2"
    "Inter-Bold.woff2"                 = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.woff2"
    
    # Architects Daughter
    "ArchitectsDaughter-Regular.woff2" = "https://fonts.gstatic.com/s/architectsdaughter/v18/KtkxAKiDZI_td1Lkx62xHZHDtgO_Y-bvTYlg4-7jA-U.woff2"
}

foreach ($font in $fonts.GetEnumerator()) {
    $outPath = Join-Path $fontsDir $font.Key
    Write-Host "Downloading $($font.Key)..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $font.Value -OutFile $outPath -UseBasicParsing
        Write-Host "  Done: $($font.Key)" -ForegroundColor Green
    }
    catch {
        Write-Host "  Failed: $($font.Key) - $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done! Fonts downloaded to: $fontsDir" -ForegroundColor Green
Write-Host "Now rebuild the app with: npm run build" -ForegroundColor Cyan
