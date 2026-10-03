# Inlines src/style.css and src/*.js into a single standalone index.html
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root 'src'
$html = [IO.File]::ReadAllText((Join-Path $src 'index.src.html'), [Text.Encoding]::UTF8)
$css = [IO.File]::ReadAllText((Join-Path $src 'style.css'), [Text.Encoding]::UTF8)
$order = 'core','fb','types','types2','sis','sim','view','ui','examples','main'
$js = ($order | ForEach-Object { [IO.File]::ReadAllText((Join-Path $src "$_.js"), [Text.Encoding]::UTF8) }) -join "`n;`n"
$js = $js -replace '</script','<\/script'
$html = $html.Replace('/*CSS*/', $css).Replace('/*JS*/', $js)
[IO.File]::WriteAllText((Join-Path $root 'index.html'), $html, (New-Object Text.UTF8Encoding($false)))
Write-Host "Built index.html ($([math]::Round($html.Length/1024)) KB)"


