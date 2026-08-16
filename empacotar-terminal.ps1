# =============================================================================
#  AG Fotografia - monta o pacote de um terminal
#
#  Gera um .zip com o que a maquina do fotografo precisa e SO isso. Fica de
#  fora tudo que e desta matriz: fotos, dados de execucao, credenciais,
#  historico do git e as dependencias (que o instalar.bat baixa na hora certa,
#  para a versao do Node daquela maquina).
#
#  Uso:  powershell -ExecutionPolicy Bypass -File empacotar-terminal.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

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
New-Item -ItemType Directory -Force -Path $pasta | Out-Null

# --- o que vai ---------------------------------------------------------------
# O codigo sai do git (git archive), nao do disco: assim o pacote leva
# exatamente a versao commitada, sem arquivo solto ou meia-edicao desta matriz.
# Formato zip, nao tar: dependendo do PATH, "tar" pode ser o do Git Bash, que
# le "C:\..." como nome de servidor remoto e falha com "Cannot connect to C".
# Expand-Archive nao tem esse problema.
Write-Host "  codigo (da versao commitada)..."
$tmpZip = Join-Path $env:TEMP "agfoto-pacote.zip"
if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force }
& git archive --format=zip -o $tmpZip HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive falhou" }
Expand-Archive -Path $tmpZip -DestinationPath $pasta -Force
Remove-Item $tmpZip -Force

# --- o que NAO vai, mesmo estando no git -------------------------------------
# Coisas de desenvolvimento nao servem no terminal e so confundem quem abrir a
# pasta procurando o que clicar.
$fora = @(
  # desenvolvimento
  'tests', 'docs', '.superpowers', '.github', 'empacotar-terminal.ps1',
  'Dockerfile', 'docker-compose.yml', 'DEPLOY-SCRIPT.ps1',

  # documento interno: leva os prints da conta da concessionaria e o nome do
  # cliente. Nao tem por que viajar para a maquina de um terminal.
  'Nome da empresa AG Fotografia.docx',

  # historico de versoes e notas de projeto: so confundem quem abre a pasta
  # procurando o que clicar. O terminal le o LEIA-ME-INICIAR.md.
  'CHECKLIST-IMPLANTACAO.md', 'LANCAMENTO-v1.0.0.md', 'MONITORING.md',
  'OPERACIONAL.md', 'PROMPT_MESTRE_AG_FOTOGRAFIA.md',
  'RELEASE-NOTES-v1.0.0.md', 'STATUS-DESENVOLVIMENTO.md',
  'TESTE-RESULTADO-v1.0.0.md'
)
foreach ($f in $fora) {
  $alvo = Join-Path $pasta $f
  if (Test-Path $alvo) { Remove-Item $alvo -Recurse -Force }
}

# --- a camera ----------------------------------------------------------------
# 151 MB de binarios de terceiros, fora do git. Sem ela o sistema abre e tudo
# funciona menos capturar da camera - que e o motivo do terminal existir.
if (Test-Path "$raiz\simplusCameraLib\simplusCamera.exe") {
  Write-Host "  simplusCameraLib (151 MB)..."
  Copy-Item "$raiz\simplusCameraLib" -Destination $pasta -Recurse -Force
} else {
  Write-Host "  [!] simplusCameraLib nao encontrada - o pacote vai SEM a camera"
}

# --- pastas de trabalho vazias ------------------------------------------------
# Criadas ja no pacote para quem abrir entender onde as coisas moram.
foreach ($d in @('Finalizadas','Entrega','Carros','images\temp','dados\jsons','dados\xlsx','dados\auditoria','logs')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $pasta $d) | Out-Null
  Set-Content -Path (Join-Path $pasta "$d\LEIA-ME.txt") -Encoding utf8 `
    -Value "Pasta de trabalho do AG Fotografia. Nao apague."
}

# --- conferencia --------------------------------------------------------------
# Um pacote que vaza credencial ou foto do cliente e pior do que um pacote que
# nao monta. Conferido item a item, nao no olho.
Write-Host ""
Write-Host "  Conferindo o que NAO pode ir junto..."
$proibidos = @{
  'adset-config.json'  = 'credenciais do ADSET'
  'caminhos-locais.json' = 'caminhos desta matriz'
  'node_modules'       = 'dependencias (o instalar.bat baixa)'
  '.git'               = 'historico do repositorio'
  'adset.md'           = 'credenciais em texto'
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

if ($falhou) {
  Write-Host ""
  Write-Host "  Pacote NAO gerado - resolva os itens acima." -ForegroundColor Red
  exit 1
}
Write-Host "  [ok] nada de indevido no pacote"

# --- essenciais presentes ------------------------------------------------------
$precisa = @('server.js','launcher.js','instalar.bat','iniciar-tudo.vbs','criar-atalho.vbs',
             'parar.bat','package.json','frontend\public\App.vue','LEIA-ME-INICIAR.md',
             'frontend\public\css\main.css','frontend\public\graph\ag-simbolo.svg',
             'eng.traineddata')
foreach ($f in $precisa) {
  if (-not (Test-Path (Join-Path $pasta $f))) {
    Write-Host "  [X] FALTA: $f" -ForegroundColor Red
    exit 1
  }
}
Write-Host "  [ok] tudo que precisa esta la"

# --- zip -----------------------------------------------------------------------
Write-Host ""
Write-Host "  Compactando..."
Compress-Archive -Path "$pasta\*" -DestinationPath $zip -CompressionLevel Optimal
Remove-Item $pasta -Recurse -Force

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "  ============================================"
Write-Host "  Pronto: dist\$nome.zip  ($mb MB)"
Write-Host ""
Write-Host "  No terminal: descompacte e rode instalar.bat"
Write-Host "  ============================================"
Write-Host ""
