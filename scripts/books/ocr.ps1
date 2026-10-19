param([string]$InDir, [string]$OutDir)
# OCR do Windows (pt-BR): grava, para cada pagina (p001.png...), as linhas com a posicao (x, y, largura) em JSON.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/books/ocr.ps1 <pasta das imagens> <pasta de saida>
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait() | Out-Null
  $task.Result
}
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$lang = [Windows.Globalization.Language]::new('pt-BR')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
New-Item -ItemType Directory -Force $OutDir | Out-Null
Get-ChildItem $InDir -Filter 'p*.png' | Sort-Object Name | ForEach-Object {
  $out = Join-Path $OutDir ($_.BaseName + '.json')
  if (Test-Path $out) { return }
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($_.FullName)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $lines = foreach ($line in $result.Lines) {
    $words = $line.Words
    $x = ($words | ForEach-Object { $_.BoundingRect.X } | Measure-Object -Minimum).Minimum
    $y = ($words | ForEach-Object { $_.BoundingRect.Y } | Measure-Object -Minimum).Minimum
    $r = ($words | ForEach-Object { $_.BoundingRect.X + $_.BoundingRect.Width } | Measure-Object -Maximum).Maximum
    $h = ($words | ForEach-Object { $_.BoundingRect.Height } | Measure-Object -Maximum).Maximum
    [pscustomobject]@{ x = [int]$x; y = [int]$y; r = [int]$r; h = [int]$h; t = $line.Text }
  }
  $json = ConvertTo-Json -InputObject @{ w = $bitmap.PixelWidth; lines = @($lines) } -Depth 4 -Compress
  [System.IO.File]::WriteAllText($out, $json, [System.Text.UTF8Encoding]::new($false))
  $stream.Dispose()
}
Write-Output 'fim'
