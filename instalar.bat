@echo off
setlocal enabledelayedexpansion
rem ===========================================================================
rem  AG Fotografia - instalacao
rem
rem  Roda UMA VEZ em cada maquina. Deixa a pasta pronta para uso e ligada ao
rem  GitHub, para o botao Atualizar da tela de Ajustes funcionar depois.
rem
rem  Seguro rodar numa pasta que ja esta em uso: nao apaga foto, nao apaga
rem  configuracao e nao desfaz trabalho nenhum.
rem ===========================================================================
rem Este .bat faz parte do repositorio e, ao ligar a pasta ao GitHub, pode ser
rem sobrescrito por uma versao nova ENQUANTO ainda esta rodando - o cmd.exe se
rem perde lendo um arquivo que mudou debaixo dele. Por isso roda a partir de uma
rem copia no TEMP.
if not "%~1"=="_copia" (
  copy /y "%~f0" "%TEMP%\agfoto-instalar.bat" >nul
  call "%TEMP%\agfoto-instalar.bat" _copia "%~dp0"
  exit /b %errorlevel%
)
cd /d "%~2"

echo.
echo   AG Fotografia - instalacao
echo   ==========================
echo.

rem --- 1. Node.js ------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo   [X] Node.js nao encontrado.
  echo.
  echo       Instale em https://nodejs.org ^(versao LTS^) e rode este arquivo
  echo       de novo. Sem ele nada do sistema roda.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
echo   [ok] Node.js !NODEVER!

rem --- 2. Git ----------------------------------------------------------------
rem O git nao e obrigatorio para USAR o sistema, so para atualizar por dentro.
set TEMGIT=1
where git >nul 2>&1
if errorlevel 1 (
  set TEMGIT=0
  echo   [!] Git nao encontrado - o sistema roda, mas o botao Atualizar nao.
  echo       Para ligar depois: instale https://git-scm.com/download/win e rode
  echo       este arquivo outra vez.
) else (
  for /f "tokens=*" %%v in ('git --version') do echo   [ok] %%v
)

rem --- 3. Dependencias -------------------------------------------------------
echo.
echo   Instalando as dependencias ^(pode levar alguns minutos^)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo   [X] npm install falhou. Confira a conexao com a internet.
  pause
  exit /b 1
)
echo   [ok] dependencias instaladas

rem --- 4. Navegador do envio ao ADSET ----------------------------------------
rem O Playwright traz o proprio Chromium; sem ele o envio ao ADSET nao abre.
echo.
echo   Baixando o navegador do envio ao ADSET...
call npx --yes playwright install chromium
if errorlevel 1 (
  echo   [!] O navegador nao baixou. O sistema roda, mas o envio ao ADSET nao.
) else (
  echo   [ok] navegador pronto
)

rem --- 4b. Leitura de placa (Fast-ALPR) ----------------------------------------
rem Motor de OCR roda em Python, separado do resto (Node). Sem isso o sistema
rem abre normal, so a leitura de placa na importacao nao funciona.
echo.
set TEMPYTHON=1
where python >nul 2>&1
if errorlevel 1 (
  set TEMPYTHON=0
  echo   [!] Python nao encontrado - a leitura de placa nao vai funcionar.
  echo       Instale em https://python.org ^(marque "Add to PATH" na instalacao^)
  echo       e rode este arquivo de novo.
) else (
  if not exist python-alpr\venv (
    echo   Preparando o ambiente de leitura de placa ^(so na primeira vez^)...
    python -m venv python-alpr\venv
  )
  if exist python-alpr\venv\Scripts\python.exe (
    python-alpr\venv\Scripts\python.exe -m pip install --quiet --upgrade pip >nul
    python-alpr\venv\Scripts\python.exe -m pip install --quiet -r python-alpr\requirements.txt onnxruntime
    if errorlevel 1 (
      echo   [!] Nao deu para instalar as dependencias de leitura de placa.
      echo       O sistema roda, mas a leitura automatica na importacao nao.
    ) else (
      echo   [ok] leitura de placa pronta
    )
  ) else (
    echo   [!] Nao foi possivel criar o ambiente Python. Confira a instalacao.
  )
)

