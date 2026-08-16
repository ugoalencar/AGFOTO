# =============================================================================
#  AG Fotografia - monta o pacote de um terminal
#
#  O pacote JA VEM ligado ao GitHub: por dentro ele e um clone raso, com o .git
#  e o upstream configurados. O terminal recebe atualizacao pelo botao desde o
#  primeiro dia, sem depender de o instalar.bat conseguir falar com a internet
#  na hora da instalacao.
#
#  Clone raso (--depth 1) e nao copia do .git daqui: 5 MB contra 81 MB, e sem
#  levar o historico inteiro do projeto para a maquina do fotografo.
#
#  Uso:  powershell -ExecutionPolicy Bypass -File empacotar-terminal.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

$remoto = 'https://github.com/ugoalencar/AGFOTO.git'
$branch = 'master'

$versao = (Get-Content "$raiz\package.json" -Raw | ConvertFrom-Json).version
$saida  = Join-Path $raiz "dist"
$nome   = "AGFOTO-terminal-v$versao"
$pasta  = Join-Path $saida $nome
$zip    = Join-Path $saida "$nome.zip"

Write-Host ""
Write-Host "  Montando o pacote do terminal - v$versao"
Write-Host "  ========================================"
Write-Host ""

if (Test-Path $pasta) { Remove-Item $pasta -Recurse -Force }
if (Test-Path $zip)   { Remove-Item $zip -Force }
New-Item -ItemType Directory -Force -Path $saida | Out-Null

# --- o codigo, ja como copia do repositorio ----------------------------------
# Sai do GitHub, nao do disco: o pacote leva exatamente o que esta publicado.
# Commit local que ainda nao foi enviado NAO entra - de proposito, o terminal
# nunca deve rodar codigo que mais ninguem tem.
Write-Host "  clonando $branch do GitHub (raso)..."
& git clone --quiet --depth 1 --branch $branch $remoto $pasta
if ($LASTEXITCODE -ne 0) { throw "git clone falhou" }

Push-Location $pasta
$commitPacote = (& git rev-parse --short HEAD).Trim()
$upstream = (& git rev-parse --abbrev-ref --symbolic-full-name '@{u}').Trim()
Pop-Location
Write-Host "  [ok] $commitPacote, seguindo $upstream"

# O commit daqui precisa ser o mesmo do GitHub, senao o pacote sai com codigo
# diferente do que foi testado nesta maquina.
$commitLocal = (& git rev-parse --short HEAD).Trim()
if ($commitLocal -ne $commitPacote) {
  Write-Host ""
  Write-Host "  [X] Esta pasta esta em $commitLocal e o GitHub em $commitPacote." -ForegroundColor Red
  Write-Host "      Faca o push antes de empacotar - o pacote sai do que esta publicado." -ForegroundColor Red
  Remove-Item $pasta -Recurse -Force
  exit 1
}

# --- a camera ----------------------------------------------------------------
# 151 MB de binarios de terceiros, fora do git. Sem ela o sistema abre e tudo
# funciona menos capturar da camera - que e o motivo do terminal existir.
# Esta no .gitignore, entao copiar para dentro do clone nao suja o git.
if (Test-Path "$raiz\simplusCameraLib\simplusCamera.exe") {
  Write-Host "  simplusCameraLib (151 MB)..."
  Copy-Item "$raiz\simplusCameraLib" -Destination $pasta -Recurse -Force
} else {
  Write-Host "  [!] simplusCameraLib nao encontrada - o pacote vai SEM a camera"
}

