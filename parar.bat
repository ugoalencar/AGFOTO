@echo off
rem Encerra o servidor, a camera e a janela do sistema.
rem
rem A ORDEM importa: o iniciar-server.bat tem um laco que reergue o node em 3s.
rem Matar o node primeiro so faz ele voltar - a janela do laco morre antes.
rem
rem Sem "timeout" aqui: ele aborta quando a entrada esta redirecionada, que e o
rem caso quando este .bat e chamado por outro script.
echo Parando o AG Fotografia...

powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -like '*iniciar-server.bat*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

taskkill /F /IM simplusCamera.exe >nul 2>&1

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo Pronto. Para ligar de novo, use o atalho "AG Foto".
ping -n 3 127.0.0.1 >nul
