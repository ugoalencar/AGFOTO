@echo off
rem Servidor com reinicio automatico: se o node cair no meio de uma sessao, ele
rem volta sozinho em 3s em vez de deixar o fotografo na mao.
cd /d "%~dp0"
if not exist logs mkdir logs
:loop
node server.js >> logs\server.log 2>&1
echo [%date% %time%] server.js encerrou - reiniciando em 3s >> logs\server.log
timeout /t 3 /nobreak >nul
goto loop