rem --- 5. Pastas de trabalho -------------------------------------------------
for %%d in (Finalizadas Entrega Carros images\temp dados\jsons dados\xlsx dados\auditoria logs) do (
  if not exist "%%d" mkdir "%%d"
)
echo   [ok] pastas de trabalho

rem --- 6. Configuracao do ADSET ----------------------------------------------
rem So o modelo: usuario e senha sao preenchidos na tela de Ajustes, nunca aqui.
if not exist adset-config.json (
  if exist adset-config.exemplo.json (
    copy /y adset-config.exemplo.json adset-config.json >nul
    echo   [ok] adset-config.json criado - preencha em Ajustes
  )
) else (
  echo   [ok] adset-config.json ja existe - mantido
)

rem --- 7. Ligacao com o GitHub -----------------------------------------------
if "!TEMGIT!"=="0" goto :atalhos

echo.
rem O pacote do terminal ja vem como copia do repositorio, com o .git dentro -
rem entao aqui normalmente nao ha nada a fazer. Este bloco cobre a pasta que
rem chegou solta (copiada na mao, zip remontado sem o .git).
if not exist .git (
  echo   Ligando esta pasta ao repositorio de atualizacoes...
  rem So leitura para o terminal: git fetch/pull funciona sem senha nem chave, e
  rem ninguem daqui consegue empurrar nada de volta.
  git init -q
  git remote add origin https://github.com/ugoalencar/AGFOTO.git
  git fetch -q --depth 1 origin master
  if errorlevel 1 (
    echo   [X] Nao deu para falar com o GitHub. Confira a internet e rode de novo.
    pause
    exit /b 1
  )
  rem O reset alinha os arquivos de CODIGO com o repositorio. Foto, configuracao
  rem e dados nao fazem parte dele e ficam intocados - estao no .gitignore.
  git reset -q --hard origin/master
  git branch -q -M master
  git branch -q --set-upstream-to=origin/master master
  echo   [ok] pasta ligada - o botao Atualizar ja funciona
  goto :atalhos
)

rem Trabalho local nao commitado faz o "git pull --ff-only" abortar, e ai o
rem botao Atualizar nunca funciona. Guardar num commit local resolve sem
rem descartar nada: fica tudo recuperavel no historico desta maquina.
for /f "tokens=*" %%s in ('git status --porcelain') do set SUJO=1
if defined SUJO (
  echo   [!] Ha alteracoes locais nesta pasta. Guardando num commit local
  echo       para o Atualizar poder funcionar ^(nada e descartado^).
  git add -A
  git -c user.name="AG Fotografia" -c user.email="local@agfoto" commit -q -m "local: estado desta maquina antes de ligar as atualizacoes"
  echo   [ok] alteracoes locais guardadas
)

rem Sem upstream o sistema nao sabe de onde puxar a atualizacao.
git rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if errorlevel 1 (
  for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
  git fetch origin !BRANCH! >nul 2>&1
  if errorlevel 1 (
    echo   [!] A branch "!BRANCH!" nao existe no GitHub ainda.
    echo       Peca para publicarem ela, ou troque para a branch de uso.
  ) else (
    git branch --set-upstream-to=origin/!BRANCH! !BRANCH! >nul 2>&1
    echo   [ok] atualizacoes ligadas a origin/!BRANCH!
  )
) else (
  for /f "tokens=*" %%u in ('git rev-parse --abbrev-ref --symbolic-full-name @{u}') do echo   [ok] atualizacoes ligadas a %%u
)

:atalhos
rem --- 8. Atalhos ------------------------------------------------------------
echo.
if exist criar-atalho.vbs (
  wscript criar-atalho.vbs
) else (
  echo   [!] criar-atalho.vbs nao encontrado - atalhos nao criados.
)

rem --- 9. Camera -------------------------------------------------------------
echo.
if not exist "simplusCameraLib\simplusCamera.exe" (
  echo   [!] Falta a pasta simplusCameraLib.
  echo       Ela tem 151 MB de binarios e fica fora do GitHub: copie da outra
  echo       maquina. Sem ela o sistema abre normalmente, so nao captura da
  echo       camera.
) else (
  echo   [ok] simplusCameraLib presente
)

echo.
echo   ==========================================
echo   Pronto. Use o atalho "AG Foto" para ligar.
echo   ==========================================
echo.
pause
