' Executa um .bat desta mesma pasta sem janela nenhuma. Cada .bat cuida do seu
' proprio log em logs\, entao a janela de terminal nao faz falta.
'
' Uso: wscript iniciar-oculto.vbs nome-do-arquivo.bat

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pastaScript = fso.GetParentFolderName(WScript.ScriptFullName)

nomeArquivo = WScript.Arguments(0)

WshShell.Run "cmd /c """ & pastaScript & "\" & nomeArquivo & """", 0, False
