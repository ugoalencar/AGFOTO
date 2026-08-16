@echo off
rem A camera despeja as fotos em images\temp, que e a pasta que o palco Atual
rem monitora. O /wait deixa o processo de pe esperando a proxima foto.
cd /d "%~dp0"
if not exist logs mkdir logs
if not exist images\temp mkdir images\temp
"%~dp0simplusCameraLib\simplusCamera.exe" /folder "%~dp0images\temp" /wait >> logs\camera.log 2>&1