# --- pastas de trabalho vazias ------------------------------------------------
foreach ($d in @('Finalizadas','Entrega','Carros','images\temp','dados\jsons','dados\xlsx','dados\auditoria','logs')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $pasta $d) | Out-Null
  Set-Content -Path (Join-Path $pasta "$d\LEIA-ME.txt") -Encoding utf8 `
    -Value "Pasta de trabalho do AG Fotografia. Nao apague."
}

# --- conferencia --------------------------------------------------------------
# Um pacote que vaza credencial ou foto do cliente e pior do que um pacote que
# nao monta. Conferido item a item, nao no olho.
Write-Host ""
Write-Host "  Conferindo..."

$proibidos = @{
  'adset-config.json'    = 'credenciais do ADSET'
  'caminhos-locais.json' = 'caminhos desta matriz'
  'node_modules'         = 'dependencias (o instalar.bat baixa)'
  'adset.md'             = 'credenciais em texto'
  'ftp-config.json'      = 'credenciais de FTP'
  'Nome da empresa AG Fotografia.docx' = 'documento interno com prints da conta do cliente'
}
$falhou = $false
foreach ($item in $proibidos.GetEnumerator()) {
  if (Test-Path (Join-Path $pasta $item.Key)) {
    Write-Host "  [X] VAZOU: $($item.Key) - $($item.Value)" -ForegroundColor Red
    $falhou = $true
  }
}

# Foto de cliente nas pastas de trabalho.
$fotos = Get-ChildItem $pasta -Recurse -Include *.jpg,*.jpeg,*.png,*.cr2,*.cr3,*.nef,*.arw,*.dng `
         -ErrorAction SilentlyContinue |
         Where-Object { $_.FullName -notlike '*simplusCameraLib*' -and $_.FullName -notlike '*graph*' }
if ($fotos) {
  Write-Host "  [X] VAZOU: $($fotos.Count) foto(s) de trabalho" -ForegroundColor Red
  $fotos | Select-Object -First 5 | ForEach-Object { Write-Host "      $($_.FullName.Replace($pasta,''))" }
  $falhou = $true
}

# A pasta precisa sair LIMPA para o git: qualquer coisa que o git enxergue como
# alteracao faz o "pull --ff-only" do botao Atualizar abortar, e o terminal
# nunca mais recebe atualizacao.
Push-Location $pasta
$sujo = & git status --porcelain
Pop-Location
if ($sujo) {
  Write-Host "  [X] O clone ficou sujo - o botao Atualizar abortaria:" -ForegroundColor Red
  $sujo | Select-Object -First 8 | ForEach-Object { Write-Host "      $_" }
  $falhou = $true
}

# Essenciais presentes.
$precisa = @('server.js','launcher.js','instalar.bat','iniciar-tudo.vbs','criar-atalho.vbs',
             'parar.bat','package.json','frontend\public\App.vue','LEIA-ME-INICIAR.md',
             'frontend\public\css\main.css','frontend\public\graph\ag-simbolo.svg',
             'eng.traineddata','.git')
foreach ($f in $precisa) {
  if (-not (Test-Path (Join-Path $pasta $f))) {
    Write-Host "  [X] FALTA: $f" -ForegroundColor Red
    $falhou = $true
  }
}

if ($falhou) {
  Write-Host ""
  Write-Host "  Pacote NAO gerado - resolva os itens acima." -ForegroundColor Red
  exit 1
}
Write-Host "  [ok] nada de indevido, git limpo, tudo que precisa esta la"

# --- zip -----------------------------------------------------------------------
# -Force no Get-ChildItem: sem ele o .git some do pacote, por ser pasta oculta -
# e ai o terminal chegaria sem a ligacao com o GitHub, que e o motivo de existir
# este formato.
Write-Host ""
Write-Host "  Compactando..."
$itens = Get-ChildItem -Path $pasta -Force
Compress-Archive -Path $itens.FullName -DestinationPath $zip -CompressionLevel Optimal
Remove-Item $pasta -Recurse -Force

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "  ============================================"
Write-Host "  Pronto: dist\$nome.zip  ($mb MB)"
Write-Host "  Versao $versao, commit $commitPacote"
Write-Host ""
Write-Host "  No terminal: descompacte e rode instalar.bat"
Write-Host "  ============================================"
Write-Host ""
