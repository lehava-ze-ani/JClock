param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Add-Type -AssemblyName System.Drawing

$targets = @('cheetah-round', 'cheetah-square', 'cheetah-pro')
$size = 32
$radius = 14
$edge = [System.Drawing.ColorTranslator]::FromHtml('#AEB9C6')
$dark = [System.Drawing.ColorTranslator]::FromHtml('#10151B')
$light = [System.Drawing.ColorTranslator]::FromHtml('#DAE0E8')

foreach ($target in $targets) {
    $directory = Join-Path $ProjectRoot "assets\$target\moon"
    New-Item -ItemType Directory -Force -Path $directory | Out-Null

    foreach ($monthLength in @(29, 30)) {
        for ($day = 1; $day -le $monthLength; $day++) {
            $phase = ($day - 1) / [double]($monthLength - 1)
            $illumination = 0.5 - 0.5 * [Math]::Cos($phase * [Math]::PI * 2)
            $litWidth = [Math]::Round(($radius * 2) * $illumination)

            $bitmap = New-Object System.Drawing.Bitmap($size, $size)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $graphics.Clear([System.Drawing.Color]::Transparent)

            $circle = [System.Drawing.RectangleF]::new(
                [single]2,
                [single]2,
                [single]($radius * 2),
                [single]($radius * 2)
            )
            $darkBrush = New-Object System.Drawing.SolidBrush($dark)
            $lightBrush = New-Object System.Drawing.SolidBrush($light)
            $edgePen = New-Object System.Drawing.Pen($edge, 1)
            $graphics.FillEllipse($darkBrush, $circle)

            $path = New-Object System.Drawing.Drawing2D.GraphicsPath
            $path.AddEllipse($circle)
            $graphics.SetClip($path)
            if ($phase -le 0.5) {
                $graphics.FillRectangle($lightBrush, 2 + ($radius * 2) - $litWidth, 2, $litWidth, $radius * 2)
            } else {
                $graphics.FillRectangle($lightBrush, 2, 2, $litWidth, $radius * 2)
            }
            $graphics.ResetClip()
            $graphics.DrawEllipse($edgePen, $circle)

            $name = 'moon_{0}_{1:D2}.png' -f $monthLength, $day
            $bitmap.Save((Join-Path $directory $name), [System.Drawing.Imaging.ImageFormat]::Png)

            $path.Dispose()
            $edgePen.Dispose()
            $lightBrush.Dispose()
            $darkBrush.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
}
