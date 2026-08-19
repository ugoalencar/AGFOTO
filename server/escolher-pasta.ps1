# Abre o dialogo nativo do Windows para escolher uma pasta.
#
# Existe porque o navegador nao entrega o caminho real de uma pasta escolhida
# (por seguranca) - so da pra pedir pro Windows perguntar e devolver o
# caminho, que e o que este script faz. Precisa rodar em thread STA: sem isso
# o FolderBrowserDialog do WinForms nao abre.
#
# Imprime o caminho escolhido no stdout, ou nada se o usuario cancelar.
param(
  [string]$PastaInicial = ''
)

Add-Type -AssemblyName System.Windows.Forms

$dialogo = New-Object System.Windows.Forms.FolderBrowserDialog
$dialogo.Description = 'Escolha a pasta das fotos (cartao de memoria ou outra)'
$dialogo.ShowNewFolderButton = $false
if ($PastaInicial -and (Test-Path -LiteralPath $PastaInicial)) {
  $dialogo.SelectedPath = $PastaInicial
}

if ($dialogo.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialogo.SelectedPath
}
