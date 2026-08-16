' Cria os atalhos do AG Fotografia na Area de Trabalho, apontando para ESTA
' pasta - onde quer que ela tenha sido copiada. Basta dar um duplo-clique aqui.
'
' Sao dois: um para ligar tudo e um para parar. Antes de criar, confere se o
' node esta instalado: sem ele o atalho existiria e simplesmente nao faria nada,
' que e o pior jeito de descobrir o problema.

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

pasta = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = sh.SpecialFolders("Desktop")

' --- confere o node -----------------------------------------------------------
Set exec = sh.Exec("cmd /c node --version")
Do While exec.Status = 0
  WScript.Sleep 100
Loop

If exec.ExitCode <> 0 Then
  MsgBox "O Node.js nao foi encontrado nesta maquina." & vbCrLf & vbCrLf & _
         "Instale o Node.js (nodejs.org) e rode este arquivo de novo." & vbCrLf & _
         "Sem ele o atalho seria criado mas nao abriria nada.", _
         16, "AG Fotografia"
  WScript.Quit 1
End If

versaoNode = Trim(exec.StdOut.ReadAll())

' --- atalho para ligar ---------------------------------------------------------
Set lnk = sh.CreateShortcut(desktop & "\AG Foto.lnk")
lnk.TargetPath = "wscript.exe"
lnk.Arguments = """" & pasta & "\iniciar-tudo.vbs"""
lnk.WorkingDirectory = pasta
lnk.IconLocation = "C:\Windows\System32\imageres.dll,105"
lnk.Description = "Liga o AG Fotografia (servidor, camera e interface)"
lnk.Save

' --- atalho para parar ---------------------------------------------------------
Set lnkOff = sh.CreateShortcut(desktop & "\AG Foto - Parar.lnk")
lnkOff.TargetPath = pasta & "\parar.bat"
lnkOff.WorkingDirectory = pasta
lnkOff.IconLocation = "C:\Windows\System32\imageres.dll,100"
lnkOff.Description = "Encerra o servidor e a camera do AG Fotografia"
lnkOff.Save

MsgBox "Pronto. Dois atalhos foram criados na Area de Trabalho:" & vbCrLf & vbCrLf & _
       "  AG Foto           - liga servidor, camera e abre a tela" & vbCrLf & _
       "  AG Foto - Parar   - encerra tudo" & vbCrLf & vbCrLf & _
       "Node.js encontrado: " & versaoNode, _
       64, "AG Fotografia"
