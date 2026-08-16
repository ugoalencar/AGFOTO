' Roda o executor unico (launcher.js) sem nenhuma janela de terminal. E o alvo
' do atalho "AG Foto" da area de trabalho.
'
' Resolve a propria pasta, entao continua funcionando se o AGFOTO for copiado
' para outro lugar ou outro computador.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pastaScript = fso.GetParentFolderName(WScript.ScriptFullName)

' A saida vai para logs\launcher-boot.log. Isso pega inclusive o caso do proprio
' node nao estar instalado, que nunca chegaria a escrever no launcher.log.
comando = "cmd /c cd /d """ & pastaScript & """ && (if not exist logs mkdir logs) && node launcher.js >> logs\launcher-boot.log 2>&1"
WshShell.Run comando, 0, False
