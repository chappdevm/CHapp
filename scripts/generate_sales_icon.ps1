Add-Type -AssemblyName System.Drawing

$width = 512
$height = 512
$bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Helper function to create rounded top rectangle path
function Get-RoundedTopBar([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
    $path.AddArc($x + $w - $r * 2, $y, $r * 2, $r * 2, 270, 90)
    $path.AddLine($x + $w, $y + $r, $x + $w, $y + $h)
    $path.AddLine($x + $w, $y + $h, $x, $y + $h)
    $path.CloseFigure()
    return $path
}

# Drawing 3 high-contrast, luminous chart bars with crisp bevels, outlines and glows
# Bar 1 (Left): Shortest, vibrant electric magenta / violet
# Bar 2 (Middle): Medium, radiant coral / crimson
# Bar 3 (Right): Tallest, glowing amber / gold

# Soft ambient glow behind all bars for supreme dark-mode pop
$glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45, 255, 255, 255))
$g.FillEllipse($glowBrush, 40, 60, 432, 400)
$glowBrush.Dispose()

# Bar 1: X: 45, Y: 240, W: 110, H: 220, R: 30
$path1 = Get-RoundedTopBar 45 240 110 220 30
$brush1 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(45, 240)),
    (New-Object System.Drawing.PointF(155, 460)),
    [System.Drawing.Color]::FromArgb(255, 217, 70, 239), # Luminous Violet / Magenta #D946EF
    [System.Drawing.Color]::FromArgb(255, 147, 51, 234)  # Deep Violet #9333EA
)
$g.FillPath($brush1, $path1)
# Bar 1 crisp inner highlight
$pen1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 245, 208, 254), 4) # #F5D0FE
$g.DrawPath($pen1, $path1)

# Bar 2: X: 175, Y: 140, W: 140, H: 320, R: 35
$path2 = Get-RoundedTopBar 175 140 140 320 35
$brush2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(175, 140)),
    (New-Object System.Drawing.PointF(315, 460)),
    [System.Drawing.Color]::FromArgb(255, 251, 113, 133), # Radiant Coral / Pink #FB7185
    [System.Drawing.Color]::FromArgb(255, 225, 29, 72)   # Rose Red #E11D48
)
$g.FillPath($brush2, $path2)
# Bar 2 highlight
$pen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 228, 230), 5) # #FFE4E6
$g.DrawPath($pen2, $path2)

# Bar 3: X: 335, Y: 50, W: 135, H: 410, R: 35
$path3 = Get-RoundedTopBar 335 50 135 410 35
$brush3 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(335, 50)),
    (New-Object System.Drawing.PointF(470, 460)),
    [System.Drawing.Color]::FromArgb(255, 254, 215, 170), # Glowing Amber Top #FED7AA
    [System.Drawing.Color]::FromArgb(255, 245, 158, 11)   # Vivid Amber #F59E0B
)
$g.FillPath($brush3, $path3)
# Bar 3 highlight
$pen3 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 254, 243, 199), 5) # #FEF3C7
$g.DrawPath($pen3, $path3)

# Add 3D front facet accents to Bar 2 and Bar 3 for rich Odoo depth
$accent2 = New-Object System.Drawing.Drawing2D.GraphicsPath
$accent2.AddArc(245, 140, 70, 70, 270, 90)
$accent2.AddLine(315, 175, 315, 460)
$accent2.AddLine(315, 460, 245, 460)
$accent2.AddLine(245, 460, 245, 140)
$accent2.CloseFigure()
$accentBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
$g.FillPath($accentBrush2, $accent2)

$accent3 = New-Object System.Drawing.Drawing2D.GraphicsPath
$accent3.AddArc(400, 50, 70, 70, 270, 90)
$accent3.AddLine(470, 85, 470, 460)
$accent3.AddLine(470, 460, 400, 460)
$accent3.AddLine(400, 460, 400, 50)
$accent3.CloseFigure()
$accentBrush3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 180, 83, 9))
$g.FillPath($accentBrush3, $accent3)

# Outer luminous contour around all bars for crisp visibility on pitch black or dark navy #031626
$outerGlowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), 2.5)
$g.DrawPath($outerGlowPen, $path1)
$g.DrawPath($outerGlowPen, $path2)
$g.DrawPath($outerGlowPen, $path3)

# Save
$outPath = [System.IO.Path]::GetFullPath('assets/icons/sales.png')
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Host "Generated high-contrast sales icon at: $outPath"
