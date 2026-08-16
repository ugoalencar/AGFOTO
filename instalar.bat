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
cd /d "%~dp0"
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
if not exist .git (
  echo   [!] Esta pasta nao e uma copia do repositorio.
  echo       Para atualizar por dentro, ela precisa vir de um "git clone".
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
